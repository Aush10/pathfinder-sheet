import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const css = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');
const appTsx = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
const sidebarTsx = fs.readFileSync(path.join(root, 'src/components/workspace/BlueprintSidebar.tsx'), 'utf8');
const quickToolsTsx = fs.readFileSync(path.join(root, 'src/components/workspace/QuickModularTools.tsx'), 'utf8');
const page1Tsx = fs.readFileSync(path.join(root, 'src/components/sheet/SheetPage1Core.tsx'), 'utf8');

// 1. All four themes define scrollbar variables
for (const theme of ['parchment', 'blueprint', 'mythweavers', 'print']) {
  assert.ok(
    css.includes(`[data-pf1-theme='${theme}']`) || css.includes(`[data-pf1-theme="${theme}"]`),
    `Missing theme scrollbar selector for ${theme}`
  );
}

// 2. CSS variables are used globally and in webkit / standard scrollbar rules
for (const token of [
  '--pf1-scrollbar-track',
  '--pf1-scrollbar-thumb',
  '--pf1-scrollbar-thumb-hover',
  '--pf1-scrollbar-corner',
]) {
  assert.ok(css.includes(token), `Missing CSS variable ${token}`);
}
assert.ok(css.includes('scrollbar-color: var(--pf1-scrollbar-thumb) var(--pf1-scrollbar-track)'));
assert.ok(css.includes('::-webkit-scrollbar-thumb'));
assert.ok(css.includes('@media print'));

// 3. App.tsx binds data-pf1-theme without hiding Deck, sidebar, or stepper
assert.ok(appTsx.includes('data-pf1-theme={layout.theme}'));
assert.ok(appTsx.includes("document.documentElement.setAttribute('data-pf1-theme', layout.theme)"));
assert.ok(!appTsx.includes('pf1-hidden-turn-stepper'));

// 4. Scrollbar containers keep Deck/sidebar/stepper intact
assert.ok(sidebarTsx.includes('pf1-theme-scrollbar'));
assert.ok(page1Tsx.includes('pf1-theme-scrollbar'));
assert.ok(quickToolsTsx.includes('turnStepper'), 'QuickModularTools must retain turnStepper structure');

console.log('AG4 scrollbars verification passed.');
