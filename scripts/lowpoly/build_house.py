"""
Builds the low-poly house in Blender from the layout file, and exports one GLB
per room as public/house3d/house-<room>.glb.

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
        --python scripts/lowpoly/build_house.py
    bun run house3d:compress

The layout (rooms, walls and their openings, furniture, interactables) is
src/game/house3d/house-layout.json, which the /house-3d page reads too; see
src/game/house3d/layout.ts for what each field means. Change a room or move a
piece of furniture there, rebuild, and both the model and the page's walking
grid follow.

Furniture comes from KayKit Furniture Bits (CC0, Kay Lousberg), expected in
assets/kaykit/furniture-bits. Everything the pack lacks (the walls and floors,
windows, chimney breast, TV, record player, plants and Zeno) is modelled here in
the same style: chunky bevelled shapes coloured from a gradient atlas, lighter
at the top of each part and darker at the bottom.

One tile is 0.75 Blender units (0.5 m), which keeps the pack's furniture at its
own scale (its sofa is 3 units wide, four tiles, 2 m). Blender +Y is north; the
glTF export turns that into three.js -Z, so tile (x, y) of the layout is
centred at x = (x + 0.5) * TILE, y = -(y + 0.5) * TILE here.

The flat's outer south and west walls are cut down, dollhouse-style, so the
camera sees in from the south-west. Every inner wall is its own object,
`wall-<id>` with its origin on the floor (and `lintel-<id>-<n>` over its
doors), so the page can lower the ones that hide the player.

Each room's file holds its floor, its furniture and the walls it owns: walls
next to the hall go in the hall's file, which the page loads first; any other
wall goes with its north or west room.

João comes from scripts/lowpoly/build_character.py.

Also saves a .blend (assets/lowpoly-poc/house.blend, git-ignored), a top-down
plan render with each room's size (assets/lowpoly-poc/plan.png) and a preview
from the page's camera angle (assets/lowpoly-poc/preview.png); pass
--no-preview to skip the renders.
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
LAYOUT_FILE = os.path.join(ROOT, 'src', 'game', 'house3d', 'house-layout.json')
OUT_DIR = os.path.join(ROOT, 'public', 'house3d')
WORK_DIR = os.path.join(ROOT, 'assets', 'lowpoly-poc')

with open(LAYOUT_FILE) as f:
    LAYOUT = json.load(f)
SCALE = LAYOUT['scale']
TILE = SCALE['tile']
WALL_H = SCALE['wallHeight']
WALL_T = SCALE['outerWall']
INNER_T = SCALE['innerWall']
CUT_H = SCALE['cutHeight']
DOOR_H = SCALE['doorHeight']
ROOMS = {room['id']: room for room in LAYOUT['rooms']}
# The hall loads first, so it owns every wall it touches.
FIRST_ROOM = 'hall'

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
    # Wall finishes, one per room (see FloorKind and WallKind in src/game/layout.ts).
    ('azulejo', '#e3edf7', '#a9c1dc'),
    ('library', '#8aa894', '#53705d'),
    ('sage', '#cbd8bf', '#97aa8c'),
    ('bath', '#eaf3f4', '#b9d1d6'),
    ('metro', '#f7f6f2', '#d3d6d4'),
    ('facade', '#f3e3c4', '#d4b98e'),
    # Floor finishes.
    ('hydraulic_b', '#8fb0c8', '#5d7f99'),
    ('bath_tile', '#f4f8f9', '#c9d8dc'),
    ('grout', '#b9b2a6', '#8e877b'),
    ('stone', '#ece6da', '#c2b8a6'),
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


# --- Floors -----------------------------------------------------------------------


def room_box(room):
    """A room's floor in Blender units: x0, x1 east; y0 (north edge), y1 (south edge), y0 > y1."""
    x, y, w, h = room['rect']
    return x * TILE, (x + w) * TILE, -y * TILE, -(y + h) * TILE


def touches_outside(room):
    """Which sides of the room are the flat's outer walls: (west, east, north, south)."""
    x, y, w, h = room['rect']
    width = max(r['rect'][0] + r['rect'][2] for r in LAYOUT['rooms'])
    height = max(r['rect'][1] + r['rect'][3] for r in LAYOUT['rooms'])
    return x == 0, x + w == width, y == 0, y + h == height


