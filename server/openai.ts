export function getOpenAIModelsToTry(): string[] {
  // Read after dotenv has loaded; this module is imported before server startup.
  return [...new Set([process.env.OPENAI_MODEL, 'gpt-4o-mini', 'gpt-4o']
    .filter((model): model is string => Boolean(model?.trim()))
    .map((model) => model.trim()))];
}

export function getAIClient(): string | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  return apiKey || null;
}

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  error?: { message?: string };
};

function extractText(data: OpenAIChatResponse): string {
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();
  }
  return '';
}

export async function generateContentWithFallback(
  apiKey: string,
  params: { contents: string; config?: Record<string, any> },
): Promise<{ text: string }> {
  const systemInstruction =
    typeof params.config?.systemInstruction === 'string'
      ? params.config.systemInstruction
      : '';
  const wantsJson = params.config?.responseMimeType === 'application/json';

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push({ role: 'user', content: params.contents });

  let lastError: unknown = null;
  for (const modelName of getOpenAIModelsToTry()) {
    try {
      const body: Record<string, unknown> = {
        model: modelName,
        messages,
      };
      if (wantsJson) {
        body.response_format = { type: 'json_object' };
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as OpenAIChatResponse;
      if (!response.ok) {
        lastError = new Error(
          data.error?.message || `OpenAI ${modelName} failed (${response.status})`
        );
        continue;
      }

      const text = extractText(data);
      if (text) {
        return { text };
      }
      lastError = new Error(`OpenAI ${modelName} returned no text.`);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('All configured OpenAI models failed to return text.');
}

export function missingApiKeyResponse() {
  return {
    error:
      'OPENAI_API_KEY is not configured. Set it in .env.local or in the hosting environment.',
  };
}
