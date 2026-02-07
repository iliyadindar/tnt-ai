export interface Message {
  id: string;
  type: 'user' | 'assistant';
  audioUri?: string;
  transcript?: string;
  translation?: string;
  detectedLanguage?: string;
  targetLanguage: string;
  timestamp: number;
  isLoading?: boolean;
  error?: string;
}

export interface Session {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface TranscriptionResponse {
  transcript: string;
  translation: string;
  lang?: string;
  source_lang?: string;
}
