import { Anthropic } from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY || 'your-key-here',
});

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface CarFeature {
  id: number;
  name: string;
  type: string;
  price: number;
  features: {
    range: string;
    charging: string;
    acceleration: string;
  };
}

interface ChatRequestBody {
  messages: ChatMessage[];
  selectedCar?: CarFeature;
  currentBookingStep?: string; // can guide Claude about the next step
}

/**
 * POST /api/chat
 * Receives user+assistant messages, optional car info, booking step.
 * Calls Anthropic to generate a chat response.
 */
export async function POST(request: Request) {
  try {
    const body: ChatRequestBody = await request.json();

    if (!body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json({ error: 'Invalid messages array' }, { status: 400 });
    }

    // Only take the last N messages to avoid token limit issues
    const recentMessages = body.messages.slice(-5);

    // Base system message
    let systemMessage = `
      You are a helpful car-rental assistant. 
      The user can select a vehicle, pick a station, confirm a date/time,
      then must verify ID/license and pay to finalize the booking.
      Keep a friendly, concise tone.
    `;

    // If the user selected a car, add details to the system context
    if (body.selectedCar) {
      systemMessage += `
        The user is currently viewing the ${body.selectedCar.name}, 
        which is ${body.selectedCar.type} at $${body.selectedCar.price}/day,
        featuring ${body.selectedCar.features.range} range, 
        ${body.selectedCar.features.charging} charging, 
        and ${body.selectedCar.features.acceleration} acceleration.
      `;
    }

    // If there's a booking step, mention it
    if (body.currentBookingStep) {
      systemMessage += `\nThe user is currently at booking step: ${body.currentBookingStep}.`;
    }

    // Filter user+assistant messages to pass along
    const validMessages = recentMessages
      .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
      .map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

    // Make the request to Anthropic
    const response = await anthropic.messages.create({
      model: 'claude-2',
      max_tokens: 1024,
      temperature: 0.7,
      messages: validMessages,
      system: systemMessage,
    });

    if (!response.content?.[0]?.text) {
      throw new Error('Invalid response from Anthropic API');
    }

    return NextResponse.json({
      message: response.content[0].text,
      role: 'assistant',
    });
  } catch (error: any) {
    console.error('Chat API Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to process chat request',
        details: error.message ?? 'Unknown error',
      },
      { status: 500 }
    );
  }
}
