"""Second-pass environment refinement, invoked by refine-room.py via runpy.

ROOM supplies the first pass's helpers/material library. Never run this module
against the detailed output: the complete pipeline always starts at projection.
"""

import itertools
import json
import math
import random

import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree


C = ROOM
box, mesh, tube, lathe, sphere = (C[k] for k in ("box", "mesh", "tube", "lathe", "sphere"))
remove_prefix, remove_names = C["remove_prefix"], C["remove_names"]
material, existing = C["material"], C["existing_material"]
batch = C["consolidate"]
WOOD, BLACK, RUBBER, ALLOY, BRASS = (C[k] for k in ("WALNUT", "BLACK", "RUBBER", "ALLOY", "BRONZE"))
PAPER = existing("MAT_Paper | ivory")
CERAMIC = C["CERAMIC"]
RNG = random.Random(4815)
BOOKS = []
ORNAMENTS = []
STRUCTURE = []
REPORT = {}


def shader(mat):
    return next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


def uv_project(obj, scale=(1, 1, 1), swap=False, offset=(0, 0)):
    C["planar_uv"](obj, scale)
    layer = obj.data.uv_layers[-1]
    obj.data.uv_layers.active = layer
    layer.active_render = True
    for loop in layer.data:
        u, v = loop.uv
        loop.uv = ((v if swap else u) + offset[0], (u if swap else v) + offset[1])
    return obj


def textured(name, pixels, roughness=0.65):
    mat = material(name, (0.5, 0.4, 0.3), roughness)
    C["image_material"](mat, name.split("|")[-1].strip().replace(" ", "-"), pixels, pixels.shape[0])
    return mat


def normal_map(mat, name, height, strength=1):
    # Average before differentiating: less high-frequency shimmer and payload.
    if height.shape[0] > 256:
        height = height.reshape(256, 2, 256, 2).mean(axis=(1, 3))
    dy, dx = np.gradient(height)
    normals = np.stack((-dx * strength, -dy * strength, np.ones_like(height)), axis=-1)
    normals /= np.linalg.norm(normals, axis=-1, keepdims=True)
    pixels = np.ones((*height.shape, 4), dtype=np.float32)
    pixels[:, :, :3] = normals * 0.5 + 0.5
    image = bpy.data.images.new(name, width=height.shape[1], height=height.shape[0], alpha=False)
    image.colorspace_settings.name = C["enum_value"](image.colorspace_settings, "name", "Non-Color")
    image.pixels.foreach_set(pixels.ravel())
    image.filepath_raw = str(C["TEXTURES"] / (name + ".png"))
    image.file_format = C["enum_value"](image, "file_format", "PNG")
    image.save()
    image.pack()
    nodes = mat.node_tree.nodes
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = image
    normal = nodes.new("ShaderNodeNormalMap")
    normal.inputs["Strength"].default_value = 0.42
    mat.node_tree.links.new(tex.outputs["Color"], normal.inputs["Color"])
    mat.node_tree.links.new(normal.outputs["Normal"], shader(mat).inputs["Normal"])
    return image


def reuse_normal(mat, image):
    tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = image
    normal = mat.node_tree.nodes.new("ShaderNodeNormalMap")
    normal.inputs["Strength"].default_value = 0.28
    mat.node_tree.links.new(tex.outputs["Color"], normal.inputs["Color"])
    mat.node_tree.links.new(normal.outputs["Normal"], shader(mat).inputs["Normal"])


def annular_lathe(name, center, profile, mat, segments=32):
    """Revolve a closed wall section; no disk caps across the open centre."""
    vertices = [(center[0] + radius * math.cos(i * math.tau / segments),
                 center[1] + radius * math.sin(i * math.tau / segments),
                 center[2] + z)
                for radius, z in profile for i in range(segments)]
    faces = []
    for ring in range(len(profile)):
        next_ring = (ring + 1) % len(profile)
        for i in range(segments):
            j = (i + 1) % segments
            faces.append((ring * segments + i, ring * segments + j,
                          next_ring * segments + j, next_ring * segments + i))
    return mesh(name, vertices, faces, mat)


def wood_box(name, center, size, radius=0.005, vertical=False):
    obj = box(name, center, size, LIBRARY_WOOD, radius, 2)
    uv_project(obj, (1.3, 1.3, 1.9), swap=vertical)
    return obj


