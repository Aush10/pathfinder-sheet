export function buildPlaytestGuideHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Autosheet Playtest Kit — Wait it's dangerous out there. Read this o7</title>
  <link rel="icon" href="./chirpy.ico" sizes="any" />
  <style>
    :root {
      color-scheme: dark;
      --bg: #07111d;
      --card: #0d1828;
      --card-2: #091320;
      --border: rgba(56, 189, 248, 0.28);
      --amber: #fbbf24;
      --cyan: #38bdf8;
      --emerald: #34d399;
      --rose: #fb7185;
      --text: #e2e8f0;
      --muted: #94a3b8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background: radial-gradient(circle at top, #0f223a 0%, var(--bg) 60%);
      color: var(--text);
      line-height: 1.55;
      padding: 24px 16px 64px;
    }
    .wrap { max-width: 980px; margin: 0 auto; display: grid; gap: 18px; }
    .hero, .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 20px;
      box-shadow: 0 12px 30px rgba(0,0,0,0.35);
    }
    .hero { border-color: rgba(251, 191, 36, 0.5); }
    .badge {
      display: inline-block;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 9px;
      border-radius: 999px;
      background: rgba(251, 191, 36, 0.16);
      color: var(--amber);
      border: 1px solid rgba(251, 191, 36, 0.45);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    h1 { margin: 10px 0 4px; font-size: 26px; color: var(--amber); }
    h2 { margin: 0 0 10px; font-size: 17px; color: var(--cyan); font-family: ui-monospace, monospace; text-transform: uppercase; letter-spacing: 0.04em; }
    h3 { margin: 14px 0 6px; font-size: 14px; color: var(--amber); font-family: ui-monospace, monospace; }
    p { margin: 6px 0; color: var(--text); font-size: 14px; }
    .muted { color: var(--muted); font-size: 13px; }
    .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; }
    .subcard {
      background: var(--card-2);
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-radius: 10px;
      padding: 14px;
    }
    code, pre {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      background: #030712;
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 7px;
    }
    code { padding: 1px 6px; font-size: 12px; color: var(--cyan); }
    pre { padding: 12px; overflow-x: auto; font-size: 12px; color: var(--emerald); margin: 8px 0; white-space: pre-wrap; word-break: break-word; }
    .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 10px; }
    a.btn, button.btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 7px 12px; border-radius: 8px;
      font-family: ui-monospace, monospace; font-size: 12px; font-weight: 700;
      text-decoration: none; cursor: pointer;
      border: 1px solid rgba(56, 189, 248, 0.45);
      background: rgba(8, 47, 73, 0.75); color: #e0f2fe;
    }
    a.btn:hover, button.btn:hover { background: rgba(14, 116, 144, 0.85); }
    .btn-amber { border-color: rgba(251, 191, 36, 0.6) !important; background: #d97706 !important; color: #090d16 !important; }
    .btn-emerald { border-color: rgba(52, 211, 153, 0.6) !important; background: #059669 !important; color: #052e16 !important; }
    .btn-rose { border-color: rgba(251, 113, 133, 0.55) !important; background: rgba(136, 19, 55, 0.5) !important; color: #fecdd3 !important; }
    details {
      background: #040b14;
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-radius: 9px;
      padding: 10px 12px;
      margin-top: 8px;
    }
    summary {
      cursor: pointer;
      font-family: ui-monospace, monospace;
      font-weight: 700;
      font-size: 12px;
      color: var(--amber);
    }
    .sigil-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 8px;
      margin-top: 10px;
      font-family: ui-monospace, monospace;
      font-size: 12px;
    }
    .sigil-item {
      background: #030712;
      border: 1px solid rgba(251, 191, 36, 0.25);
      border-radius: 8px;
      padding: 8px 10px;
    }
    .sigil-item strong { color: var(--amber); font-size: 14px; margin-right: 6px; }
    .out-box {
      margin-top: 8px; padding: 9px 11px; border-radius: 8px;
      background: #020617; border: 1px solid rgba(56, 189, 248, 0.35);
      font-family: ui-monospace, monospace; font-size: 12px; color: var(--cyan);
      display: none;
    }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="hero">
      <span class="badge">Autosheet Playtest Kit · First-Run Safety &amp; Quick Guide</span>
      <h1>Wait it's dangerous out there. Read this o7</h1>
      <p><strong># Aush10's Pathfinder Autosheet V3 Test Kit</strong></p>
      <p class="muted">
        You can start the sheet by <strong>closing this window and opening the kit a second time</strong>
        (crash-log <code>#inits</code> shifts <code>0 → 1</code> on first open), or jump straight in below.
      </p>
      <div class="row">
        <a class="btn btn-emerald" href="./index.html?playtest=1&amp;kitInit=1">Open Autosheet V3 Now</a>
        <a class="btn" href="./">Included Baggage Storage (./)</a>
        <a class="btn" href="./ITEM_LIST.md">Item List (ITEM_LIST.md)</a>
        <a class="btn" href="./baggage-list.json">Manifest (baggage-list.json)</a>
      </div>
    </section>

    <section class="card">
      <h2>Full Dev Repository (NOT needed to test the sheet)</h2>
      <p>
        This is a <strong>Test Kit</strong> for easy deployment of the autosheet. For the fully developed sheet repository,
        install it in your own coding environment and run <code>npm run dev</code>:
      </p>
      <pre id="git-cmd">git clone https://github.com/Aush10/pathfinder-sheet.git
cd pathfinder-sheet
npm install
npm run dev</pre>
      <div class="row">
        <button class="btn" type="button" onclick="copyById('git-cmd', this)">Copy Git + Dev Commands</button>
        <a class="btn" href="https://github.com/Aush10/pathfinder-sheet" target="_blank" rel="noopener noreferrer">Open GitHub Repository</a>
      </div>
    </section>

    <section class="card" style="border-color: rgba(251, 113, 133, 0.45);">
      <h2 style="color: var(--rose);">SAFETY</h2>
      <p><strong>You have allowed this program to run a shell command and now I own your computer [&lt;&gt; &lt;&gt;] jk</strong></p>
      <p class="muted">You can start the sheet by closing this window and opening the kit a second time.</p>

      <details open>
        <summary>&gt; show shell command (this is the command that was run)</summary>
        <pre id="shell-cmd">powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ".\\Start-Autosheet-Playtest-Kit.ps1"</pre>
        <button class="btn" type="button" onclick="copyById('shell-cmd', this)">Copy Shell Command</button>
      </details>

      <details>
        <summary>&gt; explain (this is what it does)</summary>
        <ul>
          <li>Runs a local loopback static server on <code>127.0.0.1:38173</code> serving files exclusively from this Playtest Kit folder.</li>
          <li>Checks <code>playtest-state.json</code> / browser crash log <code>#inits</code>: on run 1 (<code>0</code>) opens a private window to this warning, then switches to regular <code>--app=</code> mode on run 2+ (<code>1</code>).</li>
          <li><code>-NoProfile -ExecutionPolicy Bypass</code> executes only the bundled launcher script without altering Windows settings or installing services.</li>
        </ul>
      </details>

      <div class="subcard" style="margin-top: 12px; border-color: rgba(251, 191, 36, 0.4);">
        <h3>Serious Note — Hardening &amp; Windows Defender Firewall</h3>
        <p>
          Current hardening note: full dev <code>server.ts</code> binds <code>0.0.0.0</code> — use a firewall or a reverse proxy.
          (This standalone Playtest Kit static host binds loopback <code>127.0.0.1:38173</code> only.)
          Make sure Windows Defender Firewall is ON. Full dev hosting uses your own network and port <code>3000</code> (don't know what that is? Then it's probably open or firewall-managed).
        </p>
        <div class="row">
          <a class="btn btn-amber" href="windowsdefender://network">Windows Defender Firewall</a>
          <a class="btn" href="./shortcuts/Open-Windows-Defender-Firewall.bat" download>Download Firewall Shortcut (.bat)</a>
          <button class="btn" type="button" onclick="copyText('control.exe firewall.cpl', this)">Copy: control.exe firewall.cpl</button>
        </div>
      </div>

      <div class="grid-2" style="margin-top: 12px;">
        <div class="subcard">
          <h3>&gt; What goes OUT</h3>
          <p>
            Nothing at this time. Locally hosted on your browser and on your disk. Runs in any browser, though folder Save &amp; Load only works in Chrome / Edge (maybe Opera) — and Pings:
          </p>
          <button class="btn" type="button" onclick="runNetworkPing()">Click here to ping your network</button>
          <div id="net-ping-out" class="out-box"></div>
        </div>
        <div class="subcard">
          <h3>&gt; What goes IN (to your computer)</h3>
          <p>
            Besides what you already downloaded: JSON &amp; browser SQL/IndexedDB save files for your character, an optional PDF (via Print Sheet), a folder tree (<code>AIgamesheet/</code>), and whatever you save inside it.
          </p>
          <div class="row">
            <button class="btn btn-emerald" type="button" onclick="funPing()">Ping (<span id="ping-count">0</span>)</button>
            <span class="muted">Press it as many times as you like — no one's listening.</span>
          </div>
          <div id="fun-ping-out" class="out-box"></div>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>Features! — What you DON'T get &amp; YOU CAN'T HANDLE THE TRUTH</h2>
      <div class="grid-2">
        <div class="subcard">
          <h3>Money &amp; AI</h3>
          <p><strong>&gt; Money!</strong> I'm not paying you to test my sheet....</p>
          <p>
            <strong>&gt; AI!</strong> This sheet runs on OpenAI (mostly just copy-paste stuff for you!). The test kit does NOT come with an API or SRD ingestion, and AI Companion starts as an <strong>empty slot</strong> with listeners <strong>OFF by default</strong>.
            Store any downloaded kit's <code>.env.local</code> in a secure folder on the same disk (recommend <code>%USERPROFILE%\\local\\autosheet-keys\\</code>) and turn on listeners in the AI Companion Tool!
          </p>
          <div class="row">
            <a class="btn" href="./kits/openai-ai-kit.zip" download>OpenAI AI Test Kit (.zip)</a>
            <a class="btn" href="./kits/gemini-ai-kit.zip" download>Experimental Gemini API Kit (.zip)</a>
            <a class="btn btn-amber" href="./kits/api-keyhole.zip" download>API Keyhole (.json + .env.local)</a>
          </div>
        </div>
        <div class="subcard">
          <h3>SOT Catalogue, Ingest Kit &amp; Dynamic Add Class</h3>
          <p>
            <strong>SOT Catalogue:</strong> Store documents, rules &amp; notes locally and search them. Copy-and-paste web page sheet ingestion does not run inside the static Playtest Kit; download the Ingest Kit to build <code>table.json</code>, <code>links.json</code>, <code>text.md</code>, and <code>index.json</code>.
          </p>
          <div class="row">
            <a class="btn btn-amber" href="./kits/sot-ingest-kit.zip" download>Download SOT Ingest Kit (.zip)</a>
          </div>
          <p style="margin-top: 10px;">
            <strong>What you MIGHT have — Dynamic Add Class:</strong> Build a character from their grid! Copy-pasting a class grid works without AI; it just can't parse pasted rules prose and fill in blanks automatically without the AI/Ingest kits.
          </p>
        </div>
      </div>
    </section>

    <section class="card" style="border-color: rgba(52, 211, 153, 0.4);">
      <h2 style="color: var(--emerald);">What you WILL get</h2>
      <div class="grid-2">
        <div class="subcard">
          <h3>Frankenstein Loadout &amp; Folders</h3>
          <p><strong>Frankenstein Loadout!</strong> Build a character from other characters by loading their JSONs simultaneously in the Loadout tool.</p>
          <p><strong>Folders!</strong> The <code>AIgamesheet/</code> folder tree will be important in later releases; for now it's a little messy, but it works and syncs via your browser save area inside the sheet header (<code>Connect save folder</code>).</p>
          <div class="row">
            <a class="btn btn-emerald" href="./index.html?playtest=1&amp;kitInit=1">Open Sheet &amp; Browser Save Area</a>
          </div>
        </div>
        <div class="subcard">
          <h3>Macroni XDX (Macro Native Index)</h3>
          <p>
            <strong>Macro Native Index (Macroni) XdX</strong> (for dice): make custom macros for auto-leveling actions, tracking resources, and dice rolls <code>&lt;&lt;{d20}</code>. Call from any field, generate RNG, and create custom objects in DSL Studio!
          </p>
          <div class="row">
            <a class="btn btn-amber" href="./MACRONI_XDX_BIBLE.html">Open Macroni XDX Bible</a>
          </div>
        </div>
      </div>

      <h3>Updated Macroni XDX Bible Quick Reference</h3>
      <p class="muted">1: Marconi = Macro Native Index · 2: This version is called XdX because it's for players and dice rolls.</p>
      <div class="sigil-grid">
        <div class="sigil-item"><strong>=</strong> instate <code>==[10+5]</code></div>
        <div class="sigil-item"><strong>&lt;&lt;</strong> populate <code>&lt;&lt;{d20}</code></div>
        <div class="sigil-item"><strong>&lt;&gt;</strong> Elevate <code>&lt;&gt;[2d6+5]</code></div>
        <div class="sigil-item"><strong>&gt;&lt;</strong> copulate <code>&gt;str&lt;+{mod}</code></div>
        <div class="sigil-item"><strong>&gt;&gt;</strong> agitate <code>(reserved)</code></div>
        <div class="sigil-item"><strong>!</strong> escalate <code>&lt;!&gt;[6+!*1]</code></div>
        <div class="sigil-item"><strong>?</strong> insinuate <code>&lt;?&gt; "Pick"|..</code></div>
        <div class="sigil-item"><strong>[..]</strong> calculate <code>[[10+5]*2]</code></div>
        <div class="sigil-item"><strong>{..}</strong> {capsulate} <code>{firebreath}</code></div>
        <div class="sigil-item"><strong>".."</strong> "Yapulate" <code>"to hit"</code></div>
        <div class="sigil-item"><strong>{Xd8}</strong> Dice object <code>{2d8}</code></div>
      </div>

      <p style="margin-top: 12px;">
        <strong>Other stuff!!</strong> Dice, Journal for journaling, nested Bags of Holding, customizable Action Figure Catalogue &amp; resource bars, <strong>ART CROPPER</strong>, HP calculator, <strong>4 non-customizable fonts</strong> (that's all!), Light mode, Blue mode, Old mode, Other Light mode (we really need to make a dark mode), search functions, Deck of Not That Many Things, and a handy Grapple Chart!
      </p>
    </section>

    <section class="card">
      <div class="row" style="justify-content: space-between; margin-top: 0;">
        <div>
          <strong>Try it and yell at me about what you hate &rarr;</strong>
          <a class="btn" href="https://github.com/Aush10/pathfinder-sheet/issues" target="_blank" rel="noopener noreferrer">GitHub Issues (Aush10/pathfinder-sheet)</a>
        </div>
      </div>
      <details>
        <summary>vvvv if you're still reading you are a nerd here is the nerd stuff vvvv</summary>
        <p class="muted" id="nerd-info">Loading local runtime diagnostics...</p>
        <div class="row">
          <button class="btn btn-rose" type="button" onclick="resetInits()">Reset Browser Crash Log #inits to 0</button>
          <a class="btn" href="./shortcuts/Reset-First-Run-Warning.bat" download>Download Reset Launcher State (.bat)</a>
        </div>
      </details>
    </section>
  </main>

  <script>
    (function () {
      var params = new URLSearchParams(window.location.search);
      var cmd = params.get('cmd');
      if (cmd && cmd.trim()) {
        document.getElementById('shell-cmd').textContent = cmd.trim();
      }
      var raw = null;
      try { raw = localStorage.getItem('pf1e_playtest_crash_log_v1'); } catch (e) {}
      var inits = 0;
      if (raw) { try { inits = Number(JSON.parse(raw).inits || 0); } catch (e) {} }
      document.getElementById('nerd-info').textContent =
        'Origin: ' + window.location.href + ' | Crash log #inits = ' + inits + ' | Storage key: pf1e_playtest_crash_log_v1';
    })();

    function copyText(text, btn) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function () {
          var prev = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(function () { btn.textContent = prev; }, 1600);
        });
      }
    }
    function copyById(id, btn) {
      copyText(document.getElementById(id).textContent, btn);
    }
    function runNetworkPing() {
      var box = document.getElementById('net-ping-out');
      box.style.display = 'block';
      var t0 = performance.now();
      var base = 'Origin: ' + window.location.origin + ' | navigator.onLine: ' + navigator.onLine + ' | 0 bytes sent externally.';
      if (window.location.protocol.indexOf('http') === 0) {
        fetch('/api/openai/status').then(function (r) {
          box.textContent = 'Loopback ping in ' + Math.round(performance.now() - t0) + 'ms | /api/openai/status HTTP ' + r.status + ' | ' + base;
        }).catch(function () {
          box.textContent = 'Loopback ping in ' + Math.round(performance.now() - t0) + 'ms | Static Playtest Host (no AI API) | ' + base;
        });
      } else {
        box.textContent = 'Local file:// check in ' + Math.round(performance.now() - t0) + 'ms | ' + base;
      }
    }
    var count = 0;
    function funPing() {
      count += 1;
      document.getElementById('ping-count').textContent = String(count);
      var box = document.getElementById('fun-ping-out');
      box.style.display = 'block';
      box.textContent = 'Pong #' + count + '! Still nobody listening — 0 packets left your disk.';
    }
    function resetInits() {
      try {
        localStorage.setItem('pf1e_playtest_crash_log_v1', JSON.stringify({ inits: 0 }));
      } catch (e) {}
      alert('Browser crash log #inits reset to 0. Next Playtest Kit open will show the warning gate.');
    }
  </script>
</body>
</html>
`;
}

export function buildMacroniBibleHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Macroni XDX Bible — Marconi (Macro Native Index)</title>
  <link rel="icon" href="./chirpy.ico" sizes="any" />
  <style>
    body {
      margin: 0; font-family: system-ui, -apple-system, Segoe UI, sans-serif;
      background: #07111d; color: #e2e8f0; padding: 24px 16px 64px; line-height: 1.55;
    }
    .wrap { max-width: 920px; margin: 0 auto; display: grid; gap: 16px; }
    .card { background: #0d1828; border: 1px solid rgba(251, 191, 36, 0.35); border-radius: 14px; padding: 20px; }
    h1 { margin: 0 0 8px; color: #fbbf24; font-size: 24px; }
    h2 { margin: 0 0 10px; color: #38bdf8; font-size: 16px; font-family: ui-monospace, monospace; text-transform: uppercase; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
    .tile { background: #040b14; border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 10px; padding: 12px; }
    .sym { font-family: ui-monospace, monospace; font-size: 20px; font-weight: 900; color: #fbbf24; }
    .verb { font-family: ui-monospace, monospace; font-size: 12px; font-weight: 700; color: #38bdf8; float: right; text-transform: uppercase; }
    code, pre { font-family: ui-monospace, Consolas, monospace; background: #020617; border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 6px; }
    code { padding: 2px 6px; color: #34d399; font-size: 12px; }
    .box { margin-top: 8px; padding: 10px; background: #020617; border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 8px; font-family: ui-monospace, monospace; font-size: 12px; }
    .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    a.btn, button.btn {
      display: inline-flex; padding: 7px 12px; border-radius: 8px; text-decoration: none; cursor: pointer;
      font-family: ui-monospace, monospace; font-size: 12px; font-weight: 700;
      background: #d97706; color: #090d16; border: 0;
    }
    a.btn-sec { background: #0f172a; color: #e2e8f0; border: 1px solid rgba(56, 189, 248, 0.4); }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="card">
      <h1>Macroni XDX Bible</h1>
      <p><strong>1. Marconi = Macro Native Index.</strong></p>
      <p><strong>2. This particular version is called XdX</strong> because it is for players and dice rolls (<code>&lt;&lt;{d20}</code>, <code>{Xd8}</code>).</p>
      <div class="row">
        <a class="btn" href="./index.html?playtest=1&amp;kitInit=1">Open Autosheet</a>
        <a class="btn btn-sec" href="./PLAYTEST_GUIDE.html">Back to Playtest Quick Guide</a>
      </div>
    </section>

    <section class="card">
      <h2>Named Sigils &amp; Fields</h2>
      <div class="grid">
        <div class="tile"><span class="verb">instate</span><div class="sym">=</div><div class="box">==[10+5] · [10-!]=0</div><p>Instates a neutral stored object (<code>==</code>) or compares/assigns inside calculations (<code>=</code>).</p></div>
        <div class="tile"><span class="verb">populate</span><div class="sym">&lt;&lt;</div><div class="box">&lt;&lt;[{d20}+#BAB+#STR]</div><p>Pulls and populates the evaluated formula value over the macro box.</p></div>
        <div class="tile"><span class="verb">Elevate</span><div class="sym">&lt;&gt;</div><div class="box">&lt;&gt;[{2d6}+5]</div><p>Elevates the result into a popup window or tagged UI alert.</p></div>
        <div class="tile"><span class="verb">copulate</span><div class="sym">&gt;&lt;</span><div class="box">&gt;strength&lt;+{strdmg}</div><p>Merges/combines values into writable sheet fields or non-mutating objects (<code>&gt;target&lt;op value</code>).</p></div>
        <div class="tile"><span class="verb">agitate</span><div class="sym">&gt;&gt;</div><div class="box">&gt;&gt; (reserved)</div><p>Reserved remote activation symbol in Macroni 1.2.</p></div>
        <div class="tile"><span class="verb">escalate</span><div class="sym">!</div><div class="box">&lt;!&gt;[6+!*1]</div><p>Escalates a per-<code>!</code> hidden stepper counter (<code>0 → 1 → 2</code>) across runs.</p></div>
        <div class="tile"><span class="verb">insinuate</span><div class="sym">?</div><div class="box">&lt;?&gt; "Pick"|"A"={fire}|"B"={ice}</div><p>Opens an interactive decision query dialog with clickable options.</p></div>
      </div>
    </section>

    <section class="card">
      <h2>Example Macro Boxes</h2>
      <div class="grid">
        <div class="tile">
          <span class="verb">calculate</span>
          <div class="sym">[ ... ]</div>
          <div class="box" id="ex-calc">&lt;&lt;[[10+5]+5*[10+1]]</div>
          <p>Strict PEMDAS math bracket. Evaluates innermost-outward to <code>70</code>.</p>
          <button class="btn" type="button" onclick="copyBox('ex-calc', this)">Copy Macro</button>
        </div>
        <div class="tile">
          <span class="verb">{capsulate}</span>
          <div class="sym">{ ... }</div>
          <div class="box" id="ex-cap">&lt;&lt;[{firebreath}+{d8}]</div>
          <p>Capsulates saved objects, arrays (<code>{fire&amp;2}</code>), and fresh dice (<code>{Xd8}</code>).</p>
          <button class="btn" type="button" onclick="copyBox('ex-cap', this)">Copy Macro</button>
        </div>
        <div class="tile">
          <span class="verb">"Yapulate"</span>
          <div class="sym">" ... "</div>
          <div class="box" id="ex-yap">&lt;&lt;[{d20}+#BAB+#STR] "to hit!"</div>
          <p>Written text/dialogue printed alongside rolls; ignored inside pure math calls.</p>
          <button class="btn" type="button" onclick="copyBox('ex-yap', this)">Copy Macro</button>
        </div>
        <div class="tile">
          <span class="verb">Dice Object</span>
          <div class="sym">{Xd8}</div>
          <div class="box" id="ex-dice">&lt;&lt;[{2d8}+#STR] "radiant"</div>
          <p>Uncached fresh dice roll object. <code>dN</code> names are reserved for live rolls.</p>
          <button class="btn" type="button" onclick="copyBox('ex-dice', this)">Copy Macro</button>
        </div>
      </div>
    </section>
  </main>
  <script>
    function copyBox(id, btn) {
      var txt = document.getElementById(id).textContent;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(txt).then(function () {
          btn.textContent = 'Copied!';
          setTimeout(function () { btn.textContent = 'Copy Macro'; }, 1500);
        });
      }
    }
  </script>
</body>
</html>
`;
}

