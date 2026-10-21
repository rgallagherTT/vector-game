// Everbrick headless runner: extracts the §SIMCORE block from index.html and runs the world without rendering.
//   node tools/headless.mjs            -> 100-day passive vs active comparison + 1,000-day run + checks
//   node tools/headless.mjs 1000       -> just the 1,000-day run
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export function loadSim() {
  const html = readFileSync(join(here, '..', 'index.html'), 'utf8');
  const a = html.indexOf('/* §SIMCORE:BEGIN */'), b = html.indexOf('/* §SIMCORE:END */');
  if (a < 0 || b < 0) throw new Error('SIMCORE markers not found');
  const src = html.slice(a, b);
  const names = ['CONFIG','PIECES','FUNCTIONAL','PALETTE','validateModel','genBuilding','genProp','genLandmark','genTemple','genTemplate','RUBBLE_BUILDS','SPECIES','PLAYABLE_SPECIES','ABILITIES','POSES',
    'REALMS','buildWorldMap','makeTerrain','newWorld','advanceWorld','runHeadless','saveToString','loadFromString','serializeWorld','deserializeWorld','migrateSave','encodeBlueprint','decodeBlueprint',
    'encodeCharacter','decodeCharacter','defaultRecipe','lzwCompress','lzwDecompress','CAREERS','CAREER_IDS','joinCareer','completeJob','generateJobs','lumenAdvance','grantPowers','powerAbilities',
    'MOVE_POWERS','MAIN_POWERS','DEF_POWERS','ELEMENTS','stabilityCheck','blueprintStats','judgeCommission','COMMISSION_BRIEFS','foundTown','craft','RECIPES','plantCrop','harvest','farmTick','shopTick',
    'hallOfRecords','ARCHETYPES','spawnThreat','declareWar','Bus','WEAPONS','BODY_PLANS','genName','rngFor','registerDesignPieces','PRINTS','RUBBLE_BUILDS'];
  // eslint-disable-next-line no-new-func
  return new Function(`${src}\nreturn { ${names.join(',')} };`)();
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const S = loadSim();
  const arg = Number(process.argv[2] || 0);
  const out = (r) => {
    const { world, ...rest } = r;
    return rest;
  };
  let ok = true;
  if (!arg || arg === 100) {
    const passive = S.runHeadless(100, 'passive');
    const active = S.runHeadless(100, 'pressure');
    console.log('=== 100 days: passive vs active at pressure points ===');
    for (const [k, r] of [['passive', passive], ['active', active]]) {
      const t = r.world.threats.map(t => `${t.name}/${t.leader}: stage ${t.stage}, ${t.resolved ? t.outcome : 'ongoing'}`);
      console.log(`${k.padEnd(8)} ${r.ms}ms eras=${r.erasCount} wars=${r.wars} battles=${r.battles} jobs=${r.jobsDone} threats=[${t.join(' | ')}]`);
      console.log(`         era names: ${r.eras.map(e => e.name).join(' → ')}`);
    }
    const diffSites = Object.keys(passive.sites).filter(k => passive.sites[k] !== active.sites[k]).map(k => `${k}:${passive.sites[k]}→${active.sites[k]}`);
    console.log(`difference: eras ${passive.erasCount}→${active.erasCount}; threat outcomes differ; territory changes: ${diffSites.join(', ') || 'none'}`);
    if (passive.ms > 60000 || active.ms > 60000) { ok = false; console.log('FAIL: 100-day run over a minute'); }
  }
  if (!arg || arg === 1000) {
    const r = S.runHeadless(1000, 'active');
    console.log('\n=== 1,000 days, simulated active player ===');
    console.log(`time ${r.ms}ms, eras ${r.erasCount}, wars ${r.wars}, battles ${r.battles}, events ${r.events}, jobs ${r.jobsDone}, save ${r.saveBytes} bytes`);
    console.log('wars:'); for (const w of r.warList) console.log(`  ${w.id}: ${w.a} vs ${w.b}, day ${w.start}–${w.end ?? 'ongoing'} (${w.outcome ?? 'ongoing'})`);
    console.log('threat archetypes in order:', r.archetypes.join(', '));
    console.log('eras:'); for (const e of r.eras) console.log(`  ${e.name} [${e.start}–${e.end ?? 'now'}] ${e.outcome}${e.seed ? ' — ' + e.seed : ''}`);
    console.log('titles:', r.titles.join('; '));
    console.log('towns:', JSON.stringify(r.towns), 'statues:', r.statues);
    const distinct = new Set(r.eras.map(e => e.name)).size;
    const checks = [
      ['at least five distinct eras', distinct >= 5, distinct],
      ['no back-to-back archetype', r.backToBack === 0, r.backToBack],
      ['job boards never empty', r.emptyBoards === 0, `min board size ${r.minBoard}`],
      ['1,000 days under ten minutes', r.ms < 600000, `${r.ms}ms`],
    ];
    for (const [name, pass, v] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} (${v})`); if (!pass) ok = false; }
  }
  process.exit(ok ? 0 : 1);
}
