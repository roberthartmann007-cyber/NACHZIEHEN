# Start state: plan to reset update.json

The street today: every kerb lane and the middle lane hold parked cars, nothing has been built,
and there is no speed limit. Both `value` and `baseline_value` are set to the start for every
active node, so the game and the editor begin at the same place.

## The start (per area)

| Area | Start | Sim nodes |
|---|---|---|
| E-W kerb lane 1/8 | parked cars, no extension, no bike lane | `sidewalk_extension_spawn_2` 0, `bike_lanes_spawn_2` 0 |
| E-W lanes 2/7, 3/6 | car lanes | `car_lanes_spawn_2` 2, `bus_lanes_spawn_2` 0 |
| Middle lane 4/5 | parked cars | `tram_line_center` 0, `carsharing` 0 (keeps `lane_4_5_open` 0), `middle_part_covered_trees` 0 |
| N-S kerb lane a/f | parked cars | `ns_outer_parking_spawn_4` 1 |
| N-S lanes b/e, c/d | car lanes | `car_lanes_spawn_4` 2, `bike_lanes_spawn_4` 0, `bus_lanes_spawn_4` 0 |
| Speed limit | none (50 km/h) | `speed_limit` 0 |
| Kerb / corner modules | none | `ev_charger`, `grass`, `bike_parking`, `bike_lane_protection`, `protected_intersection` 0 |
| Public space modules | none | `urban_furniture`, `cafe`, `blue_infrastructure`, `plaza_trees`, `quiet_garden`, `inclusive_play_court`, `accessible_comfort_station`, `community_pavilion`, `separated_dog_garden`, `playground` 0 |
| Buildings / facades | none | `green_facades` 0, SP 6 buildings `school`, `park`, `sport_facility` 0 |
| Bus | today's 3 kerbside stops, front-door boarding | `bus_stops` 3, `bus_stop_design` 0, `all_door_boarding` 0 |

## What actually changes

Most `value` fields are already at the start; the test leftovers are mostly in `baseline_value`.

| Node | value | baseline | → start |
|---|---|---|---|
| `bike_lanes_spawn_2`, `bike_lanes_spawn_4` | 0 | 1 | 0 |
| `bus_lanes_spawn_2`, `bus_lanes_spawn_4` | 0 | 1 | 0 |
| `tram_line_center` | 0 | 1 | 0 |
| `middle_part_covered_trees` | 0 | 1 | 0 |
| `ev_charger` | 0 | 3 | 0 |
| `grass` | 0 | 4 | 0 |
| `protected_intersection` | 0 | 4 | 0 |
| `cafe` | 0 | 1 | 0 |
| `green_facades` | 0 | 1 | 0 |
| `blue_infrastructure` | **2** | 2 | 0 |
| `school`, `park`, `sport_facility` | **1** | 1 | 0 |

`blue_infrastructure` and the three buildings change the computed start (temperature, greenery,
`new_typologies`, walking). Everything else only fixes `baseline_value`.

## Open (not covered by the description, left as they are unless decided)

- `supermarket`, `pharmacy_health`, `local_services` = 1: these are not modules (no spawn option), so 1 reads as "exists in the neighbourhood". Keep?
- `traffic_demand_input`: value 10,008, baseline 3,500. Which one is today?
- Scenario and parameters stay: `neutral_weather` 1, `extreme_summer_heat` 0, `rain` 0, `bus_service_index` 50, `bus_service_gain` 4.

## Spawn map changes (so the map shows the same start)

- SP 3 middle element (`tram_line_center` / `sport_facility` / `car_lanes_spawn_2`): add a `parking` option and make it the starting state. Effects: `tram_line_center` = 0, `car_lanes_spawn_2` = 2.
- SP 6 middle lane (`playground` / `sport_facility`): add a `parking` option as the starting state, with effects `playground` = 0, `sport_facility` = 0.
- Lane 1/8 (`parking`) and a/f (`ns_outer_parking_spawn_4_1`) already start as parking.

## Steps (≈30 min)

1. Script `set_start_state.py` (next to this plan): one table of node → start, writes `value` and `baseline_value`, adds the two `parking` options, and prints every change. No other fields touched.
2. Run it, then load `update.json` in the editor: no new warnings, parking 180 / occupancy 0.95 / parked cars 171 unchanged.
3. Run all `handover_*/check_*.js`. A check that breaks because it expected `blue_infrastructure` 2 or the buildings at 1 gets its expected value updated, with a line in its handover note.
4. Write the before/after of the key outputs (health, NO₂, PM2.5, cars/h, temperature, walking share) into this file.
5. Commit.

## Known gap (already flagged in the sim)

The a/f parked cars are not counted in `parallel_parking`: `parking_spaces_map` (180) holds lane 1/8 (38) and lane 4/5 (52) only, so turning a/f into greenery frees no spaces. Fixing that needs the a/f space count. Separate task, not part of the reset.

## Done (2026-10-29)

Ran `set_start_state.py`; backup in `archive/update_before-start-state.json`. 25 changes, exactly
the table above plus the spawn map: `parking` options added to SP 3 middle element (`id_456`) and
SP 6 middle lane (`id_457`), both set as starting state, and lanes b/e and c/d now start as
`car_lanes_spawn_4` (they had no starting state). Open items left as they were: `supermarket`,
`pharmacy_health`, `local_services` stay 1; `traffic_demand_input` and the scenario inputs untouched.

Today's computed outputs (no overrides), before → after:

| Output | Before | After |
|---|---|---|
| `health_index` | 27.04 | 23.56 |
| `no2` | 50.06 | 50.65 |
| `pm25` | 23.12 | 23.29 |
| `amount_of_cars` | 5413 | 5485 |
| `temperature` | 18.8 | 19 |
| `walking_mode_share` | 2.49 | 1.21 |
| `new_typologies` | 6 | 3 |
| `public_space_quality` | 7.75 | 2.33 |
| `number_of_pedestrians` | 217 | 105 |
| `parallel_parking` / `parking_occupancy` / `private_cars_parked` | 180 / 0.95 / 171 | 180 / 0.95 / 171 |

Checks (`handover_*/check_*.js`): same PASS/FAIL as before the reset, except two items.
- Tier 2/3/4 "today: every node unchanged" lists more nodes: expected, they compare against the
  files from before those changes, and the start has moved.
- **New failure, tier 2:** the bus-stop loop no longer settles for bus lanes + bus bulb + sidewalk
  extension (oscillates, still unsettled at 60 passes; before: 11 passes). Saturation sits at
  about 1.04, right at the edge where the queue penalty kicks in. A model stability issue the new
  start exposes; not fixed here.
