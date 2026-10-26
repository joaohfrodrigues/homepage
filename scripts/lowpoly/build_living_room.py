"""
Builds the low-poly living room proof of concept in Blender and exports it as
public/house3d/living-room.glb.

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
        --python scripts/lowpoly/build_living_room.py

Furniture comes from KayKit Furniture Bits (CC0, Kay Lousberg), expected in
assets/kaykit/furniture-bits. Everything the pack lacks (the room
itself, windows, chimney breast, TV, record player, plants, João and Zeno) is
modelled here in the same style: chunky bevelled shapes coloured from a
gradient atlas, lighter at the top of each part and darker at the bottom.

Layout follows the living room in src/game/layout.ts and furnishings.ts, given
more room: 10x10 tiles (5x5 m, the size first planned) instead of 8x8, because
the chunky 3D furniture and characters need two-tile walkways. One tile is
0.75 Blender units, which keeps the pack's furniture at its own scale (its sofa
is 3 units wide, four tiles, 2 m). Blender +Y is north; the glTF export turns
that into three.js -Z, so the page reads tile (lx, ly) as x = lx * TILE,
z = ly * TILE. The page reads which tiles are solid and where the items are
from public/house3d/living-room.json, written alongside the model.

João comes from scripts/lowpoly/build_character.py.

Also saves a .blend (assets/lowpoly-poc/living_room.blend, git-ignored)
and a preview render to assets/lowpoly-poc/preview.png.
"""

import json
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PACK = os.path.join(ROOT, 'assets', 'kaykit', 'furniture-bits', 'gltf')
OUT_DIR = os.path.join(ROOT, 'public', 'house3d')
WORK_DIR = os.path.join(ROOT, 'assets', 'lowpoly-poc')

TILE = 0.75
ROOM = 10  # tiles each way
WALL_H = 4.0
WALL_T = 0.3
CUT_H = 0.3  # near walls are cut down so the camera sees in

# Where everything stands, in tiles: (x, y, w, h) with y running south from the street wall.
WINDOWS = [(1, 2), (7, 2)]  # (first tile, width) along the north wall
CHIMNEY = (3, 4)  # (first tile, width): the TV hangs on it, the media unit stands in front
SOUTH_GAPS = [(4, 2), (7, 3)]  # the kitchen's pocket door, and the open side to the hall
SOFA = (3, 4, 4, 2)
COFFEE_TABLE = (4, 2, 2, 1)
FLOOR_LAMP = (2, 4)
SIDEBOARD = (9, 3, 1, 2)
RUG = (2, 1, 6, 5)
DINING = (1, 7, 3, 2)
# The pack's chairs face south unturned: the north pair as they come, the south pair turned round.
CHAIRS = [
    ('chair_nw', 1, 6, 0),
    ('chair_ne', 3, 6, 0),
    ('chair_sw', 1, 9, 180),
    ('chair_se', 3, 9, 180),
]
PLANTS = {'plant_leafy': (0, 0), 'plant_tree': (9, 0)}
ZENO = (4, 5)
JOAO_START = (7, 7)

# --- Atlas ------------------------------------------------------------------------
# Gradient swatches like the pack's own texture: (top colour, bottom colour).
SWATCHES = [
    ('oak_a', '#e4c497', '#c99d6b'),
    ('oak_b', '#d9b585', '#bb8e5e'),
    ('oak_c', '#ebcfa4', '#d2a877'),
    ('walnut', '#86593b', '#4a3122'),
    ('walnut_light', '#a2714c', '#6b4630'),
    ('terracotta', '#dc8a64', '#a95a3a'),
    ('warmwhite', '#f8f3ea', '#e2d7c4'),
    ('white', '#ffffff', '#d4d9de'),
    ('sky', '#e2f3fb', '#8fc3e6'),
    ('screen', '#3d4754', '#12161b'),
    ('black', '#34343a', '#151518'),
    ('metal', '#d3d8dc', '#7f878f'),
    ('leaf', '#a3d36f', '#3e8a3c'),
    ('leaf_dark', '#76b552', '#2b6a35'),
    ('pot_terracotta', '#e6946a', '#a9532f'),
    ('pot_cream', '#f6eddf', '#cdbfa8'),
    ('rug_terracotta', '#d27b55', '#a24f30'),
    ('rug_cream', '#f1e5cc', '#d2bf9b'),
    ('skin', '#f5cfad', '#d39d78'),
    ('tint', '#ffffff', '#b4b4b4'),
    ('hair_dark', '#553d2c', '#2a1d15'),
    ('eye', '#2a2233', '#1a1520'),
    ('cat_black', '#3f3f47', '#1b1b20'),
    ('cat_white', '#ffffff', '#d3d8de'),
    ('cat_eye', '#c2de62', '#6f9a2a'),
    ('pink', '#f4a7ac', '#d27980'),
    ('red', '#e4604c', '#a8352a'),
    ('brass', '#ecd06a', '#b8922e'),
    ('shade', '#fff8e6', '#e6d3a8'),
    ('soil', '#6b4a35', '#43301f'),
    ('hydraulic', '#ece4d6', '#cfc4b0'),
    ('grey', '#a6acb2', '#6b7178'),
    ('sofa_blue', '#6496b8', '#355a75'),
]
SW_INDEX = {name: i for i, (name, _, _) in enumerate(SWATCHES)}
ATLAS_COLS, ATLAS_ROWS, CELL_W, CELL_H = 16, 4, 64, 128


