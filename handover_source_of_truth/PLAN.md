# One source of truth: game modules ↔ sim (revised plan)

Goal: the webtool (`BCC_Editor_BCC (1).html` → `update.json`) uses one vocabulary,
and every number it shows is measured against **one agreed starting point: the street as it is today**.

Spawn numbers below are the sim's (sim SP n = game SP n+1).

---

## What changed in this revision

The slider positions saved in `update.json` are not the street's starting state.
Most are left over from test sessions where people moved sliders. Both fields are affected:

- `value`: the slider position as last saved. The editor previews every spawn option against it.
- `baseline_value`: also unreliable. It disagrees with `value` on 17 of the 44 active nodes, for example `tram_line_center` is 1, `protected_intersection` 4 and `grass` 4.

Only some nodes have a start that a backed rule fixes (Tier 1–4 notes, lane slots, the map).
So any preview, check or link built on today's saved values is partly measured against test noise.
**The renames and links done so far are still fine** (they don't depend on values), but the effect chips are not trustworthy until Step 1 is done.

The spawn map's own `startingState` per element (parking on 1/8, car lanes on 2/7 and 3/6, parking on a/f) describes the map drawing and matches `lane_slots`. Treat it as the real layout. It is the node values that need resetting.

---

## Step 1 · Agree a start value for every active node (the core of this plan)

Give each of the 44 active nodes a **start class** and a **start value**. Write the class into the node's note as the first line, e.g. `start: map · 2`, so the editor and the game team can read it.

| Class | Meaning | Start comes from |
|---|---|---|
| **map** | the drawn street today | spawn `startingState` + `lane_slots` |
| **sourced** | a real-life number with a source in the notes | Tier 1–4 backing |
| **built** | something a player adds | 0, unless the street already has it today |
| **place** | does the neighbourhood have this today? | team decision from the real site (Torstraße) |
| **scenario** | weather / event, not a module | fixed default, switched by the game |
| **parameter** | model tuning or external input | fixed, never a player choice |

### Proposed classification (✓ = saved `value` already right, ⚠ = decide)

**map** (start fixed by the drawn layout)
| Node | Start | Saved value | Saved baseline |
|---|---|---|---|
| `car_lanes_spawn_2` | 2 | 2 ✓ | 2 |
| `car_lanes_spawn_4` | 2 | 2 ✓ | 2 |
| `bike_lanes_spawn_2` | 0 | 0 ✓ | 1 |
| `bike_lanes_spawn_4` | 0 | 0 ✓ | 1 |
| `bus_lanes_spawn_2` | 0 | 0 ✓ | 1 |
| `bus_lanes_spawn_4` | 0 | 0 ✓ | 1 |
| `tram_line_center` | 0 | 0 ✓ | 1 |
| `sidewalk_extension_spawn_2` | 0 | 0 ✓ | 0 |
| `ns_outer_parking_spawn_4` | 1 | 1 ✓ | 1 |
| `carsharing` | 0 (lane 4/5 is parking) | 0 ✓ | 0 |

**sourced**
| Node | Start | Note |
|---|---|---|
| `bus_stops` | 3 | "today 3" (Tier 2) ✓ |
| `bus_stop_design` | 0 | kerbside today (Tier 2) ✓ |
| `speed_limit` | 0 (50 km/h) | ⚠ confirm Torstraße is 50 today |
| `traffic_demand_input` | ⚠ | saved 10,008, baseline 3,500. Notes give 26,520 vehicles/day (2019) and 18,200–32,300 (2023): derive a peak-hour value from that |

**built** (proposed start 0 unless the street has it today)
| Node | Saved value | Saved baseline | Today? |
|---|---|---|---|
| `grass` | 0 | 4 | ⚠ |
| `cafe` | 0 | 1 | ⚠ existing cafés? |
| `urban_furniture` | 0 | 0 | ⚠ existing benches? |
| `green_facades` | 0 | 2 | ⚠ |
| `blue_infrastructure` | **2** | 2 | ⚠ probably 0 |
| `spawn_2_canopy_streets` | 0 | 2 | ⚠ existing street trees? |
| `middle_part_covered_trees` | 0 | 1 | ⚠ |
| `ev_charger` | 0 | 3 | ⚠ existing chargers? |
| `bike_lane_protection`, `bike_parking` | 0 | 0 | ⚠ existing racks? |
| `protected_intersection` | 0 | 4 | 0 |
| `all_door_boarding` | 0 | 0 | 0 (BVG boards at the front door) ⚠ |
| `playground`, `plaza_trees`, `quiet_garden`, `inclusive_play_court`, `accessible_comfort_station`, `community_pavilion`, `separated_dog_garden` | 0 | 0 | 0 ✓ |

**place** (all saved as 1, meaning "exists today"). Decide per node:
`supermarket`, `school`, `sport_facility`, `park`, `pharmacy_health`, `local_services`.
- If it exists today, keep it at 1. Then the SP 6 option linked to it (`school`, `sport_facility`, `park`) adds nothing; either drop the link or give the option its own "+1 more" meaning.
- If it does not exist today, set it to 0 and the SP 6 building adds it.
- Note: `new_typologies` (6 today) and `destination_density_index` read these, so this choice shifts walking numbers.

**scenario**: `neutral_weather` 1, `extreme_summer_heat` 0, `rain` 0 ✓

**parameter**: `bus_service_index` 50, `bus_service_gain` 4 ✓

---

## Step 2 · Write the start into the file, once, in both fields

- Set `value` **and** `baseline_value` to the agreed start for every active node, so the game and the editor start at the same place.
- Keep test slider positions out of `update.json`. Anyone who wants a what-if saves it as a separate scenario file (`scenarios/<name>.json`).
- Do it with a script (like `align_spawn_names.py`) that reads a small table `start_values.csv` (node, class, start, source). That table becomes the reviewable source of truth for starts.

⚠ Check before the reset: which of `value` / `baseline_value` the game reads at start (editor comment: the game falls back to 0 when `baseline_value` is missing). Setting both to the same number avoids the question.

## Step 3 · Re-check the calibrated outputs

Some Tier 1–4 numbers were tuned so the start reproduces real figures (parking occupancy 0.95, `private_cars_parked` 171, 180 parking spaces, mode shares).
After the reset:
1. Run every `handover_*/check_*.js`. A failing check either found a test artefact that had been calibrated around, or a check that hard-codes an old value. Fix the one that's wrong, not the other by default.
2. Compare the key outputs (health, NO₂, PM2.5, cars/h, temperature, mode shares) before and after, and write the differences into a short note.

## Step 4 · Previews against the start, not the open sliders

The editor previews an option against the slider values as the file was opened (`authoredInputs`).
After Step 2 those are the start values, so the chips are right **as long as nobody saves moved sliders**.
To make that permanent: a small editor change so previews read `baseline_value` instead (optional, ask first).

## Step 5 · Finish the naming plan (from the first version)

With trustworthy starts, re-check the links from the rename step:
- `sport_facility`, `blue_infrastructure` links showed no effect only because the saved value was at max. They will show effects if Step 1 sets them to 0.
- Then continue with: options for sim nodes that have no game option yet (green boulevard, bike parking, N-S bus lane, all-door boarding, protected intersection, play court, dog pocket), cosmetic placeholders for new doc modules, and `scenario` / `parameter` notes.

---

## Order and time

| Step | Who | Time |
|---|---|---|
| 1 · classify + decide the ⚠ rows | design team + Claude (table above is the draft) | 30–45 min, mostly the "today?" questions |
| 2 · write starts via script | Claude | 10 min |
| 3 · run checks, compare outputs | Claude, team reviews diffs | 20–30 min |
| 4 · editor preview change (optional) | Claude | 15 min |
| 5 · finish naming / options | Claude | 30 min |

Done when: every active node has a `start:` line, `value` = `baseline_value` = start, all checks pass or have a written reason, and every spawn option's preview is measured from today's street.
