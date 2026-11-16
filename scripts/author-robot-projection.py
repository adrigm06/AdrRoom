import bpy
from pathlib import Path
from mathutils import Vector


source_path = Path(bpy.data.filepath).resolve()
if not source_path.exists():
    raise FileNotFoundError(f"Open a saved AdrRoom Blender source file first: {source_path}")

shell = bpy.data.objects.get("Robot pet | rounded shell")
face = bpy.data.objects.get("Robot pet | face screen")
if shell is None or face is None:
    raise RuntimeError("The AdrRoom robot shell and face screen are required")

created_names = (
    "Robot pet | projection aperture",
    "Robot pet | projection throat",
    "Robot pet | projection jaw",
    "Robot pet | jaw hinge left",
    "Robot pet | jaw hinge right",
)
if any(bpy.data.objects.get(name) for name in created_names):
    raise RuntimeError("Projection mouth already exists; refusing to duplicate it")

scene = bpy.context.scene
front_y = face.location.y - face.dimensions.y * 0.5
center_x = face.location.x
mouth_center_z = face.location.z - 0.040
aperture_y = front_y - 0.009


def create_rounded_box(name, location, dimensions, material, bevel):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if bevel:
        modifier = obj.modifiers.new("Manufactured edge radius", "BEVEL")
        modifier.width = bevel
        modifier.segments = 4
        modifier.limit_method = "ANGLE"
        modifier.angle_limit = 0.35
        normals = obj.modifiers.new("Weighted face normals", "WEIGHTED_NORMAL")
        normals.keep_sharp = True
    return obj


dark_material = bpy.data.materials.get("MAT_Metal | satin black")
ceramic_material = bpy.data.materials.get("MAT_Ceramic | warm stone")
cyan_material = bpy.data.materials.get("MAT_Robot | cyan eye glow")
if not all((dark_material, ceramic_material, cyan_material)):
    raise RuntimeError("Expected AdrRoom robot materials were not found")

# A recessed rounded aperture gives the existing face screen a physical mouth.
aperture = create_rounded_box(
    "Robot pet | projection aperture",
    (center_x, aperture_y, mouth_center_z),
    (0.096, 0.012, 0.036),
    dark_material,
    0.014,
)
aperture["role"] = "Hologram projector mouth housing"

# The throat stays visible when the hinged ceramic jaw opens.
throat = create_rounded_box(
    "Robot pet | projection throat",
    (center_x, aperture_y - 0.008, mouth_center_z - 0.004),
    (0.066, 0.004, 0.012),
    cyan_material,
    0.005,
)
throat["role"] = "Cyan emitter inside the projection mouth"

# Pivot the lower lip at its upper edge so the real mesh can open outward.
jaw_hinge_z = mouth_center_z + 0.005
jaw = create_rounded_box(
    "Robot pet | projection jaw",
    (center_x, aperture_y - 0.012, jaw_hinge_z - 0.009),
    (0.092, 0.018, 0.020),
    ceramic_material,
    0.008,
)
bpy.context.scene.cursor.location = (center_x, aperture_y - 0.012, jaw_hinge_z)
bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
jaw["role"] = "Animated lower jaw for the hologram projector"
jaw.rotation_mode = "XYZ"

# Small side pivots make the opening read as a mechanical action, not a pop-in.
for side, x in (("left", center_x - 0.047), ("right", center_x + 0.047)):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=16,
        ring_count=8,
        radius=0.0045,
        location=(x, aperture_y - 0.017, jaw_hinge_z - 0.002),
    )
    hinge = bpy.context.object
    hinge.name = f"Robot pet | jaw hinge {side}"
    hinge.scale = (1.0, 0.55, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    hinge.data.materials.append(dark_material)
    hinge["role"] = "Mechanical jaw pivot"


def make_action(name, poses):
    action = bpy.data.actions.new(name)
    jaw.animation_data_create()
    jaw.animation_data.action = action
    for frame, angle in poses:
        jaw.rotation_euler.x = angle
        jaw.keyframe_insert(data_path="rotation_euler", index=0, frame=frame, group="Projection jaw")
    slot = jaw.animation_data.action_slot
    channelbag = action.layers[0].strips[0].channelbag(slot)
    for fcurve in channelbag.fcurves:
        for key in fcurve.keyframe_points:
            key.interpolation = "BEZIER"
            key.handle_left_type = "AUTO_CLAMPED"
            key.handle_right_type = "AUTO_CLAMPED"
    return action


make_action(
    "AN_Robot_Mouth_Projection",
    ((1, 0.0), (7, -0.50), (13, -0.42)),
)

# Keep the authored source useful for manual inspection, while never replacing it.
scene.frame_start = 1
scene.frame_end = 13
scene.frame_set(1)
output_path = source_path.with_name("AdrRoom_Office_Projection.blend")
bpy.ops.wm.save_as_mainfile(filepath=str(output_path), copy=True)
print(f"Authored robot projection mouth without modifying the source: {output_path}")
print(f"Projection objects: {', '.join(created_names)}")
print("Animation action: AN_Robot_Mouth_Projection")
