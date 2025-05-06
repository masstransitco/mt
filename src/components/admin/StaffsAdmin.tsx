"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

interface Staff {
  id: string;
  name?: string;
  email: string;
  phone?: string;
  role: string;
}

interface NonAdminUser {
  id: string;
  email: string;
  displayName?: string;
  phoneNumber?: string;
}

export default function StaffsAdmin() {
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [nonAdminUsers, setNonAdminUsers] = useState<NonAdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [addMode, setAddMode] = useState<"new" | "existing">("new");
  
  // Form states
  const [selectedUserId, setSelectedUserId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [currentStaff, setCurrentStaff] = useState<Staff | null>(null);

  // Fetch staff users
  const fetchStaffs = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/staffs");
      if (!res.ok) {
        throw new Error("Failed to fetch staff users");
      }
      const data = await res.json();
      setStaffs(data.staffs || []);
    } catch (error) {
      console.error("Error fetching staff users:", error);
      toast.error("Failed to load staff users");
    } finally {
      setLoading(false);
    }
  };

  // Fetch non-admin users for promotion
  const fetchNonAdminUsers = async () => {
    try {
      const res = await fetch("/api/admin/staffs?nonAdmin=true");
      if (!res.ok) {
        throw new Error("Failed to fetch non-admin users");
      }
      const data = await res.json();
      
      // Update to handle the new response format
      if (data.success && Array.isArray(data.users)) {
        setNonAdminUsers(data.users || []);
        console.log("Fetched non-admin users:", data.users);
      } else {
        setNonAdminUsers([]);
        console.error("Unexpected response format:", data);
      }
    } catch (error) {
      console.error("Error fetching non-admin users:", error);
      toast.error("Failed to load non-admin users");
      setNonAdminUsers([]);
    }
  };

  useEffect(() => {
    fetchStaffs();
    fetchNonAdminUsers();
  }, []);

  // Reset form fields
  const resetForm = () => {
    setSelectedUserId("");
    setName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setCurrentStaff(null);
  };

  // Open add modal
  const handleAddStaff = () => {
    resetForm();
    setAddMode("new");
    setShowAddModal(true);
  };

  // Open edit modal
  const handleEditStaff = (staff: Staff) => {
    setCurrentStaff(staff);
    setName(staff.name || "");
    setEmail(staff.email || "");
    setPhone(staff.phone || "");
    setPassword(""); // Don't pre-fill password
    setShowEditModal(true);
  };

  // Submit new staff
  const handleSubmitNewStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      const payload = addMode === "new" 
        ? { name, email, phone, password }
        : { existingUserId: selectedUserId };
      
      const res = await fetch("/api/admin/staffs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create staff");
      }
      
      toast.success(addMode === "new" ? "Staff created successfully" : "User promoted to staff");
      setShowAddModal(false);
      resetForm();
      fetchStaffs();
    } catch (error: any) {
      console.error("Error creating staff:", error);
      toast.error(error.message || "Failed to create staff");
    } finally {
      setLoading(false);
    }
  };

  // Submit edit staff
  const handleSubmitEditStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentStaff) return;
    
    try {
      setLoading(true);
      
      const payload = {
        userId: currentStaff.id,
        name,
        email,
        phone,
        ...(password ? { password } : {})
      };
      
      const res = await fetch("/api/admin/staffs", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update staff");
      }
      
      toast.success("Staff updated successfully");
      setShowEditModal(false);
      resetForm();
      fetchStaffs();
    } catch (error: any) {
      console.error("Error updating staff:", error);
      toast.error(error.message || "Failed to update staff");
    } finally {
      setLoading(false);
    }
  };

  // Handle staff deletion
  const handleDeleteStaff = async (staffId: string) => {
    if (!confirm("Are you sure you want to remove this staff member?")) {
      return;
    }
    
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/staffs?userId=${staffId}`, {
        method: "DELETE",
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to delete staff");
      }
      
      toast.success("Staff removed successfully");
      fetchStaffs();
    } catch (error: any) {
      console.error("Error deleting staff:", error);
      toast.error(error.message || "Failed to delete staff");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Manage Staff Users</h2>
        <button
          className="bg-blue-500 text-white px-4 py-2 rounded-md"
          onClick={handleAddStaff}
        >
          Add Staff
        </button>
      </div>

      {loading && <div className="text-center py-4">Loading...</div>}

      {!loading && staffs.length === 0 && (
        <div className="text-center py-4 text-gray-500">
          No staff users found. Add your first staff member.
        </div>
      )}

      {!loading && staffs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-700">
            <thead>
              <tr className="">
                <th className="py-2 px-4 border-b border-gray-700 text-left">Name</th>
                <th className="py-2 px-4 border-b border-gray-700 text-left">Email</th>
                <th className="py-2 px-4 border-b border-gray-700 text-left">Phone</th>
                <th className="py-2 px-4 border-b border-gray-700 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staffs.map((staff) => (
                <tr key={staff.id} className="">
                  <td className="py-2 px-4 border-b border-gray-700">{staff.name || "N/A"}</td>
                  <td className="py-2 px-4 border-b border-gray-700">{staff.email}</td>
                  <td className="py-2 px-4 border-b border-gray-700">{staff.phone || "N/A"}</td>
                  <td className="py-2 px-4 border-b border-gray-700">
                    <button
                      className="text-blue-500 mr-2"
                      onClick={() => handleEditStaff(staff)}
                    >
                      Edit
                    </button>
                    <button
                      className="text-red-500"
                      onClick={() => handleDeleteStaff(staff.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 border-gray-700">
          <div className="p-6 rounded-lg w-full max-w-md border border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Add New Staff</h3>
            
            <div className="mb-4">
              <div className="flex space-x-4 mb-4">
                <button
                  className={`flex-1 py-2 px-4 rounded-md ${
                    addMode === "new" ? "bg-blue-500 text-white" : "border border-gray-700"
                  }`}
                  onClick={() => setAddMode("new")}
                >
                  Create New User
                </button>
                <button
                  className={`flex-1 py-2 px-4 rounded-md ${
                    addMode === "existing" ? "bg-blue-500 text-white" : "border border-gray-700"
                  }`}
                  onClick={() => setAddMode("existing")}
                >
                  Promote Existing
                </button>
              </div>
            </div>
            
            <form onSubmit={handleSubmitNewStaff}>
              {addMode === "existing" ? (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Select User</label>
                    <select
                      className="w-full p-2 border rounded-md bg-gray-700 border border-gray-700"
                      value={selectedUserId}
                      onChange={(e) => {
                        setSelectedUserId(e.target.value);
                        // Find the selected user to pre-fill available information
                        const selectedUser = nonAdminUsers.find(user => user.id === e.target.value);
                        if (selectedUser) {
                          setName(selectedUser.displayName || "");
                          setEmail(selectedUser.email || "");
                          setPhone(selectedUser.phoneNumber || "");
                        }
                      }}
                      required
                    >
                      <option value="">Select a user</option>
                      {nonAdminUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.email || user.phoneNumber || user.uid}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Allow editing/completing user information */}
                  {selectedUserId && (
                    <>
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-1">Name</label>
                        <input
                          type="text"
                          className="w-full p-2 bg-gray-700 border rounded-md border-gray-700"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-1">Email</label>
                        <input
                          type="email"
                          className="w-full p-2 bg-gray-700 border rounded-md border-gray-700"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={!!nonAdminUsers.find(user => user.id === selectedUserId)?.email} // Only disable if pre-filled from user selection
                        />
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-1">Phone</label>
                        <input
                          type="tel"
                          className="w-full p-2 bg-gray-700 border rounded-md border-gray-700"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                        />
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <input
                      type="text"
                      className="w-full p-2 bg-gray-700 border rounded-md border-gray-700"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input
                      type="email"
                      className="w-full p-2 bg-gray-700 border rounded-md border-gray-700"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Phone</label>
                    <input
                      type="tel"
                      className="w-full p-2 bg-gray-700 border rounded-md border-gray-700"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Password</label>
                    <input
                      type="password"
                      className="w-full p-2 bg-gray-700 border rounded-md border-gray-700"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}
              
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  className="px-4 py-2 border rounded-md border-gray-700"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md border-gray-700"
                  disabled={loading}
                >
                  {loading ? "Adding..." : "Add Staff"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {showEditModal && currentStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 border-gray-700">
          <div className="p-6 rounded-lg w-full max-w-md border border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Edit Staff</h3>
            
            <form onSubmit={handleSubmitEditStaff}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  className="w-full p-2 bg-gray-700 border rounded-md border-gray-700"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  className="w-full p-2 bg-gray-700 border rounded-md border-gray-700"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  type="tel"
                  className="w-full p-2 bg-gray-700 border rounded-md border-gray-700"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Password (leave blank to keep unchanged)
                </label>
                <input
                  type="password"
                  className="w-full p-2 bg-gray-700 border rounded-md border-gray-700"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  className="px-4 py-2 border rounded-md border-gray-700"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md border-gray-700"
                  disabled={loading}
                >
                  {loading ? "Updating..." : "Update Staff"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

