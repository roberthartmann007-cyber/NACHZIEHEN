"""Rescale greenery to the 11,500 m² map and remove the double-counted cooling.
usage: .venv/bin/python handover_greenery_area/apply_greenery_area.py [project.json]
Run once: it refuses to run on a file that already has the change."""
import json, sys
from pathlib import Path

f = Path(sys.argv[1] if len(sys.argv) > 1 else 'update.json')
d = json.loads(f.read_text())
N = {n['id']: n for n in d['nodes']}
E = d['edge_heuristics']
TAG = '2026-10-29 (greenery on the 11,500 m² map): '
if TAG in N['greenery']['notes']:
    sys.exit('already applied')

def note(obj, text):
    obj['notes'] = TAG + text + ((' ' + obj['notes']) if obj.get('notes') else '')

def unlink(src, dst):
    N[src]['influences'].remove(dst); N[dst]['influenced_by'].remove(src); del E[f'{src}->{dst}']

def link(src, dst, edge):
    N[src]['influences'].append(dst); N[dst]['influenced_by'].append(src); E[f'{src}->{dst}'] = edge

# 1. greenery = % canopy of the map, from the two planted areas
g = N['greenery']
g['label'] = 'part of the intersection covered by trees (% of 11,500 m²)'
g['unit'] = '% canopy cover'
g['max'] = 40
g['node_formula'] = {'enabled': True, 'expression':
    '100*(1790*middle_part_covered_trees + 1350*spawn_2_canopy_streets*sidewalk_extension_spawn_2)/11500'}
note(g, 'Now measured as % canopy cover of the whole map (reference area 11,500 m²), from the planted areas in the new game set-up. '
     'Green boulevard on the middle lane: 1,790 m² = 15.57 %. Canopy alley on the sidewalk extension: 2,700 m² = 23.48 %, 1,350 m² = 11.74 % per side '
     '(spawn_2_canopy_streets 0–2). Maximum 39.04 % (was 49 %: 13 % middle + 2 × 18 % streets, which on this map would have meant 1,495 m² + 4,140 m², '
     'more than the 2,700 m² the extension actually covers). The node formula multiplies the alley by sidewalk_extension_spawn_2 because the trees stand '
     'on the extension; the game spawn tree already unlocks spawn_2_canopy_streets only after the sidewalk extension (option id_10 unlocks id_336), '
     'so the formula just keeps the editor in step with the game. [FLAG] assumes canopy area = planted area at maturity; crowns that overhang the road '
     'would raise it. Unit was "amount of trees", but the value has always been used as a percentage.')

E['middle_part_covered_trees->greenery']['formula']['slope'] = 15.57
E['middle_part_covered_trees->greenery']['notes'] = TAG + ('Slope 13 → 15.57: 1,790 m² green boulevard / 11,500 m² map. '
    'Provenance only; the greenery node formula computes the value.')
E['spawn_2_canopy_streets->greenery']['formula']['slope'] = 11.74
E['spawn_2_canopy_streets->greenery']['notes'] = TAG + ('Slope 18 → 11.74 per side: 2,700 m² sidewalk extension / 2 sides / 11,500 m² map. '
    'Provenance only; the greenery node formula computes the value and needs the sidewalk extension. ') + E['spawn_2_canopy_streets->greenery']['notes']
link('sidewalk_extension_spawn_2', 'greenery', {'value': '', 'source': '', 'notes': TAG + 'Gate: the canopy alley stands on the sidewalk extension, '
     'so it only counts when the extension is built. Read by the greenery node formula.', 'status': 'assumption', 'confidence': '', 'weight': 1,
     'formula': None, 'color': '', 'issue_status': 'none', 'issue_priority': 0})
note(N['middle_part_covered_trees'], 'Green boulevard on the middle lane: 1,790 m² = 15.57 % of the 11,500 m² map (was 13 %).')
note(N['spawn_2_canopy_streets'], 'Canopy alley on the E-W sidewalk extension: 1,350 m² per side, 2,700 m² for both = 23.48 % of the map '
     '(was 18 % per side, 36 %). Counts only with sidewalk_extension_spawn_2 = 1.')

# 2. remove the double-counted cooling: the link stays (the formula reads greenery) but adds 0 to base
e = E['greenery->temperature']
e['formula'] = {'type': 'linear_scale', 'mode': 'absolute', 'slope': 0, 'intercept': 0,
                'label': 'slope 0: greenery cooling is applied by the temperature node formula'}
e['notes'] = TAG + ('Slope −0.29 → 0. The temperature node formula already applies the greenery cooling, so this link counted it a second time. '
    'Kept with slope 0 (not deleted, not a plain link) so greenery stays a parent the formula can read without adding anything to base; '
    'a plain link would add a signal term. ') + e['notes']
