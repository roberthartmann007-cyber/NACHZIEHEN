"""Step 5: one green facade (the game has one facade element at spawn 5), not two.
usage: .venv/bin/python handover_greenery_area/apply_one_facade.py [project.json]
Run once, after apply_facade_cooling.py."""
import json, sys
from pathlib import Path

f = Path(sys.argv[1] if len(sys.argv) > 1 else 'update.json')
d = json.loads(f.read_text())
N = {n['id']: n for n in d['nodes']}
E = d['edge_heuristics']
TAG = '2026-10-29 (one green facade): '
g = N['green_facades']
if g['max'] == 1:
    sys.exit('already applied')

def note(obj, text):
    obj['notes'] = TAG + text + ((' ' + obj['notes']) if obj.get('notes') else '')

g['max'] = 1
g['baseline_value'] = 1
g['active_states'] = {'a': 0, 'b': 1}
note(g, 'One building with a green facade, 0/1 (was 0–2). The game has one facade element (spawn 5, element "facade", chosen at most once), '
     'so 2 could never be reached; this resolves the facade-count [FLAG] below. Cooling −0.15 °C; it fills the facade term of the visual greenery index.')

v = N['visual_greenery_index']
old = '0.15*min(1,green_facades/2)'
assert v['node_formula']['expression'].count(old) == 1
v['node_formula']['expression'] = v['node_formula']['expression'].replace(old, '0.15*min(1,green_facades)')
note(v, 'Facade term now min(1, green_facades): the one green facade fills it (was /2 for two buildings).')
E['green_facades->visual_greenery_index']['notes'] = TAG + ('One facade now fills the 15 % facade share (live formula min(1, green_facades)). '
    'The max_available_units=2 normalization below is out of date. ') + E['green_facades->visual_greenery_index']['notes']

t = E['green_facades->temperature']
t['formula']['label'] = '−0.15 °C for the one greened building'
t['notes'] = TAG + ('With one facade the maximum is −0.15 °C (was −0.3 °C for two). Per-building slope unchanged. ') + t['notes']
note(N['temperature'], 'One green facade: −0.15 °C. With all trees, both water features and the facade, a 45 °C day goes to 36.75 °C.')

f.write_text(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
print('applied to', f)
