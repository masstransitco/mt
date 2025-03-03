"use client";

import React, { useState, useEffect } from "react";

// ---------------------- Interfaces ----------------------
interface ExtractedData {
  documentType?: string;
  hkidNumber?: string;
  englishName?: string;
  chineseName?: string;
  dateOfBirth?: string;
  gender?: string;
  [key: string]: any;
}

interface DocumentData {
  url: string;
  uploadedAt: number;
  verified: boolean;
  verifiedAt?: any; // because we get it from server, might not be Timestamp
  verifiedBy?: string;
  rejectionReason?: string;
  rejectionDetail?: string;
  rejectedAt?: any;
  extractedData?: ExtractedData;
  ocrConfidence?: number;
  processedAt?: any;
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

interface SelectedDocumentType {
  type: string;
  data: DocumentData;
}

// ---------------------- Component ----------------------
export default function VerificationAdmin() {
  // State for simple password-based login
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  // State for users
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  // State for tab (pending, approved, rejected)
  const [currentTab, setCurrentTab] = useState("pending");

  // State for selected doc / user
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<SelectedDocumentType | null>(null);

  // OCR JSON editing
  const [jsonContent, setJsonContent] = useState<string | null>(null);
  const [isEditingJson, setIsEditingJson] = useState(false);

  // ---------------------- Login Handler ----------------------
  const handleLogin = () => {
    if (passwordInput === "20230301") {
      setIsAuthenticated(true);
      fetchUsers();
    } else {
      setPasswordError(true);
    }
  };

  // ---------------------- Fetch Users (From Server) ----------------------
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "fetchUsers" }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch users");
      }
      // data.users is an array of user docs
      const allUsers: UserData[] = data.users || [];
      // Filter out only those who have at least one doc, if you want
      const filtered = allUsers.filter((u) =>
        u.documents &&
        (u.documents["id-document"] || u.documents["driving-license"])
      );
      setUsers(filtered);
    } catch (err) {
      console.error("Error fetching users:", err);
      alert("Failed to fetch users. Check console.");
    } finally {
      setLoading(false);
    }
  };

  // ---------------------- View Document + OCR JSON (From Server) ----------------------
  const viewDocument = async (user: UserData, docType: string) => {
    if (!user) return;
    setSelectedUser(null);
    setSelectedDocument(null);
    setJsonContent(null);
    setIsEditingJson(false);

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "viewDocument",
          userId: user.userId,
          docType
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to view document");
      }

      // data.userData => entire user doc from Firestore
      const fetchedUser = data.userData as UserData;
      const docData = fetchedUser.documents?.[docType];
      if (!docData) {
        alert("Document data not found on server response.");
        return;
      }

      setSelectedUser(fetchedUser);
      setSelectedDocument({
        type: docType,
        data: docData,
      });

      // data.ocrJson => OCR JSON from Storage (or null if none)
      if (data.ocrJson) {
        setJsonContent(JSON.stringify(data.ocrJson, null, 2));
      } else {
        setJsonContent(null);
      }
      setIsEditingJson(false);
    } catch (err) {
      console.error("View document error:", err);
      alert(String(err));
    }
  };

  // ---------------------- Approve Document (Server) ----------------------
  const approveDocument = async () => {
    if (!selectedUser || !selectedDocument) return;
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "approveDocument",
          userId: selectedUser.userId,
          docType: selectedDocument.type,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to approve document");
      }
      alert("Document approved successfully!");
      // Reset
      setSelectedUser(null);
      setSelectedDocument(null);
      setJsonContent(null);
      fetchUsers();
    } catch (err) {
      console.error("Error approving document:", err);
      alert(String(err));
    }
  };

  // ---------------------- Reject Document (Server) ----------------------
  const rejectDocument = async (reason: string) => {
    if (!selectedUser || !selectedDocument) return;
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "rejectDocument",
          userId: selectedUser.userId,
          docType: selectedDocument.type,
          reason
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to reject document");
      }
      alert("Document rejected successfully!");
      // Reset
      setSelectedUser(null);
      setSelectedDocument(null);
      setJsonContent(null);
      fetchUsers();
    } catch (err) {
      console.error("Error rejecting document:", err);
      alert(String(err));
    }
  };

  // ---------------------- Save Updated OCR JSON (Server) ----------------------
  const saveJsonChanges = async () => {
    if (!selectedUser || !selectedDocument || !jsonContent) return;
    try {
      // Validate JSON syntax
      JSON.parse(jsonContent);

      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "saveJson",
          userId: selectedUser.userId,
          docType: selectedDocument.type,
          jsonContent
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to save JSON");
      }
      alert("JSON file updated successfully!");
      setIsEditingJson(false);
    } catch (err) {
      console.error("Error updating JSON:", err);
      alert(String(err));
    }
  };

  // ---------------------- Render ----------------------
  if (!isAuthenticated) {
    return (
      <div className="p-4 max-w-md mx-auto mt-10 bg-white rounded shadow">
        <h1 className="text-2xl font-bold mb-4">Admin Login</h1>
        <input
          type="password"
          placeholder="Enter password"
          value={passwordInput}
          onChange={(e) => {
            setPasswordInput(e.target.value);
            setPasswordError(false);
          }}
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

  // Main Admin UI
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Document Verification Admin</h1>
      <div className="mb-4">
        <div className="flex gap-2 mb-4">
          <button
            className={`p-2 rounded ${
              currentTab === "pending" ? "bg-blue-500 text-white" : "bg-gray-200"
            }`}
            onClick={() => setCurrentTab("pending")}
          >
            Pending
          </button>
          <button
            className={`p-2 rounded ${
              currentTab === "approved" ? "bg-blue-500 text-white" : "bg-gray-200"
            }`}
            onClick={() => setCurrentTab("approved")}
          >
            Approved
          </button>
          <button
            className={`p-2 rounded ${
              currentTab === "rejected" ? "bg-blue-500 text-white" : "bg-gray-200"
            }`}
            onClick={() => setCurrentTab("rejected")}
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
        <p>Loading user data...</p>
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
              {users
                .filter((user) => {
                  if (currentTab === "pending") {
                    return (
                      (user.documents?.["id-document"] &&
                        !user.documents["id-document"].verified &&
                        !user.documents["id-document"].rejectionReason) ||
                      (user.documents?.["driving-license"] &&
                        !user.documents["driving-license"].verified &&
                        !user.documents["driving-license"].rejectionReason)
                    );
                  } else if (currentTab === "approved") {
                    return (
                      (user.documents?.["id-document"] &&
                        user.documents["id-document"].verified) ||
                      (user.documents?.["driving-license"] &&
                        user.documents["driving-license"].verified)
                    );
                  } else if (currentTab === "rejected") {
                    return (
                      (user.documents?.["id-document"] &&
                        user.documents["id-document"].rejectionReason) ||
                      (user.documents?.["driving-license"] &&
                        user.documents["driving-license"].rejectionReason)
                    );
                  }
                  return true;
                })
                .map((user) => (
                  <tr key={user.userId}>
                    <td className="p-2 border">
                      <div>
                        <p className="font-bold">{user.displayName || "No Name"}</p>
                        <p className="text-sm">
                          {user.email || user.phoneNumber || user.userId}
                        </p>
                      </div>
                    </td>
                    <td className="p-2 border">
                      {user.documents?.["id-document"] ? (
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            user.documents["id-document"].verified
                              ? "bg-green-100 text-green-800"
                              : user.documents["id-document"].rejectionReason
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {user.documents["id-document"].verified
                            ? "Verified"
                            : user.documents["id-document"].rejectionReason
                            ? "Rejected"
                            : "Pending"}
                        </span>
                      ) : (
                        "Not Submitted"
                      )}
                    </td>
                    <td className="p-2 border">
                      {user.documents?.["driving-license"] ? (
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            user.documents["driving-license"].verified
                              ? "bg-green-100 text-green-800"
                              : user.documents["driving-license"].rejectionReason
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {user.documents["driving-license"].verified
                            ? "Verified"
                            : user.documents["driving-license"].rejectionReason
                            ? "Rejected"
                            : "Pending"}
                        </span>
                      ) : (
                        "Not Submitted"
                      )}
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

      {/* Modal for Document / OCR JSON */}
      {selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white p-4 rounded max-w-4xl max-h-[90vh] overflow-auto w-full md:w-auto">
            <h2 className="text-xl font-bold mb-4">
              {selectedDocument.type === "id-document"
                ? "Identity Document"
                : "Driving License"}
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
                <p>
                  <strong>User ID:</strong> {selectedUser?.userId}
                </p>
                {selectedUser?.email && (
                  <p>
                    <strong>Email:</strong> {selectedUser.email}
                  </p>
                )}
                {selectedUser?.phoneNumber && (
                  <p>
                    <strong>Phone:</strong> {selectedUser.phoneNumber}
                  </p>
                )}

                {/* Extracted Data */}
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

                {/* OCR JSON Data */}
                {jsonContent && (
                  <div className="mt-4">
                    <h3 className="font-bold mb-2 flex items-center justify-between">
                      <span>OCR JSON Data</span>
                      {!isEditingJson && (
                        <button
                          className="p-1 bg-blue-500 text-white rounded text-xs"
                          onClick={() => setIsEditingJson(true)}
                        >
                          Edit JSON
                        </button>
                      )}
                    </h3>

                    {!isEditingJson ? (
                      <div className="p-2 bg-gray-100 rounded max-h-40 overflow-auto">
                        <pre className="text-xs">{jsonContent}</pre>
                      </div>
                    ) : (
                      <div>
                        <textarea
                          className="w-full h-40 p-2 border rounded text-xs"
                          value={jsonContent}
                          onChange={(e) => setJsonContent(e.target.value)}
                        />
                        <div className="mt-2 flex gap-2">
                          <button
                            className="px-3 py-1 bg-green-500 text-white rounded text-xs"
                            onClick={async () => {
                              await saveJsonChanges();
                            }}
                          >
                            Save JSON Changes
                          </button>
                          <button
                            className="px-3 py-1 bg-gray-300 text-black rounded text-xs"
                            onClick={() => setIsEditingJson(false)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-4 flex justify-between">
              <div>
                <button
                  className="p-2 bg-red-500 text-white rounded mr-2"
                  onClick={() => rejectDocument("unclear")}
                >
                  Reject: Unclear
                </button>
                <button
                  className="p-2 bg-red-500 text-white rounded mr-2"
                  onClick={() => rejectDocument("mismatch")}
                >
                  Reject: Mismatch
                </button>
                <button
                  className="p-2 bg-red-500 text-white rounded"
                  onClick={() => rejectDocument("expired")}
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
                    setJsonContent(null);
                    setIsEditingJson(false);
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
