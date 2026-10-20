# Handover: vehicle spawn counts at 5*

**For:** whoever owns the game's environment simulation (CES) and street layout (CTS)
**Model file:** `bcc_project_2026-10-20_no-personas_ns-both-directions_2026-10-20_09-55.json`
**Date:** 2026-10-20
**Source of truth:** the annotated aerial plan of the intersection with demand points 2* to 6* (send it with this brief)

## Summary

In the new game layout, players set the whole north–south street at spawn point 4. Those lanes now serve both ends of the street: 4* (north) and 5* (south). Before, 5* had no lanes and no vehicles. The model now computes how many cars, bikes, buses and trams per hour arrive at 5*. The game still has to read those counts and spawn the vehicles.

## Demand points

The starred points on the plan are where each share of the trip demand enters or leaves the scene.

| Point | Where | Share of trip demand | Set at | Lane levers | Spawn counts |
|---|---|---|---|---|---|
| 2* | east–west street, east end | 36 % | SP 2 + SP 3 | `*_lanes_spawn_2` | `*_spawn_count_2` |
| 3* | east–west street, west end | 38 % | SP 2 + SP 3 | `*_lanes_spawn_2` | `*_spawn_count_3` |
| 4* | north–south street, north end | 14 % | SP 4 | `*_lanes_spawn_4` | `*_spawn_count_4` |
| **5*** | **north–south street, south end** | **2 %** | **SP 4** | **`*_lanes_spawn_4`** | **`*_spawn_count_5` (new)** |
| 6* | diagonal street, south-southeast | 9 % | none | none | none (not part of this handover) |

## What the model does now (done)

Four new nodes, all in vehicles per hour:

| Node | What it is | Rounded |
|---|---|---|
| `car_spawn_count_5` | 5* demand × car share ÷ car occupancy (1.1 people) | no |
| `bike_spawn_count_5` | 5* demand × bike share | no |
| `bus_spawn_count_5` | 5* demand × bus share ÷ bus occupancy (55 people) | no, on purpose (see below) |
| `tram_spawn_count_5` | 5* demand × tram share ÷ tram occupancy (120 people); 0 while the tram line is off | no |

**How it works:**
- Each node is the spawn 4 formula with the 5* demand (`trip_demand_spawn_5_h`) put in.
- It reads the same levers: `car_lanes_spawn_4`, `bike_lanes_spawn_4`, `bus_lanes_spawn_4` and `tram_line_center`.
- It uses the same mode split (`mode_util_spawn_4`).
- So 4* and 5* always have the same mix of cars, bikes, buses and trams. Only the volume differs: 5* is always 4* ÷ 7, because its demand share is 2 % against 14 %.

**Where the counts feed in:**
- They add into `served_car`, `served_bike`, `served_bus` and `served_tram`.
- Through those, they reach `amount_of_cars`, `flow_people_transit`, noise, NO₂, PM2.5 and the health index.
- `amount_of_cars` is the sum of `car_spawn_count_2` to `_5`, so it already includes 5*.
- Cars at 5* also count toward `displaced_cars`, against the capacity of the north–south car lanes (800 per lane).

The three street-wide lane totals (`total_car_lanes`, `total_bike_lanes`, `total_bus_lanes`) count each north–south lever twice: one lane per direction, at both ends. The east–west levers are counted the same way.

## Reference numbers

Vehicles per hour at 5*, from the model file as saved. Only the north–south settings are varied; everything else stays as saved (east–west: car 3, bike 0, bus 0).

| Setting | Cars | Bikes | Buses | Trams | People served | Demand at 5* |
|---|---|---|---|---|---|---|
| As saved (N-S car lanes 1, no bike or bus lane, tram off) | 104.6 | 10.6 | 1.16 | 0 | 189 | 189 |
| N-S car lanes 2 | 120.3 | 8.1 | 0.89 | 0 | 189 | 189 |
| N-S car lanes 0 | 0 | 27.0 | 2.95 | 0 | 189 | 189 |
| + N-S bike lane | 80.3 | 49.2 | 0.94 | 0 | 189 | 189 |
| + N-S bus lane | 69.1 | 7.4 | 1.92 | 0 | 189 | 189 |
| Tram line on | 77.5 | 7.9 | 0.86 | 0.41 | 189 | 189 |

The numbers depend on where the levers sit. The behaviour does not: the ÷ 7 relationship, the lane gates and the people-served total hold at every setting.

## What the game needs to do

