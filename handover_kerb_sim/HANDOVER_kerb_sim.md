# Handover: kerb space in the sim (chunk 3)

**For:** whoever owns the game's environment simulation (CES) and street layout (CTS)
**Model file:** `update.json` (before this chunk: `archive/update_before-kerb-sim.json`)
**Editor:** `BCC_Editor_BCC (1).html` (no change)
**Date:** 2026-10-21
**Builds on:** `handover_sidewalk_extension/` (chunk 1), `handover_centre_lane_gate/` (chunk 2)
**Plan:** `PLAN.md` in this folder

## Behaviour

- **Losing parking makes driving less attractive.** The model compares parked private cars with the parking spaces left on the map. Removing parking on lane 1/8 (for a sidewalk extension or a bike lane) pushes occupancy above 100 %.
- **Carsharing is one decision at SP 4.** It places a network of 3 stations (6 shared cars) across the map and empties lane 4/5 (52 spaces). The network replaces 54 private cars, so parking stays about as easy as today. What remains is that fewer people own a car.
- **A sidewalk extension adds room to stay:** a small activity term, which feeds public space quality, and a higher lingering ceiling.
- **Dooring is gone.** In the game a bike lane never runs next to parked cars.

**Today's scene is unchanged.** Every output is identical except `parallel_parking`, which now means "parking spaces on the map" (180 instead of the old index of 27).

## Reference numbers

These are fixed nodes with no inputs, set up like `occupancy_rates_cars`. **[FLAG]** means provisional or assumed: replace or confirm it.

