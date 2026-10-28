"""Tier 4 backing: lane 1/8 kerb length, parking spaces and sidewalk extension area.

14. spaces_1_8 becomes a formula: EAR 23 parallel stall (5.80 m) and StVO §12(3) Nr. 1
    junction clearances (8 m before, 5 m after), over all 4 kerb stretches of lane 1/8.
15. extension_segment_length_m is redefined as the kerb length of one stretch;
    sidewalk_extension_area counts all 4 stretches.

Reads archive/update_before-tier4-backing.json, writes update.json. Re-runnable.
usage: .venv/bin/python handover_tier4_backing/build_tier4_backing.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'archive', 'update_before-tier4-backing.json')
OUT = os.path.join(ROOT, 'update.json')
TAG = '2026-10-28 (Tier 4 backing): '
EAR = 'FGSV EAR 23 (Empfehlungen für Anlagen des ruhenden Verkehrs, 2023): parallel stall 5.80 m × 2.00 m (EAR 05 had 5.70 m).'
STVO = 'StVO §12(3) Nr. 1: no parking within 8 m before a junction (5 m with a kerb-separated cycle track) and 5 m after it, measured from where the road edges meet.'

p = json.load(open(SRC, encoding='utf-8'))
nodes = {n['id']: n for n in p['nodes']}
edges = p['edge_heuristics']


def prepend(node_id, text):
    n = nodes[node_id]
    n['notes'] = TAG + text + ' ' + (n.get('notes') or '')


def edge(src, dst, source='', notes='', status='assumption', confidence=''):
    e = edges.get(f'{src}->{dst}') or {'value': '', 'weight': 1, 'formula': None, 'color': '', 'issue_status': 'none', 'issue_priority': 0}
    e.update({'source': source, 'notes': notes, 'status': status, 'confidence': confidence})
    edges[f'{src}->{dst}'] = e
    if dst not in nodes[src]['influences']:
        nodes[src]['influences'].append(dst)
    if src not in nodes[dst]['influenced_by']:
        nodes[dst]['influenced_by'].append(src)


L = 'extension_segment_length_m'

# ---------------------------------------------------------------- 15. kerb length of one stretch
prepend(L, 'Meaning changed: kerb length of ONE stretch of lane 1/8, from where the road edges meet at the junction to the map edge. '
           'Lane 1/8 has 4 stretches (lane 1 and lane 8, each west and east of the intersection), the same way lane 4/5 counts 26 east + 26 west. '
           'Feeds both spaces_1_8 and sidewalk_extension_area. [FLAG] 65 m kept until measured in the game level (engine units); '
           'the map image cannot be used, it is a perspective render with no scale bar and the street runs off its edge. Each 5.8 m changes spaces_1_8 by 4.')

# ---------------------------------------------------------------- 14. parking spaces on lane 1/8
s = nodes['spaces_1_8']
s['node_formula'] = {'enabled': True, 'expression': f'2*(max(0, floor(({L}-8)/5.8)) + max(0, floor(({L}-5)/5.8)))'}
s['value'] = s['baseline_value'] = 38
prepend('spaces_1_8', 'Now a formula: 2 lanes × (stretch leading into the junction: floor((L − 8)/5.8) + stretch leading away: floor((L − 5)/5.8)). '
                      'With L = 65 m: 2 × (9 + 10) = 38. Supersedes the 22 below, which counted only 2 of the 4 stretches and used the EAR 05 stall. '
                      + EAR + ' ' + STVO + ' The 8 m applies because lane 1/8 holds parking, not a cycle track, whenever these spaces exist. '
                      '[FLAG] driveways are not counted yet (StVO §12(3) Nr. 3 bans parking in front of them); each one costs a space.')
edge(L, 'spaces_1_8', source=EAR + ' ' + STVO,
     notes='Stalls that fit on the kerb length after the junction clearances, over 4 stretches.', status='empirical', confidence='medium')

# ---------------------------------------------------------------- 15. extension area
a = nodes['sidewalk_extension_area']
old = '2*sidewalk_extension_spawn_2*extension_segment_length_m*2.0'
if a['node_formula']['expression'] != old:
    sys.exit('sidewalk_extension_area: unexpected formula ' + a['node_formula']['expression'])
a['node_formula']['expression'] = '4*sidewalk_extension_spawn_2*extension_segment_length_m*2.0'
prepend('sidewalk_extension_area', '4 stretches × L × 2.0 m: 520 m² with L = 65 m (was 2 stretches, 260 m²). '
        'The extension runs the full stretch, including the junction clearance zones, which cannot hold parking and are where '
        'guidelines place sidewalk extensions (Gehwegvorstreckungen). Width 2.00 m = the EAR 23 parallel stall it replaces.')
e = edges[f'{L}->sidewalk_extension_area']
e.update({'source': EAR, 'status': 'empirical', 'confidence': 'medium',
          'notes': 'Full kerb length of each of the 4 stretches × 2.00 m strip.'})

# ---------------------------------------------------------------- map total must hold lane 1/8
prepend('parking_spaces_map', 'The count of the map area must include the 38 spaces on lane 1/8 (Tier 4), the 52 on lane 4/5 and the stop spaces.')

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(p, f, ensure_ascii=False, indent=2)
print('wrote', OUT)
