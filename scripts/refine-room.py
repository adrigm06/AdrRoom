"""Build the detailed room from the projection source without replacing it.

Run with Blender in background mode; see README.md for the complete pipeline.
Geometry is authored in Blender's metres/Z-up coordinates. The original object
names of the monitor, robot shell, eyes and animated jaw are runtime contracts.
"""

import json
import math
import random
import runpy
from collections import defaultdict
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector


ROOT = Path(__file__).resolve().parent.parent
SOURCE = Path(bpy.data.filepath).resolve()
OUTPUT = SOURCE.with_name("AdrRoom_Office_Detailed.blend")
TEXTURES = SOURCE.parent / "textures"
CAPTURES = ROOT / "captures"
SEED = 2718
RNG = random.Random(SEED)
REVISION = "detailed-room-v2"
CHAIR_CENTER = Vector((-1.25, -0.35, 0))
# The chair's modeled front is -Y. Rotate that direction toward the monitor.
CHAIR_YAW = math.atan2(-CHAIR_CENTER.x, CHAIR_CENTER.y - 1.45)
CREATED = []
REMOVED = []

if not SOURCE.exists() or SOURCE == OUTPUT:
    raise RuntimeError("Open the projection source, not an already-refined file")
if bpy.context.scene.get("visual_refinement"):
    raise RuntimeError("This scene is already refined; rebuild from the projection source")
if bpy.data.actions.get("AN_Robot_Mouth_Projection") is None:
    raise RuntimeError("The projection-mouth action is required before refinement")

TEXTURES.mkdir(parents=True, exist_ok=True)
CAPTURES.mkdir(parents=True, exist_ok=True)
COLLECTION = bpy.data.collections.new("COL_Detailed_Room")
bpy.context.scene.collection.children.link(COLLECTION)


def enum_value(owner, prop, value):
    """Validate identifiers against the connected Blender, not another version."""
    choices = {item.identifier for item in owner.bl_rna.properties[prop].enum_items}
    if value not in choices:
        raise RuntimeError(f"{prop}={value!r} is unavailable: {sorted(choices)}")
    return value


def finish(obj, material=None):
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    COLLECTION.objects.link(obj)
    if material:
        obj.data.materials.append(material)
    obj["visual_refinement"] = REVISION
    CREATED.append(obj.name)
    return obj


