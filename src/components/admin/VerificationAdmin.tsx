"use client";

import React, { useState, useEffect } from "react";
import { LogoSvg } from "../ui/logo/LogoSvg";

// Redux imports
import { useAppDispatch, useAppSelector } from "@/store/store"; 
import { setUserVerification } from "@/store/verificationSlice";  // We'll use this for instant updates

interface DocumentData {
  url: string;
  uploadedAt: number;
  verified: boolean;
  verifiedAt?: any;
  verifiedBy?: string;
  rejectionReason?: string;
  rejectionDetail?: string;
  rejectedAt?: any;
  extractedData?: any;
  ocrConfidence?: number;
  processedAt?: any;
}

interface Address {
  fullAddress: string;
  location: { lat: number; lng: number };
  block?: string;
  floor?: string;
  flat?: string;
  timestamp: number;
  verified: boolean;
  rejectionReason?: string;
}

interface UserDocuments {
  "id-document"?: DocumentData;
  "driving-license"?: DocumentData;
  address?: Address;
}

interface UserData {
  uid?: string;
  userId?: string;
  email?: string;
  phoneNumber?: string;
  displayName?: string;
  documents?: UserDocuments;
}

type DocStatus = "notUploaded" | "pending" | "approved" | "rejected";

interface VerificationAdminProps {}

