import { PF1Character, WorkspaceLayout } from '../types/character';
import { DerivedCombatStats } from '../engine/pf1eMath';
import { normalizeCharacterState } from '../engine/characterIntegration';

/**
 * Exports a single-file standalone HTML bundle with injected window.__INITIAL_CHARACTER__
 * and window.__INITIAL_LAYOUT__.
 */
export async function exportStandaloneHTMLBundle(
  character: PF1Character,
  layout: WorkspaceLayout
): Promise<void> {
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

    const blob = new Blob([htmlText], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = `${(character.name || 'Pathfinder1e_Character').replace(/[^a-zA-Z0-9_-]/g, '_')}_pf1e_sheet.html`;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Failed to export standalone HTML:', err);
    const serializedChar = JSON.stringify(character).replace(/</g, '\\u003c');
    const fallbackHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${character.name}</title><script>window.__INITIAL_CHARACTER__=${serializedChar};</script></head><body>${document.documentElement.outerHTML}</body></html>`;
    const blob = new Blob([fallbackHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(character.name || 'Character').replace(/\s+/g, '_')}_pf1e_sheet.html`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

/**
 * Downloads the current character as a formatted JSON file.
 */
export function exportCharacterJSON(character: PF1Character): void {
  const dataStr =
    'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(character, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute(
    'download',
    `${(character.name || 'Character').replace(/\s+/g, '_')}_pf1e_sheet.json`
  );
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * Opens a file picker and imports a PF1Character JSON file.
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
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && parsed.name && parsed.abilities) {
          onImported(normalizeCharacterState(parsed));
        } else {
          onError?.('Invalid character sheet format.');
        }
      } catch {
        onError?.('Could not parse JSON file.');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

/**
 * Exports a spreadsheet-compatible CSV summary of the character and derived stats.
 */
export function exportCharacterCSV(character: PF1Character, derived: DerivedCombatStats): void {
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

  const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(lines.join('\n'));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', csvContent);
  downloadAnchor.setAttribute(
    'download',
    `${(character.name || 'Character').replace(/\s+/g, '_')}_pf1e_sheet.csv`
  );
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
