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

// The transform you already have
import bookingStep5Transform from "./bookingStep5Transform";

// A reusable default booking object for clearing ephemeral steps
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
 * 1) We define a "preTransform" that clears ephemeral steps
 *    so they never get written to localStorage.
 *
 *    - We want *all* steps < 5 (including step 1) to be ephemeral.
 *    - This means if the user is at step 1..4, it never persists to localStorage.
 *    - Steps 5 or 6 pass through and get stored.
 */
const ephemeralStepsTransform: Transform<BookingState, BookingState> = {
  // (Redux => localStorage)
  in: (inboundState) => {
    // No ephemeral logic here—pass state as-is so we don't overwrite step <5 mid-session.
    return inboundState;
  },

  // Outbound transform (from localStorage to Redux state on rehydration)
  out: (outboundState) => {
    if (!outboundState) return outboundState;

    // If the stored data was step < 5, we do not rehydrate it (returns default)
    if (outboundState.step < 5) {
      console.log("[ephemeralStepsTransform] Preventing rehydration of steps <5");
      return { ...defaultBooking };
    }

    // Otherwise, pass it through
    return outboundState;
  },
};

/**
 * 2) Here is your user persist config, unchanged
 */
const userPersistConfig = {
  key: "user",
  storage,
  whitelist: ["authUser", "isSignedIn", "defaultPaymentMethodId"],
};

/**
 * 3) The booking persist config:
 *    - ephemeralStepsTransform first,
 *    - then bookingStep5Transform
 *    ephemeralStepsTransform ensures steps <5 never get stored,
 *    bookingStep5Transform ensures only steps 5 or 6 rehydrate if it sneaks through.
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
  ],
  transforms: [ephemeralStepsTransform, bookingStep5Transform],
};

/**
 * 4) Combine your reducers as usual,
 *    using persistReducer on user and booking.
 */
const rootReducer = combineReducers({
  chat: chatReducer,
  user: persistReducer(userPersistConfig, userReducer),
  stations: stationsReducer,
  stations3D: stations3DReducer,
  car: carReducer,

  // Booking is persist-wrapped:
  booking: persistReducer(bookingPersistConfig, bookingReducer),

  dispatch: dispatchReducer,
  verification: verificationReducer,
});

/**
 * 5) Create the store, telling Redux Toolkit
 *    to ignore the usual redux-persist warnings
 *    about serialization checks for the special persist actions.
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

/**
 * 6) Export persistor for your Next.js or React usage
 */
export const persistor = persistStore(store);

// Typed hooks
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;