def hex_rgb(h):
    h = h.lstrip('#')
    return [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]


def build_atlas():
    w, h = ATLAS_COLS * CELL_W, ATLAS_ROWS * CELL_H
    px = np.ones((h, w, 4), dtype=np.float32)
    for i, (_, top, bottom) in enumerate(SWATCHES):
        col, row = i % ATLAS_COLS, i // ATLAS_COLS
        t = np.linspace(0, 1, CELL_H)[:, None]  # 0 at the bottom row, 1 at the top
        rgb = np.array(hex_rgb(bottom)) * (1 - t) + np.array(hex_rgb(top)) * t
        # Images are stored linear in Blender; the PNG is written as sRGB.
        px[row * CELL_H : (row + 1) * CELL_H, col * CELL_W : (col + 1) * CELL_W, :3] = rgb[
            :, None, :
        ]
    img = bpy.data.images.new('house_atlas', w, h, alpha=False)
    img.colorspace_settings.name = 'sRGB'
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw = os.path.join(WORK_DIR, 'house_atlas.png')
    img.file_format = 'PNG'
    img.save()
    img.pack()
    return img


def swatch_uv(name, t):
    i = SW_INDEX[name]
    col, row = i % ATLAS_COLS, i // ATLAS_COLS
    u = (col + 0.5) / ATLAS_COLS
    v0 = (row * CELL_H + 6) / (ATLAS_ROWS * CELL_H)
    v1 = ((row + 1) * CELL_H - 6) / (ATLAS_ROWS * CELL_H)
    return u, v0 + max(0.0, min(1.0, t)) * (v1 - v0)


# --- Materials --------------------------------------------------------------------
MATERIALS = {}


def atlas_material(name, atlas, tint=None):
    """A material on the atlas; `tint` multiplies it (exported as baseColorFactor)."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.9
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = atlas
    tex.interpolation = 'Linear'
    if tint is None:
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    else:
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1.0
        nt.links.new(tex.outputs['Color'], mix.inputs[6])
        mix.inputs[7].default_value = (*hex_rgb(tint), 1.0)
        nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])
    MATERIALS[name] = mat
    return mat


def setup_materials(atlas):
    atlas_material('house_atlas', atlas)
    atlas_material('glass', atlas)


# --- Mesh building ----------------------------------------------------------------


class Part:
    """One shape in one swatch; parts are joined into a piece of furniture."""

    def __init__(self, bm, swatch, mat='house_atlas', t=None):
        self.bm, self.swatch, self.mat, self.t = bm, swatch, mat, t


def _bevel(bm, offset, segments=2):
    if offset <= 0:
        return
    bmesh.ops.bevel(
        bm,
        geom=list(bm.edges),
        offset=offset,
        offset_type='OFFSET',
        segments=segments,
        profile=0.5,
        affect='EDGES',
        clamp_overlap=True,
    )


def box(size, center, swatch, bevel=0.05, segments=2, mat='house_atlas', t=None):
    bm = bmesh.new()
    res = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=res['verts'])
    bmesh.ops.translate(bm, vec=Vector(center), verts=bm.verts)
    _bevel(bm, min(bevel, min(size) * 0.45), segments)
    return Part(bm, swatch, mat, t)


def cyl(
    radius,
    depth,
    center,
    swatch,
    segments=10,
    radius_top=None,
    bevel=0.02,
    mat='house_atlas',
    t=None,
    axis='Z',
):
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=False,
        segments=segments,
        radius1=radius,
        radius2=radius if radius_top is None else radius_top,
        depth=depth,
    )
    if bevel > 0:
        bm.normal_update()
        rims = [e for e in bm.edges if any(abs(f.normal.z) > 0.9 for f in e.link_faces)]
        bmesh.ops.bevel(
            bm,
            geom=rims,
            offset=bevel,
            offset_type='OFFSET',
            segments=1,
            profile=0.5,
            affect='EDGES',
            clamp_overlap=True,
        )
    if axis == 'X':
        bmesh.ops.rotate(
            bm, cent=Vector(), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'), verts=bm.verts
        )
    elif axis == 'Y':
        bmesh.ops.rotate(
            bm, cent=Vector(), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'), verts=bm.verts
        )
    bmesh.ops.translate(bm, vec=Vector(center), verts=bm.verts)
    return Part(bm, swatch, mat, t)


def blob(radius, center, swatch, scale=(1, 1, 1), subdiv=1, mat='house_atlas', t=None, seed=0):
    """A low-poly rounded lump: foliage, a cat's head."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    rng = np.random.default_rng(seed)
    for v in bm.verts:
        v.co *= 1 + (rng.random() - 0.5) * 0.12 if seed else 1
    bmesh.ops.scale(bm, vec=Vector(scale), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(center), verts=bm.verts)
    return Part(bm, swatch, mat, t)


