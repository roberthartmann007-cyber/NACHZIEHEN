"""Step 3: green facades no longer count toward the plaza budget (modules, upkeep, per-type limits).
usage: .venv/bin/python handover_greenery_area/apply_facades_off_plaza.py [project.json]
Run once, after apply_merge_canopy.py."""
import json, sys
from pathlib import Path

f = Path(sys.argv[1] if len(sys.argv) > 1 else 'update.json')
d = json.loads(f.read_text())
N = {n['id']: n for n in d['nodes']}
E = d['edge_heuristics']
TAG = '2026-10-29 (facades off the plaza budget): '
G = 'green_facades'
CUT = {'plaza_modules_used': ' + 1*green_facades', 'plaza_upkeep_used': ' + 2*green_facades', 'plaza_check_limits': ' + (green_facades > 2)'}
if 'plaza_modules_used' not in N[G]['influences']:
    sys.exit('already applied')

def note(obj, text):
    obj['notes'] = TAG + text + ((' ' + obj['notes']) if obj.get('notes') else '')

for tgt, term in CUT.items():
    nf = N[tgt]['node_formula']
    assert nf['expression'].count(term) == 1, (tgt, term)
    nf['expression'] = nf['expression'].replace(term, '')
    N[G]['influences'].remove(tgt); N[tgt]['influenced_by'].remove(G); del E[f'{G}->{tgt}']
    note(N[tgt], f'Removed "{term.strip(" +")}": green facades sit on the buildings (spawn 5, element "facade"), not on the plaza, '
         'so they no longer use plaza modules, upkeep or a per-type limit.')
note(N[G], 'Independent of the plaza: no longer counted in plaza_modules_used, plaza_upkeep_used or plaza_check_limits. '
     'Still feeds temperature and visual_greenery_index.')

f.write_text(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
print('applied to', f)
