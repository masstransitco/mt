// src/store/uiSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';

// Possible top-level view states for your UI
type ViewState = 'showCar' | 'showMap';

// Possible layout modes for CarGrid (optional example)
type CarGridLayout = 'list' | 'grid';

interface UIState {
  viewState: ViewState;
  isSheetMinimized: boolean;
  carGridLayout: CarGridLayout;
}

const initialState: UIState = {
  viewState: 'showCar',       // Default view: Car screen
  isSheetMinimized: true,     // Bottom sheet is minimized by default
  carGridLayout: 'grid',
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
    setCarGridLayout: (state, action: PayloadAction<CarGridLayout>) => {
      state.carGridLayout = action.payload;
    },
  },
});

export const { setViewState, toggleSheet, setCarGridLayout } = uiSlice.actions;
export default uiSlice.reducer;

/* --------------------------- Selectors --------------------------- */
export const selectViewState = (state: RootState) => state.ui.viewState;
export const selectIsSheetMinimized = (state: RootState) => state.ui.isSheetMinimized;
export const selectCarGridLayout = (state: RootState) => state.ui.carGridLayout;
