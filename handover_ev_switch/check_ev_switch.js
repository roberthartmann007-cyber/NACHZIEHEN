// Check the EV switch: wiring, NO2 / PM2.5 / noise effects, and that nothing changes while it is off.
// Uses the editor's CES engine (a port of the game's solver). Read-only: writes nothing.
// usage: node handover_ev_switch/check_ev_switch.js [project.json]
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const file = path.resolve(root, process.argv[2] || 'update.json');
const html = fs.readFileSync(path.join(root, 'BCC_Editor_BCC (1).html'), 'utf8');
const mod = { exports: {} };
new Function('module', 'globalThis', html.slice(html.indexOf('/*CES-ENGINE-BEGIN*/'), html.indexOf('/*CES-ENGINE-END*/')))(mod, {});
const CES = mod.exports;
const load = f => { const p = JSON.parse(fs.readFileSync(f, 'utf8')); return { p, raw: { nodes: p.nodes, edge_heuristics: p.edge_heuristics, system_rules: p.system_rules } }; };
const M = load(file), OLD = load(path.join(root, 'archive', 'update_before-ev-switch.json'));
const run = (m, ov = {}) => { const r = CES.solveRaw(m.raw, { overrides: ov }); if (!r.ok) throw new Error(r.error); return r; };
const by = new Map(M.p.nodes.map(n => [n.id, n]));
let failed = 0;
const ok = (c, label, detail = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`); if (!c) failed++; };
const near = (a, b, t = 1e-6) => Math.abs(a - b) < t;
const f2 = v => Number(v).toFixed(2);
console.log(`file: ${path.basename(file)}\n`);

// structure
const ev = by.get('ev_charger');
ok(ev && ev.min === 0 && ev.max === 1 && ev.active_control === 'switches', 'ev_charger is a 0/1 switch');
const ctx = new Set([...by.keys(), 'y', 'x', 'baseline', 'base', 'aggregate', 'computed']);
const bad = M.p.nodes.filter(n => n.node_formula?.enabled && !CES.validateExpression(n.node_formula.expression, false, ctx).ok).map(n => n.id);
ok(!bad.length, 'every node formula compiles in the game parser', bad.join(', '));
const badE = ['ev_charger->no2', 'ev_charger->pm25'].filter(k => !CES.validateExpression(M.p.edge_heuristics[k].formula.expression, true, ctx).ok);
ok(!badE.length, 'EV edge formulas compile in the game parser', badE.join(', '));
const linkBad = Object.keys(M.p.edge_heuristics).filter(k => { const [s, d] = k.split('->'); return !by.get(s)?.influences.includes(d) || !by.get(d)?.influenced_by.includes(s); });
ok(!linkBad.length, 'every edge is listed on both of its nodes', linkBad.slice(0, 5).join(', '));
const opt = M.p.spawn.options.id_333;
ok(opt.effects?.[0]?.node_id === 'ev_charger' && opt.effects[0].op === 'set' && opt.effects[0].value === 1, 'spawn: placing the module sets the switch to 1');
const undocumented = ['ev_charger->no2', 'ev_charger->pm25', 'ev_charger->ev_noise_reduction', 'avg_speed->ev_noise_reduction', 'ev_noise_reduction->noise_level'].filter(k => !M.p.edge_heuristics[k]?.notes);
ok(!undocumented.length, 'every new link has notes', undocumented.join(', '));

// switch off: everything as before, in several scenes
const scenes = [{}, { speed_limit: 1 }, { car_spawn_count_2: 600, car_spawn_count_4: 600 }];
const moved = scenes.flatMap(s => { const a = run(OLD, s).values, b = run(M, s).values; return [...a].filter(([k, v]) => Math.abs(v - b.get(k)) > 1e-6).map(([k]) => k); });
ok(!moved.length, 'switch off: every node unchanged against the file before this change', [...new Set(moved)].join(', '));

// switch on: effects
// amount_of_cars is computed (not overridable), so vary the car lanes and read the real count back
const runT = (m, ov = {}, tel = {}) => { const r = CES.solveRaw(m.raw, { overrides: ov, telemetry: tel }); if (!r.ok) throw new Error(r.error); return r; };
const SCENES = [{ name: 'start state', ov: {} }, { name: 'one car lane per street', ov: { car_lanes_spawn_2: 1, car_lanes_spawn_4: 1 } }];
for (const sc of SCENES) for (const sl of [0, 1]) {
  const off = run(M, { ...sc.ov, speed_limit: sl, ev_charger: 0 }).values;
  const on = run(M, { ...sc.ov, speed_limit: sl, ev_charger: 1 }).values;
  const cars = on.get('amount_of_cars'), spd = on.get('avg_speed'), exp = Math.min(4, Math.max(0, 0.1 * (60 - spd)));
  const tag = `${sc.name}, ${sl ? '30' : '50'}-zone (${Math.round(cars)} cars/h)`;
  ok(near(off.get('amount_of_cars'), cars), `${tag}: same number of cars with the switch on`);
  ok(near(on.get('no2'), 6, 1e-3), `${tag}: NO2 drops to the 6 µg/m³ background`, `${f2(off.get('no2'))} → ${f2(on.get('no2'))}`);
  ok(near(off.get('pm25') - on.get('pm25'), 0.4 * 0.00235 * cars, 1e-3), `${tag}: PM2.5 loses 40% of the traffic part`, `${f2(off.get('pm25'))} → ${f2(on.get('pm25'))}`);
  ok(near(off.get('noise_level') - on.get('noise_level'), exp, 1e-3), `${tag}: noise −${f2(exp)} dB at ${f2(spd)} km/h`, `${f2(off.get('noise_level'))} → ${f2(on.get('noise_level'))}`);
  console.log(`      health_index ${f2(off.get('health_index'))} → ${f2(on.get('health_index'))}`);
}
// noise follows the telemetry speed (avg_speed pinned as measured telemetry)
const nr = (s, e = 1) => runT(M, { ev_charger: e }, { avg_speed: s }).values;
ok([[10, 4], [30, 3], [45, 1.5], [50, 1], [60, 0]].every(([s, e]) => near(nr(s).get('ev_noise_reduction'), e, 1e-6)), 'telemetry avg_speed drives the saving: 10→4, 30→3, 45→1.5, 50→1, 60→0 dB',
  [10, 30, 45, 50, 60].map(s => `${s}:${f2(nr(s).get('ev_noise_reduction'))}`).join(' '));
ok([10, 30, 50].every(s => near(nr(s, 0).get('ev_noise_reduction'), 0)), 'switch off: no noise saving at any speed');
ok(near(nr(30, 0).get('noise_level') - nr(30, 1).get('noise_level'), 3, 1e-3), 'measured 30 km/h: noise_level itself drops 3 dB');
const rs = [run(M, { ev_charger: 1 }), run(M, { ev_charger: 1, speed_limit: 1 })];
ok(rs.every(r => r.converged && r.passes <= CES.MAX_PASSES), `settles within the game's ${CES.MAX_PASSES} passes`, rs.map(r => r.passes).join(', '));

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks pass');
process.exit(failed ? 1 : 0);
