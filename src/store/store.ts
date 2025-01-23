// src/store/store.ts

import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './uiSlice';
import userReducer from './userSlice';
import stationsReducer from './stationsSlice';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    user: userReducer,
    stations: stationsReducer,
  },
});

// Types for use in components and hooks
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Optional: typed hooks if you're using React Redux
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;