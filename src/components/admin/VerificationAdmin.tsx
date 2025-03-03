"use client";

import React, { useState } from "react";

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
  verifiedAt?: any;
  verifiedBy?: string;
  rejectionReason?: string;
  rejectionDetail?: string;
  rejectedAt?: any;
  extractedData?: ExtractedData;
  ocrConfidence?: number;
  processedAt?: any;
}

interface UserDocuments {
  [key: string]: DocumentData | undefined;
  "id-document"?: DocumentData;
  "driving-license"?: DocumentData;
}

interface UserData {
  // Renamed to uid
  uid: string;
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
        body: JSON.stringify({ 
          op: "fetchUsers",
          adminPassword: "20230301",
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch users");
      }

      const allUsers: UserData[] = data.users || [];
      // Filter if you only want users who have at least one doc
      const filtered = allUsers.filter(
        (u) =>
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
    // 1) Validate uid
    const uid = user?.uid?.trim?.();
    if (!uid) {
      console.error("No valid uid found on user:", user);
      return;
    }

    // Reset states
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
          adminPassword: "20230301",
          userId: uid, // The admin API expects "userId" param, but we'll pass uid
          docType,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to view document");
      }

      // We get back data.userData
      const fetchedUser = data.userData as UserData;
      const docData = fetchedUser.documents?.[docType];
      if (!docData) {
        alert("Document data not found on server response.");
        return;
      }

      setSelectedUser(fetchedUser);
      setSelectedDocument({ type: docType, data: docData });

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

    const uid = selectedUser.uid?.trim?.();
    if (!uid) {
      console.error("No valid uid found for selectedUser:", selectedUser);
      return;
    }

    const docType = selectedDocument.type;
    console.log("Approving doc for user:", uid, "docType:", docType);

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "approveDocument",
          adminPassword: "20230301",
          userId: uid, // The backend param is "userId"
          docType,
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

    const uid = selectedUser.uid?.trim?.();
    if (!uid) {
      console.error("No valid uid found for selectedUser:", selectedUser);
      return;
    }

    const docType = selectedDocument.type;
    console.log("Rejecting doc for user:", uid, "docType:", docType, "reason:", reason);

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "rejectDocument",
          adminPassword: "20230301",
          userId: uid, // The backend param is "userId"
          docType,
          reason,
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
      JSON.parse(jsonContent); // Validate JSON
    } catch (error) {
      alert("Invalid JSON format. Please fix before saving.");
      return;
    }

