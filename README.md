<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>


## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `OPENAI_API_KEY` in `.env.local` (project root) to your OpenAI API key
3. Run the app:
   `npm run dev`
4. open a browser (chrome or edge work best) and go to  http://localhost:3000 (or whichever local host is available when its launched)

   # Hello
this is An Automatic sheet for Pathfinder 1e though theoretically it can be used for 2e as well
it features 3 pages for Stats, Equipment and Abilities. It calculates and updates automatically with a programmable macro lang. DSL workshop allows you to create new objects in the language to call using simple macro commands its a bit of a work in progress but should work well enough for simple progressions. Characters can be saved as .json files downloaded from the host or you can create a local save tree. you can also save it as a .csv or create a printer friendly sheet. 

   # Tools
   the auto sheet has a few tools for convenience.\
   little stuff 
   1. DSL workshop. allows user to create object calls to use in macro sensitive areas. the call at this time is #objectname or {objectname}. 
   2. Dice tray. a macro sensitive dice roller. 
   3. A card deck with a hand and discard pile. 
   4. Point buy calculator
   5. XdX a macro programmer similar to dsl studio (in the future this will translate macros for d20 or foundry)
   6. the buff box is a buff/condition tracker. create new conditions and buffs save them for quick reference 
   7. a debug tool for the macro language so you can see how it works and what the calls are doing. 
   8. CMBt is a quick rules reference for combat rolls (grapple chart)
   9. A universal file browser. To upload images. To your browser or pull from image links.
   10. a journal module and scratchpad for notes, Expansive inventory system, micro image editor (cropper). Ability resource and feat catalogue and lookup tools. HP tracker. Skill trackers.

   Big stuff

   1. The AI companion tool. Complete sheet AI and Apple eye AI powered look up fill and suggestion agents. AI companion is used for Journal entries mostly, but can also make changes directly to the sheet and translate plain text into the program macros. its also the main hub. by default the ai listeners are off. once its opened and an API key is added the listeners can be selectively turned off. apple eye is a look up and fill tool that finds a given prompt either from a stored resource or by searching the web and populates it into an adjoining field. complete sheet is designed to fill the sheet out completely from a set of srds and prompts. you upload SRDs directly to Complete sheet which it refers to in order to fill out all available fields on the sheet. from a series of user prompts. it does not work. I need to fix it to a proper agent. set up SRD ingest. but ftb im focused on getting the macro lang and fields to behave so that will have to wait.

   2. Loadout. or Frankenstein sheet is the load tool. you open it upload your character .json and apply it. it can also combine .json or break them down by section. Its made to load the .csv saves as well but I have had some issues with the CSV save type. 

   3. Addclass. probably the best tool in the bunch, it doesnt use ai though it is compatible with the ai companion tool. It lets the user paste a data tool into the main section and then pulls from the table to fill in fields on the sheet. you can also add skills, proficiencies and abilities directly. 
   


Local development loads `.env.local` after `.env`, so the saved OpenAI key and
model take precedence over inherited shell values. Production keeps hosting
environment values. AI requests use OpenAI; `GET /api/openai/status` reports the
provider, configuration status, and model names without returning credentials.
Originally sheet ran on Gemini some error codes still return "invalid Gemini API" or similar warnings ignore that it's built to use Open API keys at this time. If you don't have an open api key you can still use the sheet without the AI assistance and it works pretty well. If your new to ai just go to https://openai.com/api and log in to open api keys they are free to make but begin cost when used. the cost to make a single sheet I've found is around $0.02 BUT the agent is not fully set up yet. So you may be better off ignoring it for now. 

## Try incremental AI sheet updates

Open Complete Sheet AI and type `tap test`, or use its Tap test prompt chip.
It builds a random character through ten small conversation turns, applying one
related update at a time. The test uses the current point-buy budget, or 20 points
when no valid budget is set. It updates the current sheet without clearing it.

Use Stop to end the run. If a rule source or decision is needed, the test pauses;
add the source or answer in chat, then use Continue tap test. Existing AI field
permissions still apply. Live generation requires a valid configured API key.

## Release the Windows mini-browser app

```powershell
git tag -a v1.0.0 -m "PF1MW v1.0.0"
git push origin v1.0.0
```

GitHub Actions type-checks and builds the app, then attaches a runtime-only ZIP
and SHA-256 checksum to the release. The ZIP contains the standalone app,
launcher, app icon, and the character-sheet glyph and portrait images.

Friends need only download `installer/Install-PF1MW.ps1` from the repository and
run it in PowerShell:

```powershell
curl.exe -L -o Install-PF1MW.ps1 https://raw.githubusercontent.com/Aush10/pathfinder-sheet/main/installer/Install-PF1MW.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-PF1MW.ps1
```

The downloader fetches the latest stable release from GitHub, validates the
checksum and archive contents, then installs the runtime files into
`%LOCALAPPDATA%\pf1mw` and creates a desktop shortcut. The app serves on loopback
only (`127.0.0.1`) and opens in an Edge or Chrome app window. Node.js is not
required on their computers. The execution-policy option applies only to that
PowerShell process; it does not change the user's machine-wide policy.

To package and test locally, run `npm run dist:runtime`, then test the bootstrapper with
`.\installer\Install-PF1MW.ps1 -PackagePath .\dist\pf1mw-runtime.zip`.
`Install-PF1MW-Local.ps1` remains available for installing directly from a
source checkout. Updates back up replaced app files outside the install folder
and leave unrelated files alone.
