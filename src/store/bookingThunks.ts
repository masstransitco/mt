"use client";

import { createAsyncThunk } from "@reduxjs/toolkit";
import { doc, getDoc, updateDoc, setDoc, collection, addDoc } from "firebase/firestore";
import { RootState } from "./store";
import { db } from "@/lib/firebase"; // your client-side Firestore import
import { FirestoreBooking, BookingHistoryRecord } from "@/types/firestore";
import {
  setDepartureDate,
  setDepartureTime,
  confirmDateTime,
  advanceBookingStep,
  selectDepartureStation,
  selectArrivalStation,
  setTicketPlan,
  resetBookingFlow,
  BookingState,
  selectCar,
  setBookingId,
  setPaymentStatus,
  setPaymentReference,
  setEstimatedCost,
} from "./bookingSlice";

/**
 * This result shape ensures we never "throw" from the thunk,
 * thus we won't cause a .reject in RTK if an error occurs.
 */
interface BookingThunkResult {
  success: boolean;
  message: string;
  step?: number; 
}

/**
 * saveBookingDetails:
 * - Reads from Redux store's booking state
 * - Persists it under `users/{uid}/booking: {...}` in Firestore
 * - Only actually saves data if user is in step 5 or explicitly resetting
 */
export const saveBookingDetails = createAsyncThunk<
  BookingThunkResult, // We now always return {success, message}
  void
>(
  "booking/saveBookingDetails",
  async (_, { getState, dispatch }) => {
    try {
      const state = getState() as RootState;
      const user = state.user.authUser;
      if (!user) {
        console.warn("[saveBookingDetails] User not signed in; cannot save booking details.");
        return {
          success: false,
          message: "User not signed in; cannot save booking details.",
        };
      }

      // The current booking data in Redux
      const { 
        step,
        departureDateString,
        departureTimeString,
        isDateTimeConfirmed,
        ticketPlan,
        departureStationId,
        arrivalStationId,
        route,
        isQrScanStation,
        qrVirtualStationId,
        selectedCarId,
        selectedCar,
        bookingId,
        estimatedCost,
        paymentStatus,
        paymentReference,
      } = state.booking;

      // Get the CURRENT step from Redux (it might have changed since this thunk was dispatched)
      const currentStep = state.booking.step;

      // IMPORTANT: Only persist data if user is in step 5 (active booking) 
      // or if they're explicitly at step 1 (which means resetting)
      if (currentStep !== 5 && currentStep !== 1) {
        console.log(`[saveBookingDetails] CurrentStep=${currentStep}, not persisting booking state (only steps 1 or 5 are saved)`);
        
        // For steps 2-4, clear any Firestore data to ensure consistent behavior
        if (currentStep >= 2 && currentStep <= 4) {
          console.log(`[saveBookingDetails] Clearing any Firestore data for step ${currentStep}`);
          const userDocRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userDocRef);
          
          if (userSnap.exists()) {
            await updateDoc(userDocRef, {
              booking: null,
            });
          }
          
          return { 
            success: true, 
            message: `Cleared Firestore data for step ${currentStep} (steps 2-4 should not persist)` 
          };
        }
        
        return { success: true, message: `Skipped saving (not in step=5 or step=1, current step is ${currentStep})` };
      }

      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);

      // When resetting (step 1), clear the booking data entirely
      if (currentStep === 1) {
        console.log(`[saveBookingDetails] Explicit reset (step=1), clearing booking data in Firestore`);
        
        if (userSnap.exists()) {
          await updateDoc(userDocRef, {
            booking: null,
          });
        }
        return { success: true, message: "Booking data cleared successfully" };
      }

      // Otherwise, build the object you want to store for step 5
      console.log(`[saveBookingDetails] Persisting step ${currentStep} data to Firestore`);
      
      const bookingData = {
        step: currentStep, // Use the current step from state, not the original step
        departureDateString,
        departureTimeString,
        isDateTimeConfirmed,
        ticketPlan,
        departureStationId,
        arrivalStationId,
        isQrScanStation,
        qrVirtualStationId,
        // Car and booking reference data
        selectedCarId,
        selectedCar: selectedCar ? {
          id: selectedCar.id,
          name: selectedCar.name,
          type: selectedCar.type,
          price: selectedCar.price,
          image: selectedCar.image,
          modelUrl: selectedCar.modelUrl,
          available: selectedCar.available,
          features: selectedCar.features,
        } : null,
        bookingId,
        // Payment-related fields
        estimatedCost,
        paymentStatus,
        paymentReference,
        // If you want to store route data as well, you can include it:
        route: route
          ? {
              distance: route.distance,
              duration: route.duration,
              polyline: route.polyline,
            }
          : null,
        // Add a timestamp for debugging/tracking purposes
        lastUpdated: new Date().toISOString()
      };

      if (userSnap.exists()) {
        // Update existing doc
        await updateDoc(userDocRef, {
          booking: bookingData,
        });
      } else {
        // Create a new doc
        await setDoc(userDocRef, {
          booking: bookingData,
        });
      }

      return { success: true, message: "Booking details saved successfully" };
    } catch (err) {
      console.error("[saveBookingDetails] Error saving booking details:", err);
      // Instead of `rejectWithValue`, we return a success=false shape
      return {
        success: false,
        message: "Failed to save booking details (thunk caught error).",
      };
    }
  }
);

