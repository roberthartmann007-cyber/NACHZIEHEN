// Check Tier 3 backing: seating normalized to the furniture ceiling, extension activity needs seating, dooring on the north-south street.
// Uses the editor's CES engine (a port of the game's solver). Read-only: writes nothing.
// usage: node handover_tier3_backing/check_tier3_backing.js [project.json]
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const file = path.resolve(root, process.argv[2] || 'update.json');
const html = fs.readFileSync(path.join(root, 'BCC_Editor_BCC (1).html'), 'utf8');
const mod = { exports: {} };
new Function('module', 'globalThis', html.slice(html.indexOf('/*CES-ENGINE-BEGIN*/'), html.indexOf('/*CES-ENGINE-END*/')))(mod, {});
const CES = mod.exports;
const load = f => { const p = JSON.parse(fs.readFileSync(f, 'utf8')); return { p, raw: { nodes: p.nodes, edge_heuristics: p.edge_heuristics, system_rules: p.system_rules } }; };
const M = load(file), OLD = load(path.join(root, 'archive', 'update_before-tier3-backing.json'));
const run = (m, ov = {}) => { const r = CES.solveRaw(m.raw, { overrides: ov }); if (!r.ok) throw new Error(r.error); return r; };
const by = new Map(M.p.nodes.map(n => [n.id, n]));
let failed = 0;
const ok = (c, label, detail = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`); if (!c) failed++; };
const near = (a, b, t = 1e-6) => Math.abs(a - b) < t;
console.log(`file: ${path.basename(file)}\n`);

// structure
ok(['urban_furniture_max', 'urban_furniture_share', 'ns_outer_parking_spawn_4'].every(id => by.has(id)), 'new nodes exist');
const ctx = new Set([...by.keys(), 'y', 'baseline', 'base', 'aggregate', 'computed']);
const bad = M.p.nodes.filter(n => n.node_formula?.enabled && !CES.validateExpression(n.node_formula.expression, false, ctx).ok).map(n => n.id);
ok(!bad.length, 'every formula compiles in the game parser', bad.join(', '));
const linkBad = Object.keys(M.p.edge_heuristics).filter(k => { const [s, d] = k.split('->'); return !by.get(s)?.influences.includes(d) || !by.get(d)?.influenced_by.includes(s); });
ok(!linkBad.length, 'every edge is listed on both of its nodes', linkBad.slice(0, 5).join(', '));
const fixed6 = M.p.nodes.filter(n => /urban_furniture\s*\/\s*6|urban_furniture\s*>\s*6/.test(n.node_formula?.expression || '')).map(n => n.id);
ok(!fixed6.length, 'no formula divides by or compares with a fixed 6 pieces', fixed6.join(', '));
ok(!('urban_furniture->space_activity_index' in M.p.edge_heuristics) && !('urban_furniture->pedestrians_stationary' in M.p.edge_heuristics),
  'raw furniture no longer links into the seating formulas (it would leak into base)');

// today unchanged
const t0 = run(OLD), t1 = run(M);
const moved = [...t0.values].filter(([k, v]) => Math.abs(v - t1.values.get(k)) > 1e-6).map(([k]) => k);
ok(!moved.length, 'today: every node unchanged against the file before this change', moved.join(', '));

// 10. seating unchanged without extension, at every furniture count
const SEAT = ['space_activity_index', 'pedestrians_stationary', 'public_space_quality'];
const same = [0, 1, 3, 6].every(f => [0, 2].every(c => { const a = run(OLD, { urban_furniture: f, cafe: c }).values, b = run(M, { urban_furniture: f, cafe: c }).values; return SEAT.every(k => near(a.get(k), b.get(k))); }));
ok(same, 'no extension: seating results match the old formulas for 0/1/3/6 pieces and 0/2 cafés');
const sai = ov => run(M, ov).values.get('space_activity_index');
const d = ov => sai({ ...ov, sidewalk_extension_spawn_2: 1 }) - sai({ ...ov, sidewalk_extension_spawn_2: 0 });
ok(near(d({ urban_furniture: 0, cafe: 0 }), 0), 'empty extension adds no activity', d({ urban_furniture: 0, cafe: 0 }).toFixed(2));
ok(near(d({ urban_furniture: 3, cafe: 1 }), 1.9, 0.1) && near(d({ urban_furniture: 6, cafe: 2 }), 1.0, 0.1), 'extension with seating: +1.9 at half, +1.0 at full',
  `${d({ urban_furniture: 3, cafe: 1 }).toFixed(2)} / ${d({ urban_furniture: 6, cafe: 2 }).toFixed(2)}`);

// 10. a new ceiling rescales everything
const at = (f, max) => run(M, { urban_furniture: f, urban_furniture_max: max, cafe: 1, sidewalk_extension_spawn_2: 1 }).values;
const full6 = at(6, 6), full10 = at(10, 10), half6 = at(3, 6), half10 = at(5, 10);
ok(SEAT.every(k => near(full6.get(k), full10.get(k)) && near(half6.get(k), half10.get(k))), 'ceiling 6 → 10: full and half the ceiling give the same results as before');
// blue_infrastructure is 2 today (over its own limit of 1), which would mask the furniture flag; 7 pieces also exceed the 8-module budget either way
const lim = (f, max) => run(M, { urban_furniture: f, urban_furniture_max: max, blue_infrastructure: 1 }).values.get('plaza_check_limits');
ok(lim(7, 6) - lim(7, 10) === 1, 'plaza furniture limit follows the ceiling: 7 pieces flagged under a ceiling of 6, not under 10', `${lim(7, 6)} / ${lim(7, 10)}`);

// 11. dooring on the north-south street
// mob_attract_bikes is rounded to whole points in the game, so −5.5 shows as −5 or −6 and −2.75 as −3
const bike = ov => run(M, ov).values.get('mob_attract_bikes');
const NS = { bike_lanes_spawn_4: 1 };
const door = pr => bike({ ...NS, bike_lane_protection: pr, ns_outer_parking_spawn_4: 1 }) - bike({ ...NS, bike_lane_protection: pr, ns_outer_parking_spawn_4: 0 });
ok(near(door(0), -5.5, 0.51), 'N-S bike lane next to a/f parking: −5.5 against greenery (rounded)', door(0).toFixed(2));
ok(door(4) === 0, 'full protection removes dooring');
ok(near(door(2), -2.75, 0.51), 'half protection halves it (rounded)', door(2).toFixed(2));
ok(near(bike({ bike_lanes_spawn_2: 1, bike_lanes_spawn_4: 0, ns_outer_parking_spawn_4: 1 }), bike({ bike_lanes_spawn_2: 1, bike_lanes_spawn_4: 0, ns_outer_parking_spawn_4: 0 })), 'east-west bike lane only: no dooring');
const o = M.p.spawn.options;
ok(o.id_349.effects?.[0]?.node_id === 'ns_outer_parking_spawn_4' && o.id_349.effects[0].value === 1 && o.id_344.effects?.[0]?.value === 0,
  'spawn: a/f parking sets the lever to 1, greenery with pockets to 0');
const rs = [t1, run(M, { ...NS }), at(10, 10) && run(M, { urban_furniture: 10, urban_furniture_max: 10 })];
ok(rs.every(r => r.converged && r.passes <= CES.MAX_PASSES), `settles within the game's ${CES.MAX_PASSES} passes`, rs.map(r => r.passes).join(', '));

// 12 and 13
ok(by.get('carsharing_stations').notes.startsWith('2026-10-28 (Tier 3 backing): Kept as a game decision'), '12: pocket stations recorded as a game decision');
ok(M.p.lane_slots.find(g => g.id === 'ew_street').yields.extension.join() === 'bike', '13: extension yield rule left as is');

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks pass');
process.exit(failed ? 1 : 0);
