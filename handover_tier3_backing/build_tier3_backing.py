"""Tier 3 backing: apply the changes to the model file.

10. Seating normalized to the furniture ceiling; the sidewalk extension's activity term needs seating.
11. Dooring on the north-south street: new lever for a/f parking, dooring term in bike attractiveness.
12. and 13. Kept as game decisions; notes only.

Reads archive/update_before-tier3-backing.json, writes update.json. Re-runnable.
usage: .venv/bin/python handover_tier3_backing/build_tier3_backing.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'archive', 'update_before-tier3-backing.json')
OUT = os.path.join(ROOT, 'update.json')
TAG = '2026-10-28 (Tier 3 backing): '

p = json.load(open(SRC, encoding='utf-8'))
nodes = {n['id']: n for n in p['nodes']}
edges = p['edge_heuristics']


def prepend(node_id, text):
    n = nodes[node_id]
    n['notes'] = TAG + text + ' ' + (n.get('notes') or '')


def set_expr(node_id, old, new, count=None):
    f = nodes[node_id]['node_formula']
    found = f['expression'].count(old)
    if not found or (count is not None and found != count):
        sys.exit(f'{node_id}: expected text found {found}x: {old}')
    f['expression'] = f['expression'].replace(old, new)


def edge(src, dst, source='', notes='', status='assumption', confidence='', base=None):
    key = f'{src}->{dst}'
    e = dict(base) if base else {'value': '', 'weight': 1, 'formula': None, 'color': '', 'issue_status': 'none', 'issue_priority': 0}
    e.update({'source': source, 'notes': notes, 'status': status, 'confidence': confidence})
    edges[key] = e
    if dst not in nodes[src]['influences']:
        nodes[src]['influences'].append(dst)
    if src not in nodes[dst]['influenced_by']:
        nodes[dst]['influenced_by'].append(src)


def drop_edge(src, dst):
    e = edges.pop(f'{src}->{dst}', None)
    nodes[src]['influences'] = [i for i in nodes[src]['influences'] if i != dst]
    nodes[dst]['influenced_by'] = [i for i in nodes[dst]['influenced_by'] if i != src]
    return e


def new_node(node_id, notes, x, y, expr=None, value=0, mn=0, mx=100, unit='', active=None, evidence=''):
    n = {'id': node_id, 'label': node_id, 'type': 'active' if active else 'passive', 'status': 'defined',
         'influences': [], 'influenced_by': [], 'notes': TAG + 'NEW. ' + notes, 'priority': '',
         'value_kind': 'absolute', 'unit': unit, 'passive_precision': 'decimals',
         'node_formula': {'enabled': bool(expr), 'expression': expr or ''},
         'baseline_value': value, 'value': value, 'min': mn, 'max': mx,
         'active_control': 'slider' if active else None, 'active_order': active,
         'active_states': {'a': mn, 'b': mx} if active else None, 'evidence_status': evidence, '_x': x, '_y': y}
    if active:
        n['node_formula'] = None
    p['nodes'].append(n)
    nodes[node_id] = n


# ---------------------------------------------------------------- 10. seating, normalized to the furniture ceiling
SEAT_SRC = 'Whyte 1980 (people sit where there are places to sit); Gehl 2011; Mehta 2007 and 2013 (seating is the strongest street-front driver of lingering).'
fmax = nodes['urban_furniture']['active_states']['b']   # 6 today
new_node('urban_furniture_max',
         f'Furniture pieces the plaza can hold: the spawn ceiling for urban_furniture ({fmax} today). '
         'Every seating effect reads urban_furniture_share, so changing this one number rescales them all: the full ceiling always gives the full effect. '
         'When it changes, also set the urban_furniture lever\'s "full" state (active_states.b) and its max to the same number.',
         6920, 330, value=fmax, mn=1, mx=50, unit='pieces')
new_node('urban_furniture_share',
         'Share of the furniture ceiling in place, 0–1: urban_furniture / urban_furniture_max. Read by every seating effect instead of a fixed /6.',
         6920, 690, expr='min(1, urban_furniture/max(1, urban_furniture_max))', mx=1, unit='share')

# move the seating links onto the share; keep their provenance
for dst in ('space_activity_index', 'pedestrians_stationary'):
    old = drop_edge('urban_furniture', dst)
    edge('urban_furniture_share', dst, source=old['source'],
         notes=TAG + 'Moved from urban_furniture: the formula now reads the share of the ceiling instead of urban_furniture/6. ' + old['notes'],
         status=old['status'], confidence=old.get('confidence', ''), base=old)
edge('urban_furniture', 'urban_furniture_share', notes='Pieces in place.', status='assumption')
edge('urban_furniture_max', 'urban_furniture_share', notes='Ceiling the share is measured against.', status='assumption')
edge('urban_furniture_max', 'plaza_check_limits', notes='The furniture limit is the ceiling, not a fixed 6.', status='assumption')

set_expr('space_activity_index', 'min(1,urban_furniture/6)', 'urban_furniture_share', count=2)
set_expr('space_activity_index', '0.05*sidewalk_extension_spawn_2', '0.05*sidewalk_extension_spawn_2*urban_furniture_share', count=1)
set_expr('pedestrians_stationary', 'min(1, urban_furniture/6)', 'urban_furniture_share', count=1)
set_expr('plaza_check_limits', '(urban_furniture > 6)', '(urban_furniture > urban_furniture_max)', count=1)

e = edges['sidewalk_extension_spawn_2->space_activity_index']
e['source'] = 'SF Great Streets Parklet Impact Study (parklets with seating: people stopping and sitting +30 %, https://sf.streetsblog.org/2012/01/05/great-streets-project-quantifies-the-impacts-of-parklets); ' + SEAT_SRC
e['notes'] = (TAG + 'The extension adds activity only together with seating: 0.05 × extension × urban_furniture_share. '
              'An empty extension adds 0 (was +11.3); 1 café + half the furniture +1.9 (was +3.7); full furniture +1.0 (unchanged). '
              'The studies measured extensions that came with seating. [FLAG] the size 0.05 is still a judgment; the direction and the seating gate are backed. ' + (e.get('notes') or ''))
e['status'] = 'empirical'
prepend('space_activity_index',
        'Seating reads urban_furniture_share (pieces ÷ urban_furniture_max) instead of urban_furniture/6, so the curve holds when the furniture ceiling changes. '
        'The sidewalk extension term needs seating: 0.05 × extension × urban_furniture_share (an empty extension adds nothing). Supersedes the extension note below.')
prepend('pedestrians_stationary', 'Seating gate reads urban_furniture_share instead of urban_furniture/6.')
prepend('plaza_check_limits', 'Furniture limit reads urban_furniture_max instead of a fixed 6.')
prepend('urban_furniture', 'Every seating effect reads urban_furniture_share = this ÷ urban_furniture_max. To change the ceiling: set urban_furniture_max, and this lever\'s full state and max to match.')
prepend('sidewalk_extension_spawn_2', 'Its activity effect now needs seating (see space_activity_index).')

# ---------------------------------------------------------------- 11. dooring on the north-south street
DOOR_SRC = ('Teschke et al. 2012, AJPH 102:2336 (690 injured cyclists, Toronto and Vancouver; major streets without parked cars OR 0.63, with a bike lane OR 0.54), '
            'https://pmc.ncbi.nlm.nih.gov/articles/PMC3519333; dooring share of bike crashes about 15–20 % (Vancouver, Cambridge MA, Chicago), '
            'https://dutchreach.org/dooring-problem-prevalence; open door about 1.2 m into the lane.')
new_node('ns_outer_parking_spawn_4',
         '1 = the outer lane a/f of the north-south street holds parking (starting state), 0 = greenery with pockets. Set by the two a/f options at SP 4. '
         'A bike lane on b/e runs right next to a/f, so parking there puts riders in the door zone. '
         '[FLAG] open: a/f parking spaces are not yet taken out of parallel_parking when it turns to greenery; that needs the a/f space count.',
         -470, -570, value=1, mn=0, mx=1, active=48)
set_expr('mob_attract_bikes', ' + max(10, total_bike_lanes*10)',
         ' + max(10, total_bike_lanes*10) - 5.5*ns_outer_parking_spawn_4*min(1, bike_lanes_spawn_4)*(1 - min(1, bike_lane_protection/4))', count=1)
DOOR_NOTE = ('Dooring: −5.5 while a north-south bike lane runs next to parking on a/f, less with protection, 0 at full protection or with greenery on a/f. '
             'Size: ln(0.63) / ln(0.54) = 0.75, so taking parked cars away is worth about three quarters of a bike lane\'s safety effect; 0.75 × 7.5 points per protection step ≈ 5.5. '
             'The east-west street has no term: there a bike lane never runs next to parking. [FLAG] derived: the 7.5 points per step is the model\'s own scale.')
edge('ns_outer_parking_spawn_4', 'mob_attract_bikes', source=DOOR_SRC, notes=DOOR_NOTE, status='empirical', confidence='medium')
edge('bike_lanes_spawn_4', 'mob_attract_bikes', source=DOOR_SRC, notes='Dooring term applies only with a north-south bike lane. ' + DOOR_NOTE, status='empirical', confidence='medium')
prepend('mob_attract_bikes', 'Dooring is back on the north-south street only: ' + DOOR_NOTE + ' Supersedes "the dooring penalty is gone" below.')
nodes['bike_lanes_spawn_4']['notes'] += ' ' + TAG + 'Next to parking on a/f a bike lane pays the dooring term in mob_attract_bikes (ns_outer_parking_spawn_4).'

opts = p['spawn']['options']
for oid, label, val in (('id_349', 'parking', 1), ('id_344', 'greenery_with_pockets', 0)):
    o = opts[oid]
    if o['elemId'] != 'id_343' or o['label'] != label:
        sys.exit(f'spawn option {oid} is not a/f {label}')
    o['node_id'] = 'ns_outer_parking_spawn_4'
    o['effects'] = [{'node_id': 'ns_outer_parking_spawn_4', 'op': 'set', 'value': val}]
p['spawn']['elements']['id_343']['node_id'] = 'ns_outer_parking_spawn_4'
ns = next(g for g in p['lane_slots'] if g['id'] == 'ns_street')
ns['notes'] = ns['notes'].replace('The outer lane a/f (parking or greenery with pockets) has no effect in the sim, so it is not listed.',
                                  'The outer lane a/f (parking or greenery with pockets) is not a slot: it sets ns_outer_parking_spawn_4, which drives dooring for a bike lane on b/e.')

# ---------------------------------------------------------------- 12. and 13. kept as game decisions
n = nodes['carsharing_stations']
n['notes'] = TAG + 'Kept as a game decision (design team): the stations stay in the pocket modules and take none of the parking spaces. ' \
    'In real cities on-street stations usually take public parking spaces (Bremen mobil.punkt, Berlin Jelbi); the game sets that aside on purpose. ' + n['notes']
g = next(g for g in p['lane_slots'] if g['id'] == 'ew_street')
note13 = ' Game decision (2026-10-28, design team): the extension keeps priority over the bike lane even where a car lane could give way instead. Kept on purpose.'
if note13 not in g['notes']:
    g['notes'] += note13

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(p, f, ensure_ascii=False, indent=2)
print('wrote', OUT)
