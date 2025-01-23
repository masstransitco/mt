import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';
import { Message } from '@/types/booking';

/**
 * Thunk action for sending a message to Claude,
 * optionally including a `contextMessage` from the ChatWidget.
 */
export const sendMessageToClaude = createAsyncThunk<
  { assistantMessage: Message },
  { userMessage: Message; contextMessage?: Message },
  { state: RootState }
>(
  'chat/sendMessageToClaude',
  async ({ userMessage, contextMessage }, { getState, dispatch, rejectWithValue }) => {
    try {
      const state = getState();
      const existingMessages = state.chat.messages;

      // 1) Construct the conversation from existing messages
      const conversation = [...existingMessages];

      // 2) If we have a context/system message, prepend it
      if (contextMessage) {
        conversation.push(contextMessage);
      }

      // 3) Append the new user message
      conversation.push(userMessage);

      // 4) Immediately store the user message in Redux
      dispatch(addMessage(userMessage));

      // Example data from user/booking slices
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

      // 5) Send conversation + store data to /api/chat
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

      // 6) Parse the LLM's assistant message
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
      // Pass the error message back to the reducer
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

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    // Add any message (user or assistant) to Redux
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
        // LLM's response from the thunk
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
