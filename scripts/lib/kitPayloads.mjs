import { buildSync } from 'esbuild';
import path from 'node:path';

const SHARED_ENV_LOADER_JS = `import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function parseDotEnv(raw) {
  const out = {};
  for (const line of String(raw || '').split(/\\r?\\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

export function loadKeyholeEnv(appDir) {
  const userLocalDir = path.join(os.homedir(), 'local', 'autosheet-keys');
  const candidates = [
    path.join(userLocalDir, '.env.local'),
    path.join(os.homedir(), 'local', '.env.local'),
    path.join(appDir, '.env.local'),
  ];
  const merged = {};
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      Object.assign(merged, parseDotEnv(fs.readFileSync(candidate, 'utf8')));
    }
  }
  for (const [k, v] of Object.entries(merged)) {
    if (!process.env[k] && v) process.env[k] = v;
  }
  return candidates;
}
`;

export function createApiKeyholeFiles() {
  const keyholeJson = JSON.stringify(
    {
      format: 'autosheet-api-keyhole',
      schemaVersion: 1,
      note: 'Template only — no API keys or API server code included.',
      recommendedLocalDirectory: '%USERPROFILE%\\\\local\\\\autosheet-keys',
      providers: {
        openai: {
          envKey: 'OPENAI_API_KEY',
          modelEnvKey: 'OPENAI_MODEL',
          defaultModels: ['gpt-4o-mini', 'gpt-4o'],
        },
        geminiExperimental: {
          envKey: 'GEMINI_API_KEY',
          modelEnvKey: 'GEMINI_MODEL',
          defaultModels: ['gemini-2.5-flash', 'gemini-2.5-pro'],
        },
      },
      apiKey: '',
    },
    null,
    2,
  );

  const envLocal = `# Autosheet Playtest Kit — API Keyhole Template (no key included)
# Store this file in a secure folder on the same disk, e.g.:
#   %USERPROFILE%\\local\\autosheet-keys\\.env.local
# Never commit or share a populated .env.local file.

OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4o-mini"

# Optional Experimental Gemini API Kit key:
GEMINI_API_KEY=""
GEMINI_MODEL="gemini-2.5-flash"
`;

  const readme = `AUTOSHEET PLAYTEST KIT — API KEYHOLE (NO API INCLUDED)
=====================================================

What is this?
-------------
Just the blank configuration files:
  - api-keyhole.json
  - .env.local

No API keys and no AI backend server are included here.

Recommended Storage Location (Same Disk)
----------------------------------------
1. Create a private folder on the same disk, e.g.:
     C:\\Users\\<YourName>\\local\\autosheet-keys\\
2. Move api-keyhole.json and .env.local into that folder.
3. Paste your own OpenAI key (or Gemini key for the experimental kit) into .env.local.
4. Install either the OpenAI AI Test Kit or Experimental Gemini API Kit.
5. Open the sheet, install the AI Companion slot, and turn on the specific
   listeners you want inside AI Companion -> Settings (all listeners start OFF).
`;

  return [
    { name: 'api-keyhole.json', content: keyholeJson + '\n' },
    { name: '.env.local', content: envLocal },
    { name: 'README.txt', content: readme },
  ];
}

