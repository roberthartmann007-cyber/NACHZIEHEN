# Handover: north–south lane slots at SP 4

**For:** whoever owns the game's environment simulation (CES) and street layout (CTS)
**Model file:** `update.json` (the version before these rules is kept as `archive/update_before-ns-slot-rules.json`)
**Editor:** `BCC_Editor_BCC (1).html`
**Companion:** `handover_ew_slots/HANDOVER_ew_slot_rules.md` (the same pattern for the east–west street)
**Date:** 2026-10-20

## Summary

The north–south street, set at SP 4, has **3 lane slots per direction**. Both directions are mirrored, so there are 6 in all. Only two of the slots carry traffic, and **both always hold a lane**: a car, bike or bus lane. So swapping one lane type in always swaps another out.

This is the same rule logic as the east–west street, with one addition: the street is **filled**. On the east–west street a slot can stay empty (parking). Here it can't.

## The cross-section, per direction

| Slot | Default | Can hold | Effect in the sim |
|---|---|---|---|
| a/f (outer) | parking | parking · greenery with pockets | none |
| b/e | **car lane** | **car** · **bike** · **bus** | car, bike, bus |
| c/d | **car lane** | **car** · **bike** · **bus** | car, bike, bus |

**a/f has no effect in the sim**, so it isn't part of the slot table. There is no tram on this street.

## What fits

| Lever | Range per direction | Fits on |
|---|---|---|
| `car_lanes_spawn_4` | 0–2 | b/e, c/d |
| `bike_lanes_spawn_4` | 0–1 | b/e, c/d |
| `bus_lanes_spawn_4` | 0–1 | b/e, c/d |

So the rule is: **car + bike + bus = 2**.

Of the 12 lever combinations, 4 are buildable:

| Layout | Fits? |
|---|---|
| Default: car 2 | yes |
| Car 1 + bike | yes |
| Car 1 + bus | yes |
| Bike + bus (car 0) | yes |
| Car 1 alone | no, a slot is empty |
| Car 2 + bike | no, 3 lanes in 2 slots |

**Bike and bus are capped at 1**, for the same capacity reasons as on the east–west street. One bike lane carries about 4,000 bikes/h, and one bus lane carries about 4,000 people/h. So the game should block a second bike lane, even though both slots offer one.

## Decisions behind this (confirmed 2026-10-20)

1. **Bus lanes are allowed on b/e and c/d.** The spawn data has no bus option at SP 4 yet. It needs one (see below).
2. **b/e and c/d are always filled** with car, bike or bus.
3. **Bike is capped at 1** per direction.
4. **The street starts with car lanes on b/e and c/d.**
5. **The saved layout is now car 2.** It was saved at car 1 with no bike or bus lane, which leaves a slot empty.

## What changed

### Model (`update.json`)
- **New `ns_street` entry in `lane_slots`**, next to `ew_street`:
  ```json
  {
    "id": "ns_street",
    "levers": {"car": "car_lanes_spawn_4", "bus": "bus_lanes_spawn_4", "bike": "bike_lanes_spawn_4"},
    "slots": [
      {"lane": "b/e", "default": "car", "fits": ["car", "bike", "bus"]},
      {"lane": "c/d", "default": "car", "fits": ["car", "bike", "bus"]}
    ],
    "filled": true,
    "fill_with": "car"
  }
  ```
  - `filled`: every slot always holds a lane.
  - `fill_with`: a bike or bus lane takes its slot from a car lane, and gives it back to a car lane when removed.
- **New guard node `car_lanes_spawn_4_fit`**: `max(0, min(car_lanes_spawn_4, 2 - bike_lanes_spawn_4 - bus_lanes_spawn_4))`.
  - These nodes now read it instead of the raw car lever: `car_spawn_count_4/5`, `mode_util_spawn_4`, `displaced_cars` and `total_car_lanes`.
  - For any buildable layout it equals the lever. It only matters for a file saved with too many lanes.
- **`car_lanes_spawn_4` saved value: 1 → 2.** This changes results at the saved state (see the reference numbers).
- **Lever ranges and IDs are unchanged.** The notes on the three levers explain the slots.

