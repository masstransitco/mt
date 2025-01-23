'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import {
  sendMessageToClaude,
  selectMessages,
} from '@/store/chatSlice';

// Import any relevant slices whose data you want to provide as context
import { selectSelectedCarId, selectSelectedStationId } from '@/store/userSlice';
import { selectBookingStep, selectDepartureDate } from '@/store/bookingSlice';
import { selectViewState } from '@/store/uiSlice';

import { Message } from '@/types/booking';
import { X } from 'lucide-react';

export default function ChatWidget() {
  const dispatch = useAppDispatch();
  const messages = useAppSelector(selectMessages);

  // Example: gather store context
  const selectedCarId = useAppSelector(selectSelectedCarId);
  const selectedStationId = useAppSelector(selectSelectedStationId);
  const bookingStep = useAppSelector(selectBookingStep);
  const departureDate = useAppSelector(selectDepartureDate);
  const viewState = useAppSelector(selectViewState);

  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');

  // Build a function to generate a “context message” describing the current app state
  const buildContextMessage = useCallback((): Message => {
    // You can shape this however you want. The goal is for Claude to see your app's context.
    // E.g., if the user is at booking step=2, or they selected a certain car, etc.
    let contextContent = `
System Context:
- Current view: ${viewState}
- Selected Car: ${selectedCarId ?? 'None'}
- Selected Station: ${selectedStationId ?? 'None'}
- Booking Step: ${bookingStep}
- Departure Date: ${departureDate ? departureDate.toString() : 'Not set'}

Company Policies:
1. We allow users to pick any available station or car.
2. ID verification is required before payment step.
3. If user asks about insurance coverage, we follow standard liability policy of up to 1M USD coverage.
4. ... (Include any other policies you want to be enforced)
`;

    // Return as a special “system” role (or “assistant” with system content).
    // The "id" can be random or a fixed placeholder.
    return {
      id: 'system-context-' + Date.now(),
      role: 'system',    // or 'assistant' if your Anthropic integration expects that
      content: contextContent,
      timestamp: new Date(),
      reactions: [],
      attachments: [],
    };
  }, [
    viewState,
    selectedCarId,
    selectedStationId,
    bookingStep,
    departureDate,
  ]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    // The user's new message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: inputText,
      timestamp: new Date(),
      reactions: [],
      attachments: [],
    };

    // Generate a dynamic context message
    const contextMessage = buildContextMessage();

    // Dispatch an action that includes both the user's message and our context
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

          {/* Messages */}
          <div className="flex-1 p-2 overflow-y-auto space-y-2">
            {messages.map((msg) => (
              <div key={msg.id} className="text-sm whitespace-pre-wrap">
                <strong>{msg.role}:</strong> {msg.content}
              </div>
            ))}
          </div>

          {/* Input */}
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
