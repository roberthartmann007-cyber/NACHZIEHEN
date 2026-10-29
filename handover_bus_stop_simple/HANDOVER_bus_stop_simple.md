# Handover: one simple bus stop (2026-10-29)

Applied with `apply_bus_stop_simple.py`; backup in `archive/update_before-bus-stop-simple.json`.
Supersedes `PLAN.md` where they differ: the switch is **stop or no stop** at the intersection,
and the bonus is **+20**, not +10.

## What changed

**Simulation**
- **NEW `new_bus_stop`** (active, 0/1, start 0): the bus stop at the intersection. The bus stops
  in its own lane (2/7) and waits there; the platform is at the sidewalk. No parking spaces lost.
- `mob_attract_bus` = `bus_stop_access + total_bus_lanes*10 + service + 20*new_bus_stop*bus_lanes_spawn_2`.
  The stop counts only while the east-west bus lane is there, because it sits in that lane.
- `bus_stops` (3) and `bus_stop_access` (30) stay, now standing for the stops nearby on the line,
  so today's start is unchanged.
- `parallel_parking`: the bus-stop term is gone.
- **Removed:** `bus_stop_design`, `all_door_boarding`, `boardings_per_bus_stop`, `bus_dwell_s`,
  `bus_bulb_fit`, `bus_stop_capacity_h`, `bus_stop_saturation`, `bus_stop_queue_penalty`,
  `bus_stop_parking_loss`, and their 17 edges. Their notes and sources are in the backup file and
  in `handover_tier2_backing`.
- **New edges:** `new_bus_stop->mob_attract_bus` (holds the sources) and
  `bus_lanes_spawn_2->mob_attract_bus` (the gate).

**Spawn map (SP 2)**
- Stop element `id_387` (under the 2/7 bus lane, renamed "bus stop"): two options, `nothing`
  (`new_bus_stop` = 0, start) and `bus_stop` (`id_458`, `new_bus_stop` = 1).
- Stop element `id_384` (under the 3/6 bus lane) removed: lane 3/6 is not next to the sidewalk.

## Why +20 (also in the notes on `new_bus_stop`)

Without a stop here, people walk to the next one, 300-500 m away. That is about 3-4 minutes
more walking, and passengers count walking time about double a minute on the bus, so 6-8
minutes of riding. A shelter alone is worth about 2 minutes and matched +5 points against the
measured ridership gain (Salt Lake City, +4 % net), so a stop is about four times that: +15 to
+20. The model's own access curve gives the first stop 19.9. **[FLAG] derived:** the model has
no minutes-to-points rule.

Sources: walking distance and decay (McGill review; Kimpel et al.; Daniels & Mulley 2013;
Bree, Fuller & Diab 2020), walk time weight (TØI, five Norwegian cities), stop facility values
(Douglas, ATRF 2018 and NZAE 2017), ridership after stop upgrades (NITC, Salt Lake City).
Full links are in the node and edge notes.

## Checks

- Today's start: no value changed (all nodes compared).
- `check_tier2_backing.js`: section 9 rewritten. The stop adds exactly 20 with the bus lane and
  nothing without it, takes no spaces, and every bus scenario settles in 9-10 passes (the
  oscillation is gone). Remaining failure: "every node unchanged against the file before tier 2",
  which has failed since the start-state reset.
- Other checks: same PASS/FAIL as before. `check_ew_slots` bus-lane rows show more bus riders,
  because the queue penalty no longer pulls them back (for example car 2 + bus: 1,301 → 1,238
  cars/h).
- `set_start_state.py` now sets `new_bus_stop` 0 and the stop element's starting state `nothing`.
