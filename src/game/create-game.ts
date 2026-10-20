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
  if (process.env.NODE_ENV === 'development') {
    // Handy for poking at the scene from the devtools console.
    ;(window as unknown as { __house?: Phaser.Game }).__house = game
  }
  return game
}