def leaf(length, width, base, yaw, pitch, swatch='leaf'):
    """A diamond-shaped leaf with a little thickness, from `base` outwards."""
    bm = bmesh.new()
    pts = [
        (0, 0, 0),
        (length * 0.45, width / 2, 0.02),
        (length, 0, 0),
        (length * 0.45, -width / 2, 0.02),
    ]
    top = [bm.verts.new((x, y, z + 0.025)) for x, y, z in pts]
    bot = [bm.verts.new((x, y, z - 0.025)) for x, y, z in pts]
    bm.faces.new(top)
    bm.faces.new(list(reversed(bot)))
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new([top[i], bot[i], bot[j], top[j]])
    m = Matrix.Rotation(yaw, 3, 'Z') @ Matrix.Rotation(-pitch, 3, 'Y')
    bmesh.ops.rotate(bm, cent=Vector(), matrix=m, verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(base), verts=bm.verts)
    return Part(bm, swatch, 'house_atlas', None)


def to_object(name, parts, origin=(0, 0, 0)):
    """Joins parts into one mesh object, UV-mapping each to its swatch by height."""
    out = bmesh.new()
    uv_out = out.loops.layers.uv.verify()
    mat_names = []
    for part in parts:
        bm = part.bm
        bm.normal_update()
        zs = [v.co.z for v in bm.verts]
        zmin, zmax = min(zs), max(zs)
        span = max(zmax - zmin, 1e-6)
        if part.mat not in mat_names:
            mat_names.append(part.mat)
        mat_index = mat_names.index(part.mat)
        vmap = {}
        for v in bm.verts:
            vmap[v] = out.verts.new(v.co - Vector(origin))
        for f in bm.faces:
            nf = out.faces.new([vmap[v] for v in f.verts])
            nf.material_index = mat_index
            nf.smooth = False
            for loop in nf.loops:
                z = loop.vert.co.z + origin[2]
                t = part.t if part.t is not None else (z - zmin) / span
                loop[uv_out].uv = swatch_uv(part.swatch, t)
        bm.free()
    mesh = bpy.data.meshes.new(name)
    out.to_mesh(mesh)
    out.free()
    for m in mat_names:
        mesh.materials.append(MATERIALS[m])
    obj = bpy.data.objects.new(name, mesh)
    obj.location = origin
    bpy.context.scene.collection.objects.link(obj)
    return obj


def tile_center(lx, ly, w=1, h=1):
    """Centre of a w x h block of tiles whose north-west tile is (lx, ly)."""
    return Vector(((lx + w / 2) * TILE, -(ly + h / 2) * TILE, 0))


# Regions of the pack's 1024px atlas (x0, x1, y0, y1 from the top) and what they hold.
PACK_REGIONS = [
    (0, 384, 0, 256, 'wood'),
    (384, 640, 0, 256, 'wood_light'),
    (640, 768, 0, 256, 'tan'),
    (768, 896, 0, 256, 'metal'),
    (896, 1024, 0, 256, 'white'),
    (0, 256, 256, 512, 'yellow'),
    (256, 512, 256, 512, 'blue'),
    (512, 896, 256, 512, 'white'),
    (896, 1024, 256, 512, 'orange'),
    (0, 128, 512, 1024, 'white'),
    (128, 256, 512, 768, 'cream'),
    (256, 384, 512, 768, 'black'),
    (384, 512, 512, 768, 'white'),
    (512, 640, 512, 768, 'tan'),
    (640, 768, 512, 768, 'wood'),
    (768, 896, 512, 768, 'leaf_dark'),
    (896, 1024, 512, 768, 'leaf'),
    (128, 1024, 768, 1024, 'grey'),
]
# The house's palette for each: walnut furniture against the oak floor.
PACK_COLOURS = {
    'wood': 'walnut',
    'wood_light': 'walnut_light',
    'tan': 'walnut_light',
    'metal': 'metal',
    'white': 'white',
    'yellow': 'brass',
    'blue': 'sofa_blue',
    'orange': 'terracotta',
    'cream': 'shade',
    'black': 'black',
    'leaf_dark': 'leaf_dark',
    'leaf': 'leaf',
    'grey': 'grey',
}


