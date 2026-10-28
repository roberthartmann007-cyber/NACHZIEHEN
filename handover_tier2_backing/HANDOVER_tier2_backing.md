# Handover: Tier 2 backing (city-scale parking, carsharing, bus stops)

**For:** whoever owns the game's environment simulation (CES)
**Model file:** `update.json`. Before this change: commit `4f8fb53` (local copy `archive/update_before-tier2-backing.json`).
**Editor:** no code change. The new levers show up as sliders.
**Date:** 2026-10-28

## The idea behind it

The intersection stands for the whole city. A driver who loses a kerb space cannot park one street over, because every street changed the same way. So lost parking and replaced cars turn into fewer car trips, not into parking one street over.

That replaces the Tier 1 argument that only local traffic (5–10 %) reacts to parking.

## Reading the notes

Every touched node starts its note with `2026-10-28 (Tier 2 backing):`. The derivations are on the edges (`source` and `notes`). Flags:

| Flag | Meaning |
|---|---|
| `[FLAG] derived:` | Built from sources, but the step from source to number is ours |
| `[FLAG] estimate:` | A plausible figure with no direct source |
| `[FLAG] game rule:` | A design choice made so the game works |

## What changed

| Item | Change | Result in the solver |
|---|---|---|
| **7. Parking → car attractiveness** | Slope 18 → 48; today stays +6. The chain is −12 % kerb × 0.7 kerb share × elasticity 0.3. **[FLAG] derived** | Extension on 1/8: car trips −0.94 % → **−2.51 %** |
| **Ownership term** (Tier 1 value) | −3 → **−60** × `cars_replaced_share`. The chain is 32 % of cars replaced × 27 % less driving (Martin & Shaheen). **[FLAG] derived**, **[FLAG] game scale** | Carsharing alone: **−8.7 %** car trips (was −0.4 %) |
| **8. Cars per carsharing station** | Value stays 2, flag removed. bcs 2024 gives 1.93 per station | — |
| **9. Bus stops** | 10 new nodes; see below | Today unchanged |
| **Lane caps** (1 bike and 1 bus lane per direction) | Notes corrected with sourced capacities. Caps unchanged | — |

### The bus-stop dynamic

**Levers:**
- `bus_stop_design`: 0 kerbside (today), 1 bus bulb (needs the sidewalk extension), 2 two bays.
- `all_door_boarding`: 0 or 1.

**Chain:**
- `bus_dwell_s` = 4 s **[FLAG] estimate** + 10 boardings **[FLAG] estimate** × 3.5 s (TCQSM). All-door boarding cuts the 3.5 s by 16 %.
- `bus_stop_capacity_h` = bays × 3600 / (dwell + 23 s) × 0.7. Fitted to NZTA/TCQSM values: one bay takes 68 buses/h at 30 s dwell, and a signal costs 30 %. Two bays count 1.76. A bulb saves 5 s **[FLAG] estimate**.
- `bus_stop_saturation` = buses/h in the busier direction ÷ capacity.
- `bus_stop_queue_penalty` grows from 0 at 80 % saturation to 20 points at 120 %, taken off `mob_attract_bus`. **[FLAG] game rule**
- `bus_stop_parking_loss`: a two-bay stop takes 6 more spaces while lane 1/8 is parking. **[FLAG] estimate**
- `bus_stop_access` replaces the flat +10 per stop: diminishing access minus a time cost per stop. 3 stops still give 30 points. **[FLAG] derived**

**Effect with bus lanes on both streets:**

| Stop | Capacity (buses/h) | Saturation | Penalty |
|---|---|---|---|
| Kerbside | 41 | 1.03 | −11.7 |
| Bulb + sidewalk extension | 44 | 1.00 | −9.8 |
| All-door boarding | 45 | 0.96 | −8.1 |
| Two bays | 72 | 0.63 | 0 |

**Spawn:** each of the 2 bus-stop elements (unlocked by a bus lane at SP 2) now offers `bus_stop_kerbside`, `bus_stop_bulb` and `bus_stop_two_bays`. Each one sets `bus_stop_design`.

## Check

```bash
node handover_tier2_backing/check_tier2_backing.js
```

All 18 checks pass. Today's values are identical to the file before this change. The chunk 1–3 checks still pass. `check_kerb_sim.js` now expects the Tier 2 numbers: car attractiveness −5.9 for the extension and −17.1 for carsharing. `check_ew_slots.js` and `check_spawn5.js` already failed before; they test rules that later chunks replaced. The editor loads the file with the same 6 warnings as before.

To rebuild, run `.venv/bin/python handover_tier2_backing/build_tier2_backing.py`. It reads the archive copy, so recreate that first if it is missing:

```bash
git show 4f8fb53:update.json > archive/update_before-tier2-backing.json
```

## Still open

- **The game needs a spawn option for `all_door_boarding`.**
- **Passes:** with bus lanes the solver needs 11 passes. The game allows 16, but the old editor schedule stops at 10.
- **Bus lane on 3/6:** a bulb only touches a bus lane on 2/7. The model doesn't check which slot the bus lane is in.
- **Bike lane on 1/8:** a kerbside stop with a bike lane on 1/8 makes the bus cross the bike lane. That conflict is not modelled.
- **Ownership term:** −60 is a large lever. If the design team wants carsharing weaker, the defensible floor is the low end already used. The other choice is to drop "replaced cars are average cars" with a source showing they are driven less.
