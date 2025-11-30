import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

// Helper for audio encoding
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper for audio decoding
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export const translateText = async (text: string, targetLang: 'Russian' | 'English'): Promise<string> => {
  if (!process.env.API_KEY) throw new Error("API Key missing");
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Translate the following text to ${targetLang}. 
  If translating to Russian, provide the Cyrillic text followed by a phonetic pronunciation in brackets.
  If translating to English, just provide the text.
  Keep it natural and conversational for a family setting.
  
  Text: "${text}"`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  return response.text || "Translation failed.";
};

export const createLiveSession = async (
  onAudioData: (buffer: AudioBuffer) => void,
  onClose: () => void,
  outputAudioContext: AudioContext
) => {
  if (!process.env.API_KEY) throw new Error("API Key missing");

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const config = {
    responseModalities: [Modality.AUDIO],
    speechConfig: {
      voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
    },
    systemInstruction: "You are a helpful assistant helping a user test their audio and internet connection. Keep responses short, encouraging, and clear. Confirm you can hear them well.",
  };

  let nextStartTime = 0;

  const session = await ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    config,
    callbacks: {
      onopen: () => {
        console.log("Gemini Live Session Opened");
      },
      onmessage: async (message: LiveServerMessage) => {
        const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
           // Decode and play audio
           const audioData = decode(base64Audio);
           // Simple decoding wrapper since we are in a browser context
           // We need to decode PCM to AudioBuffer. 
           // For simplicity in this demo, we assume the API returns raw PCM and we might need to wrap it.
           // However, standard Live API output is PCM. Let's use a helper to create buffer.
           
           // Note: Actual decoding of raw PCM to AudioBuffer requires knowledge of sample rate.
           // Live API typically 24000Hz.
           const dataInt16 = new Int16Array(audioData.buffer);
           const buffer = outputAudioContext.createBuffer(1, dataInt16.length, 24000);
           const channelData = buffer.getChannelData(0);
           for(let i=0; i<dataInt16.length; i++) {
             channelData[i] = dataInt16[i] / 32768.0;
           }
           
           onAudioData(buffer);
        }
      },
      onclose: () => {
        console.log("Session closed");
        onClose();
      },
      onerror: (err) => {
        console.error("Session error", err);
        onClose();
      }
    }
  });

  return session;
};

// Helper to create the blob payload for sending audio to Gemini
export function createAudioPayload(data: Float32Array): { data: string; mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = Math.max(-1, Math.min(1, data[i])) * 32767; // Clamp and scale
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}