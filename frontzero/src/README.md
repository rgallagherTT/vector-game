# FRONT ZERO source

`index.html` is generated: edit `parts/` and run `./assemble.sh`. Parts are concatenated in filename order inside one `<script type="module">` (see the section manifest in `parts/00-head.html`).

- `maps.py` generates the large country maps in `../data/maps/`.
- `test/boot.js` is a Playwright harness: `node test/boot.js "<query string>" <seconds> <screenshot-name> [file.eval.js]`. It loads the page from a local server on port 8123, optionally runs an eval script and prints `EVAL <json>`. Use `norender=1&turbo=N` for fast logic-only runs, e.g. `quick=campaign&m=0&norender=1&turbo=4` with `camp.eval.js` plays a campaign mission through its script.