### Editor
- **Filled streets swap lanes the way the game does.** Every lever change is checked: dragging, arrow keys, toggles, the list view and the inspector's value field.
  - Switching on a bike or bus lane turns a car lane into it. A message says "car lanes 2 → 1".
  - Switching it off turns the slot back into a car lane.
  - Car can't be lowered on its own, because that would leave a slot empty. The message says to switch the car lane to another lane type instead.
  - Car can't be raised while a bike or bus lane holds the other slot. The slider is hatched above that point.
- **The validation panel names the problem** when a saved layout doesn't fit: "every slot needs a lane, raise car" when a slot is empty, and "lower a lever" when there are too many lanes.
- **List view fix:** lever fields now refresh when another lever changes them. Before, a swapped or capped value only showed after the list was redrawn. This also affected east–west capping.
- **Generic:** any street in `lane_slots` can set `filled` and `fill_with`. Streets without them (like `ew_street`) behave as before.

## Reference numbers

Per hour, buildable layouts only, everything else as saved. 5* is always 4* ÷ 7.

| N-S layout | Cars 4* | Bikes 4* | Buses 4* | Cars 5* | `displaced_cars` |
|---|---|---|---|---|---|
| As saved = default: car 2 | 842 | 57 | 6 | 120 | 298 |
| Car 1 + bike | 562 | 344 | 7 | 80 | 0 |
| Car 1 + bus | 484 | 52 | 13 | 69 | 0 |
| Bike + bus (car 0) | 0 | 378 | 17 | 0 | 0 |

`displaced_cars` covers the whole intersection, so it includes the east–west cars.

**Effect on the east–west reference numbers:** with the north–south street at car 2 instead of car 1, the east–west numbers move slightly. That's because the car share of all lanes is now higher. The saved east–west layout is unchanged (2,233 cars at 2*), but `displaced_cars` goes from 315 to 298. `node handover_ew_slots/check_ew_slots.js` prints the current table.

## What the game needs to do

1. **Add a bus-lane option at SP 4** on lanes b/e and c/d. The spawn data only has car and bike today. Link it to `bus_lanes_spawn_4`.
2. **Link the SP 4 options to the levers.** None of the SP 4 options point to a model node yet:
   - car lane on b/e or c/d → `car_lanes_spawn_4`
   - bike lane on b/e or c/d → `bike_lanes_spawn_4`
   - bus lane (new) → `bus_lanes_spawn_4`
3. **Make sure CTS allows the same layouts as `lane_slots`:**
   - b/e and c/d always hold a car, bike or bus lane
   - **only one bike lane** and **only one bus lane** per direction (block the second)
   - start with car lanes on b/e and c/d
4. **Count per direction.** A mirrored pair counts as 1, as on the east–west street.
5. **Nothing new to read.** No new levers or outputs.

## Open points

- **SP numbering in labels.** The north–south lever labels still say "set at SP 3". The spawn data has the north–south street at SP 4. This is cosmetic only.
- **a/f and the pocket modules** (greenery, parcel station, carsharing, EV charger, speed limit 30) have no model links yet. The `speed_limit_30` pocket module may want to drive the existing `speed_limit` lever.
- **4* bus count is rounded to whole buses** (`bus_spawn_count_4`, while 5* isn't). People served at 4* can differ from demand by up to half a bus. This was already the case before this change.

## How to check it works

**Model side:** run the check script. It runs 17 checks over all 12 north–south combinations, confirms that the slot table and the guard node agree, then prints the reference table.

```bash
node handover_ns_slots/check_ns_slots.js
```

**In the editor:** open `update.json`.
- Switch on the north–south bike lane. Car drops from 2 to 1, and the car slider is hatched above 1.
- Switch on the bus lane too. Car drops to 0.
- Try to lower car from 2 with nothing else on. It stays at 2, and a message explains why.
- Switch bike and bus off again. Car goes back to 2.

## Files

| File | What it is |
|---|---|
| `update.json` | The model file to load |
| `BCC_Editor_BCC (1).html` | The editor, now enforcing filled streets |
| `handover_ns_slots/check_ns_slots.js` | Read-only check of the north–south slot rules |
| `archive/update_before-ns-slot-rules.json` | `update.json` before these rules (not in git) |
| `.tmp/add_ns_slot_rules.js` | The script that adds the rules, rerunnable from the archived file (not in git) |
