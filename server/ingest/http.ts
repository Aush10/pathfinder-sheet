/**
 * POST /api/sot/ingest request handling.
 * The body is untrusted data: parsed JSON only, never executed.
 */
import { ingestSource, INGEST_SCHEMA_VERSION, MAX_SOURCE_BYTES, type IngestOutputs, type SourceDocument } from './ingest.ts';

export const INGEST_SOURCE_BYTE_LIMIT = MAX_SOURCE_BYTES;
const FORBIDDEN_ENVELOPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export interface IngestHttpSuccess {
  status: 200;
  payload: {
    schemaVersion: string;
    documentId: string;
    title: string;
    artifacts: IngestOutputs;
  };
}

export interface IngestHttpFailure {
  status: 400 | 413;
  payload: { error: string };
}

export type IngestHttpResult = IngestHttpSuccess | IngestHttpFailure;

function errorResult(status: 400 | 413, error: string): IngestHttpFailure {
  return { status, payload: { error } };
}

export function ingestFromRequestBody(body: unknown): IngestHttpResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return errorResult(400, 'JSON body with name and content is required.');
  }
  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (FORBIDDEN_ENVELOPE_KEYS.has(key)) {
      return errorResult(400, `Rejected unsafe JSON key: ${key}`);
    }
  }
  const name = record.name;
  const content = record.content;
  const path = record.path;
  if (typeof name !== 'string' || !name.trim()) {
    return errorResult(400, 'Source name is required.');
  }
  if (typeof content !== 'string') {
    return errorResult(400, 'Source content must be a string. Input is never executed.');
  }
  if (typeof path !== 'undefined' && typeof path !== 'string') {
    return errorResult(400, 'Source path must be a string when provided.');
  }
  if (Buffer.byteLength(content, 'utf8') > MAX_SOURCE_BYTES) {
    return errorResult(413, `Source exceeds ${MAX_SOURCE_BYTES} byte limit.`);
  }

  try {
    const source: SourceDocument = {
      name: name.trim(),
      content,
      ...(typeof path === 'string' ? { path } : {}),
    };
    const artifacts = ingestSource(source);
    return {
      status: 200,
      payload: {
        schemaVersion: INGEST_SCHEMA_VERSION,
        documentId: artifacts['index.json'].document.id,
        title: artifacts['index.json'].document.title,
        artifacts,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ingest failed.';
    return errorResult(/exceeds .* byte limit/i.test(message) ? 413 : 400, message);
  }
}
