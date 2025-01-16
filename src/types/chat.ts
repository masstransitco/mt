export type MessageRole = 'user' | 'assistant' | 'system';
export type ReactionType = '👍' | '👎' | '❤️' | '😄' | '❓';

export interface Reaction {
  type: string;
  timestamp: Date;
}

export interface Message {
  id: string;       // <-- Required if you're using uuid
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  reactions: Reaction[];
  attachments: Attachment[]; 
}

export interface Attachment {
  name: string;
  type: string;     // <-- Required
  url: string;
}