def planks(room, across):
    """Oak planks, front-to-back towards the street windows, or east-west if `across`."""
    x0, x1, y0, y1 = room_box(room)
    plank_w = 0.25
    # Lay them out along `length` in a local frame, then turn that onto the room.
    width, length = (y0 - y1, x1 - x0) if across else (x1 - x0, y0 - y1)
    rng = np.random.default_rng(7 + sum(room['rect']))
    shades = ['oak_a', 'oak_b', 'oak_c']
    parts = []
    for i in range(int(round(width / plank_w))):
        a = i * plank_w + plank_w / 2
        b = 0.0
        while b < length - 1e-6:
            run = rng.uniform(1.2, 2.6)
            end = min(b + run, length)
            size = (plank_w - 0.012, (end - b) - 0.012, 0.08)
            centre = (a, (b + end) / 2)
            if across:
                size = (size[1], size[0], size[2])
                centre = (x0 + centre[1], y0 - centre[0])
            else:
                centre = (x0 + centre[0], y0 - centre[1])
            parts.append(
                box(
                    size,
                    (centre[0], centre[1], -0.04),
                    shades[rng.integers(3)],
                    bevel=0.012,
                    segments=1,
                    t=rng.uniform(0.55, 0.9),
                )
            )
            b = end
    return parts


def floor_tiles(room, size, pattern):
    """Square tiles over grout; `pattern(i, j)` picks each tile's swatch and shade."""
    x0, x1, y0, y1 = room_box(room)
    nx, ny = int(round((x1 - x0) / size)), int(round((y0 - y1) / size))
    parts = [
        box(
            (x1 - x0, y0 - y1, 0.06), ((x0 + x1) / 2, (y0 + y1) / 2, -0.05), 'grout', bevel=0, t=0.5
        )
    ]
    for i in range(nx):
        for j in range(ny):
            swatch, t = pattern(i, j)
            parts.append(
                box(
                    (size - 0.03, size - 0.03, 0.05),
                    (x0 + (i + 0.5) * size, y0 - (j + 0.5) * size, -0.025),
                    swatch,
                    bevel=0.01,
                    segments=1,
                    t=t,
                )
            )
    return parts


def hydraulic(i, j):
    """Lisbon cement tiles: a blue rosette every other tile on cream."""
    if (i + j) % 2 == 0:
        return 'hydraulic', 0.8
    return 'hydraulic_b', 0.75


def build_floor(room):
    kind = room['floor']
    if kind in ('oak', 'oak-across'):
        parts = planks(room, kind == 'oak-across')
    elif kind == 'hydraulic':
        parts = floor_tiles(room, TILE / 2, hydraulic)
    elif kind == 'bath':
        parts = floor_tiles(
            room, TILE / 3, lambda i, j: ('bath_tile', 0.7 + 0.1 * ((i * 7 + j * 3) % 3) / 2)
        )
    else:  # balcony: terracotta squares
        parts = floor_tiles(
            room, TILE / 2, lambda i, j: ('pot_terracotta', 0.45 + 0.1 * ((i + 2 * j) % 3) / 2)
        )
    # A slab under everything so the cut-away edges read as a floor, not a sheet.
    x0, x1, y0, y1 = room_box(room)
    west, east, north, south = touches_outside(room)
    x0 -= WALL_T if west else 0
    x1 += WALL_T if east else 0
    y0 += WALL_T if north else 0
    y1 -= WALL_T if south else 0
    parts.append(
        box(
            (x1 - x0, y0 - y1, 0.3),
            ((x0 + x1) / 2, (y0 + y1) / 2, -0.23),
            'stone' if room['floor'] == 'balcony' else 'walnut',
            bevel=0.03,
            t=0.3,
        )
    )
    obj = to_object('floor-' + room['id'], parts)
    return [obj]


# --- Walls ------------------------------------------------------------------------