/**
 * loadBookingDetails:
 * - Fetches booking data from `users/{uid}/booking`
 * - Rehydrates Redux ONLY if booking was in step 5
 * - For all other steps, explicitly resets to step 1
 */
export const loadBookingDetails = createAsyncThunk<
  BookingThunkResult,
  void
>(
  "booking/loadBookingDetails",
  async (_, { getState, dispatch }) => {
    try {
      // Don't reset state or clear localStorage yet - do this only after 
      // we've checked if there's valid step 5 data in Firestore
      
      const state = getState() as RootState;
      const user = state.user.authUser;
      if (!user) {
        console.warn("[loadBookingDetails] User not signed in; cannot load booking details.");
        return {
          success: false,
          message: "User not signed in; cannot load booking details.",
        };
      }

      console.log("[loadBookingDetails] Loading booking details for user:", user.uid);

      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);
      
      if (!userSnap.exists()) {
        console.log("[loadBookingDetails] No user document found");
        
        // Get the current step from Redux state
        const currentState = getState() as RootState;
        const currentBookingStep = currentState.booking.step;
        
        // Only reset if we're NOT already in step 5
        if (currentBookingStep !== 5) {
          console.log("[loadBookingDetails] Not at step 5, resetting state");
          dispatch(resetBookingFlow());
        } else {
          console.log("[loadBookingDetails] Already at step 5, preserving state");
        }
        
        return { success: false, message: "No user document found" };
      }

      const data = userSnap.data();
      const booking = data.booking as Partial<BookingState> | undefined;
      
      if (!booking) {
        console.log("[loadBookingDetails] No booking data found in user document");
        
        // Get the current step from Redux state
        const stateWithBooking = getState() as RootState;
        const currentBookingStep = stateWithBooking.booking.step;
        
        // Only reset if we're NOT already in step 5
        if (currentBookingStep !== 5) {
          console.log("[loadBookingDetails] Not at step 5, resetting state");
          dispatch(resetBookingFlow());
        } else {
          console.log("[loadBookingDetails] Already at step 5, preserving state");
        }
        
        return { success: false, message: "No booking data found" };
      }

      console.log("[loadBookingDetails] Found booking data:", booking);

      // Get the current step from Redux state
      const rootState = getState() as RootState;
      const currentBookingStep = rootState.booking.step;
      
      // ONLY restore state if the saved booking was at step 5
      if (booking.step === 5) {
        console.log("[loadBookingDetails] Found step 5 booking in Firestore");
        
        // If we're already at step 5 in Redux, we don't need to do anything
        if (currentBookingStep === 5) {
          console.log("[loadBookingDetails] Already at step 5 in Redux, preserving state");
          return { 
            success: true, 
            message: "Already at step 5, preserving state",
            step: 5
          };
        }
        
        console.log("[loadBookingDetails] Restoring step 5 booking from Firestore...");
        
        // For step 5, don't clear localStorage! Let Redux-persist merge with Firestore data
        
        // Only rehydrate if we found booking data for step 5
        // Handle departure date
        if (booking.departureDateString) {
          try {
            // Validate the date string before dispatching
            const testDate = new Date(booking.departureDateString);
            if (!isNaN(testDate.getTime())) {
              // Only dispatch if it's a valid date string
              dispatch(setDepartureDate(booking.departureDateString));
            } else {
              console.error("[loadBookingDetails] Invalid departureDateString:", booking.departureDateString);
            }
          } catch (err) {
            console.error("[loadBookingDetails] Error parsing departureDateString:", err);
          }
        }

        // Handle departure time
        if (booking.departureTimeString) {
          try {
            // Validate the time string before dispatching
            const testTime = new Date(booking.departureTimeString);
            if (!isNaN(testTime.getTime())) {
              // Only dispatch if it's a valid time string
              dispatch(setDepartureTime(booking.departureTimeString));
            } else {
              console.error("[loadBookingDetails] Invalid departureTimeString:", booking.departureTimeString);
            }
          } catch (err) {
            console.error("[loadBookingDetails] Error parsing departureTimeString:", err);
          }
        }

        // Handle confirmed status
        if (typeof booking.isDateTimeConfirmed === 'boolean') {
          dispatch(confirmDateTime(booking.isDateTimeConfirmed));
        }

        if (booking.ticketPlan) {
          dispatch(setTicketPlan(booking.ticketPlan));
        }

        if (booking.departureStationId) {
          dispatch(selectDepartureStation(booking.departureStationId));
        }

        if (booking.arrivalStationId) {
          dispatch(selectArrivalStation(booking.arrivalStationId));
        }
        
        // Handle car data
        if (booking.selectedCar && typeof booking.selectedCar === 'object') {
          try {
            // Check if the car has the required fields
            if (booking.selectedCar.id && 
                booking.selectedCar.name && 
                typeof booking.selectedCar.price === 'number') {
              dispatch(selectCar(booking.selectedCar));
            } else {
              console.error("[loadBookingDetails] Invalid selectedCar object:", booking.selectedCar);
            }
          } catch (err) {
            console.error("[loadBookingDetails] Error parsing selectedCar:", err);
          }
        } else if (booking.selectedCarId && typeof booking.selectedCarId === 'number') {
          // In this case, we'd ideally fetch the car details by ID, but for now we can just set the ID
          console.log("[loadBookingDetails] Only selectedCarId found, car details would need to be fetched");
          // We could dispatch a thunk here to fetch car details if needed
        }
        
        // Handle booking reference
        if (booking.bookingId && typeof booking.bookingId === 'string') {
          dispatch(setBookingId(booking.bookingId));
        }
        
        // Handle payment data
        if (booking.estimatedCost && typeof booking.estimatedCost === 'number') {
          dispatch(setEstimatedCost(booking.estimatedCost));
        }
        
        if (booking.paymentStatus && 
            (booking.paymentStatus === 'pending' || 
             booking.paymentStatus === 'completed' || 
             booking.paymentStatus === 'failed')) {
          dispatch(setPaymentStatus(booking.paymentStatus));
        }
        
        if (booking.paymentReference && typeof booking.paymentReference === 'string') {
          dispatch(setPaymentReference(booking.paymentReference));
        }

        // Create a special action to make it clear this is for rehydration
        // This will bypass the step skipping protection
        console.log("[loadBookingDetails] Setting step to 5 directly for rehydration");
        dispatch(advanceBookingStep(5));
        
        return { 
          success: true, 
          message: "Step 5 booking details loaded successfully",
          step: 5
        };
      } else {
        // Firestore booking is not at step 5
        console.log(`[loadBookingDetails] Found booking in step ${booking.step} in Firestore, not step 5`);
        
        // If Redux is already at step 5, preserve that state instead of the Firestore version
        if (currentBookingStep === 5) {
          console.log("[loadBookingDetails] Already at step 5 in Redux, preserving Redux state over Firestore");
          
          // Update Firestore to match Redux state
          await updateDoc(userDocRef, {
            booking: {
              step: 5,
              // Other booking fields would be here
              lastUpdated: new Date().toISOString()
            },
          });
          
          return { 
            success: true, 
            message: "Preserved Redux step 5 state over Firestore non-step 5 state",
            step: 5
          };
        }
        
        // Both Redux and Firestore are not at step 5, explicitly reset everything
        console.log(`[loadBookingDetails] Neither Redux nor Firestore at step 5, resetting to step 1`);
        
        dispatch(resetBookingFlow());
        
        // Clear any Firestore booking data for non-step 5
        await updateDoc(userDocRef, {
          booking: null,
        });
        
        return { 
          success: false, 
          message: `Booking not in step=5 (found step=${booking.step}), reset to step 1`,
          step: 1
        };
      }
    } catch (err) {
      console.error("[loadBookingDetails] Error loading booking details:", err);
      
      // Get the current step from Redux state
      const errorState = getState() as RootState;
      const currentBookingStep = errorState.booking.step;
      
      // If we're already at step 5, preserve that state despite the error
      if (currentBookingStep === 5) {
        console.log("[loadBookingDetails] Already at step 5 in Redux, preserving state despite error");
        return {
          success: true,
          message: "Error loading from Firestore, but preserved step 5 state",
          step: 5
        };
      }
      
      // Otherwise reset to step 1 for safety
      dispatch(resetBookingFlow());
      
      return {
        success: false,
        message: "Failed to load booking details (thunk caught error).",
      };
    }
  }
);

