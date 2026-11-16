import bpy
import json
import struct
from pathlib import Path
from mathutils import Vector


project_root = Path(__file__).resolve().parent.parent
blend_path = Path(bpy.data.filepath).resolve()
source_dir = blend_path.parent
output_path = project_root / "public" / "models" / "room.glb"
candidate_path = project_root / "captures" / "room-candidate.glb"
photo_path = source_dir / "textures" / "malaga-panorama.jpg"
output_path.parent.mkdir(parents=True, exist_ok=True)
candidate_path.parent.mkdir(parents=True, exist_ok=True)

# Retain the original image datablock for finding its reference empty.
original_photo = bpy.data.images.get("MalagaTardePanoramica.png")
if not photo_path.exists():
    raise FileNotFoundError(f"Panorama not found: {photo_path}")
photo = bpy.data.images.load(str(photo_path))
photo.colorspace_settings.name = "sRGB"

glass_panes = sorted(
    (obj for obj in bpy.context.scene.objects
     if obj.type == "MESH" and obj.name.startswith("Window glass | insulated pane")),
    key=lambda obj: obj.name,
)
if not glass_panes:
    raise RuntimeError("No insulated window panes found for panorama masking")

# Keep the panorama large and far outside the window so camera movement retains
# parallax. A depth-only wall mask hides the oversized plane outside the opening.
pane_bounds = []
for pane in glass_panes:
    corners = [pane.matrix_world @ Vector(corner) for corner in pane.bound_box]
    pane_bounds.append({
        "left": min(point.x for point in corners),
        "right": max(point.x for point in corners),
        "bottom": min(point.z for point in corners),
        "top": max(point.z for point in corners),
        "back": max(point.y for point in corners),
    })

window_left = min(bounds["left"] for bounds in pane_bounds)
window_right = max(bounds["right"] for bounds in pane_bounds)
window_bottom = min(bounds["bottom"] for bounds in pane_bounds)
window_top = max(bounds["top"] for bounds in pane_bounds)
window_center_x = (window_left + window_right) * 0.5
window_center_z = (window_bottom + window_top) * 0.5
window_width = window_right - window_left
image_width = window_width * 1.8
image_height = image_width * photo.size[1] / photo.size[0]
photo_reference = next(
    (obj for obj in bpy.context.scene.objects
     if obj.type == "EMPTY" and obj.data == original_photo),
    None,
)
image_y = photo_reference.matrix_world.translation.y if photo_reference else 3.8524

panorama_vertices = [
    (window_center_x - image_width / 2, image_y, window_center_z - image_height / 2),
    (window_center_x + image_width / 2, image_y, window_center_z - image_height / 2),
    (window_center_x + image_width / 2, image_y, window_center_z + image_height / 2),
    (window_center_x - image_width / 2, image_y, window_center_z + image_height / 2),
]
panorama_mesh = bpy.data.meshes.new("Málaga panorama mesh")
panorama_mesh.from_pydata(panorama_vertices, [], [(0, 1, 2, 3)])
panorama_mesh.uv_layers.new(name="UVMap")
for loop, uv in zip(
    panorama_mesh.uv_layers.active.data,
    ((0, 0), (1, 0), (1, 1), (0, 1)),
):
    loop.uv = uv
panorama = bpy.data.objects.new("Window | Málaga panorama", panorama_mesh)
bpy.context.scene.collection.objects.link(panorama)

