import type { Express, Request, Response } from 'express';
import { generateContentWithFallback, getAIClient, missingApiKeyResponse } from './gemini.ts';
import { LOOKUP_SYSTEM_INSTRUCTION, buildCompleteSheetSystemInstruction } from './prompts.ts';
import {
  activeWeblinks,
  formatBlindSpots,
  formatCompleteSheetOverridePages,
  formatModifiers,
  formatOverridePages,
  formatWeblinks,
} from './sotContext.ts';

function errorMessage(err: unknown, fallback: string): string {
  return err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
    ? (err as { message: string }).message
    : fallback;
}

async function handleGeminiGenerate(req: Request, res: Response) {
  try {
    const ai = getAIClient();
    if (!ai) {
      return res.status(503).json(missingApiKeyResponse());
    }

    const { prompt, systemInstruction, responseMimeType, urls } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    const hasUrls = Array.isArray(urls) && urls.length > 0;
    const fullContents = hasUrls
      ? `${prompt}\n\nReference URLs to follow:\n${urls.slice(0, 20).join('\n')}`
      : prompt;

    const config: Record<string, any> = {};
    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }
    if (hasUrls) {
      config.tools = [{ urlContext: {} }];
    } else if (responseMimeType) {
      config.responseMimeType = responseMimeType;
    }

    const response = await generateContentWithFallback(ai, {
      contents: fullContents,
      config,
    });

    return res.json({
      text: response.text ?? '',
    });
  } catch (err: unknown) {
    console.error('Gemini /api/gemini/generate error:', err);
    return res.status(500).json({
      error: errorMessage(err, 'Gemini generation failed.'),
    });
  }
}

async function handleGeminiLookup(req: Request, res: Response) {
  try {
    const ai = getAIClient();
    if (!ai) {
      return res.status(503).json(missingApiKeyResponse());
    }

    const {
      query,
      category = 'All',
      modifiers = {},
      sotOverridePages = [],
      sotWeblinks = [],
      characterSummary = '',
    } = req.body || {};

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query is required.' });
    }

    const activeLinks = activeWeblinks(sotWeblinks);
    const overrideContext = formatOverridePages(sotOverridePages);
    const weblinksContext = formatWeblinks(activeLinks, true);
    const modifiersContext = formatModifiers(modifiers);

    const userPrompt = `Primary Lookup Query (from Name field): "${query}"
Requested Category Filter: ${category}
Character Context: ${characterSummary}

=== OTHER FORM FIELDS (USE AS SEARCH MODIFIERS TO REFINE & DISAMBIGUATE) ===
${modifiersContext}

=== STEP 1: PLAYER'S SAVED SOURCE OF TRUTH (SOT) DOCS (CHECK FIRST - OVERRIDES ONLINE DATA) ===
${overrideContext}

=== STEP 2: PLAYER'S SAVED SOT WEBLINKS (CHECK SECOND) ===
${weblinksContext}`;

    const tools: any[] = [{ googleSearch: {} }];
    if (activeLinks.length > 0) {
      tools.push({ urlContext: {} });
    }

    const response = await generateContentWithFallback(ai, {
      contents: userPrompt,
      config: {
        systemInstruction: LOOKUP_SYSTEM_INSTRUCTION,
        tools,
      },
    });

    const rawText = response.text ?? '';
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sourceUrls: Array<{ title: string; uri: string }> = [];

    for (const chunk of groundingChunks as any[]) {
      if (chunk?.web?.uri) {
        sourceUrls.push({
          title: chunk.web.title || chunk.web.uri,
          uri: chunk.web.uri,
        });
      }
    }

    return res.json({
      text: rawText,
      sourceUrls,
    });
  } catch (err: unknown) {
    console.error('Gemini /api/gemini/lookup error:', err);
    return res.status(500).json({
      error: errorMessage(err, 'Gemini online lookup failed.'),
    });
  }
}

