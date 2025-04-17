import { createTransform } from "redux-persist";
import { BookingState } from "./bookingSlice";

const defaultBooking: BookingState = {
  step: 1,
  stepName: "selecting_departure_station",
  departureDateString: null,
  departureTimeString: null,
  isDateTimeConfirmed: false,
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
  // 1) Transform inbound (Redux => localStorage)
  (inboundState, key) => {
    if (!inboundState) {
      console.log("[bookingStep5Transform] inboundState is null/undefined, using defaultBooking");
      return { ...defaultBooking };
    }

    if (inboundState.step === undefined) {
      console.log("[bookingStep5Transform] inboundState.step is undefined, using defaultBooking");
      return { ...defaultBooking };
    }

    // Persist only if step = 5 or 6
    if (inboundState.step === 5 || inboundState.step === 6) {
      console.log(`[bookingStep5Transform] Persisting step ${inboundState.step} data to localStorage`);
      return inboundState;
    }

    // If ephemeralStepsTransform is handling step <5, you could simply return inboundState here
    // Or you can keep clearing for safety; up to you. For clarity:
    console.log(`[bookingStep5Transform] Not step 5 or 6 -> ignoring for this transform`);
    return inboundState;
  },

  // 2) Transform outbound (localStorage => Redux on rehydrate)
  (outboundState, key) => {
    if (!outboundState) {
      console.log("[bookingStep5Transform] outboundState is null/undefined, using defaultBooking");
      return { ...defaultBooking };
    }

    if (outboundState.step === undefined) {
      console.log("[bookingStep5Transform] outboundState.step is undefined, using defaultBooking");
      return { ...defaultBooking };
    }

    // Only rehydrate if step = 5 or 6
    if (outboundState.step === 5 || outboundState.step === 6) {
      console.log(`[bookingStep5Transform] Rehydrating step ${outboundState.step} data from localStorage`);
      return outboundState;
    }

    console.log(`[bookingStep5Transform] Preventing rehydration of step ${outboundState.step}`);
    return { ...defaultBooking };
  }
);

export default bookingStep5Transform;