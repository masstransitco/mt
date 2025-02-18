"use client";

import React, { useState, useCallback } from "react";
import { X } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/store";

// chatSlice
import { sendMessageToClaude, selectMessages } from "@/store/chatSlice";
import { Message } from "@/types/chat";

// bookingSlice (now has station IDs)
import {
  selectDepartureStationId,
  selectArrivalStationId,
  selectBookingStep,
  selectDepartureDate,
} from "@/store/bookingSlice";

// userSlice (if storing selectedCarId or other user-specific state)
import { selectViewState } from "@/store/uiSlice";
import { RootState } from "@/store/store";

export default function ChatWidget() {
  const dispatch = useAppDispatch();
  const messages = useAppSelector(selectMessages);

  // Gather store context
  const bookingStep = useAppSelector(selectBookingStep);
  const departureDate = useAppSelector(selectDepartureDate);
  const viewState = useAppSelector(selectViewState);

  // If you store the chosen car in user slice, keep it:
  // (Adapt to your actual user slice or booking slice)
  const selectedCarId = useAppSelector((state: RootState) => state.user.selectedCarId);

  // Station IDs are now from the booking slice
  const departureStationId = useAppSelector(selectDepartureStationId);
  const arrivalStationId = useAppSelector(selectArrivalStationId);

  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState("");

  const buildContextMessage = useCallback((): Message => {
    const contextContent = `
You are Claude, a helpful car rental assistant.

Context:
- Current UI view: ${viewState}
- Selected Car ID: ${selectedCarId ?? "None"}
- Departure Station ID: ${departureStationId ?? "None"}
- Arrival Station ID: ${arrivalStationId ?? "None"}
- Booking Step: ${bookingStep}
- Departure Date: ${departureDate ? departureDate.toString() : "Not set"}

Company Policies:
1) ...
2) ...
3) ...
Please be concise, consistent, and follow brand guidelines.
`;

    return {
      id: `system-context-${Date.now()}`,
      role: "system",
      content: contextContent,
      timestamp: new Date(),
      reactions: [],
      attachments: [],
    };
  }, [viewState, selectedCarId, departureStationId, arrivalStationId, bookingStep, departureDate]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: inputText,
      timestamp: new Date(),
      reactions: [],
      attachments: [],
    };

    const contextMessage = buildContextMessage();
    dispatch(sendMessageToClaude({ userMessage, contextMessage }));
    setInputText("");
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
                if (e.key === "Enter") handleSend();
              }}
              placeholder="Type your message..."
            />
            <button className="bg-primary text-white px-3 py-2 rounded" onClick={handleSend}>
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
