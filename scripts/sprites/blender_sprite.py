"""Render a 3D model down to a small sprite: a starting point for pixel art.

Blocks in proportions and light on awkward shapes (an espresso machine, a
record player) that are hard to get right pixel by pixel. The render is a
draft: snap it to the palette with `bun run sprites:grid import`, then clean
it up by hand.

Usage:
    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \\
        --python scripts/sprites/blender_sprite.py -- MODEL OUT.png [--size 16x32] \\
        [--elevation 50] [--azimuth 0] [--margin 0]

MODEL is a .glb/.gltf, .obj, .fbx or .blend file. The camera is orthographic,
looking down at the model's front from `elevation` degrees above the floor
(the house's three-quarter view) and turned `azimuth` degrees around it. The
model is fitted to the sprite with `margin` pixels to spare. Rendering uses
flat Workbench shading lit from the top left, no anti-aliasing and a
transparent background, so every pixel is a solid colour.
"""

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Vector


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index('--') + 1 :] if '--' in sys.argv else []
    parser = argparse.ArgumentParser(prog='blender_sprite.py')
    parser.add_argument('model', type=Path)
    parser.add_argument('out', type=Path)
    parser.add_argument('--size', default='16x32', help='WIDTHxHEIGHT in pixels')
    parser.add_argument('--elevation', type=float, default=50.0)
    parser.add_argument('--azimuth', type=float, default=0.0)
    parser.add_argument('--margin', type=int, default=0)
    return parser.parse_args(argv)


def load(model: Path) -> None:
    suffix = model.suffix.lower()
    if suffix == '.blend':
        bpy.ops.wm.open_mainfile(filepath=str(model))
        return
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if suffix in {'.glb', '.gltf'}:
        bpy.ops.import_scene.gltf(filepath=str(model))
    elif suffix == '.obj':
        bpy.ops.wm.obj_import(filepath=str(model))
    elif suffix == '.fbx':
        bpy.ops.import_scene.fbx(filepath=str(model))
    else:
        raise SystemExit(f'Unsupported model type: {suffix}')


def mesh_corners() -> list[Vector]:
    corners = [
        obj.matrix_world @ Vector(corner)
        for obj in bpy.context.scene.objects
        if obj.type == 'MESH' and obj.visible_get()
        for corner in obj.bound_box
    ]
    if not corners:
        raise SystemExit('No visible meshes in the model')
    return corners


def main() -> None:
    args = parse_args()
    width, height = (int(n) for n in args.size.lower().split('x'))
    load(args.model.resolve())
    scene = bpy.context.scene

    corners = mesh_corners()
    centre = sum(corners, Vector()) / len(corners)
    radius = max((c - centre).length for c in corners)

    # Rotation x tilts the camera up from looking straight down; z turns it around the model.
    rotation = Euler((math.radians(90 - args.elevation), 0, math.radians(args.azimuth)))
    forward = rotation.to_matrix() @ Vector((0, 0, -1))
    camera_data = bpy.data.cameras.new('SpriteCamera')
    camera_data.type = 'ORTHO'
    camera_data.sensor_fit = 'HORIZONTAL'
    camera = bpy.data.objects.new('SpriteCamera', camera_data)
    scene.collection.objects.link(camera)
    camera.rotation_euler = rotation
    camera.location = centre - forward * (radius * 4)
    camera_data.clip_end = radius * 10
    bpy.context.view_layer.update()

    # Fit: the model's extent in the camera's own x/y, centred, scaled to the sprite less the margin.
    local = [camera.matrix_world.inverted() @ c for c in corners]
    xs, ys = [p.x for p in local], [p.y for p in local]
    span_x, span_y = max(xs) - min(xs), max(ys) - min(ys)
    inner_w, inner_h = max(1, width - 2 * args.margin), max(1, height - 2 * args.margin)
    units_per_px = max(span_x / inner_w, span_y / inner_h)
    camera_data.ortho_scale = units_per_px * width
    camera_data.shift_x = (max(xs) + min(xs)) / 2 / camera_data.ortho_scale
    camera_data.shift_y = (max(ys) + min(ys)) / 2 / camera_data.ortho_scale
    scene.camera = camera

    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.filter_size = 0
    scene.display.render_aa = 'OFF'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'TEXTURE'
    scene.display.shading.show_cavity = False
    scene.display.shading.show_shadows = False
    scene.display.shading.studiolight_rotate_z = math.radians(-45 + args.azimuth)
    scene.view_settings.view_transform = 'Standard'
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.filepath = str(args.out.resolve())
    args.out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.render.render(write_still=True)
    print(f'Wrote {args.out} ({width}x{height})')


main()
