"""Step 2: the sidewalk extension carries the 2,700 m² canopy itself; the canopy alley slider is deleted.
usage: .venv/bin/python handover_greenery_area/apply_merge_canopy.py [project.json]
Run once, after apply_greenery_area.py."""
import json, sys
from pathlib import Path

f = Path(sys.argv[1] if len(sys.argv) > 1 else 'update.json')
d = json.loads(f.read_text())
N = {n['id']: n for n in d['nodes']}
E = d['edge_heuristics']
SP = d['spawn']
TAG = '2026-10-29 (canopy merged into the sidewalk extension): '
OLD = 'spawn_2_canopy_streets'
if OLD not in N:
    sys.exit('already applied')

def note(obj, text):
    obj['notes'] = TAG + text + ((' ' + obj['notes']) if obj.get('notes') else '')

# 1. delete the canopy alley slider, its link and its spawn option
for tgt in N[OLD]['influences']:
    N[tgt]['influenced_by'].remove(OLD)
    del E[f'{OLD}->{tgt}']
d['nodes'] = [n for n in d['nodes'] if n['id'] != OLD]
opt = [i for i, o in SP['options'].items() if o.get('node_id') == OLD]
assert opt == ['id_338'], opt
SP['elements']['id_336']['options'].remove('id_338')
del SP['options']['id_338']

# 2. greenery: the sidewalk extension adds its 2,700 m² directly
g = N['greenery']
g['node_formula']['expression'] = '100*(1790*middle_part_covered_trees + 2700*sidewalk_extension_spawn_2)/11500'
note(g, 'Turning on the sidewalk extension at spawn 2 now plants its whole 2,700 m² with canopy: 23.48 % of the 11,500 m² map, '
     'about −6 °C on a 45 °C day. The separate canopy alley slider (spawn_2_canopy_streets, 0–2 sides × 1,350 m²) and its spawn option '
     'id_338 (tree_lined_avenue_with_pockets, under the extension) are deleted: with trees always on the extension, the slider only repeated '
     'that choice. Two levers set greenery now: green boulevard on the middle lane 1,790 m² = 15.57 %, sidewalk extension 2,700 m² = 23.48 %; '
     'maximum 39.04 % (unchanged). Notes below that mention spawn_2_canopy_streets are history.')
e = E['sidewalk_extension_spawn_2->greenery']
e['formula'] = {'type': 'linear_scale', 'mode': 'absolute', 'slope': 23.48, 'intercept': 0,
                'label': '2,700 m² / 11,500 m² = 23.48 % canopy when the extension is built'}
e['notes'] = TAG + ('The extension now carries the canopy itself: 0 → 1 adds 2,700 m² = 23.48 % of the map. Provenance only; the greenery '
    'node formula computes the value. Replaces the gate role this link had while spawn_2_canopy_streets existed.')
e['status'] = 'empirical'
note(N['sidewalk_extension_spawn_2'], 'Now also the canopy lever: building the extension plants its 2,700 m² with trees (greenery +23.48 %). '
     'The canopy alley slider spawn_2_canopy_streets is deleted. The sub-element id_336 under this option keeps only bike_lane_2_mirrored_7.')
note(N['sidewalk_extension_area'], 'The same 2,700 m² is also the canopy area that the extension adds to greenery.')

f.write_text(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
print('applied to', f)