/**
 * finalizeBooking:
 * Creates a formal booking record in the 'bookings' collection and links it to the user.
 * This is normally called after a successful payment, or when reaching step 5.
 */
export const finalizeBooking = createAsyncThunk<
  BookingThunkResult & { bookingId?: string },
  void
>(
  "booking/finalizeBooking",
  async (_, { getState, dispatch }) => {
    try {
      const state = getState() as RootState;
      const user = state.user.authUser;
      if (!user) {
        console.warn("[finalizeBooking] User not signed in; cannot finalize booking.");
        return {
          success: false,
          message: "User not signed in; cannot finalize booking.",
        };
      }

      // Extract booking data from state
      const {
        departureStationId,
        arrivalStationId,
        departureDateString,
        departureTimeString,
        isDateTimeConfirmed,
        selectedCarId,
        selectedCar,
        route,
        isQrScanStation,
        qrVirtualStationId,
        ticketPlan,
        estimatedCost,
        paymentStatus,
        paymentReference,
        bookingId: existingBookingId,
      } = state.booking;

      // Basic validation
      if (!departureStationId || !arrivalStationId || !departureDateString || !departureTimeString) {
        return {
          success: false,
          message: "Missing required booking information.",
        };
      }

      if (!selectedCarId || !selectedCar) {
        return {
          success: false,
          message: "No car selected for booking.",
        };
      }

      // If we already have a booking ID, fetch it to see if it exists
      if (existingBookingId) {
        const existingBookingRef = doc(db, "bookings", existingBookingId);
        const existingBookingSnap = await getDoc(existingBookingRef);

        // If the booking exists, just return success
        if (existingBookingSnap.exists()) {
          console.log(`[finalizeBooking] Booking already exists with ID: ${existingBookingId}`);
          return {
            success: true,
            message: "Booking already finalized.",
            bookingId: existingBookingId,
          };
        }
      }

      // Create API call parameters
      const bookingData = {
        userId: user.uid,
        carId: selectedCarId,
        carName: selectedCar.name,
        carType: selectedCar.type,
        carImage: selectedCar.image,
        carModelUrl: selectedCar.modelUrl,
        departureStationId,
        arrivalStationId,
        departureDateString,
        departureTimeString,
        isDateTimeConfirmed,
        isQrScanStation,
        qrVirtualStationId,
        ticketPlan,
        amount: estimatedCost || 0,
        distance: route?.distance,
        duration: route?.duration,
        polyline: route?.polyline,
      };

      // Call the bookings API endpoint
      // Get the user's Firebase ID token
      // Note: user is likely from Firebase Auth and may not have getIdToken directly
      // We need to get the token from Firebase Auth
      let token = '';
      try {
        // Import Firebase auth if needed
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        const currentUser = auth.currentUser;
        if (currentUser) {
          token = await currentUser.getIdToken();
        } else {
          console.warn('[finalizeBooking] No current Firebase user found');
        }
      } catch (err) {
        console.error('[finalizeBooking] Error getting auth token:', err);
      }
      
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add authorization header if we have a token
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(bookingData),
      });

      const result = await response.json();

      if (!result.success) {
        console.error("[finalizeBooking] API Error:", result);
        return {
          success: false,
          message: result.error || "Failed to create booking",
        };
      }

      // Store the new bookingId in Redux
      dispatch(setBookingId(result.bookingId));

      // Update booking state in Firestore as well
      await dispatch(saveBookingDetails());

      return {
        success: true,
        bookingId: result.bookingId,
        message: "Booking successfully finalized",
      };
    } catch (err) {
      console.error("[finalizeBooking] Error:", err);
      return {
        success: false,
        message: "Failed to finalize booking (thunk caught error).",
      };
    }
  }
);

