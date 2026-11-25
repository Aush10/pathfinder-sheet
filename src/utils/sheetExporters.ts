import { PF1Character, WorkspaceLayout } from '../types/character';
import { DerivedCombatStats } from '../engine/pf1eMath';
import { normalizeCharacterState } from '../engine/characterIntegration';
import { writeCharacterExportFile } from '../storage/fsAdapter';

const CHARACTER_ENVELOPE_FORMAT = 'pf1e-character';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function exportFileBaseName(characterName: string | undefined | null): string {
  const raw = String(characterName ?? '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  return raw || 'Character';
}

/** Save-tree envelopes (`format: pf1e-character` + `data`) unwrap to the inner character or loadout. */
export function unwrapImportedJsonPayload(parsed: unknown): unknown {
  if (!isRecord(parsed)) return parsed;
  if (parsed.format === CHARACTER_ENVELOPE_FORMAT && isRecord(parsed.data)) {
    return parsed.data;
  }
  return parsed;
}

export function isImportableCharacter(value: unknown): value is Partial<PF1Character> {
  return isRecord(value) && isRecord(value.abilities);
}

export function parseImportedCharacterJson(text: string): PF1Character {
  const parsed = JSON.parse(text) as unknown;
  const data = unwrapImportedJsonPayload(parsed);
  if (!isImportableCharacter(data)) {
    throw new Error('Invalid character sheet format.');
  }
  return normalizeCharacterState(data);
}

export function downloadBlob(contents: BlobPart, fileName: string, mimeType: string): void {
  const blob = contents instanceof Blob ? contents : new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.href = url;
  downloadAnchor.download = fileName;
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  URL.revokeObjectURL(url);
}

export async function writeOrDownloadExport(
  fileName: string,
  contents: string,
  mimeType: string,
  options?: { player?: string; characterName?: string },
): Promise<'folder' | 'download'> {
  const result = await writeCharacterExportFile({
    fileName,
    contents,
    player: options?.player,
    characterName: options?.characterName,
  });
  if (result.ok && result.stored === 'folder') return 'folder';
  downloadBlob(contents, fileName, mimeType);
  return 'download';
}

/**
 * Exports a single-file standalone HTML bundle with injected window.__INITIAL_CHARACTER__
 * and window.__INITIAL_LAYOUT__.
 */
export async function exportStandaloneHTMLBundle(
  character: PF1Character,
  layout: WorkspaceLayout
): Promise<void> {
  const fileName = `${exportFileBaseName(character.name)}_pf1e_sheet.html`;
  try {
    let htmlText = '';
    try {
      const response = await fetch('/pathfinder1e_standalone.html');
      if (response.ok) {
        htmlText = await response.text();
      }
    } catch (e) {
      console.warn('Could not fetch standalone template directly:', e);
    }

    if (!htmlText || !htmlText.includes('<!DOCTYPE html>')) {
      const serializedChar = JSON.stringify(character).replace(/</g, '\\u003c');
      const serializedLayout = JSON.stringify(layout).replace(/</g, '\\u003c');
      htmlText = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${character.name || 'Character'} - Pathfinder 1e Sheet</title>
  <script>
    window.__INITIAL_CHARACTER__ = ${serializedChar};
    window.__INITIAL_LAYOUT__ = ${serializedLayout};
  </script>
</head>
<body>
  ${document.documentElement.outerHTML}
</body>
</html>`;
    } else {
      const injectionScript = `<script>
  window.__INITIAL_CHARACTER__ = ${JSON.stringify(character).replace(/<\/script>/gi, '<\\/script>')};
  window.__INITIAL_LAYOUT__ = ${JSON.stringify(layout).replace(/<\/script>/gi, '<\\/script>')};
</script>`;
      if (htmlText.includes('<head>')) {
        htmlText = htmlText.replace('<head>', `<head>\n  ${injectionScript}`);
      } else {
        htmlText = injectionScript + htmlText;
      }
    }

    await writeOrDownloadExport(fileName, htmlText, 'text/html;charset=utf-8', {
      characterName: character.name,
      player: character.player,
    });
  } catch (err) {
    console.error('Failed to export standalone HTML:', err);
    const serializedChar = JSON.stringify(character).replace(/</g, '\\u003c');
    const fallbackHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${character.name}</title><script>window.__INITIAL_CHARACTER__=${serializedChar};</script></head><body>${document.documentElement.outerHTML}</body></html>`;
    await writeOrDownloadExport(fileName, fallbackHtml, 'text/html;charset=utf-8', {
      characterName: character.name,
      player: character.player,
    });
  }
}

/**
 * Downloads the current character as a formatted JSON file.
 * Writes to `<character>/exports/` when a folder is connected; otherwise a Blob URL.
 */
export async function exportCharacterJSON(character: PF1Character): Promise<void> {
  const fileName = `${exportFileBaseName(character.name)}_pf1e_sheet.json`;
  const contents = JSON.stringify(character, null, 2);
  await writeOrDownloadExport(fileName, contents, 'application/json;charset=utf-8', {
    characterName: character.name,
    player: character.player,
  });
}

/**
 * Opens a file picker and imports a PF1Character JSON file.
 * Accepts save-tree envelopes and blank names (B16).
 */
export function importCharacterJSONFile(
  onImported: (character: PF1Character) => void,
  onError?: (message: string) => void
): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        if (typeof text !== 'string') {
          onError?.('Could not read the selected file.');
          return;
        }
        onImported(parseImportedCharacterJson(text));
      } catch (err) {
        const message = err instanceof Error && err.message === 'Invalid character sheet format.'
          ? err.message
          : 'Could not parse JSON file.';
        onError?.(message);
      }
    };
    reader.onerror = () => {
      onError?.('Could not read the selected file.');
    };
    reader.readAsText(file);
  };
  input.click();
}

