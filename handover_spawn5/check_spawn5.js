// Check the vehicle spawn counts at 5* (north-south axis, south end) in a BCC project file.
// Uses the editor's CES engine (a port of the game's solver), so the numbers are what the game would publish.
// Read-only: writes nothing.
// usage: node handover_spawn5/check_spawn5.js [project.json]
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const file = path.resolve(root, process.argv[2] || 'bcc_project_2026-10-20_no-personas_ns-both-directions_2026-10-20_09-55.json');
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
const MODES = ['car', 'bike', 'bus', 'tram'];
const S5 = MODES.map(m => `${m}_spawn_count_5`);
console.log(`file: ${path.basename(file)}\n`);

// structure
ok(S5.every(id => by.has(id)), 'all four spawn 5 count nodes exist', S5.filter(id => !by.has(id)).join(', '));
if (failed) process.exit(1);
ok(S5.every(id => by.get(id).influenced_by.includes('trip_demand_spawn_5_h')), 'each reads trip_demand_spawn_5_h (demand at 5*)');
ok(MODES.every(m => by.get(`served_${m}`).influenced_by.includes(`${m}_spawn_count_5`) && /\b\w+_spawn_count_5\b/.test(by.get(`served_${m}`).node_formula.expression)), 'each feeds served_car / served_bike / served_bus / served_tram');
const ctx = new Set([...by.keys(), 'y', 'baseline', 'base', 'aggregate', 'computed']);
ok(S5.every(id => CES.validateExpression(by.get(id).node_formula.expression, false, ctx).ok), 'formulas compile in the game parser');

// behaviour, over north-south settings (everything else as saved)
const lever = id => by.get(id).value;
const NS = [];
for (const car of [0, 1, 2]) for (const bike of [0, 1]) for (const bus of [0, 1]) for (const tram of [0, 1]) NS.push({ car_lanes_spawn_4: car, bike_lanes_spawn_4: bike, bus_lanes_spawn_4: bus, tram_line_center: tram });
let ratioErr = { d: 0 }, busErr = 0, consErr = 0;
for (const ov of NS) {
  const v = solve(ov), k = v('trip_demand_spawn_5_h') / v('trip_demand_spawn_4_h');
  for (const m of ['car', 'bike', 'tram']) { const d = Math.abs(v(`${m}_spawn_count_5`) - v(`${m}_spawn_count_4`) * k); if (d > ratioErr.d) ratioErr = { d, m }; }
  const busExp = (v('trip_demand_spawn_5_h') * (v('mob_attract_bus') * (0.7 + 0.3 * Math.min(1, v('total_bus_lanes')))) / v('mode_util_spawn_4')) / v('occupancy_rates_busses');
  busErr = Math.max(busErr, Math.abs(v('bus_spawn_count_5') - busExp));
  const people = v('car_spawn_count_5') * v('occupancy_rates_cars') + v('bike_spawn_count_5') + v('bus_spawn_count_5') * v('occupancy_rates_busses') + v('tram_spawn_count_5') * v('occupancy_rates_trams');
  consErr = Math.max(consErr, Math.abs(people - v('trip_demand_spawn_5_h')));
}
const k0 = solve()('trip_demand_spawn_4_h') / solve()('trip_demand_spawn_5_h');
ok(ratioErr.d < 1e-9, `cars, bikes and trams at 5* = the spawn 4 count ÷ ${k0.toFixed(2)} (demand ratio 4* : 5*), ${NS.length} N-S settings`, ratioErr.m ? `${ratioErr.m} off by ${ratioErr.d}` : '');
ok(busErr < 1e-9, 'buses at 5* follow the spawn 4 bus formula with 5* demand, not rounded');
ok(consErr < 0.05, 'people served at 5* by all modes = demand at 5*', `worst gap ${consErr.toFixed(4)} people/h`);
ok(solve({ car_lanes_spawn_4: 0 })('car_spawn_count_5') === 0, 'no N-S car lane → no cars at 5*');
ok(solve({ tram_line_center: 0 })('tram_spawn_count_5') === 0, 'no tram line → no trams at 5*');
const b0 = solve({ bike_lanes_spawn_4: 0 }), b1 = solve({ bike_lanes_spawn_4: 1 });
ok(b1('bike_spawn_count_5') > b0('bike_spawn_count_5'), 'a N-S bike lane raises bikes at 5*');
const u0 = solve({ bus_lanes_spawn_4: 0 }), u1 = solve({ bus_lanes_spawn_4: 1 });
ok(u1('bus_spawn_count_5') > u0('bus_spawn_count_5'), 'a N-S bus lane raises buses at 5*');

// reference table
const f = (x, n = 1) => x.toFixed(n).padStart(8);
const rows = [
  ['as saved', {}],
  ['N-S car lanes 2', { car_lanes_spawn_4: 2 }],
  ['N-S car lanes 1', { car_lanes_spawn_4: 1 }],
  ['N-S car lanes 0', { car_lanes_spawn_4: 0 }],
  ['+ N-S bike lane', { bike_lanes_spawn_4: lever('bike_lanes_spawn_4') + 1 }],
  ['+ N-S bus lane', { bus_lanes_spawn_4: lever('bus_lanes_spawn_4') + 1 }],
  ['tram line on', { tram_line_center: 1 }],
];
console.log(`\nvehicles per hour at 5* (saved levers: N-S car ${lever('car_lanes_spawn_4')} · bike ${lever('bike_lanes_spawn_4')} · bus ${lever('bus_lanes_spawn_4')} · tram line ${lever('tram_line_center')}; E-W car ${lever('car_lanes_spawn_2')} · bike ${lever('bike_lanes_spawn_2')} · bus ${lever('bus_lanes_spawn_2')})`);
console.log(`${'setting'.padEnd(18)}${'cars'.padStart(8)}${'bikes'.padStart(8)}${'buses'.padStart(8)}${'trams'.padStart(8)}${'people'.padStart(8)}${'demand'.padStart(8)}`);
for (const [label, ov] of rows) {
  const v = solve(ov);
  const people = v('car_spawn_count_5') * v('occupancy_rates_cars') + v('bike_spawn_count_5') + v('bus_spawn_count_5') * v('occupancy_rates_busses') + v('tram_spawn_count_5') * v('occupancy_rates_trams');
  console.log(`${label.padEnd(18)}${f(v('car_spawn_count_5'))}${f(v('bike_spawn_count_5'))}${f(v('bus_spawn_count_5'), 2)}${f(v('tram_spawn_count_5'), 2)}${f(people, 0)}${f(v('trip_demand_spawn_5_h'), 0)}`);
}
const v = solve();
console.log(`\noccupancy: car ${v('occupancy_rates_cars')} · bus ${v('occupancy_rates_busses')} · tram ${v('occupancy_rates_trams')} people per vehicle`);
process.exitCode = failed ? 1 : 0;
