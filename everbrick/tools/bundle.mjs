// Packs models/*.json into per-realm bundles and characters/*.json into one bundle so the game loads in a few requests.
//   node tools/bundle.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const realms = ['brightharbour','apex','kingsreach','saltspray','wildwood','mistpeak','ember','frontier'];
const bundles = Object.fromEntries([...realms, 'misc'].map(r => [r, {}]));
for (const f of readdirSync(root + 'models')) {
  if (!f.endsWith('.json') || f === 'index.json' || f.startsWith('bundle_')) continue;
  const m = JSON.parse(readFileSync(root + 'models/' + f, 'utf8')); const r = realms.find(x => f.startsWith(x + '_')) || 'misc';
  bundles[r][m.id || f.replace(/\.json$/, '')] = m;
}
for (const [r, b] of Object.entries(bundles)) { writeFileSync(root + `models/bundle_${r}.json`, JSON.stringify(b)); console.log(r, Object.keys(b).length); }
const chars = {};
for (const f of readdirSync(root + 'characters')) { if (!f.endsWith('.json') || f === 'index.json' || f === 'bundle.json') continue; const c = JSON.parse(readFileSync(root + 'characters/' + f, 'utf8')); chars[c.id || f.replace(/\.json$/, '')] = c; }
writeFileSync(root + 'characters/bundle.json', JSON.stringify(chars)); console.log('characters', Object.keys(chars).length);
