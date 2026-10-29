"""EV switch: turn the EV charger into a 0/1 module that makes every car on the map electric.

Wires the switch into NO2, PM2.5 and noise. The noise effect depends on the avg_speed telemetry node.
Reads archive/update_before-ev-switch.json, writes update.json. Re-runnable.
usage: .venv/bin/python handover_ev_switch/build_ev_switch.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'archive', 'update_before-ev-switch.json')
OUT = os.path.join(ROOT, 'update.json')
TAG = '2026-10-29 (EV switch): '

p = json.load(open(SRC, encoding='utf-8'))
nodes = {n['id']: n for n in p['nodes']}
edges = p['edge_heuristics']


def prepend(node_id, text):
    n = nodes[node_id]
    n['notes'] = TAG + text + ((' ' + n['notes']) if n.get('notes') else '')


def edge(src, dst, formula=None, source='', notes='', status='assumption'):
    edges[f'{src}->{dst}'] = {'value': '', 'source': source, 'notes': notes, 'status': status, 'confidence': '',
                              'weight': 1, 'formula': formula, 'color': '', 'issue_status': 'none', 'issue_priority': 0}
    if dst not in nodes[src]['influences']:
        nodes[src]['influences'].append(dst)
    if src not in nodes[dst]['influenced_by']:
        nodes[dst]['influenced_by'].append(src)


# 1. The switch. The id stays ev_charger so the spawn map and set_start_state.py keep working.
ev = nodes['ev_charger']
ev.update({'label': 'Module: all cars electric (EV switch)', 'min': 0, 'max': 1, 'baseline_value': 0, 'value': 0,
           'active_control': 'switches', 'active_states': {'a': 0, 'b': 1}, 'evidence_status': 'assumption'})
ev['notes'] = TAG + (
    'Was a 0–6 charger count with no links. Now a 0/1 module: when it is on, every car on the map is electric '
    '(the game swaps the combustion cars for EVs). The number of cars does not change, only what they emit. '
    'Effects: NO2 drops to its background (6 µg/m³); PM2.5 loses its exhaust share (40% of the traffic part); '
    'noise drops by ev_noise_reduction, which depends on the average speed (avg_speed telemetry). '
    'Buses, trams and the background pollution are not affected. '
    'Replaces the old only_evs switch (24.06 model), whose links were placeholders (NO2 −1000, a flat −5 dB).')

# 2. NO2: electric cars have no exhaust, so the traffic part of NO2 goes away.
edge('ev_charger', 'no2',
     formula={'type': 'equation', 'mode': 'absolute',
              'expression': 'y = baseline - x * max(0, 0.00814 * amount_of_cars - 4 * speed_limit)',
              'label': 'EV switch removes the traffic NO2 (cars × 0.00814, minus the speed-limit cut)'},
     source='Berlin Clean Air Plan (road traffic is the main NO2 source); same rate as amount_of_cars->no2',
     status='derived',
     notes=('When the switch is on (x = 1) it takes away exactly what the cars add: 0.00814 µg/m³ per car/h '
            '(amount_of_cars->no2), less the −4 the speed limit already removes (speed_limit->no2). '
            'NO2 then sits at its 6 µg/m³ background (heating, shipping, construction, regional air). '
            'max(0, …) stops the switch from adding NO2 when there are very few cars. '
            '[FLAG] simplification: EVs have no exhaust NO2; any NO2 from power plants is outside the map.'))
prepend('no2', 'The EV switch (ev_charger) removes the traffic part: with all cars electric NO2 equals the 6 µg/m³ background.')

# 3. PM2.5: only the exhaust share goes; tyre, brake and road dust stay.
edge('ev_charger', 'pm25',
     formula={'type': 'equation', 'mode': 'absolute',
              'expression': 'y = baseline - x * 0.4 * 0.00235 * amount_of_cars',
              'label': 'EV switch removes the exhaust share (40%) of the traffic PM2.5'},
     source='EEA 2023: road-traffic PM2.5 is about 40% exhaust, 60% non-exhaust (tyre, brake, road wear)',
     status='derived',
     notes=('When the switch is on, PM2.5 loses 40% of what the cars add (0.00235 µg/m³ per car/h, amount_of_cars->pm25). '
            'The 60% from tyres, brakes and road dust stays, because EVs still drive on tyres. '
            'At the 1,105 cars/h reference this is −1.04 µg/m³. '
            'This is the local share only; the −2.16 in the PM2.5 notes is for a city-wide electric fleet, which this switch does not cover. '
            '[FLAG] EVs are heavier and can make slightly more tyre dust; not modelled.'))
prepend('pm25', 'The EV switch (ev_charger) removes the exhaust share of the traffic PM2.5 (−40% of 0.00235 × cars); the background and the −2.16 city-wide case below are unchanged.')

# 4. Noise: helper node that turns the switch and the average speed into dB saved.
NOISE_EXPR = 'ev_charger * min(4, max(0, 0.1 * (60 - avg_speed)))'
helper = {
    'id': 'ev_noise_reduction', 'label': 'EV noise reduction', 'type': 'passive', 'status': 'defined',
    'influences': [], 'influenced_by': [], 'priority': '', 'value_kind': 'absolute', 'unit': 'db',
    'passive_precision': 'decimals', 'node_formula': {'enabled': True, 'expression': NOISE_EXPR},
    'baseline_value': 0, 'value': 0, 'min': 0, 'max': 4, 'active_control': None, 'active_order': None,
    'active_states': None, 'evidence_status': 'assumption',
    '_x': nodes['ev_charger'].get('_x', 0), '_y': nodes['ev_charger'].get('_y', 0) + 180,
    'notes': TAG + 'NEW. ' + (
        'How many dB quieter the street gets when every car is electric. Depends on avg_speed (telemetry, km/h): '
        'reduction = 0.1 × (60 − avg_speed), between 0 and 4 dB. '
        'So about 3 dB at 30 km/h, 1.5 dB at 45 km/h, 1 dB at 50 km/h and 0 from 60 km/h. '
        'Why: an electric motor is much quieter than an engine, but tyre noise grows with speed and is the same for both, '
        'so the gap closes as cars get faster. Below 20 km/h EVs must play a warning sound (AVAS, EU 540/2014), '
        'so the saving is capped at 4 dB. Every car changes, so the dB saving applies to the whole traffic level. '
        'Today avg_speed comes from the speed limit (30-zone ≈ 30, 50-zone ≈ 45 km/h); live telemetry will override it. '
        '[FLAG] estimate: shape and the 4 dB cap are our reading of UBA and CNOSSOS-EU findings, not a fitted curve.'),
}
p['nodes'].append(helper)
nodes['ev_noise_reduction'] = helper
edge('ev_charger', 'ev_noise_reduction', notes='The switch: 0 = no saving, 1 = full saving for the current speed.')
edge('avg_speed', 'ev_noise_reduction', status='derived',
     notes='Average vehicle speed (telemetry). The EV saving is largest at low speed and gone by 60 km/h.')
edge('ev_noise_reduction', 'noise_level',
     formula={'type': 'linear_scale', 'mode': 'absolute', 'slope': -1, 'intercept': 0,
              'label': 'noise drops 1:1 by the EV saving (dB)'},
     status='derived',
     notes='Subtracts the EV saving from the traffic noise level (RLS-90 level from amount_of_cars, minus the speed-limit cut).')
prepend('noise_level', 'New input ev_noise_reduction: with the EV switch on, noise drops by 0–4 dB depending on avg_speed (≈3 dB at 30 km/h, ≈1.5 dB at 45 km/h).')

# 5. Spawn map: placing the module turns the switch on.
opt = p['spawn']['options']['id_333']
opt['label'] = 'ev_switch (all cars electric)'
opt['node_id'] = 'ev_charger'
opt['effects'] = [{'node_id': 'ev_charger', 'op': 'set', 'value': 1}]

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(p, f, ensure_ascii=False, indent=2)
print('wrote', OUT)