def remap_pack_uvs(obj, overrides):
    """Moves a pack model onto the house atlas, keeping each part's gradient."""
    colours = {**PACK_COLOURS, **overrides}
    mesh = obj.data
    uv = mesh.uv_layers.active.data
    for loop in mesh.loops:
        u, v = uv[loop.index].uv
        px, py = min(max(u, 0), 0.9999) * 1024, min(max(1 - v, 0), 0.9999) * 1024
        for x0, x1, y0, y1, key in PACK_REGIONS:
            if x0 <= px < x1 and y0 <= py < y1:
                uv[loop.index].uv = swatch_uv(colours[key], 1 - (py - y0) / (y1 - y0))
                break
    mesh.materials.clear()
    mesh.materials.append(MATERIALS['house_atlas'])


def import_pack(model, name, loc, yaw_deg=0.0, scale=(1, 1, 1), colours=None):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(PACK, model + '.gltf'))
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == 'MESH']
    assert len(meshes) == 1, (model, [o.name for o in new])
    obj = meshes[0]
    for o in new:
        if o is not obj:
            bpy.data.objects.remove(o)
    obj.parent = None
    obj.name = name
    obj.location = loc
    obj.rotation_mode = 'XYZ'
    obj.rotation_euler = (0, 0, math.radians(yaw_deg))
    obj.scale = scale
    remap_pack_uvs(obj, colours or {})
    return obj


# --- The room ---------------------------------------------------------------------


def build_floor():
    parts = []
    plank_w = 0.25
    length = ROOM * TILE
    rng = np.random.default_rng(7)
    shades = ['oak_a', 'oak_b', 'oak_c']
    # Planks run front-to-back, towards the street windows.
    for i in range(int(round(length / plank_w))):
        x = i * plank_w + plank_w / 2
        y = 0.0
        while y > -length:
            run = rng.uniform(1.2, 2.6)
            end = max(y - run, -length)
            parts.append(
                box(
                    (plank_w - 0.012, (y - end) - 0.012, 0.08),
                    (x, (y + end) / 2, -0.04),
                    shades[rng.integers(3)],
                    bevel=0.012,
                    segments=1,
                    t=rng.uniform(0.55, 0.9),
                )
            )
            y = end
    # A slab under everything so the cut-away edges read as a floor, not a sheet.
    parts.append(
        box(
            (ROOM * TILE + 2 * WALL_T, ROOM * TILE + 2 * WALL_T, 0.3),
            (ROOM * TILE / 2, -ROOM * TILE / 2, -0.23),
            'walnut',
            bevel=0.03,
            t=0.3,
        )
    )
    return to_object('floor', parts)


def wall_x(x0, x1, y0, y1, z0, z1, swatch='warmwhite'):
    return box(
        (x1 - x0, y1 - y0, z1 - z0),
        ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
        swatch,
        bevel=0.02,
        segments=1,
    )


def south_wall_runs():
    """The stretches of the cut-down south wall between its openings."""
    runs, x = [], -WALL_T
    for gap, width in SOUTH_GAPS:
        runs.append((x, gap * TILE))
        x = (gap + width) * TILE
    if x < ROOM * TILE:
        runs.append((x, ROOM * TILE + WALL_T))
    return runs


def build_walls():
    L = ROOM * TILE
    parts = []
    glass = []
    # North wall, with two tall street windows either side of the chimney breast.
    sill, head = 0.55, 3.45
    windows = [(x * TILE + 0.1, (x + w) * TILE - 0.1) for x, w in WINDOWS]
    xs = [-WALL_T] + [v for w in windows for v in w] + [L + WALL_T]
    for i in range(0, len(xs), 2):
        parts.append(wall_x(xs[i], xs[i + 1], 0, WALL_T, 0, WALL_H))
    for x0, x1 in windows:
        parts.append(wall_x(x0, x1, 0, WALL_T, 0, sill))
        parts.append(wall_x(x0, x1, 0, WALL_T, head, WALL_H))
        # Frame, glazing bars and a stone sill.
        fw = 0.08
        parts.append(
            box(
                (x1 - x0, 0.14, fw), ((x0 + x1) / 2, WALL_T / 2, sill + fw / 2), 'white', bevel=0.02
            )
        )
        parts.append(
            box(
                (x1 - x0, 0.14, fw), ((x0 + x1) / 2, WALL_T / 2, head - fw / 2), 'white', bevel=0.02
            )
        )
        for x in (x0 + fw / 2, (x0 + x1) / 2, x1 - fw / 2):
            parts.append(
                box(
                    (fw, 0.14, head - sill), (x, WALL_T / 2, (sill + head) / 2), 'white', bevel=0.02
                )
            )
        for z in (sill + (head - sill) * 0.36, sill + (head - sill) * 0.7):
            parts.append(
                box((x1 - x0, 0.1, 0.05), ((x0 + x1) / 2, WALL_T / 2, z), 'white', bevel=0.015)
            )
        parts.append(
            box(
                (x1 - x0 + 0.2, 0.32, 0.08),
                ((x0 + x1) / 2, -0.02, sill - 0.04),
                'white',
                bevel=0.03,
            )
        )
        glass.append(
            box(
                (x1 - x0, 0.03, head - sill),
                ((x0 + x1) / 2, WALL_T / 2, (sill + head) / 2),
                'sky',
                bevel=0,
                mat='glass',
            )
        )
    # East wall, full height: the record player stands against it.
    parts.append(wall_x(L, L + WALL_T, -L - WALL_T, WALL_T, 0, WALL_H))
    # Near walls, cut down so the camera can look in: west, and south with the
    # kitchen's pocket door (tiles 2-3) and the opening to the hall (tiles 5-7).
    parts.append(wall_x(-WALL_T, 0, -L - WALL_T, WALL_T, 0, CUT_H))
    south = south_wall_runs()
    for x0, x1 in south:
        parts.append(wall_x(x0, x1, -L - WALL_T, -L, 0, CUT_H))
    # Skirting on the walls the camera sees.
    parts.append(box((L, 0.05, 0.16), (L / 2, -0.025, 0.08), 'white', bevel=0.015, segments=1))
    parts.append(box((0.05, L, 0.16), (L - 0.025, -L / 2, 0.08), 'white', bevel=0.015, segments=1))
    # Cut wall tops in a darker tone, like a dollhouse section.
    for x0, x1, y0, y1 in [(-WALL_T, 0, -L - WALL_T, WALL_T)] + [
        (a, b, -L - WALL_T, -L) for a, b in south
    ]:
        parts.append(
            box(
                (x1 - x0, y1 - y0, 0.02),
                ((x0 + x1) / 2, (y0 + y1) / 2, CUT_H + 0.01),
                'grey',
                bevel=0,
                t=0.6,
            )
        )
    walls = to_object('walls', parts)
    to_object('window_glass', glass)
    return walls


