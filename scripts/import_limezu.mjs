/**
 * Pack the art the house uses from LimeZu's Modern Interiors pack.
 *
 * Usage:
 *     node scripts/import_limezu.mjs ~/path/to/moderninteriors-win
 *
 * The pack's licence allows using the art but not redistributing it, so only
 * these small atlases are committed — never the pack itself. Credit: limezu.itch.io
 *
 * Characters: the pack's Character Generator pieces (bodies, eyes, outfits, hairstyles,
 * accessories) share one sprite-sheet layout and stack in that order. Only the
 * idle and walk rows of the pieces picked below are kept, packed into
 * public/house/characters.png, with a manifest in src/game/character-pieces.json.
 * Each piece's sheet has 16x32 frames. Row 1 is idle and row 2 is walk, each
 * 6 frames per direction in the order right, up, left, down.
 *
 * Furniture: named sprites cut from the pack's 16x16 theme sheets, packed into
 * public/house/limezu-furniture.png with a manifest in src/game/limezu-furniture.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';

const PACK = process.argv[2];
if (!PACK) {
    console.error('usage: node scripts/import_limezu.mjs <moderninteriors folder>');
    process.exit(1);
}
const GENERATOR = join(PACK, '2_Characters/Character_Generator');
const THEMES = join(PACK, '1_Interiors/16x16/Theme_Sorter');

const FRAME_W = 16;
const FRAME_H = 32;
const FRAMES = 24; // 4 directions x 6
const SLOT_W = FRAME_W * FRAMES;
const SLOT_H = FRAME_H * 2; // idle row, walk row
const ATLAS_COLS = 4;

const range = n => Array.from({ length: n }, (_, i) => String(i + 1).padStart(2, '0'));

/** The wardrobe's choices. Each style lists the pack's colour variants of it. */
const PICKS = {
    // The natural skin tones, light to dark; bodies 05, 06, 08 and 09 are yellow, grey, pink and lavender.
    skin: [
        { label: 'Skin', files: ['02', '03', '07', '04', '01'].map(n => `Bodies/16x16/Body_${n}`) },
    ],
    hair: [
        { label: 'Short', id: '01' },
        { label: 'Spiky', id: '03' },
        { label: 'Bob', id: '04' },
        { label: 'Tousled', id: '08' },
        { label: 'Side bob', id: '10' },
        { label: 'Buns', id: '11' },
        { label: 'Long', id: '15' },
        { label: 'Buzz cut', id: '20' },
    ].map(({ label, id }) => ({
        label,
        files: range(7).map(n => `Hairstyles/16x16/Hairstyle_${id}_${n}`),
    })),
    outfit: [
        { label: 'T-shirt', id: '01', variants: 10 },
        { label: 'Jacket', id: '02', variants: 4 },
        { label: 'Hoodie', id: '04', variants: 3 },
        { label: 'Sweatshirt', id: '10', variants: 4 }, // variant 05 has an opaque background
        { label: 'Shirt', id: '13', variants: 4 },
        { label: 'Polo', id: '17', variants: 3 },
        { label: 'Flannel', id: '23', variants: 4 },
        { label: 'Hawaiian', id: '24', variants: 4 },
    ].map(({ label, id, variants }) => ({
        label,
        files: range(variants).map(n => `Outfits/16x16/Outfit_${id}_${n}`),
    })),
    hat: [
        { label: 'Cap', name: '04_Snapback', variants: 6 },
        { label: 'Beanie', name: '11_Beanie', variants: 5 },
        { label: 'Detective', name: '08_Detective_Hat', variants: 3 },
        { label: 'Party hat', name: '19_Party_Cone', variants: 4 },
    ].map(({ label, name, variants }) => ({
        label,
        files: range(variants).map(n => `Accessories/16x16/Accessory_${name}_${n}`),
    })),
    face: [
        { label: 'Glasses', name: '15_Glasses', variants: 6 },
        { label: 'Beard', name: '13_Beard', variants: 5 },
        { label: 'Moustache', name: '12_Mustache', variants: 5 },
    ].map(({ label, name, variants }) => ({
        label,
        files: range(variants).map(n => `Accessories/16x16/Accessory_${name}_${n}`),
    })),
};
const EYES = 'Eyes/16x16/Eyes_01';

