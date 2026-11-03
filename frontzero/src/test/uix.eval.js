(async () => { const F = window.FZ; const wait = (ms) => new Promise((r) => setTimeout(r, ms)); const out = []; const U = F.UI; const q = (sel) => U.root.querySelector(sel); const err = () => document.getElementById('err').textContent.slice(0, 300);
 for (let i = 0; i < 40 && !(U.root && U.screen); i++) await wait(250);
 F.G.save.credits = 200000; const S = F.Econ.S; out.push(['init', S.stash.items.length, Object.keys(S.kit).join(',')]);
 for (const sc of ['hub', 'traders', 'market', 'contracts', 'base', 'raid']) { U.open(sc); await wait(150); out.push([sc, U.root.innerText.length, err()]); }
 // buy at a trader
 U.open('traders', { t: 'imre' }); await wait(100); const b = q('[data-buy="medkit"]'); b && b.click(); await wait(100); out.push(['bought medkit', F.Econ.stash().count('medkit')]);
 // accept a contract
 U.open('contracts'); await wait(100); q('[data-acc]')?.click(); await wait(100); out.push(['contracts', S.contracts.active.map((a) => a.id)]);
 // upgrade medbay (needs mats: give some)
 const st = F.Econ.stash(); st.add(F.Items.make('cloth', 6)); st.add(F.Items.make('chem', 6)); F.Econ.setStash(st); U.open('base'); await wait(100); q('[data-up="medbay"]')?.click(); await wait(100); out.push(['medbay', F.Econ.lvl('medbay')]);
 q('[data-cr="r_bandage"]')?.click(); await wait(100); out.push(['crafts', S.crafts.length]);
 // hub: select stash item and move to bag; insure primary
 U.open('hub'); await wait(100); const it = q('[data-g="stash"]'); it && it.click(); await wait(100); q('[data-act="tobag"]')?.click(); await wait(100); out.push(['bag', F.Econ.bag().items.length]);
 U.open('hub', { sel: S.kit.primary.uid }); await wait(100); q('[data-act="insure"]')?.click(); await wait(100); out.push(['ins', S.kit.primary.ins]);
 U.open('market', { cat: 'valuable' }); await wait(100); q('[data-buy]')?.click(); await wait(100); out.push(['market', err()]);
 // deploy with kit on shipgrave, then die
 U.open('raid', { map: 'shipgrave' }); await wait(100); q('[data-act="go"]').click();
 for (let i = 0; i < 120 && !(F.G.inGame && F.G.mode && F.G.mode.kind === 'extraction'); i++) await wait(250); await wait(1500);
 const m = F.G.mode; const P = F.G.players[0]; out.push(['raid', m.scav, P.soldier.weapons.map((g) => g && g.id), JSON.stringify(P.soldier.reserve), JSON.stringify(P.soldier.meds), m.raidOf(P).inv.items.length]);
 P.soldier.die({}); await wait(5000); out.push(['dead', m.outcome, m.lines, S.returns.length, JSON.stringify(Object.keys(S.kit).map((k) => S.kit[k] && (S.kit[k].id || S.kit[k].items?.length))), err()]);
 return out; })()
