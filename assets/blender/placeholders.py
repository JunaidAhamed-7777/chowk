"""Export the six placeholder vehicles to raw glTF, with no Blender dependency."""

from itertools import chain
from pathlib import Path
import json
import math
import struct


REPO = Path(__file__).resolve().parents[2]
CLASSES = REPO / "packages/sim/src/vehicle-dimensions.json"
EXPORT = REPO / "assets/export"

BODY = (0, 0, 0)
TAIL = (1, 0, 0)
HEAD = (0, 1, 0)
SIGN = (0, 0, 1)

SLUGS = {
    "two-wheeler": "twowheeler",
    "auto-rickshaw": "auto",
    "car": "car",
    "light-commercial": "lcv",
    "bus": "bus",
    "ambulance": "ambulance",
}


def face_normal(a, b, c):
    u = tuple(end - start for start, end in zip(a, b))
    v = tuple(end - start for start, end in zip(a, c))
    cross = (u[1] * v[2] - u[2] * v[1],
             u[2] * v[0] - u[0] * v[2],
             u[0] * v[1] - u[1] * v[0])
    length = math.hypot(*cross)
    return tuple(component / length for component in cross)


def footprint(width, length, y, z):
    x, depth = width / 2, length / 2
    # The corner cuts give the body a readable highlight under grazing light.
    cut = min(width, length) * 0.15
    return [
        (-x + cut, y, z - depth), (x - cut, y, z - depth),
        (x, y, z - depth + cut), (x, y, z + depth - cut),
        (x - cut, y, z + depth), (-x + cut, y, z + depth),
        (-x, y, z + depth - cut), (-x, y, z - depth + cut),
    ]


class Mesh:
    def __init__(self):
        self.positions = []
        self.normals = []
        self.colors = []
        self.indices = []

    def face(self, points, mask=BODY):
        first = len(self.positions)
        self.positions.extend(points)
        self.normals.extend([face_normal(*points[:3])] * len(points))
        self.colors.extend([mask] * len(points))
        for i in range(1, len(points) - 1):
            self.indices.extend((first, first + i, first + i + 1))

    def frustum(self, width, length, base, roof, *, z=0, taper=1, mask=BODY):
        lower = footprint(width, length, base, z)
        upper = footprint(width * taper, length * taper, roof, z)
        self.face(lower, mask)
        self.face(upper[::-1], mask)
        for i in range(len(lower)):
            j = (i + 1) % len(lower)
            self.face([lower[i], upper[i], upper[j], lower[j]], mask)

    def wheel(self, x, z, radius, thickness):
        # Start at the tyre contact point so the exported model sits on y = 0.
        ring = [(radius * (1 - math.cos(i * math.tau / 8)),
                 z + radius * math.sin(i * math.tau / 8)) for i in range(8)]
        left = [(x - thickness / 2, y, t) for y, t in ring]
        right = [(x + thickness / 2, y, t) for y, t in ring]
        self.face(left)
        self.face(right[::-1])
        for i in range(len(left)):
            j = (i + 1) % len(left)
            self.face([left[i], right[i], right[j], left[j]])

    def lights(self, width, length, y, pair):
        for side in (-1, 1):
            mask = HEAD if side == -1 else TAIL
            z = side * length / 2
            for x in (-width * 0.24, width * 0.24) if pair else (0,):
                half = width * (0.115 if pair else 0.20)
                low, high = y - 0.045, y + 0.045
                # The top edge recedes so each light reads from the aerial camera.
                points = [
                    (x - half, low, z), (x + half, low, z),
                    (x + half, high, z - side * 0.04), (x - half, high, z - side * 0.04),
                ]
                self.face(points if side == 1 else points[::-1], mask)


