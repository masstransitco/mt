import { Anthropic } from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const anthropic = new Anthropic({
  apiKey: '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'
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
  currentBookingStep?: string;
}

export async function POST(request: Request) {
  try {
    const body: ChatRequestBody = await request.json();

    if (!body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json({ error: 'Invalid messages array' }, { status: 400 });
    }

    // Build the system message
    const systemMessage = {
      role: 'system',
      content: `You are a helpful car-rental assistant. The user can select a vehicle, pick a station, confirm a date/time, then must verify ID/license and pay to finalize the booking. Keep a friendly, concise tone.
      ${body.selectedCar ? `The user is viewing the ${body.selectedCar.name}, which is ${body.selectedCar.type} at $${body.selectedCar.price}/day, featuring ${body.selectedCar.features.range} range, ${body.selectedCar.features.charging} charging, and ${body.selectedCar.features.acceleration} acceleration.` : ''}
      ${body.currentBookingStep ? `The user is at booking step: ${body.currentBookingStep}.` : ''}`
    };

    // Take recent messages and format for the API
    const recentMessages = body.messages.slice(-6).map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 1024,
      temperature: 0.7,
      messages: [systemMessage, ...recentMessages]
    });

    if (!response.content[0].text) {
      throw new Error('No message content found in Anthropic response');
    }

    return NextResponse.json({
      message: response.content[0].text,
      role: 'assistant'
    });

  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process chat request',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
