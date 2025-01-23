// src/types/chat.ts

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date; // or `Date | undefined` if needed
  reactions: any[];
  attachments: any[];
}

export interface Reaction {
  type: string;
  timestamp: Date;
}

export interface Attachment {
  name: string;
  type: string;
  url: string;
}
