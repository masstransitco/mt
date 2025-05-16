"use client";

import { createSlice, createAsyncThunk, PayloadAction, createSelector } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import { StationFeature } from "./stationsSlice";
import { ensureGoogleMapsLoaded, getDirections } from "@/lib/googleMaps";
import { Car } from "@/types/booking";

/** The user's chosen ticket plan. */
type TicketPlan = "single" | "paygo" | null;

/** Defines the route information between two stations. */
interface RouteInfo {
  distance: number; // in meters
  duration: number; // in seconds
  polyline: string; // encoded polyline
}

/** The overall state for booking. */
export interface BookingState {
  step: number;
  stepName: string;
  departureDateString: string | null; // ISO string for Date
  departureTimeString: string | null; // ISO string for Time
  isDateTimeConfirmed: boolean;
  route: RouteInfo | null;
  routeStatus: string; // "idle" | "loading" | "succeeded" | "failed"
  routeError: string | null;
  ticketPlan: TicketPlan;

  departureStationId: number | null;
  arrivalStationId: number | null;

  /** NEW fields to unify QR-based station usage. */
  isQrScanStation: boolean;
  qrVirtualStationId: number | null;
  
  /** Car and booking reference data */
  selectedCarId: number | null;
  selectedCar: Car | null;  // From types/booking.ts Car interface
  bookingId: string | null; // Reference to the formal booking record
  
  /** Payment-related fields */
  estimatedCost: number | null;
  paymentStatus: 'pending' | 'completed' | 'failed' | null;
  paymentReference: string | null;
}

/**
 * Thunk to fetch a route between two stations.
 */
export const fetchRoute = createAsyncThunk<
  RouteInfo,
  { departure: StationFeature; arrival: StationFeature },
  { rejectValue: string }
>(
  "booking/fetchRoute",
  async ({ departure, arrival }, { rejectWithValue }) => {
    try {
      // No need to await ensureGoogleMapsLoaded() anymore,
      // our GoogleMapsProvider ensures Maps API is available
      const [depLng, depLat] = departure.geometry.coordinates;
      const [arrLng, arrLat] = arrival.geometry.coordinates;

      const result = await getDirections(
        { lat: depLat, lng: depLng },
        { lat: arrLat, lng: arrLng },
        { travelMode: google.maps.TravelMode.DRIVING }
      );
      if (!result.routes?.[0]) {
        return rejectWithValue("No route found");
      }
      const route = result.routes[0];
      const leg = route.legs?.[0];
      if (!leg?.distance?.value || !leg?.duration?.value) {
        return rejectWithValue("Incomplete route data");
      }
      return {
        distance: leg.distance.value,
        duration: leg.duration.value,
        polyline: route.overview_polyline ?? "",
      };
    } catch (err) {
      console.error("Route fetching error:", err);
      return rejectWithValue("Directions request failed");
    }
  }
);

/** Initial booking state. */
const initialState: BookingState = {
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
  
  // Car and booking data
  selectedCarId: null,
  selectedCar: null,
  bookingId: null,
  
  // Payment data
  estimatedCost: null,
  paymentStatus: null,
  paymentReference: null,
};