/** Rows of the front-facing idle frame that show each part's colour best. */
const SWATCH_ROWS = {
    skin: [12, 20],
    hair: [0, 14],
    outfit: [18, 26],
    hat: [0, 14],
    face: [8, 24],
};

// ---------------------------------------------------------------------------
// PNG (8-bit RGB/RGBA/palette, non-interlaced)

function decode(path) {
    const buf = readFileSync(path);
    let pos = 8;
    let w, h, depth, type, plte, trns;
    const idat = [];
    while (pos < buf.length) {
        const len = buf.readUInt32BE(pos);
        const kind = buf.toString('ascii', pos + 4, pos + 8);
        const data = buf.subarray(pos + 8, pos + 8 + len);
        if (kind === 'IHDR')
            [w, h, depth, type] = [data.readUInt32BE(0), data.readUInt32BE(4), data[8], data[9]];
        if (kind === 'PLTE') plte = data;
        if (kind === 'tRNS') trns = data;
        if (kind === 'IDAT') idat.push(data);
        pos += 12 + len;
    }
    if (depth !== 8) throw new Error(`${path}: unsupported bit depth ${depth}`);
    const bpp = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
    const raw = inflateSync(Buffer.concat(idat));
    const stride = w * bpp;
    const px = new Uint8Array(w * h * 4);
    const line = new Uint8Array(stride);
    const prev = new Uint8Array(stride);
    for (let y = 0; y < h; y++) {
        const filter = raw[y * (stride + 1)];
        for (let x = 0; x < stride; x++) {
            const v = raw[y * (stride + 1) + 1 + x];
            const a = x >= bpp ? line[x - bpp] : 0;
            const b = prev[x];
            const c = x >= bpp ? prev[x - bpp] : 0;
            let pred = 0;
            if (filter === 1) pred = a;
            else if (filter === 2) pred = b;
            else if (filter === 3) pred = (a + b) >> 1;
            else if (filter === 4) {
                const p = a + b - c;
                const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
                pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
            }
            line[x] = (v + pred) & 255;
        }
        for (let x = 0; x < w; x++) {
            const o = (y * w + x) * 4;
            if (type === 6) px.set(line.subarray(x * 4, x * 4 + 4), o);
            else if (type === 2) px.set([line[x * 3], line[x * 3 + 1], line[x * 3 + 2], 255], o);
            else if (type === 3) {
                const i = line[x];
                px.set(
                    [
                        plte[i * 3],
                        plte[i * 3 + 1],
                        plte[i * 3 + 2],
                        trns && i < trns.length ? trns[i] : 255,
                    ],
                    o
                );
            } else if (type === 0) px.set([line[x], line[x], line[x], 255], o);
            else px.set([line[x * 2], line[x * 2], line[x * 2], line[x * 2 + 1]], o);
        }
        prev.set(line);
    }
    return { w, h, px };
}

