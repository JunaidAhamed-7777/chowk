"""Author the low-detail vehicles and CHOWK's city kit in Blender.

The exporter uses metres and the same Blender-to-glTF transform as vehicles.py.
The scene tints the facades and computes windows from world position.
"""

import json
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from placeholders import CLASSES, SLUGS, export_glb
from vehicles import BODY, GLASS, HEAD, SIGN, TAIL, TRIM, Builder, pair


def solid(builder, size, z, x=0, y=0, taper=(1.0, 1.0), mask=BODY):
    builder.box((x, y, z + size[2] / 2), size, mask, taper)


def lod_vehicles():
    heights = (1.34, 1.81, 1.49, 2.0, 3.11, 2.64)
    for index, item in enumerate(json.loads(CLASSES.read_text(encoding="utf8"))):
        slug = SLUGS[item["id"]]
        width, length = item["width"], item["length"]
        height = heights[index]
        b = Builder()
        lower = 0.52 if index == 0 else height * 0.45
        solid(b, (width, length, lower), 0, taper=(0.92, 0.94))
        cab_length = length * (0.86 if index >= 4 else 0.53)
        cab_offset = length * 0.13 if index == 3 else 0
        solid(b, (width * 0.82, cab_length, height - lower), lower,
              y=cab_offset, taper=(0.76, 0.83), mask=TRIM if index == 0 else GLASS)
        if index == 3:
            solid(b, (width * 0.96, length * 0.42, 0.23), lower,
                  y=-length * 0.25, mask=TRIM)
        spans = [(-width * 0.21, width * 0.21)] if index == 0 else pair(width * 0.23, width * 0.40)
        b.lamps(length / 2 + 0.004, lower * 0.60, lower * 0.80, spans, HEAD, (0, 0, lower / 2))
        b.lamps(-length / 2 - 0.004, lower * 0.60, lower * 0.80, spans, TAIL, (0, 0, lower / 2))
        if index in (1, 4, 5):
            solid(b, (width * 0.56, length * 0.11, 0.08), height - 0.045, mask=SIGN)
        export_glb(b.finish(), f"veh_{slug}_lod1")


def facades():
    # Plinth, upper massing and roof edges distinguish the archetypes in silhouette.
    forms = {
        "low_1": ((10, 9, 10), [(10.3, 9.3, .5, 9.5, 0)]),
        "low_2": ((10, 10, 8), [(10.4, 10.6, .55, 2.8, 0), (5, 6, 1.2, 8, -1.4)]),
        "low_3": ((11, 9, 11), [(11.3, 9.2, .5, 10.6, 0), (4, 7, 1.25, 11, 2.4)]),
        "mid_1": ((13, 11, 21), [(13.6, 11.5, 1.1, 0, 0), (10.8, 9, 2.3, 21, 0)]),
        "mid_2": ((12, 11, 19), [(10, 8, 7, 19, -0.7), (12.6, 11.6, .5, 18.8, 0)]),
        "mid_3": ((12, 11, 24), [(5, 8, 3.2, 24, 2.7), (12.6, 11.5, 0.8, 1.8, 0)]),
        "tall_1": ((17, 13, 40), [(14, 11, 10, 40, 0), (11, 8, 8, 50, 0)]),
        "tall_2": ((14, 14, 44), [(11, 11, 11, 44, 0), (6.6, 7.5, 8, 55, 1.2)]),
        "roof_1": ((2.4, 2.4, 1.9), [(2.5, 2.5, .18, 1.9, 0)]),
        "roof_2": ((3.5, 3.0, 2.5), [(3.65, 3.15, .21, 2.5, 0)]),
        "roof_3": ((3.8, .4, 1.6), [(4, .48, .14, 1.6, 0)]),
    }
    for name, (base, parts) in forms.items():
        b = Builder()
        solid(b, base, 0)
        for width, depth, height, elevation, x in parts:
            solid(b, (width, depth, height), elevation, x=x)
        export_glb(b.finish(), f"bld_{name}")


def prop(name, parts):
    b = Builder()
    for size, z, x, y, taper in parts:
        solid(b, size, z, x=x, y=y, taper=taper)
    export_glb(b.finish(), f"prop_{name}")


def part(size, z=0, x=0, y=0, taper=(1, 1)):
    return size, z, x, y, taper


def street():
    prop("signal", [part((.30, .30, 5.2)), part((.62, .55, .45)),
                    part((3.3, .15, .16), 4.94, 1.65),
                    part((.49, .42, 1.34), 3.87, 3.2, -.38)])
    prop("lamp", [part((.19, .19, 7.04)), part((.35, .35, .35)),
                  part((2.65, .17, .15), 6.98, 1.30, taper=(.96, .85)),
                  part((.56, .43, .19), 6.84, 2.68, taper=(.88, .80))])
    prop("tree_1", [part((.35, .35, 3.6)), part((4.9, 4.4, 3.3), 2.35, taper=(.53, .57)),
                    part((3.2, 3.3, 2.3), 4.18, x=.25, taper=(.29, .35))])
    prop("tree_2", [part((.28, .29, 4.4)), part((4.1, 4.8, 3.3), 3.3, taper=(.38, .45)),
                    part((2.6, 3.1, 2.8), 4.85, x=-.3, taper=(.35, .33))])
    prop("shopstrip", [part((2.8, .23, .74), x=-3.05), part((2.9, .22, .87)), part((2.75, .22, .70), x=3.05)])
    prop("busstop", [part((.14, .14, 3.1), x=-2.35), part((.14, .14, 3.1), x=2.35),
                     part((5.2, 2.2, .24), 3.05), part((4.0, .34, .23), .57),
                     part((1.0, .14, 2.35), .46, x=-1.63)])
    prop("hoarding", [part((.27, .30, 6.5), x=-2.1), part((.27, .30, 6.5), x=2.1),
                      part((6.7, .32, 3), 5.5)])
    prop("barrier", [part((.16, .16, 1.1), x=-1.42), part((.16, .16, 1.1), x=1.42),
                     part((3.05, .09, .1), .68), part((3.05, .09, .1), .95)])
    prop("breakdown", [part((.65, .65, .19), x=-.9), part((.48, .48, .65), .19, x=-.9, taper=(.21, .21)),
                       part((.55, .55, .16), x=.8), part((.43, .43, .59), .16, x=.8, taper=(.20, .20))])
    prop("viaduct", [part((18, 5.2, .85), 10.0), part((1.8, 1.65, 10.2)),
                     part((4.8, 3.4, 1.2), 9.0), part((18, .19, .6), 10.85, y=2.5),
                     part((18, .19, .6), 10.85, y=-2.5)])
    prop("autostand", [part((5.7, 2.6, .18), 2.6), part((.15, .15, 2.6), x=-2.6),
                      part((.15, .15, 2.6), x=2.6),
                      *[part((1.22, 2.4, 1.63), x=x, taper=(.72, .75)) for x in (-1.75, 0, 1.75)]])


if __name__ == "__main__":
    lod_vehicles()
    facades()
    street()
