// Check Tier 2 backing: parking at city scale, ownership term, cars per station, bus-stop dynamic, lane-cap notes.
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
const NEW = ['bus_stop_design', 'all_door_boarding', 'boardings_per_bus_stop', 'bus_bulb_fit', 'bus_dwell_s', 'bus_stop_capacity_h',
  'bus_stop_saturation', 'bus_stop_queue_penalty', 'bus_stop_parking_loss', 'bus_stop_access'];
ok(NEW.every(id => by.has(id)), 'all new bus-stop nodes exist');
const ctx = new Set([...by.keys(), 'y', 'baseline', 'base', 'aggregate', 'computed']);
const bad = M.p.nodes.filter(n => n.node_formula?.enabled && !CES.validateExpression(n.node_formula.expression, false, ctx).ok).map(n => n.id);
ok(!bad.length, 'every formula compiles in the game parser', bad.join(', '));
const linkBad = Object.keys(M.p.edge_heuristics).filter(k => { const [s, d] = k.split('->'); return !by.get(s)?.influences.includes(d) || !by.get(d)?.influenced_by.includes(s); });
ok(!linkBad.length, 'every edge is listed on both of its nodes', linkBad.slice(0, 5).join(', '));
ok(!('bus_stops->mob_attract_bus' in M.p.edge_heuristics), 'bus_stops reaches bus attractiveness only through bus_stop_access');
ok(!by.get('cars_per_carsharing_station').notes.includes('[FLAG]'), 'cars per station: flag removed (bcs 2024)');
const opts = Object.values(M.p.spawn.options).filter(o => /^bus_stop_/.test(o.label));
ok(opts.length === 6 && opts.every(o => o.effects?.[0]?.node_id === 'bus_stop_design'), 'spawn: 3 stop designs on each of the 2 bus-stop elements set bus_stop_design', `${opts.length} options`);

// today unchanged
const t0 = run(OLD), t1 = run(M);
const moved = [...t0.values].filter(([k, v]) => Math.abs(v - t1.values.get(k)) > 1e-3).map(([k]) => k);
ok(!moved.length, 'today: every node unchanged against the file before this change', moved.join(', '));
const v0 = t1.values, base = cars(v0);
ok(Math.abs(v0.get('mob_attract_bus') - 30) < 1e-3, 'today: bus attractiveness 30 (3 stops, no lane)');

// 7. parking at city scale
const ext = run(M, { sidewalk_extension_spawn_2: 1 }).values;
const dExt = pct(cars(ext), base);
ok(dExt < -2.3 && dExt > -2.7, 'extension on 1/8 (−12 % kerb): about −2.5 % car trips', dExt.toFixed(2) + ' %');

// ownership at city scale
const k0 = JSON.parse(JSON.stringify(M.raw));
const ca = k0.nodes.find(n => n.id === 'car_attractivity_general');
ca.node_formula.expression = ca.node_formula.expression.replace(/- *[\d.]+\*cars_replaced_share/, '- 0*cars_replaced_share');
const csOn = cars(run(M, { carsharing: 1 }).values), csOff = cars(CES.solveRaw(k0, { overrides: { carsharing: 1 } }).values);
const dOwn = pct(csOn, csOff);
ok(dOwn < -8.2 && dOwn > -9.2, 'ownership term alone: about −8.6 % car trips with carsharing', dOwn.toFixed(2) + ' %');

// 9. bus stops
const BL = { bus_lanes_spawn_2: 1, bus_lanes_spawn_4: 1 };
const sc = ov => { const r = run(M, { ...BL, ...ov }); return { r, v: r.values }; };
const kerb = sc({}), bulbNoExt = sc({ bus_stop_design: 1 }), bulb = sc({ bus_stop_design: 1, sidewalk_extension_spawn_2: 1 }),
  door = sc({ all_door_boarding: 1 }), two = sc({ bus_stop_design: 2 });
ok(Math.abs(v0.get('bus_stop_capacity_h') - 40.6) < 0.2 && v0.get('bus_stop_queue_penalty') === 0, 'today: stop holds about 41 buses/h, no penalty', v0.get('bus_stop_capacity_h').toFixed(1));
ok(kerb.v.get('bus_stop_saturation') > 1 && kerb.v.get('bus_stop_queue_penalty') > 5, 'bus lanes + kerbside stop: the stop clogs and costs riders',
  `saturation ${kerb.v.get('bus_stop_saturation').toFixed(2)}, penalty ${kerb.v.get('bus_stop_queue_penalty').toFixed(1)}`);
ok(bulbNoExt.v.get('bus_bulb_fit') === 0 && Math.abs(bulbNoExt.v.get('bus_stop_capacity_h') - kerb.v.get('bus_stop_capacity_h')) < 1e-9, 'bulb without sidewalk extension counts as kerbside');
const pen = s => s.v.get('bus_stop_queue_penalty');
ok(pen(bulb) < pen(kerb) && pen(door) < pen(kerb) && pen(two) === 0, 'each upgrade relieves the stop; two bays clear it',
  `kerbside ${pen(kerb).toFixed(1)}, bulb ${pen(bulb).toFixed(1)}, all-door ${pen(door).toFixed(1)}, two bays ${pen(two).toFixed(1)}`);
ok(two.v.get('parallel_parking') === 174 && sc({ bus_stop_design: 2, sidewalk_extension_spawn_2: 1 }).v.get('parallel_parking') === 158, 'two-bay stop takes 6 spaces only while 1/8 is parking');
const acc = n => run(M, { bus_stops: n }).values.get('bus_stop_access');
ok(acc(3) - acc(2) < acc(2) - acc(1) && acc(2) - acc(1) < acc(1) - acc(0), 'stop access has diminishing returns', [0, 1, 2, 3].map(acc).map(x => x.toFixed(1)).join(' / '));
const loops = [kerb, bulb, door, two].map(s => s.r).concat([t1]);
ok(loops.every(r => r.converged && r.passes <= CES.MAX_PASSES), `the bus-stop loop settles within the game's ${CES.MAX_PASSES} passes`, loops.map(r => r.passes).join(', '));

// lane caps
ok(['bike_lanes_spawn_2', 'bike_lanes_spawn_4', 'bus_lanes_spawn_2', 'bus_lanes_spawn_4'].every(id => by.get(id).notes.startsWith('2026-10-28 (Tier 2 backing): Lane cap backed')), 'lane-cap notes corrected');

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks pass');
process.exit(failed ? 1 : 0);
