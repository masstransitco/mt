// src/store/store.ts

import { configureStore } from '@reduxjs/toolkit';
import chatReducer from './chatSlice';
import uiReducer from './uiSlice';
import userReducer from './userSlice';
import stationsReducer from './stationsSlice';
import carReducer from './carSlice';
import bookingReducer from './bookingSlice';
// NEW: Import the 3D slice reducer
import stations3DReducer from './stations3DSlice';

export const store = configureStore({
  reducer: {
    chat: chatReducer,
    ui: uiReducer,
    user: userReducer,
    stations: stationsReducer,
    // ADD the new 3D stations reducer here
    stations3D: stations3DReducer,
    car: carReducer,
    booking: bookingReducer,
  },
});

// 3) Types for use in components and hooks
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
