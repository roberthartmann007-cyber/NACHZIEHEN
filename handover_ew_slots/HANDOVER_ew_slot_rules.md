# Handover: east–west slot rules at spawn 2

**For:** whoever owns the game's environment simulation (CES) and street layout (CTS)
**Model file:** `update.json` (the version before this change is kept as `archive/update_before-ew-slot-rules.json`)
**Date:** 2026-10-20

## Summary

On the east–west street, players fill a fixed number of slots per direction. Every lane type competes for those slots. If a player builds a bike lane, a bus lane and the tram, only one car lane still fits.

The model's levers did not know this. They were independent sliders: car 0–3, bike 0–1, bus 0–1, tram 0–1. So the model would compute layouts the game can't build, for example 3 car lanes plus a bus lane plus the tram.

The model now contains the same slot rule as the game. Car lanes get whatever room is left, and every result reads that number. In the game nothing changes, because the slots already prevent impossible layouts. In the editor and in balancing, impossible layouts can no longer distort the results.

This is meant as the pattern for the other spawn points (see the last section).

## The cross-section, per direction

Both directions are mirrored, so one choice sets both. The slots come from the spawn data (SP 2 = point "2", SP 3 = point "3").

| Slot | Options | Takes a car slot? |
|---|---|---|
| Outer, lane 1/8 | parking · bike lane · sidewalk extension | no, cars can't use it |
| Middle, lane 2/7 | car · bus · bike lane (only with a sidewalk extension on 1/8) | yes |
| Middle, lane 3/6 | car · bus | yes |
| Centre, lane 4/5 (SP 3) | car · tram · sport terrain | yes |

So there are **at most 3 car lanes**. Each of these costs one of them:
- a bus lane
- the tram
- a bike lane sitting on lane 2/7, which happens only when lane 1/8 holds a sidewalk extension

A bike lane on lane 1/8 costs no car slot.

## The rules

| Lever | Range per direction | Rule |
|---|---|---|
| `bike_lanes_spawn_2` | 0–1 | On lane 1/8, or on lane 2/7 if `sidewalk_extension_spawn_2` = 1 |
| `bus_lanes_spawn_2` | 0–1 | Takes one middle slot. **Capped at 1** (see below) |
| `tram_line_center` | 0–1 | Takes the centre slot |
| `sidewalk_extension_spawn_2` | 0–1 | **New lever.** Takes lane 1/8, so any bike lane moves to lane 2/7 |
| `car_lanes_spawn_2` | 0–3 | Only what is left: **car ≤ 3 − bus − tram − bike × sidewalk** |

**When a combination doesn't fit, cars give way.** The model can't know which lane the player placed first. Bike, bus and tram are each a single yes/no choice; car lanes are the remainder.

**Why bus is capped at 1, although the slots would allow 2.** A bus corridor is limited by its stops, not its lanes. With ordinary stops, one bus lane runs about 60–80 buses an hour, which is about 3,300–4,400 people/h at the model's 55 people per bus. The busiest east–west arm (3*, 38 % of 10,000/h) needs about 1,900 people/h per direction even if everyone took the bus. A second bus lane adds no capacity.

**Bike stays at 1 for the same reason.** A bike lane as wide as a car lane carries about 4,000 bikes/h per direction at a traffic light, which is about twice that arm's full demand. Cars are the only mode where more lanes are genuinely needed, so the car lever keeps its range of 3.

## What changed in the model (done)

Three new nodes:

| Node | Type | Formula |
|---|---|---|
| `sidewalk_extension_spawn_2` | active (0/1, baseline 0) | lever: 1 = sidewalk extension on lane 1/8 |
| `free_lane_slots_spawn_2` | passive | `max(0, 3 - bus_lanes_spawn_2 - tram_line_center - bike_lanes_spawn_2*sidewalk_extension_spawn_2)` |
| `car_lanes_spawn_2_fit` | passive | `max(0, min(car_lanes_spawn_2, free_lane_slots_spawn_2))` |

These nodes now read `car_lanes_spawn_2_fit` instead of `car_lanes_spawn_2`:
- `car_spawn_count_2`, `car_spawn_count_3`
- `mode_util_spawn_2`, `mode_util_spawn_3`
- `displaced_cars`
- `total_car_lanes`

No other node reads the raw car lever any more.

**Other changes:**
- The lever ranges and IDs are unchanged.
- The notes on the four levers explain the slot rule and the caps.
- The file is otherwise identical to the previous `update.json` (kept as `archive/update_before-ew-slot-rules.json`).

**The saved layout gives the same results as before.** It is 3 car lanes with no bike lane, bus lane or tram, so all 3 fit.

