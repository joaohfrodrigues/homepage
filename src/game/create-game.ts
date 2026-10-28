import * as Phaser from 'phaser'
import { HouseScene, type HouseSceneConfig } from './house-scene'

/** Boots the house inside `parent`. Imported dynamically so Phaser stays client-only. */
export function createHouseGame(parent: HTMLElement, config: HouseSceneConfig): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#141019',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    // Room for the lamps and each screen's row of cones in view (see lighting.ts).
    maxLights: 16,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: parent.clientWidth,
      height: parent.clientHeight,
    },
    // The React shell owns audio for now; skip Phaser's audio context entirely.
    audio: { noAudio: true },
    banner: false,
  })
  game.scene.add('house', HouseScene, true, config)
  if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_E2E === '1') {
    // Handy for poking at the scene from the devtools console; the e2e build
    // (NEXT_PUBLIC_E2E=1, see playwright.config.ts) reads the scene through it too.
    ;(window as unknown as { __house?: Phaser.Game }).__house = game
  }
  return game
}
