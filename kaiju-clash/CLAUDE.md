# CLAUDE.md — KAIJU CLASH

KAIJU CLASH is a giant-monster fighting game: one self-contained `index.html` (about 4,500 lines), Three.js `0.160.0` and Rapier `@dimforge/rapier3d-compat` `0.12.0` from jsDelivr through an import map, procedural art, no build step. Player-facing docs are in [`README.md`](README.md). Live at https://rgallaghertt.github.io/vector-game/kaiju-clash/.

## Ground rules (the repo is shared)

- `rgallagherTT/vector-game` holds many people's games, one folder each. **Only create, change or delete files inside `kaiju-clash/`.** Never touch the repo root or another game's folder.
- **Never force-push**, rebase, amend pushed commits, or rewrite history on `main` or `gh-pages`.
- Start every session with `git pull origin main`; someone else may have changed the game since you last looked.
- Keep it one self-contained `index.html`. Load libraries only from a CDN with an exact pinned version; no bundlers, no `npm install` for the game itself.
- Original IP only: no real kaiju, brands or copyrighted characters.

## Where things are in `index.html`

The comment manifest near the top lists every section anchor (`// §CONFIG`, `// §INPUT`, `// §FIGHT`, `// §ROSTER`, `// §ARENAS`, `// §MODES`, `// §REPLAY`, `// §MENUS`, `// §SIM`, `// §MAIN` …). Search for the anchor to jump to a system.

- **Tunables:** every gameplay and performance number lives in `CONFIG` (`§CONFIG`). Change numbers there rather than hard-coding them.
- **Monsters:** `ROSTER` (`§ROSTER`). The per-monster balance multipliers are in `BALANCE` (`§BALANCE`).
- **Controls:** `KEYMAPS`, `PAD_MAP` and the `TOUCH` on-screen controls are in `§INPUT`. `KEY_HELP` drives every on-screen control legend, so update it whenever a binding changes.
- **Saves:** the `localStorage` profile is in `§SAVE`. Every read and write is wrapped in try/catch; keep it that way.

## Testing

- Serve and play: `npx http-server kaiju-clash -p 8080` from the repo root, then open `http://localhost:8080`. Watch the browser console for errors.
- URL flags: `?debug=1` (overlay plus debug keys), `?bench=brawl` (frame times), `?touch=1` / `?touch=0` (force the touch controls on / off).
- **Balance:** `?sim=balance&n=60` runs a headless AI-vs-AI simulator and prints each monster's win rate. Each monster should stay within roughly 45–55%. If you change monster stats, moves, damage or knockback, re-run it; `&tune=1&verify=150` auto-tunes `BALANCE` (paste the printed multipliers back into the file).
- Automation hooks: `window.__K` exposes the game modules, `window.__G` the game state, and `window.__step(n, dt)` advances the simulation without rendering. These are handy for Playwright checks.
- Check both a desktop window and a phone-sized landscape window (about 844×390, `?touch=1`) when you change the HUD, menus or controls.

## Publishing (both branches)

The site is served from **`gh-pages`**, not `main`. A change is live only after it lands on both.

```bash
git config --add remote.origin.fetch '+refs/heads/gh-pages:refs/remotes/origin/gh-pages'   # once per clone
git fetch origin
# 1. commit your kaiju-clash/ changes on main and push
git push origin main
# 2. copy just this folder onto gh-pages and push
git checkout gh-pages && git pull origin gh-pages
git checkout main -- kaiju-clash
git commit -m "kaiju-clash: <what changed>" && git push origin gh-pages
git checkout main
```

Then confirm on GitHub (Actions tab, or the GitHub MCP tools) that the newest **"pages build and deployment"** run for your `gh-pages` commit finished with **success**, and give the person the link https://rgallaghertt.github.io/vector-game/kaiju-clash/. Ignore the **"Deploy to GitHub Pages"** workflow: it always fails and is not what serves the site.

If a push is rejected because the branch moved, `git pull` (merge, not rebase) and push again. Never use `--force`.
