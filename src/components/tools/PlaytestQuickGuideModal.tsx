import React, { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Code,
  Copy,
  Download,
  ExternalLink,
  FolderOpen,
  HelpCircle,
  KeyRound,
  Package,
  Radio,
  RotateCcw,
  Shield,
  Sparkles,
  Terminal,
  Wifi,
  X,
} from 'lucide-react';
import {
  DEFAULT_PLAYTEST_SHELL_COMMAND,
  readPlaytestCrashLog,
  resetPlaytestInit,
} from '../../storage/playtestFirstRun';
import type { AiServerProbeStatus } from '../../engine/aiService';

export interface PlaytestQuickGuideModalProps {
  isOpen: boolean;
  isFirstRunGate?: boolean;
  launcherCommand?: string;
  aiKitStatus?: AiServerProbeStatus;
  onClose: () => void;
  onOpenBible?: () => void;
  onOpenLoadout?: () => void;
  onOpenAddClass?: () => void;
  onOpenSotPanel?: () => void;
  onConnectSaveArea?: () => void;
  onResetFirstRunFlag?: () => void;
}

const GITHUB_REPO_URL = 'https://github.com/Aush10/pathfinder-sheet';
const GITHUB_ISSUES_URL = 'https://github.com/Aush10/pathfinder-sheet/issues';
const FULL_DEV_SHELL_SNIPPET = `git clone https://github.com/Aush10/pathfinder-sheet.git
cd pathfinder-sheet
npm install
npm run dev`;

