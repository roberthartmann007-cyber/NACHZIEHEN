"""One simple bus stop: stop or no stop at the intersection, +20 bus attractiveness when built.
Removes the stop designs, all-door boarding and the stop congestion loop. See PLAN.md.

Usage: .venv/bin/python handover_bus_stop_simple/apply_bus_stop_simple.py
"""
import copy
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PATH = ROOT / "update.json"
BACKUP = ROOT / "archive" / "update_before-bus-stop-simple.json"
NOTE_DATE = "2026-10-29 (one simple bus stop)"

REMOVE = ["bus_stop_design", "all_door_boarding", "boardings_per_bus_stop", "bus_dwell_s", "bus_bulb_fit",
          "bus_stop_capacity_h", "bus_stop_saturation", "bus_stop_queue_penalty", "bus_stop_parking_loss"]
NEW = "new_bus_stop"
GAIN = 20

SOURCES = (
    "Walk to transit: median about 290 m, most riders within 400-500 m, demand falls off exponentially with "
    "distance (review: https://escholarship.mcgill.ca/downloads/kw52jd240 ; Kimpel et al.: "
    "https://escholarship.mcgill.ca/downloads/pr76f844q ; Daniels & Mulley 2013: "
    "https://ideas.repec.org/a/kap/transp/v41y2014i1p193-210.html ; Bree, Fuller & Diab 2020: "
    "https://ideas.repec.org/a/eee/transa/v141y2020icp430-442.html). Walking to the stop is valued about twice "
    "a seated minute on the bus (TOI, bus users in five Norwegian cities: "
    "https://www.toi.no/publications/bus-passengers-valuation-of-service-improvements-experiences-from-moss-grenland-kristiansand-tromso-and-alesund-article17702-29.html). "
    "Scale check: a full stop package (shelter, seats, timetable, real-time info) is worth about 2-4.3 IVT "
    "minutes, a shelter alone about 9 % of the fare (Douglas, ATRF 2018: "
    "https://australasiantransportresearchforum.org.au/wp-content/uploads/2022/03/ATRF2018_paper_84Rev.pdf ; "
    "Douglas, NZAE 2017: https://www.nzae.org.nz/wp-content/uploads/2017/07/Douglas-PTQualityRatingSP_NZEA2017_3.pdf); "
    "stop upgrades raised boardings about 4 % net (Salt Lake City, https://nitc.trec.pdx.edu/node/5537)."
)

NEW_NOTE = (
    f"{NOTE_DATE}: NEW. The bus stop at the intersection: 0 = no stop here, 1 = the player built it. One type "
    "only: the bus stops in its own lane (2/7) and waits there while people board; the platform is at the "
    "sidewalk. It takes no parking spaces: Section 12 StVO already keeps 15 m either side of a stop free, and "
    "those spaces are not in the 180. Built from the stop option under the bus lane on 2/7 (SP 2). "
    f"Effect: +{GAIN} on mob_attract_bus while the east-west bus lane is there. "
    "Why 20: without a stop here, people walk to the next stop, 300-500 m away (Berlin's transit plan sets "
    "300-500 m catchments). That is about 3-4 minutes more walking, which passengers count about double, so "
    "6-8 minutes of riding time. A shelter alone (about 2 minutes) matched +5 points against the measured "
    "ridership gain, so the stop is about four times that: +15 to +20. The access curve in bus_stop_access "
    "agrees: the first stop there is worth 19.9. " + SOURCES + " [FLAG] derived: the model has no minutes-to-"
    "points rule, so the 20 is set by that ratio, not measured. bus_stops / bus_stop_access (30 today) now "
    "stand for the stops nearby on the line, not this intersection, so the start is unchanged."
)