# The wall is a large ring with an opening aligned to the glazing. The web
# renderer replaces its material with an invisible depth-writing material.
mask_y = max(bounds["back"] for bounds in pane_bounds) + 0.27
opening_margin = 0.12
opening_left = window_left - opening_margin
opening_right = window_right + opening_margin
opening_bottom = window_bottom - opening_margin
opening_top = window_top + opening_margin
mask_half_width = 25.0
mask_half_height = 15.0
mask_faces = [
    ((-mask_half_width, mask_y, opening_top),
     (mask_half_width, mask_y, opening_top),
     (mask_half_width, mask_y, mask_half_height),
     (-mask_half_width, mask_y, mask_half_height)),
    ((-mask_half_width, mask_y, -mask_half_height),
     (mask_half_width, mask_y, -mask_half_height),
     (mask_half_width, mask_y, opening_bottom),
     (-mask_half_width, mask_y, opening_bottom)),
    ((-mask_half_width, mask_y, opening_bottom),
     (opening_left, mask_y, opening_bottom),
     (opening_left, mask_y, opening_top),
     (-mask_half_width, mask_y, opening_top)),
    ((opening_right, mask_y, opening_bottom),
     (mask_half_width, mask_y, opening_bottom),
     (mask_half_width, mask_y, opening_top),
     (opening_right, mask_y, opening_top)),
]
mask_vertices = [vertex for face in mask_faces for vertex in face]
mask_polygons = [
    tuple(range(index * 4, index * 4 + 4))
    for index in range(len(mask_faces))
]
mask_mesh = bpy.data.meshes.new("Window panorama depth mask mesh")
mask_mesh.from_pydata(mask_vertices, [], mask_polygons)
panorama_mask = bpy.data.objects.new("Window | panorama depth mask", mask_mesh)
bpy.context.scene.collection.objects.link(panorama_mask)
mask_material = bpy.data.materials.new("MAT_Exterior | panorama depth mask")
mask_material.diffuse_color = (0.1, 0.1, 0.1, 1)
panorama_mask.data.materials.append(mask_material)

material = bpy.data.materials.new("MAT_Exterior | Málaga panorama")
material.diffuse_color = (1, 1, 1, 1)
material.use_nodes = True
nodes = material.node_tree.nodes
nodes.clear()
texture = nodes.new("ShaderNodeTexImage")
texture.image = photo
texture.interpolation = "Linear"
shader = nodes.new("ShaderNodeBsdfPrincipled")
shader.inputs["Roughness"].default_value = 1.0
shader.inputs["Emission Color"].default_value = (1, 1, 1, 1)
shader.inputs["Emission Strength"].default_value = 0.35
output = nodes.new("ShaderNodeOutputMaterial")
material.node_tree.links.new(texture.outputs["Color"], shader.inputs["Base Color"])
material.node_tree.links.new(texture.outputs["Color"], shader.inputs["Emission Color"])
material.node_tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
panorama.data.materials.append(material)

# Exclude the old sky cards and modeled city from the web export. Keep the new
# window panorama (named separately) and leave the source .blend untouched.
for obj in list(bpy.context.scene.objects):
    if obj is not panorama and obj.name.startswith(("Exterior |", "Distant city |")):
        bpy.data.objects.remove(obj, do_unlink=True)

