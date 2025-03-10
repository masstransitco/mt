import { createTransform } from "redux-persist";
// Import your initial state shape from the booking slice:
import bookingReducer, { BookingState } from "./bookingSlice";

// This transform will only store the booking data when step=5.
// For any other step, it saves a reset/empty booking state to localStorage.
const bookingStep5Transform = createTransform<BookingState, BookingState>(
  // Transform state *going to* local storage (inbound)
  (inboundState, key) => {
    if (inboundState.step === 5) {
      // Keep the full booking slice in local storage
      return inboundState;
    }
    // Otherwise, store a reset version so next refresh doesn't see partial steps
    return {
      ...inboundState,
      step: 1,
      stepName: "selecting_departure_station",
      departureDate: null,
      route: null,
      routeStatus: "idle",
      routeError: null,
      ticketPlan: null,
      departureStationId: null,
      arrivalStationId: null,
    };
  },
  // Transform state *coming from* local storage (outbound)
  (outboundState, key) => {
    // In this scenario, if the stored state was at step 5, it’s fine to rehydrate fully.
    // If it was not step 5, it’s already the reset version, so we can just return it as is.
    return outboundState;
  },
  // We do the transformation only for the booking slice
  { whitelist: ["booking"] }
);

export default bookingStep5Transform;
