# Handover: east–west lane slots at spawn 2

**For:** whoever owns the game's environment simulation (CES) and street layout (CTS)
**Model file:** `update.json` (the version before the slot rules is kept as `archive/update_before-ew-slot-rules.json`)
**Editor:** `BCC_Editor_BCC (1).html`
**Date:** 2026-10-20

> **Updated 2026-10-21:** the sidewalk extension is now a lever (`handover_sidewalk_extension/`), and lane 4/5 needs carsharing (`handover_centre_lane_gate/`). The rules below are as of 2026-10-20. `check_ew_slots.js` checks those rules; run it against `archive/update_before-sidewalk-extension.json`.

## Summary

The east–west street has **4 lane slots per direction**. Both directions are mirrored, so there are 8 in all. Players fill those slots, and every lane type competes for them. If a player builds a bike lane, a bus lane and the tram, only one car lane still fits.

The model's levers didn't know this. They were independent sliders, so the editor allowed layouts the game can't build: for example 3 car lanes plus a bike lane, a bus lane and the tram (`update.json_fail`).

Now:
- **The project file describes the slots** in a new `lane_slots` section.
- **The editor stops every lever where the street is full**, just like the game does. Implausible layouts can't be created.
- **The model keeps one guard node** for files saved before this change.

This is meant as the pattern for the other streets.

## The cross-section, per direction

| Slot | Default | Can hold | Effect in the sim |
|---|---|---|---|
| Lane 1/8 (outer) | parking | parking · sidewalk extension · **bike lane** | only the bike lane |
| Lane 2/7 | **car lane** | **car** · **bus** · **bike lane** (behind a sidewalk extension on 1/8) | car, bus, bike |
| Lane 3/6 | **car lane** | **car** · **bus** | car, bus |
| Lane 4/5 (centre, SP 3) | parking | parking · sport terrain · **car** · **tram** | car, tram |

**Parking, sidewalk extension and sport terrain have no effect in the sim.** For the sim, a slot holding one of them is simply empty. That has one consequence: a bike lane on 2/7 behind a sidewalk extension behaves exactly like a bike lane on 1/8. So in the sim, **a bike lane never costs a car lane**.

## What fits

| Lever | Range per direction | Fits on |
|---|---|---|
| `car_lanes_spawn_2` | 0–3 | 2/7, 3/6, 4/5 |
| `bus_lanes_spawn_2` | 0–1 | 2/7, 3/6 |
| `bike_lanes_spawn_2` | 0–1 | 1/8 (or 2/7) |
| `tram_line_center` | 0–1 | 4/5 |

So the rule is: **car ≤ 3 − bus − tram**. Bike is always free.

Of the 32 lever combinations, 24 are buildable.

| Layout | Fits? |
|---|---|
| Default: car 2 | yes |
| Car 3 + bike | yes |
| Car 2 + bus | yes, but car 3 + bus doesn't |
| Car 2 + tram | yes, but car 3 + tram doesn't |
| Car 1 + bike + bus + tram | yes, but car 2 doesn't |

**Bus and bike are capped at 1** because of the capacity research:
- **Bus:** a bus corridor is limited by its stops, not its lanes. One lane carries about 4,000 people/h at 55 per bus. That is about twice what the busiest east–west arm needs per direction (about 1,900 people/h), even if everyone took the bus.
- **Bike:** a bike lane as wide as a car lane carries about 4,000 bikes/h at a traffic light.

Cars are the only mode that needs more than one lane.

## What changed

### Model (`update.json`)
- **New top-level section `lane_slots`.** It holds the slot table: which lever counts which lane type, the 4 slots, their defaults, and what each slot fits. The editor keeps this section when it saves. Format:
  ```json
  "lane_slots": [{
    "id": "ew_street",
    "levers": {"car": "car_lanes_spawn_2", "bus": "bus_lanes_spawn_2", "bike": "bike_lanes_spawn_2", "tram": "tram_line_center"},
    "slots": [
      {"lane": "1/8", "default": "parking", "fits": ["bike"]},
      {"lane": "2/7", "default": "car",     "fits": ["car", "bus", "bike"]},
      {"lane": "3/6", "default": "car",     "fits": ["car", "bus"]},
      {"lane": "4/5", "default": "parking", "fits": ["car", "tram"]}
    ]
  }]
  ```
- **New guard node `car_lanes_spawn_2_fit`**: `max(0, min(car_lanes_spawn_2, 3 - bus_lanes_spawn_2 - tram_line_center))`.
  - These nodes now read it instead of the raw car lever: `car_spawn_count_2/3`, `mode_util_spawn_2/3`, `displaced_cars` and `total_car_lanes`.
  - For any buildable layout it equals the lever. It only matters for a file saved with a layout that doesn't fit, where car lanes then give way.
