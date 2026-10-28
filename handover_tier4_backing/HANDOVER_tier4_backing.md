# Tier 4 backing: lane 1/8 kerb length, spaces and extension area

**Date:** 2026-10-28
**For:** whoever owns the game's environment simulation (CES) and street layout (CTS)
**Files:** `update.json` (built by `build_tier4_backing.py` from `archive/update_before-tier4-backing.json`), checked by `check_tier4_backing.js`

## What changed

| Node | Before | Now |
|---|---|---|
| `extension_segment_length_m` | 65 m, "length of the extension per side" | Same id and value. Now means the kerb length of **one stretch** of lane 1/8, measured from where the road edges meet at the junction to the map edge. Lane 1/8 has 4 stretches: lane 1 and lane 8, each west and east of the intersection. **[FLAG]** until measured in the game level |
| `spaces_1_8` | 22, typed in | `2*(max(0, floor((L-8)/5.8)) + max(0, floor((L-5)/5.8)))` = **38** |
| `sidewalk_extension_area` | `2*ext*L*2.0` = 260 m² | `4*ext*L*2.0` = **520 m²** |
| new edge `extension_segment_length_m→spaces_1_8` | none | empirical, medium confidence |

## Backing

- **FGSV EAR 23 (2023)** replaces EAR 05. A parallel stall is 5.80 m × 2.00 m (EAR 05: 5.70 m).
- **StVO §12(3) Nr. 1** bans parking within 8 m before a junction (5 m with a kerb-separated cycle track) and 5 m after it, measured from where the road edges meet. Each lane leads into the junction on one stretch (8 m) and away from it on the other (5 m).
- **The old 22 counted only 2 of the 4 stretches.** Lane 4/5 already counts both sides (26 east + 26 west).
- The extension runs the full stretch, including the clearance zones. Those zones can't hold parking, and guidelines put sidewalk extensions there.

## Effect (engine run)

| Scenario | Spaces | Car attractiveness | Car trips SP 2 |
|---|---|---|---|
| Today | 180 | 76.0 | 2165 (unchanged) |
| Extension on 1/8 | 158 → 142 | 70.1 → 65.9 | 2112 → 2070 |
| Bike lane on 1/8 | 158 → 142 | 66.0 → 61.7 | 1693 → 1642 |

## Still open

- **Measure L in the game level.** Every 5.8 m changes `spaces_1_8` by 4.
- **Driveways on lane 1/8 are not counted yet.** StVO §12(3) Nr. 3 bans parking in front of them.
- **The `parking_spaces_map` count (180) must include these 38 spaces.**
- **`bus_stop_parking_loss` still cites the EAR 05 stall (5.7 m).** With 5.8 m the result is still 3 spaces per side.

## Older checks updated

These checks expected the old 22 spaces, so their numbers changed:

- `check_kerb_sim.js`: 1/8 scenarios 158 → 142 and 106 → 90, extension area 260 → 520.
- `check_tier2_backing.js`: the extension costs −4.4 % car trips (was −2.5 %), and a two-bay stop with the extension leaves 142 spaces.
- `check_tier2_backing.js` and `check_tier3_backing.js`: the "today unchanged" comparison now skips `spaces_1_8`.

`check_ew_slots.js` already had 2 failures before this change. They are unrelated and were left as they are.
