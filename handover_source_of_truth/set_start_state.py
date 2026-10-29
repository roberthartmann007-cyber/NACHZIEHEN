"""Reset update.json to the start state: parked cars in lane 1/8, lane 4/5 and a/f,
car lanes elsewhere, nothing built. Writes `value` and `baseline_value` of active nodes
and the spawn map's starting states. Prints every change. See START_STATE_PLAN.md.

Usage: .venv/bin/python handover_source_of_truth/set_start_state.py [update.json]
"""
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PATH = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "update.json"
BACKUP = ROOT / "archive" / "update_before-start-state.json"

# Active node -> start value. Nodes not listed (scenario inputs, neighbourhood
# destinations, traffic demand) keep their current values.
START = {
    # E-W street: lane 1/8 parked, 2/7 + 3/6 car lanes
    "sidewalk_extension_spawn_2": 0,
    "bike_lanes_spawn_2": 0,
    "car_lanes_spawn_2": 2,
    "bus_lanes_spawn_2": 0,
    # Middle lane 4/5 parked
    "tram_line_center": 0,
    "carsharing": 0,
    "middle_part_covered_trees": 0,
    # N-S street: a/f parked, b/e + c/d car lanes
    "ns_outer_parking_spawn_4": 1,
    "car_lanes_spawn_4": 2,
    "bike_lanes_spawn_4": 0,
    "bus_lanes_spawn_4": 0,
    # No speed limit
    "speed_limit": 0,
    # Kerb / corner modules
    "ev_charger": 0,
    "grass": 0,
    "bike_parking": 0,
    "bike_lane_protection": 0,
    "protected_intersection": 0,
    # Public space modules
    "urban_furniture": 0,
    "cafe": 0,
    "blue_infrastructure": 0,
    "plaza_trees": 0,
    "quiet_garden": 0,
    "inclusive_play_court": 0,
    "accessible_comfort_station": 0,
    "community_pavilion": 0,
    "separated_dog_garden": 0,
    "playground": 0,
    # Buildings / facades
    "green_facades": 0,
    "school": 0,
    "park": 0,
    "sport_facility": 0,
    # Bus: no stop built at this intersection (bus_stops is a fixed 3, not a control)
    "new_bus_stop": 0,
}

# Spawn element id -> starting option label
ELEMENT_START = {
    "id_5": "parking",                      # lane 1/8
    "id_11": "car_lanes_spawn_2",           # lane 2/7
    "id_22": "car_lanes_spawn_2",           # lane 3/6
    "id_317": "parking",                    # SP 3 middle element (new option)
    "id_343": "ns_outer_parking_spawn_4_1", # lane a/f
    "id_351": "car_lanes_spawn_4",          # lane b/e
    "id_355": "car_lanes_spawn_4",          # lane c/d
    "id_358": "nothing",                    # facade
    "id_387": "nothing",                    # bus stop under the 2/7 bus lane
    "id_376": "parking",                    # SP 6 middle lane (new option)
}

# New "parking" options for the middle lane, so the map can show the start
NEW_PARKING = {
    "id_317": [("tram_line_center", 0), ("car_lanes_spawn_2", 2)],
    "id_376": [("playground", 0), ("sport_facility", 0)],
}


def main():
    data = json.loads(PATH.read_text())
    nodes = {n["id"]: n for n in data["nodes"]}
    changes = []

    for nid, start in START.items():
        n = nodes.get(nid)
        if n is None:
            sys.exit(f"node missing: {nid}")
        if n.get("type") != "active":
            sys.exit(f"not an active node: {nid}")
        for field in ("value", "baseline_value"):
            if n.get(field) != start:
                changes.append(f"node {nid}.{field}: {n.get(field)} -> {start}")
                n[field] = start

    spawn = data["spawn"]
    elements, options = spawn["elements"], spawn["options"]
    next_uid = int(spawn["uid"])

    for eid, effects in NEW_PARKING.items():
        el = elements[eid]
        labels = [options[o]["label"] for o in el["options"]]
        if "parking" in labels:
            continue
        next_uid += 1
        oid = f"id_{next_uid}"
        while oid in options or oid in elements or oid in spawn["points"]:
            next_uid += 1
            oid = f"id_{next_uid}"
        options[oid] = {
            "id": oid,
            "label": "parking",
            "unlockedElemId": None,
            "elemId": eid,
            "effects": [{"node_id": k, "op": "set", "value": v} for k, v in effects],
        }
        el["options"].append(oid)
        changes.append(f"spawn {eid} ({el['name']}): added option {oid} 'parking'")
    spawn["uid"] = next_uid

    for eid, label in ELEMENT_START.items():
        el = elements[eid]
        labels = [options[o]["label"] for o in el["options"]]
        if label not in labels:
            sys.exit(f"{eid} has no option '{label}'")
        if el.get("startingState") != label:
            changes.append(f"spawn {eid} ({el['name']}).startingState: {el.get('startingState')!r} -> {label!r}")
            el["startingState"] = label

    if not changes:
        print("Already at the start state.")
        return
    if PATH.resolve() == (ROOT / "update.json").resolve() and not BACKUP.exists():
        shutil.copy2(PATH, BACKUP)
        print(f"backup: {BACKUP.relative_to(ROOT)}")
    # keep the file's own format (the editor saves without a trailing newline)
    end = "\n" if PATH.read_text().endswith("\n") else ""
    PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + end)
    print("\n".join(changes))
    print(f"{len(changes)} changes written to {PATH.name}")


if __name__ == "__main__":
    main()