/**
 * completeBooking:
 * Marks a booking as completed, moves it to the user's booking history,
 * and resets the current booking state to step 1.
 */
export const completeBooking = createAsyncThunk<
  BookingThunkResult,
  void
>(
  "booking/completeBooking",
  async (_, { getState, dispatch }) => {
    try {
      const state = getState() as RootState;
      const user = state.user.authUser;
      const { bookingId } = state.booking;

      if (!user) {
        console.warn("[completeBooking] User not signed in; cannot complete booking.");
        return {
          success: false,
          message: "User not signed in; cannot complete booking.",
        };
      }

      if (!bookingId) {
        console.warn("[completeBooking] No booking ID found; cannot complete booking.");
        return {
          success: false,
          message: "No booking ID found; cannot complete booking.",
        };
      }

      // 1. Update the booking record to 'completed'
      const bookingRef = doc(db, "bookings", bookingId);
      const bookingSnap = await getDoc(bookingRef);

      if (!bookingSnap.exists()) {
        console.error(`[completeBooking] Booking ${bookingId} not found`);
        return {
          success: false,
          message: "Booking not found",
        };
      }

      const bookingData = bookingSnap.data() as FirestoreBooking;
      const now = new Date().toISOString();

      // Update the booking status
      await updateDoc(bookingRef, {
        status: "completed",
        completedAt: now,
        updatedAt: now,
      });

      // 2. Add to user's booking history
      const historyRef = collection(db, `users/${user.uid}/bookingHistory`);
      const historyRecord: BookingHistoryRecord = {
        bookingId,
        userId: user.uid,
        status: "completed",
        carId: bookingData.carId,
        carName: bookingData.carName,
        carType: bookingData.carType,
        departureStationId: bookingData.departureStationId,
        departureStationName: bookingData.departureStationName,
        arrivalStationId: bookingData.arrivalStationId,
        arrivalStationName: bookingData.arrivalStationName,
        departureDateString: bookingData.departureDateString,
        departureTimeString: bookingData.departureTimeString,
        amount: bookingData.amount,
        currency: bookingData.currency,
        ticketPlan: bookingData.ticketPlan,
        createdAt: bookingData.createdAt,
        completedAt: now,
      };

      await addDoc(historyRef, historyRecord);

      // 3. Clear the active booking in the user document
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        booking: null,
        updatedAt: now,
      });

      // 4. Reset the Redux booking state
      dispatch(resetBookingFlow());

      return {
        success: true,
        message: "Booking completed successfully",
      };
    } catch (err) {
      console.error("[completeBooking] Error:", err);
      return {
        success: false,
        message: "Failed to complete booking (thunk caught error).",
      };
    }
  }
);