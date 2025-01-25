import { Anthropic } from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const anthropic = new Anthropic({
  apiKey: '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'
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const response = await anthropic.messages.create({
      messages: [{
        role: 'user',
        content: body.messages[body.messages.length - 1].content
      }],
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1024
    });

    if (!response.content?.[0]?.text) {
      throw new Error('No response content');
    }

    return new NextResponse(
      JSON.stringify({
        message: response.content[0].text,
        role: 'assistant'
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('API Error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Chat processing failed' }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}