export function createOpenAiKitFiles() {
  const readme = `AUTOSHEET PLAYTEST KIT — OPENAI AI TEST KIT
===========================================

Requirements: Node.js 22+ installed on your computer.
This kit does NOT come with an API key.

Setup Instructions
------------------
1. Store your .env.local in a secure folder on the same disk (recommended):
     %USERPROFILE%\\local\\autosheet-keys\\.env.local
   (Or place .env.local in this folder beside server-openai-kit.mjs.)
2. Put your own key in .env.local:
     OPENAI_API_KEY="sk-..."
     OPENAI_MODEL="gpt-4o-mini"
3. Place this folder next to your Playtest Kit index.html (or set AUTOSHEET_HTML_PATH).
4. Run Start-OpenAI-Kit.bat (or: node server-openai-kit.mjs).
5. Open http://127.0.0.1:38173/?playtest=1 in Chrome/Edge.
6. IMPORTANT: AI listeners start OFF by default!
   Click "+ Install AI Companion" in the sidebar, then enable the exact
   listeners & blind-spot permissions you want to test.
`;

  const serverScript = `import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadKeyholeEnv } from './keyhole-env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadKeyholeEnv(__dirname);

const PORT = Number(process.env.PORT || 38173);
const HTML_PATH = process.env.AUTOSHEET_HTML_PATH ||
  [path.join(__dirname, 'index.html'), path.join(__dirname, '..', 'index.html')].find((p) => fs.existsSync(p));

function getApiKey() {
  const key = (process.env.OPENAI_API_KEY || '').trim();
  return key && key !== 'MY_OPENAI_API_KEY' ? key : null;
}

function getModels() {
  return [...new Set([process.env.OPENAI_MODEL, 'gpt-4o-mini', 'gpt-4o'].filter((m) => m && m.trim()).map((m) => m.trim()))];
}

async function callOpenAI(apiKey, { contents, systemInstruction, responseMimeType }) {
  const messages = [];
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
  messages.push({ role: 'user', content: contents });
  let lastErr = null;
  for (const model of getModels()) {
    const body = { model, messages };
    if (responseMimeType === 'application/json') body.response_format = { type: 'json_object' };
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: \`Bearer \${apiKey}\`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      lastErr = new Error(data?.error?.message || \`OpenAI \${model} failed (\${res.status})\`);
      continue;
    }
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text === 'string' && text.trim()) return text.trim();
  }
  throw lastErr || new Error('OpenAI returned no text.');
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 10 * 1024 * 1024) { reject(new Error('Body too large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
  if (req.method === 'GET' && reqUrl.pathname === '/api/openai/status') {
    return sendJson(res, 200, { provider: 'openai', configured: Boolean(getApiKey()), models: getModels() });
  }
  if (req.method === 'POST' && reqUrl.pathname.startsWith('/api/openai/')) {
    const apiKey = getApiKey();
    if (!apiKey) return sendJson(res, 503, { error: 'OPENAI_API_KEY is not configured in .env.local.' });
    try {
      const body = await readJsonBody(req);
      if (reqUrl.pathname === '/api/openai/generate') {
        const text = await callOpenAI(apiKey, {
          contents: String(body.prompt || ''),
          systemInstruction: body.systemInstruction,
          responseMimeType: body.responseMimeType,
        });
        return sendJson(res, 200, { text });
      }
      if (reqUrl.pathname === '/api/openai/lookup') {
        const text = await callOpenAI(apiKey, {
          contents: \`Lookup query: \${String(body.query || '')}\\nCategory: \${String(body.category || 'All')}\\nSOT: \${String(body.sotEvidence || 'None')}\\nCharacter: \${String(body.characterSummary || '')}\`,
          systemInstruction: 'Return JSON with fields: summary, citations, mechanicalRules, recommendedMacro.',
          responseMimeType: 'application/json',
        });
        return sendJson(res, 200, { text, sourceUrls: [] });
      }
      if (reqUrl.pathname === '/api/openai/complete-sheet') {
        const conv = Array.isArray(body.conversation) ? body.conversation.map((m) => \`\${m.role}: \${m.text}\`).join('\\n') : '';
        const text = await callOpenAI(apiKey, {
          contents: \`Character:\\n\${String(body.characterSummary || '')}\\nSOT:\\n\${String(body.sotEvidence || '')}\\nConversation:\\n\${conv}\`,
          systemInstruction: 'Return valid JSON with replyText, fieldUpdates, sheetUpdates, questions.',
          responseMimeType: 'application/json',
        });
        return sendJson(res, 200, { rawText: text });
      }
    } catch (err) {
      return sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  }
  if (req.method === 'GET' && (reqUrl.pathname === '/' || reqUrl.pathname === '/index.html') && HTML_PATH && fs.existsSync(HTML_PATH)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return fs.createReadStream(HTML_PATH).pipe(res);
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(\`[Autosheet OpenAI Kit] Listening on http://127.0.0.1:\${PORT}\`);
});
`;

  const bat = `@echo off
setlocal
cd /d "%~dp0"
echo Starting Autosheet Playtest Kit OpenAI Bridge on http://127.0.0.1:38173 ...
node server-openai-kit.mjs
pause
`;

  const ps1 = `$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
node .\\server-openai-kit.mjs
`;

  const keyhole = createApiKeyholeFiles();
  return [
    { name: 'README.txt', content: readme },
    { name: 'keyhole-env.mjs', content: SHARED_ENV_LOADER_JS },
    { name: 'server-openai-kit.mjs', content: serverScript },
    { name: 'Start-OpenAI-Kit.bat', content: bat },
    { name: 'Start-OpenAI-Kit.ps1', content: ps1 },
    { name: '.env.local.example', content: keyhole.find((f) => f.name === '.env.local').content },
    { name: 'api-keyhole.json', content: keyhole.find((f) => f.name === 'api-keyhole.json').content },
  ];
}

