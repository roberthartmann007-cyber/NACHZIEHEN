// Check chunk 1: the sidewalk extension on lane 1/8 (SP 2) swaps freely with parking.
// Uses the editor's CES engine (a port of the game's solver), so the numbers are what the game would publish.
// Read-only: writes nothing.
// usage: node handover_sidewalk_extension/check_sidewalk_extension.js [project.json]
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const file = path.resolve(root, process.argv[2] || 'update.json');
const html = fs.readFileSync(path.join(root, 'BCC_Editor_BCC (1).html'), 'utf8');
const mod = { exports: {} };
new Function('module', 'globalThis', html.slice(html.indexOf('/*CES-ENGINE-BEGIN*/'), html.indexOf('/*CES-ENGINE-END*/')))(mod, {});
const CES = mod.exports;
const p = JSON.parse(fs.readFileSync(file, 'utf8'));
const raw = { nodes: p.nodes, edge_heuristics: p.edge_heuristics, system_rules: p.system_rules };
const solveAll = (ov = {}) => { const r = CES.solveRaw(raw, { overrides: ov }); if (!r.ok) throw new Error(r.error); return r.values; };
const solve = ov => { const m = solveAll(ov); return id => m.get(id); };
const by = new Map(p.nodes.map(n => [n.id, n]));
let failed = 0;
const ok = (cond, label, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`); if (!cond) failed++; };
const FIT = 'car_lanes_spawn_2_fit', EXT = 'sidewalk_extension_spawn_2';
const CAR = 'car_lanes_spawn_2', BIKE = 'bike_lanes_spawn_2', BUS = 'bus_lanes_spawn_2', TRAM = 'tram_line_center', CS = 'carsharing';
console.log(`file: ${path.basename(file)}\n`);

// same check as the editor's laneLayoutFits: every lane gets its own open slot that fits it
const fits = (g, val) => {
  const v = id => Number(val[id] ?? by.get(id)?.value ?? 0);
  const lanes = [];
  Object.entries(g.levers).forEach(([mode, id]) => { for (let i = 0; i < Math.max(0, Math.round(v(id))); i++) lanes.push(mode); });
  if (lanes.length > g.slots.length) return false;
  const open = g.slots.map(s => !s.requires || v(s.requires.node) >= (s.requires.min ?? 1)), used = g.slots.map(() => false);
  const place = i => { if (i === lanes.length) return true; for (let s = 0; s < g.slots.length; s++) if (!used[s] && open[s] && g.slots[s].fits.includes(lanes[i])) { used[s] = true; if (place(i + 1)) return true; used[s] = false; } return false; };
  return place(0);
};

// structure
const g = (p.lane_slots || []).find(x => x.id === 'ew_street');
ok(!!g, 'project file has lane_slots → ew_street');
ok(by.get(EXT)?.type === 'active' && by.get(EXT).min === 0 && by.get(EXT).max === 1, `${EXT} is an active 0/1 lever`);
if (failed) process.exit(1);
ok(g.levers.extension === EXT, `lane_slots counts the extension with ${EXT}`);
ok(g.slots.find(s => s.lane === '1/8').fits.join() === 'bike,extension', 'lane 1/8 fits a bike lane or the extension');
ok(g.slots.filter(s => s.fits.includes('extension')).length === 1, 'the extension fits only on 1/8');
ok(JSON.stringify(g.yields) === JSON.stringify({ extension: ['bike'] }), 'yields: the extension is never blocked, a bike lane gives way');
const O = p.spawn.options;
ok(O.id_10.label === 'sidewalk_extension' && O.id_10.node_id === EXT, `spawn option sidewalk_extension (SP 2, lane 1/8) → ${EXT}`);
ok(O.id_339.label === 'bike_lane_2_mirrored_7' && O.id_339.node_id === BIKE, `spawn option bike_lane_2_mirrored_7 → ${BIKE}`);
ok(!Object.values(O).some(o => /sidewalk|extension/.test(o.label) && o.node_id === CAR), 'no sidewalk option writes the car lever any more');
const ctx = new Set([...by.keys(), 'y', 'baseline', 'base', 'aggregate', 'computed']);
ok(CES.validateExpression(by.get(FIT).node_formula.expression, false, ctx).ok, `${FIT} compiles in the game parser`);

// behaviour over every E-W combination, with lane 4/5 open (carsharing 1) so chunk 2 does not interfere
let agree = 0, ruleErr = 0, combos = 0, swapOk = 0, swaps = 0;
for (let car = 0; car <= 3; car++) for (const bike of [0, 1]) for (const bus of [0, 1]) for (const tram of [0, 1]) for (const ext of [0, 1]) {
  const lv = { [CAR]: car, [BIKE]: bike, [BUS]: bus, [TRAM]: tram, [EXT]: ext, [CS]: 1 }, v = solve(lv);
  combos++;
  const room = 3 - bus - tram - Math.min(bike, ext);
  ruleErr = Math.max(ruleErr, Math.abs(v(FIT) - Math.max(0, Math.min(car, room))));
  if (fits(g, lv) === (car <= room)) agree++;
  // free swap: from any buildable layout with parking on 1/8, the extension can always be chosen,
  // keeping the bike lane if it can move to 2/7, otherwise replacing it
  if (!ext && fits(g, lv)) { swaps++; if (fits(g, { ...lv, [EXT]: 1 }) || fits(g, { ...lv, [EXT]: 1, [BIKE]: 0 })) swapOk++; }
}
ok(agree === combos, `slot table and ${FIT} agree on what is buildable, ${combos} combinations`, agree === combos ? '' : `${combos - agree} disagree`);
ok(ruleErr < 1e-9, `${FIT} = min(car, 3 − bus − tram − bike on 2/7) with 4/5 open`, ruleErr ? `off by ${ruleErr}` : '');
ok(swapOk === swaps, `parking → extension is possible from every buildable layout (${swaps})`);
ok(fits(g, { [CAR]: 2, [BIKE]: 1, [EXT]: 1, [BUS]: 0, [TRAM]: 0, [CS]: 1 }) && !fits(g, { [CAR]: 3, [BIKE]: 1, [EXT]: 1, [BUS]: 0, [TRAM]: 0, [CS]: 1 }), 'a bike lane behind the extension takes the 2/7 car slot');
ok(fits(g, { [CAR]: 3, [BIKE]: 1, [EXT]: 0, [BUS]: 0, [TRAM]: 0, [CS]: 1 }), 'without the extension a bike lane on 1/8 still costs no car lane');
// lane counts: with no bike lane, the extension changes no lane count (its parking and public-space effects are chunk 3, handover_kerb_sim/)
const a = solveAll({ [EXT]: 0, [BIKE]: 0 }), b = solveAll({ [EXT]: 1, [BIKE]: 0 });
const diff = [...a.keys()].filter(k => /_lanes|_fit$/.test(k) && k !== EXT && Math.abs((a.get(k) || 0) - (b.get(k) || 0)) > 1e-9);
ok(!diff.length, 'without a bike lane the extension changes no lane count', diff.slice(0, 6).join(', '));

// reference
const f1 = (x, n = 1) => x.toFixed(n).padStart(8);
console.log(`\nE-W at 2*, per hour, 4/5 open (carsharing 1)`);
console.log(`${'lane 1/8 · 2/7'.padEnd(30)}${'cars'.padStart(8)}${'bikes'.padStart(8)}${'displ.'.padStart(8)}`);
for (const [label, ov] of [
  ['parking · car (car 3)', { [CAR]: 3, [BIKE]: 0, [EXT]: 0 }],
  ['extension · car (car 3)', { [CAR]: 3, [BIKE]: 0, [EXT]: 1 }],
  ['bike · car (car 3 + bike)', { [CAR]: 3, [BIKE]: 1, [EXT]: 0 }],
  ['extension · bike (car 2 + bike)', { [CAR]: 2, [BIKE]: 1, [EXT]: 1 }],
]) { const v = solve({ ...ov, [BUS]: 0, [TRAM]: 0, [CS]: 1 }); console.log(`${label.padEnd(30)}${f1(v('car_spawn_count_2'))}${f1(v('bike_spawn_count_2'))}${f1(v('displaced_cars'))}`); }
process.exitCode = failed ? 1 : 0;