async function handleCompleteSheet(req: Request, res: Response) {
  try {
    const ai = getAIClient();
    if (!ai) {
      return res.status(503).json(missingApiKeyResponse());
    }

    const {
      conversation = [],
      characterSummary = '',
      sotOverridePages = [],
      sotWeblinks = [],
      allowedFields = {},
    } = req.body || {};

    const activeLinks = activeWeblinks(sotWeblinks);
    const overrideContext = formatCompleteSheetOverridePages(sotOverridePages);
    const weblinksContext = formatWeblinks(activeLinks);
    const blindSpotsContext = formatBlindSpots(allowedFields);

    const historyFormatted = Array.isArray(conversation)
      ? conversation
          .map((msg: { role?: string; text?: string }) => `${msg.role === 'user' ? 'PLAYER' : 'AI COMPANION'}: ${msg.text}`)
          .join('\n\n')
      : '';

    const userPrompt = `=== CURRENT CHARACTER SHEET STATE ===
${characterSummary}

=== SOURCE OF TRUTH (SOT) OVERRIDE DOCS (CHECK FIRST & HIGHEST PRIORITY) ===
${overrideContext}

=== SOURCE OF TRUTH (SOT) WEBLINKS ===
${weblinksContext}

=== CONVERSATION HISTORY & LATEST PLAYER MESSAGE ===
${historyFormatted || 'PLAYER: Hey, I want to build a new character! What should we make?'}`;

    const response = await generateContentWithFallback(ai, {
      contents: userPrompt,
      config: {
        systemInstruction: buildCompleteSheetSystemInstruction(blindSpotsContext),
        responseMimeType: 'application/json',
      },
    });
    const rawText = response.text ?? '';

    return res.json({
      rawText,
    });
  } catch (err: unknown) {
    console.error('Gemini /api/gemini/complete-sheet error:', err);
    return res.status(500).json({
      error: errorMessage(err, 'Gemini Complete Sheet generation failed.'),
    });
  }
}

async function handleSotFetchReadonlyPage(req: Request, res: Response) {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url.trim())) {
      return res.status(400).json({ error: 'Valid HTTP/HTTPS URL is required.' });
    }

    const targetUrl = url.trim();
    if (/discord(?:app)?\.com\/api\/webhooks|hooks\.slack\.com|webhook/i.test(targetUrl)) {
      return res.status(403).json({
        error: 'Blocked by SOT Security Guard: Webhook URLs are forbidden.',
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'PF1e-Sheet-ReadOnly-SOT-Reader/1.0',
        Accept: 'text/html,text/plain;q=0.9',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const rawHtml = (await response.text()).slice(0, 250000);

    const incidentalLinks: Array<{ url: string; label: string; isWebhookOrSuspicious?: boolean }> = [];
    const seenUrls = new Set<string>();
    const linkRegex = /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(rawHtml)) !== null && incidentalLinks.length < 40) {
      const rawHref = (match[1] || match[2] || '').trim();
      const label = match[3].replace(/<[^>]+>/g, '').trim() || rawHref;
      try {
        const resolved = new URL(rawHref, targetUrl).href;
        if (/^https?:\/\//i.test(resolved) && !seenUrls.has(resolved) && resolved !== targetUrl) {
          seenUrls.add(resolved);
          incidentalLinks.push({
            url: resolved,
            label: label.slice(0, 80),
            isWebhookOrSuspicious: /webhook|discord\.com\/api|slack\.com/i.test(resolved),
          });
        }
      } catch {
        // ignore malformed relative links
      }
    }

    const scriptMatches = rawHtml.match(/<script\b|<iframe\b|\bon[a-z]+\s*=/gi) || [];
    const webhookMatches = rawHtml.match(/webhook|discord\.com\/api\/webhooks/gi) || [];
    const codeMatches = rawHtml.match(/<pre\b|<code\b/gi) || [];

    const sanitizedText = rawHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<head\b[^<]*(?:(?!<\/head>)<[^<]*)*<\/head>/gi, '')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
      .replace(/<\/?(?:p|div|tr|li|h[1-6]|br)\b[^>]*>/gi, '\n')
      .replace(/<\/?(?:td|th)\b[^>]*>/gi, '\t')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 30000);

    return res.json({
      haltedSinglePageOnly: true,
      fetchedAt: Date.now(),
      sanitizedText,
      incidentalLinks,
      securityAudit: {
        isReadOnly: true,
        strippedScriptsCount: scriptMatches.length,
        strippedWebhooksCount: webhookMatches.length,
        strippedCodeSnipsCount: codeMatches.length,
        incidentalLinksCount: incidentalLinks.length,
        sanitizedAt: Date.now(),
      },
    });
  } catch (err: unknown) {
    return res.status(500).json({
      error: errorMessage(err, 'Could not fetch single-page read-only snapshot.'),
    });
  }
}

export function registerApiRoutes(app: Express): void {
  app.post('/api/gemini/generate', handleGeminiGenerate);
  app.post('/api/gemini/lookup', handleGeminiLookup);
  app.post('/api/gemini/complete-sheet', handleCompleteSheet);
  app.post('/api/sot/fetch-readonly-page', handleSotFetchReadonlyPage);
}
