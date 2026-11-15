import bpy
from pathlib import Path
from mathutils import Vector


project_root = Path(__file__).resolve().parent.parent
blend_path = Path(bpy.data.filepath).resolve()
source_dir = blend_path.parent
output_path = project_root / "public" / "models" / "room.glb"
photo_path = source_dir / "MalagaTardePanoramica.png"
output_path.parent.mkdir(parents=True, exist_ok=True)

photo = bpy.data.images.get("MalagaTardePanoramica.png")
if not photo_path.exists():
    raise FileNotFoundError(f"Panorama not found: {photo_path}")
if photo is None:
    photo = bpy.data.images.load(str(photo_path))
else:
    photo.filepath = str(photo_path)
    photo.reload()
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
     if obj.type == "EMPTY" and obj.data == photo),
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

triangle_count = sum(
    max(0, len(poly.vertices) - 2)
    for obj in scene_meshes
    for poly in obj.data.polygons
)
bpy.ops.export_scene.gltf(
    filepath=str(output_path),
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
    export_animations=False,
    export_yup=True,
)

print(
    f"Exported {len(scene_meshes)} meshes / {triangle_count} triangles "
    f"to {output_path} ({output_path.stat().st_size} bytes)"
)