| Node | Value | Basis |
|---|---|---|
| `parking_spaces_map` | 180 | **[FLAG]** design team's provisional value |
| `parking_occupancy_ref` | 0.90 → 162 cars | **[FLAG]** inner-city assumption, range 0.8–1.0 (Tegel 77–80 %; residents' areas in Cologne over 100 %) |
| `spaces_4_5` | 52 | design team: 26 east + 26 west |
| `spaces_1_8` | 22 | **[FLAG]** estimate: 26 perpendicular stalls ≈ 65 m per side → about 11 parallel stalls per side (EAR 05) |
| `cars_replaced_per_shared_car` | 9 | MDPI 2021, Berlin (already in the model). bcs 2023: 15 on average for station-based carsharing; free-floating replaces far fewer |
| `carsharing_stations` | 3 | **[FLAG]** 52 cars / 9 = 5.8 → 6 shared cars → 3 stations at 2 cars |
| `cars_per_carsharing_station` | 2 | **[FLAG]** small Berlin station-based stations |
| `extension_segment_length_m` | 65 | **[FLAG]** from the stall estimate; measure from the plan |

**To change the network size:** edit `carsharing_stations` or `cars_per_carsharing_station`. Everything downstream follows.

## Nodes

| Node | Formula |
|---|---|
| `carsharing` | active **0/1** (was 0–5); the spawn option `carsharing_station` sets it to 1 |
| `carsharing_cars` | `carsharing_stations*cars_per_carsharing_station` (6) |
| `cars_replaced` | `carsharing*carsharing_cars*cars_replaced_per_shared_car` (54 with carsharing) |
| `parallel_parking` (id kept, new label "parking spaces on the map") | `parking_spaces_map - spaces_1_8*(1 - (1-ext)*(1-bike)) - spaces_4_5*lane_4_5_open` |
| `private_cars_parked` | `parking_spaces_map*parking_occupancy_ref - cars_replaced` (162 today) |
| `parking_occupancy` | `private_cars_parked/max(1, parallel_parking)` (0.90 today) |
| `parking_availability` | `parking_occupancy_ref/max(0.01, parking_occupancy)` (1.0 today) |
| `cars_replaced_share` | `cars_replaced/max(1, parking_spaces_map*parking_occupancy_ref)` |
| `car_attractivity_general` | parking term `max(-15, min(8, 12*(1.5*parking_availability - 1)))` (+6 today, as before), plus `- 20*cars_replaced_share` **[FLAG]** |
| `sidewalk_extension_area` | `2*ext*extension_segment_length_m*2.0` (260 m²) |
| `pedestrians_stationary` | ceiling `(770 + 0.40*sidewalk_extension_area/5.5)`; the rest is unchanged |
| `space_activity_index` | adds `+ 0.05*sidewalk_extension_spawn_2` inside the curve **[FLAG]** |

**Removed edges:**
- `carsharing → parallel_parking`
- `parallel_parking → mob_attract_bikes` (dooring)
- `parallel_parking → car_attractivity_general` (now goes through `parking_availability`)

**Car attractiveness names all its parents in its formula**, so its edge aggregate (`base`) stays the baseline, as before.

## Reference numbers from the model

Everything else as saved:

| Scenario | Spaces | Cars | Occupancy | Car attractiveness | Cars at 2* | Public space quality | Lingering |
|---|---|---|---|---|---|---|---|
| Today | 180 | 162 | 0.90 | 76.0 | 2,165 | 7.69 | 4 |
| 1/8 → extension | 158 | 162 | 1.03 | 73.8 | 2,145 | 10.51 | 6 |
| 1/8 → bike lane | 158 | 162 | 1.03 | 69.6 | 1,735 | 8.10 | 5 |
| Carsharing (4/5 emptied) | 128 | 108 | 0.84 | 70.5 | 2,116 | 7.73 | 4 |
| Carsharing + extension | 106 | 108 | 1.02 | 67.2 | 2,082 | 10.58 | 6 |

**Change from the parking and ownership terms alone:**

| Scenario | Change |
|---|---|
| 1/8 removed | −2.2 |
| Carsharing | −5.47 (parking +1.2, ownership −6.7) |
| Carsharing + 1/8 removed | −8.77 |

The bike-lane row also includes the existing lane-share term.

**Lingering stays small in today's scene.** Public space quality is low (noise at about 79 dB), and lingering follows its S-curve. The extension's lingering gain shows once traffic and noise drop.

## What the game needs to do
1. **The carsharing station is one decision.** Building it sets `carsharing` = 1 and places the 3 stations across the map. They sit in pocket modules, not in the 180 spaces. They must be station-based for the replacement rate to hold.
2. **Building carsharing empties lane 4/5** of its 52 parked cars. The player can then build the tram or sport terrain.
3. **Nothing else is new for CTS.** Spaces on 1/8 follow the existing levers (`sidewalk_extension_spawn_2`, `bike_lanes_spawn_2`).

## Open points
- **Replace or confirm every [FLAG] value**, especially the counted map total, occupancy, and the spaces on 1/8.
- **Ownership term:** −20 × replaced share is assumed. It decides how much carsharing alone lowers driving.
- **Sport terrain on 4/5** has no effect yet beyond the emptied parking.

## How to check it works

```bash
node handover_kerb_sim/check_kerb_sim.js
```

17 checks: new nodes, removed edges, formulas compile, today's values, network size, the four scenarios, and the extension's effects off and on.

**The earlier checks still pass:** chunk 1 (16) and chunk 2 (20).
- Chunk 1's "no effect yet" check now only says the extension changes no lane count.
- Chunk 2 loops over carsharing 0/1.

## Files

| File | What it is |
|---|---|
| `handover_kerb_sim/PLAN.md` | The approved plan, with an as-built note |
| `handover_kerb_sim/check_kerb_sim.js` | Read-only check of this chunk |
| `archive/update_before-kerb-sim.json` | `update.json` before this chunk |
| `.tmp/add_kerb_sim.js` | The script that applies this chunk, rerunnable from the archived file (not in git) |

## Sources
- Christiansen et al. 2017, *Parking facilities and the built environment*, TR-A 95:198–206
- MDPI 2021, Berlin carsharing replacement rate (https://www.mdpi.com/2071-1050/13/13/7384); bcs carsharing study 2023
- SF Parklet Impact Study 2011; Mehta 2013, *The Street*; Fruin 1971
- Parkraumkonzept Tegel (Berlin-Reinickendorf); EAR 05; RASt 06
