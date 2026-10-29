// Check Tier 4 backing: lane 1/8 spaces from EAR 23 stalls and StVO clearances, extension area over 4 stretches.
// Uses the editor's CES engine (a port of the game's solver). Read-only: writes nothing.
// usage: node handover_tier4_backing/check_tier4_backing.js [project.json]
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const file = path.resolve(root, process.argv[2] || 'update.json');
const html = fs.readFileSync(path.join(root, 'BCC_Editor_BCC (1).html'), 'utf8');
const mod = { exports: {} };
new Function('module', 'globalThis', html.slice(html.indexOf('/*CES-ENGINE-BEGIN*/'), html.indexOf('/*CES-ENGINE-END*/')))(mod, {});
const CES = mod.exports;
const load = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const run = (p, ov = {}) => { const r = CES.solveRaw({ nodes: p.nodes, edge_heuristics: p.edge_heuristics, system_rules: p.system_rules }, { overrides: ov }); if (!r.ok) throw new Error(r.error); return r.values; };
const M = load(file), OLD = load(path.join(root, 'archive', 'update_before-tier4-backing.json'));
const by = new Map(M.nodes.map(n => [n.id, n]));
let failed = 0;
const ok = (c, label, d = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${label}${d ? ' — ' + d : ''}`); if (!c) failed++; };
const L = 'extension_segment_length_m', EXT = 'sidewalk_extension_spawn_2';
console.log(`file: ${path.basename(file)}\n`);

const ctx = new Set([...by.keys(), 'y', 'baseline', 'base', 'aggregate', 'computed']);
ok(['spaces_1_8', 'sidewalk_extension_area'].every(id => CES.validateExpression(by.get(id).node_formula.expression, false, ctx).ok), 'both formulas compile in the game parser');
ok(`${L}->spaces_1_8` in M.edge_heuristics && by.get('spaces_1_8').influenced_by.includes(L), 'kerb length feeds spaces_1_8');

const v0 = run(M), o0 = run(OLD);
ok(v0.get('spaces_1_8') === 38, '65 m stretches: 2 × (floor(57/5.8) + floor(60/5.8)) = 2 × (9 + 10) = 38 spaces', String(v0.get('spaces_1_8')));
const moved = [...o0].filter(([k, v]) => k !== 'spaces_1_8' && Math.abs(v - v0.get(k)) > 1e-6).map(([k]) => k);
ok(!moved.length, 'today: every other node unchanged (lane 1/8 still parking)', moved.join(', '));
const sp = l => run(M, { [L]: l }).get('spaces_1_8');
ok(sp(65 + 5.8) === 42 && sp(65 - 5.8) === 34, 'each 5.8 m of kerb changes the count by 4', `${sp(59.2)} / ${sp(70.8)}`);
ok(sp(4) === 0 && sp(7) === 0, 'a stretch shorter than the clearance gives 0, not a negative count', `${sp(4)} / ${sp(7)}`);
const on = run(M, { [EXT]: 1 });
ok(on.get('sidewalk_extension_area') === 2700, 'extension area: fixed 2,700 m² from the game set-up (2026-10-29; was 4 × 65 m × 2.0 m = 520 m²)');
ok(on.get('parallel_parking') === 142, 'extension on 1/8 removes 38 spaces: 180 → 142');
process.exitCode = failed ? 1 : 0;
