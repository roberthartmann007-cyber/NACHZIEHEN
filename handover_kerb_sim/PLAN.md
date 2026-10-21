# Plan: kerb-space effects in the sim (chunk 3) — approved 2026-10-21

> **As built** (see `HANDOVER_kerb_sim.md`), two expectations differed from this plan:
> - **Dropping dooring changes nothing in today's scene.** The edge was measured against its baseline, so it only acted once parking changed. The plan expected bikes +4.9.
> - **Two scenario numbers are exact rather than hand-rounded:** carsharing (4/5 emptied) is −5.47, not −5.4, and carsharing + 1/8 removed is −8.77, not −8.9.

## Context
The editor and slot rules now know what lane 1/8 holds (parking, bike lane or sidewalk extension) and that carsharing at SP 4 opens lane 4/5. The sim didn't use that yet:
- `parallel_parking` was a fixed 27, driven by a 0–5 carsharing count (−9 each). That comes from an older game where carsharing was placed across the map.
- The sidewalk extension had no effect.
- Dooring was still modelled.

The new game logic:
- Carsharing is one decision at SP 4. A network of stations then appears across the map.
- Building carsharing **empties lane 4/5**: the 52 cars there are gone, and the player can then build the tram or sport terrain.

## Reference numbers (fixed nodes, like `occupancy_rates_cars`)
| Node | Value | Status |
|---|---|---|
| `parking_spaces_map` | 180 | [FLAG] design team's provisional value |
| `parking_occupancy_ref` | 0.90 (→ 162 cars) | [FLAG] inner-city assumption, range 0.8–1.0 |
| `spaces_4_5` | 52 (26 east + 26 west) | design-team value |
| `spaces_1_8` | 22 | [FLAG] estimate from stall geometry (EAR 05) |
| `cars_replaced_per_shared_car` | 9 | MDPI 2021 Berlin; bcs 2023 average 15 |
| `carsharing_stations` | 3 | [FLAG] 52 / 9 = 5.8 → 6 cars at 2 per station |
| `cars_per_carsharing_station` | 2 | [FLAG] |
| `extension_segment_length_m` | 65 | [FLAG] from the stall estimate |

## Node changes
- **`carsharing`:** 0/1. The edge into `parallel_parking` is removed.
- **`parallel_parking`** = parking spaces on the map:
  `parking_spaces_map - spaces_1_8*(1 - (1-ext)*(1-bike)) - spaces_4_5*lane_4_5_open`
- **New calculated nodes:**
  - `carsharing_cars`
  - `cars_replaced`
  - `private_cars_parked`
  - `parking_occupancy`
  - `parking_availability`
  - `cars_replaced_share`
- **`car_attractivity_general`:** the parking term reads `parking_availability`, and an ownership term `-20*cars_replaced_share` is added [FLAG].
- **Dooring:** the edge `parallel_parking → mob_attract_bikes` is removed.
- **Room to stay:**
  - `sidewalk_extension_area`
  - lingering ceiling `770 + 0.40*area/5.5`
  - activity term `+0.05*ext` [FLAG]
- **No traffic buffer factor.**
- **Spawn:** `carsharing_station` sets carsharing = 1.

## Verification
- `check_kerb_sim.js`
- rerun the chunk 1 and 2 checks
- compare today's outputs before and after
- editor preview