WALL_SWATCH = {
    'warmwhite': 'warmwhite',
    'azulejo': 'azulejo',
    'library': 'library',
    'sage': 'sage',
    'bath': 'bath',
    'metro': 'metro',
    # The balcony is outside: the walls it shares with the flat are the façade.
    'railing': 'facade',
}


def is_outer(wall):
    return wall['rooms'][0] is None or wall['rooms'][1] is None


def is_cut(wall):
    """The flat's outer south and west walls, cut down so the camera sees in."""
    return wall['rooms'][1] is None if wall['axis'] == 'h' else wall['rooms'][0] is None


def is_railing(wall):
    return is_outer(wall) and ROOMS[wall['rooms'][0] or wall['rooms'][1]]['wall'] == 'railing'


def owner(wall):
    rooms = [r for r in wall['rooms'] if r]
    return FIRST_ROOM if FIRST_ROOM in rooms else rooms[0]


def side_swatch(wall, side):
    """The finish on one face of a wall: side 0 faces north/west, 1 south/east."""
    room = wall['rooms'][side]
    return WALL_SWATCH[ROOMS[room]['wall']] if room else 'warmwhite'


def wbox(wall, u0, u1, w0, w1, z0, z1, swatch, bevel=0.02, **kw):
    """A box in the wall's own frame: u along it, w across it (+ south or east), z up; all in units."""
    line = wall['at'] * TILE
    if wall['axis'] == 'h':
        size = (u1 - u0, w1 - w0, z1 - z0)
        centre = ((u0 + u1) / 2, -(line + (w0 + w1) / 2), (z0 + z1) / 2)
    else:
        size = (w1 - w0, u1 - u0, z1 - z0)
        centre = (line + (w0 + w1) / 2, -(u0 + u1) / 2, (z0 + z1) / 2)
    return box(size, centre, swatch, bevel=bevel, segments=1, **kw)


def wall_ends(wall):
    """How far each end of the wall reaches past its line ends, in units (negative pulls it back)."""
    inner = [w for w in LAYOUT['walls'] if not is_outer(w)]
    ends = []
    for end in (wall['from'], wall['to']):
        same_line = [
            w
            for w in LAYOUT['walls']
            if w is not wall
            and w['axis'] == wall['axis']
            and w['at'] == wall['at']
            and end in (w['from'], w['to'])
            and is_outer(w) == is_outer(wall)
        ]
        across = [
            w
            for w in inner
            if w['axis'] != wall['axis']
            and w['at'] == end
            and any(a <= wall['at'] <= b for a, b in wall_runs(w))
        ]
        if is_outer(wall):
            # Outer walls running east-west close the flat's corners.
            ends.append(WALL_T if wall['axis'] == 'h' and not same_line else 0.0)
        elif wall['axis'] == 'h':
            ends.append(INNER_T / 2 if across and not same_line else 0.0)
        else:
            # North-south inner walls stop short of the east-west walls they meet.
            ends.append(-INNER_T / 2 if across else 0.0)
    return ends


def wall_runs(wall):
    """The stretches between doors and openings, in tiles; windows don't break a run."""
    gaps = sorted((o for o in wall['openings'] if o['kind'] != 'window'), key=lambda o: o['from'])
    runs, at = [], wall['from']
    for gap in gaps:
        if gap['from'] > at:
            runs.append((at, gap['from']))
        at = gap['from'] + gap['width']
    if at < wall['to']:
        runs.append((at, wall['to']))
    return runs


