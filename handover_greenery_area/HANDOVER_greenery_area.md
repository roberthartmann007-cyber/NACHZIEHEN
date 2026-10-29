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

- **Green facades are independent of the plaza.** They sit on the buildings (spawn 5, element "facade"), not on the plaza. Three terms are removed:
  - `1*green_facades` from `plaza_modules_used`
  - `2*green_facades` from `plaza_upkeep_used`
  - `(green_facades > 2)` from `plaza_check_limits`
  - Their three links are removed too. Facades now feed only `temperature` and `visual_greenery_index`.
- **`green_facades → temperature`**: slope −2 → **−0.15 °C per building**. Status is now "empirical", confidence medium, with sources in the link.
- **One green facade:** `green_facades` is now 0/1 (was 0–2). The game has one facade element (spawn 5, chosen at most once), so 2 was never reachable.
  - Cooling: −0.15 °C.
  - The visual greenery index reads `min(1, green_facades)` (was `/2`), so the one facade fills its 15 % share.
- **`green_facades → visual_greenery_index`**: the weight stays as it is. Two facade-specific wellbeing studies are added as sources.

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

## Facade cooling: sources

The old −2 °C per building (−4 °C for both) had no source.

| Finding | Value | Source |
|---|---|---|
| Street-canyon simulation (CFD), greened facades | air −0.1 K on average, −0.3 K at most, under 0.05 K mid-street | [engrXiv 2599](https://engrxiv.org/preprint/view/2599) |
| São Paulo simulation (ENVI-met) | clear difference only 15 cm from the wall, insignificant from 60 cm | [Pós FAUUSP](https://journals.usp.br/posfau/article/view/195441) |
| Field measurements | 0.6–1.0 °C, only close to the wall | [IAU](https://sanad.iau.ir/en/Article/839993) |
| Felt comfort near the wall, Hong Kong | PET −0.17 to −1.4 °C, mainly from greening low on the facade | Cui et al. 2022, [PolyU](https://ira.lib.polyu.edu.hk/handle/10397/99532) |
| Whole canyons with green walls and roofs, 2D model, mostly hot climates | up to 8–13 °C | Alexandri & Jones 2008, *Building and Environment* 43(4), [Cardiff](https://orca.cardiff.ac.uk/id/eprint/29416/) |

- **Why −0.15 °C per building:** this is half the street-canyon maximum of −0.3 K, which was measured with greened facades along the canyon. One building at the junction stays below that.
- **Alexandri & Jones:** their scenario (every canyon greened, roofs included) doesn't fit this map.
- **Comfort next to the wall:** this is local, felt comfort, like `plaza_trees`. It is not modelled as junction-wide cooling.
- **Visual and wellbeing effects** are supported for facades specifically:
  - [NTU Singapore VR study, 2021](https://ntu.edu.sg/news/detail/vr-study-finds-vertical-greenery-useful-as-a-stress-buffer): stress rose with green-painted walls, not with planted facades.
  - [Sheffield image trial, 2024](https://eprints.whiterose.ac.uk/id/eprint/233462), n = 401: facade greenery raised perceived happiness more than ground-level greenery.

## Temperature (editor solver)

| Case | 19 °C day | 45 °C day |
|---|---|---|
| Green boulevard only | 17.09 | 40.37 |
| Sidewalk extension only | 16.49 | 38.91 |
| All trees | 15.74 (was 2.2) | 37.10 (was 24.4) |
| Both water features only | — | 44.80 |
| The green facade only | — | 44.85 |
| All trees + both water features + the facade | — | 36.75 |

The old design target, "45 → 28 °C when trees, water and facades are maxed", depended on the unsourced −6 °C for water. It also depended on the unsourced −4 °C for facades. With sourced values, the best heat-day result is about 36.75 °C. Nearly all junction-scale cooling comes from canopy; water and the facade add −0.35 °C together.

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
- `apply_facades_off_plaza.py`: step 3, which takes green facades off the plaza budget. It runs once, after step 2, and has been applied.
- `apply_facade_cooling.py`: step 4, which sets facade cooling to −0.15 °C per building and adds the sources. It runs once, after step 3, and has been applied.
- `apply_one_facade.py`: step 5, which sets one green facade (0/1) and has it fill the facade term of the visual greenery index. It runs once, after step 4, and has been applied.
- Run in order on `.tmp/update.before_greenery_2026-10-29.json`, steps 1–5 reproduce `update.json` exactly.
- `check_greenery_area.js`: `node handover_greenery_area/check_greenery_area.js`