export default function VerificationAdmin({}: VerificationAdminProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<"pending" | "approved" | "rejected">("pending");

  // Document selection for ID, license, or address
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<"id-document" | "driving-license" | "address" | null>(null);

  // OCR JSON
  const [jsonContent, setJsonContent] = useState<string | null>(null);
  const [isEditingJson, setIsEditingJson] = useState(false);

  // For address inspection
  const [showAddressModal, setShowAddressModal] = useState(false);

  const dispatch = useAppDispatch();
  const verificationStore = useAppSelector((state) => state.verification);

  // ---------------------- Admin Login ----------------------
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
      if (!data.success) throw new Error(data.error || "Failed to fetch users");

      const allUsers: UserData[] = data.users || [];
      const normalized = allUsers.map((u) => ({ ...u, uid: u.uid || u.userId }));

      // Filter to only those who have at least some doc
      const filtered = normalized.filter(
        (u) =>
          u.documents &&
          (
            u.documents["id-document"] ||
            u.documents["driving-license"] ||
            u.documents.address
          )
      );

      setUsers(filtered);

      // If you want to store them in Redux instantly as "snapshots" of verification
      // you can do so, but your verification slice typically expects structured data.
      // Usually you'd call a function that converts them to your VerificationData shape.
      // For brevity, we skip that. 
      // You can keep your existing logic for "setUserVerification" if you want.

    } catch (err) {
      console.error("Error fetching users:", err);
      alert("Failed to fetch users. Check console.");
    } finally {
      setLoading(false);
    }
  };

  // ---------------------- Common Reset ----------------------
  const resetSelection = () => {
    setSelectedUser(null);
    setSelectedDocType(null);
    setJsonContent(null);
    setIsEditingJson(false);
    setShowAddressModal(false);
  };

  // ---------------------- Document / Address View ----------------------
  const viewDocument = async (user: UserData, docType: "id-document" | "driving-license") => {
    resetSelection();
    try {
      const uid = user.uid || user.userId;
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
      if (!data.success) throw new Error(data.error || "Failed to view document");

      const fetchedUser = data.userData as UserData;
      fetchedUser.uid = fetchedUser.uid || fetchedUser.userId;

      setSelectedUser(fetchedUser);
      setSelectedDocType(docType);

      if (data.ocrJson) {
        setJsonContent(JSON.stringify(data.ocrJson, null, 2));
      } else {
        setJsonContent(null);
      }
      setIsEditingJson(false);
    } catch (err) {
      console.error(err);
      alert(String(err));
    }
  };

  const viewAddress = (user: UserData) => {
    resetSelection();
    setSelectedUser(user);
    setSelectedDocType("address");
    setShowAddressModal(true);
  };

  // ---------------------- Approve / Reject Document ----------------------
  const approveDocument = async () => {
    if (!selectedUser || !selectedDocType) return;
    const uid = selectedUser.uid || selectedUser.userId;

    try {
      // 1) Approve in Firestore
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "approveDocument",
          adminPassword: "20230301",
          userId: uid,
          docType: selectedDocType,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to approve document");

      // 2) Dispatch local Redux update for instant UI
      // We'll retrieve the existing user verification from the store
      const existing = verificationStore[uid] || {};
      // Make a copy
      const newData = { ...existing };

      if (selectedDocType === "id-document") {
        newData.idDocument = {
          ...newData.idDocument,
          status: "approved",
          verified: true,
          rejectionReason: undefined,
        };
      } else if (selectedDocType === "driving-license") {
        newData.drivingLicense = {
          ...newData.drivingLicense,
          status: "approved",
          verified: true,
          rejectionReason: undefined,
        };
      }

      dispatch(setUserVerification({ uid, data: newData }));

      alert("Document approved successfully!");
      resetSelection();
      // Optionally re-fetch the full user list
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert(String(err));
    }
  };

  const rejectDocument = async (reason: string) => {
    if (!selectedUser || !selectedDocType) return;
    const uid = selectedUser.uid || selectedUser.userId;

    try {
      // 1) Reject in Firestore
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "rejectDocument",
          adminPassword: "20230301",
          userId: uid,
          docType: selectedDocType,
          reason,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to reject document");

      // 2) Dispatch local Redux update
      const existing = verificationStore[uid] || {};
      const newData = { ...existing };
      if (selectedDocType === "id-document") {
        newData.idDocument = {
          ...newData.idDocument,
          status: "rejected",
          verified: false,
          rejectionReason: reason,
        };
      } else if (selectedDocType === "driving-license") {
        newData.drivingLicense = {
          ...newData.drivingLicense,
          status: "rejected",
          verified: false,
          rejectionReason: reason,
        };
      }

      dispatch(setUserVerification({ uid, data: newData }));

      alert("Document rejected successfully!");
      resetSelection();
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert(String(err));
    }
  };

  // ---------------------- Approve / Reject Address ----------------------
  const approveAddress = async () => {
    if (!selectedUser) return;
    const uid = selectedUser.uid || selectedUser.userId;

    try {
      // 1) Approve in Firestore
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "approveAddress",
          adminPassword: "20230301",
          userId: uid,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to approve address");

      // 2) Update store
      const existing = verificationStore[uid] || {};
      const newData = { ...existing };
      newData.address = {
        ...newData.address,
        status: "approved",
        verified: true,
        rejectionReason: undefined,
      };

      dispatch(setUserVerification({ uid, data: newData }));

      alert("Address approved successfully!");
      resetSelection();
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert(String(err));
    }
  };

  const rejectAddress = async (reason: string) => {
    if (!selectedUser) return;
    const uid = selectedUser.uid || selectedUser.userId;

    try {
      // 1) Reject in Firestore
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "rejectAddress",
          adminPassword: "20230301",
          userId: uid,
          reason,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to reject address");

      // 2) Update store
      const existing = verificationStore[uid] || {};
      const newData = { ...existing };
      newData.address = {
        ...newData.address,
        status: "rejected",
        verified: false,
        rejectionReason: reason,
      };

      dispatch(setUserVerification({ uid, data: newData }));

      alert("Address rejected successfully!");
      resetSelection();
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert(String(err));
    }
  };

  // ---------------------- Save OCR JSON ----------------------
  const saveJsonChanges = async () => {
    if (!selectedUser || !selectedDocType || !jsonContent) return;

    try {
      JSON.parse(jsonContent);
    } catch {
      return alert("Invalid JSON format!");
    }

    const uid = selectedUser.uid || selectedUser.userId;
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "saveJson",
          adminPassword: "20230301",
          userId: uid,
          docType: selectedDocType,
          jsonContent,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to save JSON");

      alert("JSON file updated successfully!");
      setIsEditingJson(false);
    } catch (err) {
      console.error("Error updating JSON:", err);
      alert(String(err));
    }
  };

  // ---------------------- Filter By Tab ----------------------
  const userMatchesTab = (user: UserData) => {
    const docs = user.documents;
    if (!docs) return false;

    const { "id-document": idDoc, "driving-license": lic, address } = docs;

    const somethingApproved = [idDoc, lic, address].some((item) => item?.verified);
    const somethingRejected = [idDoc, lic, address].some((item) => item?.rejectionReason);
    const somethingPending = [idDoc, lic, address].some(
      (item) => item && !item.verified && !item.rejectionReason
    );

    switch (currentTab) {
      case "approved":
        return somethingApproved;
      case "rejected":
        return somethingRejected;
      case "pending":
      default:
        return somethingPending;
    }
  };

  // ---------------------- Helpers ----------------------
  const getStatusBadge = (verified?: boolean, rejectionReason?: string) => {
    if (verified) {
      return (
        <span className="px-2 py-1 rounded-full text-xs bg-green-600 text-green-100">
          Verified
        </span>
      );
    }
    if (rejectionReason) {
      return (
        <span className="px-2 py-1 rounded-full text-xs bg-red-600 text-red-100">
          Rejected
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded-full text-xs bg-orange-600 text-orange-100">
        Pending
      </span>
    );
  };

  // ---------------------- Render ----------------------
  return (
    <>
      {!isAuthenticated ? (
        // Password prompt
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
                focus:outline-none focus:ring-2 focus:ring-[#1375F6]"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
            />
            {passwordError && (
              <p className="text-red-400 text-sm mb-2">Incorrect password</p>
            )}
            <button
              className="w-full p-2 rounded text-white bg-[#1375F6] hover:bg-[#136BE0]"
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
                  className={`p-2 rounded ${
                    currentTab === "pending"
                      ? "bg-[#1375F6] text-white"
                      : "bg-gray-700 hover:bg-gray-600"
                  }`}
                  onClick={() => setCurrentTab("pending")}
                >
                  Pending
                </button>
                <button
                  className={`p-2 rounded ${
                    currentTab === "approved"
                      ? "bg-[#1375F6] text-white"
                      : "bg-gray-700 hover:bg-gray-600"
                  }`}
                  onClick={() => setCurrentTab("approved")}
                >
                  Approved
                </button>
                <button
                  className={`p-2 rounded ${
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
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded mb-4"
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
                      <th className="p-2 border border-gray-700">Address</th>
                      <th className="p-2 border border-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users
                      .filter(userMatchesTab)
                      .map((user) => (
                        <tr
                          key={user.uid || user.userId}
                          className="hover:bg-gray-700"
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

                          {/* ID Document */}
                          <td className="p-2 border border-gray-700">
                            {user.documents?.["id-document"]
                              ? getStatusBadge(
                                  user.documents["id-document"].verified,
                                  user.documents["id-document"].rejectionReason
                                )
                              : "Not Submitted"}
                          </td>

                          {/* Driving License */}
                          <td className="p-2 border border-gray-700">
                            {user.documents?.["driving-license"]
                              ? getStatusBadge(
                                  user.documents["driving-license"].verified,
                                  user.documents["driving-license"].rejectionReason
                                )
                              : "Not Submitted"}
                          </td>

                          {/* Address */}
                          <td className="p-2 border border-gray-700">
                            {user.documents?.address
                              ? getStatusBadge(
                                  user.documents.address.verified,
                                  user.documents.address.rejectionReason
                                )
                              : "Not Submitted"}
                          </td>

                          {/* Actions */}
                          <td className="p-2 border border-gray-700">
                            {user.documents?.["id-document"] && (
                              <button
                                className="p-1 bg-[#1375F6] text-white rounded mr-2 text-xs"
                                onClick={() =>
                                  viewDocument(user, "id-document")
                                }
                              >
                                View ID
                              </button>
                            )}
                            {user.documents?.["driving-license"] && (
                              <button
                                className="p-1 bg-[#1375F6] text-white rounded mr-2 text-xs"
                                onClick={() =>
                                  viewDocument(user, "driving-license")
                                }
                              >
                                View License
                              </button>
                            )}
                            {user.documents?.address && (
                              <button
                                className="p-1 bg-[#1375F6] text-white rounded text-xs"
                                onClick={() => viewAddress(user)}
                              >
                                View Address
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

          {/* ------------- DOCUMENT MODAL (ID or License) ------------- */}
          {selectedUser && selectedDocType && selectedDocType !== "address" && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
              <div className="bg-gray-800 p-4 rounded shadow-lg max-w-4xl w-full md:w-auto max-h-[90vh] overflow-auto">
                <h2 className="text-xl font-bold mb-4">
                  {selectedDocType === "id-document"
                    ? "Identity Document"
                    : "Driving License"}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Document Image */}
                  {selectedUser.documents?.[selectedDocType]?.url && (
                    <div>
                      <h3 className="font-bold mb-2">Document Image</h3>
                      <img
                        src={selectedUser.documents[selectedDocType]?.url}
                        alt="Document"
                        className="max-w-full border border-gray-700 rounded"
                      />
                    </div>
                  )}

                  {/* Right side user info & OCR JSON */}
                  <div>
                    <h3 className="font-bold mb-2">User Info</h3>
                    <p>
                      <strong>UID:</strong>{" "}
                      {selectedUser.uid || selectedUser.userId}
                    </p>
                    {selectedUser.email && (
                      <p>
                        <strong>Email:</strong> {selectedUser.email}
                      </p>
                    )}
                    {selectedUser.phoneNumber && (
                      <p>
                        <strong>Phone:</strong> {selectedUser.phoneNumber}
                      </p>
                    )}

                    {/* OCR JSON */}
                    {jsonContent && (
                      <div className="mt-4">
                        <h3 className="font-bold mb-2 flex items-center justify-between">
                          <span>OCR JSON Data</span>
                          {!isEditingJson && (
                            <button
                              className="p-1 bg-[#1375F6] text-white rounded text-xs"
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
                                className="px-3 py-1 bg-green-600 text-green-100 rounded text-xs hover:bg-green-500"
                                onClick={saveJsonChanges}
                              >
                                Save JSON
                              </button>
                              <button
                                className="px-3 py-1 bg-gray-600 text-gray-100 rounded text-xs hover:bg-gray-500"
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

                {/* Approve / Reject */}
                <div className="mt-4 flex justify-between">
                  <div className="space-x-2">
                    <button
                      className="p-2 bg-red-600 text-red-100 rounded hover:bg-red-500 text-sm"
                      onClick={() => rejectDocument("unclear")}
                    >
                      Reject: Unclear
                    </button>
                    <button
                      className="p-2 bg-red-600 text-red-100 rounded hover:bg-red-500 text-sm"
                      onClick={() => rejectDocument("mismatch")}
                    >
                      Reject: Mismatch
                    </button>
                    <button
                      className="p-2 bg-red-600 text-red-100 rounded hover:bg-red-500 text-sm"
                      onClick={() => rejectDocument("expired")}
                    >
                      Reject: Expired
                    </button>
                  </div>

                  <div className="space-x-2">
                    <button
                      className="p-2 bg-gray-600 text-gray-100 rounded hover:bg-gray-500 text-sm"
                      onClick={resetSelection}
                    >
                      Close
                    </button>
                    <button
                      className="p-2 bg-green-600 text-green-100 rounded hover:bg-green-500 text-sm"
                      onClick={approveDocument}
                    >
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ----------------- ADDRESS MODAL ----------------- */}
          {showAddressModal && selectedUser && selectedDocType === "address" && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
              <div className="bg-gray-800 p-4 rounded shadow-lg max-w-lg w-full max-h-[90vh] overflow-auto">
                <h2 className="text-xl font-bold mb-4">Residential Address</h2>

                {selectedUser.documents?.address && (
                  <div className="space-y-2 text-sm">
                    <p>
                      <strong>Full Address:</strong>{" "}
                      {selectedUser.documents.address.fullAddress}
                    </p>
                    {selectedUser.documents.address.block && (
                      <p>
                        <strong>Block:</strong>{" "}
                        {selectedUser.documents.address.block}
                      </p>
                    )}
                    <p>
                      <strong>Floor:</strong>{" "}
                      {selectedUser.documents.address.floor}
                    </p>
                    <p>
                      <strong>Flat/Unit:</strong>{" "}
                      {selectedUser.documents.address.flat}
                    </p>
                    <p>
                      <strong>Timestamp:</strong>{" "}
                      {new Date(
                        selectedUser.documents.address.timestamp
                      ).toLocaleString()}
                    </p>
                    <p>
                      <strong>Lat/Lng:</strong>{" "}
                      {selectedUser.documents.address.location.lat},{" "}
                      {selectedUser.documents.address.location.lng}
                    </p>
                    {selectedUser.documents.address.rejectionReason && (
                      <p className="text-red-400">
                        <strong>Rejected Reason:</strong>{" "}
                        {selectedUser.documents.address.rejectionReason}
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-6 flex justify-between">
                  <div className="space-x-2">
                    <button
                      className="p-2 bg-red-600 text-red-100 rounded hover:bg-red-500 text-sm"
                      onClick={() => rejectAddress("invalid-proof")}
                    >
                      Reject: Invalid
                    </button>
                    <button
                      className="p-2 bg-red-600 text-red-100 rounded hover:bg-red-500 text-sm"
                      onClick={() => rejectAddress("incomplete")}
                    >
                      Reject: Incomplete
                    </button>
                  </div>
                  <div className="space-x-2">
                    <button
                      className="p-2 bg-gray-600 text-gray-100 rounded hover:bg-gray-500 text-sm"
                      onClick={resetSelection}
                    >
                      Close
                    </button>
                    <button
                      className="p-2 bg-green-600 text-green-100 rounded hover:bg-green-500 text-sm"
                      onClick={approveAddress}
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