def material(name, color, roughness=0.5, metallic=0.0, emission=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    node = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    node.inputs["Base Color"].default_value = (*color, 1)
    node.inputs["Roughness"].default_value = roughness
    node.inputs["Metallic"].default_value = metallic
    if emission:
        node.inputs["Emission Color"].default_value = (*emission, 1)
        node.inputs["Emission Strength"].default_value = 0.8
    # Also make solid/material previews useful; shader inputs remain authoritative.
    mat.diffuse_color = (*color, 1)
    return mat


def existing_material(name):
    mat = bpy.data.materials.get(name)
    if mat is None:
        raise RuntimeError(f"Required source material missing: {name}")
    return mat


def remove_names(names):
    for name in names:
        obj = bpy.data.objects.get(name)
        if obj:
            REMOVED.append(name)
            bpy.data.objects.remove(obj, do_unlink=True)


def remove_prefix(prefix):
    remove_names([o.name for o in bpy.context.scene.objects if o.name.startswith(prefix)])


def mesh(name, vertices, faces, mat, smooth=True):
    data = bpy.data.meshes.new(name + " mesh")
    data.from_pydata(vertices, [], faces)
    if data.validate():
        raise RuntimeError(f"Invalid generated geometry: {name}")
    data.update()
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(data)
    bm.free()
    for polygon in data.polygons:
        polygon.use_smooth = smooth
    obj = bpy.data.objects.new(name, data)
    COLLECTION.objects.link(obj)
    obj.data.materials.append(mat)
    obj["visual_refinement"] = REVISION
    CREATED.append(name)
    return obj


def bevel(obj, width, segments=3):
    mod = obj.modifiers.new("Manufactured edge radius", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = enum_value(mod, "limit_method", "ANGLE")
    mod.harden_normals = True
    normals = obj.modifiers.new("Area weighted corner normals", "WEIGHTED_NORMAL")
    normals.keep_sharp = True
    return obj


def box(name, center, size, mat, radius=0.006, segments=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(obj, mat)
    if radius:
        bevel(obj, min(radius, min(size) * 0.46), segments)
    return obj


def sphere(name, center, size, mat, segments=32, rings=20):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments, ring_count=rings, radius=1, location=center,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = Vector(size) * 0.5
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for face in obj.data.polygons:
        face.use_smooth = True
    return finish(obj, mat)


def tube(name, points, radii, mat, sides=10):
    points = [Vector(point) for point in points]
    vertices = []
    for index, point in enumerate(points):
        tangent = points[min(index + 1, len(points) - 1)] - points[max(index - 1, 0)]
        tangent.normalize()
        ref = Vector((0, 0, 1)) if abs(tangent.z) < 0.9 else Vector((0, 1, 0))
        u = tangent.cross(ref).normalized()
        v = tangent.cross(u).normalized()
        for side in range(sides):
            angle = side * math.tau / sides
            offset = (u * math.cos(angle) + v * math.sin(angle)) * radii[index]
            vertices.append(tuple(point + offset))
    faces = []
    for ring in range(len(points) - 1):
        for side in range(sides):
            a = ring * sides + side
            b = ring * sides + (side + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces += [tuple(reversed(range(sides))),
              tuple((len(points) - 1) * sides + i for i in range(sides))]
    return mesh(name, vertices, faces, mat)


def lathe(name, center, profile, mat, segments=48):
    # The closed section never touches the axis; caps are explicit manifold ngons.
    vertices = [
        (center[0] + radius * math.cos(i * math.tau / segments),
         center[1] + radius * math.sin(i * math.tau / segments),
         center[2] + z)
        for radius, z in profile for i in range(segments)
    ]
    faces = []
    for ring in range(len(profile) - 1):
        for i in range(segments):
            a, b = ring * segments + i, ring * segments + (i + 1) % segments
            faces.append((a, b, b + segments, a + segments))
    faces += [tuple(reversed(range(segments))),
              tuple((len(profile) - 1) * segments + i for i in range(segments))]
    return mesh(name, vertices, faces, mat)


def ring_points(width, depth, radius, corner_steps=8):
    points = []
    for x, y, start in (
        (width / 2 - radius, depth / 2 - radius, 0),
        (-width / 2 + radius, depth / 2 - radius, 90),
        (-width / 2 + radius, -depth / 2 + radius, 180),
        (width / 2 - radius, -depth / 2 + radius, 270),
    ):
        for step in range(corner_steps):
            angle = math.radians(start + step * 90 / corner_steps)
            points.append((x + radius * math.cos(angle), y + radius * math.sin(angle)))
    return points


def cushion(name, rings, mat):
    # Each ring: z, centre-y, width, depth, corner-radius.
    vertices = []
    count = 32
    for z, y, width, depth, radius in rings:
        vertices.extend((x, py + y, z) for x, py in ring_points(width, depth, radius))
    faces = []
    for ring in range(len(rings) - 1):
        for side in range(count):
            a, b = ring * count + side, ring * count + (side + 1) % count
            faces.append((a, b, b + count, a + count))
    faces += [tuple(reversed(range(count))),
              tuple((len(rings) - 1) * count + i for i in range(count))]
    return mesh(name, vertices, faces, mat)


def visor_panel(name, center, width, height, depth, radius, mat):
    outline = ring_points(width, height, radius, corner_steps=12)
    count = len(outline)
    vertices = [(x + center[0], center[1] + y, z + center[2])
                for y in (-depth / 2, depth / 2) for x, z in outline]
    faces = [(i, (i + 1) % count, (i + 1) % count + count, i + count)
             for i in range(count)]
    faces += [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    obj = mesh(name, vertices, faces, mat, smooth=False)
    bevel(obj, 0.0014, 3)
    return obj


def planar_uv(obj, scale=(1, 1, 1)):
    uv = obj.data.uv_layers.new(name="UVMap")
    for face in obj.data.polygons:
        normal = face.normal
        axis = max(range(3), key=lambda i: abs(normal[i]))
        axes = (0, 1) if axis == 2 else ((0, 2) if axis == 1 else (1, 2))
        for loop_index in face.loop_indices:
            vertex = obj.matrix_world @ obj.data.vertices[obj.data.loops[loop_index].vertex_index].co
            uv.data[loop_index].uv = (
                vertex[axes[0]] * scale[axes[0]],
                vertex[axes[1]] * scale[axes[1]],
            )


def image_material(mat, image_name, pixels, size):
    image = bpy.data.images.new(image_name, width=size, height=size, alpha=False)
    rgba = np.ones((size, size, 4), dtype=np.float32)
    rgba[:, :, :3] = np.clip(pixels, 0, 1)
    image.pixels.foreach_set(rgba.ravel())
    image.filepath_raw = str(TEXTURES / (image_name + ".png"))
    image.file_format = enum_value(image, "file_format", "PNG")
    image.save()
    image.pack()
    shader = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = image
    mat.node_tree.links.new(tex.outputs["Color"], shader.inputs["Base Color"])
    return mat


def consolidate(prefix, keep=()):
    """Join static detail by material; do not touch named animated/runtime nodes."""
    groups = defaultdict(list)
    for obj in list(COLLECTION.objects):
        if obj.type == "MESH" and obj.name.startswith(prefix) and obj.name not in keep:
            if obj.animation_data or obj.parent or len(obj.data.materials) != 1:
                continue
            groups[obj.data.materials[0].name].append(obj)
    for index, objects in enumerate(groups.values()):
        if len(objects) < 2:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            for mod in list(obj.modifiers):
                bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        objects[0].name = f"{prefix} assembly {index:02d}"


BLACK = existing_material("MAT_Metal | satin black")
CERAMIC = existing_material("MAT_Ceramic | warm stone")
CYAN = existing_material("MAT_Robot | cyan eye glow")
BRONZE = material("MAT_Detail | brushed champagne", (0.25, 0.16, 0.074), 0.34, 0.78)
RUBBER = material("MAT_Detail | soft charcoal rubber", (0.014, 0.019, 0.019), 0.78)
ALLOY = material("MAT_Detail | graphite alloy", (0.055, 0.073, 0.08), 0.34, 0.76)
SOIL = material("MAT_Detail | moist potting soil", (0.035, 0.019, 0.009), 0.98)
BARK = material("MAT_Detail | ficus bark", (0.19, 0.105, 0.043), 0.87)
VEIN = material("MAT_Detail | leaf midrib", (0.105, 0.18, 0.047), 0.64)
FOLIAGE = [
    material("MAT_Detail | foliage mature", (0.022, 0.105, 0.037), 0.47),
    material("MAT_Detail | foliage green", (0.047, 0.165, 0.052), 0.49),
    material("MAT_Detail | foliage young", (0.14, 0.255, 0.061), 0.52),
]
WALNUT = material("MAT_Wood | detailed walnut grain", (0.22, 0.105, 0.045), 0.53)
FABRIC = material("MAT_Detail | woven graphite upholstery", (0.045, 0.060, 0.06), 0.87)
GLINT = material("MAT_Detail | optical glint", (0.68, 0.9, 0.98), 0.2,
                 emission=(0.68, 0.9, 0.98))
next(n for n in GLINT.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Emission Strength"].default_value = 4

# Real glTF image textures, not unsupported procedural shader networks.
size = 512
yy, xx = np.mgrid[0:size, 0:size].astype(np.float32) / size
noise = np.random.default_rng(SEED).normal(0, 0.016, (size, size))
warp = yy + 0.012 * np.sin(xx * math.tau * 3) + 0.004 * np.sin(xx * math.tau * 11)
grain = (
    0.10 * np.sin(warp * math.tau * 27)
    + 0.035 * np.sin(warp * math.tau * 93)
    + 0.018 * np.sin(warp * math.tau * 211)
    + noise
)
wood_pixels = np.stack((
    0.36 + grain * 0.52,
    0.225 + grain * 0.35,
    0.126 + grain * 0.22,
), axis=-1)
image_material(WALNUT, "walnut-grain", wood_pixels, size)
size = 128
yy, xx = np.mgrid[0:size, 0:size]
weave = 0.018 * np.cos(xx * math.tau / 8) + 0.014 * np.cos(yy * math.tau / 8)
thread = 0.006 * ((xx + yy) % 3)
image_material(FABRIC, "graphite-weave", np.stack((
    0.105 + weave + thread, 0.13 + weave + thread, 0.134 + weave + thread,
), axis=-1), size)


def repair_structure():
    for name in ("Ceiling reveal | side", "Ceiling reveal | side.001"):
        obj = bpy.data.objects[name]
        sign = 1 if obj.location.x > 0 else -1
        # Entirely inside the wall's inner face, with a distinct, recessed top.
        obj.location.x = sign * 3.355
        obj.location.y = -0.075
        obj.location.z = 2.774
        obj.dimensions = (0.10, 4.59, 0.024)
        for mod in obj.modifiers:
            if mod.type == "BEVEL":
                mod.width = 0.003
                mod.segments = 3
        obj["join_clearance_m"] = 0.015
    # Keep the end of each side cornice in front of the back cornice.
    for name in ("Crown trim | side", "Crown trim | side.001"):
        obj = bpy.data.objects[name]
        obj.location.y = -0.045
        obj.dimensions.y = 4.45
    # The web renderer supplies a single preview/HTML display. Retire the
    # redundant physical wallpaper/display surfaces instead of masking them.
    remove_names(("Monitor | wallpaper landscape", "Monitor | active display"))
    # Replace the old solid front slab with a real annular bezel. No large
    # triangulated front polygon can leak through the HTML/preview screen.
    remove_names(("Monitor | bezel",))
    outer = ring_points(1.10, 0.65, 0.027)
    inner = ring_points(1.018, 0.568, 0.009)
    vertices = []
    for y, contour in ((1.385, outer), (1.385, inner), (1.491, outer), (1.491, inner)):
        vertices.extend((x, y, z + 1.56) for x, z in contour)
    faces = []
    for index in range(32):
        nxt = (index + 1) % 32
        faces.extend((
            (index, nxt, nxt + 32, index + 32),
            (index + 64, index + 96, nxt + 96, nxt + 64),
            (index, index + 64, nxt + 64, nxt),
            (index + 32, nxt + 32, nxt + 96, index + 96),
        ))
    bezel = mesh("Monitor | bezel", vertices, faces, BLACK, smooth=False)
    bevel(bezel, 0.002, 3)
    box("Monitor detail | recessed display backing", (0, 1.414, 1.56),
        (1.027, 0.018, 0.576), RUBBER, 0.008)
    for x in (-0.47, 0.47):
        sphere("Monitor detail | lower screw", (x, 1.367, 1.245),
               (0.009, 0.004, 0.009), ALLOY, 12, 8)
    sphere("Monitor detail | power indicator", (0.485, 1.366, 1.243),
           (0.006, 0.003, 0.006), CYAN, 12, 8)


def refine_desk():
    top = bpy.data.objects["Desk | main walnut top"]
    top.data.materials.clear()
    top.data.materials.append(WALNUT)
    planar_uv(top, (0.42, 1.8, 2))
    for mod in top.modifiers:
        if mod.type == "BEVEL":
            mod.width = 0.018
            mod.segments = 5
    for obj in bpy.context.scene.objects:
        if obj.name.startswith(("Desk | drawer front", "Desk | pedestal carcass",
                                "Desk | drawer inset", "Desk | modesty panel")):
            obj.data.materials.clear()
            obj.data.materials.append(WALNUT)
            planar_uv(obj, (0.65, 1.8, 2.8))
    # Construction that reads from the room's low/front camera.
    for x in (-1.16, 1.16):
        box("Desk detail | top support rail", (x, 1.225, 0.708),
            (0.046, 0.68, 0.066), ALLOY, 0.009)
        for y in (0.94, 1.51):
            box("Desk detail | fixing bracket", (x, y, 0.733),
                (0.09, 0.072, 0.018), ALLOY, 0.004)
    box("Desk detail | rear frame rail", (0, 1.52, 0.69),
        (2.42, 0.045, 0.072), ALLOY, 0.008)
    for x in (-1.58, 1.58):
        box("Desk detail | pedestal plinth", (x, 1.22, 0.076),
            (0.63, 0.61, 0.072), RUBBER, 0.014)
        for z in (0.19, 0.395, 0.60):
            # A handle is a bridge held on two feet, not a floating gold bar.
            for dx in (-0.072, 0.072):
                box("Desk detail | handle standoff", (x + dx, 0.837, z + 0.035),
                    (0.018, 0.025, 0.018), BRONZE, 0.004)
    # Cable grommets with a small visible inset, avoiding the desk screen/robot.
    for x in (-0.95, 1.75):
        lathe("Desk detail | cable grommet", (x, 1.49, 0.833),
              [(0.033, 0), (0.039, 0.002), (0.039, 0.006),
               (0.027, 0.006), (0.027, 0.002)], ALLOY, 32)
        box("Desk detail | cable brush", (x, 1.49, 0.835),
            (0.045, 0.014, 0.004), RUBBER, 0.001)
    # One small support under the monitor, grounded onto the tabletop.
    box("Desk detail | monitor riser", (0, 1.40, 0.861),
        (0.46, 0.27, 0.054), ALLOY, 0.012)
    for x in (-0.18, 0.18):
        box("Desk detail | monitor riser pad", (x, 1.4, 0.838),
            (0.046, 0.19, 0.008), RUBBER, 0.003)
    consolidate("Desk detail |")


def refine_chair():
    remove_prefix("Chair |")
    # Articulated five-star base with twin wheels, rotating forks and hubs.
    lathe("Chair detail | gas lift", (0, 0.2, 0),
          [(0.061, 0.14), (0.061, 0.24), (0.036, 0.26),
           (0.036, 0.46), (0.026, 0.48), (0.026, 0.56)], ALLOY, 32)
    lathe("Chair detail | piston boot", (0, 0.2, 0),
          [(0.067, 0.22), (0.067, 0.32), (0.053, 0.34),
           (0.053, 0.43)], RUBBER, 32)
    for i in range(5):
        angle = i * math.tau / 5 + 0.12
        direction = Vector((math.cos(angle), math.sin(angle), 0))
        origin = Vector((0, 0.2, 0))
        points = [origin + direction * r + Vector((0, 0, z))
                  for r, z in ((0.02, 0.21), (0.13, 0.185), (0.29, 0.135), (0.41, 0.115))]
        tube("Chair detail | tapered star spoke", points,
             [0.039, 0.034, 0.024, 0.018], ALLOY, 12)
        wheel_center = origin + direction * 0.42
        tube("Chair detail | castor pivot",
             [wheel_center + Vector((0, 0, 0.12)), wheel_center + Vector((0, 0, 0.073))],
             [0.017, 0.017], ALLOY, 12)
        box("Chair detail | castor fork",
            (wheel_center.x, wheel_center.y, 0.079), (0.080, 0.052, 0.057), BLACK, 0.018)
        for side in (-1, 1):
            wheel = lathe("Chair detail | twin caster tire", (0, 0, 0),
                          [(0.016, -0.014), (0.046, -0.014), (0.054, -0.009),
                           (0.054, 0.009), (0.046, 0.014), (0.016, 0.014)], RUBBER, 28)
            wheel.rotation_euler.x = math.pi / 2
            wheel.location = (wheel_center.x, wheel_center.y + side * 0.032, 0.056)
            hub = sphere("Chair detail | wheel hub",
                         (wheel_center.x, wheel_center.y + side * 0.047, 0.056),
                         (0.036, 0.006, 0.036), ALLOY, 16, 10)
    cushion("Chair detail | underseat pan", [
        (0.535, 0.17, 0.36, 0.34, 0.07),
        (0.57, 0.17, 0.49, 0.43, 0.08),
        (0.605, 0.16, 0.51, 0.45, 0.09),
    ], ALLOY)
    seat = cushion("Chair detail | contoured seat", [
        (0.586, 0.16, 0.46, 0.41, 0.10),
        (0.605, 0.16, 0.53, 0.49, 0.105),
        (0.66, 0.145, 0.56, 0.52, 0.105),
        (0.701, 0.145, 0.53, 0.49, 0.105),
        (0.716, 0.16, 0.43, 0.38, 0.10),
    ], FABRIC)
    planar_uv(seat, (5, 5, 5))
    # Continuous piping follows the actual seat edge.
    points = [(x, y + 0.145, 0.681) for x, y in ring_points(0.546, 0.505, 0.105)]
    tube("Chair detail | stitched seat piping", points + [points[0]],
         [0.003] * (len(points) + 1), ALLOY, 6)
    # Curved ergonomic side ribs, not a rectangular slab.
    for side in (-1, 1):
        path = [(side * x, y, z) for x, y, z in (
            (0.17, 0.38, 0.61), (0.21, 0.40, 0.79),
            (0.23, 0.36, 1.01), (0.225, 0.41, 1.24),
            (0.21, 0.49, 1.48), (0.18, 0.50, 1.61),
        )]
        tube("Chair detail | sculpted back frame", path,
             [0.025, 0.025, 0.025, 0.023, 0.022, 0.021], ALLOY, 12)
    for z, y, width in ((0.80, 0.39, 0.39), (1.61, 0.5, 0.36)):
        tube("Chair detail | back frame crosspiece",
             [(-width / 2, y, z), (0, y + 0.012, z + 0.015), (width / 2, y, z)],
             [0.022] * 3, ALLOY, 12)
    vertices, faces = [], []
    nx, nz = 20, 28
    for layer in (-1, 1):
        for iz in range(nz + 1):
            t = iz / nz
            z = 0.80 + t * 0.78
            width = 0.185 + 0.022 * math.sin(t * math.pi)
            for ix in range(nx + 1):
                u = ix / nx * 2 - 1
                y = 0.37 + 0.13 * t - 0.085 * math.sin(t * math.pi)
                y += 0.026 * u * u + layer * 0.004
                vertices.append((u * width, y, z))
    layer_size = (nx + 1) * (nz + 1)
    for layer in range(2):
        for iz in range(nz):
            for ix in range(nx):
                a = layer * layer_size + iz * (nx + 1) + ix
                faces.append((a, a + 1, a + nx + 2, a + nx + 1))
    edge = list(range(nx + 1))
    edge += [iz * (nx + 1) + nx for iz in range(1, nz + 1)]
    edge += [nz * (nx + 1) + ix for ix in range(nx - 1, -1, -1)]
    edge += [iz * (nx + 1) for iz in range(nz - 1, 0, -1)]
    for a, b in zip(edge, edge[1:] + edge[:1]):
        faces.append((a, b, b + layer_size, a + layer_size))
    back = mesh("Chair detail | tensioned curved back", vertices, faces, FABRIC)
    planar_uv(back, (6, 6, 6))
    lumbar = sphere("Chair detail | shaped lumbar pad", (0, 0.304, 1.045),
                    (0.34, 0.085, 0.15), FABRIC, 32, 16)
    planar_uv(lumbar, (5, 5, 5))
    for x in (-0.09, 0.09):
        tube("Chair detail | adjustable headrest post",
             [(x, 0.50, 1.53), (x, 0.52, 1.68), (x, 0.47, 1.73)],
             [0.014] * 3, ALLOY, 10)
    head = sphere("Chair detail | curved headrest", (0, 0.46, 1.748),
                  (0.34, 0.14, 0.17), FABRIC, 40, 20)
    planar_uv(head, (5, 5, 5))
    for side in (-1, 1):
        tube("Chair detail | arm support",
             [(side * 0.20, 0.23, 0.56), (side * 0.285, 0.23, 0.66),
              (side * 0.30, 0.22, 0.89), (side * 0.30, 0.18, 0.945)],
             [0.023, 0.023, 0.019, 0.019], ALLOY, 12)
        pad = box("Chair detail | soft armrest", (side * 0.31, 0.16, 0.965),
                  (0.115, 0.31, 0.052), RUBBER, 0.024, 5)
        box("Chair detail | arm height button", (side * 0.31, 0.10, 0.926),
            (0.06, 0.032, 0.018), ALLOY, 0.006)
    tube("Chair detail | tilt adjustment lever",
         [(0.16, 0.17, 0.55), (0.32, 0.13, 0.53), (0.36, 0.10, 0.55)],
         [0.009, 0.009, 0.014], BLACK, 10)
    consolidate("Chair detail |")
    # Tires rest on the rug's actual upper face (Z=.0525), not inside it.
    for obj in COLLECTION.objects:
        if obj.name.startswith("Chair detail |"):
            obj.location.z += 0.0505


def place_chair():
    bpy.context.view_layer.update()
    placement = (
        Matrix.Translation(CHAIR_CENTER)
        @ Matrix.Rotation(CHAIR_YAW, 4, "Z")
        @ Matrix.Translation(Vector((0, -0.2, 0)))
    )
    for obj in COLLECTION.objects:
        if obj.name.startswith("Chair detail |"):
            obj.matrix_world = placement @ obj.matrix_world


def replace_sphere(name, center, dimensions, mat, segments=48, rings=28):
    remove_names((name,))
    return sphere(name, center, dimensions, mat, segments, rings)


def refine_robot():
    shell = replace_sphere("Robot pet | rounded shell", (0.76, 1.47, 0.985),
                           (0.34, 0.27, 0.27), CERAMIC, 48, 28)
    # A soft superellipse reads as a manufactured enclosure rather than a ball.
    for vertex in shell.data.vertices:
        for axis, half in enumerate((0.17, 0.135, 0.135)):
            value = vertex.co[axis] / half
            vertex.co[axis] = math.copysign(abs(value) ** 0.80, value) * half
    shell.data.update()
    remove_names(("Robot pet | face screen",))
    # Nested, depth-separated panels replace intersecting ellipsoids. The black
    # gasket is behind the screen, and both clear the ceramic shell at the front.
    visor_panel("Robot detail | visor gasket", (0.76, 1.329, 0.985),
                0.250, 0.164, 0.022, 0.052, RUBBER)
    visor_panel("Robot pet | face screen", (0.76, 1.313, 0.985),
                0.230, 0.144, 0.012, 0.047, BLACK)
    for name, x in (("Robot pet | eye", 0.715), ("Robot pet | eye.001", 0.805)):
        eye = replace_sphere(name, (x, 1.304, 1.0), (0.036, 0.018, 0.048), CYAN, 24, 16)
        highlight = sphere("Robot detail | optical highlight", (0, 0, 0),
                           (0.007, 0.004, 0.009), GLINT, 12, 8)
        highlight.parent = eye
        highlight.location = (-0.004, -0.011, 0.011)
    remove_prefix("Robot pet | foot")
    for side in (-1, 1):
        x = 0.76 + side * 0.087
        sphere("Robot detail | ankle joint", (x, 1.475, 0.864),
               (0.055, 0.056, 0.055), ALLOY, 24, 12)
        box("Robot detail | foot housing", (x, 1.455, 0.846),
            (0.066, 0.12, 0.028), CERAMIC, 0.012, 4)
        box("Robot detail | non-slip sole", (x, 1.455, 0.835),
            (0.060, 0.111, 0.008), RUBBER, 0.003)
        # Small ear/speaker with physical coaxial components.
        ear = lathe("Robot detail | speaker ear", (0, 0, 0),
                    [(0.008, -0.006), (0.043, -0.006), (0.049, 0),
                     (0.043, 0.011), (0.032, 0.014), (0.032, 0.010),
                     (0.008, 0.010)], ALLOY, 32)
        ear.rotation_euler.y = side * math.pi / 2
        ear.location = (0.76 + side * 0.170, 1.475, 0.991)
        for row in range(4):
            box("Robot detail | speaker grille",
                (0.76 + side * 0.187, 1.462 + row * 0.008, 0.991),
                (0.004, 0.003, 0.035 - abs(row - 1.5) * 0.004), RUBBER, 0.001)
    # A rear-half parting seam stays clear of the face and projection mouth.
    points = [(0.76 + 0.167 * math.cos(a), 1.47 + 0.132 * math.sin(a), 0.986)
              for a in [i * math.pi / 20 for i in range(21)]]
    tube("Robot detail | rear shell parting seam", points, [0.0018] * len(points), ALLOY, 6)
    panel = sphere("Robot detail | rear service panel", (0.76, 1.596, 0.982),
                   (0.18, 0.018, 0.135), ALLOY, 32, 20)
    for x in (0.70, 0.82):
        for z in (0.946, 1.02):
            sphere("Robot detail | captive screw", (x, 1.607, z),
                   (0.008, 0.004, 0.008), BRONZE, 12, 8)
    remove_names(("Robot pet | crown sensor",))
    lathe("Robot detail | crown sensor collar", (0.76, 1.47, 1.116),
          [(0.008, 0), (0.026, 0), (0.026, 0.012), (0.018, 0.015),
           (0.008, 0.015)], ALLOY, 28)
    sphere("Robot pet | crown sensor", (0.76, 1.47, 1.141),
           (0.031, 0.031, 0.026), CYAN, 24, 16)
    for name in ("Robot pet | projection aperture", "Robot pet | projection jaw"):
        for mod in bpy.data.objects[name].modifiers:
            if mod.type == "BEVEL":
                mod.segments = 5
    for name in (
        "Robot pet | projection aperture", "Robot pet | projection throat",
        "Robot pet | projection jaw", "Robot pet | jaw hinge left", "Robot pet | jaw hinge right",
    ):
        bpy.data.objects[name].location.y -= 0.020
    # Protect names consumed by the web hover, eye tracking and animation mixer.
    consolidate("Robot detail |")


def leaf(name, base, direction, length, width, mat, roll=0):
    # Closed, slightly cupped leaf with a tapered tip and a raised central vein.
    base = Vector(base)
    q = Vector(direction).normalized().to_track_quat("Z", "Y")
    vertices = []
    rows, cols = 10, 6
    for layer in (-1, 1):
        for row in range(rows + 1):
            t = row / rows
            half_width = width * 0.5 * max(0.025, math.sin(math.pi * t) ** 0.76)
            for col in range(cols + 1):
                u = col / cols * 2 - 1
                x = half_width * u
                y = length * (-0.17 * math.sin(math.pi * t) + 0.15 * u * u * math.sin(math.pi * t))
                y += layer * 0.00065
                z = length * t
                # Rotate around the stem axis to avoid identical leaf planes.
                v = Vector((x * math.cos(roll) - y * math.sin(roll),
                            x * math.sin(roll) + y * math.cos(roll), z))
                vertices.append(tuple(base + q @ v))
    layer_size = (rows + 1) * (cols + 1)
    faces = []
    for layer in range(2):
        for row in range(rows):
            for col in range(cols):
                a = layer * layer_size + row * (cols + 1) + col
                faces.append((a, a + 1, a + cols + 2, a + cols + 1))
    edge = list(range(cols + 1))
    edge += [row * (cols + 1) + cols for row in range(1, rows + 1)]
    edge += [rows * (cols + 1) + col for col in range(cols - 1, -1, -1)]
    edge += [row * (cols + 1) for row in range(rows - 1, 0, -1)]
    for a, b in zip(edge, edge[1:] + edge[:1]):
        faces.append((a, b, b + layer_size, a + layer_size))
    obj = mesh(name, vertices, faces, mat)
    vein = []
    for i in range(9):
        t = i / 8
        v = Vector((0, -length * 0.17 * math.sin(math.pi * t) - 0.001, length * t))
        v = Vector((-v.y * math.sin(roll), v.y * math.cos(roll), v.z))
        vein.append(base + q @ v)
    prefix = name.split("|")[0] + "| leaf midrib"
    tube(prefix, vein, [max(0.00045, length * 0.007 * (1 - i / 10)) for i in range(9)], VEIN, 5)
    return obj


def refine_floor_tree():
    remove_prefix("Plant |")
    lathe("Tree detail | ceramic planter", (3, -1.78, 0),
          [(0.174, 0.027), (0.205, 0.027), (0.213, 0.045),
           (0.232, 0.48), (0.243, 0.556), (0.242, 0.579),
           (0.229, 0.59), (0.214, 0.585), (0.211, 0.55),
           (0.195, 0.10), (0.174, 0.08)], CERAMIC, 64)
    lathe("Tree detail | planter foot", (3, -1.78, 0),
          [(0.14, 0.012), (0.18, 0.012), (0.18, 0.03), (0.14, 0.03)], RUBBER, 48)
    lathe("Tree detail | potting soil", (3, -1.78, 0),
          [(0.025, 0.539), (0.207, 0.539), (0.207, 0.55), (0.025, 0.555)], SOIL, 48)
    trunk = [(3.0, -1.78, 0.55), (2.985, -1.77, 0.89),
             (3.025, -1.75, 1.18), (2.98, -1.745, 1.49),
             (3.015, -1.72, 1.79), (2.99, -1.70, 2.07)]
    tube("Tree detail | tapered trunk", trunk, [0.036, 0.029, 0.023, 0.018, 0.012, 0.005], BARK, 14)
    # A few root flares emerge from, rather than float above, the soil.
    for i in range(5):
        a = i * math.tau / 5
        tube("Tree detail | root flare",
             [(3 + math.cos(a) * 0.10, -1.78 + math.sin(a) * 0.10, 0.551),
              (3 + math.cos(a) * 0.045, -1.78 + math.sin(a) * 0.045, 0.572),
              (3, -1.78, 0.64)], [0.008, 0.013, 0.02], BARK, 8)
    branches = [
        ((3.01, -1.75, 1.04), (2.59, -1.77, 1.52)),
        ((3.00, -1.75, 1.17), (3.27, -1.72, 1.65)),
        ((2.99, -1.75, 1.30), (2.89, -2.12, 1.78)),
        ((2.99, -1.74, 1.42), (2.65, -1.48, 1.91)),
        ((2.99, -1.73, 1.54), (3.26, -1.48, 2.00)),
        ((3.01, -1.72, 1.69), (2.87, -1.95, 2.12)),
        ((3.00, -1.71, 1.82), (3.16, -1.65, 2.23)),
        ((3.00, -1.71, 1.89), (2.76, -1.54, 2.25)),
    ]
    for index, (start, end) in enumerate(branches):
        start, end = Vector(start), Vector(end)
        middle = start.lerp(end, 0.48) + Vector((0, 0, 0.07))
        tube("Tree detail | woody branch", [start, middle, end],
             [0.013, 0.009, 0.0035], BARK, 10)
        axis = (end - start).normalized()
        for node in range(2, 7):
            t = node / 7
            p = start.lerp(end, t) + Vector((0, 0, math.sin(math.pi * t) * 0.06))
            for side in (-1, 1):
                angle = index * 1.6 + side * 0.85 + node * 0.65
                direction = Vector((math.cos(angle) * 0.64, math.sin(angle) * 0.72,
                                    RNG.uniform(0.35, 0.95)))
                # Keep every leaf clear of the right wall.
                if p.x > 3.18 and direction.x > 0:
                    direction.x *= -0.5
                petiole = p + direction.normalized() * 0.035
                tube("Tree detail | petiole", [p, petiole], [0.0024, 0.0014], BARK, 6)
                length = RNG.uniform(0.135, 0.215)
                leaf("Tree detail | curved ficus leaf", petiole, direction,
                     length, length * RNG.uniform(0.43, 0.58),
                     FOLIAGE[(index + node + (side == 1)) % 3], RNG.uniform(-0.85, 0.85))
        leaf("Tree detail | growing tip", end, axis, 0.105, 0.045, FOLIAGE[2], 0.2)
    for i in range(14):
        angle, radius = RNG.uniform(0, math.tau), RNG.uniform(0.055, 0.185)
        sphere("Tree detail | soil granule",
               (3 + math.cos(angle) * radius, -1.78 + math.sin(angle) * radius, 0.553),
               (0.012, 0.009, 0.006), BARK, 8, 6)
    consolidate("Tree detail |")


def refine_desk_plant():
    remove_prefix("Desk plant |")
    center = Vector((-1.45, 1.25, 0))
    lathe("Desk foliage | ceramic pot", center,
          [(0.072, 0.835), (0.09, 0.835), (0.104, 0.86),
           (0.118, 1.009), (0.117, 1.028), (0.107, 1.035),
           (0.101, 1.024), (0.098, 0.88), (0.072, 0.86)], CERAMIC, 48)
    lathe("Desk foliage | inset soil", center,
          [(0.015, 1.008), (0.098, 1.008), (0.098, 1.015), (0.015, 1.016)], SOIL, 40)
    lathe("Desk foliage | glazed pot lip", center,
          [(0.108, 1.018), (0.119, 1.018), (0.119, 1.028), (0.108, 1.029)], BRONZE, 48)
    for i in range(6):
        angle = i * math.tau / 6 + 0.24
        start = Vector((-1.45, 1.25, 1.013))
        radius = RNG.uniform(0.10, 0.18)
        end = start + Vector((math.cos(angle) * radius, math.sin(angle) * radius,
                              RNG.uniform(0.20, 0.34)))
        middle = start.lerp(end, 0.50) + Vector((0, 0, 0.028))
        tube("Desk foliage | curved stem", [start, middle, end],
             [0.0038, 0.003, 0.0015], VEIN, 8)
        for node in range(1, 4):
            t = node / 4
            p = start.lerp(end, t) + Vector((0, 0, math.sin(math.pi * t) * 0.025))
            direction = Vector((math.cos(angle + node * 1.1),
                                math.sin(angle + node * 1.1), RNG.uniform(0.15, 0.65)))
            leaf("Desk foliage | heart leaf", p, direction, RNG.uniform(0.085, 0.13),
                 RNG.uniform(0.050, 0.078), FOLIAGE[(i + node) % 3], RNG.uniform(-0.7, 0.7))
        leaf("Desk foliage | new leaf", end, end - middle, 0.066, 0.035, FOLIAGE[2], 0.4)
    consolidate("Desk foliage |")


def audit_and_save():
    scene = bpy.context.scene
    scene["visual_refinement"] = REVISION
    scene["visual_refinement_source"] = SOURCE.name
    scene.frame_set(1)
    evaluated = bpy.context.evaluated_depsgraph_get()
    stats = {}
    total_triangles = 0
    errors = []
    chair_ground = math.inf
    chair_right = -math.inf
    tree_right = -math.inf
    export_meshes = 0
    for obj in scene.objects:
        if obj.type != "MESH" or obj.name.startswith(("Exterior |", "Distant city |")):
            continue
        temp = obj.evaluated_get(evaluated).to_mesh()
        temp.calc_loop_triangles()
        count = len(temp.loop_triangles)
        total_triangles += count
        export_meshes += 1
        group = obj.name.split("|")[0].strip()
        stats[group] = stats.get(group, 0) + count
        if obj.get("visual_refinement"):
            if any(not math.isfinite(c) for v in temp.vertices for c in v.co):
                errors.append(f"Non-finite vertices: {obj.name}")
            bm = bmesh.new()
            bm.from_mesh(temp)
            boundary = sum(1 for edge in bm.edges if not edge.is_manifold)
            if boundary:
                errors.append(f"{obj.name}: {boundary} non-manifold edges")
            bm.free()
        if obj.name.startswith("Chair detail |"):
            chair_ground = min(chair_ground, min((obj.matrix_world @ v.co).z for v in temp.vertices))
            chair_right = max(chair_right, max((obj.matrix_world @ v.co).x for v in temp.vertices))
        if obj.name.startswith("Tree detail |"):
            tree_right = max(tree_right, max((obj.matrix_world @ v.co).x for v in temp.vertices))
        obj.evaluated_get(evaluated).to_mesh_clear()
    required = (
        "Monitor | bezel", "Robot pet | rounded shell", "Robot pet | face screen",
        "Robot pet | eye", "Robot pet | eye.001", "Robot pet | projection jaw",
    )
    for name in required:
        if bpy.data.objects.get(name) is None:
            errors.append(f"Missing runtime object: {name}")
    for name in ("Ceiling reveal | side", "Ceiling reveal | side.001"):
        obj = bpy.data.objects[name]
        corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
        if max(v.z for v in corners) >= 2.79:
            errors.append(f"Coplanar wall cap not repaired: {name}")
        if max(abs(v.x) for v in corners) >= 3.42:
            errors.append(f"Wall/reveal intersection: {name}")
    if total_triangles > 180000:
        errors.append(f"Triangle budget exceeded: {total_triangles} > 180000")
    if abs(chair_ground - 0.0525) > 0.0002:
        errors.append(f"Chair wheels do not contact the rug: Z={chair_ground}")
    if chair_right >= -0.60:
        errors.append(f"Chair enters the central monitor camera corridor: X={chair_right}")
    if tree_right >= 3.42:
        errors.append(f"Tree penetrates the right wall: X={tree_right}")
    report = {
        "revision": REVISION, "source": SOURCE.name, "output": OUTPUT.name,
        "meshes_before_panorama_export": export_meshes,
        "triangles_evaluated": total_triangles,
        "triangles_by_group": dict(sorted(stats.items())),
        "created_before_batching": len(CREATED),
        "retired_objects": REMOVED,
        "action": "AN_Robot_Mouth_Projection",
        "chair_ground_z": round(chair_ground, 5),
        "chair_center_blender": list(CHAIR_CENTER),
        "chair_yaw_degrees": round(math.degrees(CHAIR_YAW), 3),
        "chair_monitor_corridor_clearance_m": round(-0.55 - chair_right, 5),
        "tree_to_wall_clearance_m": round(3.42 - tree_right, 5),
        "projector_origin_blender": [0.76, 1.289, 0.945],
        "environment": globals().get("ENVIRONMENT_AUDIT", {}),
        "validation_errors": errors,
    }
    (CAPTURES / "room-refinement-audit.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    if errors:
        raise RuntimeError("Refined geometry failed validation")
    # Save the authoring result before the exporter changes panoramas/materials.
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT), copy=True)
    print(f"Detailed authoring copy saved: {OUTPUT}")


repair_structure()
refine_desk()
refine_chair()
place_chair()
refine_robot()
refine_floor_tree()
refine_desk_plant()
runpy.run_path(str(ROOT / "scripts" / "refine-room-environment.py"), init_globals={"ROOM": globals()})
audit_and_save()