- **Lever ranges and IDs are unchanged.** The notes on the four levers explain the slots.
- **No new levers.** An earlier draft added `sidewalk_extension_spawn_2`; it was removed because the sidewalk has no effect in the sim.
- **Your saved layout gives the same results as before.** It is 3 car lanes with nothing else, which fits.

### Editor
- **Every lever change is checked against `lane_slots`:** dragging, arrow keys, toggles, the list view and the value field in the inspector. A layout fits when every lane can be given its own slot that fits it.
- **Raising a lever stops where the street is full**, and a message says which lane type has no free slot. Lowering is always allowed.
- **A slider shows the blocked part of its range hatched** in the warning colour, and its tooltip says "street full above N". A 0/1 toggle that can't be switched on gets a dashed outline.
- **Opening a file whose saved layout doesn't fit** shows a warning in the game section of the validation panel: "the game cannot build this layout".
- **Generic:** any street added to `lane_slots` gets the same behaviour, with no editor change needed.

## Reference numbers

Per hour at 2*, buildable layouts only, everything else as saved:

| E–W layout | Cars | Bikes | Buses | Trams | `displaced_cars` |
|---|---|---|---|---|---|
| As saved: car 3 | 2,233 | 136 | 15 | 0 | 315 |
| Default: car 2 | 2,165 | 146 | 16 | 0 | 1,607 |
| Car 2 + bus | 1,531 | 113 | 29 | 0 | 286 |
| Car 3 + bike | 1,838 | 675 | 13 | 0 | 0 |
| Car 2 + tram | 1,708 | 115 | 13 | 5.99 | 667 |
| Car 1 + bike + bus + tram | 723 | 569 | 26 | 5.17 | 56 |
| Car 0 + bike + bus + tram | 0 | 742 | 34 | 6.74 | 0 |

## What the game needs to do

1. **Nothing new to write.** No new levers. CTS keeps writing `car/bike/bus_lanes_spawn_2` and `tram_line_center` per direction, as built; a mirrored pair counts as 1.
2. **Make sure CTS allows the same layouts as `lane_slots`:**
   - a bike lane on 1/8, or on 2/7 behind a sidewalk extension
   - bus only on 2/7 or 3/6, and **only one bus lane** (block the second)
   - tram only on 4/5
   - car on 2/7, 3/6 or 4/5
3. **Unknown top-level key.** If the game's loader rejects unknown top-level keys, let it ignore `lane_slots`. The game doesn't need it, because CTS already enforces the slots.

## Open points

- **`update.json_fail`** was saved before this change, with car 3, bike 1, bus 1. It has no `lane_slots`, so the editor doesn't warn when it is opened. The guard node still computes it as if only 2 car lanes fit.
- **The sidewalk extension's own effects** (public space, greenery) aren't modelled. When they are, it becomes a lever, and `lane_slots` gets a `sidewalk` entry that fits 1/8.
- **Option-to-node links in the spawn data** are not up to date yet, and this handover ignores them.

## How to check it works

**Model side:** run the check script. It runs 15 checks over all 32 east–west combinations, confirms that the slot table and the guard node agree, then prints the reference table.

```bash
node handover_ew_slots/check_ew_slots.js
```

**In the editor:** open `update.json`.
- Set bike, bus and tram to 1. The car slider stops at 1, its range above 1 is hatched, and pushing further shows "no free slot for another car lane".
- Set car to 3. The bus and tram sliders can't be raised.
- Lower car to 2. Now either bus or tram can be raised, but not both.

## Template for the other streets

1. **List the slots per direction** from the spawn data, with their defaults and every option each slot can hold.
2. **Leave out options with no effect in the sim** (parking, greenery and the like). They are just an empty slot.
3. **Add an entry to `lane_slots`.** The editor enforces it right away.
4. **Add a `car_lanes_spawn_N_fit` guard**, and switch every reader of the raw car lever to it.

## Files

| File | What it is |
|---|---|
| `update.json` | The model file to load |
| `BCC_Editor_BCC (1).html` | The editor, now enforcing `lane_slots` |
| `handover_ew_slots/check_ew_slots.js` | Read-only check of the slot rules |
| `archive/update_before-ew-slot-rules.json` | `update.json` before the slot rules |
| `.tmp/add_ew_slot_rules.js` | The script that adds the slots, rerunnable from the archived file (not in git) |
