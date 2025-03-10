import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "./store";

/* -----------------------------------------------------------
   Possible top-level view states for your UI
----------------------------------------------------------- */
type ViewState = "showMap" | "none";  // Removed "showCar" as it's now directly in StationDetail

/* -----------------------------------------------------------
   Possible layout modes for CarGrid (optional example)
----------------------------------------------------------- */
type CarGridLayout = "list" | "grid";

interface UIState {
  viewState: ViewState;
  carGridLayout: CarGridLayout;
}

const initialState: UIState = {
  viewState: "none", // Default: no sheet shown (since CarGrid is now part of StationDetail)
  carGridLayout: "grid",
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setViewState: (state, action: PayloadAction<ViewState>) => {
      state.viewState = action.payload;
    },
    setCarGridLayout: (state, action: PayloadAction<CarGridLayout>) => {
      state.carGridLayout = action.payload;
    },
    closeCurrentSheet: (state) => {
      // Close the currently open sheet (set to 'none')
      state.viewState = "none";
    },
  },
});

export const { setViewState, setCarGridLayout, closeCurrentSheet } = uiSlice.actions;
export default uiSlice.reducer;

/* --------------------------- Selectors --------------------------- */
export const selectViewState = (state: RootState) => state.ui.viewState;
export const selectCarGridLayout = (state: RootState) => state.ui.carGridLayout;
