import { GoogleGenAI } from '@google/genai';

export const GEMINI_MODELS_TO_TRY = [
  process.env.GEMINI_MODEL,
  'gemini-2.5-flash',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
].filter((m): m is string => Boolean(m && m.trim()));

export function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function generateContentWithFallback(
  ai: GoogleGenAI,
  params: { contents: string; config?: Record<string, any> },
) {
  let lastError: unknown = null;
  for (const modelName of GEMINI_MODELS_TO_TRY) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: params.contents,
        config: params.config,
      });
      if (typeof response.text === 'string' && response.text.trim()) {
        return response;
      }
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('All configured Gemini models failed to return text.');
}

export function missingApiKeyResponse() {
  return {
    error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
  };
}