export function createGeminiKitFiles() {
  const readme = `AUTOSHEET PLAYTEST KIT — EXPERIMENTAL GEMINI API KIT
====================================================

Built as an experimental alternative alongside the OpenAI Test Kit.
Requirements: Node.js 22+ installed on your computer.
This kit does NOT come with an API key.

Setup Instructions
------------------
1. Store your .env.local in a secure folder on the same disk (recommended):
     %USERPROFILE%\\local\\autosheet-keys\\.env.local
   (Or place .env.local in this folder beside server-gemini-kit.mjs.)
2. Put your own Gemini API key in .env.local:
     GEMINI_API_KEY="AIza..."
     GEMINI_MODEL="gemini-2.5-flash"
3. Place this folder next to your Playtest Kit index.html (or set AUTOSHEET_HTML_PATH).
4. Run Start-Gemini-Kit.bat (or: node server-gemini-kit.mjs).
5. Open http://127.0.0.1:38173/?playtest=1 in Chrome/Edge.
6. IMPORTANT: AI listeners start OFF by default!
   Click "+ Install AI Companion" in the sidebar, then enable the exact
   listeners & blind-spot permissions you want to test.
`;

  const serverScript = `import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadKeyholeEnv } from './keyhole-env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadKeyholeEnv(__dirname);

const PORT = Number(process.env.PORT || 38173);
const HTML_PATH = process.env.AUTOSHEET_HTML_PATH ||
  [path.join(__dirname, 'index.html'), path.join(__dirname, '..', 'index.html')].find((p) => fs.existsSync(p));

function getApiKey() {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  return key && key !== 'MY_GEMINI_API_KEY' ? key : null;
}

function getModels() {
  return [...new Set([process.env.GEMINI_MODEL, 'gemini-2.5-flash', 'gemini-2.5-pro'].filter((m) => m && m.trim()).map((m) => m.trim()))];
}

async function callGemini(apiKey, { contents, systemInstruction, responseMimeType }) {
  let lastErr = null;
  for (const model of getModels()) {
    const endpoint = \`https://generativelanguage.googleapis.com/v1beta/models/\${encodeURIComponent(model)}:generateContent?key=\${encodeURIComponent(apiKey)}\`;
    const body = {
      contents: [{ role: 'user', parts: [{ text: contents }] }],
    };
    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }
    if (responseMimeType === 'application/json') {
      body.generationConfig = { responseMimeType: 'application/json' };
    }
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      lastErr = new Error(data?.error?.message || \`Gemini \${model} failed (\${res.status})\`);
      continue;
    }
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p?.text || '').join('').trim();
    if (text) return text;
  }
  throw lastErr || new Error('Gemini returned no text.');
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 10 * 1024 * 1024) { reject(new Error('Body too large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
  if (req.method === 'GET' && reqUrl.pathname === '/api/openai/status') {
    return sendJson(res, 200, { provider: 'gemini-experimental', configured: Boolean(getApiKey()), models: getModels() });
  }
  if (req.method === 'POST' && reqUrl.pathname.startsWith('/api/openai/')) {
    const apiKey = getApiKey();
    if (!apiKey) return sendJson(res, 503, { error: 'GEMINI_API_KEY is not configured in .env.local.' });
    try {
      const body = await readJsonBody(req);
      if (reqUrl.pathname === '/api/openai/generate') {
        const text = await callGemini(apiKey, {
          contents: String(body.prompt || ''),
          systemInstruction: body.systemInstruction,
          responseMimeType: body.responseMimeType,
        });
        return sendJson(res, 200, { text });
      }
      if (reqUrl.pathname === '/api/openai/lookup') {
        const text = await callGemini(apiKey, {
          contents: \`Lookup query: \${String(body.query || '')}\\nCategory: \${String(body.category || 'All')}\\nSOT: \${String(body.sotEvidence || 'None')}\\nCharacter: \${String(body.characterSummary || '')}\`,
          systemInstruction: 'Return JSON with fields: summary, citations, mechanicalRules, recommendedMacro.',
          responseMimeType: 'application/json',
        });
        return sendJson(res, 200, { text, sourceUrls: [] });
      }
      if (reqUrl.pathname === '/api/openai/complete-sheet') {
        const conv = Array.isArray(body.conversation) ? body.conversation.map((m) => \`\${m.role}: \${m.text}\`).join('\\n') : '';
        const text = await callGemini(apiKey, {
          contents: \`Character:\\n\${String(body.characterSummary || '')}\\nSOT:\\n\${String(body.sotEvidence || '')}\\nConversation:\\n\${conv}\`,
          systemInstruction: 'Return valid JSON with replyText, fieldUpdates, sheetUpdates, questions.',
          responseMimeType: 'application/json',
        });
        return sendJson(res, 200, { rawText: text });
      }
    } catch (err) {
      return sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  }
  if (req.method === 'GET' && (reqUrl.pathname === '/' || reqUrl.pathname === '/index.html') && HTML_PATH && fs.existsSync(HTML_PATH)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return fs.createReadStream(HTML_PATH).pipe(res);
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(\`[Autosheet Experimental Gemini Kit] Listening on http://127.0.0.1:\${PORT}\`);
});
`;

  const bat = `@echo off
setlocal
cd /d "%~dp0"
echo Starting Autosheet Experimental Gemini API Kit on http://127.0.0.1:38173 ...
node server-gemini-kit.mjs
pause
`;

  const ps1 = `$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
node .\\server-gemini-kit.mjs
`;

  const keyhole = createApiKeyholeFiles();
  return [
    { name: 'README.txt', content: readme },
    { name: 'keyhole-env.mjs', content: SHARED_ENV_LOADER_JS },
    { name: 'server-gemini-kit.mjs', content: serverScript },
    { name: 'Start-Gemini-Kit.bat', content: bat },
    { name: 'Start-Gemini-Kit.ps1', content: ps1 },
    { name: '.env.local.example', content: keyhole.find((f) => f.name === '.env.local').content },
    { name: 'api-keyhole.json', content: keyhole.find((f) => f.name === 'api-keyhole.json').content },
  ];
}

