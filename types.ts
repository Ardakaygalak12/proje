
export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  SPEAKING = 'SPEAKING',
  LIVE_CHAT = 'LIVE_CHAT',
  ERROR = 'ERROR',
  SETTINGS = 'SETTINGS',
  HISTORY = 'HISTORY'
}

export type LanguageCode = 'tr-TR' | 'en-US' | 'ru-RU' | 'de-DE';

export interface Language {
  code: LanguageCode;
  name: string;
  flag: string;
  instruction: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ImageAnalysis {
  id: string;
  summary: string;
  details: string[];
  sources?: GroundingSource[];
  timestamp: Date;
  imageData: string;
}
