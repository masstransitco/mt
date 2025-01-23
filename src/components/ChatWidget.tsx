'use client';

import React, { useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import {
  sendMessageToClaude,
  selectMessages,
} from '@/store/chatSlice';

// Import any relevant slices whose data you want to provide as context
import { selectSelectedCarId, selectSelectedStationId } from '@/store/userSlice';
import { selectBookingStep, selectDepartureDate } from '@/store/bookingSlice';
import { selectViewState } from '@/store/uiSlice';

// IMPORTANT: Use the unified Message type from src/types/chat
import { Message } from '@/types/chat';

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

  /**
   * Build a “system” context message to provide domain/policy info to Claude.
   * You can tailor this to be more or less verbose depending on your needs.
   */
  const buildContextMessage = useCallback((): Message => {
    let contextContent = `
You are Claude, a helpful car rental assistant with knowledge of our internal booking flow.

Key points of context:
- Current UI view: ${viewState}
- Selected Car ID: ${selectedCarId ?? 'None'}
- Selected Station ID: ${selectedStationId ?? 'None'}
- Booking Step: ${bookingStep}
- Departure Date: ${departureDate ? departureDate.toString() : 'Not set'}

**Company Policies**:
1) Users can pick any available car and station.
2) ID/license verification is required before proceeding to payment.
3) Standard liability insurance coverage up to $1M is included.
4) (Add any other relevant disclaimers or policies here).
5) Keep answers helpful, concise, and consistent with these policies.

**Your Objective**:
- Respond to user queries about car availability, station selection, ID verification, insurance coverage, etc.
- If the user requests something outside policy bounds, politely clarify constraints.
- If uncertain about real-time data, disclaim that you have limited info.

Remember: Always adopt a friendly, professional tone and keep responses short unless more detail is requested.
    `;

    // Return as a special “system” role message
    return {
      id: `system-context-${Date.now()}`,
      role: 'system',
      content: contextContent,
      timestamp: new Date(),
      reactions: [],
      attachments: [],
    };
  }, [viewState, selectedCarId, selectedStationId, bookingStep, departureDate]);

  /**
   * Handle sending user message plus system context to the LLM.
   */
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

    // Build a dynamic "system" context message
    const contextMessage = buildContextMessage();

    // Dispatch an action with both userMessage & contextMessage
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
