import { configureStore, combineReducers } from "@reduxjs/toolkit";
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  Transform,
} from "redux-persist";
import storage from "redux-persist/lib/storage";

// Redux slices
import chatReducer from "./chatSlice";
import userReducer from "./userSlice";
import stationsReducer from "./stationsSlice";
import carReducer from "./carSlice";
import bookingReducer, { BookingState } from "./bookingSlice";
import stations3DReducer from "./stations3DSlice";
import dispatchReducer from "./dispatchSlice";
import verificationReducer from "./verificationSlice";

// Default booking state for resets
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

/**
 * SIMPLIFIED TRANSFORM - Single transform that:
 * 1. Only persists step 5
 * 2. Only rehydrates step 5
 * 3. Ensures type safety with deep cloning
 * 4. Guards against malformed state
 */
const bookingPersistTransform: Transform<BookingState, BookingState> = {
  // Redux State => localStorage
  in: (inboundState) => {
    // Guard against null/undefined state
    if (!inboundState) {
      console.log("[bookingPersistTransform] inboundState is null/undefined");
      return defaultBooking;
    }

    // Deep clone to prevent reference issues (simple but effective)
    try {
      const stateCopy = JSON.parse(JSON.stringify(inboundState));
      
      // Only persist step 5 to localStorage, ignore all other steps
      if (typeof stateCopy.step === 'number' && stateCopy.step === 5) {
        console.log("[bookingPersistTransform] Persisting step 5 data to localStorage");
        
        // Type-safety checks for critical fields
        if (typeof stateCopy.departureStationId !== 'number') {
          stateCopy.departureStationId = null;
        }
        
        if (typeof stateCopy.arrivalStationId !== 'number') {
          stateCopy.arrivalStationId = null;
        }
        
        stateCopy.isQrScanStation = !!stateCopy.isQrScanStation;
        
        return stateCopy;
      }
      
      // For all other steps, don't persist to localStorage
      console.log(`[bookingPersistTransform] Not persisting step ${stateCopy.step || 'unknown'}`);
      return undefined; // Skip persisting non-step 5 data
    } catch (error) {
      console.error("[bookingPersistTransform] Error processing state:", error);
      return defaultBooking;
    }
  },

  // localStorage => Redux State
  out: (outboundState) => {
    // Guard against null/undefined state
    if (!outboundState) {
      console.log("[bookingPersistTransform] outboundState is null/undefined");
      return defaultBooking;
    }

    // Deep clone to prevent reference issues
    try {
      const stateCopy = JSON.parse(JSON.stringify(outboundState));
      
      // Only rehydrate step 5, reset for all other steps
      if (typeof stateCopy.step === 'number' && stateCopy.step === 5) {
        console.log("[bookingPersistTransform] Rehydrating step 5 data from localStorage");
        
        // Type-safety checks for critical fields
        if (typeof stateCopy.departureStationId !== 'number') {
          stateCopy.departureStationId = null;
        }
        
        if (typeof stateCopy.arrivalStationId !== 'number') {
          stateCopy.arrivalStationId = null;
        }
        
        stateCopy.isQrScanStation = !!stateCopy.isQrScanStation;
        
        return stateCopy;
      }
      
      // For all other steps, reset to default
      console.log(`[bookingPersistTransform] Not rehydrating step ${stateCopy.step || 'unknown'}`);
      return defaultBooking;
    } catch (error) {
      console.error("[bookingPersistTransform] Error processing state:", error);
      return defaultBooking;
    }
  }
};

/**
 * User persist config remains unchanged
 */
const userPersistConfig = {
  key: "user",
  storage,
  whitelist: ["authUser", "isSignedIn", "defaultPaymentMethodId"],
};

/**
 * Simplified booking persist config with a single transform
 */
const bookingPersistConfig = {
  key: "booking",
  storage,
  whitelist: [
    "step",
    "stepName",
    "departureDate", 
    "ticketPlan",
    "departureStationId",
    "arrivalStationId",
    "route",
    "isQrScanStation",
    "qrVirtualStationId" // Include QR fields in persistence
  ],
  transforms: [bookingPersistTransform]
};

/**
 * Root reducer configuration remains unchanged
 */
const rootReducer = combineReducers({
  chat: chatReducer,
  user: persistReducer(userPersistConfig, userReducer),
  stations: stationsReducer,
  stations3D: stations3DReducer,
  car: carReducer,
  booking: persistReducer(bookingPersistConfig, bookingReducer),
  dispatch: dispatchReducer,
  verification: verificationReducer,
});

/**
 * Store configuration remains unchanged
 */
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        ignoredActionPaths: ["payload.departureDate"],
        ignoredPaths: ["booking.departureDate"],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
