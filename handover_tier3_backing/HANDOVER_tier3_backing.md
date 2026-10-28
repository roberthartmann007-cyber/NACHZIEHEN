# Tier 3 backing: seating and dooring

**For:** whoever owns the game's environment simulation (CES) and the spawn data
**Date:** 2026-10-28
**Files:** `update.json` (built by `build_tier3_backing.py` from `archive/update_before-tier3-backing.json`), check: `check_tier3_backing.js`

Today's results do not change. Every node keeps its value in the starting layout.

## 10. Seating, normalized to the furniture ceiling

**The ceiling is now one number.** Change `urban_furniture_max` and every seating effect rescales. Full furniture always gives the full effect and half the ceiling gives the half effect, whatever the ceiling is.

| Node | Value / formula |
|---|---|
| `urban_furniture_max` **NEW** | 6 pieces (the spawn ceiling) |
| `urban_furniture_share` **NEW** | `min(1, urban_furniture/max(1, urban_furniture_max))` |
| `space_activity_index` | `min(1,urban_furniture/6)` → `urban_furniture_share` (twice) |
| `pedestrians_stationary` | seating gate reads `urban_furniture_share` |
| `plaza_check_limits` | `urban_furniture > 6` → `urban_furniture > urban_furniture_max` |

The links `urban_furniture → space_activity_index` and `→ pedestrians_stationary` now start at `urban_furniture_share`, with their sources kept. They had to move: a parent that a formula doesn't name feeds the formula's `base`, so the raw lever would have leaked in.

**The sidewalk extension needs seating.** The activity term is now `0.05 × sidewalk_extension_spawn_2 × urban_furniture_share`.

| Layout | Activity from the extension, before → now |
|---|---|
| Empty extension | +11.3 → **0** |
| 3 pieces | +7.0 → +3.6 |
| 1 café + 3 pieces | +3.7 → +1.9 |
| Full | +1.0 → +1.0 |

Backing: the parklet studies measured extensions that came with seating (San Francisco: people stopping and sitting +30 %). Whyte 1980 and Mehta 2007/2013 found that seating drives lingering. **[FLAG]** the size of 0.05 is still a judgment.

### To change the furniture ceiling later

1. Set `urban_furniture_max`.
2. Set the `urban_furniture` lever's full state (`active_states.b`) and its `max` to the same number. The editor can't link those to a node.
3. **Check the plaza budgets.** Each piece also uses 1 of the 8 plaza modules and 1 of the 12 cells (`plaza_modules_used`, `plaza_cells_used`). Today 7 pieces already go over the module budget. Raising the ceiling needs a design decision on those budgets.

## 11. Dooring on the north-south street

The outer lane a/f was invisible to the model, but a bike lane on b/e runs right next to it.

| Node | Value / formula |
|---|---|
| `ns_outer_parking_spawn_4` **NEW** lever | 1 = a/f parking (starting state), 0 = greenery with pockets |
| `mob_attract_bikes` | adds `- 5.5*ns_outer_parking_spawn_4*min(1, bike_lanes_spawn_4)*(1 - min(1, bike_lane_protection/4))` |

- **Spawn:** a/f "parking" sets the lever to 1, "greenery_with_pockets" sets it to 0.
- **East-west street:** no term. A bike lane there never runs next to parking.
- **Size:** Teschke et al. 2012 found odds ratios of 0.63 for no parked cars and 0.54 for a bike lane. ln 0.63 / ln 0.54 = 0.75, and 0.75 × 7.5 points per protection step ≈ 5.5.
- **Rounding:** bike attractiveness is rounded to whole points in the game, so the term shows as −5 (−3 at half protection).

**[FLAG] open:** turning a/f into greenery doesn't yet take its spaces out of `parallel_parking`. That needs the a/f space count.

## 12. and 13. Kept as game decisions

- **12.** Carsharing stations stay in the pocket modules and take no parking spaces. Recorded on `carsharing_stations`.
- **13.** The sidewalk extension keeps priority over the bike lane. Recorded in `lane_slots` (`ew_street`). The rule is unchanged.

## Checks

```
node handover_tier3_backing/check_tier3_backing.js
```

All checks pass.

- **`check_kerb_sim.js`** was updated. It now tests the extension's activity effect with seating in place.
- **`check_ew_slots.js` and `check_spawn5.js`** fail on the file from before this change too. They test rules that later changes replaced, and are not related to this work.
