// Check the north-south lane slots (SP 4, demand at 4* and 5*) in a BCC project file.
// Uses the editor's CES engine (a port of the game's solver), so the numbers are what the game would publish.
// Read-only: writes nothing.
// usage: node handover_ns_slots/check_ns_slots.js [project.json]
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
const FIT = 'car_lanes_spawn_4_fit';
const CAR = 'car_lanes_spawn_4', BIKE = 'bike_lanes_spawn_4', BUS = 'bus_lanes_spawn_4';
console.log(`file: ${path.basename(file)}\n`);

// same check as the editor's laneLayoutFits: every lane gets its own slot that fits it, and a filled street has no empty slot
const fits = (g, val) => {
  const lanes = [];
  Object.entries(g.levers).forEach(([mode, id]) => { for (let i = 0; i < Math.max(0, Math.round(val[id] || 0)); i++) lanes.push(mode); });
  if (lanes.length > g.slots.length || (g.filled && lanes.length < g.slots.length)) return false;
  const used = g.slots.map(() => false);
  const place = i => { if (i === lanes.length) return true; for (let s = 0; s < g.slots.length; s++) if (!used[s] && g.slots[s].fits.includes(lanes[i])) { used[s] = true; if (place(i + 1)) return true; used[s] = false; } return false; };
  return place(0);
};

// structure
const g = (p.lane_slots || []).find(x => x.id === 'ns_street');
ok(!!g, 'project file has lane_slots → ns_street');
ok(by.has(FIT), `${FIT} exists`);
if (failed) process.exit(1);
ok(g.slots.length === 2 && g.slots.map(s => s.lane).join() === 'b/e,c/d', '2 slots per direction: b/e, c/d (a/f has no effect in the sim)');
ok(g.slots.every(s => s.default === 'car' && ['car', 'bike', 'bus'].every(m => s.fits.includes(m))), 'default: car lanes on b/e and c/d; each fits car, bike and bus');
ok(g.filled === true && g.fill_with === 'car', 'filled street: every slot holds a lane, a freed slot goes back to car');
ok(Object.values(g.levers).every(id => by.get(id)?.type === 'active'), 'every lane_slots lever is an active node');
ok(!('tram' in g.levers), 'no tram on the north-south street');
const ctx = new Set([...by.keys(), 'y', 'baseline', 'base', 'aggregate', 'computed']);
ok(CES.validateExpression(by.get(FIT).node_formula.expression, false, ctx).ok, 'formula compiles in the game parser');
const rawReaders = p.nodes.filter(n => n.id !== FIT && /\bcar_lanes_spawn_4\b(?!_)/.test(n.node_formula?.expression || '')).map(n => n.id);
ok(!rawReaders.length, `only ${FIT} reads the car lever`, rawReaders.join(', '));
ok(by.get(CAR).max === 2 && by.get(BIKE).max === 1 && by.get(BUS).max === 1, 'lever ranges: car 0–2, bike 0–1, bus 0–1');
const saved = { [CAR]: by.get(CAR).value, [BIKE]: by.get(BIKE).value, [BUS]: by.get(BUS).value };
ok(fits(g, saved), 'the saved layout is buildable', Object.entries(saved).map(([k, v]) => `${k} ${v}`).join(', '));

// behaviour over every N-S lever combination (everything else as saved)
let ruleErr = 0, agree = 0, combos = 0, buildable = 0, consErr = 0;
for (let car = 0; car <= 2; car++) for (const bike of [0, 1]) for (const bus of [0, 1]) {
  const lv = { [CAR]: car, [BIKE]: bike, [BUS]: bus }, v = solve(lv);
  combos++;
  ruleErr = Math.max(ruleErr, Math.abs(v(FIT) - Math.max(0, Math.min(car, 2 - bike - bus))));
  const f = fits(g, lv); if (f) buildable++;
  if (f === (car + bike + bus === 2)) agree++;
  for (const s of ['4', '5']) {
    const people = v(`car_spawn_count_${s}`) * v('occupancy_rates_cars') + v(`bike_spawn_count_${s}`) + v(`bus_spawn_count_${s}`) * v('occupancy_rates_busses');
    consErr = Math.max(consErr, Math.abs(people - v(`trip_demand_spawn_${s}_h`)) / (v('occupancy_rates_busses') / 2)); // 4* rounds to whole buses
  }
}
ok(agree === combos, `the slot table says car + bike + bus = 2, ${combos} combinations`, `${combos - agree} disagree`);
ok(buildable === 4, 'exactly 4 layouts are buildable: car 2 · car 1 + bike · car 1 + bus · bike + bus', `${buildable} found`);
ok(ruleErr < 1e-9, `${FIT} = min(car, 2 − bike − bus)`, ruleErr ? `off by ${ruleErr}` : '');
ok(consErr <= 1 + 1e-9, 'people served at 4* and 5* still add up to demand, within half a bus (4* rounds to whole buses)', `worst gap ${consErr.toFixed(2)} × half a bus`);
ok(!fits(g, { [CAR]: 2, [BIKE]: 1, [BUS]: 0 }) && solve({ [CAR]: 2, [BIKE]: 1, [BUS]: 0 })(FIT) === 1, 'example: a bike lane takes a car lane (car 2 + bike does not fit; the guard gives 1)');
ok(!fits(g, { [CAR]: 1, [BIKE]: 0, [BUS]: 0 }), 'an empty slot is not buildable (car 1 alone)');

// reference table
const f1 = (x, n = 1) => x.toFixed(n).padStart(8);
const rows = [
  ['as saved', {}],
  ['default: car 2', { [CAR]: 2, [BIKE]: 0, [BUS]: 0 }],
  ['car 1 + bike', { [CAR]: 1, [BIKE]: 1, [BUS]: 0 }],
  ['car 1 + bus', { [CAR]: 1, [BIKE]: 0, [BUS]: 1 }],
  ['car 0 + bike + bus', { [CAR]: 0, [BIKE]: 1, [BUS]: 1 }],
];
console.log(`\nN-S per hour (buildable layouts only; 5* is always 4* ÷ 7)`);
console.log(`${'setting'.padEnd(20)}${'cars 4*'.padStart(9)}${'bikes 4*'.padStart(9)}${'buses 4*'.padStart(9)}${'cars 5*'.padStart(9)}${'displ.'.padStart(9)}`);
for (const [label, ov] of rows) {
  const v = solve(ov);
  console.log(`${label.padEnd(20)} ${f1(v('car_spawn_count_4'))} ${f1(v('bike_spawn_count_4'))} ${f1(v('bus_spawn_count_4'), 2)} ${f1(v('car_spawn_count_5'))} ${f1(v('displaced_cars'))}`);
}
process.exitCode = failed ? 1 : 0;