export const bookingSlice = createSlice({
  name: "booking",
  initialState,
  reducers: {
    setDepartureDate: (state, action: PayloadAction<string>) => {
      // Action payload is already an ISO string
      state.departureDateString = action.payload;
    },
    setDepartureTime: (state, action: PayloadAction<string>) => {
      // Action payload is already an ISO string
      state.departureTimeString = action.payload;
    },
    confirmDateTime: (state, action: PayloadAction<boolean>) => {
      state.isDateTimeConfirmed = action.payload;
    },
    advanceBookingStep: (state, action: PayloadAction<number>) => {
      const newStep = action.payload;
      if (newStep < 1 || newStep > 6) {
        console.warn(`Invalid booking step: ${newStep}, defaulting to step 1`);
        state.step = 1;
        state.stepName = "selecting_departure_station";
        return;
      }
      
      // Special case for step 5 coming from loadBookingDetails
      // Always allow direct advancement to step 5 when loading from Firestore/localStorage
      const isLoadingStep5 = newStep === 5;
      
      // Don't allow skipping steps unless going back to 1 or loading step 5
      if (newStep !== 1 && newStep > state.step + 1 && !isLoadingStep5) {
        console.warn(`Cannot advance from step ${state.step} to ${newStep} - steps can't be skipped`);
        return;
      }
      
      state.step = newStep;
      switch (newStep) {
        case 1:
          state.stepName = "selecting_departure_station";
          break;
        case 2:
          state.stepName = "selected_departure_station";
          break;
        case 3:
          state.stepName = "selecting_arrival_station";
          break;
        case 4:
          state.stepName = "selected_arrival_station";
          break;
        case 5:
          state.stepName = "payment";
          break;
        case 6:
          state.stepName = "finalizing";
          break;
        default:
          state.stepName = "selecting_departure_station";
      }
    },
    selectDepartureStation: (state, action: PayloadAction<number>) => {
      // Only clear date/time selection if we don't have confirmed values
      // This allows us to keep scheduled pickup times across steps
      if (!state.isDateTimeConfirmed) {
        state.departureDateString = null;
        state.departureTimeString = null;
      }
      
      state.departureStationId = action.payload;
      state.step = 2;
      state.stepName = "selected_departure_station";
    },
    clearDepartureStation: (state) => {
      state.departureStationId = null;
      state.step = 1;
      state.stepName = "selecting_departure_station";
      state.route = null;
      state.routeStatus = "idle";
      state.routeError = null;
      
      // Also clear date/time when clearing departure station
      state.departureDateString = null;
      state.departureTimeString = null;
      state.isDateTimeConfirmed = false;
    },
    selectArrivalStation: (state, action: PayloadAction<number>) => {
      if (state.step >= 3 && state.step <= 4) {
        state.arrivalStationId = action.payload;
        if (state.step === 3) {
          state.step = 4;
          state.stepName = "selected_arrival_station";
        }
      }
    },
    clearArrivalStation: (state) => {
      state.arrivalStationId = null;
      if (state.step >= 3) {
        state.step = 3;
        state.stepName = "selecting_arrival_station";
      }
      state.route = null;
      state.routeStatus = "idle";
      state.routeError = null;
      
      // Also clear date/time when clearing arrival station
      state.departureDateString = null;
      state.departureTimeString = null;
      state.isDateTimeConfirmed = false;
    },
    resetBookingFlow: (state) => {
      state.step = 1;
      state.stepName = "selecting_departure_station";
      state.departureDateString = null;
      state.departureTimeString = null;
      state.isDateTimeConfirmed = false;
      state.route = null;
      state.routeStatus = "idle";
      state.routeError = null;
      state.ticketPlan = null;
      state.departureStationId = null;
      state.arrivalStationId = null;
      // Also reset new QR fields
      state.isQrScanStation = false;
      state.qrVirtualStationId = null;
      // Reset car and booking data
      state.selectedCarId = null;
      state.selectedCar = null;
      state.bookingId = null;
      // Reset payment data
      state.estimatedCost = null;
      state.paymentStatus = null;
      state.paymentReference = null;
    },
    setTicketPlan: (state, action: PayloadAction<TicketPlan>) => {
      state.ticketPlan = action.payload;
    },
    clearRoute: (state) => {
      state.route = null;
      state.routeStatus = "idle";
      state.routeError = null;
    },

    /**
     * Mark that we have a 'QR-based' station in use,
     * storing the station ID in Redux
     */
    setQrStationData: (
      state,
      action: PayloadAction<{
        isQrScanStation: boolean;
        qrVirtualStationId: number | null;
      }>
    ) => {
      state.isQrScanStation = action.payload.isQrScanStation;
      state.qrVirtualStationId = action.payload.qrVirtualStationId;
    },

    /**
     * Clears out any existing QR station data
     */
    clearQrStationData: (state) => {
      state.isQrScanStation = false;
      state.qrVirtualStationId = null;
    },
    
    /**
     * Select a car for booking
     */
    selectCar: (state, action: PayloadAction<Car>) => {
      state.selectedCarId = action.payload.id;
      state.selectedCar = action.payload;
      // Optionally compute estimated cost based on car price and route distance
      if (state.route && state.route.distance) {
        // Simple cost calculation based on distance and car price
        // This would likely be more complex in a real application
        const distanceInKm = state.route.distance / 1000;
        state.estimatedCost = Math.round(action.payload.price * distanceInKm);
      }
    },
    
    /**
     * Clear selected car
     */
    clearSelectedCar: (state) => {
      state.selectedCarId = null;
      state.selectedCar = null;
      state.estimatedCost = null;
    },
    
    /**
     * Set booking ID reference
     */
    setBookingId: (state, action: PayloadAction<string>) => {
      state.bookingId = action.payload;
    },
    
    /**
     * Set payment status
     */
    setPaymentStatus: (state, action: PayloadAction<'pending' | 'completed' | 'failed'>) => {
      state.paymentStatus = action.payload;
    },
    
    /**
     * Set estimated cost
     */
    setEstimatedCost: (state, action: PayloadAction<number>) => {
      state.estimatedCost = action.payload;
    },
    
    /**
     * Set payment reference
     */
    setPaymentReference: (state, action: PayloadAction<string>) => {
      state.paymentReference = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRoute.pending, (state) => {
        state.routeStatus = "loading";
        state.routeError = null;
      })
      .addCase(fetchRoute.fulfilled, (state, action) => {
        state.routeStatus = "succeeded";
        state.routeError = null;
        state.route = action.payload;
      })
      .addCase(fetchRoute.rejected, (state, action) => {
        state.routeStatus = "failed";
        state.routeError = action.payload ?? "Failed to fetch route";
        state.route = null;
      });
  },
});

