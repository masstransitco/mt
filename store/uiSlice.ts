import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';
import type { SheetMode } from '@/types/map';

// Define the UI state interface
interface UiState {
  sheet: {
    mode: SheetMode;
    minimized: boolean;
  };
  modals: {
    qrScannerOpen: boolean;
    signInModalOpen: boolean;
  };
  // Animation state removed - now using animationStateManager
}

// Define the initial state
const initialState: UiState = {
  sheet: {
    mode: 'guide',
    minimized: false,
  },
  modals: {
    qrScannerOpen: false,
    signInModalOpen: false,
  },
};

// Create the slice
export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // Sheet actions
    setSheetMode: (state, action: PayloadAction<SheetMode>) => {
      state.sheet.mode = action.payload;
    },
    setSheetMinimized: (state, action: PayloadAction<boolean>) => {
      state.sheet.minimized = action.payload;
    },
    
    // Modal actions
    setQrScannerOpen: (state, action: PayloadAction<boolean>) => {
      state.modals.qrScannerOpen = action.payload;
    },
    setSignInModalOpen: (state, action: PayloadAction<boolean>) => {
      state.modals.signInModalOpen = action.payload;
    },
  },
});

// Export actions
export const {
  setSheetMode,
  setSheetMinimized,
  setQrScannerOpen,
  setSignInModalOpen,
} = uiSlice.actions;

// Export selectors
export const selectSheetMode = (state: RootState) => state.ui.sheet.mode;
export const selectSheetMinimized = (state: RootState) => state.ui.sheet.minimized;
export const selectQrScannerOpen = (state: RootState) => state.ui.modals.qrScannerOpen;
export const selectSignInModalOpen = (state: RootState) => state.ui.modals.signInModalOpen;

// Export the reducer
export default uiSlice.reducer;