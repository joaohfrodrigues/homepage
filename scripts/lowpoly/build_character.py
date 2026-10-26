"""
Builds João for the low-poly house from KayKit Adventurers (CC0, Kay Lousberg)
and exports public/house3d/joao.glb.

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
        --python scripts/lowpoly/build_character.py

He starts as the pack's Ranger (expected in assets/kaykit/adventurers)
without his cape and quiver. Every face is moved onto a material per role
(skin, hair, shirt, trousers...) whose texture is a plain white-to-grey
gradient, so the page recolours a role by setting its material colour and
keeps the pack's top-lit shading. The page only offers shirt, trousers and hair
for now; the other roles keep their colours.

Animations stay in the pack's own files (Rig_Medium_General.glb and
Rig_Medium_MovementBasic.glb): they drive any character on the same skeleton.
`bun run house3d:compress` picks the clips the page plays out of them into
public/house3d/joao-animations.glb, and compresses joao.glb.
"""

import math
import os

import bpy
import numpy as np
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PACK = os.path.join(ROOT, 'assets', 'kaykit', 'adventurers')
OUT_DIR = os.path.join(ROOT, 'public', 'house3d')
WORK_DIR = os.path.join(ROOT, 'assets', 'lowpoly-poc')

# The pack's character textures are an 8 x 4 grid of gradient swatches.
COLS, ROWS = 8, 4

# Which role each Ranger swatch (column, row) plays, per mesh.
ROLES = {
    'Head': {(0, 0): 'skin', (1, 0): 'hair', (2, 0): 'eyes'},
    'Body': {
        (5, 0): 'shirt',
        (6, 0): 'shirt',
        (0, 1): 'scarf',
        (7, 0): 'leather',
        (7, 1): 'leather',
        (3, 0): 'metal',
    },
    'Arm': {
        (6, 0): 'shirt',
        (0, 0): 'skin',
        (7, 2): 'leather',
        (7, 0): 'leather',
        (1, 1): 'leather',
        (3, 0): 'metal',
    },
    'Leg': {(3, 2): 'trousers', (7, 1): 'boots'},
}
# João's look: dark hair and a teal shirt.
COLOURS = {
    'skin': '#f2c4a0',
    'hair': '#4a3426',
    'eyes': '#22282c',
    'shirt': '#2f8f8a',
    'scarf': '#256f6b',
    'leather': '#6b4630',
    'metal': '#b4bcc2',
    'trousers': '#3d4f6b',
    'boots': '#4a3324',
}
# Legs share one swatch for trousers and boots; below this share of the leg's height it's boot.
BOOT_TOP = 0.42


def hex_rgb(h):
    h = h.lstrip('#')
    return [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]


def neutral_image():
    """A white-to-grey gradient: the pack's top-lit shading without its colour."""
    h = 64
    t = np.linspace(0, 1, h)[:, None]  # bottom row first
    grey = 0.6 + 0.4 * t
    px = np.ones((h, 4, 4), dtype=np.float32)
    px[:, :, :3] = grey[:, :, None]
    img = bpy.data.images.new('joao_shading', 4, h, alpha=False)
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw = os.path.join(WORK_DIR, 'joao_shading.png')
    img.file_format = 'PNG'
    img.save()
    img.pack()
    return img


MATERIALS = {}


def role_material(role, img):
    if role in MATERIALS:
        return MATERIALS[role]
    mat = bpy.data.materials.new('role_' + role)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.85
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    nt.links.new(tex.outputs['Color'], mix.inputs[6])
    # Blender colours are linear; the hex values are sRGB.
    mix.inputs[7].default_value = (*[c**2.2 for c in hex_rgb(COLOURS[role])], 1.0)
    nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])
    MATERIALS[role] = mat
    return mat


def import_character(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(PACK, 'characters', name + '.glb'))
    new = [o for o in bpy.data.objects if o not in before]
    for o in [o for o in new if o.name.startswith('Icosphere')]:
        new.remove(o)
        bpy.data.objects.remove(o)
    return new


