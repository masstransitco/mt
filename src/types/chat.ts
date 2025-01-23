export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;  // or Date | undefined, depending on your usage
  reactions: Reaction[];
  attachments: Attachment[];
}

interface Reaction {
  type: string;
  timestamp: Date;
}

interface Attachment {
  name: string;
  type: string;
  url: string;
}
