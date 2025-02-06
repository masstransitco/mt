// src/store/bookingSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';

export interface BookingState {
  /** The numerical step we’re on.
   *  1 = selecting_departure_station
   *  2 = selected_departure_station
   *  3 = selecting_arrival_station
   *  4 = selected_arrival_station
   *  5 = payment
   *  6 = finalizing
   */
  step: number;
  /** A string name for the current step (useful for debugging or UI conditions). */
  stepName: string;
  /** An optional date field if you want the user to pick a departure date/time. */
  departureDate: Date | null;
}

const initialState: BookingState = {
  step: 1,
  stepName: 'selecting_departure_station',
  departureDate: null,
};

export const bookingSlice = createSlice({
  name: 'booking',
  initialState,
  reducers: {
    /**
     * Stores a user-chosen departure date/time.
     */
    setDepartureDate: (state, action: PayloadAction<Date>) => {
      state.departureDate = action.payload;
    },

    /**
     * Advances the booking flow to a specified step and sets the corresponding stepName.
     */
    advanceBookingStep: (state, action: PayloadAction<number>) => {
      state.step = action.payload;
      switch (action.payload) {
        case 1:
          state.stepName = 'selecting_departure_station';
          break;
        case 2:
          state.stepName = 'selected_departure_station';
          break;
        case 3:
          state.stepName = 'selecting_arrival_station';
          break;
        case 4:
          state.stepName = 'selected_arrival_station';
          break;
        case 5:
          state.stepName = 'payment';
          break;
        case 6:
          state.stepName = 'finalizing';
          break;
        default:
          state.step = 1;
          state.stepName = 'selecting_departure_station';
          break;
      }
    },

    /**
     * Resets the entire booking flow to its initial state.
     */
    resetBookingFlow: (state) => {
      state.step = 1;
      state.stepName = 'selecting_departure_station';
      state.departureDate = null;
    },
  },
});

export const { setDepartureDate, advanceBookingStep, resetBookingFlow } = bookingSlice.actions;

export default bookingSlice.reducer;

/* --------------------------- Selectors --------------------------- */
export const selectBookingStep = (state: RootState) => state.booking.step;
export const selectBookingStepName = (state: RootState) => state.booking.stepName;
export const selectDepartureDate = (state: RootState) => state.booking.departureDate;