def world_geometry(objects):
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    vertices, faces = [], []
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        data = evaluated.to_mesh()
        offset = len(vertices)
        vertices.extend(obj.matrix_world @ v.co for v in data.vertices)
        faces.extend(tuple(i + offset for i in p.vertices) for p in data.polygons)
        evaluated.to_mesh_clear()
    lo = [min(p[i] for p in vertices) for i in range(3)]
    hi = [max(p[i] for p in vertices) for i in range(3)]
    return vertices, faces, lo, hi


def spatial(objects):
    vertices, faces, lo, hi = world_geometry(objects)
    return BVHTree.FromPolygons(vertices, faces), lo, hi


def overlaps(a, b):
    return all(min(a[2][i], b[2][i]) - max(a[1][i], b[1][i]) > 0.0001 for i in range(3))


def fit_cell(objects, cell, label):
    _, _, lo, hi = world_geometry(objects)
    ymin, ymax, base, ceiling = cell
    if lo[0] < -3.37 or hi[0] > -2.91:
        raise RuntimeError(f"{label} extends beyond the shelf depth")
    if lo[1] < ymin - 0.0001 or hi[1] > ymax + 0.0001:
        raise RuntimeError(f"{label} crosses a compartment upright")
    if lo[2] < base - 0.0001 or hi[2] > ceiling - 0.012:
        raise RuntimeError(f"{label} crosses a shelf")
    if lo[2] - base > 0.0015:
        raise RuntimeError(f"{label} floats above its supporting shelf")


def validate_library():
    structures = [(obj.name, spatial([obj])) for obj in STRUCTURE]
    groups = [(name, spatial(objects)) for name, objects in BOOKS + ORNAMENTS]
    checks = 0
    collisions = []
    for name, bounds in groups:
        for other_name, other in structures:
            if overlaps(bounds, other):
                checks += 1
                if bounds[0].overlap(other[0]):
                    collisions.append([name, other_name])
    for (name, bounds), (other_name, other) in itertools.combinations(groups, 2):
        if overlaps(bounds, other):
            checks += 1
            if bounds[0].overlap(other[0]):
                collisions.append([name, other_name])
    REPORT["book_count"] = len(BOOKS)
    REPORT["reserved_decor_cells"] = len(ORNAMENTS)
    REPORT["library_exact_pair_checks"] = checks
    REPORT["library_unintended_intersections"] = collisions
    if collisions:
        raise RuntimeError(f"Library collision audit failed: {collisions[:8]}")


