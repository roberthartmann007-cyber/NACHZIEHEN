# Handover: sidewalk extension on lane 1/8 (chunk 1 of 2)

**For:** whoever owns the game's environment simulation (CES) and street layout (CTS)
**Model file:** `update.json` (before this chunk: `archive/update_before-sidewalk-extension.json`)
**Editor:** `BCC_Editor_BCC (1).html`
**Date:** 2026-10-21
**Next chunk:** `handover_centre_lane_gate/` (lane 4/5 needs carsharing)

## Behaviour

**Players can swap the outer lane 1/8 between parking and sidewalk extension freely, in both directions, at any time.** Nothing locks it.

- **Extension and a bike lane:** the bike lane moves to 2/7 (option `bike_lane_2_mirrored_7`) and takes that car slot.
- **2/7 is not free** (car or bus on it): the extension is still allowed. It replaces the bike lane on 1/8 instead of being blocked.
- **Back to parking:** always allowed.

## Why the model needed a change

- **The spawn option was linked to the wrong lever.** `sidewalk_extension` (SP 2, lane 1/8) was linked to `car_lanes_spawn_2`, so choosing it would have **added a car lane**.
- **The model didn't know what 1/8 held**, so it couldn't tell a bike lane on 1/8 (costs no car lane) from one on 2/7 (costs one).

## What changed

### Model (`update.json`)
- **New active node `sidewalk_extension_spawn_2`**: 0/1 per direction, mirrored, saved as 0 (parking). Today it only feeds the car-lane guard. It has **no public-space effect yet**, and the check script confirms that.
- **`car_lanes_spawn_2_fit`** now also gives way to a bike lane on 2/7:
  `max(0, min(car_lanes_spawn_2, 3 - bus_lanes_spawn_2 - tram_line_center - min(bike_lanes_spawn_2, sidewalk_extension_spawn_2)))`
  Chunk 2 replaces `3` and `tram_line_center`; see that handover.
- **`lane_slots` → `ew_street`:**
  - new lever `"extension": "sidewalk_extension_spawn_2"`
  - slot 1/8 fits `["bike", "extension"]`
  - new key `"yields": {"extension": ["bike"]}`: the extension is never blocked, and a bike lane that can't move gives up its slot
- **Spawn:**
  - option `sidewalk_extension` → `sidewalk_extension_spawn_2` (was `car_lanes_spawn_2`)
  - option `bike_lane_2_mirrored_7` → `bike_lanes_spawn_2` (was unlinked)

### Editor
- **Generic `yields` rule:** raising a lane type listed in `yields` is never blocked. The listed lanes give way one at a time until it fits, and a toast says which lane was replaced.
- **Everything else is generic slot matching.** The extension fits only on 1/8, so a bike lane goes to 2/7 when there's room.

## Reference numbers

E–W at 2*, per hour, lane 4/5 open (carsharing 1):

| 1/8 · 2/7 | Cars | Bikes | `displaced_cars` |
|---|---|---|---|
| parking · car (car 3) | 2,180 | 144 | 190 |
| extension · car (car 3) | 2,180 | 144 | 190 |
| bike · car (car 3 + bike) | 1,786 | 703 | 0 |
| extension · bike (car 2 + bike) | 1,692 | 754 | 617 |

The first two rows are identical because the extension has no public-space effect yet.

## What the game needs to do

1. **CTS writes `sidewalk_extension_spawn_2`**: 1 when lane 1/8 holds a `FootwayExtension`; a mirrored pair counts as 1. The lever is new, so it also needs an entry in the game's input list.
2. **Same slot rules as `lane_slots`:** a bike lane goes on 1/8, or on 2/7 only behind an extension.
3. **Choosing the extension is never blocked.** If the bike lane can't move to 2/7, replace it.
4. **Open question:** when the extension is removed while the bike lane is on 2/7, the editor puts the bike lane back on 1/8. In the game, the sub-element `bike_lane_2_mirrored_7` disappears with its parent option. Decide whether the bike lane moves back to 1/8 or is removed.

## Open points

- **Public-space effects aren't modelled yet** (room to stay, buffer from traffic, parking supply). That needs the formulas and the four open design decisions from the public-space discussion: segment length, cafés on the extension, the 4,235 m² lingering area, and whether the default index may move.
- **The old east–west check now fails two items on purpose.** `handover_ew_slots/check_ew_slots.js` checks the rules as of 2026-10-20. Run it against `archive/update_before-sidewalk-extension.json`.

## How to check it works

```bash
node handover_sidewalk_extension/check_sidewalk_extension.js
```

16 checks: structure, spawn links, all 64 east–west combinations against the guard, free swapping from every buildable layout, and "the extension changes no lane count without a bike lane" (its parking and public-space effects are checked in `handover_kerb_sim/`).

**In the editor:** open `update.json` and set carsharing to 1 and car lanes to 3.
- Turn the bike lane on: it sits on 1/8.
- Turn the extension on: the bike lane is replaced, and a toast says so.
- Lower car lanes to 2, turn the bike lane on, then the extension: both stay, and the bike lane is on 2/7.

## Files

| File | What it is |
|---|---|
| `handover_sidewalk_extension/check_sidewalk_extension.js` | Read-only check of this chunk |
| `archive/update_before-sidewalk-extension.json` | `update.json` before this chunk |
| `.tmp/add_sidewalk_extension.js` | The script that applies this chunk, rerunnable from the archived file (not in git) |