def swatch_of(uv):
    u, v = uv
    return min(int(u * COLS), COLS - 1), min(int((1 - v) * ROWS), ROWS - 1)


def recolour(obj, roles, img, role_for_face=None):
    """Puts each face on its role's material and maps its UVs onto the shading gradient."""
    mesh = obj.data
    uv = mesh.uv_layers.active.data
    slots = []
    face_roles = []
    for poly in mesh.polygons:
        u = sum(uv[i].uv[0] for i in poly.loop_indices) / poly.loop_total
        v = sum(uv[i].uv[1] for i in poly.loop_indices) / poly.loop_total
        sw = swatch_of((u, v))
        role = (role_for_face(poly, roles.get(sw)) if role_for_face else None) or roles.get(sw)
        if role is None:
            raise SystemExit(f'{obj.name}: no role for swatch {sw}')
        face_roles.append(role)
        if role not in slots:
            slots.append(role)
    # Clearing the slots resets every face's index, so set them up before assigning.
    mesh.materials.clear()
    for role in slots:
        mesh.materials.append(role_material(role, img))
    for poly, role in zip(mesh.polygons, face_roles, strict=True):
        poly.material_index = slots.index(role)
        for i in poly.loop_indices:
            # Position within the swatch, 0 at its top, onto the gradient's top-to-bottom.
            depth = (1 - uv[i].uv[1]) * ROWS
            frac = min(max(depth - math.floor(min(depth, ROWS - 1e-6)), 0.0), 1.0)
            uv[i].uv = (0.5, min(max(1 - frac, 0.02), 0.98))


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(WORK_DIR, exist_ok=True)
    img = neutral_image()

    ranger = import_character('Ranger')
    arm = next(o for o in ranger if o.type == 'ARMATURE')
    meshes = {o.name.split('_', 1)[1]: o for o in ranger if o.type == 'MESH'}
    for part in ('Cape', 'Quiver'):
        bpy.data.objects.remove(meshes.pop(part))

    recolour(meshes['Head'], ROLES['Head'], img)
    recolour(meshes['Body'], ROLES['Body'], img)
    for side in ('Left', 'Right'):
        recolour(meshes['Arm' + side], ROLES['Arm'], img)
        leg = meshes['Leg' + side]
        zs = [(leg.matrix_world @ v.co).z for v in leg.data.vertices]
        boot_top = min(zs) + (max(zs) - min(zs)) * BOOT_TOP

        def boots(poly, role, leg=leg, boot_top=boot_top):
            return (
                'boots'
                if role == 'trousers' and (leg.matrix_world @ poly.center).z < boot_top
                else None
            )

        recolour(leg, ROLES['Leg'], img, boots)

    arm.name = 'joao'
    for key, o in meshes.items():
        o.name = 'joao_' + key.lower()
    return arm


def export(arm):
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    for child in arm.children_recursive:
        child.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT_DIR, 'joao.glb'),
        export_format='GLB',
        use_selection=True,
        export_yup=True,
        export_animations=False,
        export_skins=True,
        export_cameras=False,
        export_lights=False,
    )


def preview():
    """Front and three-quarter views of the default look, for checking by eye."""
    scene = bpy.context.scene
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    scene.collection.objects.link(cam)
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 4.4
    target = Vector((0, 0, 1.7))
    cam.location = target + Vector((-6, -14, 4))
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3.5
    sun.rotation_euler = (math.radians(50), 0, math.radians(-30))
    scene.collection.objects.link(sun)
    world = bpy.data.worlds.new('w')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.8, 0.83, 0.88, 1)
    scene.world = world
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = 700, 800
    scene.view_settings.view_transform = 'Standard'
    scene.render.filepath = os.path.join(WORK_DIR, 'joao_preview.png')
    bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    joao = build()
    export(joao)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(WORK_DIR, 'joao.blend'))
    preview()
    print('BUILD OK')