def refine_library():
    for prefix in ("Bookcase |", "Book |", "Shelf |", "Headphones |", "Trailing plant |"):
        remove_prefix(prefix)
    # The case is inside the wall, with separate shelf spans in each clear bay.
    STRUCTURE.append(box("Library detail | rear panel", (-3.392, 0, 1.70),
                         (0.025, 3.73, 1.76), LIBRARY_BACK, 0.003, 2))
    STRUCTURE.append(wood_box("Library detail | cabinet carcass", (-3.155, 0, 0.43),
                              (0.48, 3.73, 0.76), 0.009))
    STRUCTURE.append(box("Library detail | recessed plinth", (-3.17, 0, 0.072),
                         (0.43, 3.62, 0.095), RUBBER, 0.006, 2))
    for y in (-1.84, -0.92, 0, 0.92, 1.84):
        STRUCTURE.append(wood_box("Library detail | upright", (-3.145, y, 1.67),
                                  (0.51, 0.06, 1.72), 0.004, True))
    levels = (0.86, 1.28, 1.70, 2.12, 2.50)
    for z in levels:
        for col in range(4):
            cy = -1.38 + col * 0.92
            STRUCTURE.append(wood_box("Library detail | fitted shelf", (-3.14, cy, z),
                                      (0.48, 0.858, 0.055), 0.004))
    STRUCTURE.append(wood_box("Library detail | crown", (-3.13, 0, 2.565),
                              (0.57, 3.79, 0.11), 0.009))
    for col in range(4):
        y = -1.38 + col * 0.92
        STRUCTURE.append(wood_box("Library detail | framed cabinet door", (-2.885, y, 0.445),
                                  (0.026, 0.858, 0.625), 0.007, True))
        STRUCTURE.append(wood_box("Library detail | door panel", (-2.868, y, 0.445),
                                  (0.012, 0.744, 0.51), 0.004, True))
        for z in (0.22, 0.66):
            STRUCTURE.append(box("Library detail | hinge barrel", (-2.867, y - 0.397, z),
                                 (0.025, 0.017, 0.052), BRASS, 0.004, 2))
        STRUCTURE.append(sphere("Library detail | cabinet knob", (-2.837, y + 0.31, 0.48),
                                (0.035, 0.045, 0.045), BRASS, 16, 10))
    light = existing("MAT_Light | warm emissive")
    for z in levels[1:4]:
        STRUCTURE.append(box("Library detail | recessed light channel", (-2.938, 0, z - 0.029),
                             (0.045, 3.59, 0.014), ALLOY, 0.003, 2))
        STRUCTURE.append(box("Library detail | opal light diffuser", (-2.938, 0, z - 0.037),
                             (0.027, 3.55, 0.003), light, 0.001, 1))

    # Shared page grain and fabric normals, not one material per book.
    size = 128
    yy, xx = np.mgrid[0:size, 0:size]
    weave = np.sin(xx * math.tau / 8) * np.sin(yy * math.tau / 8)
    normal = normal_map(PAPER, "paper-and-cloth-normal", weave * 0.09, 2)
    covers = [existing(f"MAT_Book | {name}") for name in ("navy", "forest", "ochre", "rust", "charcoal")]
    for mat in covers:
        shader(mat).inputs["Roughness"].default_value = 0.79
        reuse_normal(mat, normal)
    layout = ((5, 4, 0, 5), (4, 0, 5, 4), (3, 4, 0, 5), (0, 4, 5, 7))
    cells = {}
    for row in range(4):
        for col in range(4):
            cell = (-1.84 + col * 0.92 + 0.046, -0.92 + col * 0.92 - 0.046,
                    levels[row] + 0.0275 + 0.0005, levels[row + 1] - 0.0275)
            cells[row, col] = cell
            count = layout[row][col]
            cursor = cell[0] + 0.025
            for index in range(count):
                width = RNG.uniform(0.040, 0.067)
                height = RNG.uniform(0.215, min(0.31, cell[3] - cell[2] - 0.036))
                depth = RNG.uniform(0.215, 0.25)
                lean = RNG.choice((-0.035, 0, 0, 0.025))
                rotation = Matrix.Rotation(lean, 4, "X")
                corners = [rotation @ Vector((x, y, z))
                           for x in (-depth / 2 - 0.008, depth / 2 + 0.008)
                           for y in (-width / 2, width / 2) for z in (0, height + 0.008)]
                ymin, ymax = min(v.y for v in corners), max(v.y for v in corners)
                zmin = min(v.z for v in corners)
                if cursor + ymax - ymin > cell[1] - 0.016:
                    raise RuntimeError("Book packing exceeds the clear shelf span")
                objects = []
                cover = covers[(row * 3 + col + index) % len(covers)]
                for side in (-1, 1):
                    objects.append(box("Library books | hard cover", (0, side * (width / 2 - 0.0015), height / 2 + 0.004),
                                       (depth + 0.014, 0.003, height + 0.008), cover, 0.001, 1))
                pages = box("Library books | page block", (0, 0, height / 2 + 0.004),
                            (depth - 0.012, width - 0.008, height - 0.010), PAPER, 0.001, 1)
                uv_project(pages, (4, 6, 8))
                objects.append(pages)
                objects.append(box("Library books | bound spine", (depth / 2 + 0.004, 0, height / 2 + 0.004),
                                   (0.006, width, height + 0.008), cover, 0.002, 2))
                for z in (height * 0.23, height * 0.78):
                    objects.append(box("Library books | foil rule", (depth / 2 + 0.0075, 0, z),
                                       (0.001, width - 0.012, 0.0025), BRASS, 0, 1))
                transform = Matrix.Translation(Vector((-3.105, cursor - ymin, cell[2] - zmin))) @ rotation
                bpy.context.view_layer.update()
                for obj in objects:
                    obj.matrix_world = transform @ obj.matrix_world
                label = f"book-{row}-{col}-{index}"
                fit_cell(objects, cell, label)
                BOOKS.append((label, objects))
                cursor += ymax - ymin + RNG.uniform(0.012, 0.021)

    for row, col in ((1, 1), (2, 2)):
        cell = cells[row, col]
        y, base = (cell[0] + cell[1]) / 2, cell[2]
        objects = [
            lathe("Library ornaments | orb pedestal", (-3.105, y, base),
                  [(0.035, 0), (0.085, 0), (0.085, 0.018), (0.06, 0.025)], BRASS, 24),
            sphere("Library ornaments | ceramic orb", (-3.105, y, base + 0.125),
                   (0.20, 0.20, 0.20), CERAMIC, 24, 16),
        ]
        fit_cell(objects, cell, f"orb-{row}-{col}")
        ORNAMENTS.append((f"orb-{row}-{col}", objects))
    cell = cells[3, 0]
    y, base = (cell[0] + cell[1]) / 2, cell[2]
    vase = lathe("Library ornaments | ceramic bud vase", (-3.105, y, base),
                 [(0.045, 0), (0.075, 0), (0.087, 0.07), (0.067, 0.15),
                  (0.032, 0.21), (0.032, 0.25), (0.023, 0.25),
                  (0.023, 0.21), (0.052, 0.12), (0.035, 0.025)], CERAMIC, 32)
    fit_cell([vase], cell, "vase")
    ORNAMENTS.append(("vase", [vase]))
    cell = cells[0, 2]
    y, base = (cell[0] + cell[1]) / 2, cell[2]
    objects = []
    arc = [(-3.105, y + 0.11 * math.cos(i * math.pi / 24),
            base + 0.12 + 0.15 * math.sin(i * math.pi / 24)) for i in range(25)]
    objects.append(tube("Library ornaments | headphone headband", arc, [0.008] * len(arc), ALLOY, 8))
    for side in (-1, 1):
        objects.append(sphere("Library ornaments | headphone earcup", (-3.105, y + side * 0.11, base + 0.07),
                              (0.08, 0.05, 0.14), BLACK, 24, 14))
        objects.append(sphere("Library ornaments | headphone cushion", (-3.105, y + side * 0.084, base + 0.07),
                              (0.074, 0.018, 0.125), C["FABRIC"], 24, 12))
    fit_cell(objects, cell, "headphones")
    ORNAMENTS.append(("headphones", objects))
    validate_library()
    for prefix in ("Library detail |", "Library books |", "Library ornaments |"):
        batch(prefix)

    # A pot above the crown, with vines in front of (not through) the books.
    lathe("Library vine | crown planter", (-3.11, 1.42, 2.621),
          [(0.055, 0), (0.075, 0), (0.09, 0.09), (0.085, 0.11),
           (0.072, 0.11), (0.067, 0.02), (0.055, 0.015)], CERAMIC, 24)
    for i in range(3):
        y = 1.34 + i * 0.08
        path = [(-3.09, y, 2.70), (-2.91, y, 2.62), (-2.838, y, 2.48),
                (-2.833, y + 0.02, 2.31), (-2.84, y + 0.04, 2.15 + i * 0.03)]
        tube("Library vine | trailing stem", path, [0.003] * 5, C["VEIN"], 6)
        for j in range(1, 5):
            C["leaf"]("Library vine | curved leaf", path[j],
                      (0.45, (-1) ** j * 0.55, -0.6), 0.075, 0.042,
                      C["FOLIAGE"][(i + j) % 3], 0.2)
    batch("Library vine |")


