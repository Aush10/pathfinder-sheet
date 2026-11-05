import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getAIClient(): GoogleGenAI | null {
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // 1. General Server-Side Gemini Text & JSON Generation Route
  app.post('/api/gemini/generate', async (req, res) => {
    try {
      const ai = getAIClient();
      if (!ai) {
        return res.status(503).json({
          error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
        });
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

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: fullContents,
        config,
      });

      return res.json({
        text: response.text ?? '',
      });
    } catch (err: any) {
      console.error('Gemini /api/gemini/generate error:', err);
      return res.status(500).json({
        error: err?.message || 'Gemini generation failed.',
      });
    }
  });

  // 2. Online SRD + Source of Truth (SOT) Weblink & Rich-Text Override Lookup Route
  app.post('/api/gemini/lookup', async (req, res) => {
    try {
      const ai = getAIClient();
      if (!ai) {
        return res.status(503).json({
          error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
        });
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

      const activeLinks = Array.isArray(sotWeblinks)
        ? sotWeblinks
            .filter((l: any) => l && l.isActive && l.url)
            .slice(0, 15)
        : [];

      const overrideContext =
        Array.isArray(sotOverridePages) && sotOverridePages.length > 0
          ? sotOverridePages
              .map(
                (p: any, idx: number) =>
                  `[SOT OVERRIDE DOC #${idx + 1} - TITLE: "${p.title}" | CATEGORY: ${p.category}]\n${
                    p.plainText || p.htmlContent || ''
                  }`
              )
              .join('\n\n')
          : 'None saved.';

      const weblinksContext =
        activeLinks.length > 0
          ? activeLinks
              .map((l: any) => `- ${l.title} (${l.category}): ${l.url}${l.notes ? ` — ${l.notes}` : ''}`)
              .join('\n')
          : 'None specified.';

      const modifiersContext =
        modifiers && typeof modifiers === 'object' && Object.keys(modifiers).length > 0
          ? Object.entries(modifiers)
              .filter(([_, v]) => v !== undefined && v !== null && String(v).trim() !== '')
              .map(([k, v]) => `- ${k}: ${v}`)
              .join('\n')
          : 'None specified.';

      const systemInstruction = `You are the Pathfinder 1st Edition Rules & Source of Truth (SOT) Lookup Engine.
Your job is to seek and retrieve exact data for Feats, Class Abilities, Class Resources, Spells, and Powers/Maneuvers using the Name query and any other form fields provided as search modifiers.

STRICT 3-STEP SEARCH ORDER:
1. START WITH SOT DOCS (HIGHEST PRIORITY):
   Check the player's saved SOT Override Pages first. If a proper match is found in the SOT Docs, use it as the authoritative source and set "sourceAuthority" to "SOT Override Page".
2. CHECK SOT LINKS NEXT (SECOND PRIORITY):
   If not in the SOT Docs, check the player's saved SOT Weblinks and use URL Context / Search across those domains. If matched via a saved SOT Weblink, set "sourceAuthority" to "SOT Weblink".
3. VERIFIED ONLINE PF1E SRD (FINAL STEP):
   Use Google Search to find a proper match in authentic Pathfinder 1e SRD sources (d20pfsrd, Archives of Nethys, Paizo PRD, Spheres of Power, Path of War). Set "sourceAuthority" to "Online SRD".

CRITICAL RULE — DO NOT GUESS OR MAKE UP THINGS:
- Never invent, guess, or fabricate feats, class abilities, spells, prerequisites, or numbers if no proper match exists.
- If the query (combined with the field modifiers) does NOT match any saved SOT Doc, saved SOT Link, or real Pathfinder 1e rule, you MUST return "matched": false and leave mechanical fields empty so the player's form is not populated with made-up data.
- Only set "matched": true when you have found a genuine, verified match.

Always output your final response as a single valid JSON object with these exact keys:
{
  "matched": true | false,
  "title": "Exact Verified Name of Feat / Class Ability / Spell / Power",
  "category": "Feat" | "Class Ability" | "Spell" | "Power" | "Archetype" | "General Rule",
  "featType": "Combat" | "General" | "Metamagic" | "Item Creation" | "Racial" | "Class Bonus" | "Teamwork",
  "macroKey": "UPPER_SNAKE_IDENTIFIER",
  "sourceAuthority": "SOT Override Page" | "SOT Weblink" | "Online SRD",
  "prerequisites": "Exact prerequisites or level requirement (or 'None')",
  "actionType": "Standard" | "Swift" | "Move" | "Immediate" | "Free" | "Full-Round" | "1 Round" | "Passive / Pool",
  "range": "Exact range or area if applicable, else empty string",
  "duration": "Exact duration if applicable, else empty string",
  "saveDC": "Exact saving throw / DC formula if applicable, else empty string",
  "hasResourcePool": true | false,
  "resourceMax": 3,
  "summary": "1-2 sentence accurate mechanical summary",
  "fullDescription": "Complete, factual rules text and scaling mechanics without guessing",
  "suggestedMacro": "Valid Macaroni DSL formula e.g. [1d20 + #BAB + #STR] or <^AC.Dodge+1>",
  "sourceNotes": "Citation of the exact SOT Doc, SOT Link, or PF1e rulebook/SRD page matched (or explanation why no match was found)"
}`;

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

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: userPrompt,
        config: {
          systemInstruction,
          tools,
        },
      });

      const rawText = response.text ?? '';
      const groundingChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
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
    } catch (err: any) {
      console.error('Gemini /api/gemini/lookup error:', err);
      return res.status(500).json({
        error: err?.message || 'Gemini online lookup failed.',
      });
    }
  });

  // 3. AI Complete Sheet: Conversational Character Builder Grounded in SOT
  app.post('/api/gemini/complete-sheet', async (req, res) => {
    try {
      const ai = getAIClient();
      if (!ai) {
        return res.status(503).json({
          error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
        });
      }

      const {
        conversation = [],
        characterSummary = '',
        sotOverridePages = [],
        sotWeblinks = [],
        allowedFields = {},
      } = req.body || {};

      const activeLinks = Array.isArray(sotWeblinks)
        ? sotWeblinks
            .filter((l: any) => l && l.isActive && l.url)
            .slice(0, 15)
        : [];

      const overrideContext =
        Array.isArray(sotOverridePages) && sotOverridePages.length > 0
          ? sotOverridePages
              .map(
                (p: any, idx: number) =>
                  `[SOT OVERRIDE DOC #${idx + 1} - "${p.title}" | CATEGORY: ${p.category}]\n${
                    p.plainText || p.htmlContent || ''
                  }`
              )
              .join('\n\n')
          : 'None saved in SOT Catalogue.';

      const weblinksContext =
        activeLinks.length > 0
          ? activeLinks
              .map((l: any) => `- ${l.title} (${l.category}): ${l.url}`)
              .join('\n')
          : 'None specified.';

      const blindSpotsContext = Object.entries(allowedFields)
        .filter(([_, allowed]) => allowed === false)
        .map(([k]) => k)
        .join(', ');

      const systemInstruction = `You are an expert Pathfinder 1st Edition character creation companion and build advisor collaborating with the player to construct their character sheet from concept to full build.

PERSONALITY & VOICE:
- Mirror the user's conversational vibe, enthusiasm, and brevity.
- Talk like a knowledgeable, passionate tabletop gamer friend sitting across the table brainstorming a build—not a corporate assistant, search engine, or robot.
- Be supportive, punchy, and direct. Use natural tabletop terminology (e.g. BAB, full-attack, swift action, feat taxes, MAD/SAD, caster level, archetypes).

STRICT SOURCE OF TRUTH (SOT) FIDELITY — DO NOT MAKE UP RULES:
- Ground all mechanical recommendations, feats, archetypes, abilities, spell lists, and math strictly in the provided SOT Override Docs and SOT Weblinks.
- NEVER invent, fabricate, or guess nonexistent Pathfinder 1e feats, archetypes, prerequisites, or class abilities.
- If the player asks for a class, archetype, or feat that is NOT in their loaded SOT Docs or SOT links:
  1. In your friendly peer voice, let them know that this specific option isn't in their loaded SOT documents yet.
  2. Set "missingSotRequest": { "title": "<exact item name>", "category": "<Feat | Archetype | Class | Spell>", "reason": "Not found in loaded SOT docs" } in your JSON response.
  3. Tell them they can paste or drop the SRD text into the quick SOT upload drawer right here, and you will adapt it immediately.
  4. DO NOT make up fake mechanics or numbers for that unindexed option.

RANDOM ASSIGNMENT RESTRICTION:
- ONLY randomly assign or roll stats/traits/details when the user EXPLICITLY prompts you to do so (e.g. "roll my stats", "give me a random feat", "surprise me with an alignment"). Never randomly reassign stats, classes, or abilities without explicit user permission.

BROAD SHEET AUTHORITY FIELD UPDATES:
- Along with your conversational response, return an array of "fieldUpdates" strings containing plain-language commands to populate the sheet live.
- Supported action commands:
  * "set name to <Name>"
  * "set race to <Race>"
  * "set class to <Class>"
  * "set level to <Number>"
  * "set alignment to <Alignment>"
  * "set deity to <Deity>"
  * "set stats STR <n>, DEX <n>, CON <n>, INT <n>, WIS <n>, CHA <n>" or "set <stat> to <n>"
  * "set hit die to d<6|8|10|12>"
  * "set max hp to <n>"
  * "add feat <Feat Name>: <short summary>"
  * "add action <Ability Name>: <short summary>"
  * "add resource <Resource Name> max <n>"
  * "add spell <Spell Name> level <n>"
  * "set backstory to <short backstory paragraph>"
- Note AI Blind Spots: The player has disabled AI authority over the following fields: [${blindSpotsContext || 'None'}]. Do not attempt to force changes on those if disallowed.
- Only emit field updates for details the player has agreed to, requested, or confirmed.

OUTPUT FORMAT (JSON ONLY):
Return a single valid JSON object with these exact keys:
{
  "replyText": "Conversational peer reply explaining suggestions, synergies, and choices...",
  "fieldUpdates": [
    "set name to ...",
    "set race to ...",
    "set class to ...",
    "set stats STR ..., DEX ..., CON ..., INT ..., WIS ..., CHA ...",
    "add feat ...",
    "add action ..."
  ],
  "missingSotRequest": null | {
    "title": "Name of missing feat/archetype",
    "category": "Archetype" | "Feat" | "Class Ability" | "Spell",
    "reason": "Short explanation why SOT upload is needed"
  }
}`;

      const historyFormatted = Array.isArray(conversation)
        ? conversation
            .map((msg: any) => `${msg.role === 'user' ? 'PLAYER' : 'AI COMPANION'}: ${msg.text}`)
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

      const modelsToTry = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
      let rawText = '';
      let lastError: any = null;

      for (const modelName of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: userPrompt,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
            },
          });
          if (response.text) {
            rawText = response.text;
            break;
          }
        } catch (modelErr: any) {
          lastError = modelErr;
        }
      }

      if (!rawText && lastError) {
        throw lastError;
      }

      return res.json({
        rawText,
      });
    } catch (err: any) {
      console.error('Gemini /api/gemini/complete-sheet error:', err);
      return res.status(500).json({
        error: err?.message || 'Gemini Complete Sheet generation failed.',
      });
    }
  });

  // 4. Single-Page Halt & Read-Only Snapshot Route for SOT Weblinks
  app.post('/api/sot/fetch-readonly-page', async (req, res) => {
    try {
      const { url } = req.body || {};
      if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url.trim())) {
        return res.status(400).json({ error: 'Valid HTTP/HTTPS URL is required.' });
      }

      const targetUrl = url.trim();
      // Reject webhook endpoints immediately
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

      // Extract incidental links (do NOT follow them — single page halt!)
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

      // Count & strip scripts, webhooks, and code snippets
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
    } catch (err: any) {
      return res.status(500).json({
        error: err?.message || 'Could not fetch single-page read-only snapshot.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
