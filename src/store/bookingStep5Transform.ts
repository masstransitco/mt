import { createTransform } from 'redux-persist';
import { BookingState, initialState as bookingInitial } from './bookingSlice';

/**
 * Transform to only persist booking data when:
 * 1. User is signed in (checked via getState)
 * 2. The booking is in step 5
 * 3. A valid bookingId exists
 * 
 * Otherwise, revert to initial state to prevent stale data.
 */
export const bookingStep5Transform = createTransform(
  // State to storage (inbound)
  (inbound, key, { getState }) => {
    // Type safety for inbound
    const bookingState = inbound as BookingState;
    
    // Get current state from the store
    const state = getState();
    
    // Only persist if all criteria are met
    const keep = 
      state.user?.isSignedIn === true && 
      bookingState.step === 5 && 
      typeof bookingState.bookingId === 'string';
    
    // Return either valid state or initial state
    return keep ? bookingState : bookingInitial;
  },
  
  // Storage to state (outbound) - simpler since we don't need rootState here
  (outbound) => {
    // Type safety for outbound
    return outbound as BookingState;
  },
  
  // Only apply to booking reducer
  { whitelist: ['booking'] }
);