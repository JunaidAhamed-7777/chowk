"""Model the six CHOWK vehicles with Blender's bmesh and export raw GLBs.

Run headless:
    blender --background --python assets/blender/vehicles.py

Blender axes while modelling: +X right, +Y forward (the headlight end), +Z up.
The export converts to glTF axes (+Y up, -Z forward), which the asset pipeline and the app expect.

Vertex colours are a material mask read by the vehicle shader:
    (0, 0, 0)          body paint, tinted per vehicle
    (0.3, 0.3, 0.3)    dark trim: tyres, underbody, rider
    (0.3, 0.3, 0.45)   glass
    (1, 0, 0)          tail-light
    (0, 1, 0)          headlight
    (0, 0, 1)          roof sign, destination board or beacon
Only values above 0.5 count as lights, which is what assets/scripts/models.mjs checks.
"""

import json
import math
import sys
from pathlib import Path

import bmesh
from mathutils import Vector

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from placeholders import SLUGS, Mesh, export_glb  # noqa: E402

BODY = (0.0, 0.0, 0.0)
TRIM = (0.3, 0.3, 0.3)
GLASS = (0.3, 0.3, 0.45)
TAIL = (1.0, 0.0, 0.0)
HEAD = (0.0, 1.0, 0.0)
SIGN = (0.0, 0.0, 1.0)
MASKS = [BODY, TRIM, GLASS, TAIL, HEAD, SIGN]
PROUD = 0.006


class Builder:
    def __init__(self):
        self.bm = bmesh.new()
        self.mask = self.bm.faces.layers.int.new("mask")

    def _face(self, points, mask, away_from):
        verts = [self.bm.verts.new(point) for point in points]
        face = self.bm.faces.new(verts)
        face[self.mask] = MASKS.index(mask)
        face.normal_update()
        if face.normal.dot(face.calc_center_median() - Vector(away_from)) < 0:
            face.normal_flip()
        return face

    def quad(self, points, mask, away_from):
        self._face(points, mask, away_from)

    def box(self, centre, size, mask, top_scale=(1.0, 1.0)):
        cx, cy, cz = centre
        sx, sy, sz = (axis / 2 for axis in size)
        tx, ty = top_scale
        low = [(cx - sx, cy - sy, cz - sz), (cx + sx, cy - sy, cz - sz),
               (cx + sx, cy + sy, cz - sz), (cx - sx, cy + sy, cz - sz)]
        high = [(cx - sx * tx, cy - sy * ty, cz + sz), (cx + sx * tx, cy - sy * ty, cz + sz),
                (cx + sx * tx, cy + sy * ty, cz + sz), (cx - sx * tx, cy + sy * ty, cz + sz)]
        self._face(low, mask, centre)
        self._face(high, mask, centre)
        for i in range(4):
            j = (i + 1) % 4
            self._face([low[i], low[j], high[j], high[i]], mask, centre)

    def wheel(self, x, y, radius, width, segments=10):
        centre = (x, y, radius)
        # Start at the contact point so the tyre touches the ground exactly.
        angles = [i * math.tau / segments - math.pi / 2 for i in range(segments)]
        ring = [(y + radius * math.cos(angle), radius + radius * math.sin(angle)) for angle in angles]
        inner = [(x - width / 2, ry, rz) for ry, rz in ring]
        outer = [(x + width / 2, ry, rz) for ry, rz in ring]
        self._face(inner, TRIM, centre)
        self._face(outer, TRIM, centre)
        for i in range(segments):
            j = (i + 1) % segments
            self._face([inner[i], inner[j], outer[j], outer[i]], TRIM, centre)

    def shell(self, profile, half_width, masks, centre):
        """Sweep a closed side profile of (y, z) points across the vehicle width.

        half_width(y, z) lets the body narrow towards the roof or the nose.
        masks[i] colours the surface strip from profile point i to i + 1.
        """
        left = [(-half_width(y, z), y, z) for y, z in profile]
        right = [(half_width(y, z), y, z) for y, z in profile]
        count = len(profile)
        for i in range(count):
            j = (i + 1) % count
            self._face([left[i], left[j], right[j], right[i]], masks[i], centre)
        self._face(left, BODY, centre)
        self._face(right, BODY, centre)

    def side_panels(self, outline, half_width, mask, centre):
        """Mirror a flat (y, z) outline onto both flanks, just proud of the shell."""
        for side in (-1, 1):
            self._face([(side * (half_width(y, z) + PROUD), y, z) for y, z in outline], mask, centre)

    def lamps(self, y, z_low, z_high, spans, mask, centre):
        for x_low, x_high in spans:
            self._face([(x_low, y, z_low), (x_high, y, z_low), (x_high, y, z_high), (x_low, y, z_high)],
                       mask, centre)

    def finish(self):
        bmesh.ops.triangulate(self.bm, faces=self.bm.faces[:])
        mesh = Mesh()
        for face in self.bm.faces:
            # Blender (x, y, z) to glTF (x, z, -y) is a rotation, so winding is preserved.
            points = [(v.co.x, v.co.z, -v.co.y) for v in face.verts]
            mesh.face(points, MASKS[face[self.mask]])
        self.bm.free()
        return mesh


