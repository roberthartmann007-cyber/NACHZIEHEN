// Check: greenery as % canopy of the 11,500 m² map, no double-counted cooling, 2,700 m² sidewalk extension.
// Uses the editor's CES engine (a port of the game's solver). Read-only: writes nothing.
// usage: node handover_greenery_area/check_greenery_area.js [project.json]
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const file = path.resolve(root, process.argv[2] || 'update.json');
const html = fs.readFileSync(path.join(root, 'BCC_Editor_BCC (1).html'), 'utf8');
const mod = { exports: {} };
new Function('module', 'globalThis', html.slice(html.indexOf('/*CES-ENGINE-BEGIN*/'), html.indexOf('/*CES-ENGINE-END*/')))(mod, {});
const CES = mod.exports;
const p = JSON.parse(fs.readFileSync(file, 'utf8'));
const raw = { nodes: p.nodes, edge_heuristics: p.edge_heuristics, system_rules: p.system_rules };
const solve = ov => { const r = CES.solveRaw(raw, { overrides: ov }); if (!r.ok) throw new Error(r.error); return id => r.values.get(id); };
const by = new Map(p.nodes.map(n => [n.id, n]));
let failed = 0;
const ok = (c, label, detail = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`); if (!c) failed++; };
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;
const ctx = new Set([...by.keys(), 'y', 'baseline', 'base', 'aggregate', 'computed']);
for (const id of ['greenery', 'temperature', 'visual_greenery_index', 'sidewalk_extension_area'])
  ok(CES.validateExpression(by.get(id).node_formula.expression, false, ctx).ok, `${id} formula compiles in the game parser`);
ok(p.edge_heuristics['greenery->temperature'].formula.slope === 0, 'greenery → temperature adds nothing to base (slope 0)');

const MID = 'middle_part_covered_trees', ALLEY = 'spawn_2_canopy_streets', EXT = 'sidewalk_extension_spawn_2';
const off = { blue_infrastructure: 0, green_facades: 0, rain: 0 };
const heat = { ...off, neutral_weather: 0, extreme_summer_heat: 1 }, mild = { ...off, neutral_weather: 1, extreme_summer_heat: 0 };
const cases = [
  ['no trees', { [MID]: 0, [ALLEY]: 0, [EXT]: 0 }, 0],
  ['green boulevard', { [MID]: 1, [ALLEY]: 0, [EXT]: 0 }, 15.57],
  ['alley, no extension', { [MID]: 0, [ALLEY]: 2, [EXT]: 0 }, 0],
  ['alley, both sides', { [MID]: 0, [ALLEY]: 2, [EXT]: 1 }, 23.48],
  ['all trees', { [MID]: 1, [ALLEY]: 2, [EXT]: 1 }, 39.04],
];
console.log('\ncase                  greenery   19 °C day   45 °C day   VGI');
for (const [label, lv, g] of cases) {
  const a = solve({ ...mild, ...lv }), b = solve({ ...heat, ...lv });
  console.log(`${label.padEnd(22)}${a('greenery').toFixed(2).padStart(7)} %${a('temperature').toFixed(2).padStart(10)}${b('temperature').toFixed(2).padStart(12)}${a('visual_greenery_index').toFixed(1).padStart(7)}`);
  ok(near(a('greenery'), g), `${label}: greenery ${g} %`);
}
const all = { [MID]: 1, [ALLEY]: 2, [EXT]: 1 };
ok(near(solve({ ...mild, ...all })('temperature'), 15.74, 0.1), '19 °C day with all trees ≈ 15.7 °C (was 2.2)');
ok(near(solve({ ...heat, ...all })('temperature'), 37.10, 0.1), '45 °C day with all trees ≈ 37.1 °C (was 24.4)');
const maxed = solve({ ...heat, ...all, blue_infrastructure: 20, green_facades: 2 })('temperature');
ok(near(maxed, 32.9, 0.1), 'heat day, all trees + water + facades ≈ 32.9 °C (water at −0.1 °C per feature, Jacobs et al. 2020)', maxed.toFixed(2) + ' °C');
const water = solve({ ...heat, [MID]: 0, [ALLEY]: 0, [EXT]: 0, blue_infrastructure: 2 })('temperature');
ok(near(water, 44.8, 0.01), 'both water features alone cool a 45 °C day by 0.2 °C', water.toFixed(2) + ' °C');
ok(near(solve({ [EXT]: 1 })('sidewalk_extension_area'), 2700, 0.01) && solve({ [EXT]: 0 })('sidewalk_extension_area') === 0, 'sidewalk extension area 0 / 2,700 m²');
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
