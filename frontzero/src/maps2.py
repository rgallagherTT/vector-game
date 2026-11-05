# Second wave of FRONT ZERO maps: one more per country. Writes data/maps/<id>.json and adds them to index.json.
import json, os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'maps')
def pads(team, x, z, yaw, kinds, spacing=55):
    out = []
    for i, k in enumerate(kinds):
        px = x + (i % 4) * spacing * 0.5 - spacing * 0.75; pz = z + (i // 4) * spacing * 0.6 - spacing * 0.3
        d = {"type": k, "x": round(px), "z": round(pz), "yaw": yaw, "team": team}
        if k in ("vtol_dropship", "vtol_gunship", "interceptor", "strike_fighter"): d["air"] = True
        if k in ("assault_mech", "artillery_skiff", "strike_fighter"): d["modes"] = ["warfare"]
        out.append(d)
    return out
STD = ["hover_tank", "hover_apc", "speeder_bike", "speeder_buggy", "vtol_dropship", "vtol_gunship"]
VAR = lambda *v: [dict(zip(["id", "name", "hour", "weather"], x)) for x in v]
def area(id, name, x, z, r, dom, spawns): return {"id": id, "name": name, "x": x, "z": z, "r": r, "dom": dom, "spawns": spawns}
def obj(n, x, z): return {"name": n, "x": x, "z": z}
def cq(i, n, x, z): return {"id": "ABCDEFG"[i], "name": n, "x": x, "z": z}
def base(id, name, x, z): return {"id": id, "name": name, "kind": "base", "x": x, "z": z, "r": 100, "helipad": True, "ground": "gravel"}
maps = {}

maps["sunspire"] = {"id": "sunspire", "name": "Sunspire", "country": "kharavan", "size": 2400, "seed": 1313, "biomes": ["desert", "urban"], "mask": {"type": "radial", "x": 0, "z": 0, "r": 0.22, "blend": 0.08, "inner": True}, "baseHeight": 9,
  "blurb": "Glass towers rising out of the dunes around the old palace, with an airfield on the salt road.",
  "sites": [{"id": "city", "name": "Sunspire", "kind": "city", "x": 0, "z": 0, "r": 300, "block": 54, "street": 15, "floors": [3, 8], "ground": "asphalt"},
    {"id": "palace", "name": "Old palace", "kind": "fortress", "x": -520, "z": -360, "r": 100, "raise": 8, "edge": 60},
    {"id": "souk", "name": "Souk", "kind": "town", "x": 480, "z": 360, "r": 130, "density": 0.75, "style": "adobe", "floors": [1, 3], "ground": "dirt"},
    {"id": "oasis", "name": "Palm oasis", "kind": "farm", "x": -460, "z": 480, "r": 90},
    base("accordhq", "Accord airfield", -900, 820), base("mandatehq", "Mandate HQ", 880, -820)],
  "lakes": [{"x": -470, "z": 420, "r": 45, "depth": 3}],
  "roads": [{"pts": [[-900, 820], [-460, 480], [-150, 150], [0, 0], [200, -250], [880, -820]], "width": 10, "surf": "asphalt"}, {"pts": [[-520, -360], [0, 0], [480, 360]], "width": 8, "surf": "asphalt"}],
  "structures": [{"id": "spire", "type": "radio_tower", "name": "Sun spire", "x": 30, "z": 30, "h": 70}, {"id": "fuel", "type": "fuel_depot", "name": "Airfield fuel", "x": -820, "z": 700}, {"id": "radar", "type": "radar", "name": "Palace radar", "x": -560, "z": -300}],
  "bases": [{"x": -900, "z": 820, "yaw": 2.3}, {"x": 880, "z": -820, "yaw": -0.8}],
  "pads": pads(0, -900, 780, 2.3, STD + ["speeder_quad", "strike_fighter"]) + pads(1, 880, -780, -0.8, STD + ["interceptor", "artillery_skiff"]),
  "breakthrough": {"attacker": 0, "sectors": [{"name": "Oasis", "objs": [obj("Palm grove", -460, 480), obj("Pump house", -340, 360)]}, {"name": "Tower district", "objs": [obj("Spire plaza", 0, 0), obj("Mall", -100, 120), obj("Hotel", 120, -100)], "destroy": "spire"},
    {"name": "Souk", "objs": [obj("Souk gate", 400, 300), obj("Spice market", 500, 380)]}, {"name": "Mandate HQ", "objs": [obj("Headquarters", 880, -820)]}]},
  "conquest": [cq(0, "Oasis", -460, 480), cq(1, "Old palace", -520, -360), cq(2, "Spire plaza", 0, 0), cq(3, "Hotel", 140, -120), cq(4, "Souk", 480, 360), cq(5, "Salt road", 450, -450)],
  "pois": [{"name": "Old palace", "x": -520, "z": -360, "r": 70, "tier": 4}, {"name": "Spire plaza", "x": 0, "z": 0, "r": 90, "tier": 3}, {"name": "Souk", "x": 480, "z": 360, "r": 80, "tier": 2}, {"name": "Palm oasis", "x": -460, "z": 480, "r": 60, "tier": 1}, {"name": "Mandate HQ", "x": 880, "z": -820, "r": 90, "tier": 5, "boss": "warden"}],
  "extracts": [{"name": "Salt road", "x": -1050, "z": 100, "kind": "open"}, {"name": "Spire roof", "x": 30, "z": 30, "kind": "flare"}, {"name": "Souk alley", "x": 600, "z": 450, "kind": "guarded"}, {"name": "Dune track", "x": 200, "z": 1050, "kind": "timed", "opens": 380}],
  "areas": [area("plaza", "Spire plaza", 0, 0, 160, [[-60, -40], [0, 0], [60, 40]], [[-140, -100], [140, 100]]), area("souk", "Souk", 480, 360, 140, [[430, 320], [480, 360], [530, 400]], [[380, 260], [580, 460]])],
  "variants": VAR(["day", "Day", 12, "clear"], ["haze", "Heat haze", 15, "haze"], ["storm", "Sandstorm", 14, "sandstorm"], ["night", "Night", 22, "clear"])}

maps["mangrove"] = {"id": "mangrove", "name": "Mangrove", "country": "selvara", "size": 2400, "seed": 1414, "biomes": ["jungle", "coastal"], "mask": {"type": "edge", "dir": "n", "start": 0.82, "blend": 0.06}, "baseHeight": 4,
  "blurb": "A river delta of mangrove channels and stilt villages. Bring a boat.",
  "sea": {"dir": "n", "shore": 0.84, "level": 0, "depth": 10},
  "rivers": [{"pts": [[-1150, -600], [-700, -300], [-300, -350], [0, -100], [300, 200], [700, 400], [1150, 700]], "width": 40, "depth": 3}, {"pts": [[0, -1150], [-80, -600], [0, -100]], "width": 26, "depth": 3}],
  "sites": [{"id": "stilts", "name": "Kaya stilt village", "kind": "town", "x": -380, "z": -150, "r": 130, "density": 0.7, "floors": [1, 2], "ground": "dirt"},
    {"id": "cannery", "name": "Cannery", "kind": "port", "x": 380, "z": 320, "r": 120, "density": 0.6, "ground": "concrete"},
    {"id": "mission", "name": "Old mission", "kind": "ruins", "x": 200, "z": -480, "r": 80},
    {"id": "logging", "name": "Logging camp", "kind": "camp", "x": -600, "z": 450, "r": 70},
    base("accordhq", "Accord HQ", -900, 850), base("mandatehq", "Mandate HQ", 900, -850)],
  "roads": [{"pts": [[-900, 850], [-600, 450], [-380, -150], [0, -100], [380, 320]], "width": 7, "surf": "dirt"}, {"pts": [[200, -480], [900, -850]], "width": 7, "surf": "dirt"}],
  "structures": [{"id": "bridge1", "type": "bridge", "name": "Delta bridge", "a": [-40, -150], "b": [40, -50], "width": 9}, {"id": "mast", "type": "radio_tower", "name": "Mission mast", "x": 230, "z": -440, "h": 40}],
  "bases": [{"x": -900, "z": 850, "yaw": 2.3}, {"x": 900, "z": -850, "yaw": -0.8}],
  "pads": pads(0, -900, 810, 2.3, STD + ["speeder_quad"]) + pads(1, 900, -810, -0.8, STD + ["interceptor"]) + [{"type": "patrol_boat", "x": -300, "z": -340, "yaw": 1.2, "team": None}, {"type": "assault_hovercraft", "x": 200, "z": 120, "yaw": 0.6, "team": None}, {"type": "patrol_boat", "x": 552, "z": 322, "yaw": 0.4, "team": None}],
  "breakthrough": {"attacker": 1, "sectors": [{"name": "Old mission", "objs": [obj("Chapel", 200, -480), obj("Bell tower", 260, -420)]}, {"name": "Delta", "objs": [obj("Bridge", -60, -210), obj("Boathouse", 110, -30)], "destroy": "bridge1"},
    {"name": "Stilt village", "objs": [obj("Longhouse", -380, -150), obj("Fish market", -300, -60)]}, {"name": "Logging camp", "objs": [obj("Saw shed", -600, 450), obj("Timber yard", -520, 380)]}, {"name": "Accord HQ", "objs": [obj("Headquarters", -900, 850)]}]},
  "conquest": [cq(0, "Old mission", 200, -480), cq(1, "Delta bridge", -60, -210), cq(2, "Stilt village", -380, -150), cq(3, "Cannery", 380, 320), cq(4, "Logging camp", -600, 450), cq(5, "Mud flats", 600, -200)],
  "pois": [{"name": "Cannery", "x": 380, "z": 320, "r": 80, "tier": 3}, {"name": "Old mission", "x": 200, "z": -480, "r": 60, "tier": 3}, {"name": "Kaya stilt village", "x": -380, "z": -150, "r": 80, "tier": 2}, {"name": "Logging camp", "x": -600, "z": 450, "r": 60, "tier": 1}, {"name": "Mandate HQ", "x": 900, "z": -850, "r": 90, "tier": 5, "boss": "warden"}],
  "extracts": [{"name": "River mouth boat", "x": 300, "z": 1000, "kind": "flare"}, {"name": "West trail", "x": -1050, "z": 0, "kind": "open"}, {"name": "Mission gate", "x": 200, "z": -560, "kind": "guarded"}, {"name": "East channel", "x": 1050, "z": 500, "kind": "timed", "opens": 360}],
  "areas": [area("village", "Stilt village", -380, -150, 150, [[-430, -190], [-380, -150], [-330, -110]], [[-500, -260], [-260, -40]]), area("cannery", "Cannery", 380, 320, 140, [[330, 280], [380, 320], [430, 360]], [[280, 220], [480, 420]])],
  "variants": VAR(["day", "Day", 10, "clear"], ["monsoon", "Monsoon", 15, "monsoon"], ["fog", "Morning fog", 6.5, "fog"], ["dusk", "Dusk", 18.5, "rain"])}

maps["frostline"] = {"id": "frostline", "name": "Frostline", "country": "nordheim", "size": 2400, "seed": 1515, "biomes": ["arctic", "mountain"], "baseHeight": 16,
  "blurb": "A radar station on the glacier above a frozen lake and the mining town that feeds it.",
  "lakes": [{"x": 0, "z": 200, "r": 260, "depth": 6}],
  "sites": [{"id": "radar", "name": "Glacier station", "kind": "station", "x": 420, "z": -420, "r": 120},
    {"id": "town", "name": "Kvalsund", "kind": "town", "x": -420, "z": -200, "r": 140, "density": 0.7, "floors": [1, 3], "ground": "snow"},
    {"id": "mine", "name": "Copper mine", "kind": "outpost", "x": -500, "z": 500, "r": 90, "density": 0.6},
    {"id": "huts", "name": "Ice-fishing huts", "kind": "camp", "x": 120, "z": 260, "r": 60},
    base("accordhq", "Accord HQ", -900, 880), base("mandatehq", "Mandate HQ", 900, -880)],
  "roads": [{"pts": [[-900, 880], [-500, 500], [-420, -200], [0, -300], [420, -420], [900, -880]], "width": 8, "surf": "gravel"}],
  "structures": [{"id": "dish", "type": "radar", "name": "Glacier dish", "x": 460, "z": -460}, {"id": "mast", "type": "radio_tower", "name": "Station mast", "x": 380, "z": -380, "h": 50}, {"id": "fuel", "type": "fuel_depot", "name": "Town fuel", "x": -380, "z": -120}],
  "bases": [{"x": -900, "z": 880, "yaw": 2.3}, {"x": 900, "z": -880, "yaw": -0.8}],
  "pads": pads(0, -900, 840, 2.3, STD + ["snow_sled", "snow_sled", "assault_mech"]) + pads(1, 900, -840, -0.8, STD + ["snow_sled", "exo_suit"]),
  "breakthrough": {"attacker": 0, "sectors": [{"name": "Copper mine", "objs": [obj("Mine head", -500, 500), obj("Ore hoppers", -430, 430)]}, {"name": "Frozen lake", "objs": [obj("Fishing huts", 120, 260), obj("Lake shore", -200, 0)]},
    {"name": "Kvalsund", "objs": [obj("Town square", -420, -200), obj("Church", -350, -260)]}, {"name": "Glacier station", "objs": [obj("Dish", 460, -460), obj("Labs", 400, -380)], "destroy": "dish"}, {"name": "Mandate HQ", "objs": [obj("Headquarters", 900, -880)]}]},
  "conquest": [cq(0, "Copper mine", -500, 500), cq(1, "Fishing huts", 120, 260), cq(2, "Kvalsund", -420, -200), cq(3, "Glacier station", 420, -420), cq(4, "Ice road", 0, -300), cq(5, "North cairn", 600, 300)],
  "pois": [{"name": "Glacier station", "x": 420, "z": -420, "r": 80, "tier": 4}, {"name": "Kvalsund", "x": -420, "z": -200, "r": 90, "tier": 2}, {"name": "Copper mine", "x": -500, "z": 500, "r": 60, "tier": 3}, {"name": "Ice-fishing huts", "x": 120, "z": 260, "r": 50, "tier": 1}, {"name": "Mandate HQ", "x": 900, "z": -880, "r": 90, "tier": 5, "boss": "warden"}],
  "extracts": [{"name": "South pass", "x": -200, "z": 1050, "kind": "open"}, {"name": "Station helipad", "x": 500, "z": -480, "kind": "flare"}, {"name": "Mine tunnel", "x": -540, "z": 540, "kind": "guarded"}, {"name": "Glacier edge", "x": 1050, "z": 0, "kind": "timed", "opens": 420}],
  "areas": [area("town", "Kvalsund", -420, -200, 150, [[-470, -240], [-420, -200], [-370, -160]], [[-540, -300], [-300, -100]]), area("station", "Glacier station", 420, -420, 140, [[370, -380], [420, -420], [470, -460]], [[320, -320], [520, -520]])],
  "variants": VAR(["day", "Day", 11, "clear"], ["snow", "Snowfall", 13, "snow"], ["blizzard", "Blizzard", 15, "blizzard"], ["night", "Polar night", 1, "clear"])}

maps["vinehollow"] = {"id": "vinehollow", "name": "Vinehollow", "country": "valmora", "size": 2400, "seed": 1616, "biomes": ["temperate"], "baseHeight": 18,
  "blurb": "Rolling vineyards around a hilltop château, a rail town and a stone bridge over the Vire.",
  "rivers": [{"pts": [[-1150, 200], [-600, 120], [-100, 260], [400, 120], [1150, 300]], "width": 24, "depth": 3}],
  "sites": [{"id": "chateau", "name": "Château Morel", "kind": "fortress", "x": 380, "z": -380, "r": 100, "raise": 14, "edge": 70},
    {"id": "town", "name": "Vire-sur-Colline", "kind": "town", "x": -300, "z": -150, "r": 150, "density": 0.7, "floors": [1, 3], "ground": "dirt"},
    {"id": "farm1", "name": "Vineyard farm", "kind": "farm", "x": -500, "z": 550, "r": 110}, {"id": "farm2", "name": "Press house", "kind": "farm", "x": 450, "z": 520, "r": 100},
    {"id": "station", "name": "Rail depot", "kind": "outpost", "x": 0, "z": -600, "r": 80},
    base("accordhq", "Accord HQ", -920, 860), base("mandatehq", "Mandate HQ", 920, -860)],
  "roads": [{"pts": [[-920, 860], [-500, 550], [-300, -150], [-120, 210], [120, 230], [450, 520]], "width": 7, "surf": "asphalt"}, {"pts": [[-300, -150], [0, -600], [380, -380], [920, -860]], "width": 7, "surf": "asphalt"}],
  "structures": [{"id": "bridge", "type": "bridge", "name": "Vire bridge", "a": [-160, 220], "b": [-80, 240], "width": 9}, {"id": "mast", "type": "radio_tower", "name": "Château mast", "x": 420, "z": -340, "h": 40}],
  "bases": [{"x": -920, "z": 860, "yaw": 2.3}, {"x": 920, "z": -860, "yaw": -0.8}],
  "pads": pads(0, -920, 820, 2.3, STD + ["speeder_quad", "speeder_hauler"]) + pads(1, 920, -820, -0.8, STD + ["artillery_skiff", "assault_mech"]),
  "breakthrough": {"attacker": 1, "sectors": [{"name": "Rail depot", "objs": [obj("Platform", 0, -600), obj("Signal box", 80, -560)]}, {"name": "Château", "objs": [obj("Courtyard", 380, -380), obj("Wine cellar", 330, -330)]},
    {"name": "Vire", "objs": [obj("Town hall", -300, -150), obj("Bridge", -120, 230)], "destroy": "bridge"}, {"name": "Vineyards", "objs": [obj("Vineyard farm", -500, 550), obj("Press house", 450, 520)]}, {"name": "Accord HQ", "objs": [obj("Headquarters", -920, 860)]}]},
  "conquest": [cq(0, "Rail depot", 0, -600), cq(1, "Château", 380, -380), cq(2, "Vire", -300, -150), cq(3, "Bridge", -120, 230), cq(4, "Vineyard farm", -500, 550), cq(5, "Press house", 450, 520)],
  "pois": [{"name": "Château Morel", "x": 380, "z": -380, "r": 70, "tier": 4}, {"name": "Vire-sur-Colline", "x": -300, "z": -150, "r": 90, "tier": 2}, {"name": "Rail depot", "x": 0, "z": -600, "r": 60, "tier": 3}, {"name": "Vineyard farm", "x": -500, "z": 550, "r": 70, "tier": 1}, {"name": "Mandate HQ", "x": 920, "z": -860, "r": 90, "tier": 5, "boss": "warden"}],
  "extracts": [{"name": "West lane", "x": -1050, "z": -100, "kind": "open"}, {"name": "Château tower", "x": 380, "z": -380, "kind": "flare"}, {"name": "Rail tunnel", "x": 60, "z": -760, "kind": "guarded"}, {"name": "River ford", "x": 900, "z": 300, "kind": "timed", "opens": 380}],
  "areas": [area("town", "Vire", -300, -150, 150, [[-350, -190], [-300, -150], [-250, -110]], [[-420, -260], [-180, -40]]), area("chateau", "Château", 380, -380, 130, [[340, -340], [380, -380], [420, -420]], [[290, -290], [470, -470]])],
  "variants": VAR(["day", "Day", 11, "clear"], ["rain", "Rain", 15, "rain"], ["fog", "Fog", 7, "fog"], ["dusk", "Harvest dusk", 19, "clear"])}

maps["neondocks"] = {"id": "neondocks", "name": "Neon Docks", "country": "portaurel", "size": 2000, "seed": 1717, "biomes": ["urban", "coastal"], "mask": {"type": "edge", "dir": "s", "start": 0.8, "blend": 0.05}, "baseHeight": 5, "border": 120,
  "blurb": "Port Aurel's night district: neon towers, container cranes and a harbour that never sleeps.",
  "sea": {"dir": "s", "shore": 0.82, "level": 0, "depth": 14},
  "sites": [{"id": "city", "name": "Neon district", "kind": "city", "x": -80, "z": -150, "r": 420, "block": 52, "street": 15, "floors": [4, 10], "ground": "asphalt"},
    {"id": "docks", "name": "Container docks", "kind": "port", "x": 250, "z": 560, "r": 160, "density": 0.7, "ground": "concrete"},
    base("accordhq", "Accord HQ", -760, 640), base("mandatehq", "Mandate HQ", 620, -720)],
  "roads": [{"pts": [[-760, 640], [-300, 300], [0, 0], [300, -300], [620, -720]], "width": 12, "surf": "asphalt"}, {"pts": [[0, 0], [250, 560]], "width": 10, "surf": "asphalt"}],
  "structures": [{"id": "freighter", "type": "ship", "name": "Container ship", "x": 300, "z": 760, "yaw": 1.5708}, {"id": "spire", "type": "radio_tower", "name": "Broadcast spire", "x": -40, "z": -60, "h": 75}],
  "bases": [{"x": -760, "z": 640, "yaw": 2.36}, {"x": 620, "z": -720, "yaw": -0.7}],
  "pads": pads(0, -760, 600, 2.36, STD + ["speeder_bike", "interceptor"]) + pads(1, 620, -680, -0.7, STD + ["interceptor"]) + [{"type": "patrol_boat", "x": 0, "z": 780, "yaw": 1.5, "team": None}],
  "breakthrough": {"attacker": 0, "sectors": [{"name": "Docks", "objs": [obj("Crane yard", 250, 560), obj("Customs shed", 120, 480)]}, {"name": "Lower district", "objs": [obj("Arcade", -100, 150), obj("Night market", 60, 120)]},
    {"name": "Broadcast spire", "objs": [obj("Spire plaza", -40, -60), obj("Studio", 80, -150)], "destroy": "spire"}, {"name": "Upper district", "objs": [obj("Exchange", 200, -350), obj("Sky bridge", 300, -250)]}, {"name": "Mandate HQ", "objs": [obj("Headquarters", 620, -720)]}]},
  "conquest": [cq(0, "Crane yard", 250, 560), cq(1, "Arcade", -100, 150), cq(2, "Spire plaza", -40, -60), cq(3, "Exchange", 200, -350), cq(4, "Old town", -400, -300), cq(5, "Night market", 60, 120)],
  "pois": [{"name": "Exchange", "x": 200, "z": -350, "r": 70, "tier": 4}, {"name": "Container docks", "x": 250, "z": 560, "r": 90, "tier": 3}, {"name": "Night market", "x": 60, "z": 120, "r": 60, "tier": 2}, {"name": "Spire plaza", "x": -40, "z": -60, "r": 60, "tier": 3}, {"name": "Mandate HQ", "x": 620, "z": -720, "r": 80, "tier": 5, "boss": "warden"}],
  "extracts": [{"name": "Harbour taxi", "x": -200, "z": 800, "kind": "flare"}, {"name": "Freeway", "x": -900, "z": -200, "kind": "open"}, {"name": "Metro station", "x": -300, "z": -500, "kind": "guarded"}, {"name": "Rooftop", "x": -40, "z": -60, "kind": "timed", "opens": 360}],
  "areas": [area("market", "Night market", 60, 120, 140, [[20, 80], [60, 120], [100, 160]], [[-40, 20], [160, 220]]), area("docks", "Crane yard", 250, 560, 140, [[200, 520], [250, 560], [300, 600]], [[150, 460], [350, 660]])],
  "variants": VAR(["night", "Night", 22.5, "neonrain"], ["smoke", "Smog", 17, "smoke"], ["fog", "Sea fog", 6.5, "fog"], ["day", "Day", 12, "clear"])}

maps["saltpan"] = {"id": "saltpan", "name": "Saltpan", "country": "ashkar", "size": 3000, "seed": 1818, "biomes": ["desert", "mountain"], "mask": {"type": "noise", "scale": 900, "thresh": 0.45, "blend": 0.2}, "baseHeight": 8,
  "blurb": "A blinding salt flat between red ranges: long sightlines, fast vehicles, nowhere to hide.",
  "sites": [{"id": "works", "name": "Salt works", "kind": "outpost", "x": 0, "z": 0, "r": 110, "density": 0.7},
    {"id": "camp", "name": "Nomad camp", "kind": "camp", "x": -600, "z": -500, "r": 80}, {"id": "fort", "name": "Canyon fort", "kind": "fortress", "x": 650, "z": 520, "r": 110, "raise": 20, "edge": 80},
    {"id": "village", "name": "Qarra", "kind": "town", "x": -500, "z": 500, "r": 130, "density": 0.6, "style": "adobe", "floors": [1, 2], "ground": "dirt"},
    {"id": "ruins", "name": "Caravan ruins", "kind": "ruins", "x": 500, "z": -600, "r": 90},
    base("accordhq", "Accord HQ", -1150, 1100), base("mandatehq", "Mandate HQ", 1150, -1100)],
  "roads": [{"pts": [[-1150, 1100], [-500, 500], [0, 0], [500, -600], [1150, -1100]], "width": 10, "surf": "gravel"}, {"pts": [[-600, -500], [0, 0], [650, 520]], "width": 8, "surf": "dirt"}],
  "structures": [{"id": "fuel", "type": "fuel_depot", "name": "Works fuel", "x": 60, "z": 60}, {"id": "mast", "type": "radio_tower", "name": "Fort mast", "x": 700, "z": 560, "h": 44}, {"id": "radar", "type": "radar", "name": "Ruins radar", "x": 560, "z": -640}],
  "bases": [{"x": -1150, "z": 1100, "yaw": 2.36}, {"x": 1150, "z": -1100, "yaw": -0.79}],
  "pads": pads(0, -1150, 1060, 2.36, STD + ["speeder_bike", "speeder_quad", "speeder_hauler", "strike_fighter", "assault_mech"]) + pads(1, 1150, -1060, -0.79, STD + ["speeder_bike", "interceptor", "strike_fighter", "artillery_skiff"]),
  "breakthrough": {"attacker": 0, "sectors": [{"name": "Qarra", "objs": [obj("Village well", -500, 500), obj("Caravanserai", -420, 420)]}, {"name": "Salt works", "objs": [obj("Evaporators", 0, 0), obj("Loading sheds", 80, 60)], "destroy": "fuel"},
    {"name": "Canyon fort", "objs": [obj("Fort gate", 650, 520), obj("Canyon mouth", 560, 440)]}, {"name": "Caravan ruins", "objs": [obj("Ruined arch", 500, -600), obj("Old radar", 560, -640)]}, {"name": "Mandate HQ", "objs": [obj("Headquarters", 1150, -1100)]}]},
  "conquest": [cq(0, "Qarra", -500, 500), cq(1, "Nomad camp", -600, -500), cq(2, "Salt works", 0, 0), cq(3, "Canyon fort", 650, 520), cq(4, "Caravan ruins", 500, -600), cq(5, "Pan centre", 0, -500), cq(6, "Mirage flats", 0, 600)],
  "pois": [{"name": "Canyon fort", "x": 650, "z": 520, "r": 70, "tier": 4}, {"name": "Salt works", "x": 0, "z": 0, "r": 80, "tier": 3}, {"name": "Qarra", "x": -500, "z": 500, "r": 80, "tier": 2}, {"name": "Nomad camp", "x": -600, "z": -500, "r": 50, "tier": 1}, {"name": "Caravan ruins", "x": 500, "z": -600, "r": 60, "tier": 2}, {"name": "Mandate HQ", "x": 1150, "z": -1100, "r": 90, "tier": 5, "boss": "warden"}],
  "extracts": [{"name": "West range", "x": -1300, "z": 0, "kind": "open"}, {"name": "Fort roof", "x": 650, "z": 520, "kind": "flare"}, {"name": "Ruins cellar", "x": 520, "z": -620, "kind": "guarded"}, {"name": "North track", "x": 0, "z": -1300, "kind": "timed", "opens": 420}],
  "areas": [area("works", "Salt works", 0, 0, 160, [[-50, -40], [0, 0], [50, 40]], [[-130, -100], [130, 100]]), area("village", "Qarra", -500, 500, 150, [[-550, 460], [-500, 500], [-450, 540]], [[-600, 400], [-400, 600]])],
  "variants": VAR(["day", "Day", 12, "clear"], ["haze", "Mirage", 14, "haze"], ["storm", "Sandstorm", 15, "sandstorm"], ["dusk", "Dusk", 18.5, "clear"])}

for k, v in maps.items(): json.dump(v, open(os.path.join(OUT, k + ".json"), "w"), indent=1)
idx = json.load(open(os.path.join(OUT, "index.json"))); order = idx["maps"]
after = {"sunspire": "shipgrave", "mangrove": "templehill", "frostline": "whiteout", "vinehollow": "greywood", "neondocks": "harbourfront", "saltpan": "redcut"}
for k, a in after.items():
    if k in order: continue
    order.insert(order.index(a) + 1, k)
json.dump({"maps": order}, open(os.path.join(OUT, "index.json"), "w")); print("wrote", len(maps), "maps; order:", order)