note(N['temperature'], 'Greenery is no longer counted twice. The link greenery → temperature (−0.29 °C per % canopy) went into base, and this '
     'formula then subtracted greenery again, so full greenery took a 19 °C day to 2.2 °C and a 45 °C day to 24.4 °C. That link now has slope 0; '
     'greenery cools only through this formula: cooling = min(10, max(3, 3 + 0.28·(base − 15))) · (1 − exp(−greenery/25)). '
     'At 39 % canopy: 19 → 15.7 °C, 45 → 37.1 °C; with both green facades and both water features, 45 → 32.9 °C. '
     'The old design target "extreme heat 45 → 28 °C when all three are maxed" rested on an unsourced −6 °C for water; with water set to what '
     'field and model studies show (see blue_infrastructure → temperature), the best heat-day result is about 33 °C. Average cooling is 0.20 °C per % on a heat day and 0.08 °C per % on a normal day, '
     'below the city-scale 0.29 °C per % (EC 2023), as expected for one junction among heat-storing buildings.')

# 3. sidewalk extension area is a fixed game value
s = N['sidewalk_extension_area']
s['node_formula']['expression'] = '2700*sidewalk_extension_spawn_2'
s['max'] = 3000
unlink('extension_segment_length_m', 'sidewalk_extension_area')
note(s, 'Fixed at 2,700 m² from the new game set-up (was 4 × 65 m × 2.0 m = 520 m², capped at 2,000). 2,700 m² cannot come from the 2 m parking '
     'strip: over 4 × 65 m it would need 10.4 m width, so the extension covers more than lane 1/8 and the area is now a set value, not derived '
     'from extension_segment_length_m. Lingering ceiling in pedestrians_stationary: +0.40 × 2,700 / 5.5 ≈ +196 people (was +38).')
note(N['extension_segment_length_m'], 'No longer feeds sidewalk_extension_area, which is now a fixed 2,700 m². Still sets spaces_1_8.')
E['sidewalk_extension_area->pedestrians_stationary']['notes'] = TAG + ('With 2,700 m² the lingering ceiling rises from about 808 to 966 people. ') \
    + E['sidewalk_extension_area->pedestrians_stationary']['notes']

# 4. visual greenery index saturates at the new maximum
v = N['visual_greenery_index']
assert 'greenery/49' in v['node_formula']['expression']
v['node_formula']['expression'] = v['node_formula']['expression'].replace('greenery/49', 'greenery/39.04')
note(v, 'Canopy term now saturates at greenery/39.04, the new maximum canopy share, so full planting still fills the canopy half of the index (was /49).')
E['greenery->visual_greenery_index']['notes'] = TAG + ('Live formula uses min(1, greenery/39.04); greenery is % canopy cover of the 11,500 m² map. '
    'The 500-unit normalization below is out of date. ') + E['greenery->visual_greenery_index']['notes']

# 5. water cooling set to the evidence for small still water features
w = E['blue_infrastructure->temperature']
w['formula'] = {'type': 'linear_scale', 'mode': 'absolute', 'slope': -0.1, 'intercept': 0,
                'label': '−0.1 °C per water feature, −0.2 °C for both (typical small still water, Jacobs et al. 2020)'}
w['status'] = 'empirical'
w['confidence'] = 'medium'
w['source'] = ('Jacobs, Klok, Bruse, Cortesão, Lenzholzer & Kluck 2020, Are urban water bodies really cooling?, Urban Climate 32:100607, '
               'https://doi.org/10.1016/j.uclim.2020.100607; Völker et al. 2013, Erdkunde 67(4):355–371, https://www.erdkunde.uni-bonn.de/article/view/2737; '
               'Ulpiani et al. 2019 (mist field test), https://iris.univpm.it/handle/11566/265086')
w['notes'] = TAG + ('Slope −0.3 → −0.1 °C per unit. blue_infrastructure is a plaza module with 0–2 units, so both features give −0.2 °C. '
    'The old −6 °C maximum (20 units × −0.3) had no source and was a balance choice to reach 28 °C on a heat day. Evidence: small urban water bodies '
    'cool the air around them by about 0.2 °C on average in the afternoon, 0.6 °C at most, and are negligible in design practice (Jacobs et al. 2020, '
    'ENVI-met, REALCOOL). The 2.5 K (95 % CI 1.9–3.2) of Völker et al. 2013 is for large lakes and rivers, not plaza features. Misting and spray '
    'systems cool 2–10 °C (8.2 °C in Ulpiani et al. 2019) but only downwind, while running, and less in wind or high humidity: a local felt effect, '
    'not junction-wide air temperature. Water can also raise humidity and slightly warm the junction at night. Effects of two features are taken as '
    'additive, which is generous. Old note: ') + w['notes']
w['issue_status'] = 'none'
note(N['blue_infrastructure'], 'Plaza water feature, 0–2 units. Cools the junction by −0.1 °C each (−0.2 °C for both), from the evidence for small '
     'still water; its larger value is in the visual greenery index and public space quality, not in cooling. See blue_infrastructure → temperature.')

f.write_text(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
print('applied to', f)
