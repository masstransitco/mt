import { createTransform } from "redux-persist";
// Import your initial state shape from the booking slice:
import bookingReducer, { BookingState } from "./bookingSlice";

// This transform will only store the booking data when step=5 or step=6.
// For any other step, it saves a reset/empty booking state to localStorage.
const bookingStep5Transform = createTransform<BookingState, BookingState>(
  // Transform state *going to* local storage (inbound)
  (inboundState, key) => {
    // Handle the case where inboundState is null or undefined
    if (!inboundState) {
      console.log(`[bookingStep5Transform] inboundState is null/undefined, using initial state`);
      return {
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
    }
    
    // Handle case where step is undefined
    if (inboundState.step === undefined) {
      console.log(`[bookingStep5Transform] inboundState.step is undefined, using initial state`);
      return {
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
    }
    
    // Only persist steps 5 and 6
    if (inboundState.step === 5 || inboundState.step === 6) {
      // Keep the full booking slice in local storage
      console.log(`[bookingStep5Transform] Persisting step ${inboundState.step} data to localStorage`);
      return inboundState;
    }
    
    // For steps 1-4, store a reset state so on refresh the app starts fresh
    console.log(`[bookingStep5Transform] Clearing step ${inboundState.step} data (not persisting)`);
    return {
      step: 1, // Reset to step 1
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
    // Handle the case where outboundState is null or undefined
    if (!outboundState) {
      console.log(`[bookingStep5Transform] outboundState is null/undefined, using initial state`);
      return {
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
    }
    
    // Handle case where step is undefined
    if (outboundState.step === undefined) {
      console.log(`[bookingStep5Transform] outboundState.step is undefined, using initial state`);
      return {
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
    }
    
    // Only rehydrate steps 5 and 6
    if (outboundState.step === 5 || outboundState.step === 6) {
      console.log(`[bookingStep5Transform] Rehydrating step ${outboundState.step} data from localStorage`);
      return outboundState;
    }
    
    // For all other steps, ensure we return a clean state
    console.log(`[bookingStep5Transform] Preventing rehydration of step ${outboundState.step}`);
    return {
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
  }
);

export default bookingStep5Transform;