def refine_window():
    for prefix in ("Window mullion |", "Window rail", "Window | gasket seal"):
        remove_prefix(prefix)
    glass = existing("MAT_Glass | blue dusk")
    node = shader(glass)
    node.inputs["Base Color"].default_value = (0.93, 0.97, 0.985, 1)
    node.inputs["Metallic"].default_value = 0
    node.inputs["Roughness"].default_value = 0.025
    node.inputs["Transmission Weight"].default_value = 0.94
    for x in (-2.8, -1.75, -0.55, 0.75, 1.95, 2.8):
        box("Window detail | mullion core", (x, 2.133, 1.535), (0.052, 0.10, 1.86), ALLOY, 0.005, 3)
        box("Window detail | removable glazing bead", (x, 2.078, 1.535),
            (0.067, 0.014, 1.86), BLACK, 0.003, 2)
    for z in (0.62, 1.48, 2.45):
        box("Window detail | horizontal rail", (0, 2.133, z),
            (5.60, 0.10, 0.052), ALLOY, 0.005, 3)
        box("Window detail | horizontal bead", (0, 2.078, z),
            (5.60, 0.014, 0.064), BLACK, 0.003, 2)
    for pane in [o for o in bpy.context.scene.objects if o.name.startswith("Window glass | insulated pane")]:
        p = [pane.matrix_world @ Vector(v) for v in pane.bound_box]
        left, right = min(v.x for v in p), max(v.x for v in p)
        bottom, top = min(v.z for v in p), max(v.z for v in p)
        for x in (left - 0.002, right + 0.002):
            box("Window detail | EPDM vertical seal", (x, 2.19, (bottom + top) / 2),
                (0.010, 0.008, top - bottom + 0.012), RUBBER, 0.002, 2)
        for z in (bottom - 0.002, top + 0.002):
            box("Window detail | EPDM horizontal seal", ((left + right) / 2, 2.19, z),
                (right - left, 0.008, 0.010), RUBBER, 0.002, 2)
    for name in ("Window sill", "Window head casing"):
        obj = bpy.data.objects[name]
        obj.data.materials.clear()
        obj.data.materials.append(WOOD)
        uv_project(obj, (0.7, 2, 2))
        for mod in obj.modifiers:
            if mod.type == "BEVEL":
                mod.segments = 4
    box("Window detail | latch plate", (0.71, 2.054, 1.37), (0.026, 0.022, 0.13), ALLOY, 0.006, 3)
    tube("Window detail | lever handle", [(0.71, 2.035, 1.40), (0.71, 1.986, 1.40),
                                         (0.71, 1.986, 1.32)], [0.008] * 3, BRASS, 10)
    batch("Window detail |")
    REPORT["window_glass_roughness"] = 0.025
    REPORT["window_panorama_panes_preserved"] = 5


