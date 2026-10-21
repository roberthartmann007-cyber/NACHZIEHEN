# Prompt: apply chunk 3 (kerb space in the sim) to update.json

Copy everything below the line into a new Claude Code session opened in the project folder.

---

Apply the approved plan `handover_kerb_sim/PLAN.md` (chunk 3, kerb space in the sim) to `update.json` in this project. Read `CLAUDE.md` first and follow it: work only inside the project folder; temp files go in `./.tmp/`; Python only from `./.venv`; ask before deleting anything; do not commit or push unless I ask.

## 1. Check the starting state (read-only), and stop and report if anything is off
- **`update.json` must already contain chunks 1 and 2:**
  - nodes `sidewalk_extension_spawn_2`, `lane_4_5_open` and `tram_line_center_fit`
  - `lane_slots` → `ew_street`, where slot 4/5 has `requires: {node: "carsharing", min: 1}`
- **Chunk 3 must not be applied yet:** no node `parking_spaces_map`, and the edge `carsharing->parallel_parking` still exists. If chunk 3 is already in, say so and stop.
- **Both earlier checks must pass:**
  - `node handover_sidewalk_extension/check_sidewalk_extension.js`
  - `node handover_centre_lane_gate/check_centre_lane_gate.js`

## 2. Apply
- **Use `.tmp/add_kerb_sim.js` if it exists:**
  ```
  node .tmp/add_kerb_sim.js update.json .tmp/update_chunk3.json
  ```
  It reads one file, writes a new one, and refuses to overwrite.
- **If the script is missing,** write it again in the style of `.tmp/add_centre_lane_gate.js`:
  - byte-exact round-trip guard on the input
  - throw if anything is not where expected
  - new nodes cloned from `occupancy_rates_cars`
  - every formula parent listed in `influenced_by` and given an edge
  - notes prefixed `2026-10-21 (kerb space in the sim):`

  The script must make exactly these changes:
  1. **Fixed nodes** (passive, no inputs, no formula; value = baseline_value): `parking_spaces_map` 180, `parking_occupancy_ref` 0.9, `spaces_1_8` 22, `spaces_4_5` 52, `cars_replaced_per_shared_car` 9, `carsharing_stations` 3, `cars_per_carsharing_station` 2, `extension_segment_length_m` 65. Mark every value except 52 and 9 as **[FLAG]** in its notes, with its basis from `HANDOVER_kerb_sim.md`.
  2. **`carsharing`:**
     - max 1, value 0, baseline 0, `active_states {a:0, b:1}`
     - delete the edge `carsharing->parallel_parking`
  3. **`parallel_parking`** (keep the id; label "parking spaces on the map (kerb parking supply)"; value and baseline 180; max 400):
     - formula `parking_spaces_map - spaces_1_8*(1 - (1-sidewalk_extension_spawn_2)*(1-bike_lanes_spawn_2)) - spaces_4_5*lane_4_5_open`
     - delete its edges to `mob_attract_bikes` (dooring) and to `car_attractivity_general`
  4. **New calculated nodes:**
     - `carsharing_cars = carsharing_stations*cars_per_carsharing_station`
     - `cars_replaced = carsharing*carsharing_cars*cars_replaced_per_shared_car`
     - `private_cars_parked = parking_spaces_map*parking_occupancy_ref - cars_replaced`
     - `parking_occupancy = private_cars_parked/max(1, parallel_parking)`
     - `parking_availability = parking_occupancy_ref/max(0.01, parking_occupancy)`
     - `cars_replaced_share = cars_replaced/max(1, parking_spaces_map*parking_occupancy_ref)`
     - `sidewalk_extension_area = 2*sidewalk_extension_spawn_2*extension_segment_length_m*2.0`
  5. **`car_attractivity_general`:**
     - in its formula, replace `max(-15, min(8, 12*(parallel_parking/18 - 1)))` with `max(-15, min(8, 12*(1.5*parking_availability - 1))) - 20*cars_replaced_share`
     - the parents become `parking_availability` and `cars_replaced_share`
     - the formula must name every parent, so its `base` aggregate stays unchanged
  6. **`pedestrians_stationary`:** the formula starts `(770 + 0.40*sidewalk_extension_area/5.5)/(1+exp(` instead of `770/(1+exp(`. Add `sidewalk_extension_area` as a parent.
  7. **`space_activity_index`:** inside the curve, after the café × furniture term, add `+ 0.05*sidewalk_extension_spawn_2`. Add the extension lever as a parent.
  8. **Spawn:** option `id_331` (`carsharing_station`, `node_id: carsharing`) gets `effects: [{node_id: "carsharing", op: "set", value: 1}]`.
  9. **Provenance edges** with `source`, `status` and `confidence`, as listed in `HANDOVER_kerb_sim.md`, plus notes on `carsharing`, `parallel_parking`, `car_attractivity_general`, `mob_attract_bikes`, `pedestrians_stationary`, `space_activity_index` and `sidewalk_extension_spawn_2`.

## 3. Verify before installing
- **Check script:** `node handover_kerb_sim/check_kerb_sim.js .tmp/update_chunk3.json` must show 17 PASS and 0 FAIL. Write it again from `HANDOVER_kerb_sim.md` if it is missing.
- **Today's outputs:** compare `update.json` with `.tmp/update_chunk3.json` (`.tmp/compare_defaults.js`, or the editor's CES engine via `/*CES-ENGINE-BEGIN*/…/*CES-ENGINE-END*/`). The only difference allowed is `parallel_parking` 27 → 180.
- **Scenarios** must match:

  | Scenario | Spaces | Cars | Car attractiveness |
  |---|---|---|---|
  | Today | 180 | 162 | 76.0 |
  | 1/8 → extension | 158 | 162 | 73.8 |
  | Carsharing | 128 | 108 | 70.5 |
  | Carsharing + extension | 106 | 108 | 67.2 |

- **Earlier checks:** both must still pass on the new file.

## 4. Install
- **Back up first** to `archive/update_before-kerb-sim.json`. If that file already exists, ask before replacing it.
- **Then** `cp .tmp/update_chunk3.json update.json` and run all three checks again on `update.json`.

## 5. Editor check
- **Start the `preview` server** from `.claude/launch.json` and open `BCC_Editor_BCC (1).html`.
- **Load `update.json`** through `loadProjectData`.
- **Confirm:**
  - the warning count equals the one for `archive/update_before-kerb-sim.json`
  - the carsharing slider stops at 1
  - option `id_331` shows the explicit effect "set carsharing = 1"
- **Stop the server.**

## 6. Report
Report the check results and the scenario table, and list every [FLAG] value that still needs a real number. Do not commit; ask me first.
