'use client';
import React from 'react';
import { Provider } from 'react-redux';
import { store, persistor } from '@/store/store';
import { PersistGate } from 'redux-persist/integration/react';
import Spinner from '@/components/ui/spinner'; // Assuming you have this component

export function ReduxProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <PersistGate 
        loading={
          <div className="h-screen w-screen flex items-center justify-center">
            <Spinner size="lg" />
          </div>
        } 
        persistor={persistor}
      >
        {children}
      </PersistGate>
    </Provider>
  );
}