def refine_floor_and_rug():
    size = 512
    y, x = np.mgrid[0:size, 0:size].astype(np.float32) / size
    noise = np.random.default_rng(518).normal(0, 0.012, (size, size))
    warp = y + 0.006 * np.sin(x * math.tau * 3)
    grain = np.sin(warp * math.tau * 35) * 0.026 + np.sin(warp * math.tau * 133) * 0.009 + noise
    floor = textured("MAT_Floor | detailed warm oak", np.stack((
        0.43 + grain, 0.32 + grain * 0.75, 0.22 + grain * 0.5,
    ), axis=-1), 0.64)
    normal_map(floor, "oak-grain-normal", grain, 5)
    objects = []
    edge_repairs = 0
    bpy.context.view_layer.update()
    for obj in list(bpy.context.scene.objects):
        if obj.name.startswith("Floor plank |"):
            # Original staggered rows omitted their leftmost half-board. Extend
            # the first board to the same boundary, keeping its top/support Z.
            if obj.name.endswith("piece 00"):
                left = min((obj.matrix_world @ v.co).x for v in obj.data.vertices)
                if left > -3.59:
                    inverse = obj.matrix_world.inverted()
                    for vertex in obj.data.vertices:
                        world = obj.matrix_world @ vertex.co
                        if abs(world.x - left) < 0.0001:
                            world.x = -3.594
                            vertex.co = inverse @ world
                    edge_repairs += 1
            obj.data.materials.clear()
            obj.data.materials.append(floor)
            uv_project(obj, (0.55, 2.1, 2.1), offset=(RNG.random(), RNG.random()))
            for mod in obj.modifiers:
                if mod.type == "BEVEL":
                    mod.width = 0.0025
            # Batch the existing boards without changing their heights or seams.
            obj.name = "Floor detail | oak plank"
            for collection in list(obj.users_collection):
                collection.objects.unlink(obj)
            C["COLLECTION"].objects.link(obj)
            obj["visual_refinement"] = C["REVISION"]
            objects.append(obj)
    REPORT["floor_planks_preserved"] = len(objects)
    REPORT["floor_edge_gaps_repaired"] = edge_repairs
    batch("Floor detail |")

    remove_prefix("Rug |")
    weave = 0.012 * np.cos(x * math.tau * 64) + 0.009 * np.cos(y * math.tau * 64)
    rug = textured("MAT_Rug | detailed linen weave", np.stack((
        0.68 + weave, 0.65 + weave, 0.58 + weave,
    ), axis=-1), 0.93)
    normal_map(rug, "rug-weave-normal", weave, 10)
    body = box("Rug | main pile", (0, -0.55, 0.035), (4.65, 2.35, 0.035), rug, 0.013, 3)
    uv_project(body, (0.7, 1.3, 2))
    path = [(px, py - 0.55, 0.0528) for px, py in C["ring_points"](4.53, 2.23, 0.045)]
    tube("Rug detail | stitched binding", path + [path[0]], [0.002] * (len(path) + 1), PAPER, 6)
    REPORT["rug_support_height"] = 0.0525


