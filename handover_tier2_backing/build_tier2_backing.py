"""Tier 2 backing: apply the changes to the model file.

Reads archive/update_before-tier2-backing.json, writes update.json. Re-runnable.
usage: .venv/bin/python handover_tier2_backing/build_tier2_backing.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'archive', 'update_before-tier2-backing.json')
OUT = os.path.join(ROOT, 'update.json')
TAG = '2026-10-28 (Tier 2 backing): '

# Ownership term at city scale (fitted in the solver, see the edge note).
OWNERSHIP_K = float(os.environ.get('OWNERSHIP_K', '60'))

p = json.load(open(SRC, encoding='utf-8'))
nodes = {n['id']: n for n in p['nodes']}
edges = p['edge_heuristics']


def prepend(node_id, text):
    n = nodes[node_id]
    n['notes'] = TAG + text + ' ' + (n.get('notes') or '')


def set_expr(node_id, old, new):
    f = nodes[node_id]['node_formula']
    if old not in f['expression']:
        sys.exit(f'{node_id}: expected text not found: {old}')
    f['expression'] = f['expression'].replace(old, new)


def edge(src, dst, source='', notes='', status='assumption', confidence=''):
    key = f'{src}->{dst}'
    e = edges.get(key) or {'value': '', 'source': '', 'notes': '', 'status': status, 'confidence': confidence,
                           'weight': 1, 'formula': None, 'color': '', 'issue_status': 'none', 'issue_priority': 0}
    e.update({'source': source, 'notes': notes, 'status': status, 'confidence': confidence})
    edges[key] = e
    if dst not in nodes[src]['influences']:
        nodes[src]['influences'].append(dst)
    if src not in nodes[dst]['influenced_by']:
        nodes[dst]['influenced_by'].append(src)


def drop_edge(src, dst):
    edges.pop(f'{src}->{dst}', None)
    nodes[src]['influences'] = [i for i in nodes[src]['influences'] if i != dst]
    nodes[dst]['influenced_by'] = [i for i in nodes[dst]['influenced_by'] if i != src]


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


# ---------------------------------------------------------------- 7. parking at city scale
set_expr('car_attractivity_general',
         'max(-15, min(8, 12*(1.5*parking_availability - 1)))',
         'max(-15, min(8, 6 + 48*(parking_availability - 1)))')
edges['parking_availability->car_attractivity_general'].update({
    'source': 'Litman, Transportation Elasticities (VTPI; parking elasticity of car trips −0.1 to −0.3, via FHWA https://ops.fhwa.dot.gov/publications/fhwahop23023/ch2.htm); '
              'KonSULT, Univ. of Leeds (halving parking spaces → −30 % car use, model of five English cities, https://its.leeds.ac.uk/projects/konsult/private/level2/instruments/instrument039/l2_039c.htm); '
              'kerb share of parking: Hermannstraße count, Berlin (10,480 of about 15,000 spaces, https://api.openstreetmap.org/user/Supaplex030/diary/393423); '
              'checks: Amsterdam parking price rise → −2–3 % city traffic (Tinbergen Institute, https://tinbergen.nl/publication/167515/citywide-parking-policy-and-traffic-evidence-from-amsterdam); '
              'McCahill et al. 2016 (parking supply causes city-wide driving, https://ssti.us/publications/effects-of-parking-provision-on-automobile-use-in-cities-inferring-causality-mccahill-garrick-atkinson-palombo-and-polinski-2015/).',
    'notes': 'City scale (2026-10-28). The intersection stands for the whole city, so a driver who loses a space cannot park one street over. '
             'Chain: extension on 1/8 = −12 % kerb spaces × 0.7 kerb share of all parking = −8.5 % parking × elasticity 0.3 = −2.5 % car trips. '
             'Slope 48 gives −2.51 % in the solver (old slope 18 gave −0.94 %). Today still +6. '
             '[FLAG] derived: 0.3 is the middle of 0.1 (Litman; a price elasticity used as a stand-in for scarcity) and 0.6 (KonSULT; a model, not a measurement). '
             '[FLAG] estimate: the 0.7 kerb share comes from one Berlin corridor.',
    'status': 'empirical', 'confidence': 'medium'})
prepend('car_attractivity_general',
        'Parking term slope 18 → 48 (+6 today unchanged): the intersection stands for the whole city, so lost kerb space becomes fewer car trips (extension on 1/8 → −2.5 %). '
        f'Ownership term −3 → −{OWNERSHIP_K:g} × cars_replaced_share for the same reason. Derivations and [FLAG]s on the two edges. Supersedes the parking and ownership numbers below.')
prepend('parking_availability',
        'Read at city scale: every street loses the same share of kerb, so there is no free space one street over. See the edge into car_attractivity_general.')

# ---------------------------------------------------------------- ownership term at city scale
set_expr('car_attractivity_general', '- 3*cars_replaced_share', f'- {OWNERSHIP_K:g}*cars_replaced_share')
edges['cars_replaced_share->car_attractivity_general'].update({
    'source': 'Martin & Shaheen 2011 (carsharing member households drive 27–43 % less, https://ops.fhwa.dot.gov/publications/fhwahop16022/ch3.htm); '
              'MDPI 2021 Berlin replacement rate (9 cars per shared car); bcs 2023.',
    'notes': f'City scale (2026-10-28, replaces the Tier 1 value −3). At city scale the network replaces 54 of 171 parked cars = 32 % of all cars, not a local 1.5 % of traffic. '
             f'Chain: 32 % of cars × 27 % less driving = −8.6 % car trips. −{OWNERSHIP_K:g} gives −8.7 % in the solver (carsharing alone, against the same run with this term at 0). '
             '[FLAG] derived: assumes the replaced cars were driven like average cars; Martin & Shaheen measure whole member households. 27 % is the low end of their range (43 % would give −13.8 %). '
             '[FLAG] game scale: at city scale this is a very large programme (a third of all cars replaced, one shared car per 9).',
    'status': 'empirical', 'confidence': 'medium'})
prepend('traffic_demand_input',
        'The local/through split below is no longer used for the parking and carsharing effects: the intersection stands for the whole city, where every car trip parks somewhere. Kept for reference.')
prepend('cars_replaced_share', f'Feeds the ownership term at city scale (−{OWNERSHIP_K:g} × share, was −3).')

# ---------------------------------------------------------------- 8. cars per station: backed
n = nodes['cars_per_carsharing_station']
n['notes'] = TAG + 'Backed: bcs data sheet 2024 (as of 1 Jan 2024): 15,440 station-based cars at 8,020 stations = 1.93 per station (2.09 with combined systems), '\
    'https://carsharing.de/sites/default/files/download/2024-08/Datenblatt%20Carsharing-Statistik%202024_0.pdf. ' \
    + n['notes'].replace('[FLAG] assumption for small Berlin station-based stations.', 'Was an assumption for small Berlin stations; now backed (above).')
n['evidence_status'] = 'empirical: bcs Datenblatt Carsharing 2024'
n = nodes['carsharing_stations']
n['notes'] = n['notes'].replace('[FLAG] sizing rule and station size are assumptions.',
                                '[FLAG] game rule: the sizing rule. Station size (2 cars) is backed by bcs 2024, see cars_per_carsharing_station.')
edge('cars_per_carsharing_station', 'carsharing_cars', source='bcs Datenblatt Carsharing 2024 (1.93 cars per station-based station).',
     notes='Stations × cars per station.', status='empirical')

# ---------------------------------------------------------------- 9. bus stops as a game dynamic
X = 2590
BOARD_SRC = 'TCQSM boarding times (smart card 3.5 s per passenger), via WCTRS https://wctrs-society.com/wp-content/uploads/abstracts/lisbon/general/01072.pdf'
NZTA = 'NZTA bus stop capacity (TCQSM method): one bay 68 buses/h at ≤30 s dwell, 20–26 at 60–120 s, two bays 120; signal at a near-side stop −30 %, https://nzta2.cwp.govt.nz/walking-cycling-and-public-transport/public-transport/public-transport-framework/integrated-planning-and-design/public-transport-design-guidance/bus-stop/bus-stop-capacity'

new_node('bus_stop_design',
         'How the stop at the intersection is built, both directions. 0 = kerbside stop (today; the bus pulls into the parking lane and must merge back), '
         '1 = bus bulb (Haltestellenkap: the kerb is built out to the bus, which stops in its lane; needs the sidewalk extension on 1/8, otherwise it counts as kerbside), '
         '2 = two-bay stop (two buses at once; on a kerb with parking it costs 6 more spaces). Set by the bus-stop options that unlock with a bus lane at SP 2.',
         X, -870, value=0, mn=0, mx=2, active=46)
new_node('all_door_boarding',
         'Passengers board at every door. Cuts boarding time per passenger by 16 % (UC study, two Los Angeles lines, https://escholarship.org/uc/item/4jq618k5). '
         '[FLAG] game: no spawn option sets it yet; the game needs one.',
         X, -750, value=0, mn=0, mx=1, active=47, evidence='empirical: UC study, two LA lines')
new_node('boardings_per_bus_stop',
         'Passengers boarding one bus at the stop. [FLAG] estimate: about 15–20 % of a 55-passenger load (occupancy_rates_busses) turns over at a busy inner-city stop, so about 10.',
         X, -630, value=10, mn=0, mx=40, unit='people')
new_node('bus_bulb_fit',
         'Bulb as the street can hold it: 1 only with bus_stop_design ≥ 1 and the sidewalk extension on 1/8. Guard, like the other *_fit nodes.',
         X, -510, expr='min(1, bus_stop_design)*sidewalk_extension_spawn_2', mx=1)
new_node('bus_dwell_s',
         'Seconds a bus stands at the stop: door cycle 4 s + boardings × 3.5 s (smart card, TCQSM) × (1 − 0.16 with all-door boarding). 39 s today. '
         '[FLAG] estimate: the 4 s door cycle (no TCQSM constant found).',
         X, -390, expr='4 + boardings_per_bus_stop*3.5*(1 - 0.16*all_door_boarding)', mx=200, unit='s')
new_node('bus_stop_capacity_h',
         'Buses per hour the stop can serve: bays × 3600 / (dwell + 23 s) × 0.7. The 23 s (clearance and operating margin) is fitted so one bay gives NZTA\'s 68 buses/h at 30 s dwell; '
         'it also gives 43 at 60 s (NZTA: 20–26 at 60–120 s). Two bays count 1.76 (NZTA 120 / 68). 0.7 = signal at a near-side stop (NZTA −30 %). '
         'A bulb saves 5 s of merging back into traffic. About 41 buses/h today. '
         '[FLAG] derived: the 23 s fit; the near-side placement. [FLAG] estimate: the 5 s bulb saving (TCRP Report 65 shows the mechanism, results vary by stop).',
         X, -270, expr='(1 + 0.76*max(0, bus_stop_design - 1))*3600/(bus_dwell_s + 23 - 5*bus_bulb_fit)*0.7', mx=300, unit='buses/h')
new_node('bus_stop_saturation',
         'Buses per hour in the busier east-west direction ÷ stop capacity. 0.42 today; about 1.1 with bus lanes and a kerbside stop, before the penalty pulls riders back.',
         X, -150, expr='max(bus_spawn_count_2, bus_spawn_count_3)/max(1, bus_stop_capacity_h)', mx=5, unit='ratio')
new_node('bus_stop_queue_penalty',
         'Bus attractiveness lost when the stop clogs: 0 up to 80 % saturation, rising to 20 points at 120 %. Buses queue behind each other and bunch (TCQSM: a stop over capacity sets the line\'s capacity). '
         '[FLAG] game rule: the 0.8–1.2 ramp and the 20 points (= the value of the east-west bus lanes, so a clogged stop undoes what the lanes bought). '
         'Closes a loop (riders → buses → full stop → fewer riders); the solver settles it, see the check script.',
         X, -30, expr='20*min(1, max(0, (bus_stop_saturation - 0.8)/0.4))', mx=20, unit='points')
new_node('bus_stop_parking_loss',
         'Extra kerb spaces a two-bay stop takes, both directions: 3 per side (about 17 m more stop zone at 5.7 m per space, EAR 05), only while lane 1/8 is parking. '
         '§12 StVO already bans parking 15 m either side of every stop sign; today\'s stops are inside the 180. [FLAG] estimate: the 17 m.',
         X, 90, expr='6*max(0, bus_stop_design - 1)*(1 - sidewalk_extension_spawn_2)*(1 - bike_lanes_spawn_2)', mx=12, unit='spaces')
new_node('bus_stop_access',
         'Points for having stops (replaces the flat +10 per stop): access 50 × (1 − e^(−stops/1.5)) minus 4.41 per stop for the time each stop costs the bus. '
         'Three stops (today) still give 30; the third stop adds only +2, so more stops stop paying off. '
         'Sources for the force: stop consolidation sped buses up by nearly 6 % with no loss of riders (El-Geneidy et al. 2006, https://www.worldtransitresearch.info/research/475); '
         'Berlin\'s transit plan sets stop catchments of 300–500 m by density. [FLAG] derived: the curve shape and 4.41 are fitted to keep today at 30.',
         X, 210, expr='50*(1 - exp(-bus_stops/1.5)) - 4.4110786*bus_stops', mx=50, unit='points')

for s, d, src, st in [
    ('bus_stop_design', 'bus_bulb_fit', '', 'assumption'),
    ('sidewalk_extension_spawn_2', 'bus_bulb_fit', '', 'assumption'),
    ('boardings_per_bus_stop', 'bus_dwell_s', BOARD_SRC, 'empirical'),
    ('all_door_boarding', 'bus_dwell_s', 'UC study, two Los Angeles lines: −16 % dwell per boarding, https://escholarship.org/uc/item/4jq618k5', 'empirical'),
    ('bus_dwell_s', 'bus_stop_capacity_h', NZTA, 'empirical'),
    ('bus_stop_design', 'bus_stop_capacity_h', NZTA, 'empirical'),
    ('bus_bulb_fit', 'bus_stop_capacity_h', 'TCRP Report 65, Evaluation of Bus Bulbs, https://onlinepubs.trb.org/onlinepubs/tcrp/tcrp_webdoc_19-a.pdf', 'assumption'),
    ('bus_spawn_count_2', 'bus_stop_saturation', '', 'assumption'),
    ('bus_spawn_count_3', 'bus_stop_saturation', '', 'assumption'),
    ('bus_stop_capacity_h', 'bus_stop_saturation', '', 'assumption'),
    ('bus_stop_saturation', 'bus_stop_queue_penalty', 'TCQSM (stop capacity limits line capacity); ramp is a game rule', 'hypothesis'),
    ('bus_stop_queue_penalty', 'mob_attract_bus', '', 'hypothesis'),
    ('bus_stop_design', 'bus_stop_parking_loss', '§12 StVO; EAR 05 (5.7 m per parallel space)', 'assumption'),
    ('sidewalk_extension_spawn_2', 'bus_stop_parking_loss', '', 'assumption'),
    ('bike_lanes_spawn_2', 'bus_stop_parking_loss', '', 'assumption'),
    ('bus_stop_parking_loss', 'parallel_parking', '', 'empirical'),
    ('bus_stops', 'bus_stop_access', 'El-Geneidy et al. 2006; Nahverkehrsplan Berlin', 'assumption'),
    ('bus_stop_access', 'mob_attract_bus', '', 'assumption'),
]:
    edge(s, d, source=src, status=st)
drop_edge('bus_stops', 'mob_attract_bus')

set_expr('mob_attract_bus', 'base+ total_bus_lanes*10', 'bus_stop_access + total_bus_lanes*10')
nodes['mob_attract_bus']['node_formula']['expression'] += ' - bus_stop_queue_penalty'
prepend('mob_attract_bus',
        'Stops now named in the formula: bus_stop_access (today 30, same as the old edge aggregate in `base`) and − bus_stop_queue_penalty when the stop clogs. Supersedes the `base` explanation below.')
set_expr('parallel_parking', '- spaces_4_5*lane_4_5_open', '- spaces_4_5*lane_4_5_open - bus_stop_parking_loss')
prepend('parallel_parking', 'A two-bay bus stop takes 6 more spaces while lane 1/8 is parking (bus_stop_parking_loss).')
prepend('bus_stops',
        'Count of stops on the map (today 3), the stand-in for stop spacing. Now feeds bus_stop_access (access against bus speed) instead of a flat +10 per stop. '
        'The bus-stop options at SP 2 set how the stop is built (bus_stop_design), not this count.')

# spawn options: three stop designs per bus-stop element
opts, elems = p['spawn']['options'], p['spawn']['elements']
next_id = 1 + max(int(k[3:]) for d in (p['spawn']['points'], elems, opts) for k in d if k.startswith('id_'))
for opt_id in ['id_386', 'id_390']:
    o = opts[opt_id]
    o['label'] = 'bus_stop_kerbside'
    o['effects'] = [{'node_id': 'bus_stop_design', 'op': 'set', 'value': 0}]
    el = elems[o['elemId']]
    for label, val in [('bus_stop_bulb', 1), ('bus_stop_two_bays', 2)]:
        if any(opts[i].get('label') == label for i in el['options']):
            continue
        oid = f'id_{next_id}'
        next_id += 1
        opts[oid] = {'id': oid, 'label': label, 'unlockedElemId': None, 'elemId': o['elemId'], 'node_id': 'bus_stops',
                     'effects': [{'node_id': 'bus_stop_design', 'op': 'set', 'value': val}]}
        el['options'].append(oid)

# ---------------------------------------------------------------- lane caps: corrected capacity notes
BIKE = ('Lane cap backed: HCM 2000 uses 2,000 bikes/h for a bike lane at a signal (https://swov.nl/en/publicatie/saturation-flow-rate-start-lost-time-and-capacity-bicycles-signalized-intersections); '
        'a lane as wide as a car lane holds about two, so about 4,000/h during green and about 2,000/h over the whole signal cycle at 50 % green. '
        'Dutch counts are higher (3,000–3,500/h per 0.78 m strip, Yuan et al. TRR 2019). Model peak: about 1,850 cyclists/h per direction, so one lane holds it. '
        '[FLAG] derived: the 50 % green share; at the HCM value the lane runs at about 93 %. Supersedes "about 4,000 bikes/h at a signal" below.')
BUS = ('Lane cap backed: the stop, not the lane, limits buses: 68 buses/h for one bay, 120 for two (NZTA, TCQSM method), minus about 30 % at a signal, so 48–84 buses/h = about 2,600–4,600 people/h at 55 per bus. '
       'Model peak with bus lanes: 45 buses/h per direction. The stop limit is now modelled (bus_stop_capacity_h). Supersedes "about 4,000 people/h" below.')
for i in ['bike_lanes_spawn_2', 'bike_lanes_spawn_4']:
    prepend(i, BIKE)
for i in ['bus_lanes_spawn_2', 'bus_lanes_spawn_4']:
    prepend(i, BUS)

json.dump(p, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('wrote', OUT, 'ownership K =', OWNERSHIP_K)
