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
  // Selected station IDs for different contexts
  selectedIds: {
    listSelected: number | null;
  };
  // Animation state
  animation: {
    isAnimating: boolean;
    targetId: number | null;
    type: string | null;
  };
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
  selectedIds: {
    listSelected: null,
  },
  animation: {
    isAnimating: false,
    targetId: null,
    type: null,
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
    
    // Selection actions
    setListSelectedStation: (state, action: PayloadAction<number | null>) => {
      state.selectedIds.listSelected = action.payload;
    },
    
    // Animation actions
    setAnimationState: (state, action: PayloadAction<{
      isAnimating: boolean;
      targetId?: number | null;
      type?: string | null;
    }>) => {
      state.animation.isAnimating = action.payload.isAnimating;
      
      if (action.payload.targetId !== undefined) {
        state.animation.targetId = action.payload.targetId;
      }
      
      if (action.payload.type !== undefined) {
        state.animation.type = action.payload.type;
      }
    },
  },
});

// Export actions
export const {
  setSheetMode,
  setSheetMinimized,
  setQrScannerOpen,
  setSignInModalOpen,
  setListSelectedStation,
  setAnimationState,
} = uiSlice.actions;

// Export selectors
export const selectSheetMode = (state: RootState) => state.ui.sheet.mode;
export const selectSheetMinimized = (state: RootState) => state.ui.sheet.minimized;
export const selectQrScannerOpen = (state: RootState) => state.ui.modals.qrScannerOpen;
export const selectSignInModalOpen = (state: RootState) => state.ui.modals.signInModalOpen;
export const selectListSelectedStation = (state: RootState) => state.ui.selectedIds.listSelected;
export const selectIsAnimating = (state: RootState) => state.ui.animation.isAnimating;
export const selectAnimationTargetId = (state: RootState) => state.ui.animation.targetId;
export const selectAnimationType = (state: RootState) => state.ui.animation.type;

// Export the reducer
export default uiSlice.reducer;