    const uid = selectedUser.uid?.trim?.();
    if (!uid) {
      console.error("No valid uid found for selectedUser:", selectedUser);
      return;
    }
    const docType = selectedDocument.type;

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "saveJson",
          adminPassword: "20230301",
          userId: uid, // The backend param is "userId"
          docType,
          jsonContent,
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
      <div className="p-4 max-w-md mx-auto mt-10 bg-white dark:bg-gray-800 rounded shadow">
        <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
          Admin Login
        </h1>
        <input
          type="password"
          placeholder="Enter password"
          value={passwordInput}
          onChange={(e) => {
            setPasswordInput(e.target.value);
            setPasswordError(false);
          }}
          className="w-full p-2 border rounded mb-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleLogin();
          }}
        />
        {passwordError && (
          <p className="text-red-500 text-sm mb-2">Incorrect password</p>
        )}
        <button
          className="w-full p-2 bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-700"
          onClick={handleLogin}
        >
          Login
        </button>
      </div>
    );
  }

  // Main Admin UI
  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
        Document Verification Admin
      </h1>
      <div className="mb-4">
        <div className="flex gap-2 mb-4">
          <button
            className={`p-2 rounded ${
              currentTab === "pending"
                ? "bg-blue-500 dark:bg-blue-600 text-white"
                : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            }`}
            onClick={() => setCurrentTab("pending")}
          >
            Pending
          </button>
          <button
            className={`p-2 rounded ${
              currentTab === "approved"
                ? "bg-blue-500 dark:bg-blue-600 text-white"
                : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            }`}
            onClick={() => setCurrentTab("approved")}
          >
            Approved
          </button>
          <button
            className={`p-2 rounded ${
              currentTab === "rejected"
                ? "bg-blue-500 dark:bg-blue-600 text-white"
                : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            }`}
            onClick={() => setCurrentTab("rejected")}
          >
            Rejected
          </button>
        </div>

        <button
          className="p-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 mb-4 text-gray-900 dark:text-gray-100"
          onClick={fetchUsers}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-gray-900 dark:text-gray-100">
          Loading user data...
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white dark:bg-gray-800 border dark:border-gray-700">
            <thead>
              <tr>
                <th className="p-2 border dark:border-gray-700 text-gray-900 dark:text-gray-100">
                  User
                </th>
                <th className="p-2 border dark:border-gray-700 text-gray-900 dark:text-gray-100">
                  ID Document
                </th>
                <th className="p-2 border dark:border-gray-700 text-gray-900 dark:text-gray-100">
                  Driving License
                </th>
                <th className="p-2 border dark:border-gray-700 text-gray-900 dark:text-gray-100">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users
                .filter((user) => {
                  if (currentTab === "pending") {
                    // Documents that are not yet verified or rejected
                    return (
                      (user.documents?.["id-document"] &&
                        !user.documents["id-document"].verified &&
                        !user.documents["id-document"].rejectionReason) ||
                      (user.documents?.["driving-license"] &&
                        !user.documents["driving-license"].verified &&
                        !user.documents["driving-license"].rejectionReason)
                    );
                  } else if (currentTab === "approved") {
                    // Documents that are verified
                    return (
                      (user.documents?.["id-document"] &&
                        user.documents["id-document"].verified) ||
                      (user.documents?.["driving-license"] &&
                        user.documents["driving-license"].verified)
                    );
                  } else if (currentTab === "rejected") {
                    // Documents that are rejected
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
                  <tr key={user.uid}>
                    <td className="p-2 border dark:border-gray-700">
                      <div>
                        <p className="font-bold text-gray-900 dark:text-gray-100">
                          {user.displayName || "No Name"}
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {user.email || user.phoneNumber || user.uid}
                        </p>
                      </div>
                    </td>
                    <td className="p-2 border dark:border-gray-700">
                      {user.documents?.["id-document"] ? (
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            user.documents["id-document"].verified
                              ? "bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100"
                              : user.documents["id-document"].rejectionReason
                              ? "bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-100"
                              : "bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-100"
                          }`}
                        >
                          {user.documents["id-document"].verified
                            ? "Verified"
                            : user.documents["id-document"].rejectionReason
                            ? "Rejected"
                            : "Pending"}
                        </span>
                      ) : (
                        <span className="text-gray-900 dark:text-gray-100">
                          Not Submitted
                        </span>
                      )}
                    </td>
                    <td className="p-2 border dark:border-gray-700">
                      {user.documents?.["driving-license"] ? (
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            user.documents["driving-license"].verified
                              ? "bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100"
                              : user.documents["driving-license"].rejectionReason
                              ? "bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-100"
                              : "bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-100"
                          }`}
                        >
                          {user.documents["driving-license"].verified
                            ? "Verified"
                            : user.documents["driving-license"].rejectionReason
                            ? "Rejected"
                            : "Pending"}
                        </span>
                      ) : (
                        <span className="text-gray-900 dark:text-gray-100">
                          Not Submitted
                        </span>
                      )}
                    </td>
                    <td className="p-2 border dark:border-gray-700">
                      {user.documents?.["id-document"] && (
                        <button
                          className="p-1 bg-blue-500 dark:bg-blue-600 text-white rounded mr-2 hover:bg-blue-600 dark:hover:bg-blue-700"
                          onClick={() => viewDocument(user, "id-document")}
                        >
                          View ID
                        </button>
                      )}
                      {user.documents?.["driving-license"] && (
                        <button
                          className="p-1 bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-700"
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
          <div className="bg-white dark:bg-gray-800 p-4 rounded max-w-4xl max-h-[90vh] overflow-auto w-full md:w-auto">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
              {selectedDocument.type === "id-document"
                ? "Identity Document"
                : "Driving License"}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Document Image */}
              {selectedDocument.data.url && (
                <div>
                  <h3 className="font-bold mb-2 text-gray-900 dark:text-gray-100">
                    Document Image
                  </h3>
                  <img
                    src={selectedDocument.data.url}
                    alt="Document"
                    className="max-w-full border rounded dark:border-gray-700"
                  />
                </div>
              )}

              {/* User & Document Info */}
              <div>
                <h3 className="font-bold mb-2 text-gray-900 dark:text-gray-100">
                  User Information
                </h3>
                <p className="text-gray-900 dark:text-gray-100">
                  <strong>UID:</strong> {selectedUser?.uid}
                </p>
                {selectedUser?.email && (
                  <p className="text-gray-900 dark:text-gray-100">
                    <strong>Email:</strong> {selectedUser.email}
                  </p>
                )}
                {selectedUser?.phoneNumber && (
                  <p className="text-gray-900 dark:text-gray-100">
                    <strong>Phone:</strong> {selectedUser.phoneNumber}
                  </p>
                )}

                {/* Extracted Data */}
                {selectedDocument.data.extractedData && (
                  <div className="mt-4">
                    <h3 className="font-bold mb-2 text-gray-900 dark:text-gray-100">
                      Extracted Data
                    </h3>
                    <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded">
                      <pre className="whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">
                        {JSON.stringify(selectedDocument.data.extractedData, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* OCR JSON Data */}
                {jsonContent && (
                  <div className="mt-4">
                    <h3 className="font-bold mb-2 flex items-center justify-between text-gray-900 dark:text-gray-100">
                      <span>OCR JSON Data</span>
                      {!isEditingJson && (
                        <button
                          className="p-1 bg-blue-500 dark:bg-blue-600 text-white rounded text-xs hover:bg-blue-600 dark:hover:bg-blue-700"
                          onClick={() => setIsEditingJson(true)}
                        >
                          Edit JSON
                        </button>
                      )}
                    </h3>

                    {!isEditingJson ? (
                      <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded max-h-40 overflow-auto">
                        <pre className="text-xs text-gray-900 dark:text-gray-100">
                          {jsonContent}
                        </pre>
                      </div>
                    ) : (
                      <div>
                        <textarea
                          className="w-full h-40 p-2 border rounded text-xs bg-gray-50 dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                          value={jsonContent}
                          onChange={(e) => setJsonContent(e.target.value)}
                        />
                        <div className="mt-2 flex gap-2">
                          <button
                            className="px-3 py-1 bg-green-500 dark:bg-green-600 text-white rounded text-xs hover:bg-green-600 dark:hover:bg-green-700"
                            onClick={saveJsonChanges}
                          >
                            Save JSON Changes
                          </button>
                          <button
                            className="px-3 py-1 bg-gray-300 dark:bg-gray-500 text-black rounded text-xs hover:bg-gray-400 dark:hover:bg-gray-600"
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
                  className="p-2 bg-red-500 dark:bg-red-600 text-white rounded mr-2 hover:bg-red-600 dark:hover:bg-red-700"
                  onClick={() => rejectDocument("unclear")}
                >
                  Reject: Unclear
                </button>
                <button
                  className="p-2 bg-red-500 dark:bg-red-600 text-white rounded mr-2 hover:bg-red-600 dark:hover:bg-red-700"
                  onClick={() => rejectDocument("mismatch")}
                >
                  Reject: Mismatch
                </button>
                <button
                  className="p-2 bg-red-500 dark:bg-red-600 text-white rounded hover:bg-red-600 dark:hover:bg-red-700"
                  onClick={() => rejectDocument("expired")}
                >
                  Reject: Expired
                </button>
              </div>
              <div>
                <button
                  className="p-2 bg-gray-300 dark:bg-gray-500 text-black rounded mr-2 hover:bg-gray-400 dark:hover:bg-gray-600"
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
                  className="p-2 bg-green-500 dark:bg-green-600 text-white rounded hover:bg-green-600 dark:hover:bg-green-700"
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
