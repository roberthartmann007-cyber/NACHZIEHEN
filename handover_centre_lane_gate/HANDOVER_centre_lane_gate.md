# Handover: centre lane 4/5 opens with carsharing (chunk 2 of 2)

**For:** whoever owns the game's environment simulation (CES) and street layout (CTS)
**Model file:** `update.json` (before this chunk: `archive/update_before-centre-lane-gate.json`)
**Editor:** `BCC_Editor_BCC (1).html`
**Date:** 2026-10-21
**Builds on:** `handover_sidewalk_extension/` (chunk 1)

## Behaviour

**Players can build on the centre lane 4/5 (SP 3) only once they have built a carsharing station at SP 4.**

- **Until then, 4/5 stays parking.** No car lane on 4/5, no tram and no sport terrain.
- **Once carsharing ≥ 1**, 4/5 is free to use.
- **Removing carsharing again is blocked while 4/5 holds a lane.** The player has to clear 4/5 back to parking first.

**Game logic:** carsharing stands in for the cars parked on 4/5. The existing model link `carsharing → parallel_parking` (−9 per station, MDPI 2021) points the same way.

## What changed

### Model (`update.json`)
- **New passive node `lane_4_5_open`**: `carsharing >= 1 ? 1 : 0`.
- **New guard `tram_line_center_fit`**: `min(tram_line_center, lane_4_5_open)`.
  - These nodes now read it instead of the raw tram lever: `mode_util_spawn_2/3`, `tram_spawn_count_2/3` and `car_lanes_spawn_2_fit`.
- **`car_lanes_spawn_2_fit`**: car lanes fit on 2/7 and 3/6, and on 4/5 only while it is open:
  `max(0, min(car_lanes_spawn_2, 2 + lane_4_5_open - bus_lanes_spawn_2 - tram_line_center_fit - min(bike_lanes_spawn_2, sidewalk_extension_spawn_2)))`
- **`lane_slots` → `ew_street`:** slot 4/5 gets `"requires": {"node": "carsharing", "min": 1}`.
- **Spawn:**
  - the SP 3 element (lane 4/5, still named "New element") gets `requires: [{elem: id_326 (pocket_modules, SP 4), any_of: [id_331 (carsharing_station)]}]`
  - option `car_lane_4_mirrored_5` → `car_lanes_spawn_2` (was unlinked)
- **Saved `car_lanes_spawn_2` changed from 3 to 2** (the starting layout). Car 3 uses 4/5, which the saved file can't do without carsharing.
  - **With the same lever values, every result is identical to before.** The only change in the saved state comes from car 3 → 2.

### Editor
- **Gated slots.** A slot with `requires` can only be used while its node meets the minimum.
  - Car and tram stop where the street is full.
  - The message says what is locked: "locked: lane 4/5 (needs carsharing ≥ 1)". The validation panel says the same for a saved layout that doesn't fit.
- **The gate node is protected.** Lowering `carsharing` stops while a lane still sits on 4/5, with a toast telling the player to clear 4/5 first.
- **Generic:** any slot in any street can get a `requires`.

## Reference numbers

E–W at 2*, per hour:

| Layout | Carsharing | Cars | Bikes | Trams | `displaced_cars` |
|---|---|---|---|---|---|
| Saved / starting street: car 2 | 0 | 2,165 | 146 | 0 | 1,590 |
| Car 2 + carsharing | 1 | 2,111 | 155 | 0 | 1,479 |
| Car 3 (car lane on 4/5) | 1 | 2,180 | 144 | 0 | 190 |
| Car 2 + tram on 4/5 | 1 | 1,645 | 121 | 6.27 | 521 |

**Saved state, before → after** (car 3 → 2):

| Value | Before | After |
|---|---|---|
| Cars at 2* | 2,233 | 2,165 |
| `displaced_cars` | 298 | 1,590 |
| `amount_of_cars` | 5,552 | 5,413 |
| Noise | 78.9 dB | 78.8 dB |
| `health_index` | 26.1 | 27.0 |
| `public_space_quality` | 7.65 | 7.69 |

## What the game needs to do

1. **Lock the SP 3 element** until the carsharing station at SP 4 is built. This uses the element's `requires`.
2. **Same rule in CTS:** car lane, tram bed and open space on the centre slot only while carsharing ≥ 1.
3. **Decide what happens when carsharing is removed** while 4/5 is in use. The editor blocks it. `requires` says "re-checked continuously", so the game might instead revert 4/5 to parking. Both work for the model, because the guards then count no car lane and no tram on 4/5.

## Open points

- **Challenge order.** SP 3 belongs to challenge 1 and SP 4 to challenge 2. So 4/5 can only open once players reach challenge 2 and return to SP 3. Check that this is intended.
- **Sport terrain on 4/5 is locked too**, because the gate sits on the element. It has no effect in the sim.
- **The carsharing station's own gate.** The pocket modules at SP 4 say "placeable after changes at spawn 1", but have no `requires` yet. If they get one, the carsharing station and lane 4/5 inherit that chain.
- **Parking supply.** Clearing 4/5 does not change `parallel_parking` yet. That belongs with the public-space chunk.
- **Name.** The SP 3 element is still called "New element". Renaming it to `lane_4/5` would match `lane_1/8`.

## How to check it works

```bash
node handover_centre_lane_gate/check_centre_lane_gate.js
```

20 checks: the gate formulas, no raw tram readers left, the spawn `requires`, the saved layout, and all 256 combinations (east–west levers × carsharing 0–3) against the guards.

**In the editor:** open `update.json`.
- The car slider stops at 2, and the tram can't be switched on. The message says lane 4/5 needs carsharing.
- Set carsharing to 1: car 3 or the tram now fit.
- With car 3, try to set carsharing back to 0: it stays at 1, and a toast says to clear 4/5 first.

## Files

| File | What it is |
|---|---|
| `handover_centre_lane_gate/check_centre_lane_gate.js` | Read-only check of this chunk |
| `archive/update_before-centre-lane-gate.json` | `update.json` after chunk 1, before chunk 2 |
| `.tmp/add_centre_lane_gate.js` | The script that applies this chunk, rerunnable from the archived file (not in git) |
