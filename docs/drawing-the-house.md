# Drawing the house

Furniture has no image files. Each prop is a **grid sprite** in `src/game/sprites/props.ts`: one
character per pixel, each mapped to a palette swatch such as `'walnut.2'` (`.` is transparent, `,`
the drop shadow). Floors, walls, doors and Zeno are still drawn as rectangles in `pixels.ts`.

Rules the unit tests enforce:

- Every prop in `PROP_SIZES` has an entry in `GRID_PROPS`, and each grid fills its box exactly.
- Every swatch comes from `src/game/palette.ts` (named ramps such as `ink`, `walnut`, `oak`, dark
  to light).

Shade by stepping along a ramp, lit from the top left. A prop can have several grids; each copy
picks one by position, so repeats along a wall differ.

## Tools

They live in `scripts/sprites/` and write to `.sprites/` (git-ignored). None need paid software.

```bash
bun run sprites:preview sofa tv                        # contact sheet, 1x and magnified
bun run sprites:preview sofa --limezu palm,bedTeakGrey # LimeZu pieces alongside
bun run sprites:palette                                # props drawing off the palette
bun run sprites:grid export fridge                     # prop → PNG
bun run sprites:grid import some.png                   # PNG → grid, snapped to the palette
```

The usual loop: export a prop, edit the PNG in any pixel editor (LibreSprite and Pixelorama are
free; load `scripts/sprites/house-palette.gpl`), import it, and paste the printed grid into
`props.ts`.

Optional drafts, always imported and cleaned up by hand afterwards:

- **Blender** renders a 3D model at sprite size from the house's camera angle:

    ```bash
    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
        --python scripts/sprites/blender_sprite.py -- model.glb .sprites/model.png --size 32x32
    ```

- **PixelLab** turns text into pixel art: `bun run sprites:ai "an espresso machine" --size 16x32`.
  Needs `PIXELLAB_API_KEY` and is billed per image.