1. **Read the new counts.** Add `bike_spawn_count_5` and `bus_spawn_count_5` to the game's list of outputs, next to the bike and bus counts for 2*–4*.
   - According to the editor's comments, that list lives in `CityEnvNodeIds.cpp`, `CityEnvironmentSimulationSubsystem::ValidateExpectedNodes` and `GetOutputs()` / `PopulateOutputs`.
   - Confirm the location in the Unreal project.
2. **Spawn vehicles at 5*.** Add a spawner at the south end of the north–south street that works the same way as the ones at 2*–4*.
3. **Cars: a decision is needed.** Today the game reads no car count per spawn point, only the total `amount_of_cars`. How the game currently splits that total across spawn points can't be seen from the model side. There are two ways forward:
   - **Read `car_spawn_count_2` to `_5` per spawn point (recommended).** The counts already exist and react to each street's lane choices.
   - **Keep splitting the total by fixed shares and add a share for 5*.** This is simpler, but the split then ignores what players build.
4. **Trams.** `tram_spawn_count_5` exists so the model is complete. The game reads no tram count per spawn point today. If trams stay timetable-driven, ignore it.
5. **Rates are not whole numbers.** Counts are vehicles per hour with decimals.
   - Buses at 5* come to about one per hour. That count is left unrounded on purpose: rounded, it would only ever be 0 or 1, and passengers would jump in steps of 55.
   - The spawner should carry the leftover fraction forward, or spawn one vehicle every 3600 ÷ rate seconds.
6. **Street layout at 5*.** The south arm should show the cross-section the player sets at SP 4.
   - The street layout tool should write `car_lanes_spawn_4`, `bike_lanes_spawn_4` and `bus_lanes_spawn_4` as lanes **per direction**: a mirrored pair counts as 1.
   - If it writes 2 for a pair, the model counts those lanes twice over.
7. **Ship the model file and the game change together.** With the model file alone, the model counts about 105–120 cars per hour at 5* that players never see, and noise, NO₂ and the health index include them.

## How to check it works

**Model side:** run the check script. It runs 11 checks and prints the reference table:

```bash
node handover_spawn5/check_spawn5.js bcc_project_2026-10-20_no-personas_ns-both-directions_2026-10-20_09-55.json
```

**In the game:**
- Over one hour of game time at the saved layout, the vehicles spawned at 5* match the table: about 105 cars, 11 bikes, 1 bus and 0 trams.
- Setting the north–south car lanes to 0 at SP 4 stops all cars at 5*.
- Adding a north–south bike lane at SP 4 raises bikes at 5* from about 11 to about 49 per hour.
- 4* and 5* show the same mix of vehicle types, and 5* has a seventh of 4*'s volume.

## Questions for the game owner

1. How does the game assign cars to spawn points today?
2. Does the street layout tool write lane counts per direction or for both directions together?
3. Do vehicles at 5* enter the scene there, leave it there, or both? It should be the same as at 2*–4*.
4. Should trams be spawned at 5* at all?

## Also in the same model file

These are outside this handover's scope, but the game loads them with it:

- **East–west street.** One decision at SP 2 and SP 3 now sets both 2* and 3*. The spawn 3 lane levers `car_lanes_spawn_3`, `bike_lanes_spawn_3`, `bus_lanes_spawn_3` and `spawn_3_canopy_street` were removed. The game's list of expected inputs has to drop those four, or the game will warn about or refuse the file.
- **Old spawn point numbers.** Node labels and notes in the file still use the old numbers (north–south "SP 3", east–west "SP 1/2"); the spawn map uses the new ones (SP 4, SP 2/3). This is cosmetic only.
- **5* demand share.** 5* keeps its 2 % share (189 people per hour), set when it had no lanes. It's worth recalibrating later.
- **6\*.** The diagonal street (9 % of demand) still has no lanes and no counts.

## Files

| File | What it is |
|---|---|
| `bcc_project_2026-10-20_no-personas_ns-both-directions_2026-10-20_09-55.json` | The model file to load |
| `handover_spawn5/check_spawn5.js` | Read-only check of the 5* counts, for any later version of the file |
| `.tmp/add_ns_spawn5.js` | The script that added the 5* nodes, rerunnable from `bcc_project_2026-10-20_no-personas_spawn3-removed.json` |
| `BCC_Editor_BCC (1).html` | The model editor. Optional follow-up: its dashboard rows are fixed to spawns 2–4 (lines 3459 and 3478), and its game-output list (line 1783) doesn't include the spawn 5 counts yet |
