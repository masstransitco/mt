// src/store/bookingSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';

export interface BookingState {
  /** The numerical step we’re on, e.g. 1 = select_departure_station, 2 = select_arrival_station, etc. */
  step: number;
  /** A string name for the current step (useful for debugging or UI conditions). */
  stepName: string;
  /** An optional date field if you want the user to pick a departure date/time. */
  departureDate: Date | null;
  // Could store additional fields, e.g. arrivalDate, paymentMethod, etc.
}

const initialState: BookingState = {
  step: 1,
  stepName: 'select_departure_station',
  departureDate: null,
};

export const bookingSlice = createSlice({
  name: 'booking',
  initialState,
  reducers: {
    /**
     * Example of storing a user-chosen departure date/time.
     * If not needed, remove this action + field.
     */
    setDepartureDate: (state, action: PayloadAction<Date>) => {
      state.departureDate = action.payload;
    },

    /**
     * Moves to a specified step in the flow, setting the matching stepName.
     */
    advanceBookingStep: (state, action: PayloadAction<number>) => {
      state.step = action.payload;
      switch (action.payload) {
        case 1:
          state.stepName = 'select_departure_station';
          break;
        case 2:
          state.stepName = 'select_arrival_station';
          break;
        case 3:
          state.stepName = 'payment';
          break;
        case 4:
          state.stepName = 'finalizing';
          break;
        default:
          // Fallback if an invalid step is passed
          state.step = 1;
          state.stepName = 'select_departure_station';
          break;
      }
    },

    /**
     * Resets the entire booking flow to the initial state.
     */
    resetBookingFlow: (state) => {
      state.step = 1;
      state.stepName = 'select_departure_station';
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
