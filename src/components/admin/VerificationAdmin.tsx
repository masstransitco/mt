"use client";

import React, { useState } from "react";
import { LogoSvg } from "../ui/logo/LogoSvg";

// Redux imports
import { useAppDispatch } from "@/store/store";
import { setUserVerification } from "@/store/verificationSlice";

// Firestore doc shape
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
  uid?: string;
  userId?: string;
  email?: string;
  phoneNumber?: string;
  displayName?: string;
  documents?: UserDocuments;
}

interface SelectedDocumentType {
  type: string;
  data: DocumentData;
}

// ------------------------------------
// 1) These should match your verificationSlice
// ------------------------------------
type DocStatus = "notUploaded" | "pending" | "approved" | "rejected";

interface DocumentStatus {
  status: DocStatus;
  url?: string;
  verified?: boolean;
  verifiedAt?: any;
  verifiedBy?: string;
  rejectionReason?: string;
  rejectionDetail?: string;
  rejectedAt?: any;
  extractedData?: any;
  ocrConfidence?: number;
  processedAt?: any;
  uploadedAt?: number;
}

interface VerificationData {
  idDocument?: DocumentStatus;
  drivingLicense?: DocumentStatus;
  // Possibly address, etc.
}

// ------------------------------------
// VerificationAdmin Component
// ------------------------------------
export default function VerificationAdmin() {
  // Simple password-based login
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  // Users
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab: pending, approved, rejected
  const [currentTab, setCurrentTab] = useState("pending");

  // Selected doc/user
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<SelectedDocumentType | null>(null);

  // OCR JSON editing
  const [jsonContent, setJsonContent] = useState<string | null>(null);
  const [isEditingJson, setIsEditingJson] = useState(false);

  // Redux dispatch
  const dispatch = useAppDispatch();

  // ---------------------- Login ----------------------
  const handleLogin = () => {
    if (passwordInput === "20230301") {
      setIsAuthenticated(true);
      fetchUsers();
    } else {
      setPasswordError(true);
    }
  };

  // ---------------------- Fetch Users ----------------------
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

      // Normalize user objects to handle both uid and userId
      const normalizedUsers = allUsers.map((user) => ({
        ...user,
        uid: user.uid || user.userId,
      }));

      // Filter to only users who have at least one doc
      const filtered = normalizedUsers.filter(
        (u) => u.documents && (u.documents["id-document"] || u.documents["driving-license"])
      );

      setUsers(filtered);

      // Also push each user's doc data to the verificationSlice
      filtered.forEach((user) => {
        const verificationData = convertUserToVerificationData(user);
        dispatch(setUserVerification({ uid: user.uid!, data: verificationData }));
      });
    } catch (err) {
      console.error("Error fetching users:", err);
      alert("Failed to fetch users. Check console.");
    } finally {
      setLoading(false);
    }
  };

  // ---------------------- Convert Firestore -> VerificationData ----------------------
  function convertUserToVerificationData(user: UserData): VerificationData {
    const docs = user.documents || {};

    return {
      idDocument: toDocStatus(docs["id-document"]),
      drivingLicense: toDocStatus(docs["driving-license"]),
    };
  }

  // Helper that maps a Firestore doc to your slice's typed DocumentStatus
  function toDocStatus(doc?: DocumentData): DocumentStatus {
    if (!doc) {
      return { status: "notUploaded" };
    }

    // Determine final status from doc.verified, doc.rejectionReason, etc.
    let derivedStatus: DocStatus = "pending";
    if (doc.verified) {
      derivedStatus = "approved";
    } else if (doc.rejectionReason) {
      derivedStatus = "rejected";
    }

    return {
      // Spread any extra fields
      ...doc,
      // Overwrite with typed literal
      status: derivedStatus,
    };
  }

  // ---------------------- View Document ----------------------
  const viewDocument = async (user: UserData, docType: string) => {
    const uid = user?.uid || user?.userId;
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
          userId: uid,
          docType,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to view document");
      }

      const fetchedUser = data.userData as UserData;
      fetchedUser.uid = fetchedUser.uid || fetchedUser.userId;

      const docData = fetchedUser.documents?.[docType];
      if (!docData) {
        alert("Document data not found on server response.");
        return;
      }

      setSelectedUser(fetchedUser);
      setSelectedDocument({ type: docType, data: docData });

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

  // ---------------------- Approve Document ----------------------
  const approveDocument = async () => {
    if (!selectedUser || !selectedDocument) return;

    const uid = selectedUser.uid || selectedUser.userId;
    if (!uid) {
      console.error("No valid uid found for selectedUser:", selectedUser);
      return;
    }

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "approveDocument",
          adminPassword: "20230301",
          userId: uid,
          docType: selectedDocument.type,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to approve document");
      }

      alert("Document approved successfully!");

      setSelectedUser(null);
      setSelectedDocument(null);
      setJsonContent(null);
      fetchUsers(); // Re-fetch to refresh local + Redux state
    } catch (err) {
      console.error("Error approving document:", err);
      alert(String(err));
    }
  };

  // ---------------------- Reject Document ----------------------
  const rejectDocument = async (reason: string) => {
    if (!selectedUser || !selectedDocument) return;

    const uid = selectedUser.uid || selectedUser.userId;
    if (!uid) {
      console.error("No valid uid found for selectedUser:", selectedUser);
      return;
    }

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "rejectDocument",
          adminPassword: "20230301",
          userId: uid,
          docType: selectedDocument.type,
          reason,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to reject document");
      }

      alert("Document rejected successfully!");

      setSelectedUser(null);
      setSelectedDocument(null);
      setJsonContent(null);
      fetchUsers(); // Re-fetch to refresh local + Redux state
    } catch (err) {
      console.error("Error rejecting document:", err);
      alert(String(err));
    }
  };

  // ---------------------- Save OCR JSON ----------------------
  const saveJsonChanges = async () => {
    if (!selectedUser || !selectedDocument || !jsonContent) return;

    // Validate JSON
    try {
      JSON.parse(jsonContent);
    } catch (error) {
      alert("Invalid JSON format. Please fix before saving.");
      return;
    }

    const uid = selectedUser.uid || selectedUser.userId;
    if (!uid) {
      console.error("No valid uid found for selectedUser:", selectedUser);
      return;
    }

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "saveJson",
          adminPassword: "20230301",
          userId: uid,
          docType: selectedDocument.type,
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

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
  return (
    <>
      {!isAuthenticated ? (
        <div className="bg-gray-900 min-h-screen text-gray-200 flex justify-center items-center p-4">
          <div className="bg-gray-800 rounded shadow p-6 max-w-md w-full">
            <div className="flex justify-center mb-6">
              <LogoSvg className="w-32 h-auto" />
            </div>
            <input
              type="password"
              placeholder="Enter password"
              value={passwordInput}
              onChange={(e) => {
                setPasswordInput(e.target.value);
                setPasswordError(false);
              }}
              className="w-full p-2 border border-gray-600 rounded mb-2 bg-gray-700 text-gray-200
                focus:outline-none focus:ring-2 focus:ring-[#1375F6] transition-colors"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
            />
            {passwordError && (
              <p className="text-red-400 text-sm mb-2">Incorrect password</p>
            )}
            <button
              className="w-full p-2 rounded text-white bg-[#1375F6] hover:bg-[#136BE0]
                transition-colors"
              onClick={handleLogin}
            >
              Login
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-gray-900 min-h-screen text-gray-200">
          <div className="max-w-screen-xl mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Document Verification Admin</h1>

            <div className="mb-4">
              <div className="flex gap-2 mb-4">
                <button
                  className={`p-2 rounded transition-colors ${
                    currentTab === "pending"
                      ? "bg-[#1375F6] text-white"
                      : "bg-gray-700 hover:bg-gray-600"
                  }`}
                  onClick={() => setCurrentTab("pending")}
                >
                  Pending
                </button>
                <button
                  className={`p-2 rounded transition-colors ${
                    currentTab === "approved"
                      ? "bg-[#1375F6] text-white"
                      : "bg-gray-700 hover:bg-gray-600"
                  }`}
                  onClick={() => setCurrentTab("approved")}
                >
                  Approved
                </button>
                <button
                  className={`p-2 rounded transition-colors ${
                    currentTab === "rejected"
                      ? "bg-[#1375F6] text-white"
                      : "bg-gray-700 hover:bg-gray-600"
                  }`}
                  onClick={() => setCurrentTab("rejected")}
                >
                  Rejected
                </button>
              </div>

              <button
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded mb-4
                  transition-colors"
                onClick={fetchUsers}
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <p className="text-gray-300">Loading user data...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-gray-800 border border-gray-700 text-sm">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="p-2 border border-gray-700">User</th>
                      <th className="p-2 border border-gray-700">ID Document</th>
                      <th className="p-2 border border-gray-700">Driving License</th>
                      <th className="p-2 border border-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users
                      .filter((user) => {
                        if (currentTab === "pending") {
                          // Docs not verified nor rejected
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
                        <tr
                          key={user.uid || user.userId}
                          className="hover:bg-gray-700 transition-colors"
                        >
                          <td className="p-2 border border-gray-700">
                            <p className="font-semibold">
                              {user.displayName || "No Name"}
                            </p>
                            <p className="text-xs text-gray-300">
                              {user.email ||
                                user.phoneNumber ||
                                user.uid ||
                                user.userId}
                            </p>
                          </td>
                          <td className="p-2 border border-gray-700">
                            {user.documents?.["id-document"] ? (
                              <span
                                className={`px-2 py-1 rounded-full text-xs inline-block ${
                                  user.documents["id-document"].verified
                                    ? "bg-green-600 text-green-100"
                                    : user.documents["id-document"].rejectionReason
                                    ? "bg-red-600 text-red-100"
                                    : "bg-orange-600 text-orange-100"
                                }`}
                              >
                                {user.documents["id-document"].verified
                                  ? "Verified"
                                  : user.documents["id-document"].rejectionReason
                                  ? "Rejected"
                                  : "Pending"}
                              </span>
                            ) : (
                              <span>Not Submitted</span>
                            )}
                          </td>
                          <td className="p-2 border border-gray-700">
                            {user.documents?.["driving-license"] ? (
                              <span
                                className={`px-2 py-1 rounded-full text-xs inline-block ${
                                  user.documents["driving-license"].verified
                                    ? "bg-green-600 text-green-100"
                                    : user.documents["driving-license"].rejectionReason
                                    ? "bg-red-600 text-red-100"
                                    : "bg-orange-600 text-orange-100"
                                }`}
                              >
                                {user.documents["driving-license"].verified
                                  ? "Verified"
                                  : user.documents["driving-license"].rejectionReason
                                  ? "Rejected"
                                  : "Pending"}
                              </span>
                            ) : (
                              <span>Not Submitted</span>
                            )}
                          </td>
                          <td className="p-2 border border-gray-700">
                            {user.documents?.["id-document"] && (
                              <button
                                className="p-1 bg-[#1375F6] text-white rounded mr-2
                                  hover:bg-[#136BE0] transition-colors text-xs"
                                onClick={() => viewDocument(user, "id-document")}
                              >
                                View ID
                              </button>
                            )}
                            {user.documents?.["driving-license"] && (
                              <button
                                className="p-1 bg-[#1375F6] text-white rounded
                                  hover:bg-[#136BE0] transition-colors text-xs"
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
          </div>

          {/* Modal for Document / OCR JSON */}
          {selectedDocument && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
              <div className="bg-gray-800 p-4 rounded shadow-lg max-w-4xl w-full md:w-auto max-h-[90vh] overflow-auto">
                <h2 className="text-xl font-bold mb-4">
                  {selectedDocument.type === "id-document"
                    ? "Identity Document"
                    : "Driving License"}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedDocument.data.url && (
                    <div>
                      <h3 className="font-bold mb-2">Document Image</h3>
                      <img
                        src={selectedDocument.data.url}
                        alt="Document"
                        className="max-w-full border border-gray-700 rounded"
                      />
                    </div>
                  )}

                  <div>
                    <h3 className="font-bold mb-2">User Information</h3>
                    <p>
                      <strong>UID:</strong>{" "}
                      {selectedUser?.uid || selectedUser?.userId}
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

                    {selectedDocument.data.extractedData && (
                      <div className="mt-4">
                        <h3 className="font-bold mb-2">Extracted Data</h3>
                        <div className="p-2 bg-gray-700 rounded">
                          <pre className="whitespace-pre-wrap text-xs">
                            {JSON.stringify(
                              selectedDocument.data.extractedData,
                              null,
                              2
                            )}
                          </pre>
                        </div>
                      </div>
                    )}

                    {jsonContent && (
                      <div className="mt-4">
                        <h3 className="font-bold mb-2 flex items-center justify-between">
                          <span>OCR JSON Data</span>
                          {!isEditingJson && (
                            <button
                              className="p-1 bg-[#1375F6] text-white rounded text-xs
                                hover:bg-[#136BE0] transition-colors"
                              onClick={() => setIsEditingJson(true)}
                            >
                              Edit JSON
                            </button>
                          )}
                        </h3>

                        {!isEditingJson ? (
                          <div className="p-2 bg-gray-700 rounded max-h-40 overflow-auto">
                            <pre className="text-xs">{jsonContent}</pre>
                          </div>
                        ) : (
                          <div>
                            <textarea
                              className="w-full h-40 p-2 border border-gray-600 rounded text-xs bg-gray-700
                                focus:outline-none focus:ring-2 focus:ring-[#1375F6]"
                              value={jsonContent}
                              onChange={(e) => setJsonContent(e.target.value)}
                            />
                            <div className="mt-2 flex gap-2">
                              <button
                                className="px-3 py-1 bg-green-600 text-green-100 rounded text-xs
                                  hover:bg-green-500 transition-colors"
                                onClick={saveJsonChanges}
                              >
                                Save JSON Changes
                              </button>
                              <button
                                className="px-3 py-1 bg-gray-600 text-gray-100 rounded text-xs
                                  hover:bg-gray-500 transition-colors"
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

                <div className="mt-4 flex justify-between">
                  <div className="space-x-2">
                    <button
                      className="p-2 bg-red-600 text-red-100 rounded hover:bg-red-500
                        transition-colors text-sm"
                      onClick={() => rejectDocument("unclear")}
                    >
                      Reject: Unclear
                    </button>
                    <button
                      className="p-2 bg-red-600 text-red-100 rounded hover:bg-red-500
                        transition-colors text-sm"
                      onClick={() => rejectDocument("mismatch")}
                    >
                      Reject: Mismatch
                    </button>
                    <button
                      className="p-2 bg-red-600 text-red-100 rounded hover:bg-red-500
                        transition-colors text-sm"
                      onClick={() => rejectDocument("expired")}
                    >
                      Reject: Expired
                    </button>
                  </div>
                  <div className="space-x-2">
                    <button
                      className="p-2 bg-gray-600 text-gray-100 rounded hover:bg-gray-500
                        transition-colors text-sm"
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
                      className="p-2 bg-green-600 text-green-100 rounded hover:bg-green-500
                        transition-colors text-sm"
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
      )}

      <style jsx global>{`
        @tailwind base;
        @tailwind components;
        @tailwind utilities;
      `}</style>
    </>
  );
}
