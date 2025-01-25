import { Anthropic } from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const anthropic = new Anthropic({
  apiKey: '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'
});

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

type AnthropicMessage = {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  messages?: Message[];
  userMessage?: Message;
  contextMessage?: Message;
}

export async function POST(request: Request) {
  try {
    const body: RequestBody = await request.json();
    console.log('Request body:', body);

    let messages: AnthropicMessage[] = [];
    
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
      messages = body.messages.map((msg: Message): AnthropicMessage => ({
        role: msg.role === 'system' ? 'user' : msg.role as 'user' | 'assistant',
        content: msg.content
      }));
    }

    const response = await anthropic.messages.create({
      messages,
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1024
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
