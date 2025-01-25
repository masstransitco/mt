import { Anthropic } from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const anthropic = new Anthropic({
  apiKey: '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'
});

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const messages = body.messages
      .slice(-6)
      .filter((msg: Message) => ['user', 'assistant'].includes(msg.role))
      .map((msg: Message) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));

    if (body.selectedCar || body.currentBookingStep) {
      messages.unshift({
        role: 'user',
        content: `Context: ${body.selectedCar ? 
          `${body.selectedCar.name}, ${body.selectedCar.type}, $${body.selectedCar.price}/day` : 
          ''} ${body.currentBookingStep || ''}`
      });
    }

    const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 1024,
      system: "You are a helpful car-rental assistant. Keep responses concise.",
      messages
    });

    return NextResponse.json({
      message: response.content[0].text,
      role: 'assistant'
    });

  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