export function buildPlaytestLauncherPs1() {
  return `param(
  [switch]$Server,
  [switch]$Guide,
  [switch]$ResetFirstRun
)

$ErrorActionPreference = 'Stop'
$port = 38173
$appDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$statePath = Join-Path $appDirectory 'playtest-state.json'
$indexPath = Join-Path $appDirectory 'index.html'
$guidePath = Join-Path $appDirectory 'PLAYTEST_GUIDE.html'
$iconPath = Join-Path $appDirectory 'chirpy.ico'
$baseUrl = "http://127.0.0.1:$port"

if ($ResetFirstRun) {
  [System.IO.File]::WriteAllText($statePath, '{"inits":0}' + "\`n", [System.Text.UTF8Encoding]::new($false))
  Write-Output 'Reset #inits to 0. Next launch will open the first-run warning in a private window.'
  return
}

function Get-PlaytestInits {
  if (-not (Test-Path -LiteralPath $statePath -PathType Leaf)) { return 0 }
  try {
    $parsed = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json -ErrorAction Stop
    if ([int]$parsed.inits -ge 1) { return 1 }
    return 0
  } catch {
    return 0
  }
}

function Set-PlaytestInits([int]$Value) {
  $clamped = if ($Value -ge 1) { 1 } else { 0 }
  $json = (@{ inits = $clamped; updatedAt = [DateTime]::UtcNow.ToString('o') } | ConvertTo-Json) + "\`n"
  [System.IO.File]::WriteAllText($statePath, $json, [System.Text.UTF8Encoding]::new($false))
}

function Get-PlaytestBrowser {
  $candidates = @(
    @{ Kind = 'chrome'; Path = (Join-Path \${env:ProgramFiles(x86)} 'Google\\Chrome\\Application\\chrome.exe') },
    @{ Kind = 'chrome'; Path = (Join-Path $env:ProgramFiles 'Google\\Chrome\\Application\\chrome.exe') },
    @{ Kind = 'chrome'; Path = (Join-Path $env:LOCALAPPDATA 'Google\\Chrome\\Application\\chrome.exe') },
    @{ Kind = 'edge'; Path = (Join-Path \${env:ProgramFiles(x86)} 'Microsoft\\Edge\\Application\\msedge.exe') },
    @{ Kind = 'edge'; Path = (Join-Path $env:ProgramFiles 'Microsoft\\Edge\\Application\\msedge.exe') },
    @{ Kind = 'edge'; Path = (Join-Path $env:LOCALAPPDATA 'Microsoft\\Edge\\Application\\msedge.exe') }
  )
  foreach ($c in $candidates) {
    if ($c.Path -and (Test-Path -LiteralPath $c.Path -PathType Leaf)) { return $c }
  }
  foreach ($cmdName in @('chrome.exe', 'msedge.exe')) {
    $cmd = Get-Command $cmdName -ErrorAction SilentlyContinue
    if ($cmd) {
      $kind = if ($cmdName -eq 'chrome.exe') { 'chrome' } else { 'edge' }
      return @{ Kind = $kind; Path = $cmd.Source }
    }
  }
  return $null
}

function Test-LocalPortReady([string]$Url) {
  $req = [System.Net.HttpWebRequest]::Create($Url)
  $req.Method = 'HEAD'
  $req.Timeout = 900
  try {
    $resp = [System.Net.HttpWebResponse]$req.GetResponse()
    try { return $resp.StatusCode -eq [System.Net.HttpStatusCode]::OK }
    finally { $resp.Dispose() }
  } catch {
    return $false
  }
}

function Get-ContentType([string]$FilePath) {
  switch ([System.IO.Path]::GetExtension($FilePath).ToLowerInvariant()) {
    '.html' { return 'text/html; charset=utf-8' }
    '.json' { return 'application/json; charset=utf-8' }
    '.md' { return 'text/markdown; charset=utf-8' }
    '.txt' { return 'text/plain; charset=utf-8' }
    '.ico' { return 'image/x-icon' }
    '.png' { return 'image/png' }
    '.zip' { return 'application/zip' }
    '.bat' { return 'application/octet-stream' }
    '.ps1' { return 'text/plain; charset=utf-8' }
    default { return 'application/octet-stream' }
  }
}

function Start-PlaytestStaticServer {
  $rootFull = [System.IO.Path]::GetFullPath($appDirectory)
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
  $listener.Start()
  try {
    while ($true) {
      $client = $listener.AcceptTcpClient()
      try {
        $client.ReceiveTimeout = 5000
        $stream = $client.GetStream()
        $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
        $requestLine = $reader.ReadLine()
        while (($hdr = $reader.ReadLine()) -and $hdr.Length -gt 0) {}

        $status = '404 Not Found'
        $body = [System.Text.Encoding]::UTF8.GetBytes('Not found')
        $contentType = 'text/plain; charset=utf-8'
        $sendBody = $true

        if ($requestLine -match '^(GET|HEAD) ([^ ?]+)(?:\\?[^ ]*)? HTTP/1\\.[01]$') {
          $method = $Matches[1]
          $rawPath = [System.Uri]::UnescapeDataString($Matches[2])
          if ($rawPath -eq '/') { $rawPath = '/index.html' }
          $rel = $rawPath.TrimStart('/').Replace('/', '\\')
          if (-not $rel.Contains('..') -and $rel -notmatch 'playtest-state\\.json$') {
            $candidate = [System.IO.Path]::GetFullPath((Join-Path $rootFull $rel))
            if ($candidate.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
              $status = '200 OK'
              $body = [System.IO.File]::ReadAllBytes($candidate)
              $contentType = Get-ContentType $candidate
              $sendBody = $method -eq 'GET'
            }
          }
        }

        $headers = @(
          "HTTP/1.1 $status",
          "Content-Type: $contentType",
          "Content-Length: $($body.Length)",
          'Cache-Control: no-store',
          'X-Content-Type-Options: nosniff',
          'Connection: close',
          '',
          ''
        ) -join "\`r\`n"
        $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
        $stream.Write($headerBytes, 0, $headerBytes.Length)
        if ($sendBody -and $body.Length -gt 0) {
          $stream.Write($body, 0, $body.Length)
        }
        $stream.Flush()
      } catch {
      } finally {
        $client.Dispose()
      }
    }
  } finally {
    $listener.Stop()
  }
}

if ($Server) {
  Start-PlaytestStaticServer
  return
}

if (-not (Test-Path -LiteralPath $indexPath -PathType Leaf)) {
  throw "Missing standalone sheet: $indexPath"
}

if (-not (Test-LocalPortReady "$baseUrl/index.html")) {
  $psExe = Join-Path $env:SystemRoot 'System32\\WindowsPowerShell\\v1.0\\powershell.exe'
  $serverArgs = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \`"$PSCommandPath\`" -Server"
  Start-Process -FilePath $psExe -ArgumentList $serverArgs -WindowStyle Hidden
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 150
    if (Test-LocalPortReady "$baseUrl/index.html") { break }
  }
}

$inits = Get-PlaytestInits
$shellCommandText = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \`"$PSCommandPath\`""
$encodedCmd = [System.Uri]::EscapeDataString($shellCommandText)
$browser = Get-PlaytestBrowser

if ($Guide) {
  $targetUrl = "$baseUrl/PLAYTEST_GUIDE.html?cmd=$encodedCmd"
  if ($browser) {
    Start-Process -FilePath $browser.Path -ArgumentList "--app=$targetUrl"
  } else {
    Start-Process $guidePath
  }
  return
}

if ($inits -eq 0) {
  Set-PlaytestInits 1
  $targetUrl = "$baseUrl/?playtest=1&firstRun=1&cmd=$encodedCmd"
  if ($browser) {
    $privateFlag = if ($browser.Kind -eq 'chrome') { '--incognito' } else { '--inprivate' }
    Start-Process -FilePath $browser.Path -ArgumentList @($privateFlag, "--app=$targetUrl")
  } else {
    Start-Process $guidePath
  }
} else {
  $targetUrl = "$baseUrl/?playtest=1&kitInit=1&cmd=$encodedCmd"
  if ($browser) {
    Start-Process -FilePath $browser.Path -ArgumentList "--app=$targetUrl"
  } else {
    Start-Process $indexPath
  }
}
`;
}