def build_chimney():
    """The limewashed terracotta chimney breast between the windows, tiles 2-5."""
    x0, x1, depth = CHIMNEY[0] * TILE, (CHIMNEY[0] + CHIMNEY[1]) * TILE, 0.3
    parts = [
        box(
            (x1 - x0, depth, WALL_H),
            ((x0 + x1) / 2, -depth / 2 + 0.01, WALL_H / 2),
            'terracotta',
            bevel=0.04,
        ),
        # A plain mantel shelf above the TV.
        box(
            (x1 - x0 + 0.1, depth + 0.12, 0.1),
            ((x0 + x1) / 2, -depth / 2 - 0.05, 3.05),
            'walnut_light',
            bevel=0.03,
        ),
    ]
    return to_object('chimney', parts)


def build_tv():
    """A 55-inch screen on the chimney breast over a low walnut media unit."""
    cx = (CHIMNEY[0] + CHIMNEY[1] / 2) * TILE
    face = -0.3
    unit_d = 0.42
    unit = [
        box((2.7, unit_d, 0.62), (cx, face - unit_d / 2, 0.42), 'walnut', bevel=0.05),
        # Two doors and an open middle shelf.
        box(
            (0.85, 0.04, 0.42), (cx - 0.88, face - unit_d - 0.01, 0.42), 'walnut_light', bevel=0.02
        ),
        box(
            (0.85, 0.04, 0.42), (cx + 0.88, face - unit_d - 0.01, 0.42), 'walnut_light', bevel=0.02
        ),
        box((0.82, 0.05, 0.36), (cx, face - unit_d + 0.02, 0.42), 'black', bevel=0.02, t=0.7),
        box((0.1, 0.05, 0.03), (cx - 0.5, face - unit_d - 0.04, 0.5), 'brass', bevel=0.01),
        box((0.1, 0.05, 0.03), (cx + 0.5, face - unit_d - 0.04, 0.5), 'brass', bevel=0.01),
    ]
    for dx in (-1.2, 1.2):
        unit.append(
            cyl(
                0.05,
                0.12,
                (cx + dx, face - unit_d / 2, 0.06),
                'walnut',
                segments=6,
                radius_top=0.06,
            )
        )
    # A small speaker under the screen in the middle shelf.
    unit.append(box((0.5, 0.2, 0.14), (cx, face - unit_d / 2, 0.36), 'black', bevel=0.03))
    screen = [
        box((1.85, 0.06, 1.06), (cx, face - 0.04, 2.15), 'black', bevel=0.03),
        box((1.75, 0.02, 0.96), (cx, face - 0.075, 2.15), 'screen', bevel=0),
    ]
    to_object('media_unit', unit)
    return to_object('tv', screen)


