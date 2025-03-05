// src/store/verificationSlice.ts

import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import { doc, getDoc, getFirestore } from "firebase/firestore";

// 1) Define your document states
export type DocumentStatus = {
  url?: string;
  status: "notUploaded" | "pending" | "approved" | "rejected";
  rejectionReason?: string;
  uploadedAt?: number;
};

// 2) Optional address type
export interface AddressData {
  fullAddress?: string;
  verified?: boolean;
  // Add more fields like lat/lng, block, floor, etc., if needed
}

// 3) One user’s verification data
export interface VerificationData {
  idDocument?: DocumentStatus;
  drivingLicense?: DocumentStatus;
  address?: AddressData;
}

// 4) The entire slice shape (keyed by user id)
export interface VerificationState {
  [uid: string]: VerificationData;
}

// 5) Initial state
const initialState: VerificationState = {};

// 6) Async thunk to fetch one user’s verification docs
export const fetchVerificationData = createAsyncThunk<
  // Return type of payload
  { uid: string; data: VerificationData },
  // Argument to this thunk
  string
>("verification/fetchVerificationData", async (uid, { rejectWithValue }) => {
  try {
    const db = getFirestore();
    const userDocRef = doc(db, "users", uid);
    const snapshot = await getDoc(userDocRef);

    if (!snapshot.exists()) {
      return { uid, data: {} };
    }
    const userData = snapshot.data();
    const documents = userData?.documents || {};

    // Convert Firestore's structure to your VerificationData shape
    const data: VerificationData = {
      idDocument: documents["id-document"]
        ? {
            ...documents["id-document"],
            status: documents["id-document"].verified
              ? "approved"
              : documents["id-document"].rejectionReason
              ? "rejected"
              : "pending",
          }
        : { status: "notUploaded" },
      drivingLicense: documents["driving-license"]
        ? {
            ...documents["driving-license"],
            status: documents["driving-license"].verified
              ? "approved"
              : documents["driving-license"].rejectionReason
              ? "rejected"
              : "pending",
          }
        : { status: "notUploaded" },
      address: documents.address
        ? {
            ...documents.address,
          }
        : undefined,
    };

    return { uid, data };
  } catch (error) {
    console.error("Error fetching user verification data:", error);
    return rejectWithValue(String(error));
  }
});

// 7) The slice
const verificationSlice = createSlice({
  name: "verification",
  initialState,
  reducers: {
    setUserVerification: (
      state,
      action: PayloadAction<{ uid: string; data: VerificationData }>
    ) => {
      const { uid, data } = action.payload;
      state[uid] = data;
    },
    // Example of a targeted update for ID document
    setIdDocument: (
      state,
      action: PayloadAction<{ uid: string; idDocument: DocumentStatus }>
    ) => {
      const { uid, idDocument } = action.payload;
      if (!state[uid]) {
        state[uid] = {};
      }
      state[uid].idDocument = idDocument;
    },
    // Similarly, you can add setDrivingLicense, setAddress, etc.
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchVerificationData.fulfilled, (state, action) => {
        const { uid, data } = action.payload;
        state[uid] = data;
      })
      .addCase(fetchVerificationData.rejected, (state, action) => {
        console.error("Failed to fetch verification data:", action.payload);
      });
  },
});

// Export the actions
export const { setUserVerification, setIdDocument } = verificationSlice.actions;

// Export the reducer
export default verificationSlice.reducer;
