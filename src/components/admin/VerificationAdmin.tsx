// src/components/admin/VerificationAdmin.tsx
"use client";

import React, { useState, useEffect } from "react";
import { getFirestore, collection, getDocs, doc, updateDoc, Timestamp } from "firebase/firestore";
import { getStorage, ref, getDownloadURL } from "firebase/storage";

export default function VerificationAdmin() {
  // State for authentication
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  
  // State for users and documents
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState("pending");
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [jsonContent, setJsonContent] = useState(null);
  
  const db = getFirestore();
  const storage = getStorage();
  
  const handleLogin = () => {
    if (passwordInput === "20230301") {
      setIsAuthenticated(true);
      fetchUsers();
    } else {
      setPasswordError(true);
    }
  };
  
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const usersRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersRef);
      
      const userData = [];
      for (const userDoc of usersSnapshot.docs) {
        const data = userDoc.data();
        data.userId = userDoc.id;
        
        if (data.documents && (
          data.documents["id-document"] || 
          data.documents["driving-license"]
        )) {
          userData.push(data);
        }
      }
      
      setUsers(userData);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };
  
  const viewDocument = async (user, docType) => {
    if (!user.documents) return;
    
    let documentData = null;
    if (docType === "id-document" && user.documents["id-document"]) {
      documentData = user.documents["id-document"];
    } else if (docType === "driving-license" && user.documents["driving-license"]) {
      documentData = user.documents["driving-license"];
    }
    
    if (documentData) {
      setSelectedUser(user);
      setSelectedDocument({
        type: docType,
        data: documentData
      });
      
      // Try to fetch OCR JSON
      try {
        const jsonFilePath = `ocrResults/${user.userId}/${docType}.json`;
        const jsonFileRef = ref(storage, jsonFilePath);
        const jsonUrl = await getDownloadURL(jsonFileRef);
        
        const response = await fetch(jsonUrl);
        const jsonData = await response.json();
        
        setJsonContent(JSON.stringify(jsonData, null, 2));
      } catch (error) {
        console.log(`No OCR JSON file found for ${user.userId}/${docType}`);
        setJsonContent(null);
      }
    }
  };
  
  const approveDocument = async () => {
    if (!selectedUser || !selectedDocument) return;
    
    try {
      const userRef = doc(db, "users", selectedUser.userId);
      
      await updateDoc(userRef, {
        [`documents.${selectedDocument.type}.verified`]: true,
        [`documents.${selectedDocument.type}.verifiedAt`]: Timestamp.now(),
        [`documents.${selectedDocument.type}.rejectionReason`]: null,
        [`documents.${selectedDocument.type}.rejectionDetail`]: null
      });
      
      alert("Document approved successfully!");
      setSelectedDocument(null);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      console.error("Error approving document:", error);
      alert("Error approving document: " + error.message);
    }
  };
  
  const rejectDocument = async (reason) => {
    if (!selectedUser || !selectedDocument) return;
    
    try {
      const userRef = doc(db, "users", selectedUser.userId);
      
      const reasonDescriptions = {
        'unclear': 'The uploaded document is blurry, has poor lighting, or key information is not clearly visible.',
        'mismatch': 'The information on the document does not match our records or other submitted documents.',
        'expired': 'The document appears to be expired or no longer valid.'
      };
      
      await updateDoc(userRef, {
        [`documents.${selectedDocument.type}.verified`]: false,
        [`documents.${selectedDocument.type}.rejectionReason`]: reason,
        [`documents.${selectedDocument.type}.rejectionDetail`]: reasonDescriptions[reason] || '',
        [`documents.${selectedDocument.type}.rejectedAt`]: Timestamp.now()
      });
      
      alert("Document rejected successfully!");
      setSelectedDocument(null);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      console.error("Error rejecting document:", error);
      alert("Error rejecting document: " + error.message);
    }
  };
  
  if (!isAuthenticated) {
    return (
      <div className="p-4 max-w-md mx-auto mt-10 bg-white rounded shadow">
        <h1 className="text-2xl font-bold mb-4">Admin Login</h1>
        <input
          type="password"
          placeholder="Enter password"
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          className="w-full p-2 border rounded mb-2"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleLogin();
          }}
        />
        {passwordError && (
          <p className="text-red-500 text-sm mb-2">Incorrect password</p>
        )}
        <button 
          className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={handleLogin}
        >
          Login
        </button>
      </div>
    );
  }
  
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Document Verification Admin</h1>
      
      <div className="mb-4">
        <div className="flex gap-2 mb-4">
          <button 
            className={`p-2 rounded ${currentTab === 'pending' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            onClick={() => setCurrentTab('pending')}
          >
            Pending
          </button>
          <button 
            className={`p-2 rounded ${currentTab === 'approved' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            onClick={() => setCurrentTab('approved')}
          >
            Approved
          </button>
          <button 
            className={`p-2 rounded ${currentTab === 'rejected' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            onClick={() => setCurrentTab('rejected')}
          >
            Rejected
          </button>
        </div>
        
        <button 
          className="p-2 bg-gray-200 rounded hover:bg-gray-300 mb-4"
          onClick={fetchUsers}
        >
          Refresh
        </button>
      </div>
      
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border">
            <thead>
              <tr>
                <th className="p-2 border">User</th>
                <th className="p-2 border">ID Document</th>
                <th className="p-2 border">Driving License</th>
                <th className="p-2 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.filter(user => {
                if (currentTab === 'pending') {
                  return (user.documents?.["id-document"] && !user.documents["id-document"].verified && !user.documents["id-document"].rejectionReason) ||
                    (user.documents?.["driving-license"] && !user.documents["driving-license"].verified && !user.documents["driving-license"].rejectionReason);
                } else if (currentTab === 'approved') {
                  return (user.documents?.["id-document"] && user.documents["id-document"].verified) ||
                    (user.documents?.["driving-license"] && user.documents["driving-license"].verified);
                } else if (currentTab === 'rejected') {
                  return (user.documents?.["id-document"] && user.documents["id-document"].rejectionReason) ||
                    (user.documents?.["driving-license"] && user.documents["driving-license"].rejectionReason);
                }
                return true;
              }).map(user => (
                <tr key={user.userId}>
                  <td className="p-2 border">
                    <div>
                      <p className="font-bold">{user.displayName || 'No Name'}</p>
                      <p className="text-sm">{user.email || user.phoneNumber || user.userId}</p>
                    </div>
                  </td>
                  <td className="p-2 border">
                    {user.documents?.["id-document"] ? (
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        user.documents["id-document"].verified 
                          ? 'bg-green-100 text-green-800' 
                          : user.documents["id-document"].rejectionReason
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {user.documents["id-document"].verified 
                          ? 'Verified' 
                          : user.documents["id-document"].rejectionReason
                            ? 'Rejected'
                            : 'Pending'}
                      </span>
                    ) : "Not Submitted"}
                  </td>
                  <td className="p-2 border">
                    {user.documents?.["driving-license"] ? (
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        user.documents["driving-license"].verified 
                          ? 'bg-green-100 text-green-800' 
                          : user.documents["driving-license"].rejectionReason
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {user.documents["driving-license"].verified 
                          ? 'Verified' 
                          : user.documents["driving-license"].rejectionReason
                            ? 'Rejected'
                            : 'Pending'}
                      </span>
                    ) : "Not Submitted"}
                  </td>
                  <td className="p-2 border">
                    {user.documents?.["id-document"] && (
                      <button 
                        className="p-1 bg-blue-500 text-white rounded mr-2"
                        onClick={() => viewDocument(user, "id-document")}
                      >
                        View ID
                      </button>
                    )}
                    {user.documents?.["driving-license"] && (
                      <button 
                        className="p-1 bg-blue-500 text-white rounded"
                        onClick={() => viewDocument(user, "driving-license")}
                      >
                        View License
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white p-4 rounded max-w-4xl max-h-[90vh] overflow-auto">
            <h2 className="text-xl font-bold mb-4">
              {selectedDocument.type === "id-document" ? "Identity Document" : "Driving License"}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Document Image */}
              {selectedDocument.data.url && (
                <div>
                  <h3 className="font-bold mb-2">Document Image</h3>
                  <img 
                    src={selectedDocument.data.url} 
                    alt="Document" 
                    className="max-w-full border rounded"
                  />
                </div>
              )}
              
              {/* User & Document Info */}
              <div>
                <h3 className="font-bold mb-2">User Information</h3>
                <p><strong>User ID:</strong> {selectedUser.userId}</p>
                {selectedUser.email && <p><strong>Email:</strong> {selectedUser.email}</p>}
                {selectedUser.phoneNumber && <p><strong>Phone:</strong> {selectedUser.phoneNumber}</p>}
                
                {selectedDocument.data.extractedData && (
                  <div className="mt-4">
                    <h3 className="font-bold mb-2">Extracted Data</h3>
                    <div className="p-2 bg-gray-100 rounded">
                      <pre className="whitespace-pre-wrap text-sm">
                        {JSON.stringify(selectedDocument.data.extractedData, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
                
                {jsonContent && (
                  <div className="mt-4">
                    <h3 className="font-bold mb-2">OCR JSON Data</h3>
                    <div className="p-2 bg-gray-100 rounded max-h-40 overflow-auto">
                      <pre className="text-xs">{jsonContent}</pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-4 flex justify-between">
              <div>
                <button 
                  className="p-2 bg-red-500 text-white rounded mr-2"
                  onClick={() => rejectDocument('unclear')}
                >
                  Reject: Unclear
                </button>
                <button 
                  className="p-2 bg-red-500 text-white rounded mr-2"
                  onClick={() => rejectDocument('mismatch')}
                >
                  Reject: Mismatch
                </button>
                <button 
                  className="p-2 bg-red-500 text-white rounded"
                  onClick={() => rejectDocument('expired')}
                >
                  Reject: Expired
                </button>
              </div>
              
              <div>
                <button 
                  className="p-2 bg-gray-300 rounded mr-2"
                  onClick={() => {
                    setSelectedDocument(null);
                    setSelectedUser(null);
                  }}
                >
                  Close
                </button>
                <button 
                  className="p-2 bg-green-500 text-white rounded"
                  onClick={approveDocument}
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
