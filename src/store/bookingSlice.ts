// src/store/bookingSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';

/**
 * The bookingSlice orchestrates a multi-step flow:
 * 1) User picks car & station
 * 2) ID verification
 * 3) Payment
 * 4) Finalizing
 * ... etc.
 * 
 * We store which step the user is on, plus relevant data
 * like departure dates or scanning a QR code if needed.
 */
interface BookingState {
  step: number;
  stepName: string;
  departureDate: Date | null;
  // Could store additional fields, e.g. arrivalStationId, paymentMethod, etc.
}

const initialState: BookingState = {
  step: 1,
  stepName: 'select_car_and_station',
  departureDate: null,
};

const bookingSlice = createSlice({
  name: 'booking',
  initialState,
  reducers: {
    setDepartureDate: (state, action: PayloadAction<Date>) => {
      state.departureDate = action.payload;
    },
    // Advance to a specified step in the flow
    advanceBookingStep: (state, action: PayloadAction<number>) => {
      state.step = action.payload;
      switch (action.payload) {
        case 1:
          state.stepName = 'select_car_and_station';
          break;
        case 2:
          state.stepName = 'verify_id';
          break;
        case 3:
          state.stepName = 'payment';
          break;
        case 4:
          state.stepName = 'finalizing';
          break;
        default:
          state.stepName = 'select_car_and_station';
          break;
      }
    },
    resetBookingFlow: (state) => {
      state.step = 1;
      state.stepName = 'select_car_and_station';
      state.departureDate = null;
    },
  },
});

export const {
  setDepartureDate,
  advanceBookingStep,
  resetBookingFlow,
} = bookingSlice.actions;

export default bookingSlice.reducer;

/* --------------------------- Selectors --------------------------- */
export const selectBookingStep = (state: RootState) => state.booking.step;
export const selectBookingStepName = (state: RootState) => state.booking.stepName;
export const selectDepartureDate = (state: RootState) => state.booking.departureDate;
