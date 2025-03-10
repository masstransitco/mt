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
} from "redux-persist";
import storage from "redux-persist/lib/storage";

// Import slices as usual
import chatReducer from "./chatSlice";
import uiReducer from "./uiSlice";
import userReducer from "./userSlice";
import stationsReducer from "./stationsSlice";
import carReducer from "./carSlice";
import bookingReducer from "./bookingSlice";
import stations3DReducer from "./stations3DSlice";
import dispatchReducer from "./dispatchSlice";
import verificationReducer from "./verificationSlice";

// Import your custom transform
import bookingStep5Transform from "./bookingStep5Transform"; // The file we created above

// Example user persist config
const userPersistConfig = {
  key: "user",
  storage,
  whitelist: ["authUser", "isSignedIn", "defaultPaymentMethodId"],
};

// Booking persist config with the step=5 transform
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
  transforms: [bookingStep5Transform], // <---- Use the custom transform here
};

const rootReducer = combineReducers({
  chat: chatReducer,
  ui: uiReducer,
  user: persistReducer(userPersistConfig, userReducer),
  stations: stationsReducer,
  stations3D: stations3DReducer,
  car: carReducer,
  booking: persistReducer(bookingPersistConfig, bookingReducer),
  dispatch: dispatchReducer,
  verification: verificationReducer,
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        // If you are ignoring date objects, keep these lines
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
