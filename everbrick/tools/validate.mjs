// Validates every model in models/ against the piece library, palette and prints (node tools/validate.mjs)
import { readFileSync, readdirSync } from 'node:fs';
import { loadSim } from './headless.mjs';
const S = loadSim();
const root = new URL('..', import.meta.url).pathname;
const pieces = JSON.parse(readFileSync(root + 'design/pieces.json', 'utf8'));
console.log('design pieces registered:', S.registerDesignPieces(pieces));
const prints = JSON.parse(readFileSync(root + 'design/prints.json', 'utf8'));
const extra = new Set(Object.keys(prints.prints || {}));
let n = 0, bad = 0, errs = [];
for (const f of readdirSync(root + 'models')) {
  if (!f.endsWith('.json') || f === 'index.json') continue;
  const m = JSON.parse(readFileSync(root + 'models/' + f, 'utf8')); n++;
  const e = S.validateModel(m, extra); if (e.length) { bad++; errs.push(...e.slice(0, 3)); }
}
// generated fallback models must validate too
for (const r of ['brightharbour','apex','kingsreach','isles','wildwood','mistpeak','ember','frontier']) for (const k of ['house','shop','inn','tower','hut']) { const e = S.validateModel(S.genBuilding(r, k, 1)); if (e.length) { bad++; errs.push(...e.slice(0,2)); } n++; }
console.log(`models checked: ${n}, with errors: ${bad}`); for (const e of errs.slice(0, 20)) console.log('  ' + e);
process.exit(bad ? 1 : 0);
