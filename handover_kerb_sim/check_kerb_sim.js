// Check chunk 3: kerb space in the sim (parking supply, carsharing network, room to stay).
// 2026-10-28: updated for the Tier 1 backing (reference occupancy 0.95) and the Tier 2 backing (parking slope 48, ownership term -60; see handover_tier2_backing).
// Uses the editor's CES engine (a port of the game's solver), so the numbers are what the game would publish.
// Read-only: writes nothing.
// usage: node handover_kerb_sim/check_kerb_sim.js [project.json]
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
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;
const EXT = 'sidewalk_extension_spawn_2', BIKE = 'bike_lanes_spawn_2', CS = 'carsharing', CA = 'car_attractivity_general';
console.log(`file: ${path.basename(file)}\n`);

// structure
const NEW = ['parking_spaces_map', 'parking_occupancy_ref', 'spaces_1_8', 'spaces_4_5', 'cars_replaced_per_shared_car', 'carsharing_stations', 'cars_per_carsharing_station', 'extension_segment_length_m',
  'carsharing_cars', 'cars_replaced', 'private_cars_parked', 'parking_occupancy', 'parking_availability', 'cars_replaced_share', 'sidewalk_extension_area'];
const missing = NEW.filter(id => !by.has(id));
ok(!missing.length, 'all new nodes exist', missing.join(', '));
if (failed) process.exit(1);
ok(by.get(CS).max === 1 && by.get(CS).value === 0, 'carsharing is one 0/1 decision, saved 0');
ok(!('carsharing->parallel_parking' in p.edge_heuristics), 'carsharing no longer subtracts parking spaces directly');
ok(!('parallel_parking->mob_attract_bikes' in p.edge_heuristics) && !by.get('mob_attract_bikes').influenced_by.includes('parallel_parking'), 'dooring edge removed');
const ctx = new Set([...by.keys(), 'y', 'baseline', 'base', 'aggregate', 'computed']);
const bad = p.nodes.filter(n => n.node_formula?.enabled && /parking|carsharing|cars_replaced|sidewalk_extension|car_attractivity|space_activity|pedestrians_stationary/.test(n.id) && !CES.validateExpression(n.node_formula.expression, false, ctx).ok).map(n => n.id);
ok(!bad.length, 'all touched formulas compile in the game parser', bad.join(', '));
const refsOk = ['car_attractivity_general', 'parallel_parking', 'pedestrians_stationary', 'space_activity_index'].every(id => { const n = by.get(id); return n.influenced_by.every(pid => new RegExp(`\\b${pid}\\b`).test(n.node_formula.expression) || !['parallel_parking', 'parking_availability', 'cars_replaced_share'].includes(pid)); });
ok(refsOk, 'car attractiveness names every parking parent, so its base aggregate is unchanged');
const o = p.spawn.options.id_331;
ok(o.label === 'carsharing_station' && JSON.stringify(o.effects) === JSON.stringify([{ node_id: CS, op: 'set', value: 1 }]), 'spawn: carsharing_station sets carsharing = 1');

// today
const v0 = solve();
ok(v0('parallel_parking') === 180 && near(v0('private_cars_parked'), 171) && near(v0('parking_availability'), 1, 1e-9), 'today: 180 spaces, 171 parked cars (0.95), availability 1');
ok(near(v0('carsharing_cars'), 6, 1e-9) && near(solve({ [CS]: 1 })('cars_replaced'), 54, 1e-9), 'network: 3 stations × 2 = 6 shared cars, replacing 6 × 9 = 54 private cars (≥ the 52 from lane 4/5)');

// scenarios: change of car attractiveness vs today (everything else fixed so only the parking and ownership terms move)
const term = v => Math.max(-15, Math.min(8, 6 + 48 * (v('parking_availability') - 1))) - 60 * v('cars_replaced_share');
const T0 = term(v0);
ok(near(T0, 6, 1e-9), 'today the parking term is +6, as before');
const SC = [
  // Tier 4 (2026-10-28): lane 1/8 holds 38 spaces (EAR 23 stalls, StVO clearances, 4 stretches), was 22.
  ['parking on 1/8 removed (extension)', { [EXT]: 1, [BIKE]: 0, [CS]: 0 }, 142, 171, -10.13],
  ['parking on 1/8 removed (bike lane)', { [EXT]: 0, [BIKE]: 1, [CS]: 0 }, 142, 171, -10.13],
  ['carsharing: 4/5 emptied', { [EXT]: 0, [BIKE]: 0, [CS]: 1 }, 128, 117, -17.06],
  ['carsharing + 1/8 removed', { [EXT]: 1, [BIKE]: 0, [CS]: 1 }, 90, 117, -31.87],
];
const rows = [];
for (const [label, ov, spaces, cars, dCA] of SC) {
  const v = solve(ov), d = term(v) - T0;
  ok(v('parallel_parking') === spaces && near(v('private_cars_parked'), cars) && near(d, dCA, 0.01), `${label}: ${spaces} spaces, ${cars} cars, car attractiveness ${dCA}`, `got ${v('parallel_parking')}, ${v('private_cars_parked').toFixed(0)}, ${d.toFixed(2)}`);
  rows.push([label, v]);
}

// room to stay
const off = solve({ [EXT]: 0 }), on = solve({ [EXT]: 1 });
ok(['space_activity_index', 'public_space_quality', 'pedestrians_stationary'].every(id => near(off(id), v0(id), 1e-9)), 'extension off: activity, public space quality and lingering unchanged');
// Tier 3 (2026-10-28): the extension's activity term needs seating, so this is checked with half the furniture ceiling in place
const offS = solve({ [EXT]: 0, urban_furniture: 3 }), onS = solve({ [EXT]: 1, urban_furniture: 3 });
ok(onS('space_activity_index') > offS('space_activity_index') && onS('public_space_quality') > offS('public_space_quality') && onS('pedestrians_stationary') >= offS('pedestrians_stationary'), 'extension on, with seating: activity, public space quality and lingering go up');
ok(on('pedestrians_stationary') >= off('pedestrians_stationary'), 'extension on, no seating: lingering room still grows (area term)');
ok(near(on('sidewalk_extension_area'), 2700, 1e-9), 'extension area: fixed 2,700 m² from the game set-up (2026-10-29; was 4 × 65 m × 2.0 m = 520 m²)');

// reference table
const f = (x, n = 1) => x.toFixed(n).padStart(9);
console.log(`\n${'scenario'.padEnd(36)}${'spaces'.padStart(9)}${'cars'.padStart(9)}${'occup.'.padStart(9)}${'car attr'.padStart(9)}${'cars 2*'.padStart(9)}${'PSQ'.padStart(9)}${'linger'.padStart(9)}`);
for (const [label, v] of [['today', v0], ...rows]) console.log(`${label.padEnd(36)}${f(v('parallel_parking'), 0)}${f(v('private_cars_parked'), 0)}${f(v('parking_occupancy'), 2)}${f(v(CA))}${f(v('car_spawn_count_2'), 0)}${f(v('public_space_quality'), 2)}${f(v('pedestrians_stationary'), 0)}`);
process.exitCode = failed ? 1 : 0;
