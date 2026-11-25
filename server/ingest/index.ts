export {
  INGEST_SCHEMA_VERSION,
  MAX_SOURCE_BYTES,
  OUTPUT_SCHEMAS,
  classifyTables,
  ingestSource,
  normalizeHeader,
  type CastingKind,
  type IngestLink,
  type IngestOutputs,
  type IngestSection,
  type IngestTable,
  type IngestTableCell,
  type SourceDocument,
  type TableKind,
} from './ingest.ts';
export {
  INGEST_SOURCE_BYTE_LIMIT,
  ingestFromRequestBody,
  type IngestHttpFailure,
  type IngestHttpResult,
  type IngestHttpSuccess,
} from './http.ts';
