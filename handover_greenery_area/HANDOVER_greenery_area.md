# Greenery on the 11,500 m² map (2026-10-29)

Greenery is now the share of the map covered by tree canopy, based on the planted areas in the new game set-up. Greenery also no longer cools the junction twice.

Every change below also has a dated note in `update.json` on its node or link, so the editor shows the reasoning. The notes are tagged `2026-10-29 (greenery on the 11,500 m² map)` or `2026-10-29 (canopy merged into the sidewalk extension)`.

## Areas

Two levers set greenery:

| Lever | Area when on | Share of 11,500 m² | Before |
|---|---|---|---|
| Green boulevard, middle lane (`middle_part_covered_trees`, 0/1) | 1,790 m² | 15.57 % | 13 % |
| **Sidewalk extension at spawn 2** (`sidewalk_extension_spawn_2`, 0/1) | 2,700 m² | 23.48 % | 36 % from a separate alley slider |
| Greenery maximum | 4,490 m² | 39.04 % | 49 % |

**Turning on the sidewalk extension at spawn 2 covers its 2,700 m² with canopy directly.** The same switch also adds the 2,700 m² of sidewalk (`sidewalk_extension_area`). No second choice is needed.

## Changes

- **`greenery`**: node formula `100*(1790*middle_part_covered_trees + 2700*sidewalk_extension_spawn_2)/11500`.
  - Unit is now "% canopy cover", max 40.
  - Links, for reference only (the formula computes the value):
    - `middle_part_covered_trees → greenery`, slope 13 → 15.57
    - `sidewalk_extension_spawn_2 → greenery`, slope 23.48 (new)
- **Deleted, canopy alley slider:**
  - **`spawn_2_canopy_streets`** (0–2 sides × 1,350 m²) and its link to `greenery`. With trees always on the extension, the slider only repeated the extension choice.
  - **Spawn option `id_338`** (`tree_lined_avenue_with_pockets`), which set that slider. It sat in sub-element `id_336` under the sidewalk extension. `id_336` now holds only `bike_lane_2_mirrored_7` (`id_339`).
  - `handover_source_of_truth/align_spawn_names.py` still has a mapping for `tree_lined_avenue_with_pockets`. With the option gone it matches nothing, so it was left as it is.
  - No other node depended on the slider, so nothing else became obsolete. `extension_segment_length_m` stays because it still sets `spaces_1_8`.
- **`greenery → temperature`**: slope −0.29 → 0.
  - The temperature formula already applies the greenery cooling, so the link counted it twice.
  - The link is kept at slope 0, not deleted: greenery stays a parent the formula can read. A link without a formula would add a signal term to `base`.
- **`sidewalk_extension_area`**: now `2700*sidewalk_extension_spawn_2`, max 2,000 → 3,000.
  - The link from `extension_segment_length_m` is removed. 2,700 m² cannot come from a 2 m strip: over 4 × 65 m it would need 10.4 m width.
- **`visual_greenery_index`**: `greenery/49` → `greenery/39.04`, so full planting still fills the canopy term.
- **`blue_infrastructure → temperature`**: slope −0.3 → **−0.1 °C per water feature**, so both features give −0.2 °C. Status is now "empirical", confidence medium, with sources in the link.

## Water cooling: sources

`blue_infrastructure` is a plaza module with 0–2 units. The old note assumed 20 units with a −6 °C maximum, but it had no source. That value was a balance choice, set so a 45 °C day could reach 28 °C.

| Type of water | Measured cooling | Source |
|---|---|---|
| Small still water features | about 0.2 °C on average, 0.6 °C at most, in the afternoon; "negligible in design practice" | Jacobs et al. 2020, *Urban Climate* 32:100607, [doi:10.1016/j.uclim.2020.100607](https://doi.org/10.1016/j.uclim.2020.100607) |
| Large lakes and rivers | 2.5 K (95 % CI 1.9–3.2) on summer days | Völker et al. 2013, *Erdkunde* 67(4):355–371, [link](https://www.erdkunde.uni-bonn.de/article/view/2737) |
| Misting or spray systems | 2–10 °C (8.2 °C in a field test), but only downwind and while running; less in wind or high humidity | Ulpiani et al. 2019, [link](https://iris.univpm.it/handle/11566/265086) |

- **Why −0.1 °C per feature:** it is the typical value for small still water. Adding the effects of two features is already generous.
- **Misting:** the larger misting effect is felt locally and does not cool the air across the junction. If the game's feature becomes a mist system, model it as a local effect, the way `plaza_trees` is.
- **Night-time:** water can raise humidity and slightly warm the junction at night. This is not modelled.

## Temperature (editor solver)

| Case | 19 °C day | 45 °C day |
|---|---|---|
| Green boulevard only | 17.09 | 40.37 |
| Sidewalk extension only | 16.49 | 38.91 |
| All trees | 15.74 (was 2.2) | 37.10 (was 24.4) |
| Both water features only | — | 44.80 |
| All trees + both water features + both facades | — | 32.90 |

The old design target, "45 → 28 °C when trees, water and facades are maxed", depended on the unsourced −6 °C for water. With sourced values, the best heat-day result is about 33 °C.

## Side effects

- **Today's settings** (water = 2, no trees): temperature 18.40 → 18.80 °C, public space quality 7.69 → 7.75, health unchanged.
- **People lingering:** the cap in `pedestrians_stationary` rises from about 808 to 966.
- **Older checks, area:** `check_kerb_sim.js` and `check_tier4_backing.js` now expect 2,700 m² instead of 520 m².
- **Older checks, water:** the "today: every node unchanged" checks in tier 2, tier 3 and tier 4 now flag `temperature` and `public_space_quality`, because today's water = 2 cools 0.4 °C less. This is intended: with the water slope at −0.3, all three pass again. They were left as they are. The tier 3 seating check fails for the same reason.

## Open [FLAG]s

- **Canopy vs planted area:** canopy area is assumed equal to the planted area at maturity. Crowns overhanging the road would raise it.
- **Water type:** if the game's water feature is a mist or spray system, the junction-wide −0.1 °C stays, but a separate local "felt" effect would be justified.

## Files

- `apply_greenery_area.py`: step 1, the rescale, the double count and the water slope. It runs once and has been applied.
- `apply_merge_canopy.py`: step 2, which merges the canopy into the sidewalk extension and deletes the alley slider. It runs once, after step 1, and has been applied.
- Run in order on `.tmp/update.before_greenery_2026-10-29.json`, steps 1 and 2 reproduce `update.json` exactly.
- `check_greenery_area.js`: `node handover_greenery_area/check_greenery_area.js`
