export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  timestamp: number;
  tokens?: number;
  generationTime?: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  totalTokens: number;
}

export interface Settings {
  apiKey: string;
  apiUrl: string;
  temperature: number;
  maxTokens: number;
}

export interface ChatRequestMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatRequestMessage[];
  temperature: number;
  max_tokens: number;
  stream: boolean;
}
