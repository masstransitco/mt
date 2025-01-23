import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';
import { Message } from '@/types/booking';
import { addMessage, clearChat } from './chatSlice'; // We'll define addMessage below

/**
 * Thunk action for sending a message to Claude,
 * optionally including a `contextMessage` from the ChatWidget.
 */
export const sendMessageToClaude = createAsyncThunk<
  { assistantMessage: Message },
  { userMessage: Message; contextMessage?: Message },  // <-- updated to accept contextMessage
  { state: RootState }
>(
  'chat/sendMessageToClaude',
  async ({ userMessage, contextMessage }, { getState, dispatch, rejectWithValue }) => {
    try {
      const state = getState();
      const existingMessages = state.chat.messages;

      // 1) Construct the conversation array from existing messages.
      const conversation = [...existingMessages];

      // 2) If we have a context/system message, prepend it before the user message
      if (contextMessage) {
        conversation.push(contextMessage);
      }

      // 3) Append the new user message
      conversation.push(userMessage);

      // 4) Immediately store the user message in Redux so we can see it in the UI
      dispatch(addMessage(userMessage));

      // (Optional) Example logic retrieving extra data from the store
      // e.g., selected car and current booking step
      const selectedCar = state.user.selectedCarId
        ? {
            id: 1,
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

      const currentBookingStep = state.booking.stepName;

      // 5) Send the conversation, selectedCar, and booking info to your backend
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversation,
          selectedCar,
          currentBookingStep,
        }),
      });

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      // 6) Parse the assistant's reply
      const data = await response.json();
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message ?? '',
        timestamp: new Date(),
        reactions: [],
        attachments: [],
      };

      // Return the new assistant message
      return { assistantMessage };
    } catch (error: any) {
      return rejectWithValue(error.message ?? 'Unknown error occurred');
    }
  }
);

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

/**
 * chatSlice: Stores an array of messages (both user & assistant).
 * A thunk, `sendMessageToClaude`, calls your API for the next assistant reply.
 */
const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    // Add any message (user or assistant) to Redux state
    addMessage: (state, action: PayloadAction<Message>) => {
      state.messages.push(action.payload);
    },
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
        // The new assistant message is returned from the thunk
        state.messages.push(action.payload.assistantMessage);
      })
      .addCase(sendMessageToClaude.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { addMessage, clearChat } = chatSlice.actions;
export default chatSlice.reducer;

/* -------------------- Selectors -------------------- */
export const selectMessages = (state: RootState) => state.chat.messages;
export const selectLoading = (state: RootState) => state.chat.loading;
export const selectError = (state: RootState) => state.chat.error;