/**
 * Exports a spreadsheet-compatible CSV summary of the character and derived stats.
 */
export async function exportCharacterCSV(character: PF1Character, derived: DerivedCombatStats): Promise<void> {
  const lines: string[] = [
    `Name:,${character.name},,,,Race:,${character.race},,,,Space:,5 ft.`,
    `Class:,${character.characterClass},,,,Level:,${character.level},,Size:,${character.size},,Reach:,5 ft.`,
    `Abilities,,Total,Base,Race,Enh,Misc,Mod,,,,Current,Max,Temp`,
    `STR,,${derived.strTotal},${character.abilities.STR.base},${character.abilities.STR.raceMod},${character.abilities.STR.enhMod},${character.abilities.STR.miscMod},${derived.strMod},Hit Points:,${character.hpCurrent},${character.hpTotalMax},${character.hpTemp}`,
    `DEX,,${derived.dexTotal},${character.abilities.DEX.base},${character.abilities.DEX.raceMod},${character.abilities.DEX.enhMod},${character.abilities.DEX.miscMod},${derived.dexMod}`,
    `CON,,${derived.conTotal},${character.abilities.CON.base},${character.abilities.CON.raceMod},${character.abilities.CON.enhMod},${character.abilities.CON.miscMod},${derived.conMod}`,
    `INT,,${derived.intTotal},${character.abilities.INT.base},${character.abilities.INT.raceMod},${character.abilities.INT.enhMod},${character.abilities.INT.miscMod},${derived.intMod}`,
    `WIS,,${derived.wisTotal},${character.abilities.WIS.base},${character.abilities.WIS.raceMod},${character.abilities.WIS.enhMod},${character.abilities.WIS.miscMod},${derived.wisMod}`,
    `CHA,,${derived.chaTotal},${character.abilities.CHA.base},${character.abilities.CHA.raceMod},${character.abilities.CHA.enhMod},${character.abilities.CHA.miscMod},${derived.chaMod}`,
    `Defense,Total,Armor,Shield,Natural,Dex,Deflection,Touch,Flat-Footed`,
    `AC,${derived.acTotal},${derived.armorBonusTotal},${derived.shieldBonusTotal},${character.naturalArmorMod},${derived.effectiveDexModForAC},${character.deflectionMod},${derived.touchAC},${derived.flatFootedAC}`,
    `Saves,Total,Base,Ability,Magic,Misc`,
    `Fortitude,${derived.fortitudeTotal},${character.saves.fortitude.base},${derived.conMod},${character.saves.fortitude.magicMod},${character.saves.fortitude.miscMod}`,
    `Reflex,${derived.reflexTotal},${character.saves.reflex.base},${derived.dexMod},${character.saves.reflex.magicMod},${character.saves.reflex.miscMod}`,
    `Will,${derived.willTotal},${character.saves.will.base},${derived.wisMod},${character.saves.will.magicMod},${character.saves.will.miscMod}`,
    `Combat,BAB,${character.baseAttackBonus},CMB,${derived.cmbTotal},CMD,${derived.cmdTotal},Initiative,${derived.initiativeTotal}`,
  ];

  const fileName = `${exportFileBaseName(character.name)}_pf1e_sheet.csv`;
  await writeOrDownloadExport(fileName, lines.join('\n'), 'text/csv;charset=utf-8', {
    characterName: character.name,
    player: character.player,
  });
}
