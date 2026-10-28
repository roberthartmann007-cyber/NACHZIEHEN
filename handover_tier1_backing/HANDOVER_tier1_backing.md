# Handover: Tier 1 backing (sources for the kerb-space game decisions)

**For:** whoever owns the game's environment simulation (CES)
**Model file:** `update.json` (before this change: `archive/update_before-tier1-backing.json`)
**Editor:** no change
**Date:** 2026-10-28
**Builds on:** `handover_kerb_sim/` (chunk 3). Its check script is updated to the new numbers.

## What changed

| # | Item | Change |
|---|---|---|
| 1 | Lane 4/5 gate and carsharing | Gate and network unchanged (3 stations, 6 shared cars, 54 cars replaced). **[FLAG] added:** carsharing actively reduces ownership. `cars_replaced` counts cars sold *and* cars never bought, which is a simplification that fits the game's time span. |
| 1 | `parking_occupancy_ref` | **0.90 → 0.95** (171 parked cars today, was 162). The sim runs at weekday peak hour. The Mitte parking study for Brüsseler Kiez measured 84 % in the evening and at night and over 100 % on weekday daytimes. |
| 2+3 | Ownership term in `car_attractivity_general` | **−20 → −3 × `cars_replaced_share`.** Only the replaced cars' trips change: about 0.5 % of corridor car traffic, cut by about 43 % (Martin & Shaheen), so 0.2–0.5 % fewer car trips. −20 removed 2.6 %; −3 removes 0.37 %. |
| 2+3 | `traffic_demand_input` (note only) | Local vs through split, estimated: about **5–10 % local, 90–95 % through**. Torstraße 26,520 vehicles/day (2019 count); map-parked cars make about 1.5 % of it. **[FLAG]** visitor share and 2.5 trips per car per day are estimates. |
| 4 | `parking_spaces_map` | Stays 180. **[FLAG]** provisional, to be revised with a count of the map area. |
| 5 | Lane slots | No change. |

Notes on every touched node start with `2026-10-28 (Tier 1 backing):`. The edge `cars_replaced_share → car_attractivity_general` has new source and notes, and its confidence goes from low to medium.

## Reference numbers from the model

| Scenario | Spaces | Parked cars | Occupancy | Car attractiveness |
|---|---|---|---|---|
| Today | 180 | 171 | 0.95 | 76.0 |
| Parking on 1/8 removed (extension) | 158 | 171 | 1.08 | 73.8 |
| Parking on 1/8 removed (bike lane) | 158 | 171 | 1.08 | 69.6 |
| Carsharing: 4/5 emptied | 128 | 117 | 0.91 | 75.8 |
| Carsharing + 1/8 removed | 106 | 117 | 1.10 | 72.5 |

With carsharing alone, car attractiveness now drops 0.24 points. Before this change it dropped 5.47.

## Check

```bash
node handover_kerb_sim/check_kerb_sim.js
```

All checks pass. `handover_ew_slots/check_ew_slots.js` and `handover_spawn5/check_spawn5.js` already failed before this change: they test rules that later chunks replaced.

## Still open

- Count the parking spaces on the map (replaces 180).
- Confirm the local/through split from the Senate's traffic model or a Torstraße origin-destination survey.
- Confirm trips per car per day for Berlin (MiD 2023 / SrV 2023 tables).
