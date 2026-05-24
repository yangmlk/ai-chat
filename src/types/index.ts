export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: MessageImage;
  reasoning?: string;
  timestamp: number;
  tokens?: number;
  generationTime?: number;
}

export interface MessageImage {
  dataUrl: string;
  mimeType: string;
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

export interface ChatTextContentPart {
  type: 'text';
  text: string;
}

export interface ChatImageContentPart {
  type: 'image_url';
  image_url: {
    url: string;
  };
}

export type ChatRequestContentPart = ChatTextContentPart | ChatImageContentPart;
export type ChatRequestMessageContent = string | ChatRequestContentPart[];

export interface ChatRequestMessage {
  role: 'user' | 'assistant' | 'system';
  content: ChatRequestMessageContent;
}

export interface ChatRequest {
  model: string;
  messages: ChatRequestMessage[];
  temperature: number;
  max_tokens: number;
  stream: boolean;
}

export interface OutgoingMessagePayload {
  content: string;
  image?: MessageImage;
}