def build_record_player():
    """The record player on a 1 m walnut sideboard against the east wall, tile (7, 2-3)."""
    c = tile_center(*SIDEBOARD)
    x_back = ROOM * TILE
    depth, length, height = 0.62, 1.4, 0.95
    x = x_back - depth / 2 - 0.02
    y = c.y
    parts = [
        box(
            (depth, length, height - 0.15), (x, y, 0.15 + (height - 0.15) / 2), 'walnut', bevel=0.05
        ),
        box(
            (0.04, length / 2 - 0.08, height - 0.32),
            (x - depth / 2 - 0.01, y + length / 4, 0.55),
            'walnut_light',
            bevel=0.02,
        ),
        box(
            (0.04, length / 2 - 0.08, height - 0.32),
            (x - depth / 2 - 0.01, y - length / 4, 0.55),
            'walnut_light',
            bevel=0.02,
        ),
        box((0.05, 0.03, 0.14), (x - depth / 2 - 0.035, y + 0.07, 0.6), 'brass', bevel=0.01),
        box((0.05, 0.03, 0.14), (x - depth / 2 - 0.035, y - 0.07, 0.6), 'brass', bevel=0.01),
    ]
    for dy in (-length / 2 + 0.1, length / 2 - 0.1):
        for dx in (-depth / 2 + 0.1, depth / 2 - 0.1):
            parts.append(
                cyl(0.04, 0.17, (x + dx, y + dy, 0.085), 'walnut', segments=6, radius_top=0.05)
            )
    top = height
    # Turntable: plinth, platter, record, label and a tonearm.
    tx, ty = x, y + 0.18
    parts += [
        box((0.5, 0.62, 0.1), (tx, ty, top + 0.05), 'walnut_light', bevel=0.03),
        cyl(0.03, 0.08, (tx + 0.17, ty - 0.22, top + 0.14), 'metal', segments=8, bevel=0.005),
        box((0.03, 0.3, 0.025), (tx + 0.14, ty - 0.08, top + 0.17), 'metal', bevel=0.008),
    ]
    # A short stack of record sleeves leaning at the other end.
    for i, sw in enumerate(['red', 'sky', 'brass']):
        parts.append(box((0.32, 0.03, 0.32), (x, y - 0.42 + i * 0.045, top + 0.16), sw, bevel=0.01))
    player = to_object('record_player', parts)
    # The platter is its own object, origin at its spindle, so the page can spin it.
    centre = (tx, ty + 0.03, top + 0.1)
    to_object(
        'record_platter',
        [
            cyl(0.24, 0.03, (tx, ty + 0.03, top + 0.115), 'metal', segments=16, bevel=0.005),
            cyl(0.22, 0.02, (tx, ty + 0.03, top + 0.14), 'black', segments=16, bevel=0),
            cyl(0.07, 0.022, (tx, ty + 0.03, top + 0.142), 'red', segments=10, bevel=0),
            box((0.05, 0.12, 0.024), (tx, ty + 0.03 + 0.11, top + 0.142), 'grey', bevel=0, t=0.9),
        ],
        origin=centre,
    )
    return player


def build_rug():
    """The terracotta rug under the sofa and coffee table, tiles 1-5 x 0-3."""
    c = tile_center(*RUG)
    w, h = RUG[2] * TILE - 0.1, RUG[3] * TILE - 0.25
    parts = [
        box((w, h, 0.04), (c.x, c.y - 0.08, 0.02), 'rug_cream', bevel=0.02, segments=1, t=0.8),
        box(
            (w - 0.28, h - 0.28, 0.05),
            (c.x, c.y - 0.08, 0.025),
            'rug_terracotta',
            bevel=0.02,
            segments=1,
            t=0.75,
        ),
        box(
            (w - 0.6, h - 0.6, 0.055),
            (c.x, c.y - 0.08, 0.028),
            'rug_cream',
            bevel=0.015,
            segments=1,
            t=0.85,
        ),
        box(
            (w - 0.7, h - 0.7, 0.06),
            (c.x, c.y - 0.08, 0.03),
            'rug_terracotta',
            bevel=0.015,
            segments=1,
            t=0.7,
        ),
    ]
    return to_object('rug', parts)


def build_plant_leafy(name, lx, ly):
    """A leafy floor plant in a cream pot."""
    c = tile_center(lx, ly)
    parts = [
        cyl(0.26, 0.5, (c.x, c.y, 0.25), 'pot_cream', segments=10, radius_top=0.3, bevel=0.03),
        cyl(0.26, 0.04, (c.x, c.y, 0.49), 'soil', segments=10, bevel=0),
    ]
    rng = np.random.default_rng(3)
    for i in range(9):
        yaw = i * 2.4 + rng.uniform(-0.2, 0.2)
        h = 0.55 + rng.uniform(0, 0.75)
        stem_top = (c.x + math.cos(yaw) * 0.12, c.y + math.sin(yaw) * 0.12, h)
        parts.append(
            box(
                (0.04, 0.04, h - 0.45),
                (c.x + math.cos(yaw) * 0.06, c.y + math.sin(yaw) * 0.06, 0.45 + (h - 0.45) / 2),
                'leaf_dark',
                bevel=0.01,
                t=0.3,
            )
        )
        parts.append(
            leaf(
                0.55 + rng.uniform(0, 0.2),
                0.32,
                stem_top,
                yaw,
                rng.uniform(0.15, 0.6),
                'leaf' if i % 2 else 'leaf_dark',
            )
        )
    return to_object(name, parts)