const CRC = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});
function chunk(type, data) {
    const body = Buffer.concat([Buffer.from(type), data]);
    let c = 0xffffffff;
    for (const byte of body) c = CRC[(c ^ byte) & 255] ^ (c >>> 8);
    const out = Buffer.alloc(8 + data.length + 4);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE((c ^ 0xffffffff) >>> 0, 8 + data.length);
    return out;
}
function encode(path, { w, h, px }) {
    const raw = Buffer.alloc((w * 4 + 1) * h);
    for (let y = 0; y < h; y++)
        raw.set(px.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    writeFileSync(
        path,
        Buffer.concat([
            signature,
            chunk('IHDR', ihdr),
            chunk('IDAT', deflateSync(raw, { level: 9 })),
            chunk('IEND', Buffer.alloc(0)),
        ])
    );
}

// ---------------------------------------------------------------------------
// Packing

/**
 * The colour a part reads as: the most common fill colour in the given rows of
 * the front idle frame (or the whole frame if those rows hold none). Pixels on
 * the silhouette's edge and the frame's outline colour don't count.
 */
function swatch(sheet, [top, bottom], thin = false) {
    const x0 = 18 * FRAME_W;
    const at = (x, y) => (y * sheet.w + x) * 4;
    const opaque = (x, y) => x >= x0 && x < x0 + FRAME_W && sheet.px[at(x, y) + 3] > 200;
    const hex = i =>
        `#${[0, 1, 2].map(k => sheet.px[i + k].toString(16).padStart(2, '0')).join('')}`;
    const count = rows => {
        const fill = new Map();
        const edge = new Map();
        for (let y = FRAME_H + rows[0]; y <= FRAME_H + rows[1]; y++) {
            for (let x = x0; x < x0 + FRAME_W; x++) {
                if (!opaque(x, y)) continue;
                const onEdge = !(
                    opaque(x - 1, y) &&
                    opaque(x + 1, y) &&
                    opaque(x, y - 1) &&
                    opaque(x, y + 1)
                );
                const map = onEdge ? edge : fill;
                map.set(hex(at(x, y)), (map.get(hex(at(x, y))) ?? 0) + 1);
            }
        }
        const outline = [...edge].sort((a, b) => b[1] - a[1])[0]?.[0];
        // Thin parts (moustaches, glasses frames) are mostly edge, and glasses' pale lenses aren't their colour.
        const pool = thin
            ? new Map([...edge, ...fill].filter(([color]) => !/^#([c-f].){3}$/.test(color)))
            : fill;
        return (
            [...pool].filter(([color]) => color !== outline).sort((a, b) => b[1] - a[1])[0]?.[0] ??
            (thin ? outline : undefined)
        );
    };
    return count([top, bottom]) ?? count([0, FRAME_H - 1]) ?? '#888888';
}

const slots = [EYES];
const manifest = {
    frame: { w: FRAME_W, h: FRAME_H },
    slot: { w: SLOT_W, h: SLOT_H },
    columns: ATLAS_COLS,
    eyes: 0,
    parts: {},
};
const sheets = new Map();
for (const [part, styles] of Object.entries(PICKS)) {
    manifest.parts[part] = styles.map(({ label, files }) => ({
        label,
        variants: files.map(file => {
            const sheet = decode(join(GENERATOR, `${file}.png`));
            sheets.set(file, sheet);
            slots.push(file);
            return {
                id: file.split('/').pop(),
                slot: slots.length - 1,
                swatch: swatch(sheet, SWATCH_ROWS[part], part === 'face'),
            };
        }),
    }));
}
sheets.set(EYES, decode(join(GENERATOR, `${EYES}.png`)));

const rows = Math.ceil(slots.length / ATLAS_COLS);
const atlas = {
    w: SLOT_W * ATLAS_COLS,
    h: SLOT_H * rows,
    px: new Uint8Array(SLOT_W * ATLAS_COLS * SLOT_H * rows * 4),
};
slots.forEach((file, i) => {
    const sheet = sheets.get(file);
    const ox = (i % ATLAS_COLS) * SLOT_W;
    const oy = Math.floor(i / ATLAS_COLS) * SLOT_H;
    for (let y = 0; y < SLOT_H; y++) {
        const from = (FRAME_H + y) * sheet.w * 4; // rows 1 and 2 of the sheet
        atlas.px.set(sheet.px.subarray(from, from + SLOT_W * 4), ((oy + y) * atlas.w + ox) * 4);
    }
});

encode('public/house/characters.png', atlas);
writeFileSync('src/game/character-pieces.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(
    `packed ${slots.length} pieces into public/house/characters.png (${atlas.w}x${atlas.h})`
);

// ---------------------------------------------------------------------------
// Furniture

/**
 * Sprites cut from the theme sheets: [sheet, x, y, w, h] in sheet pixels, plus
 * an optional `darken` factor that turns the pack's mid woods into walnut.
 */
const FURNITURE = {
    // Plants
    palm: ['1_Generic_16x16', 212, 408, 23, 31],
    pottedTree: ['1_Generic_16x16', 215, 457, 18, 31],
    leafyPlant: ['1_Generic_16x16', 133, 905, 22, 30],
    tallBush: ['1_Generic_16x16', 113, 908, 14, 29],
    smallBush: ['1_Generic_16x16', 97, 914, 14, 23],
    fern: ['1_Generic_16x16', 224, 1011, 15, 19],
    bigFern: ['1_Generic_16x16', 240, 1021, 16, 25],
    sprig: ['1_Generic_16x16', 227, 984, 9, 13],
    topiary: ['1_Generic_16x16', 115, 1040, 10, 14],
    snakePlant: ['2_LivingRoom_16x16', 2, 86, 12, 14],
    // Living room
    sofaFacingEast: ['2_LivingRoom_16x16', 145, 582, 22, 42],
    sofaFacingWest: ['2_LivingRoom_16x16', 121, 582, 22, 42],
    flatTv: ['23_Television_and_Film_Studio', 161, 17, 46, 21],
    coffeeTable: ['1_Generic_16x16', 221, 561, 22, 21],
    diningTable: ['1_Generic_16x16', 13, 545, 38, 37],
    chairFacingEast: ['12_Kitchen_16x16', 82, 177, 13, 21],
    chairFacingWest: ['12_Kitchen_16x16', 97, 209, 13, 21],
    floorLamp: ['2_LivingRoom_16x16', 193, 200, 13, 33],
};

/** Scales a colour towards black, leaving the pack's dark outline alone. */
function darkenPixel(px, i, amount) {
    if (px[i] + px[i + 1] + px[i + 2] < 200) return;
    for (let k = 0; k < 3; k++) px[i + k] = Math.round(px[i + k] * amount);
}

const furnitureSheets = new Map();
const shelfWidth = 128;
const placed = {};
let [cursorX, cursorY, shelfHeight] = [0, 0, 0];
for (const [name, [sheet, x, y, w, h, darken]] of Object.entries(FURNITURE)) {
    if (!furnitureSheets.has(sheet))
        furnitureSheets.set(sheet, decode(join(THEMES, `${sheet}.png`)));
    if (cursorX + w > shelfWidth)
        [cursorX, cursorY, shelfHeight] = [0, cursorY + shelfHeight + 1, 0];
    placed[name] = { x: cursorX, y: cursorY, w, h, from: { sheet, x, y }, darken };
    cursorX += w + 1;
    shelfHeight = Math.max(shelfHeight, h);
}
const furniture = {
    w: shelfWidth,
    h: cursorY + shelfHeight,
    px: new Uint8Array(shelfWidth * (cursorY + shelfHeight) * 4),
};
for (const { x, y, w, h, from, darken } of Object.values(placed)) {
    const sheet = furnitureSheets.get(from.sheet);
    for (let row = 0; row < h; row++) {
        const start = ((from.y + row) * sheet.w + from.x) * 4;
        const to = ((y + row) * furniture.w + x) * 4;
        furniture.px.set(sheet.px.subarray(start, start + w * 4), to);
        if (darken) for (let i = to; i < to + w * 4; i += 4) darkenPixel(furniture.px, i, darken);
    }
}
encode('public/house/limezu-furniture.png', furniture);
writeFileSync(
    'src/game/limezu-furniture.json',
    JSON.stringify(
        Object.fromEntries(
            Object.entries(placed).map(([name, { x, y, w, h }]) => [name, { x, y, w, h }])
        ),
        null,
        2
    ) + '\n'
);
console.log(
    `packed ${Object.keys(placed).length} furniture sprites into public/house/limezu-furniture.png`
);