def main():
    data = json.loads(PATH.read_text())
    nodes = data["nodes"]
    by = {n["id"]: n for n in nodes}
    eh = data["edge_heuristics"]
    spawn = data["spawn"]
    els, opts = spawn["elements"], spawn["options"]
    log = []

    if NEW in by:
        sys.exit(f"{NEW} already exists: already applied?")
    if not BACKUP.exists():
        shutil.copy2(PATH, BACKUP)
        log.append(f"backup: {BACKUP.relative_to(ROOT)}")

    # 1. new active node, built from the removed all_door_boarding as a template
    tpl = by["all_door_boarding"]
    new = copy.deepcopy(tpl)
    new.update({
        "id": NEW, "label": NEW, "influences": ["mob_attract_bus"], "influenced_by": [],
        "notes": NEW_NOTE, "baseline_value": 0, "value": 0, "min": 0, "max": 1,
        "evidence_status": "derived: walk-access literature + stop valuation (Douglas 2017/2018), ratio to shelter",
    })
    nodes.insert(nodes.index(tpl), new)
    log.append(f"node {NEW}: added (active 0/1, start 0)")

    # 2. remove the old stop nodes and every link to them
    nodes[:] = [n for n in nodes if n["id"] not in REMOVE]
    for n in nodes:
        for key in ("influences", "influenced_by"):
            before = n.get(key) or []
            after = [x for x in before if x not in REMOVE]
            if after != before:
                log.append(f"node {n['id']}.{key}: dropped {sorted(set(before) - set(after))}")
                n[key] = after
    for k in [k for k in eh if k.split("->")[0] in REMOVE or k.split("->")[1] in REMOVE]:
        del eh[k]
        log.append(f"edge removed: {k}")
    log.append(f"nodes removed: {', '.join(REMOVE)}")

    # 3. formulas
    mab = by["mob_attract_bus"]
    mab["node_formula"]["expression"] = (
        f"bus_stop_access + total_bus_lanes*10 + bus_service_gain*(bus_service_index/50 - 1) "
        f"+ {GAIN}*{NEW}*bus_lanes_spawn_2")
    for p in (NEW, "bus_lanes_spawn_2"):
        if p not in mab["influenced_by"]:
            mab["influenced_by"].append(p)
    if "mob_attract_bus" not in by["bus_lanes_spawn_2"]["influences"]:
        by["bus_lanes_spawn_2"]["influences"].append("mob_attract_bus")
    mab["notes"] = (
        f"{NOTE_DATE}: The stop congestion loop is gone (no queue penalty). Building the bus stop here adds "
        f"+{GAIN} ({NEW}, see its note for the sources); it counts only while the east-west bus lane is there, "
        "because the stop sits in that lane. Supersedes the queue-penalty part of the Tier 2 note below. "
        + mab.get("notes", ""))
    log.append(f"node mob_attract_bus.formula: {mab['node_formula']['expression']}")

    pp = by["parallel_parking"]
    pp["node_formula"]["expression"] = (
        "parking_spaces_map - spaces_1_8*(1 - (1-sidewalk_extension_spawn_2)*(1-bike_lanes_spawn_2)) "
        "- spaces_4_5*lane_4_5_open")
    pp["notes"] = (f"{NOTE_DATE}: The bus stop takes no extra spaces any more (bus_stop_parking_loss removed). "
                   + pp.get("notes", ""))
    log.append(f"node parallel_parking.formula: {pp['node_formula']['expression']}")

    bs = by["bus_stops"]
    bs["notes"] = (f"{NOTE_DATE}: Stands for the stops nearby on the line, not the stop at this intersection; "
                   f"that one is {NEW}. " + bs.get("notes", ""))

    # 4. edge with the reasoning
    edge_tpl = copy.deepcopy(eh["bus_stop_access->mob_attract_bus"])
    edge_tpl.update({"source": SOURCES, "status": "assumption",
                     "notes": f"+{GAIN} while the east-west bus lane is there. See the note on {NEW}."})
    eh[f"{NEW}->mob_attract_bus"] = edge_tpl
    eh["bus_lanes_spawn_2->mob_attract_bus"] = {**copy.deepcopy(edge_tpl), "source": "",
                                                "notes": f"Gates the {NEW} bonus: the stop sits in the bus lane."}
    log.append(f"edges added: {NEW}->mob_attract_bus, bus_lanes_spawn_2->mob_attract_bus")

    # 5. spawn map: one stop element under the 2/7 bus lane, none under 3/6
    el = els["id_387"]
    for oid in ["id_390", "id_454", "id_455"]:
        el["options"].remove(oid)
        del opts[oid]
    opts["id_389"]["effects"] = [{"node_id": NEW, "op": "set", "value": 0}]
    uid = int(spawn["uid"]) + 1
    oid = f"id_{uid}"
    opts[oid] = {"id": oid, "label": "bus_stop", "unlockedElemId": None, "elemId": "id_387", "node_id": NEW,
                 "effects": [{"node_id": NEW, "op": "set", "value": 1}]}
    el["options"].append(oid)
    el["name"] = "bus stop"
    el["startingState"] = "nothing"
    spawn["uid"] = uid
    log.append(f"spawn id_387 (under 2/7 bus lane): options now nothing ({NEW}=0) / {oid} bus_stop ({NEW}=1)")

    for oid in els["id_384"]["options"]:
        del opts[oid]
    del els["id_384"]
    opts["id_26"]["unlockedElemId"] = None
    log.append("spawn id_384 (stop under 3/6 bus lane): removed; lane 3/6 is not next to the sidewalk")

    # nothing may point at a removed node any more
    for nid in REMOVE:
        for n in nodes:
            n_text = json.dumps({k: v for k, v in n.items() if k != "notes"})
            if f'"{nid}"' in n_text or (n.get("node_formula") and nid in (n["node_formula"].get("expression") or "")):
                sys.exit(f"still referenced: {nid} in {n['id']}")
        if f'"{nid}"' in json.dumps(spawn["options"]) or nid in json.dumps(list(eh)):
            sys.exit(f"still referenced: {nid} in spawn or edges")

    PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print("\n".join(log))


if __name__ == "__main__":
    main()