def build_plant_tree(name, lx, ly):
    """A tall bushy olive-ish tree in a terracotta pot."""
    c = tile_center(lx, ly)
    parts = [
        cyl(
            0.24, 0.48, (c.x, c.y, 0.24), 'pot_terracotta', segments=10, radius_top=0.29, bevel=0.03
        ),
        box((0.6, 0.6, 0.06), (c.x, c.y, 0.5), 'pot_terracotta', bevel=0.02),
        cyl(0.05, 1.3, (c.x, c.y, 1.1), 'walnut_light', segments=6, radius_top=0.035, bevel=0),
    ]
    for i, (dx, dy, z, r) in enumerate(
        [
            (0, 0, 2.55, 0.42),
            (0.18, 0.06, 2.0, 0.36),
            (-0.16, -0.08, 1.7, 0.32),
            (0.05, -0.15, 2.25, 0.34),
            (-0.12, 0.14, 2.3, 0.3),
        ]
    ):
        parts.append(
            blob(
                r,
                (c.x + dx, c.y + dy, z),
                'leaf' if i % 2 == 0 else 'leaf_dark',
                subdiv=1,
                scale=(1, 1, 0.85),
                seed=i + 1,
            )
        )
    return to_object(name, parts)


# --- People -----------------------------------------------------------------------


def build_zeno():
    """Zeno the tuxedo cat, sitting. His tail is separate so it can flick."""
    root = bpy.data.objects.new('zeno', None)
    bpy.context.scene.collection.objects.link(root)
    body = to_object(
        'zeno_body',
        [
            blob(0.3, (0, 0.05, 0.3), 'cat_black', scale=(0.9, 1.0, 1.15), subdiv=2),
            blob(0.2, (0, -0.16, 0.33), 'cat_white', scale=(0.85, 0.5, 1.2), subdiv=1),
            box((0.1, 0.12, 0.08), (0.1, -0.22, 0.04), 'cat_white', bevel=0.04),
            box((0.1, 0.12, 0.08), (-0.1, -0.22, 0.04), 'cat_white', bevel=0.04),
            blob(0.24, (0, -0.05, 0.72), 'cat_black', scale=(1.05, 0.95, 0.9), subdiv=2),
            blob(0.12, (0, -0.23, 0.66), 'cat_white', scale=(1.1, 0.6, 0.7), subdiv=1),
            box((0.04, 0.03, 0.03), (0, -0.3, 0.7), 'pink', bevel=0.01),
            box((0.07, 0.03, 0.06), (0.09, -0.26, 0.76), 'cat_eye', bevel=0.015),
            box((0.07, 0.03, 0.06), (-0.09, -0.26, 0.76), 'cat_eye', bevel=0.015),
            cyl(0.09, 0.18, (0.13, -0.03, 0.95), 'cat_black', segments=4, radius_top=0.01, bevel=0),
            cyl(
                0.09, 0.18, (-0.13, -0.03, 0.95), 'cat_black', segments=4, radius_top=0.01, bevel=0
            ),
        ],
    )
    body.parent = root
    tail = to_object(
        'zeno_tail',
        [
            box((0.08, 0.08, 0.5), (0.22, 0.28, 0.25), 'cat_black', bevel=0.035),
            box((0.08, 0.08, 0.1), (0.22, 0.28, 0.53), 'cat_white', bevel=0.035),
        ],
        origin=(0.22, 0.28, 0.02),
    )
    tail.parent = root
    return root


# --- Scene ------------------------------------------------------------------------