export const PlaytestQuickGuideModal: React.FC<PlaytestQuickGuideModalProps> = ({
  isOpen,
  isFirstRunGate = false,
  launcherCommand = DEFAULT_PLAYTEST_SHELL_COMMAND,
  aiKitStatus,
  onClose,
  onOpenBible,
  onOpenLoadout,
  onOpenAddClass,
  onOpenSotPanel,
  onConnectSaveArea,
  onResetFirstRunFlag,
}) => {
  const [showShellCommand, setShowShellCommand] = useState(isFirstRunGate);
  const [showExplain, setShowExplain] = useState(isFirstRunGate);
  const [showBaggageList, setShowBaggageList] = useState(false);
  const [showNerdStuff, setShowNerdStuff] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [networkPingReport, setNetworkPingReport] = useState<string | null>(null);
  const [pingCount, setPingCount] = useState(0);
  const [crashInits, setCrashInits] = useState<number>(() => readPlaytestCrashLog().inits);

  if (!isOpen) return null;

  const copyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard?.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1800);
    } catch {
      // Clipboard may be unavailable in restricted contexts.
    }
  };

  const handleNetworkPing = async () => {
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const online = typeof navigator !== 'undefined' ? navigator.onLine : false;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'file://';
    let apiNote = 'Offline / Static Kit (no local AI/Ingest server running)';
    if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
      try {
        const res = await fetch('/api/openai/status');
        if (res.ok) {
          const data = (await res.json()) as { provider?: string; configured?: boolean };
          apiNote = `Local API reachable (${data.provider || 'openai'}, configured=${Boolean(data.configured)})`;
        } else {
          apiNote = `Local static host (${res.status} on /api/openai/status — normal for PT Kit)`;
        }
      } catch {
        apiNote = 'Static local mode (0 API endpoints mounted)';
      }
    }
    const elapsed = Math.max(0, Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - start));
    setNetworkPingReport(
      `Local loopback probe completed in ${elapsed}ms · Origin: ${origin} · Browser online flag: ${online ? 'true' : 'false'} · ${apiNote} · Outbound telemetry sent: 0 bytes.`,
    );
  };

  const handleFunPing = () => {
    setPingCount((prev) => prev + 1);
  };

  const handleResetFirstRun = () => {
    resetPlaytestInit();
    setCrashInits(0);
    onResetFirstRunFlag?.();
  };

  const pingMessages = [
    'Pong! 0 packets left your computer. Still nobody listening.',
    'Pong x2! Still just your browser talking to itself.',
    'Pong! Checked the void. The void reports 0 telemetry.',
    'Pong! Local storage is vibing. No servers notified.',
  ];

  const baggageItems = [
    { name: 'index.html', desc: 'Single-file standalone Autosheet V3 Playtest Kit app' },
    { name: 'PLAYTEST_GUIDE.html', desc: 'Standalone "Wait its dangerous out there" quick guide' },
    { name: 'MACRONI_XDX_BIBLE.html', desc: 'Updated Macroni XDX (Macro Native Index) 1.2 reference' },
    { name: 'Start-Autosheet-Playtest-Kit.bat / .ps1', desc: 'Windows chirpy launcher with #inits 0->1 first-run gate' },
    { name: 'shortcuts/', desc: 'Windows Defender Firewall, Quick Guide, Bible & Keyhole shortcuts' },
    { name: 'kits/openai-ai-kit.zip', desc: 'Optional local OpenAI API bridge + README' },
    { name: 'kits/gemini-ai-kit.zip', desc: 'Experimental local Gemini API bridge + README' },
    { name: 'kits/api-keyhole.zip', desc: 'Bare .json + .env.local keyhole templates (no API/keys)' },
    { name: 'kits/sot-ingest-kit.zip', desc: 'Optional local deterministic SOT Ingest runner + README' },
    { name: 'baggage-list.json & ITEM_LIST.md', desc: 'Complete inventory manifest for this test kit' },
    { name: 'character-sheet-icons/ & assets/ & chirpy.ico', desc: 'Bundled glyph packs, portraits & launcher icon' },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-3 md:p-6 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Autosheet Playtest Kit Quick Guide"
    >
      <div className="w-full max-w-5xl max-h-[94vh] rounded-2xl border border-amber-500/50 bg-slate-900 text-slate-100 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950 border-b border-amber-500/30 flex items-start justify-between gap-4 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 font-mono text-[11px] font-bold uppercase">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{isFirstRunGate ? 'First-Run Gate (#inits 0 → 1)' : 'Playtest Kit Guide'}</span>
              </span>
              <span className="text-[11px] font-mono text-cyan-300 px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30">
                Autosheet Playtest Kit · V3
              </span>
            </div>
            <h2 className="text-lg md:text-xl font-bold font-serif text-amber-300">
              Wait it&apos;s dangerous out there. Read this o7
            </h2>
            <p className="text-xs font-mono text-slate-300">
              # Aush10&apos;s Pathfinder Autosheet V3 Test Kit
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-mono font-bold text-xs flex items-center gap-1.5 shadow-sm"
            >
              <span>{isFirstRunGate ? 'Enter Sheet Anyway' : 'Close Guide'}</span>
            </button>
            {!isFirstRunGate && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-slate-100"
                aria-label="Close Playtest Quick Guide"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto pf1-theme-scrollbar p-5 space-y-5 text-sm">
          {isFirstRunGate && (
            <div className="p-3.5 rounded-xl bg-amber-950/50 border border-amber-400/50 text-amber-100 font-mono text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <strong>First-run warning active:</strong> Browser crash log recorded{' '}
                <code>#inits = {crashInits}</code>. You can start the sheet by{' '}
                <strong>closing this window and opening the kit a second time</strong> (or click{' '}
                <em>Enter Sheet Anyway</em> above).
              </div>
              <a
                href="./PLAYTEST_GUIDE.html"
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 shrink-0 inline-flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Standalone Guide</span>
              </a>
            </div>
          )}

          {/* Top Links: Baggage List & Full Dev Repo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-950/80 border border-cyan-500/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs uppercase text-cyan-300 flex items-center gap-1.5">
                  <Package className="w-4 h-4" />
                  <span>Included Baggage &amp; Item List</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowBaggageList((prev) => !prev)}
                  className="text-[11px] font-mono text-cyan-300 hover:underline inline-flex items-center gap-1"
                >
                  {showBaggageList ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  <span>{showBaggageList ? 'Hide Items' : 'View Item List'}</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-mono">
                <a
                  href="./"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-200 inline-flex items-center gap-1"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Storage Location (./)</span>
                </a>
                <a
                  href="./ITEM_LIST.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>ITEM_LIST.md</span>
                </a>
                <a
                  href="./baggage-list.json"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 inline-flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>baggage-list.json</span>
                </a>
              </div>
              {showBaggageList && (
                <ul className="space-y-1 pt-2 border-t border-slate-800 text-[11px] font-mono">
                  {baggageItems.map((item) => (
                    <li key={item.name} className="flex items-start justify-between gap-2">
                      <code className="text-amber-300 shrink-0">{item.name}</code>
                      <span className="text-slate-400 text-right">{item.desc}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs uppercase text-slate-200 flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span>Full Dev Repo (NOT needed to test!)</span>
                </span>
                <a
                  href={GITHUB_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-mono text-cyan-400 hover:underline inline-flex items-center gap-1"
                >
                  <span>GitHub</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-xs text-slate-300">
                This is a Test Kit for easy deployment. Want the full coding workspace? Clone and run{' '}
                <code>npm run dev</code> (nice to have, not needed to playtest):
              </p>
              <div className="relative p-2.5 rounded-lg bg-black/70 border border-slate-800 font-mono text-[11px] text-emerald-300 whitespace-pre-wrap">
                {FULL_DEV_SHELL_SNIPPET}
                <button
                  type="button"
                  onClick={() => copyText('git-dev', FULL_DEV_SHELL_SNIPPET)}
                  className="absolute top-2 right-2 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] inline-flex items-center gap-1"
                >
                  {copiedId === 'git-dev' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedId === 'git-dev' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* SAFETY SECTION */}
          <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/40 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-mono font-bold text-sm uppercase text-rose-300 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>SAFETY</span>
              </h3>
              <span className="text-[11px] font-mono text-rose-200/80">
                you allowed this program to run a shell command and now I own your computer [&#60;&#62; &#60;&#62;] jk
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-black/40 border border-slate-800 space-y-2">
                <button
                  type="button"
                  onClick={() => setShowShellCommand((prev) => !prev)}
                  className="w-full flex items-center justify-between text-xs font-mono font-bold text-amber-300"
                >
                  <span>&gt; show shell command (this is the command that was run)</span>
                  {showShellCommand ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {showShellCommand && (
                  <div className="space-y-1.5">
                    <div className="p-2 rounded bg-black text-cyan-300 font-mono text-[11px] break-all border border-slate-800">
                      {launcherCommand}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyText('shell-cmd', launcherCommand)}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-mono inline-flex items-center gap-1"
                    >
                      {copiedId === 'shell-cmd' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>Copy Command</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-lg bg-black/40 border border-slate-800 space-y-2">
                <button
                  type="button"
                  onClick={() => setShowExplain((prev) => !prev)}
                  className="w-full flex items-center justify-between text-xs font-mono font-bold text-emerald-300"
                >
                  <span>&gt; explain (this is what it does)</span>
                  {showExplain ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {showExplain && (
                  <ul className="text-[11px] font-sans text-slate-300 space-y-1 list-disc list-inside">
                    <li>Starts a local loopback static server on <code>127.0.0.1:38173</code> serving files from this folder only.</li>
                    <li>Checks <code>#inits</code>: on run 1 opens a private window to this warning, then switches to regular <code>--app=</code> on run 2+.</li>
                    <li><code>-NoProfile -ExecutionPolicy Bypass</code> runs only the local launcher script without modifying system registry or firewall rules.</li>
                  </ul>
                )}
              </div>
            </div>

            {/* Serious note & Windows Firewall shortcut */}
            <div className="p-3 rounded-lg bg-slate-950/80 border border-amber-500/30 space-y-2 text-xs">
              <div className="font-mono font-bold text-amber-300">
                Serious Note — Network &amp; Windows Defender Firewall
              </div>
              <p className="text-slate-300">
                Current hardening note: full dev <code>server.ts</code> binds <code>0.0.0.0</code> on port <code>3000</code> — use a firewall or reverse proxy. (The standalone Playtest Kit static server binds loopback <code>127.0.0.1:38173</code>.) Make sure Windows Defender Firewall is ON:
              </p>
              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                <a
                  href="windowsdefender://network"
                  className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold inline-flex items-center gap-1"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Open Windows Defender Firewall</span>
                </a>
                <a
                  href="./shortcuts/Open-Windows-Defender-Firewall.bat"
                  download
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 inline-flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Firewall Shortcut (.bat)</span>
                </a>
                <button
                  type="button"
                  onClick={() => copyText('fw-cmd', 'control.exe firewall.cpl')}
                  className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 inline-flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedId === 'fw-cmd' ? 'Copied control.exe firewall.cpl' : 'Copy: control.exe firewall.cpl'}</span>
                </button>
              </div>
            </div>

            {/* What goes out / What goes in + Ping buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="font-mono font-bold text-cyan-300">&gt; What goes OUT</div>
                <p className="text-slate-300">
                  Nothing at this time. Locally hosted on your browser &amp; disk. Runs in any browser, though folder Save &amp; Load only works in Chromium browsers (Chrome / Edge, maybe Opera) — and Pings:
                </p>
                <button
                  type="button"
                  onClick={handleNetworkPing}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-mono font-bold text-xs inline-flex items-center gap-1.5"
                >
                  <Wifi className="w-3.5 h-3.5" />
                  <span>Click here to ping your network</span>
                </button>
                {networkPingReport && (
                  <div className="p-2 rounded bg-black/60 border border-cyan-500/30 font-mono text-[11px] text-cyan-200">
                    {networkPingReport}
                  </div>
                )}
              </div>

              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="font-mono font-bold text-emerald-300">&gt; What goes IN (to your computer)</div>
                <p className="text-slate-300">
                  Besides what you downloaded: JSON character exports, browser SQL/IndexedDB save files (<code>pf1e-folder-storage</code> + <code>localStorage</code>), optional PDF (via Print Sheet), a folder tree (<code>AIgamesheet/</code>), and whatever you save inside it.
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleFunPing}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-mono font-bold text-xs inline-flex items-center gap-1.5"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>Ping ({pingCount})</span>
                  </button>
                  <span className="text-[11px] font-mono text-slate-400">
                    Press it as many times as you like — no one&apos;s listening.
                  </span>
                </div>
                {pingCount > 0 && (
                  <div className="p-2 rounded bg-black/60 border border-emerald-500/30 font-mono text-[11px] text-emerald-200">
                    {pingMessages[(pingCount - 1) % pingMessages.length]} (Total pings: {pingCount})
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* WHAT YOU DON'T GET / YOU CAN'T HANDLE THE TRUTH / MIGHT HAVE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-700 space-y-3">
              <h3 className="font-mono font-bold text-xs uppercase text-rose-400">
                What you DON&apos;T get
              </h3>
              <div className="text-xs space-y-1">
                <div className="font-bold text-slate-200">&gt; Money!</div>
                <p className="text-slate-400">I&apos;m not paying you to test my sheet....</p>
              </div>
              <div className="text-xs space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">&gt; AI! (Off by default — Empty slot until kit installed)</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                    {aiKitStatus?.available ? `Detected (${aiKitStatus.provider})` : 'Not Installed'}
                  </span>
                </div>
                <p className="text-slate-300">
                  The test kit does not come with an API (at this time it runs on OpenAI, plus an experimental Gemini API kit alongside it!). AI listeners start <strong>OFF</strong> by default — if you install an API kit, store your key in a secure folder on the same disk (recommend <code>%USERPROFILE%\local\</code>) and turn on listeners in the AI Companion tool.
                </p>
                <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                  <a
                    href="./kits/openai-ai-kit.zip"
                    download
                    className="px-2 py-1 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-200 inline-flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>OpenAI AI Kit</span>
                  </a>
                  <a
                    href="./kits/gemini-ai-kit.zip"
                    download
                    className="px-2 py-1 rounded bg-purple-950 hover:bg-purple-900 border border-purple-500/40 text-purple-200 inline-flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>Experimental Gemini Kit</span>
                  </a>
                  <a
                    href="./kits/api-keyhole.zip"
                    download
                    className="px-2 py-1 rounded bg-amber-950 hover:bg-amber-900 border border-amber-500/40 text-amber-200 inline-flex items-center gap-1"
                  >
                    <KeyRound className="w-3 h-3" />
                    <span>API Keyhole (.json + .env.local)</span>
                  </a>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-700 space-y-3">
              <h3 className="font-mono font-bold text-xs uppercase text-amber-400">
                YOU CAN&apos;T HANDLE THE TRUTH (SOT &amp; Ingest) + What you MIGHT have
              </h3>
              <div className="text-xs space-y-2">
                <p className="text-slate-300">
                  <strong>SOT Catalogue:</strong> Store documents, rules &amp; notes, and search them locally. Copy-and-paste web page sheet ingestion does not run inside the static Playtest Kit (it needs the local ingest server to produce <code>table.json</code>, <code>links.json</code>, <code>text.md</code>, and <code>index.json</code>).
                </p>
                <div className="flex flex-wrap gap-2 font-mono text-[11px]">
                  <a
                    href="./kits/sot-ingest-kit.zip"
                    download
                    className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold inline-flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download Ingest Kit</span>
                  </a>
                  {onOpenSotPanel && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenSotPanel();
                      }}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40"
                    >
                      Open SOT Library
                    </button>
                  )}
                </div>
              </div>
              <div className="text-xs space-y-1 pt-2 border-t border-slate-800">
                <div className="font-bold text-slate-200">What you MIGHT have — Dynamic Add Class</div>
                <p className="text-slate-300">
                  Build a character from their grid! It sorta works without AI and you can always copy-paste a grid cleanly — it just can&apos;t read pasted rulebook prose and fill in the blanks for you without the AI/Ingest kits.
                </p>
                {onOpenAddClass && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAddClass();
                    }}
                    className="mt-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-mono text-[11px] border border-amber-500/30"
                  >
                    Open Class Architect
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* WHAT YOU WILL GET */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-emerald-500/30 space-y-4">
            <h3 className="font-mono font-bold text-xs uppercase text-emerald-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>What you WILL get</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-black/40 border border-slate-800 space-y-2">
                <div className="font-bold text-cyan-300">Frankenstein Loadout!</div>
                <p className="text-slate-300">
                  Build a character from other characters by loading their JSONs simultaneously in the Loadout tool.
                </p>
                {onOpenLoadout && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenLoadout();
                    }}
                    className="px-2 py-1 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-200 font-mono text-[11px] border border-cyan-500/40"
                  >
                    Open Loadout Tool
                  </button>
                )}
              </div>

              <div className="p-3 rounded-lg bg-black/40 border border-slate-800 space-y-2">
                <div className="font-bold text-emerald-300">Folders (Browser Save Area)</div>
                <p className="text-slate-300">
                  The <code>AIgamesheet/</code> folder tree will matter more in later releases — messy for now, but works via Chrome/Edge folder sync &amp; browser storage.
                </p>
                {onConnectSaveArea && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onConnectSaveArea();
                    }}
                    className="px-2 py-1 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-200 font-mono text-[11px] border border-emerald-500/40 inline-flex items-center gap-1"
                  >
                    <FolderOpen className="w-3 h-3" />
                    <span>Open / Connect Save Area</span>
                  </button>
                )}
              </div>

              <div className="p-3 rounded-lg bg-black/40 border border-slate-800 space-y-2">
                <div className="font-bold text-amber-300">Macroni XDX (Macro Native Index)</div>
                <p className="text-slate-300">
                  XdX (for players &amp; dice rolls <code>&lt;&lt;&#123;d20&#125;</code>): auto-level actions, track resources, roll RNG, and build custom objects in DSL Studio.
                </p>
                <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                  {onOpenBible && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenBible();
                      }}
                      className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold inline-flex items-center gap-1"
                    >
                      <BookOpen className="w-3 h-3" />
                      <span>Open Bible in Studio</span>
                    </button>
                  )}
                  <a
                    href="./MACRONI_XDX_BIBLE.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-200 border border-amber-500/30 inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>XDX Bible HTML</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Compact Macroni XDX Quick Language Box */}
            <div className="p-3 rounded-lg bg-black/50 border border-amber-500/20 font-mono text-[11px] space-y-2">
              <div className="text-amber-300 font-bold">
                Macroni XDX Quick Sigils — 1: Marconi = Macro Native Index · 2: XdX = Players &amp; Dice Rolls
              </div>
              <div className="flex flex-wrap gap-2 text-slate-200">
                <span><code>=</code> instate</span>
                <span><code>&lt;&lt;</code> populate</span>
                <span><code>&lt;&gt;</code> Elevate</span>
                <span><code>&gt;&lt;</code> copulate</span>
                <span><code>&gt;&gt;</code> agitate</span>
                <span><code>!</code> escalate</span>
                <span><code>?</code> insinuate</span>
                <span><code>[..]</code> calculate</span>
                <span><code>&#123;..&#125;</code> capsulate</span>
                <span><code>&quot;..&quot;</code> Yapulate</span>
                <span><code>&#123;Xd8&#125;</code></span>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              <strong>Other stuff!!</strong> Dice tray, Journal for journaling, nested Bags of Holding, customizable Action Figure Catalogue &amp; resource bars, <strong>Art Cropper</strong>, HP calculator, <strong>4 non-customizable fonts</strong> (that&apos;s all!), <strong>Light mode, Blue mode, Old mode, Other Light mode</strong> (we really need to make a dark mode), search functions, Deck of Not That Many Things, and a handy Grapple Chart!
            </p>
          </div>

          {/* Feedback & Nerd Stuff */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs">
                <strong>Try it and yell at me about what you hate &rarr;</strong>{' '}
                <a
                  href={GITHUB_ISSUES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline font-mono inline-flex items-center gap-1"
                >
                  <span>GitHub Issues (Aush10/pathfinder-sheet)</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <button
                type="button"
                onClick={() => setShowNerdStuff((prev) => !prev)}
                className="text-[11px] font-mono text-slate-400 hover:text-cyan-300 inline-flex items-center gap-1"
              >
                <Code className="w-3.5 h-3.5" />
                <span>{showNerdStuff ? 'Hide Nerd Stuff' : 'vvvv nerd stuff vvvv'}</span>
              </button>
            </div>

            {showNerdStuff && (
              <div className="p-3 rounded-lg bg-black/60 border border-slate-800 font-mono text-[11px] text-slate-300 space-y-2">
                <div>
                  Crash log key: <code>pf1e_playtest_crash_log_v1</code> · <code>#inits = {crashInits}</code> (0 = gate, 1 = run)
                </div>
                <div>
                  Origin: <code>{typeof window !== 'undefined' ? window.location.href : 'node'}</code> · AI API status:{' '}
                  <code>{aiKitStatus?.available ? `${aiKitStatus.provider} ready` : 'offline / not installed'}</code>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleResetFirstRun}
                    className="px-2.5 py-1 rounded bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 text-rose-200 inline-flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset #inits to 0 (Replay First-Run Gate)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
