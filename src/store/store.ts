// src/store/store.ts
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { 
  persistStore, 
  persistReducer, 
  FLUSH, 
  REHYDRATE, 
  PAUSE, 
  PERSIST, 
  PURGE, 
  REGISTER 
} from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // defaults to localStorage for web

// Import your reducers
import chatReducer from './chatSlice';
import uiReducer from './uiSlice';
import userReducer from './userSlice';
import stationsReducer from './stationsSlice';
import carReducer from './carSlice';
import bookingReducer from './bookingSlice';
import stations3DReducer from './stations3DSlice';
import dispatchReducer from './dispatchSlice';
import verificationReducer from './verificationSlice';

// Configuration for redux-persist
const userPersistConfig = {
  key: 'user',
  storage,
  whitelist: ['authUser', 'isSignedIn', 'defaultPaymentMethodId'], // Only persist these fields
};

const bookingPersistConfig = {
  key: 'booking',
  storage,
  whitelist: [
    'step', 
    'stepName', 
    'departureDate', 
    'ticketPlan', 
    'departureStationId', 
    'arrivalStationId',
    'route'
  ], // Fields we want to persist
};

// Create the root reducer with persistence
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

// Configure the store with the persisted reducer
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        // Ignore date objects (which are non-serializable)
        ignoredActionPaths: ['payload.departureDate'],
        ignoredPaths: ['booking.departureDate'],
      },
    }),
});

// Create the persistor
export const persistor = persistStore(store);

// Types for use in components and hooks
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