# Blender procedural Noise/ColorRamp networks do not map reliably to glTF.
# Preserve the intended dark wood palette with a glTF-compatible ramp sample.
for mat in bpy.data.materials:
    if not mat.use_nodes or not mat.node_tree:
        continue
    if not any(tag in mat.name.lower() for tag in ("wood", "walnut", "oak", "cabinet")):
        continue
    principled = next((node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    ramp = next((node for node in mat.node_tree.nodes if node.type == "VALTORGB"), None)
    if principled is None:
        continue
    if ramp is not None:
        elements = ramp.color_ramp.elements
        midpoint = tuple(
            (elements[0].color[channel] + elements[-1].color[channel]) * 0.5
            for channel in range(4)
        )
        for link in list(mat.node_tree.links):
            if link.to_node == principled and link.to_socket == principled.inputs["Base Color"]:
                mat.node_tree.links.remove(link)
        principled.inputs["Base Color"].default_value = midpoint
    principled.inputs["Roughness"].default_value = max(
        0.48, principled.inputs["Roughness"].default_value
    )

scene_meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for obj in scene_meshes:
    obj.select_set(True)
bpy.context.view_layer.objects.active = scene_meshes[0] if scene_meshes else None
if not scene_meshes:
    raise RuntimeError("No mesh objects found in the scene")

triangle_count = 0
depsgraph = bpy.context.evaluated_depsgraph_get()
for obj in scene_meshes:
    evaluated = obj.evaluated_get(depsgraph)
    data = evaluated.to_mesh()
    data.calc_loop_triangles()
    triangle_count += len(data.loop_triangles)
    evaluated.to_mesh_clear()

bpy.ops.export_scene.gltf(
    filepath=str(candidate_path),
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_yup=True,
)

# Validate the candidate before replacing the current working runtime asset.
candidate = candidate_path.read_bytes()
if candidate[:4] != b"glTF" or struct.unpack_from("<I", candidate, 4)[0] != 2:
    raise RuntimeError("Exporter did not produce a valid glTF 2 binary")
json_length = struct.unpack_from("<I", candidate, 12)[0]
document = json.loads(candidate[20:20 + json_length])
names = {node.get("name", "") for node in document.get("nodes", [])}
required_names = {
    "Monitor | bezel", "Robot pet | rounded shell",
    "Robot pet | eye", "Robot pet | eye.001", "Robot pet | projection jaw",
}
missing = required_names - names
if missing:
    raise RuntimeError(f"Export lost required runtime nodes: {sorted(missing)}")
if "AN_Robot_Mouth_Projection" not in {
    action.get("name") for action in document.get("animations", [])
}:
    raise RuntimeError("Export lost the robot projection-mouth animation")
if bpy.context.scene.get("visual_refinement"):
    obsolete = names & {"Monitor | wallpaper landscape", "Monitor | active display"}
    if obsolete:
        raise RuntimeError(f"Redundant monitor screen layers reintroduced: {obsolete}")
    if triangle_count > 180000:
        raise RuntimeError(f"Detailed room exceeds its triangle budget: {triangle_count}")
    if len(document.get("materials", [])) > 75:
        raise RuntimeError("Detailed room exceeds its material budget")
if bpy.context.scene.get("visual_refinement") == "detailed-room-v2":
    audit = json.loads(bpy.context.scene["environment_audit"])
    if (audit["book_count"] != 55 or audit["reserved_decor_cells"] != 4
            or audit["library_unintended_intersections"]
            or audit["floor_planks_preserved"] != 80
            or audit["floor_edge_gaps_repaired"] != 10
            or not audit["lamp_shade_open"]):
        raise RuntimeError("Environment source audit failed")
    for prefix in ("Library detail |", "Library books |", "Library ornaments |",
                   "Library vine |", "Window detail |", "Floor detail |",
                   "Art detail |", "Cork detail |", "Curtain detail |", "Lamp detail |"):
        if not any(name.startswith(prefix) for name in names):
            raise RuntimeError(f"Environment detail lost during export: {prefix}")
    if any(name.startswith(("Bookcase |", "Book |", "Shelf |", "Headphones |",
                            "Rug | woven thread", "Curtain | vertical pleat")) for name in names):
        raise RuntimeError("Obsolete overlapping or alias-prone environment geometry returned")
    if sum(name.startswith("Window glass | insulated pane") for name in names) != 5:
        raise RuntimeError("Export lost the panorama window panes")
    atlas = [image for image in document.get("images", []) if image.get("name") == "room-prints"]
    if len(atlas) != 1 or atlas[0].get("mimeType") != "image/jpeg":
        raise RuntimeError("Expected one shared compact photographic print atlas")
    if len(candidate) > 10_000_000:
        raise RuntimeError(f"Environment exceeds its 10 MB download budget: {len(candidate)}")
staging_path = output_path.with_name("room.pending.glb")
staging_path.write_bytes(candidate)
staging_path.replace(output_path)

print(
    f"Exported {len(scene_meshes)} meshes / {triangle_count} triangles "
    f"to {output_path} ({output_path.stat().st_size} bytes)"
)
