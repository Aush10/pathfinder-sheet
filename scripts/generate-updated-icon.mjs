import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

/**
 * Generates an RGB-inverted variant of public/chirpy.ico (preserving alpha)
 * as public/chirpy-updated.ico plus public/chirpy-updated.png for UI buttons.
 */
export function generateUpdatedIconAssets(rootDir = repoRoot) {
  const sourceIco = path.join(rootDir, 'public', 'chirpy.ico');
  const destIco = path.join(rootDir, 'public', 'chirpy-updated.ico');
  const destPng = path.join(rootDir, 'public', 'chirpy-updated.png');

  if (!fs.existsSync(sourceIco)) {
    throw new Error(`Missing source icon: ${sourceIco}`);
  }
  if (process.platform !== 'win32') {
    if (fs.existsSync(destIco) && fs.existsSync(destPng)) {
      return { destIco, destPng, regenerated: false };
    }
    throw new Error('Regenerating chirpy-updated.ico requires Windows System.Drawing.');
  }

  const icoBuf = fs.readFileSync(sourceIco);
  if (icoBuf.length < 6 || icoBuf.readUInt16LE(2) !== 1) {
    throw new Error(`Unsupported ICO header in ${sourceIco}`);
  }
  const count = icoBuf.readUInt16LE(4);
  const slices = [];
  for (let i = 0; i < count; i += 1) {
    const dirOff = 6 + i * 16;
    const width = icoBuf[dirOff];
    const height = icoBuf[dirOff + 1];
    const colorCount = icoBuf[dirOff + 2];
    const reserved = icoBuf[dirOff + 3];
    const planes = icoBuf.readUInt16LE(dirOff + 4);
    const bitCount = icoBuf.readUInt16LE(dirOff + 6);
    const size = icoBuf.readUInt32LE(dirOff + 8);
    const offset = icoBuf.readUInt32LE(dirOff + 12);
    slices.push({
      width,
      height,
      colorCount,
      reserved,
      planes,
      bitCount,
      pngBytes: icoBuf.subarray(offset, offset + size),
    });
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chirpy-invert-'));
  try {
    const slicePaths = slices.map((slice, idx) => {
      const inPath = path.join(tmpDir, `in-${idx}.png`);
      const outPath = path.join(tmpDir, `out-${idx}.png`);
      fs.writeFileSync(inPath, slice.pngBytes);
      return { inPath, outPath };
    });

    const manifestPath = path.join(tmpDir, 'pairs.json');
    fs.writeFileSync(manifestPath, JSON.stringify(slicePaths), 'utf8');

    const psScript = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$pairs = Get-Content -LiteralPath '${manifestPath.replace(/'/g, "''")}' -Raw | ConvertFrom-Json
foreach ($pair in $pairs) {
  $src = [System.Drawing.Bitmap]::new($pair.inPath)
  try {
    $bmp = [System.Drawing.Bitmap]::new($src.Width, $src.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      try {
        $g.DrawImage($src, 0, 0, $src.Width, $src.Height)
      } finally {
        $g.Dispose()
      }
      for ($y = 0; $y -lt $bmp.Height; $y++) {
        for ($x = 0; $x -lt $bmp.Width; $x++) {
          $px = $bmp.GetPixel($x, $y)
          if ($px.A -gt 0) {
            $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($px.A, 255 - $px.R, 255 - $px.G, 255 - $px.B))
          }
        }
      }
      $bmp.Save($pair.outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $bmp.Dispose()
    }
  } finally {
    $src.Dispose()
  }
}
`;
    const psExe = path.join(
      process.env.SystemRoot || 'C:\\Windows',
      'System32',
      'WindowsPowerShell',
      'v1.0',
      'powershell.exe',
    );
    execFileSync(psExe, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', psScript], {
      stdio: 'pipe',
    });

    const invertedSlices = slicePaths.map((pair, idx) => ({
      ...slices[idx],
      pngBytes: fs.readFileSync(pair.outPath),
    }));

    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(invertedSlices.length, 4);

    const dirEntries = [];
    const payloads = [];
    let dataOffset = 6 + invertedSlices.length * 16;
    for (const slice of invertedSlices) {
      const entry = Buffer.alloc(16);
      entry[0] = slice.width;
      entry[1] = slice.height;
      entry[2] = slice.colorCount;
      entry[3] = slice.reserved;
      entry.writeUInt16LE(slice.planes, 4);
      entry.writeUInt16LE(slice.bitCount, 6);
      entry.writeUInt32LE(slice.pngBytes.length, 8);
      entry.writeUInt32LE(dataOffset, 12);
      dirEntries.push(entry);
      payloads.push(slice.pngBytes);
      dataOffset += slice.pngBytes.length;
    }

    fs.writeFileSync(destIco, Buffer.concat([header, ...dirEntries, ...payloads]));
    const uiSlice =
      invertedSlices.find((s) => s.width === 128) ||
      invertedSlices.find((s) => s.width === 64) ||
      invertedSlices[invertedSlices.length - 1];
    fs.writeFileSync(destPng, uiSlice.pngBytes);

    return { destIco, destPng, regenerated: true, count: invertedSlices.length };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = generateUpdatedIconAssets();
  console.log('[chirpy-updated] Generated', result);
}