def wall_frame(name, x, y, z, width, height, depth, border, mat):
    outer = [(-width / 2, -height / 2), (width / 2, -height / 2),
             (width / 2, height / 2), (-width / 2, height / 2)]
    inner = [(-width / 2 + border, -height / 2 + border), (width / 2 - border, -height / 2 + border),
             (width / 2 - border, height / 2 - border), (-width / 2 + border, height / 2 - border)]
    vertices = [(x + dx, y + py, z + pz)
                for dx, ring in ((-depth / 2, outer), (-depth / 2, inner),
                                 (depth / 2, outer), (depth / 2, inner)) for py, pz in ring]
    faces = []
    for i in range(4):
        j = (i + 1) % 4
        faces += [(i, j, j + 4, i + 4), (i + 8, i + 12, j + 12, j + 8),
                  (i, i + 8, j + 8, j), (i + 4, j + 4, j + 12, i + 12)]
    obj = mesh(name, vertices, faces, mat, smooth=False)
    C["bevel"](obj, 0.002, 2)
    uv_project(obj, (2, 2, 2))
    return obj


def printed_sheet(name, center, width, height, region, curl=0.0, roll=0.0):
    nx, ny = 8, 6
    vertices = []
    for layer in (0, 1):
        for j in range(ny + 1):
            v = j / ny
            for i in range(nx + 1):
                u = i / nx
                lift = curl * (abs(u - 0.5) * 2) ** 5 * (abs(v - 0.5) * 2) ** 5
                vertices.append((-layer * 0.0008 - lift, (u - 0.5) * width, (v - 0.5) * height))
    count = (nx + 1) * (ny + 1)
    faces = []
    for layer in range(2):
        for j in range(ny):
            for i in range(nx):
                a = layer * count + j * (nx + 1) + i
                faces.append((a, a + 1, a + nx + 2, a + nx + 1))
    edge = list(range(nx + 1))
    edge += [j * (nx + 1) + nx for j in range(1, ny + 1)]
    edge += [ny * (nx + 1) + i for i in range(nx - 1, -1, -1)]
    edge += [j * (nx + 1) for j in range(ny - 1, 0, -1)]
    for a, b in zip(edge, edge[1:] + edge[:1]):
        faces.append((a, b, b + count, a + count))
    obj = mesh(name, vertices, faces, PRINTS, smooth=False)
    uv = obj.data.uv_layers.new(name="UVMap")
    rx, ry, rw, rh = ATLAS["regions"][region]
    for loop in obj.data.loops:
        p = obj.data.vertices[loop.vertex_index].co
        u, v = 0.5 - p.y / width, p.z / height + 0.5
        uv.data[loop.index].uv = ((rx + u * rw) / ATLAS["width"], 1 - (ry + (1 - v) * rh) / ATLAS["height"])
    obj.rotation_euler.x = roll
    obj.location = center
    return obj