def vehicle(slug, width, length):
    mesh = Mesh()
    compact_length = length - 0.08
    if slug == "twowheeler":
        for z in (-0.61, 0.61):
            mesh.wheel(0, z, 0.22, 0.15)
        mesh.frustum(width * 0.68, compact_length, 0.22, 0.70, taper=0.78)
        mesh.frustum(width, 0.28, 0.65, 0.88, z=-0.50, taper=0.87)
        mesh.frustum(0.36, 0.46, 0.57, 1.13, z=0.10, taper=0.77)
        mesh.frustum(0.24, 0.24, 1.06, 1.34, z=0.02, taper=0.82)
        mesh.lights(width, length, 0.54, pair=False)
        return mesh

    wheel_radius = 0.39 if slug == "bus" else 0.29
    for z in (-length * 0.32, length * 0.32):
        centres = (0,) if slug == "auto" and z < 0 else (-width * 0.39, width * 0.39)
        for x in centres:
            mesh.wheel(x, z, wheel_radius, width * 0.18)

    shoulder = {"auto": 0.87, "car": 0.93, "lcv": 0.98, "bus": 1.23, "ambulance": 1.21}[slug]
    mesh.frustum(width * 0.96, compact_length * 0.97, 0.26, 0.48)
    mesh.frustum(width, compact_length, 0.45, shoulder, taper=0.96)
    if slug == "auto":
        mesh.frustum(width * 0.87, length * 0.66, shoulder, 1.76, z=0.27, taper=0.83)
        mesh.frustum(0.31, 0.13, 1.74, 1.81, z=-0.32, mask=SIGN)
    elif slug == "car":
        mesh.frustum(width * 0.89, length * 0.61, shoulder, 1.49, z=0.16, taper=0.69)
    elif slug == "lcv":
        mesh.frustum(width * 0.93, length * 0.34, shoulder, 2.00, z=-1.45, taper=0.81)
        mesh.frustum(width * 0.87, length * 0.49, shoulder, 1.30, z=1.02)
    elif slug == "bus":
        mesh.frustum(width * 0.97, compact_length * 0.97, shoulder, 3.11, taper=0.98)
        mesh.frustum(width * 0.57, 0.09, 2.70, 2.89, z=-length * 0.472, mask=SIGN)
    else:
        mesh.frustum(width * 0.97, length * 0.85, shoulder, 2.50, z=0.31, taper=0.92)
        mesh.frustum(width * 0.72, 0.20, 2.49, 2.64, z=-1.59, mask=SIGN)

    mesh.lights(width, length, 0.63, pair=slug != "auto")
    return mesh


def export_glb(mesh, name):
    data = bytearray()
    views = []
    accessors = []

    def append(values, code, component, accessor_type, count, target):
        data.extend(bytes(-len(data) % 4))
        packed = struct.pack(f"<{len(values)}{code}", *values)
        views.append({"buffer": 0, "byteOffset": len(data), "byteLength": len(packed), "target": target})
        data.extend(packed)
        accessors.append({"bufferView": len(views) - 1, "componentType": component,
                          "count": count, "type": accessor_type})

    for attribute in (mesh.positions, mesh.normals, mesh.colors):
        append(list(chain.from_iterable(attribute)), "f", 5126, "VEC3", len(attribute), 34962)
    append(mesh.indices, "H", 5123, "SCALAR", len(mesh.indices), 34963)
    axes = list(zip(*mesh.positions))
    accessors[0].update(min=[min(axis) for axis in axes], max=[max(axis) for axis in axes])

    content = {
        "asset": {"version": "2.0", "generator": "CHOWK placeholder exporter"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"name": name, "mesh": 0}],
        "meshes": [{"name": name, "primitives": [{
            "attributes": {"POSITION": 0, "NORMAL": 1, "COLOR_0": 2},
            "indices": 3,
        }]}],
        "buffers": [{"byteLength": len(data)}],
        "bufferViews": views,
        "accessors": accessors,
    }
    json_data = json.dumps(content, separators=(",", ":")).encode()
    json_data += b" " * (-len(json_data) % 4)
    data.extend(bytes(-len(data) % 4))
    glb = struct.pack("<4sII", b"glTF", 2, 28 + len(json_data) + len(data))
    glb += struct.pack("<I4s", len(json_data), b"JSON") + json_data
    glb += struct.pack("<I4s", len(data), b"BIN\x00") + data
    (EXPORT / f"{name}.glb").write_bytes(glb)


def main():
    EXPORT.mkdir(parents=True, exist_ok=True)
    dimensions = json.loads(CLASSES.read_text(encoding="utf-8"))
    for spec in dimensions:
        slug = SLUGS[spec["id"]]
        name = f"veh_{slug}"
        export_glb(vehicle(slug, spec["width"], spec["length"]), name)
        print(f"Exported {name}.glb")


if __name__ == "__main__":
    main()
