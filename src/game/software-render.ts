import * as Phaser from 'phaser'

/** WebGL drivers that draw on the CPU: Chrome's fallback (and headless default) and Mesa's. */
const SOFTWARE_GL = /swiftshader|llvmpipe|softpipe|software/i

/**
 * Whether the house is drawn on the CPU: a software WebGL driver (VMs, some
 * Linux setups, hardware acceleration turned off) or Phaser's canvas fallback.
 * There every frame costs real CPU, so the scene skips the lit shader and
 * draws fewer frames and a cheaper blur (see house-scene.ts).
 */
export function isSoftwareRenderer(renderer: Phaser.Renderer.Canvas.CanvasRenderer | Phaser.Renderer.WebGL.WebGLRenderer) {
  if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return true
  const gl = renderer.gl
  const info = gl.getExtension('WEBGL_debug_renderer_info')
  const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER))
  return SOFTWARE_GL.test(name)
}
