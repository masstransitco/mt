// File: src/store/verificationSlice.ts

import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import { doc, getDoc, getFirestore } from "firebase/firestore";

//
// 1) DocumentStatus for ID/License
//
export type DocumentStatus = {
  status: "notUploaded" | "pending" | "approved" | "rejected";
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
};

//
// 2) AddressData for Residential Address
//
export interface AddressData {
  status: "notUploaded" | "pending" | "approved" | "rejected";
  fullAddress?: string;
  block?: string;
  floor?: string;
  flat?: string;
  verified?: boolean;
  rejectionReason?: string;
  timestamp?: number;
  location?: {
    lat: number;
    lng: number;
  };
}

//
// 3) Combined VerificationData for each user
//
export interface VerificationData {
  idDocument?: DocumentStatus;
  drivingLicense?: DocumentStatus;
  address?: AddressData;
}

//
// 4) Slice shape: indexed by user ID
//
export interface VerificationState {
  [uid: string]: VerificationData;
}

//
// 5) Initial state
//
const initialState: VerificationState = {};

//
// 6) Async thunk to fetch a single user’s doc info from Firestore
//
export const fetchVerificationData = createAsyncThunk<
  // Payload type
  { uid: string; data: VerificationData },
  // Argument: the UID
  string
>("verification/fetchVerificationData", async (uid, { rejectWithValue }) => {
  try {
    const db = getFirestore();
    const userDocRef = doc(db, "users", uid);
    const snapshot = await getDoc(userDocRef);

    if (!snapshot.exists()) {
      // No user doc
      return { uid, data: {} };
    }
    const userData = snapshot.data();
    const documents = userData?.documents || {};

    // Helper that figures out "approved"/"rejected"/"pending"
    function toDocStatus(doc: any): DocumentStatus {
      if (!doc) return { status: "notUploaded" };

      let derivedStatus: "approved" | "rejected" | "pending" = "pending";
      if (doc.verified) derivedStatus = "approved";
      if (doc.rejectionReason) derivedStatus = "rejected";

      return {
        ...doc,
        status: derivedStatus,
      };
    }

    function toAddressData(addr: any): AddressData {
      if (!addr) return { status: "notUploaded" };

      let derivedStatus: "approved" | "rejected" | "pending" = "pending";
      if (addr.verified) derivedStatus = "approved";
      if (addr.rejectionReason) derivedStatus = "rejected";

      return {
        ...addr,
        status: derivedStatus,
      };
    }

    const data: VerificationData = {
      idDocument: toDocStatus(documents["id-document"]),
      drivingLicense: toDocStatus(documents["driving-license"]),
      address: toAddressData(documents.address),
    };

    return { uid, data };
  } catch (error) {
    console.error("Error fetching user verification data:", error);
    return rejectWithValue(String(error));
  }
});

//
// 7) Create slice
//
const verificationSlice = createSlice({
  name: "verification",
  initialState,
  reducers: {
    // Example direct setter for any user’s verification data
    setUserVerification: (
      state,
      action: PayloadAction<{ uid: string; data: VerificationData }>
    ) => {
      const { uid, data } = action.payload;
      state[uid] = data;
    },

    // Example for updating just the ID doc
    setIdDocument: (
      state,
      action: PayloadAction<{ uid: string; idDocument: DocumentStatus }>
    ) => {
      const { uid, idDocument } = action.payload;
      if (!state[uid]) state[uid] = {};
      state[uid].idDocument = idDocument;
    },

    // Example for updating the address
    setAddressData: (
      state,
      action: PayloadAction<{ uid: string; address: AddressData }>
    ) => {
      const { uid, address } = action.payload;
      if (!state[uid]) state[uid] = {};
      state[uid].address = address;
    },
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

// 8) Export actions & reducer
export const { setUserVerification, setIdDocument, setAddressData } = verificationSlice.actions;
export default verificationSlice.reducer;
