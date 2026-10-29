"""Step 4: green facade cooling set to street-level evidence (−0.15 °C per building), with sources.
usage: .venv/bin/python handover_greenery_area/apply_facade_cooling.py [project.json]
Run once, after apply_facades_off_plaza.py."""
import json, sys
from pathlib import Path

f = Path(sys.argv[1] if len(sys.argv) > 1 else 'update.json')
d = json.loads(f.read_text())
N = {n['id']: n for n in d['nodes']}
E = d['edge_heuristics']
TAG = '2026-10-29 (facade cooling sourced): '
w = E['green_facades->temperature']
if w['formula']['slope'] != -2:
    sys.exit('already applied')

def note(obj, text):
    obj['notes'] = TAG + text + ((' ' + obj['notes']) if obj.get('notes') else '')

w['formula'] = {'type': 'linear_scale', 'mode': 'absolute', 'slope': -0.15, 'intercept': 0,
                'label': '−0.15 °C per greened building, −0.3 °C for both (street-canyon CFD maximum)'}
w['status'] = 'empirical'
w['confidence'] = 'medium'
w['issue_status'] = 'none'
w['source'] = ('Street-canyon CFD with facade greening: mean −0.1 K, max −0.3 K, < 0.05 K mid-canyon (engrXiv preprint 2599, '
               'https://engrxiv.org/preprint/view/2599); São Paulo ENVI-met: difference at 15 cm from the wall, insignificant from 60 cm '
               '(Pós FAUUSP, https://journals.usp.br/posfau/article/view/195441); Cui et al. 2022, PET −0.17 to −1.4 °C near greened facades, '
               'Hong Kong (https://ira.lib.polyu.edu.hk/handle/10397/99532); Alexandri & Jones 2008, Building and Environment 43(4):480–493 '
               '(https://orca.cardiff.ac.uk/id/eprint/29416/)')
w['notes'] = TAG + ('Slope −2 → −0.15 °C per building: both facades give −0.3 °C. The old −4 °C maximum had no source. Evidence: in a street '
    'canyon, greened facades lower air temperature by about 0.1 K on average and 0.3 K at most, under 0.05 K in the middle of the street; field '
    'studies find 0.6–1.0 °C only within about a metre of the wall, and a simulation finds no clear difference from 60 cm. The large values in '
    'Alexandri & Jones 2008 (up to 8–13 °C) come from a 2D model with green walls and green roofs on whole canyons, mostly in hot climates, '
    'which does not fit two buildings at a Berlin junction. About 30–50 % of all facades would be needed for about 1 °C. The stronger effect is '
    'local felt comfort next to the wall (PET −0.17 to −1.4 °C, Cui et al. 2022, mainly from greening low on the facade); it is not junction-wide '
    'air temperature. Old note: ') + w['notes']
note(N['green_facades'], 'Cooling −0.15 °C per building (−0.3 °C for both), from street-level evidence; the old −2 °C per building had no source. '
     'Its main effect is visual: see green_facades → visual_greenery_index. [FLAG] the spawn tree has one facade element (spawn 5, max 1): '
     'check whether the game can reach 2.')
v = E['green_facades->visual_greenery_index']
v['source'] = v['source'] + (' Facade greenery specifically: NTU Singapore VR study 2021 (stress rose with green-painted walls, not with planted '
    'facades), https://ntu.edu.sg/news/detail/vr-study-finds-vertical-greenery-useful-as-a-stress-buffer; Sheffield image trial 2024, n = 401, '
    'facade greenery raised perceived happiness more than ground-level greenery, https://eprints.whiterose.ac.uk/id/eprint/233462')
v['notes'] = TAG + ('The 15 % weight stays an assumption, but the direction is supported for facades specifically by the two studies added to '
    'the source. ') + v['notes']
note(N['temperature'], 'Green facades now cool −0.15 °C per building (was −2). With all trees, both water features and both facades, a 45 °C day '
     'goes to 36.6 °C (was 32.9 with the old facade value). Sourced cooling at junction scale comes almost entirely from canopy; water and '
     'facades add −0.5 °C together. The figures for the maxed case in the notes below are history.')

f.write_text(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
print('applied to', f)