def build_window(wall, u0, u1, w_out, w_in, parts, glass):
    """A tall street window: frame, glazing bars and a stone sill. `w_out` is the outside face."""
    sill, head, fw = 0.55, 3.45, 0.08
    mid = (w_out + w_in) / 2
    parts.append(
        wbox(wall, u0, u1, w_out, w_in, 0, sill, side_swatch(wall, 1 if w_in > w_out else 0))
    )
    parts.append(
        wbox(wall, u0, u1, w_out, w_in, head, WALL_H, side_swatch(wall, 1 if w_in > w_out else 0))
    )
    parts.append(wbox(wall, u0, u1, mid - 0.07, mid + 0.07, sill, sill + fw, 'white'))
    parts.append(wbox(wall, u0, u1, mid - 0.07, mid + 0.07, head - fw, head, 'white'))
    for u in (u0 + fw / 2, (u0 + u1) / 2, u1 - fw / 2):
        parts.append(
            wbox(wall, u - fw / 2, u + fw / 2, mid - 0.07, mid + 0.07, sill, head, 'white')
        )
    for z in (sill + (head - sill) * 0.36, sill + (head - sill) * 0.7):
        parts.append(
            wbox(wall, u0, u1, mid - 0.05, mid + 0.05, z - 0.025, z + 0.025, 'white', bevel=0.015)
        )
    inward = 1 if w_in > w_out else -1
    parts.append(
        wbox(
            wall,
            u0 - 0.1,
            u1 + 0.1,
            *sorted((w_in - inward * 0.14, w_in + inward * 0.18)),
            sill - 0.08,
            sill,
            'white',
            bevel=0.03,
        )
    )
    glass.append(
        wbox(wall, u0, u1, mid - 0.015, mid + 0.015, sill, head, 'sky', bevel=0, mat='glass')
    )


def build_railing(wall):
    """A wrought-iron balcony railing on a stone edge, instead of a wall."""
    ends = wall_ends(wall)
    u0, u1 = wall['from'] * TILE - ends[0], wall['to'] * TILE + ends[1]
    w0, w1 = (-WALL_T, 0) if wall['rooms'][0] is None else (0, WALL_T)
    height = 1.65
    parts = [
        wbox(wall, u0, u1, w0, w1, 0, 0.12, 'stone', bevel=0.02),
        wbox(wall, u0, u1, w0 + 0.08, w1 - 0.08, height - 0.06, height, 'black', bevel=0.02),
        wbox(wall, u0, u1, w0 + 0.11, w1 - 0.11, 0.24, 0.29, 'black', bevel=0.01),
    ]
    n = int((u1 - u0) / 0.16)
    for i in range(n + 1):
        u = u0 + 0.04 + i * (u1 - u0 - 0.08) / n
        parts.append(
            wbox(
                wall,
                u - 0.02,
                u + 0.02,
                w0 + 0.13,
                w1 - 0.13,
                0.12,
                height - 0.06,
                'black',
                bevel=0,
            )
        )
    return to_object('railing-' + wall['id'], parts)


def wall_across(wall):
    """The wall's faces across its line, in units: inner walls straddle it, outer ones stand outside."""
    if not is_outer(wall):
        return -INNER_T / 2, INNER_T / 2
    return (-WALL_T, 0) if wall['rooms'][0] is None else (0, WALL_T)


def build_run(wall, a, b, parts, glass):
    """One stretch of wall between doors (tiles a to b), with any windows in it."""
    T = TILE
    w0, w1 = wall_across(wall)
    cut = is_cut(wall)
    top = CUT_H if cut else WALL_H
    ends = wall_ends(wall)
    u0 = a * T - (ends[0] if a == wall['from'] else 0)
    u1 = b * T + (ends[1] if b == wall['to'] else 0)
    # The faces a room sees take its finish; an outer wall shows only its room's.
    room_side = 0 if wall['rooms'][0] else 1
    # Split the run round its windows: full wall between, window pieces in them.
    cuts, spans = [u0], []
    for o in wall['openings']:
        wu0, wu1 = o['from'] * T + 0.1, (o['from'] + o['width']) * T - 0.1
        if o['kind'] == 'window' and u0 < wu0 and wu1 < u1:
            spans.append((wu0, wu1))
            cuts += [wu0, wu1]
    cuts.append(u1)
    for sa, sb in zip(cuts[::2], cuts[1::2], strict=True):
        if is_outer(wall):
            parts.append(wbox(wall, sa, sb, w0, w1, 0, top, side_swatch(wall, room_side)))
        else:
            parts.append(wbox(wall, sa, sb, w0, 0, 0, top, side_swatch(wall, 0)))
            parts.append(wbox(wall, sa, sb, 0, w1, 0, top, side_swatch(wall, 1)))
    for wu0, wu1 in spans:
        if cut:
            # Cut down: the wall below the sill, and the sill itself, mark the window.
            parts.append(wbox(wall, wu0, wu1, w0, w1, 0, top - 0.04, side_swatch(wall, room_side)))
            parts.append(
                wbox(
                    wall,
                    wu0 - 0.1,
                    wu1 + 0.1,
                    w0 - 0.04,
                    w1 + 0.04,
                    top - 0.04,
                    top + 0.04,
                    'white',
                    bevel=0.02,
                )
            )
        else:
            w_out, w_in = (w0, w1) if wall['rooms'][0] is None else (w1, w0)
            build_window(wall, wu0, wu1, w_out, w_in, parts, glass)
    if cut:
        # Cut wall tops in a darker tone, like a dollhouse section.
        parts.append(wbox(wall, u0, u1, w0, w1, top, top + 0.02, 'grey', bevel=0, t=0.6))
        return
    # Skirting on each face that a room sees.
    for side, (wa, wb) in ((0, (w0 - 0.05, w0)), (1, (w1, w1 + 0.05))):
        if wall['rooms'][side]:
            parts.append(wbox(wall, a * T, b * T, wa, wb, 0, 0.16, 'white', bevel=0.015))


