/**
 * Playtest CLI for deterministic SOT ingest. Reads one source file and writes
 * the four CX2 artifacts. Does not call AI and does not execute the source.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { ingestSource } from '../../server/ingest/ingest.ts';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node --experimental-strip-types pt-kit/ingest/run.ts <file.html|md|txt|json> [outDir]');
  process.exit(1);
}

const content = await readFile(inputPath, 'utf8');
const outputs = ingestSource({ name: basename(inputPath), content });
const outDir = resolve(process.argv[3] || join('pt-kit', 'ingest', 'out', basename(inputPath)));
await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, 'table.json'), `${JSON.stringify(outputs['table.json'], null, 2)}\n`);
await writeFile(join(outDir, 'links.json'), `${JSON.stringify(outputs['links.json'], null, 2)}\n`);
await writeFile(join(outDir, 'text.md'), outputs['text.md'].endsWith('\n') ? outputs['text.md'] : `${outputs['text.md']}\n`);
await writeFile(join(outDir, 'index.json'), `${JSON.stringify(outputs['index.json'], null, 2)}\n`);
console.log(`Wrote table.json, links.json, text.md, index.json to ${outDir}`);