def furnish():
    # Sofa facing the TV, tiles 2-5 x 2-3; the pack's sofa faces -Y, so turn it.
    import_pack(
        'couch_pillows',
        'sofa',
        tile_center(*SOFA) + Vector((0, -0.05, 0)),
        180,
        colours={'yellow': 'sofa_blue', 'blue': 'terracotta'},
    )
    import_pack(
        'table_low_decorated',
        'coffee_table',
        tile_center(*COFFEE_TABLE) + Vector((0, 0.05, 0)),
        0,
        (0.62, 0.55, 0.85),
    )
    import_pack(
        'lamp_standing',
        'floor_lamp',
        tile_center(*FLOOR_LAMP) + Vector((0, -0.2, 0)),
        0,
        (0.75, 0.75, 0.85),
    )
    # Dining table by the kitchen door, with four chairs.
    import_pack('table_medium_long', 'dining_table', tile_center(*DINING), 0, (0.72, 0.68, 0.95))
    for name, lx, ly, yaw in CHAIRS:
        # Tucked in a little towards the table.
        import_pack(
            'chair_A_wood',
            name,
            tile_center(lx, ly) + Vector((0, -0.12 if yaw == 0 else 0.12, 0)),
            yaw,
        )
    import_pack(
        'cactus_small_A',
        'table_plant',
        tile_center(*DINING) + Vector((0, 0, 0.95)),
        0,
        (0.8, 0.8, 0.8),
    )
    # Over the sideboard on the east wall.
    art_y = tile_center(*SIDEBOARD).y
    import_pack('pictureframe_large_A', 'picture', Vector((ROOM * TILE - 0.01, art_y, 2.3)), -90)
    # A print in it: Lisbon roofs under a low sun.
    x = ROOM * TILE - 0.2  # in front of the frame's backing
    to_object(
        'picture_print',
        [
            box((0.02, 0.78, 0.98), (x, art_y, 2.3), 'shade', bevel=0, t=0.9),
            box((0.025, 0.78, 0.3), (x, art_y, 1.96), 'terracotta', bevel=0),
            box((0.03, 0.2, 0.26), (x, art_y - 0.2, 2.18), 'warmwhite', bevel=0),
            box((0.03, 0.26, 0.36), (x, art_y + 0.13, 2.2), 'pot_cream', bevel=0),
            box((0.03, 0.22, 0.1), (x, art_y + 0.13, 2.42), 'terracotta', bevel=0, t=0.9),
            box((0.03, 0.2, 0.08), (x, art_y - 0.2, 2.35), 'terracotta', bevel=0, t=0.9),
            box((0.03, 0.18, 0.18), (x, art_y + 0.25, 2.6), 'brass', bevel=0.02),
            box((0.02, 0.78, 0.06), (x, art_y, 1.84), 'sofa_blue', bevel=0),
        ],
    )
    import_pack(
        'book_set',
        'tv_books',
        Vector(((CHIMNEY[0] + CHIMNEY[1] / 2) * TILE + 1.0, -0.51, 0.98)),
        0,
        (0.7, 0.7, 0.7),
    )


def build_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(WORK_DIR, exist_ok=True)
    atlas = build_atlas()
    setup_materials(atlas)
    build_floor()
    build_walls()
    build_chimney()
    build_tv()
    build_record_player()
    build_rug()
    for name, (lx, ly) in PLANTS.items():
        (build_plant_leafy if name == 'plant_leafy' else build_plant_tree)(name, lx, ly)
    furnish()
    zeno = build_zeno()
    zeno.location = tile_center(*ZENO) + Vector((0, 0.1, 0.62))  # on the sofa seat
    zeno.rotation_euler = (0, 0, math.radians(200))


def tiles(x, y, w=1, h=1):
    return [[x + dx, y + dy] for dy in range(h) for dx in range(w)]


def write_layout():
    """Solid tiles and where the items are, for the page's walking and interactions."""
    media = tiles(CHIMNEY[0], 0, CHIMNEY[1], 1)
    solid = (
        media
        + [list(p) for p in PLANTS.values()]
        + tiles(*COFFEE_TABLE)
        + tiles(*FLOOR_LAMP)
        + tiles(*SOFA)
        + tiles(*SIDEBOARD)
        + tiles(*DINING)
    )
    layout = {
        'tile': TILE,
        'room': ROOM,
        'solid': solid,
        'items': {
            'tv': media,
            'record': tiles(*SIDEBOARD),
            'zeno': [list(ZENO), [ZENO[0], ZENO[1] - 1]],
            'lamp': tiles(*FLOOR_LAMP),
        },
        'start': list(JOAO_START),
    }
    with open(os.path.join(OUT_DIR, 'living-room.json'), 'w') as f:
        json.dump(layout, f, indent=2)
        f.write('\n')


def export():
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT_DIR, 'living-room.glb'),
        export_format='GLB',
        export_yup=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_extras=False,
        export_animations=False,
    )


def preview():
    """An orthographic render from the south-west, like the page's camera, with João in."""
    scene = bpy.context.scene
    joao_glb = os.path.join(OUT_DIR, 'joao.glb')
    if os.path.exists(joao_glb):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=joao_glb)
        for o in bpy.data.objects:
            if o not in before and o.parent is None:
                o.location = tile_center(*JOAO_START)
                o.scale = (0.7, 0.7, 0.7)
    L = ROOM * TILE
    target = Vector((L / 2, -L / 2 - 0.4, 0.8))
    cam_data = bpy.data.cameras.new('preview')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 13
    cam = bpy.data.objects.new('preview_camera', cam_data)
    scene.collection.objects.link(cam)
    direction = Vector((-1, -1, 1.15)).normalized()
    cam.location = target + direction * 30
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3.5
    sun.data.angle = math.radians(8)
    sun.rotation_euler = (math.radians(50), math.radians(-12), math.radians(200))
    scene.collection.objects.link(sun)
    world = bpy.data.worlds.new('world')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.75, 0.78, 0.85, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
    scene.world = world
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = 1400, 1000
    scene.view_settings.view_transform = 'Standard'
    scene.render.filepath = os.path.join(WORK_DIR, 'preview.png')
    bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    build_scene()
    export()
    write_layout()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(WORK_DIR, 'living_room.blend'))
    if '--no-preview' not in sys.argv:
        preview()
    print('BUILD OK')