def build_wall(wall):
    """One wall: its runs between doors, windows, skirting, and a lintel over each door."""
    if is_railing(wall):
        return [build_railing(wall)]
    parts, glass = [], []
    for a, b in wall_runs(wall):
        build_run(wall, a, b, parts, glass)
    origin = wall_origin(wall)
    made = [to_object('wall-' + wall['id'], parts, origin=origin)]
    if glass:
        made.append(to_object('glass-' + wall['id'], glass))
    if is_cut(wall):
        return made
    w0, w1 = wall_across(wall)
    mid = (w0 + w1) / 2
    doors = [o for o in wall['openings'] if o['kind'] == 'door']
    for n, o in enumerate(doors):
        u0, u1 = o['from'] * TILE, (o['from'] + o['width']) * TILE
        lintel = [
            wbox(wall, u0, u1, w0, mid, DOOR_H, WALL_H, side_swatch(wall, 0)),
            wbox(wall, u0, u1, mid, w1, DOOR_H, WALL_H, side_swatch(wall, 1)),
        ]
        made.append(to_object(f'lintel-{wall["id"]}-{n}', lintel, origin=origin))
    return made


def wall_origin(wall):
    """Halfway along the wall's line, on the floor: the page lowers walls about this point."""
    mid = (wall['from'] + wall['to']) / 2 * TILE
    line = wall['at'] * TILE
    return (mid, -line, 0) if wall['axis'] == 'h' else (line, -mid, 0)


def room_face(room, side):
    """Where the inside face of one of the room's walls stands, in Blender units (x or y)."""
    x0, x1, y0, y1 = room_box(room)
    west, east, north, south = touches_outside(room)
    half = INNER_T / 2
    return {
        'west': x0 + (0 if west else half),
        'east': x1 - (0 if east else half),
        'north': y0 - (0 if north else half),
        'south': y1 + (0 if south else half),
    }[side]


# --- Furniture --------------------------------------------------------------------


def rect_center(rect):
    return tile_center(*rect)


def build_chimney(item, room):
    """The limewashed terracotta chimney breast between the street windows."""
    x, _, w, _ = item['rect']
    x0, x1, depth = x * TILE, (x + w) * TILE, 0.3
    face = room_face(room, 'north')
    parts = [
        box(
            (x1 - x0, depth, WALL_H),
            ((x0 + x1) / 2, face - depth / 2 + 0.01, WALL_H / 2),
            'terracotta',
            bevel=0.04,
        ),
        # A plain mantel shelf above the TV.
        box(
            (x1 - x0 + 0.1, depth + 0.12, 0.1),
            ((x0 + x1) / 2, face - depth / 2 - 0.05, 3.05),
            'walnut_light',
            bevel=0.03,
        ),
    ]
    return [to_object('chimney_breast', parts)]


