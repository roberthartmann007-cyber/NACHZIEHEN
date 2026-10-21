// Check chunk 2: the centre lane 4/5 (SP 3) opens only once carsharing is built at SP 4.
// Uses the editor's CES engine (a port of the game's solver), so the numbers are what the game would publish.
// Read-only: writes nothing.
// usage: node handover_centre_lane_gate/check_centre_lane_gate.js [project.json]
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const file = path.resolve(root, process.argv[2] || 'update.json');
const html = fs.readFileSync(path.join(root, 'BCC_Editor_BCC (1).html'), 'utf8');
const mod = { exports: {} };
new Function('module', 'globalThis', html.slice(html.indexOf('/*CES-ENGINE-BEGIN*/'), html.indexOf('/*CES-ENGINE-END*/')))(mod, {});
const CES = mod.exports;
const p = JSON.parse(fs.readFileSync(file, 'utf8'));
const raw = { nodes: p.nodes, edge_heuristics: p.edge_heuristics, system_rules: p.system_rules };
const solve = (ov = {}) => { const r = CES.solveRaw(raw, { overrides: ov }); if (!r.ok) throw new Error(r.error); return id => r.values.get(id); };
const by = new Map(p.nodes.map(n => [n.id, n]));
let failed = 0;
const ok = (cond, label, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`); if (!cond) failed++; };
const FIT = 'car_lanes_spawn_2_fit', TFIT = 'tram_line_center_fit', OPEN = 'lane_4_5_open', EXT = 'sidewalk_extension_spawn_2';
const CAR = 'car_lanes_spawn_2', BIKE = 'bike_lanes_spawn_2', BUS = 'bus_lanes_spawn_2', TRAM = 'tram_line_center', CS = 'carsharing';
console.log(`file: ${path.basename(file)}\n`);

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
ok(!!g && by.has(OPEN) && by.has(TFIT) && by.has(EXT), `lane_slots ew_street, ${OPEN}, ${TFIT} and ${EXT} exist`);
if (failed) process.exit(1);
const s45 = g.slots.find(s => s.lane === '4/5');
ok(s45.requires?.node === CS && s45.requires?.min === 1, 'slot 4/5 requires carsharing ≥ 1');
ok(g.slots.filter(s => s.requires).length === 1, 'no other slot is gated');
ok(by.get(OPEN).node_formula.expression === `${CS} >= 1 ? 1 : 0`, `${OPEN} = carsharing >= 1 ? 1 : 0`);
ok(by.get(TFIT).node_formula.expression === `min(${TRAM}, ${OPEN})`, `${TFIT} = min(tram, ${OPEN})`);
const ctx = new Set([...by.keys(), 'y', 'baseline', 'base', 'aggregate', 'computed']);
for (const id of [OPEN, TFIT, FIT]) ok(CES.validateExpression(by.get(id).node_formula.expression, false, ctx).ok, `${id} compiles in the game parser`);
const rawTram = p.nodes.filter(n => n.id !== TFIT && /\btram_line_center\b(?!_)/.test(n.node_formula?.expression || '')).map(n => n.id);
ok(!rawTram.length, `only ${TFIT} reads the tram lever`, rawTram.join(', '));
const E = p.spawn.elements, O = p.spawn.options;
ok(JSON.stringify(E.id_317.requires) === JSON.stringify([{ elem: 'id_326', any_of: ['id_331'] }]), 'spawn: SP 3 lane 4/5 element requires carsharing_station at SP 4');
ok(O.id_331.label === 'carsharing_station' && O.id_331.node_id === CS && E.id_326.spawnPointId === 'id_43', 'carsharing_station is the SP 4 pocket-module option writing carsharing');
ok(O.id_451.label === 'car_lane_4_mirrored_5' && O.id_451.node_id === CAR, `spawn: car_lane_4_mirrored_5 → ${CAR}`);
ok(by.get(CAR).value === 2 && fits(g, {}), 'saved layout (car 2, no carsharing) is buildable');

// behaviour: every E-W combination × carsharing 0..3
let agree = 0, ruleErr = 0, combos = 0, lockedBad = 0;
for (const cs of [0, 1, 2, 3]) for (let car = 0; car <= 3; car++) for (const bike of [0, 1]) for (const bus of [0, 1]) for (const tram of [0, 1]) for (const ext of [0, 1]) {
  const lv = { [CAR]: car, [BIKE]: bike, [BUS]: bus, [TRAM]: tram, [EXT]: ext, [CS]: cs }, v = solve(lv);
  combos++;
  const open = cs >= 1 ? 1 : 0, tfit = Math.min(tram, open), room = 2 + open - bus - tfit - Math.min(bike, ext);
  ruleErr = Math.max(ruleErr, Math.abs(v(FIT) - Math.max(0, Math.min(car, room))), Math.abs(v(TFIT) - tfit), Math.abs(v(OPEN) - open));
  if (fits(g, lv) === (car <= room && tram <= open)) agree++;
  if (!open && fits(g, lv) && (tram || car + bus + Math.min(bike, ext) > 2)) lockedBad++;
}
ok(agree === combos, `slot table and the guards agree on what is buildable, ${combos} combinations`, agree === combos ? '' : `${combos - agree} disagree`);
ok(ruleErr < 1e-9, `${FIT} = min(car, 2 + open − bus − tram − bike on 2/7); ${TFIT} = tram × open`, ruleErr ? `off by ${ruleErr}` : '');
ok(!lockedBad, 'without carsharing nothing is built on 4/5 (no tram, at most 2 lanes on 2/7 + 3/6)');
const base = { [BIKE]: 0, [BUS]: 0, [EXT]: 0 };
ok(!fits(g, { ...base, [CAR]: 3, [TRAM]: 0, [CS]: 0 }) && fits(g, { ...base, [CAR]: 3, [TRAM]: 0, [CS]: 1 }), 'car 3 needs carsharing');
ok(!fits(g, { ...base, [CAR]: 2, [TRAM]: 1, [CS]: 0 }) && fits(g, { ...base, [CAR]: 2, [TRAM]: 1, [CS]: 1 }), 'the tram needs carsharing');
ok(fits(g, { ...base, [CAR]: 2, [TRAM]: 0, [CS]: 0 }), 'the starting street (car 2, parking on 1/8 and 4/5) needs nothing');
ok(fits(g, { [CAR]: 1, [BIKE]: 1, [EXT]: 1, [BUS]: 0, [TRAM]: 0, [CS]: 0 }), 'lane 1/8 stays free: extension + bike on 2/7 works without carsharing');

// reference
const f1 = (x, n = 1) => x.toFixed(n).padStart(8);
console.log(`\nE-W at 2*, per hour`);
console.log(`${'layout'.padEnd(26)}${'cs'.padStart(4)}${'cars'.padStart(8)}${'bikes'.padStart(8)}${'trams'.padStart(8)}${'displ.'.padStart(8)}`);
for (const [label, ov] of [
  ['as saved', {}],
  ['car 2 (starting street)', { ...base, [CAR]: 2, [TRAM]: 0, [CS]: 0 }],
  ['car 2 + carsharing', { ...base, [CAR]: 2, [TRAM]: 0, [CS]: 1 }],
  ['car 3 (4/5 car lane)', { ...base, [CAR]: 3, [TRAM]: 0, [CS]: 1 }],
  ['car 2 + tram on 4/5', { ...base, [CAR]: 2, [TRAM]: 1, [CS]: 1 }],
]) { const v = solve(ov); console.log(`${label.padEnd(26)}${String(ov[CS] ?? by.get(CS).value).padStart(4)}${f1(v('car_spawn_count_2'))}${f1(v('bike_spawn_count_2'))}${f1(v('tram_spawn_count_2'), 2)}${f1(v('displaced_cars'))}`); }
process.exitCode = failed ? 1 : 0;