def refine_art_and_cork():
    remove_prefix("Wall art |")
    remove_prefix("Inspiration board |")
    remove_prefix("Board |")
    # A real mitred annular frame: adjacent sides never share coplanar caps.
    box("Art detail | rear backing", (3.377, -0.45, 1.92), (0.035, 0.92, 0.65), RUBBER, 0.004, 2)
    wall_frame("Art detail | walnut frame", 3.338, -0.45, 1.92, 0.95, 0.68, 0.075, 0.042, LIBRARY_WOOD)
    wall_frame("Art detail | linen mount", 3.317, -0.45, 1.92, 0.855, 0.585, 0.008, 0.063, PAPER)
    printed_sheet("Art detail | Malaga photographic print", (3.320, -0.45, 1.92), 0.72, 0.45, "malaga")
    for y in (-0.78, -0.12):
        box("Art detail | rear wall bumper", (3.412, y, 1.68), (0.012, 0.022, 0.025), RUBBER, 0.003, 2)
    batch("Art detail |")

    size = 512
    rand = np.random.default_rng(634)
    fine = rand.random((size, size))
    coarse = rand.random((64, 64)).repeat(8, axis=0).repeat(8, axis=1)
    grain = (fine - 0.5) * 0.10 + (coarse - 0.5) * 0.045
    cork = textured("MAT_Cork | detailed natural granules", np.stack((
        0.48 + grain, 0.315 + grain * 0.8, 0.18 + grain * 0.55,
    ), axis=-1), 0.93)
    normal_map(cork, "cork-granule-normal", grain, 5)
    box("Cork detail | plywood backing", (3.375, 1.16, 1.73), (0.055, 1.28, 0.90), WOOD, 0.003, 2)
    board = box("Inspiration board | cork", (3.327, 1.16, 1.73), (0.025, 1.17, 0.79), cork, 0.003, 2)
    uv_project(board, (2, 1.0, 1.5))
    wall_frame("Cork detail | mitred frame", 3.30, 1.16, 1.73, 1.30, 0.92, 0.075, 0.045, LIBRARY_WOOD)
    for index, project in enumerate(("androbox", "komea", "avisia", "vantagesystems")):
        y = (0.865, 1.455)[index % 2]
        z = (1.91, 1.535)[index // 2]
        roll = (0.035, -0.025, -0.03, 0.025)[index]
        printed_sheet("Cork detail | project photograph", (3.302 - index * 0.0008, y, z),
                      0.435, 0.275, project, curl=0.004, roll=roll)
        pin_z = z + 0.112
        # The head is in the room; the stem continues through the paper into cork.
        tube("Cork detail | pin stem", [(3.292, y, pin_z), (3.323, y, pin_z)],
             [0.0014, 0.0014], ALLOY, 8)
        sphere("Cork detail | pin head", (3.290, y, pin_z), (0.014, 0.016, 0.016), BRASS, 16, 10)
    printed_sheet("Cork detail | work heading", (3.301, 1.16, 2.085), 0.35, 0.070, "note0", curl=0.001)
    for index, y in enumerate((0.87, 1.45)):
        printed_sheet("Cork detail | paper note", (3.300, y, 1.365), 0.43, 0.064,
                      f"note{index + 1}", curl=0.002)
    batch("Cork detail |")
    REPORT["printed_regions"] = list(ATLAS["regions"])
    REPORT["cork_photographs"] = 4


def refine_curtains_and_lamp():
    remove_prefix("Curtain | vertical pleat")
    curtain_normal = None
    for side, name in ((-1, "MAT_Curtain | pleat A"), (1, "MAT_Curtain | pleat B")):
        mat = existing(name)
        shader(mat).inputs["Roughness"].default_value = 0.88
        if curtain_normal is None:
            yy, xx = np.mgrid[0:128, 0:128]
            curtain_normal = normal_map(mat, "curtain-weave-normal",
                                       np.sin(xx * math.tau / 6) * np.sin(yy * math.tau / 6) * 0.03, 3)
        else:
            reuse_normal(mat, curtain_normal)
        vertices = []
        nx, nz = 40, 16
        for layer in (0, 1):
            for j in range(nz + 1):
                v = j / nz
                for i in range(nx + 1):
                    u = i / nx
                    x = side * 3.12 + (u - 0.5) * 0.45
                    y = 2.010 + 0.027 * math.cos(u * math.pi * 10) + layer * 0.004
                    z = 0.64 + v * 1.78 + (1 - v) * math.sin(u * math.pi * 10) * 0.004
                    vertices.append((x, y, z))
        count = (nx + 1) * (nz + 1)
        faces = []
        for layer in range(2):
            for j in range(nz):
                for i in range(nx):
                    a = layer * count + j * (nx + 1) + i
                    faces.append((a, a + 1, a + nx + 2, a + nx + 1))
        edge = list(range(nx + 1))
        edge += [j * (nx + 1) + nx for j in range(1, nz + 1)]
        edge += [nz * (nx + 1) + i for i in range(nx - 1, -1, -1)]
        edge += [j * (nx + 1) for j in range(nz - 1, 0, -1)]
        for a, b in zip(edge, edge[1:] + edge[:1]):
            faces.append((a, b, b + count, a + count))
        obj = mesh("Curtain detail | continuous pleated fabric", vertices, faces, mat)
        uv_project(obj, (3, 3, 3))
        for i in range(6):
            ring = annular_lathe("Curtain detail | suspension ring", (0, 0, 0),
                         [(0.018, -0.002), (0.024, -0.002), (0.024, 0.002), (0.018, 0.002)], BRASS, 16)
            ring.rotation_euler.y = math.pi / 2
            ring.location = (side * 3.12 - 0.19 + i * 0.076, 2.05, 2.53)
    for obj in bpy.context.scene.objects:
        if obj.name.startswith("Curtain header"):
            obj.data.materials.clear()
            obj.data.materials.append(existing("MAT_Curtain | pleat A"))
    batch("Curtain detail |")

    remove_names(("Floor lamp | shade", "Floor lamp | shade cap"))
    bpy.data.objects["Floor lamp | bulb"].location.z = 2.10
    mat = existing("MAT_Paper | ivory")
    shade = annular_lathe("Lamp detail | hollow linen shade", (2.7, 0.6, 0),
                         [(0.222, 1.98), (0.230, 1.98), (0.230, 2.28), (0.222, 2.28)], mat, 48)
    hit = spatial([shade])[0].ray_cast(Vector((2.7, 0.6, 1.90)), Vector((0, 0, 1)), 0.5)
    REPORT["lamp_shade_open"] = hit[0] is None
    if not REPORT["lamp_shade_open"]:
        raise RuntimeError("Lamp shade has a disk closing its centre")
    for z in (1.987, 2.273):
        annular_lathe("Lamp detail | shade edge binding", (2.7, 0.6, z),
              [(0.220, -0.003), (0.232, -0.003), (0.232, 0.003), (0.220, 0.003)], BRASS, 48)
    for i in range(3):
        angle = i * math.tau / 3
        tube("Lamp detail | interior shade support",
             [(2.7, 0.6, 2.20), (2.7 + math.cos(angle) * 0.22, 0.6 + math.sin(angle) * 0.22, 2.27)],
             [0.003, 0.003], ALLOY, 6)
    lathe("Lamp detail | bulb socket", (2.7, 0.6, 1.98),
          [(0.015, 0), (0.028, 0), (0.028, 0.06), (0.015, 0.06)], ALLOY, 20)
    tube("Lamp detail | fabric power cord",
         [(2.70, 0.6, 1.62), (2.70, 0.6, 0.4), (2.72, 0.62, 0.04),
          (2.90, 0.75, 0.029), (3.30, 0.75, 0.029)], [0.0035] * 5, BLACK, 6)
    batch("Lamp detail |")


atlas_path = C["TEXTURES"] / "room-prints.json"
if not atlas_path.exists():
    raise RuntimeError("Run node scripts/create-room-atlas.mjs before Blender refinement")
ATLAS = json.loads(atlas_path.read_text(encoding="utf-8"))
PRINTS = material("MAT_Print | room portfolio atlas", (0.85, 0.83, 0.78), 0.82)
image = bpy.data.images.load(str(C["TEXTURES"] / "room-prints.jpg"))
image.pack()
tex = PRINTS.node_tree.nodes.new("ShaderNodeTexImage")
tex.image = image
PRINTS.node_tree.links.new(tex.outputs["Color"], shader(PRINTS).inputs["Base Color"])

yy, xx = np.mgrid[0:256, 0:256].astype(np.float32) / 256
grain = 0.012 * np.sin((yy + 0.004 * np.sin(xx * math.tau * 2)) * math.tau * 19)
LIBRARY_WOOD = textured("MAT_Wood | satin library walnut", np.stack((
    0.43 + grain, 0.31 + grain * 0.7, 0.205 + grain * 0.5,
), axis=-1), 0.65)
LIBRARY_BACK = material("MAT_Library | warm matte backing", (0.24, 0.225, 0.185), 0.88)

refine_library()
refine_window()
refine_floor_and_rug()
refine_art_and_cork()
refine_curtains_and_lamp()
REPORT["revision"] = "environment-v2"
C["bpy"].context.scene["environment_audit"] = json.dumps(REPORT)
C["ENVIRONMENT_AUDIT"] = REPORT
print("Environment refinement:", json.dumps(REPORT))
