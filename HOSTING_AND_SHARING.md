# Pathfinder 1e Modular Workspace: Standalone HTML & Web Hosting Guide

This guide explains how to share your character sheet as a single self-contained HTML file and how to host it on the web for free.

Use the generic build output for public hosting. A character export embeds the
active sheet and layout. Give a character export only to its intended recipients
after reviewing the sheet for private content, including notes, portraits and
saved rule material.

---

## 1. How the Standalone HTML File Works

When you click **"Export Standalone HTML (.html)"** (found in the top navigation bar or the Blueprint Sidebar under Export options):
- The application packages the entire React runtime, Tailwind styling, Pathfinder 1e math rules, dice roller, Buff Box, Stepper, XDX Macro center, and **your currently active character and layout** into a **single, standalone `.html` file** (~1.2 MB).
- All CSS, SVG icons, and JavaScript are inlined. **No internet connection, no Node.js, and no web server are required.**

### Opening & Sending to Friends
1. **Send directly**: Send the `.html` file over Discord, email, Slack, Google Drive, or a USB thumb drive.
2. **Double-click to run**: Your friends can double-click the file to open it in Chrome, Firefox, Edge, Safari, or on Android/iOS mobile browsers (`file:///` protocol).
3. **Independent save state**: Changes made by your friend will save to their local browser storage without altering your original copy.

---

## 2. Free Web Hosting Options (Zero-Cost, 1-Click)

If you'd like your friends to bookmark a web URL rather than downloading files, you can host the application in under 2 minutes:

### Option A: Netlify Drop (Easiest — No Git or Coding Required)
1. In your project, run `npm run build:standalone`.
2. Copy `dist-standalone/index.html` into an empty folder called `my-character-sheet`.
3. Go to **[app.netlify.com/drop](https://app.netlify.com/drop)** in your web browser.
4. Upload the `my-character-sheet` folder and share the deployment link with your group.

---

### Option B: GitHub Pages (Free Permanent Hosting)
Run `npm run build:standalone` and deploy the `dist-standalone` output from a
dedicated Pages branch or workflow. Use the deployment URL shown by GitHub Pages.

---

### Option C: Cloudflare Pages
1. Go to the Cloudflare dashboard > **Workers & Pages** > **Create application** > **Pages**.
2. Configure your Git build to publish `dist-standalone`, or choose **Upload assets** and upload that folder.
3. Your sheet will be instantly deployed across Cloudflare's global edge network with automatic HTTPS.

---

## 3. Embedding / Sharing Specific Character Builds

- **Baked-in Pre-loads**: When you click **Export Standalone HTML**, your sheet's active character is embedded into `window.__INITIAL_CHARACTER__`. Anyone opening the link will immediately see your exact build, portrait, gear, and custom formulas.
- **Save Backups**: Remind your players they can also click **Export JSON** at the end of every campaign session to keep timestamped character milestones.
