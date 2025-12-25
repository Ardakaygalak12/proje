import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ImageAnalysis } from "../types";

// ❌ env yok
// ✅ direkt sabit API key
const API_KEY = 'AIzaSyAAY-nW4x5mzgb7l1UkGN33JsACV0TlEUI';

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
  }

  async analyzeImage(
    base64Image: string,
    mimeType: string,
    langName: string
  ): Promise<ImageAnalysis> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            {
              text: `Analyze this image in extreme detail.
Provide a concise summary (max 3 sentences), and a list of specific details.
Also, search Google for real-world information about any recognizable objects, landmarks, or products in the image.
IMPORTANT: Respond entirely in the language: ${langName}. Return as JSON.`
            },
            {
              inlineData: {
                data: base64Image,
                mimeType
              }
            }
          ]
        }
      ],
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            details: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["summary", "details"]
        }
      }
    });

    const sources =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    const formattedSources = sources
      .filter((c: any) => c.web)
      .map((c: any) => ({
        title: c.web.title,
        uri: c.web.uri
      }));

    try {
      const data = JSON.parse(response.text || '{}');

      return {
        id: Math.random().toString(36).substring(2, 11),
        summary: data.summary,
        details: data.details,
        sources: formattedSources,
        timestamp: new Date(),
        imageData: `data:${mimeType};base64,${base64Image}`
      };
    } catch (e) {
      console.error("Failed to parse vision response", e);
      throw new Error("Görsel verisi işlenemedi.");
    }
  }

  async generateSpeech(
    text: string,
    voiceName: string = 'Kore'
  ): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName }
          }
        }
      }
    });

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      throw new Error("No audio returned from TTS");
    }

    return base64Audio;
  }

  getLiveSession(
    callbacks: any,
    systemInstruction: string,
    voiceName: string = 'Zephyr'
  ) {
    return this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName }
          }
        },
        systemInstruction,
        outputAudioTranscription: {},
        inputAudioTranscription: {}
      }
    });
  }
}

export const geminiService = new GeminiService();