def pair(inner, outer):
    return [(-outer, -inner), (inner, outer)]


def two_wheeler(width, length):
    b = Builder()
    centre = (0, 0, 0.6)
    half = length / 2
    axle = half - 0.27
    b.wheel(0, axle, 0.27, 0.11)
    b.wheel(0, -axle, 0.27, 0.11)
    frame = [(0.56, 0.42), (0.66, 0.96), (0.46, 0.97), (0.30, 0.74), (-0.08, 0.82),
             (-0.62, 0.80), (-0.90, 0.72), (-0.84, 0.52), (-0.34, 0.33), (0.30, 0.33)]
    b.shell(frame, lambda y, z: 0.13 if z > 0.7 else 0.10,
            [BODY, TRIM, BODY, BODY, TRIM, BODY, BODY, TRIM, TRIM, TRIM], centre)
    b.box((0, 0.54, 1.0), (width, 0.06, 0.05), TRIM)
    # Rider: legs, torso leaning forward, helmet.
    b.box((0, -0.02, 0.86), (0.36, 0.52, 0.16), TRIM)
    b.box((0, -0.20, 1.20), (0.40, 0.26, 0.56), TRIM, top_scale=(0.86, 0.8))
    b.box((0, -0.12, 1.60), (0.23, 0.26, 0.24), BODY, top_scale=(0.8, 0.8))
    b.lamps(0.668, 0.78, 0.92, [(-0.08, 0.08)], HEAD, centre)
    b.lamps(-0.905, 0.62, 0.74, [(-0.07, 0.07)], TAIL, centre)
    return b.finish()


def auto_rickshaw(width, length):
    b = Builder()
    centre = (0, 0, 0.9)
    half, side = length / 2, width / 2
    nose = half - 0.02

    def body(y, z):
        taper = max(0.0, (y - 0.55) / (nose - 0.55))
        base = side - 0.02 - taper * 0.30
        return base * (0.93 if z > 1.5 else 1.0)

    profile = [(nose, 0.34), (nose, 0.64), (nose - 0.20, 0.98), (nose - 0.32, 1.02),
               (nose - 0.62, 1.70), (-half + 0.30, 1.74), (-half + 0.02, 1.32),
               (-half + 0.02, 0.44), (-1.18, 0.30), (1.16, 0.30)]
    b.shell(profile, body, [BODY, BODY, BODY, GLASS, BODY, BODY, BODY, TRIM, TRIM, TRIM], centre)
    b.side_panels([(0.86, 0.98), (0.80, 1.62), (-0.62, 1.64), (-0.62, 0.98)], body, TRIM, centre)
    b.wheel(0, nose - 0.36, 0.23, 0.12)
    for x in (-side + 0.11, side - 0.11):
        b.wheel(x, -half + 0.62, 0.24, 0.16)
    b.box((0, 0.82, 1.80), (0.34, 0.12, 0.09), SIGN)
    b.lamps(nose + PROUD, 0.70, 0.86, [(-0.11, 0.11)], HEAD, centre)
    b.lamps(-half + 0.02 - PROUD, 0.62, 0.76, pair(0.34, 0.56), TAIL, centre)
    return b.finish()


def car(width, length):
    b = Builder()
    centre = (0, 0, 0.7)
    half, side = length / 2, width / 2

    def body(y, z):
        return side if z <= 0.93 else side - (z - 0.93) * 0.30

    profile = [(half - 0.03, 0.30), (half - 0.01, 0.56), (half - 0.09, 0.79), (1.02, 0.93),
               (0.34, 1.43), (-1.06, 1.45), (-1.92, 1.00), (-half + 0.01, 0.82),
               (-half + 0.04, 0.30)]
    b.shell(profile, body, [BODY, BODY, BODY, GLASS, BODY, GLASS, BODY, BODY, TRIM], centre)
    b.side_panels([(0.92, 0.96), (0.36, 1.37), (-1.02, 1.39), (-1.72, 1.00)], body, GLASS, centre)
    for y in (1.32, -1.30):
        for x in (-side + 0.10, side - 0.10):
            b.wheel(x, y, 0.30, 0.20)
    b.lamps(half - 0.01 + PROUD, 0.60, 0.74, pair(0.42, 0.78), HEAD, centre)
    b.lamps(-half + 0.01 - PROUD, 0.70, 0.84, pair(0.42, 0.78), TAIL, centre)
    return b.finish()