export function buildPlaytestLauncherBat() {
  return `@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0Start-Autosheet-Playtest-Kit.ps1" %*
`;
}

export function buildPlaytestReadmeMd() {
  return `# Aush10's Pathfinder Autosheet V3 — Playtest Kit

> Quick start: double-click **Start-Autosheet-Playtest-Kit.bat** (first launch opens the **Wait it's dangerous out there. Read this o7** safety & quick guide; closing and opening a second time launches directly into the sheet).
>
> You can also open **PLAYTEST_GUIDE.html** or **MACRONI_XDX_BIBLE.html** directly in any browser.

## What's Inside
- \`index.html\` — Standalone single-file Autosheet V3 Playtest Kit
- \`PLAYTEST_GUIDE.html\` — Interactive Quick Guide, Safety Briefing, Ping checks, & Downloads
- \`MACRONI_XDX_BIBLE.html\` — Updated Macroni XDX (Macro Native Index) 1.2 reference
- \`Start-Autosheet-Playtest-Kit.bat\` / \`.ps1\` — Windows chirpy launcher (\`#inits\` 0 → 1 gate)
- \`shortcuts/\` — Windows Defender Firewall, Guide, Bible, Keyhole folder, and First-Run Reset shortcuts
- \`kits/\` — Optional standalone add-on bundles:
  - \`openai-ai-kit.zip\`
  - \`gemini-ai-kit.zip\` (Experimental Gemini API Kit)
  - \`api-keyhole.zip\` (\`api-keyhole.json\` + \`.env.local\` without an API)
  - \`sot-ingest-kit.zip\` (Deterministic SOT Ingest runner)
- \`baggage-list.json\` & \`ITEM_LIST.md\` — Full kit item manifest

## Full Development Repository
\`\`\`powershell
git clone https://github.com/Aush10/pathfinder-sheet.git
cd pathfinder-sheet
npm install
npm run dev
\`\`\`

Feedback / Bug Reports: https://github.com/Aush10/pathfinder-sheet/issues
`;
}

export function buildShortcutsFiles() {
  return [
    {
      name: 'Open-Windows-Defender-Firewall.bat',
      content: `@echo off\r\nstart "" control.exe firewall.cpl\r\n`,
    },
    {
      name: 'Open-Playtest-Guide.bat',
      content: `@echo off\r\npowershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0..\\Start-Autosheet-Playtest-Kit.ps1" -Guide\r\n`,
    },
    {
      name: 'Open-Macroni-XDX-Bible.bat',
      content: `@echo off\r\nstart "" "%~dp0..\\MACRONI_XDX_BIBLE.html"\r\n`,
    },
    {
      name: 'Reset-First-Run-Warning.bat',
      content: `@echo off\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\\Start-Autosheet-Playtest-Kit.ps1" -ResetFirstRun\r\npause\r\n`,
    },
    {
      name: 'Open-Local-Keyhole-Folder.bat',
      content: `@echo off\r\nif not exist "%USERPROFILE%\\local\\autosheet-keys" mkdir "%USERPROFILE%\\local\\autosheet-keys"\r\nexplorer "%USERPROFILE%\\local\\autosheet-keys"\r\n`,
    },
  ];
}
