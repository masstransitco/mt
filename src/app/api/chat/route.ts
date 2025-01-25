import { Anthropic } from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const anthropic = new Anthropic({
  apiKey: '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'
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Request body:', body);

    // Handle both single message and message+context formats
    let messages = [];
    if (body.userMessage) {
      if (body.contextMessage) {
        messages = [
          { role: 'user', content: body.contextMessage.content },
          { role: 'user', content: body.userMessage.content }
        ];
      } else {
        messages = [{ role: 'user', content: body.userMessage.content }];
      }
    } else if (body.messages) {
      messages = body.messages.map(msg => ({
        role: msg.role === 'system' ? 'user' : msg.role,
        content: msg.content
      }));
    }

    const response = await anthropic.messages.create({
      messages,
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1024
    });

    console.log('Anthropic response:', response);

    if (!response.content?.[0]?.text) {
      throw new Error('Empty response from Claude');
    }

    return NextResponse.json({
      message: response.content[0].text,
      role: 'assistant'
    });

  } catch (error: any) {
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      body: error.body,
      status: error.status
    });
    
    return NextResponse.json(
      { error: error.message || 'Chat processing failed' },
      { status: 500 }
    );
  }
}
