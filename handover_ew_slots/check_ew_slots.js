// Check the east-west lane slots (SP 2 + SP 3) in a BCC project file.
// Uses the editor's CES engine (a port of the game's solver), so the numbers are what the game would publish.
// Read-only: writes nothing.
// usage: node handover_ew_slots/check_ew_slots.js [project.json]
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
const FIT = 'car_lanes_spawn_2_fit';
const CAR = 'car_lanes_spawn_2', BIKE = 'bike_lanes_spawn_2', BUS = 'bus_lanes_spawn_2', TRAM = 'tram_line_center';
console.log(`file: ${path.basename(file)}\n`);

// same check as the editor's laneLayoutFits: every lane gets its own slot that fits it
const fits = (g, val) => {
  const lanes = [];
  Object.entries(g.levers).forEach(([mode, id]) => { for (let i = 0; i < Math.max(0, Math.round(val[id] || 0)); i++) lanes.push(mode); });
  if (lanes.length > g.slots.length) return false;
  const used = g.slots.map(() => false);
  const place = i => { if (i === lanes.length) return true; for (let s = 0; s < g.slots.length; s++) if (!used[s] && g.slots[s].fits.includes(lanes[i])) { used[s] = true; if (place(i + 1)) return true; used[s] = false; } return false; };
  return place(0);
};

// structure
const g = (p.lane_slots || []).find(x => x.id === 'ew_street');
ok(!!g, 'project file has lane_slots → ew_street');
ok(by.has(FIT), `${FIT} exists`);
if (failed) process.exit(1);
ok(g.slots.length === 4 && g.slots.map(s => s.lane).join() === '1/8,2/7,3/6,4/5', '4 slots per direction: 1/8, 2/7, 3/6, 4/5');
ok(g.slots.map(s => s.default).join() === 'parking,car,car,parking', 'default: parking on 1/8 and 4/5, car lanes on 2/7 and 3/6');
ok(Object.values(g.levers).every(id => by.get(id)?.type === 'active'), 'every lane_slots lever is an active node');
const ctx = new Set([...by.keys(), 'y', 'baseline', 'base', 'aggregate', 'computed']);
ok(CES.validateExpression(by.get(FIT).node_formula.expression, false, ctx).ok, 'formula compiles in the game parser');
const rawReaders = p.nodes.filter(n => n.id !== FIT && /\bcar_lanes_spawn_2\b(?!_)/.test(n.node_formula?.expression || '')).map(n => n.id);
ok(!rawReaders.length, `only ${FIT} reads the car lever`, rawReaders.join(', '));
ok(by.get(CAR).max === 3 && by.get(BIKE).max === 1 && by.get(BUS).max === 1 && by.get(TRAM).max === 1, 'lever ranges: car 0–3, bike 0–1, bus 0–1, tram 0–1');
ok(!by.has('sidewalk_extension_spawn_2'), 'no sidewalk lever (sidewalk and parking have no effect in the sim)');

// behaviour over every E-W lever combination (everything else as saved)
let ruleErr = 0, agree = 0, combos = 0, buildable = 0, consErr = 0;
for (let car = 0; car <= 3; car++) for (const bike of [0, 1]) for (const bus of [0, 1]) for (const tram of [0, 1]) {
  const lv = { [CAR]: car, [BIKE]: bike, [BUS]: bus, [TRAM]: tram }, v = solve(lv);
  combos++;
  const room = Math.max(0, Math.min(car, 3 - bus - tram));
  ruleErr = Math.max(ruleErr, Math.abs(v(FIT) - room));
  const f = fits(g, lv); if (f) buildable++;
  if (f === (car <= 3 - bus - tram)) agree++;
  for (const s of ['2', '3']) {
    const people = v(`car_spawn_count_${s}`) * v('occupancy_rates_cars') + v(`bike_spawn_count_${s}`) + v(`bus_spawn_count_${s}`) * v('occupancy_rates_busses') + v(`tram_spawn_count_${s}`) * v('occupancy_rates_trams');
    consErr = Math.max(consErr, Math.abs(people - v(`trip_demand_spawn_${s}_h`)) / Math.max(1, v(`trip_demand_spawn_${s}_h`)));
  }
}
ok(agree === combos, `the slot table and ${FIT} agree on what is buildable, ${combos} combinations`, `${combos - agree} disagree`);
ok(ruleErr < 1e-9, `${FIT} = min(car, 3 − bus − tram)`, ruleErr ? `off by ${ruleErr}` : '');
ok(consErr < 0.01, 'people served at 2* and 3* still add up to demand (bus rounding aside)', `worst gap ${(consErr * 100).toFixed(2)} %`);
const ex = { [CAR]: 3, [BIKE]: 1, [BUS]: 1, [TRAM]: 1 };
ok(!fits(g, ex) && fits(g, { ...ex, [CAR]: 1 }) && solve(ex)(FIT) === 1, 'example: bike + bus + tram leaves room for exactly 1 car lane');
ok(fits(g, { [CAR]: 3, [BIKE]: 1, [BUS]: 0, [TRAM]: 0 }), 'a bike lane never costs a car lane (car 3 + bike fits)');
ok(fits(g, { [CAR]: 2, [BIKE]: 0, [BUS]: 0, [TRAM]: 0 }), 'the default street (2 car lanes, parking) fits');
console.log(`  (${buildable} of ${combos} combinations are buildable)`);

// reference table
const f1 = (x, n = 1) => x.toFixed(n).padStart(8);
const rows = [
  ['as saved', {}],
  ['default: car 2', { [CAR]: 2, [BIKE]: 0, [BUS]: 0, [TRAM]: 0 }],
  ['car 3', { [CAR]: 3, [BIKE]: 0, [BUS]: 0, [TRAM]: 0 }],
  ['car 2 + bus', { [CAR]: 2, [BIKE]: 0, [BUS]: 1, [TRAM]: 0 }],
  ['car 3 + bike', { [CAR]: 3, [BIKE]: 1, [BUS]: 0, [TRAM]: 0 }],
  ['car 2 + tram', { [CAR]: 2, [BIKE]: 0, [BUS]: 0, [TRAM]: 1 }],
  ['car 1+bike+bus+tram', { [CAR]: 1, [BIKE]: 1, [BUS]: 1, [TRAM]: 1 }],
  ['car 0+bike+bus+tram', { [CAR]: 0, [BIKE]: 1, [BUS]: 1, [TRAM]: 1 }],
];
console.log(`\nE-W at 2*, per hour (buildable layouts only)`);
console.log(`${'setting'.padEnd(21)}${'cars'.padStart(8)}${'bikes'.padStart(8)}${'buses'.padStart(8)}${'trams'.padStart(8)}${'displ.'.padStart(8)}`);
for (const [label, ov] of rows) {
  const v = solve(ov);
  console.log(`${label.padEnd(21)}${f1(v('car_spawn_count_2'))}${f1(v('bike_spawn_count_2'))}${f1(v('bus_spawn_count_2'), 2)}${f1(v('tram_spawn_count_2'), 2)}${f1(v('displaced_cars'))}`);
}
process.exitCode = failed ? 1 : 0;
