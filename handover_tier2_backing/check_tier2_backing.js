// Check Tier 2 backing: parking at city scale, ownership term, cars per station, bus stop, lane-cap notes.
// 2026-10-29: bus-stop checks rewritten for the one simple stop (see handover_bus_stop_simple).
// Uses the editor's CES engine (a port of the game's solver). Read-only: writes nothing.
// usage: node handover_tier2_backing/check_tier2_backing.js [project.json]
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const file = path.resolve(root, process.argv[2] || 'update.json');
const html = fs.readFileSync(path.join(root, 'BCC_Editor_BCC (1).html'), 'utf8');
const mod = { exports: {} };
new Function('module', 'globalThis', html.slice(html.indexOf('/*CES-ENGINE-BEGIN*/'), html.indexOf('/*CES-ENGINE-END*/')))(mod, {});
const CES = mod.exports;
const load = f => { const p = JSON.parse(fs.readFileSync(f, 'utf8')); return { p, raw: { nodes: p.nodes, edge_heuristics: p.edge_heuristics, system_rules: p.system_rules } }; };
const M = load(file), OLD = load(path.join(root, 'archive', 'update_before-tier2-backing.json'));
const run = (m, ov = {}) => { const r = CES.solveRaw(m.raw, { overrides: ov }); if (!r.ok) throw new Error(r.error); return r; };
const by = new Map(M.p.nodes.map(n => [n.id, n]));
let failed = 0;
const ok = (c, label, detail = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`); if (!c) failed++; };
const cars = v => ['car_spawn_count_2', 'car_spawn_count_3', 'car_spawn_count_4', 'car_spawn_count_5'].reduce((s, i) => s + v.get(i), 0);
const pct = (a, b) => (a / b - 1) * 100;
console.log(`file: ${path.basename(file)}\n`);

// structure
// 2026-10-29: the stop designs and the congestion loop were replaced by one stop (handover_bus_stop_simple).
const GONE = ['bus_stop_design', 'all_door_boarding', 'boardings_per_bus_stop', 'bus_bulb_fit', 'bus_dwell_s', 'bus_stop_capacity_h',
  'bus_stop_saturation', 'bus_stop_queue_penalty', 'bus_stop_parking_loss'];
ok(by.has('bus_stop_access') && by.has('new_bus_stop') && GONE.every(id => !by.has(id)), 'bus stop: new_bus_stop and bus_stop_access exist, the old stop nodes are gone');
const txt = JSON.stringify({ n: M.p.nodes.map(n => ({ ...n, notes: '' })), e: Object.keys(M.p.edge_heuristics), o: M.p.spawn.options });
ok(GONE.every(id => !txt.includes(`"${id}"`) && !txt.includes(id + '->') && !txt.includes('->' + id)), 'nothing links to a removed stop node');
const ctx = new Set([...by.keys(), 'y', 'baseline', 'base', 'aggregate', 'computed']);
const bad = M.p.nodes.filter(n => n.node_formula?.enabled && !CES.validateExpression(n.node_formula.expression, false, ctx).ok).map(n => n.id);
ok(!bad.length, 'every formula compiles in the game parser', bad.join(', '));
const linkBad = Object.keys(M.p.edge_heuristics).filter(k => { const [s, d] = k.split('->'); return !by.get(s)?.influences.includes(d) || !by.get(d)?.influenced_by.includes(s); });
ok(!linkBad.length, 'every edge is listed on both of its nodes', linkBad.slice(0, 5).join(', '));
ok(!('bus_stops->mob_attract_bus' in M.p.edge_heuristics), 'bus_stops reaches bus attractiveness only through bus_stop_access');
ok(!by.get('cars_per_carsharing_station').notes.includes('[FLAG]'), 'cars per station: flag removed (bcs 2024)');
const opts = Object.values(M.p.spawn.options).filter(o => o.node_id === 'new_bus_stop' || o.effects?.some(e => e.node_id === 'new_bus_stop'));
ok(opts.length === 2 && opts.every(o => o.elemId === 'id_387') && !M.p.spawn.elements.id_384, 'spawn: one stop element (under the 2/7 bus lane) with nothing / bus_stop', `${opts.length} options`);

// today unchanged
const t0 = run(OLD), t1 = run(M);
// Tier 4 (2026-10-28) recounted lane 1/8 on purpose (22 → 38 spaces); that input is no longer "unchanged".
const moved = [...t0.values].filter(([k, v]) => k !== 'spaces_1_8' && Math.abs(v - t1.values.get(k)) > 1e-3).map(([k]) => k);
ok(!moved.length, 'today: every node unchanged against the file before this change', moved.join(', '));
const v0 = t1.values, base = cars(v0);
ok(Math.abs(v0.get('mob_attract_bus') - 30) < 1e-3, 'today: bus attractiveness 30 (3 stops, no lane)');

// 7. parking at city scale
const ext = run(M, { sidewalk_extension_spawn_2: 1 }).values;
const dExt = pct(cars(ext), base);
// Tier 4 (2026-10-28): lane 1/8 holds 38 spaces, so the extension removes 21 % of kerb (was 12 %, −2.5 %).
ok(dExt < -4.2 && dExt > -4.6, 'extension on 1/8 (−21 % kerb): about −4.4 % car trips', dExt.toFixed(2) + ' %');

// ownership at city scale
const k0 = JSON.parse(JSON.stringify(M.raw));
const ca = k0.nodes.find(n => n.id === 'car_attractivity_general');
ca.node_formula.expression = ca.node_formula.expression.replace(/- *[\d.]+\*cars_replaced_share/, '- 0*cars_replaced_share');
const csOn = cars(run(M, { carsharing: 1 }).values), csOff = cars(CES.solveRaw(k0, { overrides: { carsharing: 1 } }).values);
const dOwn = pct(csOn, csOff);
ok(dOwn < -8.2 && dOwn > -9.2, 'ownership term alone: about −8.6 % car trips with carsharing', dOwn.toFixed(2) + ' %');

// 9. bus stops (2026-10-29: one simple stop, +20 while the east-west bus lane is there)
const mab = ov => run(M, ov).values.get('mob_attract_bus');
ok(by.get('new_bus_stop').value === 0 && by.get('new_bus_stop').baseline_value === 0, 'today: no stop built here');
ok(Math.abs(mab({ bus_lanes_spawn_2: 1, new_bus_stop: 1 }) - mab({ bus_lanes_spawn_2: 1 }) - 20) < 1e-9, 'the stop adds exactly 20 with the east-west bus lane');
ok(Math.abs(mab({ bus_lanes_spawn_2: 1, bus_lanes_spawn_4: 1, new_bus_stop: 1 }) - mab({ bus_lanes_spawn_2: 1, bus_lanes_spawn_4: 1 }) - 20) < 1e-9, 'the stop adds exactly 20 with both bus lanes');
ok(Math.abs(mab({ new_bus_stop: 1 }) - mab({})) < 1e-9, 'without the bus lane the stop adds nothing (it sits in that lane)');
const park = ov => run(M, ov).values.get('parallel_parking');
ok(park({ bus_lanes_spawn_2: 1, new_bus_stop: 1 }) === park({ bus_lanes_spawn_2: 1 }) && park({}) === 180, 'the stop takes no parking spaces');
const acc = n => run(M, { bus_stops: n }).values.get('bus_stop_access');
ok(acc(3) - acc(2) < acc(2) - acc(1) && acc(2) - acc(1) < acc(1) - acc(0), 'stop access has diminishing returns', [0, 1, 2, 3].map(acc).map(x => x.toFixed(1)).join(' / '));
const SC = [{}, { bus_lanes_spawn_2: 1 }, { bus_lanes_spawn_2: 1, new_bus_stop: 1 }, { bus_lanes_spawn_2: 1, bus_lanes_spawn_4: 1, new_bus_stop: 1 },
  { bus_lanes_spawn_2: 1, bus_lanes_spawn_4: 1, new_bus_stop: 1, sidewalk_extension_spawn_2: 1 }];
const loops = SC.map(ov => run(M, ov));
ok(loops.every(r => r.converged && r.passes <= CES.MAX_PASSES), `every bus scenario settles within the game's ${CES.MAX_PASSES} passes`, loops.map(r => r.passes).join(', '));

// lane caps
ok(['bike_lanes_spawn_2', 'bike_lanes_spawn_4', 'bus_lanes_spawn_2', 'bus_lanes_spawn_4'].every(id => by.get(id).notes.startsWith('2026-10-28 (Tier 2 backing): Lane cap backed')), 'lane-cap notes corrected');

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks pass');
process.exit(failed ? 1 : 0);
