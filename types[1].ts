
export enum Role {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface RagSource {
  title: string;
  snippet: string;
  relevance: number;
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  timestamp: number;
  image?: {
    data: string; // base64
    mimeType: string;
  };
  groundingUrls?: GroundingChunk[];
  sources?: RagSource[];
}

export interface ChatSession {
  id: string;
  messages: Message[];
  title: string;
}
