// src/store/uiSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';

// Possible view states for your UI
type ViewState = 'showCar' | 'showMap';

interface UIState {
  viewState: ViewState;
  isSheetMinimized: boolean;
}

const initialState: UIState = {
  viewState: 'showCar',      // Default view: Car screen
  isSheetMinimized: false,   // Whether the bottom sheet is minimized
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setViewState: (state, action: PayloadAction<ViewState>) => {
      state.viewState = action.payload;
    },
    toggleSheet: (state) => {
      state.isSheetMinimized = !state.isSheetMinimized;
    },
  },
});

export const { setViewState, toggleSheet } = uiSlice.actions;
export default uiSlice.reducer;

/* --------------------------- Selectors --------------------------- */
export const selectViewState = (state: RootState) => state.ui.viewState;
export const selectIsSheetMinimized = (state: RootState) => state.ui.isSheetMinimized;