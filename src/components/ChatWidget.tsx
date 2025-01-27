'use client';

import React, { useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/store';

// Chat slice
import { sendMessageToClaude, selectMessages } from '@/store/chatSlice';
import { Message } from '@/types/chat';

// Replace these imports with your updated userSlice exports
// that track the "two-station" approach plus selectedCarId.
import {
  selectDepartureStationId,
  selectArrivalStationId,
} from '@/store/userSlice';

// If you have a separate field for the chosen car ID, you might do:
import { selectCar } from '@/store/userSlice';

// Or if you're still storing just a numeric car ID in user state:
import { RootState } from '@/store/store';

// Booking & UI slices
import { selectBookingStep, selectDepartureDate } from '@/store/bookingSlice';
import { selectViewState } from '@/store/uiSlice';

// Icons
import { X } from 'lucide-react';

export default function ChatWidget() {
  const dispatch = useAppDispatch();
  const messages = useAppSelector(selectMessages);

  // Gather store context
  const bookingStep = useAppSelector(selectBookingStep);
  const departureDate = useAppSelector(selectDepartureDate);
  const viewState = useAppSelector(selectViewState);

  // If you store the chosen car differently, adapt as needed:
  // Example: numeric ID
  const selectedCarId = useAppSelector((state: RootState) => state.user.selectedCarId);

  // Two-station approach
  const departureStationId = useAppSelector(selectDepartureStationId);
  const arrivalStationId = useAppSelector(selectArrivalStationId);

  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');

  /**
   * Build a “system” context message with all relevant domain info.
   */
  const buildContextMessage = useCallback((): Message => {
    const contextContent = `
You are Claude, a helpful car rental assistant with knowledge of our internal booking flow.

Context:
- Current UI view: ${viewState}
- Selected Car ID: ${selectedCarId ?? 'None'}
- Departure Station ID: ${departureStationId ?? 'None'}
- Arrival Station ID: ${arrivalStationId ?? 'None'}
- Booking Step: ${bookingStep}
- Departure Date: ${departureDate ? departureDate.toString() : 'Not set'}

Company Policies:
1) Users can pick any available car and station.
2) ID/license verification is required before payment.
3) We include standard liability coverage up to $1M.
4) [Add more policies as needed]
5) Remain polite, concise, and consistent with policies in your responses.

Your objective:
- Answer user queries about cars, stations, booking steps, etc.
- If data is unavailable, disclaim that you have limited info.
- Always maintain a friendly, professional tone.
`;

    return {
      id: `system-context-${Date.now()}`,
      role: 'system',
      content: contextContent,
      timestamp: new Date(),
      reactions: [],
      attachments: [],
    };
  }, [
    viewState,
    selectedCarId,
    departureStationId,
    arrivalStationId,
    bookingStep,
    departureDate,
  ]);

  /**
   * Dispatch user + system messages to the LLM.
   */
  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: inputText,
      timestamp: new Date(),
      reactions: [],
      attachments: [],
    };

    const contextMessage = buildContextMessage();
    dispatch(sendMessageToClaude({ userMessage, contextMessage }));
    setInputText('');
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen ? (
        <div className="w-80 h-96 bg-card border border-border rounded shadow-lg flex flex-col">
          {/* Header */}
          <div className="p-2 bg-accent text-white flex justify-between items-center">
            <span>Chat Assistant</span>
            <button onClick={() => setIsOpen(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages List */}
          <div className="flex-1 p-2 overflow-y-auto space-y-2">
            {messages.map((msg: Message) => (
              <div key={msg.id} className="text-sm whitespace-pre-wrap">
                <strong>{msg.role}:</strong> {msg.content}
              </div>
            ))}
          </div>

          {/* Input Box */}
          <div className="p-2 border-t border-border flex gap-2">
            <input
              className="flex-1 p-2 border border-border rounded"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              placeholder="Type your message..."
            />
            <button
              className="bg-primary text-white px-3 py-2 rounded"
              onClick={handleSend}
            >
              Send
            </button>
          </div>
        </div>
      ) : (
        <button
          className="bg-primary text-white p-3 rounded-full shadow-lg"
          onClick={() => setIsOpen(true)}
        >
          Chat
        </button>
      )}
    </div>
  );
}