## Reference numbers

These are per hour at 2*, with the east–west levers varied and everything else as saved. "Before" is `archive/update_before-ew-slot-rules.json`; "after" is the updated `update.json`.

| E–W layout | Car lanes asked → fit | Cars before → after | Bikes after | Buses after | Trams after | `displaced_cars` after |
|---|---|---|---|---|---|---|
| As saved: car 3 | 3 → 3 | 2,233 → 2,233 | 136 | 15 | 0 | 315 |
| Car 3 + bus lane | 3 → **2** | 1,635 → 1,531 | 113 | 29 | 0 | 286 |
| Car 3 + bike lane on lane 1/8 | 3 → 3 | 1,838 → 1,838 | 675 | 13 | 0 | 0 |
| Car 3 + bike lane on lane 2/7 (sidewalk ext.) | 3 → **2** | — → 1,736 | 730 | 14 | 0 | 707 |
| Car 3 + tram | 3 → **2** | 1,788 → 1,708 | 115 | 13 | 5.99 | 667 |
| Car 3 + bike + bus + tram (your example) | 3 → **1** | 1,156 → 723 | 569 | 26 | 5.17 | 56 |

**Why `displaced_cars` jumps in rows 4 and 5.** Losing one car lane cuts lane capacity by a third, from 2,146 to 1,430 cars/h. But the car share only drops a little, so more cars overflow. That is existing model behaviour, now applied to the lanes that actually fit.

## What the game needs to do

1. **Write the new lever.** CTS sets `sidewalk_extension_spawn_2` = 1 when lane 1/8 holds a sidewalk extension (both directions, mirrored), and 0 otherwise. Add it to the expected inputs in `ValidateExpectedNodes`.
2. **Block the second bus lane.** If lane 2/7 holds a bus lane, lane 3/6 can't hold one too, and the other way round.
3. **Keep writing the levers as built, per direction.** A mirrored pair counts as 1, same as in the spawn-5 handover. The model works out what fits by itself, so the game doesn't need to cut anything.
4. **Nothing else changes in the game.** The two new passive nodes are computed by the solver. The game's outputs are unchanged.

## Open points

- **Sport terrain in the centre** also takes the third car slot, but it has no model input yet. When it gets one, subtract it in `free_lane_slots_spawn_2` like the tram.
- **The sidewalk extension's own effects** (public space, greenery, pedestrians) aren't modelled. Today the new lever only moves the bike lane.
- **Option-to-node links in the spawn data** are not up to date yet, and this handover ignores them.

## How to check it works

**Model side:** run the check script. It runs 10 checks over all 64 east–west lever combinations, then prints the reference table.

```bash
node handover_ew_slots/check_ew_slots.js
```

**In the game:**
- Build a bike lane (lane 1/8), a bus lane and the tram. The game offers exactly one more car lane, and `car_lanes_spawn_2_fit` = 1.
- Build a sidewalk extension and a bike lane on lane 2/7, a bus lane and the tram. No car lane is left.
- A second bus lane can't be placed.

## Template for the other spawn points

Apply the same three steps to every place where players fill a cross-section:

1. **List the slots per direction** from the spawn data, with every option each slot can hold, including options that unlock other options.
2. **Mark the "remainder" mode.** That is the one whose lanes are whatever is left; for now, always cars. Every other lane type is a yes/no lever, capped where the capacity research says more lanes add nothing.
3. **Add a `free_lane_slots_spawn_N` node and a `car_lanes_spawn_N_fit` node**, and switch every reader of the raw car lever to the fit node.

**The north–south street (SP 4: `car_lanes_spawn_4`, `bike_lanes_spawn_4`, `bus_lanes_spawn_4`) is the next candidate.** The spawn data at point "4" shows:

| Slot | Options |
|---|---|
| lane a/f | parking · greenery with pockets |
| lane b/e | car · bike |
| lane c/d | car · bike |

That suggests the rule `car ≤ 2 − bike`, but it raises two questions first:
- **There is no bus slot**, yet `bus_lanes_spawn_4` is 0–1 in the model.
- **Bike could take both b/e and c/d**, but by the research one bike lane (about 4,000/h) is far more than the N–S arms need (about 700 people/h per direction).

## Files

| File | What it is |
|---|---|
| `update.json` | The model file to load |
| `archive/update_before-ew-slot-rules.json` | `update.json` before the slot rules |
| `handover_ew_slots/check_ew_slots.js` | Read-only check of the slot rules, for any later version of the file |
| `.tmp/add_ew_slot_rules.js` | The script that added the rules, rerunnable from `archive/update_before-ew-slot-rules.json` |
