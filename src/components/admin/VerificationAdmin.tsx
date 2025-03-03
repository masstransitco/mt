"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle,
  XCircle,
  Search,
  Edit,
  Eye,
  FileText,
  RefreshCw,
  CheckCheck,
  AlertCircle,
} from "lucide-react";
import { getFirestore, collection, getDocs, doc, updateDoc, Timestamp } from "firebase/firestore";
import { getStorage, ref, getDownloadURL } from "firebase/storage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

// Simple rejection reasons
const REJECTION_REASONS = [
  { id: 'unclear', label: 'Document Unclear or Illegible', description: 'The uploaded document is blurry, has poor lighting, or key information is not clearly visible.' },
  { id: 'mismatch', label: 'Information Mismatch', description: 'The information on the document does not match our records or other submitted documents.' },
  { id: 'expired', label: 'Expired Document', description: 'The document appears to be expired or no longer valid.' }
];

// Document and user interfaces
interface ExtractedData {
  documentType: string;
  hkidNumber?: string;
  englishName?: string;
  chineseName?: string;
  dateOfBirth?: string;
  gender?: string;
  rawText?: string;
  [key: string]: any;
}

interface DocumentData {
  url: string;
  uploadedAt: number;
  verified: boolean;
  verifiedAt?: Timestamp;
  verifiedBy?: string;
  rejectionReason?: string;
  rejectionDetail?: string;
  rejectedAt?: Timestamp; // Add this property
  extractedData?: ExtractedData;
  ocrConfidence?: number;
  processedAt?: Timestamp;
}

interface UserDocuments {
  "id-document"?: DocumentData;
  "driving-license"?: DocumentData;
}

interface UserData {
  userId: string;
  email?: string;
  phoneNumber?: string;
  displayName?: string;
  documents?: UserDocuments;
}

