// store.ts
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

/**
 * 1) We define a "preTransform" that clears ephemeral steps
 *    so they never get written to localStorage.
 * 
 *    - If step is less than 5, it returns an empty booking state
 *      (similar to your initial booking state).
 *    - If step is 5 or 6, or anything else, it lets the data pass through.
 */
const ephemeralStepsTransform: Transform<BookingState, BookingState> = {
  in: (inboundState) => {
    if (!inboundState) return inboundState;

    // If user is on steps 1-4, do NOT persist anything
    if (inboundState.step < 5) {
      console.log("[ephemeralStepsTransform] Stripping ephemeral step data from localStorage inbound");
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
        isQrScanStation: false,
        qrVirtualStationId: null,
      };
    }

    // For step 5 or 6, pass the data along as-is
    return inboundState;
  },
  out: (outboundState) => {
    // Outbound transform is optional in this case, we can just return it.
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
 *    - We add ephemeralStepsTransform first,
 *      and THEN bookingStep5Transform in the array.
 *    - ephemeralStepsTransform ensures ephemeral steps never get stored,
 *      while bookingStep5Transform ensures step <5 won't rehydrate if it sneaks through.
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
