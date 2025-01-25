import { Anthropic, HUMAN_PROMPT, AI_PROMPT } from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const anthropic = new Anthropic({
  apiKey: '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',
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

    // 1. Build the "system" instruction string.
    let systemMessage = `
You are a helpful car-rental assistant.
The user can select a vehicle, pick a station, confirm a date/time,
then must verify ID/license and pay to finalize the booking.
Keep a friendly, concise tone.
    `.trim();

    // Add car info if relevant
    if (body.selectedCar) {
      const car = body.selectedCar;
      systemMessage += `
The user is currently viewing the ${car.name}, 
which is ${car.type} at $${car.price}/day,
featuring ${car.features.range} range, 
${car.features.charging} charging,
and ${car.features.acceleration} acceleration.
      `.trim();
    }

    // Add booking step if relevant
    if (body.currentBookingStep) {
      systemMessage += `\nThe user is currently at booking step: ${body.currentBookingStep}.`;
    }

    // 2. Take only the last N messages to avoid large prompts
    const recentMessages = body.messages.slice(-6);

    // 3. Convert your conversation into a single string prompt
    // following Anthropic’s recommended prompt format:
    //
    //  "[system instructions]
    //   \n\nHuman: [user message]
    //   \n\nAssistant: [assistant message]
    //   \n\nHuman: ...
    //   \n\nAssistant:"
    //
    // We'll place systemMessage at the start, then iterate through user/assistant messages.

    let prompt = `${systemMessage}\n\n`; // start with system instructions

    for (const msg of recentMessages) {
      if (msg.role === 'assistant') {
        // Assistant lines use the Anthropic AI_PROMPT special string
        prompt += `Assistant:${AI_PROMPT} ${msg.content}\n\n`;
      } else if (msg.role === 'user') {
        // User lines use the Anthropic HUMAN_PROMPT special string
        prompt += `Human:${HUMAN_PROMPT} ${msg.content}\n\n`;
      }
      // We'll ignore 'system' role in the middle of conversation for simplicity,
      // since we combined system text at the top.
    }

    // Finally, prepare for the next assistant answer:
    prompt += `Assistant:${AI_PROMPT}`;

    // 4. Call the Anthropic completions endpoint
    const response = await anthropic.completions.create({
      model: 'claude-2',        // or e.g. "claude-2-100k"
      max_tokens_to_sample: 1024,
      temperature: 0.7,
      prompt,
    });

    // 5. The returned text is in response.data.completion
    if (!response.completion) {
      throw new Error('No completion text found in Anthropic response');
    }

    return NextResponse.json({
      message: response.completion.trim(),
      role: 'assistant',
    });
  } catch (error: any) {
    console.error('Chat API Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to process chat request',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