def build_tv(item, room):
    """A 55-inch screen on the chimney breast over a low walnut media unit."""
    cx = rect_center(item['rect']).x
    face = room_face(room, 'north') - 0.3
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
    return [to_object('media_unit', unit), to_object('tv_screen', screen)]


def build_record_player(item, room):
    """The record player on a 1 m walnut sideboard against the east wall."""
    c = rect_center(item['rect'])
    x_back = room_face(room, 'east')
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
    player = to_object('record_player_body', parts)
    # The platter is its own object, origin at its spindle, so the page can spin it.
    centre = (tx, ty + 0.03, top + 0.1)
    platter = to_object(
        'record_platter',
        [
            cyl(0.24, 0.03, (tx, ty + 0.03, top + 0.115), 'metal', segments=16, bevel=0.005),
            cyl(0.22, 0.02, (tx, ty + 0.03, top + 0.14), 'black', segments=16, bevel=0),
            cyl(0.07, 0.022, (tx, ty + 0.03, top + 0.142), 'red', segments=10, bevel=0),
            box((0.05, 0.12, 0.024), (tx, ty + 0.03 + 0.11, top + 0.142), 'grey', bevel=0, t=0.9),
        ],
        origin=centre,
    )
    return [player, platter]


def build_picture(item, room):
    """A large frame over the sideboard on the east wall, with a print: Lisbon roofs under a low sun."""
    art_y = rect_center(item['rect']).y
    face = room_face(room, 'east')
    frame = import_pack(
        'pictureframe_large_A', 'picture_frame', Vector((face - 0.01, art_y, 2.3)), -90
    )
    x = face - 0.2  # in front of the frame's backing
    print_ = to_object(
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
    return [frame, print_]


def build_rug(item, _room):
    """The terracotta rug under the sofa and coffee table."""
    rect = item['rect']
    c = rect_center(rect)
    w, h = rect[2] * TILE - 0.1, rect[3] * TILE - 0.25
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
    return [to_object('rug_mesh', parts)]


def build_plant_leafy(item, _room):
    """A leafy floor plant in a cream pot."""
    c = rect_center(item['rect'])
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
    return [to_object(item['id'] + '_mesh', parts)]


def build_plant_tree(item, _room):
    """A tall bushy olive-ish tree in a terracotta pot."""
    c = rect_center(item['rect'])
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
    return [to_object(item['id'] + '_mesh', parts)]


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

BUILDERS = {
    'chimney': build_chimney,
    'tv': build_tv,
    'record_player': build_record_player,
    'picture': build_picture,
    'rug': build_rug,
    'plant_leafy': build_plant_leafy,
    'plant_tree': build_plant_tree,
}


def build_furniture(item):
    """One piece of furniture, named by its id: a pack model, or an empty over a builder's parts."""
    model = item['model']
    offset = item.get('offset', [0, 0, 0])
    at = rect_center(item['rect']) + Vector((offset[0], -offset[1], offset[2]))
    if model.startswith('pack:'):
        return import_pack(
            model[len('pack:') :],
            item['id'],
            at,
            item.get('rotation', 0),
            tuple(item.get('scale', (1, 1, 1))),
            item.get('colours'),
        )
    if model == 'zeno':
        zeno = build_zeno()
        zeno.location = at
        zeno.rotation_euler = (0, 0, math.radians(item.get('rotation', 0)))
        return zeno
    root = bpy.data.objects.new(item['id'], None)
    bpy.context.scene.collection.objects.link(root)
    for obj in BUILDERS[model](item, ROOMS[item['room']]):
        obj.parent = root
    return root


def build_scene():
    """Builds the flat; returns the objects that go in each room's file."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(WORK_DIR, exist_ok=True)
    atlas = build_atlas()
    setup_materials(atlas)
    members = {room_id: [] for room_id in ROOMS}
    for room in LAYOUT['rooms']:
        members[room['id']] += build_floor(room)
    for wall in LAYOUT['walls']:
        members[owner(wall)] += build_wall(wall)
    for item in LAYOUT['furniture']:
        members[item['room']].append(build_furniture(item))
    return members


def export(members):
    for room_id, objects in members.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:
            for o in [obj, *obj.children_recursive]:
                o.select_set(True)
        bpy.ops.export_scene.gltf(
            filepath=os.path.join(OUT_DIR, f'house-{room_id}.glb'),
            export_format='GLB',
            use_selection=True,
            export_yup=True,
            export_apply=True,
            export_cameras=False,
            export_lights=False,
            export_extras=False,
            export_animations=False,
        )


def flat_size():
    width = max(r['rect'][0] + r['rect'][2] for r in LAYOUT['rooms'])
    height = max(r['rect'][1] + r['rect'][3] for r in LAYOUT['rooms'])
    return width * TILE, height * TILE


def render_setup(path, resolution, background=(0.75, 0.78, 0.85)):
    scene = bpy.context.scene
    if 'sun' not in bpy.data.objects:
        sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
        sun.data.energy = 3.5
        sun.data.angle = math.radians(8)
        sun.rotation_euler = (math.radians(50), math.radians(-12), math.radians(200))
        scene.collection.objects.link(sun)
        world = bpy.data.worlds.new('world')
        world.use_nodes = True
        world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
        scene.world = world
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (*background, 1)
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = resolution
    scene.view_settings.view_transform = 'Standard'
    scene.render.filepath = path


def ortho_camera(name, target, direction, ortho_scale):
    cam_data = bpy.data.cameras.new(name)
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = ortho_scale
    cam = bpy.data.objects.new(name, cam_data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = target + direction.normalized() * 30
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = cam
    return cam


def preview_plan():
    """A top-down render of the flat with each room's name and size, for agreeing the plan."""
    W, H = flat_size()
    label_mat = bpy.data.materials.new('label')
    label_mat.use_nodes = True
    label_mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (
        0.12,
        0.09,
        0.15,
        1,
    )
    for room in LAYOUT['rooms']:
        _, _, w, h = room['rect']
        curve = bpy.data.curves.new('label-' + room['id'], 'FONT')
        curve.body = f'{room["name"]}\n{w / 2:g} x {h / 2:g} m'
        curve.align_x = 'CENTER'
        curve.align_y = 'CENTER'
        curve.size = 0.42 if w > 4 else 0.3
        curve.materials.append(label_mat)
        label = bpy.data.objects.new('label-' + room['id'], curve)
        label.location = rect_center(room['rect']) + Vector((0, 0, WALL_H + 0.2))
        bpy.context.scene.collection.objects.link(label)
        # A card under the label so it reads over furniture.
        card = to_object(
            'card-' + room['id'],
            [box((2.4 if w > 4 else 1.7, 1.0, 0.02), (0, 0, 0), 'white', bevel=0.08, t=1)],
        )
        card.location = label.location - Vector((0, 0, 0.05))
    ortho_camera('plan_camera', Vector((W / 2, -H / 2, 0)), Vector((0, 0, 1)), max(W, H) + 1.5)
    render_setup(
        os.path.join(WORK_DIR, 'plan.png'), (1400, int(1400 * (H + 1.5) / (W + 1.5))), (1, 1, 1)
    )
    bpy.ops.render.render(write_still=True)
    for room in LAYOUT['rooms']:
        bpy.data.objects.remove(bpy.data.objects['label-' + room['id']])
        bpy.data.objects.remove(bpy.data.objects['card-' + room['id']])


def preview():
    """An orthographic render from the south-west, like the page's camera, with João at the door."""
    joao_glb = os.path.join(OUT_DIR, 'joao.glb')
    if os.path.exists(joao_glb):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=joao_glb)
        for o in bpy.data.objects:
            if o not in before and o.parent is None:
                o.location = tile_center(*LAYOUT['spawn'])
                o.scale = (0.7, 0.7, 0.7)
    W, H = flat_size()
    ortho_camera('preview_camera', Vector((W / 2, -H / 2 - 0.4, 0.8)), Vector((-1, -1, 1.15)), 22)
    render_setup(os.path.join(WORK_DIR, 'preview.png'), (1600, 1200))
    bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    members = build_scene()
    export(members)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(WORK_DIR, 'house.blend'))
    if '--no-preview' not in sys.argv:
        preview_plan()
        preview()
    print('BUILD OK')