export const {
  setDepartureDate,
  setDepartureTime,
  confirmDateTime,
  advanceBookingStep,
  selectDepartureStation,
  clearDepartureStation,
  selectArrivalStation,
  clearArrivalStation,
  resetBookingFlow,
  setTicketPlan,
  clearRoute,
  setQrStationData,
  clearQrStationData,
  selectCar,
  clearSelectedCar,
  setBookingId,
  setPaymentStatus,
  setEstimatedCost,
  setPaymentReference,
} = bookingSlice.actions;

export default bookingSlice.reducer;

/** Type-safe selectors that handle potentially malformed state */
export const selectBookingStep = (state: RootState): number => {
  try {
    if (!state?.booking) return 1;
    return typeof state.booking.step === 'number' ? state.booking.step : 1;
  } catch (e) {
    return 1; // Fallback to step 1 if error
  }
};

export const selectBookingStepName = (state: RootState): string => {
  try {
    if (!state?.booking) return "selecting_departure_station";
    return typeof state.booking.stepName === 'string' 
      ? state.booking.stepName 
      : "selecting_departure_station";
  } catch (e) {
    return "selecting_departure_station"; // Fallback
  }
};

export const selectDepartureDate = (state: RootState): Date | null => {
  try {
    if (!state?.booking || !state.booking.departureDateString) return null;
    return new Date(state.booking.departureDateString);
  } catch (e) {
    return null; // Fallback
  }
};

export const selectDepartureTime = (state: RootState): Date | null => {
  try {
    if (!state?.booking || !state.booking.departureTimeString) return null;
    return new Date(state.booking.departureTimeString);
  } catch (e) {
    return null; // Fallback
  }
};

export const selectIsDateTimeConfirmed = (state: RootState): boolean => {
  try {
    if (!state?.booking) return false;
    return !!state.booking.isDateTimeConfirmed;
  } catch (e) {
    return false; // Fallback
  }
};

export const selectRoute = (state: RootState): RouteInfo | null => {
  try {
    if (!state?.booking) return null;
    return state.booking.route;
  } catch (e) {
    return null; // Fallback
  }
};

export const selectRouteStatus = (state: RootState): string => {
  try {
    if (!state?.booking) return "idle";
    return typeof state.booking.routeStatus === 'string' 
      ? state.booking.routeStatus 
      : "idle";
  } catch (e) {
    return "idle"; // Fallback
  }
};