export default function SimpleVerificationAdmin() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  // Data and UI state
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentTab, setCurrentTab] = useState("pending");
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [viewingDocument, setViewingDocument] = useState<{
    url: string;
    type: string;
    data: any;
    ocrJson?: any;
  } | null>(null);
  const [jsonContent, setJsonContent] = useState<string | null>(null);
  const [rejectionData, setRejectionData] = useState<{
    reason: string;
    detail: string;
    documentType: string;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const db = getFirestore();
  const storage = getStorage();

  // Authenticate with static password
  const handlePasswordSubmit = () => {
    if (passwordInput === "20230301") {
      setIsAuthenticated(true);
      setPasswordError(false);
      fetchUsers();
    } else {
      setPasswordError(true);
    }
  };

  // Filter users based on tab and search
  const filteredUsers = users.filter(user => {
    // First apply tab filter
    if (currentTab === "pending") {
      const hasUnverifiedDocs = 
        (user.documents?.["id-document"] && !user.documents["id-document"].verified && !user.documents["id-document"].rejectionReason) ||
        (user.documents?.["driving-license"] && !user.documents["driving-license"].verified && !user.documents["driving-license"].rejectionReason);
      
      if (!hasUnverifiedDocs) return false;
    } 
    else if (currentTab === "approved") {
      const hasApprovedDocs = 
        (user.documents?.["id-document"] && user.documents["id-document"].verified) ||
        (user.documents?.["driving-license"] && user.documents["driving-license"].verified);
      
      if (!hasApprovedDocs) return false;
    } 
    else if (currentTab === "rejected") {
      const hasRejectedDocs = 
        (user.documents?.["id-document"] && user.documents["id-document"].rejectionReason) ||
        (user.documents?.["driving-license"] && user.documents["driving-license"].rejectionReason);
      
      if (!hasRejectedDocs) return false;
    }

    // Then apply search filter if there's a search term
    if (!searchTerm) return true;

    const term = searchTerm.toLowerCase();
    return (
      user.email?.toLowerCase().includes(term) ||
      user.phoneNumber?.toLowerCase().includes(term) ||
      user.displayName?.toLowerCase().includes(term) ||
      user.userId.toLowerCase().includes(term) ||
      user.documents?.["id-document"]?.extractedData?.hkidNumber?.toLowerCase().includes(term) ||
      user.documents?.["id-document"]?.extractedData?.englishName?.toLowerCase().includes(term)
    );
  });

  // Fetch users with documents from Firestore
  const fetchUsers = async () => {
    setLoading(true);
    setRefreshing(true);
    try {
      const usersRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersRef);
      
      const userData: UserData[] = [];
      
      for (const userDoc of usersSnapshot.docs) {
        const data = userDoc.data() as UserData;
        data.userId = userDoc.id;
        
        // Only include users who have submitted documents
        if (data.documents && (
          data.documents["id-document"] || 
          data.documents["driving-license"]
        )) {
          userData.push(data);
        }
      }
      
      // Sort by most recent upload first
      userData.sort((a, b) => {
        const aTime = Math.max(
          a.documents?.["id-document"]?.uploadedAt || 0,
          a.documents?.["driving-license"]?.uploadedAt || 0
        );
        
        const bTime = Math.max(
          b.documents?.["id-document"]?.uploadedAt || 0,
          b.documents?.["driving-license"]?.uploadedAt || 0
        );
        
        return bTime - aTime;
      });
      
      setUsers(userData);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // View document and try to fetch the OCR JSON file
  const handleViewDocument = async (user: UserData, docType: string) => {
    if (!user.documents) return;
    
    let url = "";
    let data = null;
    
    if (docType === "id-document" && user.documents["id-document"]) {
      url = user.documents["id-document"].url;
      data = user.documents["id-document"];
    } else if (docType === "driving-license" && user.documents["driving-license"]) {
      url = user.documents["driving-license"].url;
      data = user.documents["driving-license"];
    }
    
    if (url && data) {
      setJsonContent(null);
      setViewingDocument({
        url,
        type: docType,
        data
      });
      setSelectedUser(user);

      // Try to fetch the OCR JSON file from storage
      try {
        const jsonFilePath = `ocrResults/${user.userId}/${docType}.json`;
        const jsonFileRef = ref(storage, jsonFilePath);
        const jsonUrl = await getDownloadURL(jsonFileRef);
        
        const response = await fetch(jsonUrl);
        const jsonData = await response.json();
        
        setViewingDocument(prev => ({
          ...prev!,
          ocrJson: jsonData
        }));
        
        // Pretty format the JSON for display
        setJsonContent(JSON.stringify(jsonData, null, 2));
      } catch (error) {
        console.log(`No OCR JSON file found for ${user.userId}/${docType}`);
        // This is not an error - some documents might not have OCR data
      }
    }
  };

  // Open rejection dialog
  const handleOpenRejectionDialog = () => {
    if (!viewingDocument) return;
    
    setRejectionData({
      reason: "",
      detail: "",
      documentType: viewingDocument.type
    });
  };

  // Approve document
  const handleApproveDocument = async () => {
    if (!selectedUser || !viewingDocument) return;
    
    setActionLoading(true);
    try {
      const userRef = doc(db, "users", selectedUser.userId);
      
      const updateData = {
        [`documents.${viewingDocument.type}.verified`]: true,
        [`documents.${viewingDocument.type}.verifiedAt`]: Timestamp.now(),
        // Remove any rejection info if it exists
        [`documents.${viewingDocument.type}.rejectionReason`]: null,
        [`documents.${viewingDocument.type}.rejectionDetail`]: null
      };
      
      await updateDoc(userRef, updateData);
      
      // Update local state
      setUsers(prev => prev.map(user => {
        if (user.userId === selectedUser.userId && user.documents) {
          const updatedDocuments = {...user.documents};
          if (updatedDocuments[viewingDocument.type as keyof UserDocuments]) {
            const docData = updatedDocuments[viewingDocument.type as keyof UserDocuments] as DocumentData;
            docData.verified = true;
            docData.verifiedAt = Timestamp.now();
            delete docData.rejectionReason;
            delete docData.rejectionDetail;
          }
          return {...user, documents: updatedDocuments};
        }
        return user;
      }));
      
      // Reset state
      setViewingDocument(null);
      setSelectedUser(null);
    } catch (error) {
      console.error("Error approving document:", error);
    } finally {
      setActionLoading(false);
    }
  };

  // Reject document
  const handleRejectDocument = async () => {
    if (!selectedUser || !rejectionData) return;
    
    setActionLoading(true);
    try {
      const userRef = doc(db, "users", selectedUser.userId);
      
      // Prepare rejection details
      const rejectionReason = rejectionData.reason;
      const rejectionDetail = REJECTION_REASONS.find(r => r.id === rejectionData.reason)?.description || '';
      
      const updateData = {
        [`documents.${rejectionData.documentType}.verified`]: false,
        [`documents.${rejectionData.documentType}.rejectionReason`]: rejectionReason,
        [`documents.${rejectionData.documentType}.rejectionDetail`]: rejectionDetail,
        [`documents.${rejectionData.documentType}.rejectedAt`]: Timestamp.now()
      };
      
      await updateDoc(userRef, updateData);
      
      // Update local state
      setUsers(prev => prev.map(user => {
        if (user.userId === selectedUser.userId && user.documents) {
          const updatedDocuments = {...user.documents};
          if (updatedDocuments[rejectionData.documentType as keyof UserDocuments]) {
            const docData = updatedDocuments[rejectionData.documentType as keyof UserDocuments] as DocumentData;
            docData.verified = false;
            docData.rejectionReason = rejectionReason;
            docData.rejectionDetail = rejectionDetail;
            docData.rejectedAt = Timestamp.now();
          }
          return {...user, documents: updatedDocuments};
        }
        return user;
      }));
      
      // Reset state
      setRejectionData(null);
      setViewingDocument(null);
      setSelectedUser(null);
    } catch (error) {
      console.error("Error rejecting document:", error);
    } finally {
      setActionLoading(false);
    }
  };

  // Render document status badge
  const renderDocumentStatus = (document?: DocumentData) => {
    if (!document) return <Badge variant="outline">Not Submitted</Badge>;
    
    if (document.verified) {
      return <Badge className="bg-green-600">Verified</Badge>;
    } else if (document.rejectionReason) {
      return <Badge className="bg-red-600">Rejected</Badge>;
    } else {
      return <Badge className="bg-amber-600">Pending</Badge>;
    }
  };

  // Get pending verification count
  const getVerificationCount = () => {
    return users.filter(user => 
      (user.documents?.["id-document"] && !user.documents["id-document"].verified && !user.documents["id-document"].rejectionReason) ||
      (user.documents?.["driving-license"] && !user.documents["driving-license"].verified && !user.documents["driving-license"].rejectionReason)
    ).length;
  };

  // Format date from timestamp
  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleString();
  };

  // If not authenticated, show password modal
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Admin Verification</CardTitle>
            <CardDescription>
              Enter the admin password to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Enter password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className={passwordError ? "border-red-500" : ""}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handlePasswordSubmit();
                  }}
                />
                {passwordError && (
                  <p className="text-red-500 text-sm">Incorrect password</p>
                )}
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={handlePasswordSubmit}>
              Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-7xl">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Document Verification Admin</h1>
          <p className="text-gray-500 mt-1">
            Manage and verify user documents
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <Input
              className="pl-10"
              placeholder="Search by name, ID, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <Button 
            variant="outline" 
            onClick={fetchUsers}
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Document Verification</CardTitle>
          <CardDescription>
            {getVerificationCount()} pending verifications
          </CardDescription>
        </CardHeader>
        
        <Tabs value={currentTab} onValueChange={setCurrentTab}>
          <div className="px-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="pending" className="m-0">
            {renderUserTable()}
          </TabsContent>
          
          <TabsContent value="approved" className="m-0">
            {renderUserTable()}
          </TabsContent>
          
          <TabsContent value="rejected" className="m-0">
            {renderUserTable()}
          </TabsContent>
        </Tabs>
      </Card>
      
      {/* Document Viewer Dialog */}
      <Dialog 
        open={!!viewingDocument} 
        onOpenChange={(open) => {
          if (!open) {
            setViewingDocument(null);
            setSelectedUser(null);
            setJsonContent(null);
          }
        }}
      >
        <DialogContent className="max-w-7xl">
          <DialogHeader>
            <DialogTitle>
              {viewingDocument?.type === "id-document" 
                ? "Identity Document" 
                : "Driving License"}
            </DialogTitle>
            <DialogDescription>
              Review document information and verify the user
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left column: Document image and user info */}
            <div className="space-y-4">
              {/* Document Image */}
              {viewingDocument?.url && (
                <div className="aspect-[4/3] rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                  <img
                    src={viewingDocument.url}
                    alt="Document"
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
              
              {/* User info */}
              {selectedUser && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">User Information</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p><span className="font-medium">User ID:</span> {selectedUser.userId}</p>
                    {selectedUser.email && (
                      <p><span className="font-medium">Email:</span> {selectedUser.email}</p>
                    )}
                    {selectedUser.phoneNumber && (
                      <p><span className="font-medium">Phone:</span> {selectedUser.phoneNumber}</p>
                    )}
                    {selectedUser.displayName && (
                      <p><span className="font-medium">Name:</span> {selectedUser.displayName}</p>
                    )}
                    {viewingDocument?.data.uploadedAt && (
                      <p><span className="font-medium">Uploaded:</span> {formatDate(viewingDocument.data.uploadedAt)}</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
            
            {/* Right column: OCR data */}
            <div className="space-y-4">
              {/* Document data from OCR */}
              {viewingDocument?.data?.extractedData && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Extracted OCR Data</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                      {viewingDocument.data.extractedData.documentType === "HKID" ? (
                        <>
                          <p>
                            <span className="font-medium">Document Type:</span> Hong Kong ID Card
                          </p>
                          <p>
                            <span className="font-medium">HKID Number:</span> {viewingDocument.data.extractedData.hkidNumber || "Not detected"}
                          </p>
                          <p>
                            <span className="font-medium">English Name:</span> {viewingDocument.data.extractedData.englishName || "Not detected"}
                          </p>
                          <p>
                            <span className="font-medium">Chinese Name:</span> {viewingDocument.data.extractedData.chineseName || "Not detected"}
                          </p>
                          <p>
                            <span className="font-medium">Date of Birth:</span> {viewingDocument.data.extractedData.dateOfBirth || "Not detected"}
                          </p>
                          <p>
                            <span className="font-medium">Gender:</span> {viewingDocument.data.extractedData.gender || "Not detected"}
                          </p>
                        </>
                      ) : viewingDocument.data.extractedData.documentType === "Driving License" ? (
                        <>
                          <p>
                            <span className="font-medium">Document Type:</span> Driving License
                          </p>
                          {Object.entries(viewingDocument.data.extractedData).map(([key, value]) => {
                            if (key === "documentType") return null;
                            return (
                              <p key={key}>
                                <span className="font-medium">
                                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                                </span>{" "}
                                {value || "Not detected"}
                              </p>
                            );
                          })}
                        </>
                      ) : (
                        <>
                          <p>
                            <span className="font-medium">Document Type:</span> {viewingDocument.data.extractedData.documentType}
                          </p>
                          {Object.entries(viewingDocument.data.extractedData).map(([key, value]) => {
                            if (key === "documentType" || key === "rawText") return null;
                            return (
                              <p key={key}>
                                <span className="font-medium">
                                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                                </span>{" "}
                                {value || "Not detected"}
                              </p>
                            );
                          })}
                        </>
                      )}
                      
                      {viewingDocument.data.ocrConfidence && (
                        <p className="text-sm text-gray-500 mt-3">
                          <span className="font-medium">OCR Confidence:</span> {viewingDocument.data.ocrConfidence.toFixed(2)}%
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Raw JSON data */}
              {jsonContent && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">OCR JSON Data</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 bg-gray-50 rounded-lg max-h-64 overflow-auto">
                      <pre className="text-xs font-mono whitespace-pre-wrap">{jsonContent}</pre>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Raw OCR text */}
              {viewingDocument?.data?.extractedData?.rawText && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Raw OCR Text</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 bg-gray-50 rounded-lg max-h-40 overflow-auto">
                      <p className="whitespace-pre-wrap text-sm">{viewingDocument.data.extractedData.rawText}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
          
          {/* Action buttons */}
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button
              variant="outline"
              onClick={handleOpenRejectionDialog}
              className="flex items-center gap-2"
              disabled={actionLoading}
            >
              <XCircle className="h-4 w-4" />
              Reject
            </Button>
            
            <Button
              onClick={handleApproveDocument}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
              disabled={actionLoading}
            >
              {actionLoading ? (
                <span className="flex items-center">
                  <span className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2"></span>
                  Processing...
                </span>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Approve
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Rejection Reason Dialog */}
      <Dialog
        open={!!rejectionData}
        onOpenChange={(open) => {
          if (!open) setRejectionData(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Document</DialogTitle>
            <DialogDescription>
              Select a reason for rejecting this document
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="space-y-3">
              {REJECTION_REASONS.map((reason) => (
                <div 
                  key={reason.id}
                  className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    rejectionData?.reason === reason.id 
                    ? 'border-primary bg-primary/5' 
                    : 'border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => setRejectionData({
                    ...rejectionData!,
                    reason: reason.id
                  })}
                >
                  <div className={`flex-shrink-0 mt-0.5 rounded-full border w-5 h-5 flex items-center justify-center ${
                    rejectionData?.reason === reason.id 
                    ? 'border-primary' 
                    : 'border-gray-300'
                  }`}>
                    {rejectionData?.reason === reason.id && (
                      <div className="w-3 h-3 bg-primary rounded-full" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{reason.label}</p>
                    <p className="text-gray-500 text-xs">{reason.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setRejectionData(null)}
            >
              Cancel
            </Button>
            
            <Button 
              variant="destructive"
              onClick={handleRejectDocument}
              disabled={actionLoading || !rejectionData?.reason}
            >
              {actionLoading ? (
                <span className="flex items-center">
                  <span className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2"></span>
                  Processing...
                </span>
              ) : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  // Helper function to render user table
  function renderUserTable() {
    if (loading) {
      return (
        <div className="flex justify-center py-8">
          <div className="animate-spin h-10 w-10 border-2 border-primary rounded-full border-t-transparent"></div>
        </div>
      );
    }

    if (filteredUsers.length === 0) {
      return (
        <div className="py-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-gray-400 mb-3" />
          <h3 className="text-lg font-medium">No Documents Found</h3>
          <p className="text-sm text-gray-500">No user documents match the current filters</p>
        </div>
      );
    }

    return (
      <div className="relative overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>ID Document</TableHead>
              <TableHead>Driving License</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.userId}>
                <TableCell className="font-medium">
                  <div>
                    <p className="font-medium">{user.displayName || 'No Name'}</p>
                    <p className="text-sm text-gray-500">{user.email || user.phoneNumber || user.userId}</p>
                  </div>
                </TableCell>
                <TableCell>
                  {renderDocumentStatus(user.documents?.["id-document"])}
                </TableCell>
                <TableCell>
                  {renderDocumentStatus(user.documents?.["driving-license"])}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {user.documents?.["id-document"] && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleViewDocument(user, "id-document")}
                        className="flex items-center gap-1"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        ID
                      </Button>
                    )}
                    {user.documents?.["driving-license"] && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleViewDocument(user, "driving-license")}
                        className="flex items-center gap-1"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        License
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }
}
