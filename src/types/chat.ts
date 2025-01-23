// src/store/chat.ts

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';   // your store definition
import { addMessage as addMsg, clearChat as clearAllMsgs } from './chat'; 
// ^ If you keep everything in one file, remove these lines or rename them as needed

/*
|-------------------------------------------------
| 1) Type Definitions
|-------------------------------------------------
*/

// "MessageRole", "ReactionType" - optional enumerations
export type MessageRole = 'user' | 'assistant' | 'system';
export type ReactionType = '👍' | '👎' | '❤️' | '😄' | '❓';

/** Reaction object for likes, thumbs up, etc. */
export interface Reaction {
  type: string;
  timestamp: Date;
}

/** Basic structure of an attachment */
export interface Attachment {
  name: string;
  type: string;  // e.g. "image/png", "application/pdf", etc.
  url: string;
}

/** Core chat message type */
export interface Message {
  id: string;
  role: MessageRole;             // 'user' | 'assistant' | 'system'
  content: string;
  timestamp: Date;
  reactions: Reaction[];
  attachments: Attachment[];
}

/*
|-------------------------------------------------
| 2) Thunk: sendMessageToClaude
|-------------------------------------------------
|
| Accepts a user message & optional context message.
| - Prepend context if present, then append user message.
| - Calls your /api/chat endpoint, merges extra data from user/booking slices
|
*/
export const sendMessageToClaude = createAsyncThunk<
  { assistantMessage: Message },
  { userMessage: Message; contextMessage?: Message },
  { state: RootState }
>(
  'chat/sendMessageToClaude',
  async ({ userMessage, contextMessage }, { getState, dispatch, rejectWithValue }) => {
    try {
      // 1) Grab existing messages from chat state
      const state = getState();
      const existingMessages = state.chat.messages;

      // 2) Construct conversation array from existing messages
      const conversation = [...existingMessages];

      // 3) If we have a context message (system-like), prepend it
      if (contextMessage) {
        conversation.push(contextMessage);
      }

      // 4) Append the new user message
      conversation.push(userMessage);

      // 5) Immediately add the user message to Redux so UI updates
      dispatch(addMessage(userMessage));

      // (Optional) Example references to user & booking slices
      const selectedCarId = state.user.selectedCarId;
      const stepName = state.booking.stepName;

      // If you want more details about the car, you can fetch them from a carSlice
      // or from an array in the store. For brevity, let's just do a placeholder:
      const selectedCar = selectedCarId
        ? {
            id: selectedCarId,
            name: 'MG 4 Electric',
            type: 'Electric',
            price: 600,
            features: {
              range: '300',
              charging: 'Fast charging',
              acceleration: '0-60 in 3.1s',
            },
          }
        : undefined;

      // 6) POST to your /api/chat endpoint with conversation & relevant data
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversation,
          selectedCar,
          currentBookingStep: stepName, // or booking.step, if you store numeric steps
        }),
      });

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      // 7) Parse the assistant's reply from JSON
      const data = await response.json();
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message ?? '',
        timestamp: new Date(),
        reactions: [],
        attachments: [],
      };

      // Return the new assistant message to be added to the store
      return { assistantMessage };
    } catch (error: any) {
      return rejectWithValue(error.message ?? 'Unknown error occurred');
    }
  }
);

/*
|-------------------------------------------------
| 3) chatSlice
|-------------------------------------------------
|
| Holds an array of messages, plus loading/error states.
| The thunk above dispatches a new assistant message upon success.
|
*/
interface ChatState {
  messages: Message[];
  loading: boolean;
  error: string | null;
}

const initialState: ChatState = {
  messages: [],
  loading: false,
  error: null,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    // Generic action to add any message (user or assistant)
    addMessage: (state, action: PayloadAction<Message>) => {
      state.messages.push(action.payload);
    },
    // Clear chat
    clearChat: (state) => {
      state.messages = [];
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendMessageToClaude.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(sendMessageToClaude.fulfilled, (state, action) => {
        state.loading = false;
        // The new assistant message from the thunk
        state.messages.push(action.payload.assistantMessage);
      })
      .addCase(sendMessageToClaude.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

/*
|-------------------------------------------------
| 4) Exports
|-------------------------------------------------
*/

export const { addMessage, clearChat } = chatSlice.actions;
export default chatSlice.reducer;

/* -------------------- Selectors -------------------- */
export const selectMessages = (state: RootState) => state.chat.messages;
export const selectLoading = (state: RootState) => state.chat.loading;
export const selectError = (state: RootState) => state.chat.error;
