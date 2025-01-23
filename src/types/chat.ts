// src/types/chat.ts

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date; // or Date | undefined if you truly need it optional
  reactions: Reaction[];
  attachments: Attachment[];
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