export function createSotIngestKitFiles(repoRoot) {
  const bundled = buildSync({
    entryPoints: [path.join(repoRoot, 'server', 'ingest', 'http.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    target: 'node22',
  });
  const ingestBundleCode = bundled.outputFiles[0].text;

  const readme = `AUTOSHEET PLAYTEST KIT — DETERMINISTIC SOT INGEST KIT
======================================================

What does this do?
------------------
Takes HTML, Markdown, TXT, or SRD JSON pages and produces the 4 deterministic
Source of Truth (SOT) artifacts:
  - table.json
  - links.json
  - text.md
  - index.json

Requirements: Node.js 22+ installed on your computer. Zero external npm packages needed.

Option A: CLI Usage (No Server Needed)
--------------------------------------
  node ingest-cli.mjs <path-to-srd.html|md|txt|json> [output-dir]

Option B: Local Browser Bridge (/api/sot/ingest)
------------------------------------------------
1. Place this folder next to your Playtest Kit index.html (or set AUTOSHEET_HTML_PATH).
2. Run Start-Ingest-Kit.bat (or: node server-ingest-kit.mjs).
3. Open http://127.0.0.1:38173/?playtest=1 in Chrome/Edge and use Source of Truth (SOT)!
`;

  const cliScript = `import fs from 'node:fs';
import path from 'node:path';
import { ingestFromRequestBody } from './ingest-engine.mjs';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node ingest-cli.mjs <source-file> [output-dir]');
  process.exit(1);
}
const outDir = process.argv[3] || path.join(process.cwd(), 'ingest-output');
const content = fs.readFileSync(inputPath, 'utf8');
const result = ingestFromRequestBody({ name: path.basename(inputPath), content });
if (result.status !== 200) {
  console.error('Ingest failed:', result.payload.error);
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'table.json'), JSON.stringify(result.payload.artifacts['table.json'], null, 2));
fs.writeFileSync(path.join(outDir, 'links.json'), JSON.stringify(result.payload.artifacts['links.json'], null, 2));
fs.writeFileSync(path.join(outDir, 'text.md'), result.payload.artifacts['text.md']);
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(result.payload.artifacts['index.json'], null, 2));
console.log(\`Wrote 4 SOT artifacts for "\${result.payload.title}" to \${outDir}\`);
`;

  const serverScript = `import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ingestFromRequestBody } from './ingest-engine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 38173);
const HTML_PATH = process.env.AUTOSHEET_HTML_PATH ||
  [path.join(__dirname, 'index.html'), path.join(__dirname, '..', 'index.html')].find((p) => fs.existsSync(p));

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 10 * 1024 * 1024) { reject(new Error('Body too large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
  if (req.method === 'POST' && reqUrl.pathname === '/api/sot/ingest') {
    try {
      const body = await readJsonBody(req);
      const result = ingestFromRequestBody(body);
      return sendJson(res, result.status, result.payload);
    } catch (err) {
      return sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  }
  if (req.method === 'GET' && reqUrl.pathname === '/api/openai/status') {
    return sendJson(res, 200, { provider: 'none-ingest-only', configured: false, models: [] });
  }
  if (req.method === 'GET' && (reqUrl.pathname === '/' || reqUrl.pathname === '/index.html') && HTML_PATH && fs.existsSync(HTML_PATH)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return fs.createReadStream(HTML_PATH).pipe(res);
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(\`[Autosheet SOT Ingest Kit] Listening on http://127.0.0.1:\${PORT}\`);
});
`;

  const bat = `@echo off
setlocal
cd /d "%~dp0"
echo Starting Autosheet SOT Ingest Bridge on http://127.0.0.1:38173 ...
node server-ingest-kit.mjs
pause
`;

  const ps1 = `$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
node .\\server-ingest-kit.mjs
`;

  return [
    { name: 'README.txt', content: readme },
    { name: 'ingest-engine.mjs', content: ingestBundleCode },
    { name: 'ingest-cli.mjs', content: cliScript },
    { name: 'server-ingest-kit.mjs', content: serverScript },
    { name: 'Start-Ingest-Kit.bat', content: bat },
    { name: 'Start-Ingest-Kit.ps1', content: ps1 },
  ];
}
