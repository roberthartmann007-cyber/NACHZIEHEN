# EV switch (2026-10-29)

The EV charger is now a 0/1 module. Placing it (spawn option `id_333`, pocket modules at spawn 1) makes every car on the map electric. The number of cars stays the same; only what they emit changes.

## What it changes

| Link | Formula | Effect with the switch on |
|---|---|---|
| `ev_charger → no2` | `y = baseline − x · max(0, 0.00814 · amount_of_cars − 4 · speed_limit)` | NO₂ falls to its 6 µg/m³ background |
| `ev_charger → pm25` | `y = baseline − x · 0.4 · 0.00235 · amount_of_cars` | PM2.5 loses the exhaust share (40%) of the traffic part; tyre and brake dust stay |
| `ev_charger → ev_noise_reduction` | node formula `ev_charger · min(4, max(0, 0.1 · (60 − avg_speed)))` | 0–4 dB saving |
| `avg_speed → ev_noise_reduction` | (same formula) | saving shrinks as cars get faster |
| `ev_noise_reduction → noise_level` | linear, slope −1 | noise drops by the saving |

Noise saving by average speed: 10 km/h → 4 dB (capped: EV warning sound below 20 km/h), 30 → 3 dB, 45 → 1.5 dB, 50 → 1 dB, 60+ → 0. `avg_speed` is the telemetry node; until live telemetry is wired it comes from the speed limit (30-zone ≈ 30, 50-zone ≈ 45 km/h).

## Results (start state)

| | 50-zone off → on | 30-zone off → on |
|---|---|---|
| NO₂ µg/m³ | 48.21 → 6.00 | 40.28 → 6.00 |
| PM2.5 µg/m³ | 22.58 → 17.71 | 21.45 → 17.03 |
| Noise dB | 78.65 → 77.15 | 74.22 → 71.22 |
| Health index | 27.17 → 49.11 | 40.46 → 60.05 |

## Flagged estimates
- Noise curve shape and the 4 dB cap (reading of UBA / CNOSSOS-EU, not a fitted curve).
- PM2.5 exhaust share 40% (EEA 2023 EU average); EV weight and extra tyre dust not modelled.
- Buses, trams and background pollution are not affected.
- The node id stays `ev_charger` so the spawn map and `set_start_state.py` keep working.

## Files
- `build_ev_switch.py`: rebuilds `update.json` from `archive/update_before-ev-switch.json`. Re-runnable.
- `check_ev_switch.js`: runs the editor's engine; `node handover_ev_switch/check_ev_switch.js`.