def light_commercial(width, length):
    b = Builder()
    centre = (0, 0, 1.0)
    half, side = length / 2, width / 2
    cab_back = 1.28

    def cab(y, z):
        return side - 0.03 if z <= 1.15 else side - 0.03 - (z - 1.15) * 0.12

    profile = [(half - 0.01, 0.42), (half - 0.01, 0.98), (half - 0.12, 1.10), (half - 0.48, 1.86),
               (cab_back + 0.08, 1.92), (cab_back, 1.86), (cab_back, 0.42)]
    b.shell(profile, cab, [BODY, BODY, GLASS, BODY, BODY, BODY, TRIM], centre)
    b.side_panels([(half - 0.62, 1.16), (half - 0.80, 1.74), (cab_back + 0.14, 1.76),
                   (cab_back + 0.14, 1.16)], cab, GLASS, centre)
    # Chassis rail and the covered load body.
    b.box((0, (cab_back - half) / 2, 0.58), (width - 0.36, cab_back + half, 0.34), TRIM)
    b.box((0, (cab_back - 0.06 - half) / 2 + 0.01, 1.40), (width, cab_back - 0.08 + half, 1.30), BODY,
          top_scale=(0.97, 0.99))
    for y in (half - 0.92, -half + 1.02):
        for x in (-side + 0.13, side - 0.13):
            b.wheel(x, y, 0.36, 0.24)
    b.lamps(half - 0.01 + PROUD, 0.64, 0.80, pair(0.52, 0.90), HEAD, centre)
    b.lamps(-half - PROUD, 0.80, 0.96, pair(0.60, 0.92), TAIL, centre)
    return b.finish()


def bus(width, length):
    b = Builder()
    centre = (0, 0, 1.7)
    half, side = length / 2, width / 2

    def body(y, z):
        return side if z <= 2.9 else side - 0.10

    profile = [(half - 0.01, 0.46), (half - 0.01, 1.26), (half - 0.07, 2.70), (half - 0.20, 3.10),
               (-half + 0.12, 3.10), (-half + 0.01, 2.92), (-half + 0.01, 0.46)]
    b.shell(profile, body, [BODY, GLASS, BODY, BODY, BODY, BODY, TRIM], centre)
    b.side_panels([(half - 0.55, 1.52), (half - 0.55, 2.46), (-half + 0.50, 2.46),
                   (-half + 0.50, 1.52)], body, GLASS, centre)
    for y in (half - 1.90, -half + 2.30):
        for x in (-side + 0.17, side - 0.17):
            b.wheel(x, y, 0.48, 0.32)
    front = half - 0.01 + PROUD
    b.lamps(front, 2.74, 2.96, [(-0.78, 0.78)], SIGN, centre)
    b.lamps(front, 0.66, 0.86, pair(0.66, 1.10), HEAD, centre)
    b.lamps(-half + 0.01 - PROUD, 0.86, 1.08, pair(0.70, 1.10), TAIL, centre)
    return b.finish()


def ambulance(width, length):
    b = Builder()
    centre = (0, 0, 1.2)
    half, side = length / 2, width / 2

    def body(y, z):
        return side if z <= 1.25 else side - (z - 1.25) * 0.07

    profile = [(half - 0.01, 0.40), (half - 0.01, 0.96), (half - 0.20, 1.16), (half - 0.70, 1.26),
               (half - 1.22, 2.22), (-half + 0.08, 2.32), (-half + 0.01, 2.22), (-half + 0.01, 0.40)]
    b.shell(profile, body, [BODY, BODY, BODY, GLASS, BODY, BODY, BODY, TRIM], centre)
    b.side_panels([(half - 0.80, 1.30), (half - 1.24, 2.06), (half - 2.06, 2.08),
                   (half - 2.06, 1.30)], body, GLASS, centre)
    for y in (half - 0.95, -half + 1.05):
        for x in (-side + 0.13, side - 0.13):
            b.wheel(x, y, 0.36, 0.24)
    b.box((0, half - 1.55, 2.37), (1.16, 0.26, 0.15), SIGN)
    b.lamps(half - 0.01 + PROUD, 0.64, 0.80, pair(0.52, 0.90), HEAD, centre)
    b.lamps(-half + 0.01 - PROUD, 0.84, 1.02, pair(0.60, 0.92), TAIL, centre)
    return b.finish()


MODELS = {
    "twowheeler": two_wheeler,
    "auto": auto_rickshaw,
    "car": car,
    "lcv": light_commercial,
    "bus": bus,
    "ambulance": ambulance,
}


def main():
    export = REPO / "assets/export"
    export.mkdir(parents=True, exist_ok=True)
    dimensions = json.loads((REPO / "packages/sim/src/vehicle-dimensions.json").read_text("utf-8"))
    for spec in dimensions:
        slug = SLUGS[spec["id"]]
        mesh = MODELS[slug](spec["width"], spec["length"])
        axes = list(zip(*mesh.positions))
        size = [max(axis) - min(axis) for axis in axes]
        export_glb(mesh, f"veh_{slug}")
        print(f"veh_{slug}: {len(mesh.indices) // 3} triangles, "
              f"{size[0]:.2f} m wide, {size[2]:.2f} m long, {size[1]:.2f} m tall")


if __name__ == "__main__":
    main()
