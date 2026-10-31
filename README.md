<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/1242983d-8995-4160-b617-d71f5a92e476

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Install the Windows mini-browser app

Build the standalone app with `npm run build:standalone`, then run
`powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\Install-PF1MW.ps1`.
The installer puts only the standalone app and its local launcher in
`%LOCALAPPDATA%\pf1mw` and creates a desktop shortcut. The shortcut serves the
app on loopback only (`127.0.0.1`) and opens it in an Edge or Chrome app window.
Node.js is not needed after installation. Re-running the installer updates only
the standalone app, its icon, and its local launcher; existing app files are
backed up outside the install folder, and other files in that folder are left
alone.
