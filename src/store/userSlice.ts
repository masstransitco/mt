import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UserState {
  selectedCarId: number | null;
  selectedStationId: number | null;
  viewState: 'showCar' | 'showMap';  // Added view state
}

const initialState: UserState = {
  selectedCarId: null,
  selectedStationId: null,
  viewState: 'showCar'  // Default to car view
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    selectCar: (state, action: PayloadAction<number>) => {
      state.selectedCarId = action.payload;
    },
    selectStation: (state, action: PayloadAction<number>) => {
      state.selectedStationId = action.payload;
    },
    setViewState: (state, action: PayloadAction<'showCar' | 'showMap'>) => {
      state.viewState = action.payload;
    },
    resetBooking: (state) => {
      state.selectedCarId = null;
      state.selectedStationId = null;
      // Note: doesn't reset viewState as that's independent
    }
  }
});

export const { selectCar, selectStation, setViewState, resetBooking } = userSlice.actions;
export default userSlice.reducer;

// Selectors
export const selectSelectedCarId = (state: { user: UserState }) => state.user.selectedCarId;
export const selectSelectedStationId = (state: { user: UserState }) => state.user.selectedStationId;
export const selectViewState = (state: { user: UserState }) => state.user.viewState;
