// bookingStep5Transform.ts

import { createTransform } from "redux-persist";
import { BookingState } from "./bookingSlice";

/** Reusable default (empty) booking object */
const defaultBooking: BookingState = {
  step: 1,
  stepName: "selecting_departure_station",
  departureDate: null,
  route: null,
  routeStatus: "idle",
  routeError: null,
  ticketPlan: null,
  departureStationId: null,
  arrivalStationId: null,
  isQrScanStation: false,
  qrVirtualStationId: null,
};

const bookingStep5Transform = createTransform<BookingState, BookingState>(
  // 1) Transform inbound (to localStorage)
  (inboundState, key) => {
    if (!inboundState) {
      console.log(`[bookingStep5Transform] inboundState is null/undefined, using initial state`);
      return { ...defaultBooking };
    }

    if (inboundState.step === undefined) {
      console.log(`[bookingStep5Transform] inboundState.step is undefined, using initial state`);
      return { ...defaultBooking };
    }

    // Persist only if step = 5 or 6
    if (inboundState.step === 5 || inboundState.step === 6) {
      console.log(`[bookingStep5Transform] Persisting step ${inboundState.step} data to localStorage`);
      return inboundState;
    }

    // If it's step 2-4, we clear; step 1 is allowed to pass through
    if (inboundState.step >= 2 && inboundState.step < 5) {
      console.log(`[bookingStep5Transform] Clearing step ${inboundState.step} data (not persisting)`);
      return { ...defaultBooking };
    }

    // If it's step 1 (or anything else outside 2-4, 5, 6), just pass it
    return inboundState;
  },

  // 2) Transform outbound (from localStorage)
  (outboundState, key) => {
    if (!outboundState) {
      console.log(`[bookingStep5Transform] outboundState is null/undefined, using initial state`);
      return { ...defaultBooking };
    }

    if (outboundState.step === undefined) {
      console.log(`[bookingStep5Transform] outboundState.step is undefined, using initial state`);
      return { ...defaultBooking };
    }

    // Only rehydrate if step = 5 or 6
    if (outboundState.step === 5 || outboundState.step === 6) {
      console.log(`[bookingStep5Transform] Rehydrating step ${outboundState.step} data from localStorage`);
      return outboundState;
    }

    // If it's step 2-4, prevent rehydration
    if (outboundState.step >= 2 && outboundState.step < 5) {
      console.log(`[bookingStep5Transform] Preventing rehydration of step ${outboundState.step}`);
      return { ...defaultBooking };
    }

    // For step 1 or anything else, just return it
    return outboundState;
  }
);

export default bookingStep5Transform;
