"use client"

import React from 'react';
import { useAppDispatch } from '@/store/store';
import { setDepartureDate, setDepartureTime, confirmDateTime } from '@/store/bookingSlice';
import { Button } from './ui/button';

/**
 * Helper component for testing the date/time flow in development
 * Renders buttons to simulate user selecting and confirming date/time
 */
export function TestDateTimeFlow() {
  const dispatch = useAppDispatch();

  // Helper to log actions to console
  const logAction = (actionName: string, payload: any) => {
    console.log(`Dispatching ${actionName}:`, payload);
  };

  // Simulate selecting tomorrow at 2:00 PM
  const selectTomorrow2PM = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0); // Reset to midnight
    
    const tomorrowISOString = tomorrow.toISOString();
    logAction('setDepartureDate', tomorrowISOString);
    dispatch(setDepartureDate(tomorrowISOString));
    
    const time = new Date();
    time.setHours(14, 0, 0, 0); // 2:00 PM
    const timeISOString = time.toISOString();
    logAction('setDepartureTime', timeISOString);
    dispatch(setDepartureTime(timeISOString));
  };

  // Simulate confirming the selected date/time
  const confirmSelection = () => {
    logAction('confirmDateTime', true);
    dispatch(confirmDateTime(true));
  };

  // Simulate clearing the selection
  const clearSelection = () => {
    logAction('clearDateTime', false);
    dispatch(confirmDateTime(false));
    dispatch(setDepartureDate(''));
    dispatch(setDepartureTime(''));
  };

  return (
    <div className="fixed top-20 right-4 z-50 bg-black/80 p-3 rounded-lg border border-white/20">
      <div className="text-xs mb-1 text-gray-400">Debug DateTime Flow</div>
      <div className="space-y-2">
        <Button 
          onClick={selectTomorrow2PM}
          size="sm"
          variant="outline"
          className="w-full text-xs"
        >
          Select Tomorrow 2PM
        </Button>
        <Button 
          onClick={confirmSelection}
          size="sm"
          variant="outline"
          className="w-full text-xs"
        >
          Confirm DateTime
        </Button>
        <Button 
          onClick={clearSelection}
          size="sm"
          variant="outline"
          className="w-full text-xs text-red-500"
        >
          Clear Selection
        </Button>
      </div>
    </div>
  );
}