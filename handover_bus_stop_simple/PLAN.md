> **Status 2026-10-29:** applied, with two changes: the switch is stop or no stop at the intersection, and the bonus is +20. See `HANDOVER_bus_stop_simple.md`.

# Plan: one simple bus stop

Replace the three bus-stop designs and the congestion loop (dwell time → stop capacity →
saturation → queue penalty) with one bus stop the player can build. Building it raises bus
attractiveness by a fixed amount. Nothing in the bus model penalises a full stop any more.

Reason: the queue penalty closes a loop (riders → buses → full stop → fewer riders) that no
longer settles in the start state (bus lanes + bus bulb + sidewalk extension oscillates, still
unsettled at 60 passes). It also asks the player to understand three designs and all-door boarding.

## The one stop

- **In-lane stop at the kerb.** The bus stops in its own lane (lane 2/7) and waits there while
  people board; it never pulls into the parking lane and never has to merge back.
- The platform sits at the sidewalk, next to the street. While lane 1/8 is parking, the stop
  takes the 15 m before and after the stop sign that §12 StVO already keeps free of parking,
  so it costs **no parking spaces** (those spaces are already outside the 180).
- One stop element stands for both directions, like the lanes do.

## Model changes

| Node | Now | After |
|---|---|---|
| `new_bus_stop` | — | **NEW** active, 0/1. 1 = the player built the stop. Start 0. |
| `mob_attract_bus` | `bus_stop_access + total_bus_lanes*10 + service − bus_stop_queue_penalty` | `bus_stop_access + total_bus_lanes*10 + service + 10*new_bus_stop` |
| `bus_stops` (3) + `bus_stop_access` (30) | the stops along the rest of the line | **kept unchanged** as background: today's 3 stops elsewhere on the line |
| `parallel_parking` | `… − bus_stop_parking_loss` | term removed (180 unchanged today) |
| `bus_stop_design`, `all_door_boarding` | active | **removed** |
| `boardings_per_bus_stop`, `bus_dwell_s`, `bus_bulb_fit`, `bus_stop_capacity_h`, `bus_stop_saturation`, `bus_stop_queue_penalty`, `bus_stop_parking_loss` | passive | **removed**, with their 17 edges |

Removed nodes go out with their `edge_heuristics` entries and their ids in every
`influences` / `influenced_by` list. Their notes move into this folder's handover note so the
sources (TCQSM, NZTA, TCRP 65, UC all-door study) are not lost if the detail comes back later.

### Size of the bonus: +10 points

One east-west bus lane is worth +20 (`total_bus_lanes*10`, two lanes counted). The stop is
half of that. Tested in the editor's engine on the start state, without the queue penalty:

| Scenario | Bonus 0 | +5 | **+10** | +20 |
|---|---|---|---|---|
| E-W bus lane: bus share | 54.1 % | 56.5 % | **58.6 %** | 62.5 % |
| E-W bus lane: car share | 40.9 % | 38.6 % | **36.8 %** | 33.2 % |
| Both bus lanes: bus share | 68.2 % | 69.6 % | **71.1 %** | 73.1 % |
| Passes to settle (all 4 scenarios) | 9–10 | 9–10 | **9–10** | 9–10 |

+10 is big enough to show in the game (about +4.5 points bus share with a bus lane) and stays
below a bus lane, so the lane remains the bigger move. **[FLAG] game rule:** the 10 is not
measured. Real-world support to look up before it is called backed: time saved by in-lane
stops against stops where the bus must merge back (TCRP Report 65 on bus bulbs), and ridership
gains from better stops.

## Spawn map changes (SP 2)

- **Lane 2/7, under the bus lane option (`id_15` → element `id_387`):** replace its four options
  (`nothing`, `bus_stop_design_0/1/2`) with two:
  - `nothing` → effect `new_bus_stop` = 0 (starting state)
  - `bus_stop` → node `new_bus_stop`, effect `new_bus_stop` = 1
- **Lane 3/6, under its bus lane option (`id_26` → element `id_384`):** remove the stop element.
  Lane 3/6 is not next to the sidewalk, so a stop there would not be "next to the street".
- No option sets `all_door_boarding` today, so nothing else on the map changes.

## Other files

- `handover_source_of_truth/set_start_state.py`: drop `bus_stop_design` and `all_door_boarding`
  from the start table, add `new_bus_stop: 0`.
- `handover_tier2_backing/check_tier2_backing.js`, section 9 (bus stops): replace with checks
  for the new model:
  - today: `new_bus_stop` 0, `mob_attract_bus` 30, parking 180
  - building the stop adds exactly 10 to `mob_attract_bus`, with and without bus lanes
  - the stop never changes `parallel_parking`
  - every bus scenario settles within the game's 16 passes
  - none of the removed nodes is left in the file or in any edge
  Other checks that name the removed nodes get the same treatment.
- `handover_tier2_backing/HANDOVER_tier2_backing.md`: add a dated line that the bus-stop
  section is superseded by this plan.

## Steps

1. Script `handover_bus_stop_simple/apply_bus_stop_simple.py`: backs up `update.json` to
   `archive/update_before-bus-stop-simple.json`, makes the node, edge and map changes above,
   prints every change.
2. Update `set_start_state.py` and the tier 2 check.
3. Run all `handover_*/check_*.js` on the old and new file and compare. Expected: today's
   outputs unchanged (the stop starts at 0, the penalty was 0 today), the oscillation gone.
4. Write `HANDOVER_bus_stop_simple.md` with the before/after and the removed nodes' sources.
5. Commit.

## Open questions

- **Stop only with a bus lane?** This plan keeps the stop under the bus lane option, so the bus
  waits in its own lane and blocks no cars. Allowing it on a car lane would mean cars queue
  behind the waiting bus, which is the congestion this plan leaves out.
- **Should the stop also help walking or public space** (a shelter and bench at the platform)?
  Not in this plan; the stop only changes `mob_attract_bus`.
