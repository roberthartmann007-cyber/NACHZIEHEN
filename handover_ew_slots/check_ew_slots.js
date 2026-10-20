// Check the east-west slot rules (SP 2 + SP 3) in a BCC project file.
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
const FIT = 'car_lanes_spawn_2_fit', SLOTS = 'free_lane_slots_spawn_2', SW = 'sidewalk_extension_spawn_2';
console.log(`file: ${path.basename(file)}\n`);

// structure
ok([FIT, SLOTS, SW].every(id => by.has(id)), 'the three slot-rule nodes exist');
if (failed) process.exit(1);
const ctx = new Set([...by.keys(), 'y', 'baseline', 'base', 'aggregate', 'computed']);
ok([FIT, SLOTS].every(id => CES.validateExpression(by.get(id).node_formula.expression, false, ctx).ok), 'formulas compile in the game parser');
const rawReaders = p.nodes.filter(n => n.id !== FIT && /\bcar_lanes_spawn_2\b(?!_)/.test(n.node_formula?.expression || '')).map(n => n.id);
ok(!rawReaders.length, `only ${FIT} reads the car lever car_lanes_spawn_2`, rawReaders.join(', '));
const lv = id => by.get(id);
ok(lv('car_lanes_spawn_2').max === 3 && lv('bike_lanes_spawn_2').max === 1 && lv('bus_lanes_spawn_2').max === 1 && lv(SW).max === 1 && lv('tram_line_center').max === 1,
  'lever ranges: car 0–3, bike 0–1, bus 0–1, sidewalk 0–1, tram 0–1');

// behaviour over every E-W lever combination (everything else as saved)
let ruleErr = 0, capErr = 0, consErr = 0, combos = 0, cut = 0;
for (let car = 0; car <= 3; car++) for (const bike of [0, 1]) for (const bus of [0, 1]) for (const tram of [0, 1]) for (const sw of [0, 1]) {
  const v = solve({ car_lanes_spawn_2: car, bike_lanes_spawn_2: bike, bus_lanes_spawn_2: bus, tram_line_center: tram, [SW]: sw });
  combos++;
  const expected = Math.max(0, Math.min(car, 3 - bus - tram - bike * sw));
  if (expected < car) cut++;
  ruleErr = Math.max(ruleErr, Math.abs(v(FIT) - expected));
  // in-game slot count: middle 2 + centre 1 per direction can hold cars; outer holds bike or sidewalk
  const used = v(FIT) + bus + tram + bike * sw;
  if (used > 3 + 1e-9) capErr++;
  for (const s of ['2', '3']) {
    const people = v(`car_spawn_count_${s}`) * v('occupancy_rates_cars') + v(`bike_spawn_count_${s}`) + v(`bus_spawn_count_${s}`) * v('occupancy_rates_busses') + v(`tram_spawn_count_${s}`) * v('occupancy_rates_trams');
    consErr = Math.max(consErr, Math.abs(people - v(`trip_demand_spawn_${s}_h`)) / Math.max(1, v(`trip_demand_spawn_${s}_h`)));
  }
}
ok(ruleErr < 1e-9, `${FIT} = min(car lever, 3 − bus − tram − bike×sidewalk), ${combos} E-W combinations`, ruleErr ? `off by ${ruleErr}` : '');
ok(capErr === 0, 'car + bus + tram + inner bike lane never exceed the 3 car-capable slots per direction');
ok(consErr < 0.01, 'people served at 2* and 3* still add up to demand (bus rounding aside)', `worst gap ${(consErr * 100).toFixed(2)} %`);
const ex = solve({ car_lanes_spawn_2: 3, bike_lanes_spawn_2: 1, bus_lanes_spawn_2: 1, tram_line_center: 1, [SW]: 0 });
ok(ex(FIT) === 1, 'example: bike lane + bus lane + tram → 1 car lane left');
const ex2 = solve({ car_lanes_spawn_2: 3, bike_lanes_spawn_2: 1, bus_lanes_spawn_2: 1, tram_line_center: 1, [SW]: 1 });
ok(ex2(FIT) === 0, 'same with a sidewalk extension (bike lane moves to lane 2/7) → 0 car lanes');
const a = solve({ car_lanes_spawn_2: 3, bus_lanes_spawn_2: 0, tram_line_center: 0 }), b = solve({ car_lanes_spawn_2: 3, bus_lanes_spawn_2: 1, tram_line_center: 0 });
ok(b(FIT) === 2 && b('car_spawn_count_2') < a('car_spawn_count_2'), 'adding a bus lane to 3 car lanes takes a car lane away (2 fit, fewer cars at 2*)');
console.log(`  (${cut} of ${combos} combinations ask for more car lanes than fit)`);

// reference table
const f = (x, n = 1) => x.toFixed(n).padStart(8);
const rows = [
  ['as saved', {}],
  ['car 3', { car_lanes_spawn_2: 3, bike_lanes_spawn_2: 0, bus_lanes_spawn_2: 0, tram_line_center: 0, [SW]: 0 }],
  ['car 3 + bus', { car_lanes_spawn_2: 3, bike_lanes_spawn_2: 0, bus_lanes_spawn_2: 1, tram_line_center: 0, [SW]: 0 }],
  ['car 3 + bike', { car_lanes_spawn_2: 3, bike_lanes_spawn_2: 1, bus_lanes_spawn_2: 0, tram_line_center: 0, [SW]: 0 }],
  ['car 3 + bike(in)', { car_lanes_spawn_2: 3, bike_lanes_spawn_2: 1, bus_lanes_spawn_2: 0, tram_line_center: 0, [SW]: 1 }],
  ['car 3 + tram', { car_lanes_spawn_2: 3, bike_lanes_spawn_2: 0, bus_lanes_spawn_2: 0, tram_line_center: 1, [SW]: 0 }],
  ['car 3+bike+bus+tram', { car_lanes_spawn_2: 3, bike_lanes_spawn_2: 1, bus_lanes_spawn_2: 1, tram_line_center: 1, [SW]: 0 }],
];
console.log(`\nE-W per direction at 2* (cars/bikes/buses/trams per hour); 'bike(in)' = bike lane on lane 2/7 behind a sidewalk extension`);
console.log(`${'setting'.padEnd(21)}${'asked'.padStart(6)}${'fit'.padStart(5)}${'cars'.padStart(8)}${'bikes'.padStart(8)}${'buses'.padStart(8)}${'trams'.padStart(8)}${'displ.'.padStart(8)}`);
for (const [label, ov] of rows) {
  const v = solve(ov), asked = ov.car_lanes_spawn_2 ?? lv('car_lanes_spawn_2').value;
  console.log(`${label.padEnd(21)}${String(asked).padStart(6)}${String(v(FIT)).padStart(5)}${f(v('car_spawn_count_2'))}${f(v('bike_spawn_count_2'))}${f(v('bus_spawn_count_2'), 2)}${f(v('tram_spawn_count_2'), 2)}${f(v('displaced_cars'))}`);
}
process.exitCode = failed ? 1 : 0;