export const selectRouteError = (state: RootState): string | null => {
  try {
    if (!state?.booking) return null;
    return typeof state.booking.routeError === 'string' 
      ? state.booking.routeError 
      : null;
  } catch (e) {
    return null; // Fallback
  }
};

export const selectTicketPlan = (state: RootState): TicketPlan => {
  try {
    if (!state?.booking) return null;
    const plan = state.booking.ticketPlan;
    if (plan === "single" || plan === "paygo" || plan === null) {
      return plan;
    }
    return null;
  } catch (e) {
    return null; // Fallback
  }
};

/** Station IDs with improved type safety */
export const selectDepartureStationId = (state: RootState): number | null => {
  try {
    if (!state?.booking) return null;
    return typeof state.booking.departureStationId === 'number' 
      ? state.booking.departureStationId 
      : null;
  } catch (e) {
    return null; // Fallback
  }
};

export const selectArrivalStationId = (state: RootState): number | null => {
  try {
    if (!state?.booking) return null;
    return typeof state.booking.arrivalStationId === 'number' 
      ? state.booking.arrivalStationId 
      : null;
  } catch (e) {
    return null; // Fallback
  }
};

/** QR fields with improved type safety */
export const selectIsQrScanStation = (state: RootState): boolean => {
  try {
    if (!state?.booking) return false;
    return !!state.booking.isQrScanStation;
  } catch (e) {
    return false; // Fallback
  }
};

export const selectQrVirtualStationId = (state: RootState): number | null => {
  try {
    if (!state?.booking) return null;
    return typeof state.booking.qrVirtualStationId === 'number' 
      ? state.booking.qrVirtualStationId 
      : null;
  } catch (e) {
    return null; // Fallback
  }
};

/** Car and booking fields with improved type safety */
export const selectSelectedCarId = (state: RootState): number | null => {
  try {
    if (!state?.booking) return null;
    return typeof state.booking.selectedCarId === 'number' 
      ? state.booking.selectedCarId 
      : null;
  } catch (e) {
    return null; // Fallback
  }
};

export const selectSelectedCar = (state: RootState): Car | null => {
  try {
    if (!state?.booking) return null;
    return state.booking.selectedCar;
  } catch (e) {
    return null; // Fallback
  }
};

export const selectBookingId = (state: RootState): string | null => {
  try {
    if (!state?.booking) return null;
    return typeof state.booking.bookingId === 'string' 
      ? state.booking.bookingId 
      : null;
  } catch (e) {
    return null; // Fallback
  }
};

/** Payment fields with improved type safety */
export const selectEstimatedCost = (state: RootState): number | null => {
  try {
    if (!state?.booking) return null;
    return typeof state.booking.estimatedCost === 'number' 
      ? state.booking.estimatedCost 
      : null;
  } catch (e) {
    return null; // Fallback
  }
};

export const selectPaymentStatus = (state: RootState): 'pending' | 'completed' | 'failed' | null => {
  try {
    if (!state?.booking) return null;
    const status = state.booking.paymentStatus;
    if (status === 'pending' || status === 'completed' || status === 'failed') {
      return status;
    }
    return null;
  } catch (e) {
    return null; // Fallback
  }
};

export const selectPaymentReference = (state: RootState): string | null => {
  try {
    if (!state?.booking) return null;
    return typeof state.booking.paymentReference === 'string' 
      ? state.booking.paymentReference 
      : null;
  } catch (e) {
    return null; // Fallback
  }
};

/** If you need a memoized decode of the polyline, etc. */
export const selectRouteDecoded = createSelector([selectRoute], (route) => {
  if (!route || !route.polyline) return [];
  try {
    if (!window.google?.maps?.geometry?.encoding) {
      // Skip decoding if Google Maps API is not available - 
      // our GoogleMapsProvider will ensure it's loaded when needed
      return [];
    }
    const decodedPath = window.google.maps.geometry.encoding.decodePath(route.polyline);
    return decodedPath.map((latLng) => latLng.toJSON());
  } catch (error) {
    console.error("Error decoding polyline:", error);
    return [];
  }
});
