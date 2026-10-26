'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/**
 * Proof of concept: the living room rebuilt in low-poly 3D. The room is
 * public/house3d/living-room.glb with its walkable grid in living-room.json,
 * both from scripts/lowpoly/build_living_room.py. João is joao.glb from
 * scripts/lowpoly/build_character.py, animated by the KayKit animation files
 * next to it. Tile (x, y) of the room is centred at ((x + 0.5) * tile, 0, (y + 0.5) * tile).
 */

const BASE = '/house3d/'
const ANIMATION_FILES = ['Rig_Medium_General.glb', 'Rig_Medium_MovementBasic.glb']
const SPEED = 2.6
const RADIUS = 0.2
/** The pack's people are 3.3 units tall; this puts João at about door-handle-and-a-half next to the furniture. */
const CHAR_SCALE = 0.7
/** Walking_A covers about this much ground per second at normal speed, at CHAR_SCALE. */
const WALK_PACE = 2.2

type Tile = [number, number]
type ItemId = 'tv' | 'record' | 'zeno' | 'lamp'

interface Layout {
  tile: number
  room: number
  solid: Tile[]
  items: Record<ItemId, Tile[]>
  start: Tile
}

interface Item {
  id: ItemId
  label: string
  tiles: Tile[]
  /** Objects in the model that count as this item when clicked. */
  objects: string[]
}

const ITEM_INFO: Record<ItemId, Omit<Item, 'id' | 'tiles'>> = {
  tv: { label: 'TV — what I’m watching', objects: ['tv', 'media_unit', 'chimney'] },
  record: { label: 'Record player — put some music on', objects: ['record_player', 'record_platter'] },
  zeno: { label: 'Zeno — give him a scratch', objects: ['zeno', 'zeno_body', 'zeno_tail'] },
  lamp: { label: 'Floor lamp — switch it on or off', objects: ['floor_lamp'] },
}

const SHIRTS = ['#2f8f8a', '#c8643f', '#e0b24a', '#33507a', '#f2efe8']
const TROUSERS = ['#3d4f6b', '#2d2d33', '#7a6a55', '#5c7a4a']
const HAIR = ['#4a3426', '#1f1a17', '#a8743f', '#d9c08a', '#8a8f96']

interface Look {
  shirt: number
  trousers: number
  hair: number
}

const JOAO: Look = { shirt: 0, trousers: 0, hair: 0 }

/** What the page's controls can reach inside the running scene. */
interface SceneApi {
  setNight: (night: boolean) => void
  setLook: (look: Look) => void
  interact: () => void
}

const key = (x: number, y: number) => `${x},${y}`
const STEPS: Tile[] = [[1, 0], [-1, 0], [0, 1], [0, -1]]

/** Walking over the room's tiles: what's free, paths, and what's within reach. */
function makeGrid(layout: Layout) {
  const { tile, room } = layout
  const solid = new Set(layout.solid.map(([x, y]) => key(x, y)))
  const items: Item[] = (Object.keys(ITEM_INFO) as ItemId[]).map((id) => ({ id, tiles: layout.items[id], ...ITEM_INFO[id] }))
  const walkable = (x: number, y: number) => x >= 0 && y >= 0 && x < room && y < room && !solid.has(key(x, y))
  const centre = (x: number, y: number) => new THREE.Vector3((x + 0.5) * tile, 0, (y + 0.5) * tile)
  const tileOf = (v: THREE.Vector3): Tile => [Math.floor(v.x / tile), Math.floor(v.z / tile)]

  /** Shortest 4-way path over walkable tiles to any goal tile, excluding the start. */
  const findPath = (from: Tile, goals: Set<string>): Tile[] | null => {
    const prev = new Map<string, string | null>([[key(...from), null]])
    const queue: Tile[] = [from]
    while (queue.length) {
      const [x, y] = queue.shift()!
      if (goals.has(key(x, y))) {
        const path: Tile[] = []
        for (let at: string | null = key(x, y); at && at !== key(...from); at = prev.get(at) ?? null) {
          const [px, py] = at.split(',').map(Number)
          path.unshift([px, py])
        }
        return path
      }
      for (const [dx, dy] of STEPS) {
        const next = key(x + dx, y + dy)
        if (!walkable(x + dx, y + dy) || prev.has(next)) continue
        prev.set(next, key(x, y))
        queue.push([x + dx, y + dy])
      }
    }
    return null
  }

  /** Walkable tiles next to an item, where the visitor stands to use it. */
  const standingTiles = (item: Item) => {
    const out = new Set<string>()
    for (const [x, y] of item.tiles) for (const [dx, dy] of STEPS) if (walkable(x + dx, y + dy)) out.add(key(x + dx, y + dy))
    return out
  }

  const nearestItem = (pos: THREE.Vector3): Item | null => {
    let best: Item | null = null
    let bestDist = tile * 1.4
    for (const item of items)
      for (const [x, y] of item.tiles) {
        const d = Math.hypot(pos.x - (x + 0.5) * tile, pos.z - (y + 0.5) * tile)
        if (d < bestDist) [bestDist, best] = [d, item]
      }
    return best
  }

  /** Whether a body of RADIUS at (x, z) overlaps anything solid. */
  const blocked = (x: number, z: number) =>
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].some(([sx, sz]) => !walkable(Math.floor((x + sx * RADIUS) / tile), Math.floor((z + sz * RADIUS) / tile)))

  return { tile, room, items, walkable, centre, tileOf, findPath, standingTiles, nearestItem, blocked }
}

export function LowPolyRoom() {
  const mountRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<SceneApi | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [night, setNight] = useState(false)
  const [look, setLook] = useState<Look>(JOAO)
  const [hint, setHint] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let disposed = false
    let frame = 0

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NeutralToneMapping
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
    // On-screen up and right, flattened onto the floor, for camera-relative walking.
    const screenUp = new THREE.Vector3(1, 0, -1).normalize()
    const screenRight = new THREE.Vector3(1, 0, 1).normalize()

    const hemi = new THREE.HemisphereLight(0xeaf2ff, 0xb08a64, 1.5)
    scene.add(hemi)
    // The sun comes in through the street windows on the north wall.
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.8)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 34 })
    sun.shadow.bias = -0.0008
    sun.shadow.normalBias = 0.05
    scene.add(sun, sun.target)
    const fill = new THREE.DirectionalLight(0xffffff, 0.7)
    scene.add(fill)
    const lampLight = new THREE.PointLight(0xffc77a, 0, 12, 1.4)
    lampLight.castShadow = true
    lampLight.shadow.mapSize.set(1024, 1024)
    lampLight.shadow.bias = -0.004
    lampLight.shadow.normalBias = 0.06
    scene.add(lampLight)

    let roomSize = 7.5
    const resize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      renderer.setSize(w, h)
      const aspect = w / h
      const half = Math.max(roomSize * 0.73, (roomSize * 0.9) / aspect)
      Object.assign(camera, { left: -half * aspect, right: half * aspect, top: half, bottom: -half })
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', resize)

    // --- State the loop reads ---
    const keys = new Set<string>()
    let path: Tile[] = []
    let pendingItem: Item | null = null
    let playing = false
    let lampOn = false
    let isNight = false
    let tailBoost = 0
    let toastTimer = 0
    let lastHint: string | null = null

    const say = (text: string) => {
      setToast(text)
      window.clearTimeout(toastTimer)
      toastTimer = window.setTimeout(() => setToast(null), 3200)
    }

    const cleanups: (() => void)[] = []
    const loader = new GLTFLoader()
    Promise.all([
      fetch(BASE + 'living-room.json').then((r) => r.json() as Promise<Layout>),
      loader.loadAsync(BASE + 'living-room.glb'),
      loader.loadAsync(BASE + 'joao.glb'),
      ...ANIMATION_FILES.map((f) => loader.loadAsync(BASE + f)),
    ]).then(([layout, roomGltf, joaoGltf, ...animGltfs]) => {
      if (disposed) return
      const grid = makeGrid(layout)
      roomSize = grid.room * grid.tile

      const centre = new THREE.Vector3(roomSize / 2, 0.8, roomSize / 2 + 0.4)
      camera.position.copy(centre).add(new THREE.Vector3(-1, 1.15, 1).normalize().multiplyScalar(30))
      camera.lookAt(centre)
      sun.position.copy(centre).add(new THREE.Vector3(1.5, 9, -7))
      sun.target.position.copy(centre)
      fill.position.copy(camera.position)
      resize()

      const root = roomGltf.scene
      scene.add(root)
      const materials = new Map<string, THREE.MeshStandardMaterial>()
      const collect = (o: THREE.Object3D) => {
        if (!(o instanceof THREE.Mesh)) return
        o.castShadow = true
        o.receiveShadow = true
        for (const mat of (Array.isArray(o.material) ? o.material : [o.material]) as THREE.MeshStandardMaterial[]) {
          materials.set(mat.name, mat)
          if (mat.map) mat.map.anisotropy = 4
        }
      }
      root.traverse(collect)
      // Sunlight passes through the glazing.
      root.getObjectByName('window_glass')?.traverse((o) => (o.castShadow = false))
      root.getObjectByName('floor')?.traverse((o) => (o.castShadow = false))

      // João: the pack's skeleton, animated by its shared clips.
      const joao = new THREE.Group()
      const body = joaoGltf.scene
      body.scale.setScalar(CHAR_SCALE)
      // The pack's clips turn the root bone round, so the animated body faces -Z; face it forward again.
      body.rotation.y = Math.PI
      joao.add(body)
      joao.position.copy(grid.centre(...layout.start))
      joao.rotation.y = -Math.PI / 4 // facing the camera
      scene.add(joao)
      body.traverse((o) => {
        collect(o)
        // Skinned meshes move away from their bind-pose bounds; don't cull them on those.
        if (o instanceof THREE.SkinnedMesh) o.frustumCulled = false
      })
      const mixer = new THREE.AnimationMixer(body)
      const clips = animGltfs.flatMap((g) => g.animations)
      const clip = (name: string) => {
        const found = clips.find((c) => c.name === name)!.clone()
        // Keep him where the page puts him: no drifting root.
        found.tracks = found.tracks.filter((t) => !t.name.startsWith('root.position'))
        return found
      }
      const idle = mixer.clipAction(clip('Idle_A'))
      const walk = mixer.clipAction(clip('Walking_A'))
      const use = mixer.clipAction(clip('Interact'))
      use.setLoop(THREE.LoopOnce, 1)
      walk.timeScale = SPEED / WALK_PACE
      let current = idle
      idle.play()
      const playAction = (next: THREE.AnimationAction) => {
        if (next === current) return
        next.reset().fadeIn(0.18).play()
        current.fadeOut(0.18)
        current = next
      }
      mixer.addEventListener('finished', (e) => {
        if (e.action === use) playAction(idle)
      })

      const glass = materials.get('glass')!
      const tail = root.getObjectByName('zeno_tail')!
      const platter = root.getObjectByName('record_platter')!
      const lamp = root.getObjectByName('floor_lamp')!
      // The bulb sits inside the shade; the lamp mustn't shade itself.
      lamp.traverse((o) => (o.castShadow = false))
      const lampBox = new THREE.Box3().setFromObject(lamp)
      lampLight.position.set((lampBox.min.x + lampBox.max.x) / 2, lampBox.max.y - 0.45, (lampBox.min.z + lampBox.max.z) / 2)

      const applyLight = () => {
        hemi.color.set(isNight ? 0x6a78a8 : 0xeaf2ff)
        hemi.groundColor.set(isNight ? 0x2a2230 : 0xb08a64)
        hemi.intensity = isNight ? 0.45 : 1.5
        sun.intensity = isNight ? 0 : 2.8
        fill.intensity = isNight ? 0.12 : 0.7
        lampLight.intensity = lampOn ? (isNight ? 16 : 4) : 0
        glass.emissive.set(isNight ? 0x1b2340 : 0xbfe2f5)
        glass.emissiveIntensity = isNight ? 0.6 : 0.5
        glass.color.set(isNight ? 0x283255 : 0xffffff)
      }

      const interact = (item: Item) => {
        playAction(use)
        if (item.id === 'record') {
          playing = !playing
          say(playing ? 'Now playing — the real house opens the record player panel here.' : 'Record stopped.')
        } else if (item.id === 'lamp') {
          lampOn = !lampOn
          applyLight()
          say(lampOn ? 'Lamp on.' : 'Lamp off.')
        } else if (item.id === 'zeno') {
          tailBoost = 3
          say('Zeno purrs and flicks his tail.')
        } else {
          say('In the real house this opens what I’m watching.')
        }
      }

      const faceItem = (item: Item) => {
        const [x, y] = item.tiles.reduce((a, b) =>
          grid.centre(...a).distanceTo(joao.position) < grid.centre(...b).distanceTo(joao.position) ? a : b,
        )
        const face = grid.centre(x, y).sub(joao.position)
        joao.rotation.y = Math.atan2(face.x, face.z)
      }

      apiRef.current = {
        setNight: (value) => {
          isNight = value
          if (value) lampOn = true
          applyLight()
        },
        setLook: (l) => {
          const shirt = new THREE.Color(SHIRTS[l.shirt])
          materials.get('role_shirt')?.color.copy(shirt)
          // The scarf follows the shirt, a shade darker.
          materials.get('role_scarf')?.color.copy(shirt).multiplyScalar(0.78)
          materials.get('role_trousers')?.color.set(TROUSERS[l.trousers])
          materials.get('role_hair')?.color.set(HAIR[l.hair])
        },
        interact: () => {
          const item = grid.nearestItem(joao.position)
          if (!item) return
          path = []
          faceItem(item)
          interact(item)
        },
      }
      applyLight()
      setLoaded(true)

      // --- Clicking: walk to a tile, or up to an item and use it ---
      const raycaster = new THREE.Raycaster()
      const pointer = new THREE.Vector2()
      const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
      const onPointer = (event: PointerEvent) => {
        const rect = renderer.domElement.getBoundingClientRect()
        pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
        raycaster.setFromCamera(pointer, camera)
        const hit = raycaster.intersectObject(root, true)[0]
        let item: Item | null = null
        for (let o: THREE.Object3D | null = hit?.object ?? null; o && !item; o = o.parent)
          item = grid.items.find((i) => i.objects.includes(o!.name)) ?? null
        const start = grid.tileOf(joao.position)
        if (item) {
          const found = grid.findPath(start, grid.standingTiles(item))
          if (found) {
            path = found
            pendingItem = item
          }
          return
        }
        // Walk to where the click landed first: a click on a wall goes to its foot, not the floor behind it.
        const point = hit?.point ?? raycaster.ray.intersectPlane(floorPlane, new THREE.Vector3())
        if (!point) return
        point.x = THREE.MathUtils.clamp(point.x, 0, roomSize - 0.01)
        point.z = THREE.MathUtils.clamp(point.z, 0, roomSize - 0.01)
        const [tx, ty] = grid.tileOf(point)
        if (!grid.walkable(tx, ty)) return
        path = grid.findPath(start, new Set([key(tx, ty)])) ?? []
        pendingItem = null
      }
      renderer.domElement.addEventListener('pointerdown', onPointer)
      cleanups.push(() => renderer.domElement.removeEventListener('pointerdown', onPointer))

      // --- The loop ---
      const clock = new THREE.Clock()
      const tick = () => {
        frame = requestAnimationFrame(tick)
        const dt = Math.min(clock.getDelta(), 0.05)
        const t = clock.elapsedTime

        const dir = new THREE.Vector3()
        const ix = (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0)
        const iy = (keys.has('ArrowUp') || keys.has('w') ? 1 : 0) - (keys.has('ArrowDown') || keys.has('s') ? 1 : 0)
        if (ix || iy) {
          path = []
          pendingItem = null
          dir.addScaledVector(screenRight, ix).addScaledVector(screenUp, iy).normalize()
        } else if (path.length) {
          const to = grid.centre(...path[0]).sub(joao.position).setY(0)
          if (to.length() < 0.06) {
            path.shift()
            if (!path.length && pendingItem) {
              faceItem(pendingItem)
              interact(pendingItem)
              pendingItem = null
            }
          } else dir.copy(to.normalize())
        }

        if (dir.lengthSq() > 0) {
          const step = SPEED * dt
          const nx = joao.position.x + dir.x * step
          const nz = joao.position.z + dir.z * step
          // Slide along whatever is in the way.
          if (!grid.blocked(nx, joao.position.z)) joao.position.x = nx
          if (!grid.blocked(joao.position.x, nz)) joao.position.z = nz
          const want = Math.atan2(dir.x, dir.z)
          const diff = Math.atan2(Math.sin(want - joao.rotation.y), Math.cos(want - joao.rotation.y))
          joao.rotation.y += diff * Math.min(1, dt * 14)
          playAction(walk)
        } else if (current === walk) playAction(idle)
        mixer.update(dt)

        tailBoost = Math.max(0, tailBoost - dt)
        tail.rotation.z = Math.sin(t * (tailBoost > 0 ? 9 : 1.6)) * (tailBoost > 0 ? 0.45 : 0.18)
        if (playing) platter.rotation.y -= dt * 3.5

        const item = grid.nearestItem(joao.position)
        const label = item ? item.label : null
        if (label !== lastHint) {
          lastHint = label
          setHint(label)
        }
        renderer.render(scene, camera)
      }
      tick()
    })

    const onKeyDown = (event: KeyboardEvent) => {
      const k = event.key.length === 1 ? event.key.toLowerCase() : event.key
      if (k === 'e' || k === ' ' || k === 'Enter') {
        event.preventDefault()
        apiRef.current?.interact()
        return
      }
      if (k.startsWith('Arrow')) event.preventDefault()
      keys.add(k)
    }
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key)
    const onBlur = () => keys.clear()
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      window.clearTimeout(toastTimer)
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      cleanups.forEach((fn) => fn())
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
          const mats = Array.isArray(o.material) ? o.material : [o.material]
          mats.forEach((m: THREE.Material & { map?: THREE.Texture | null }) => {
            m.map?.dispose()
            m.dispose()
          })
        }
      })
      renderer.dispose()
      renderer.domElement.remove()
      apiRef.current = null
    }
  }, [])

  useEffect(() => {
    if (loaded) apiRef.current?.setNight(night)
  }, [night, loaded])

  useEffect(() => {
    if (loaded) apiRef.current?.setLook(look)
  }, [look, loaded])

  const cycle = (part: keyof Look, options: string[]) => setLook((l) => ({ ...l, [part]: (l[part] + 1) % options.length }))

  return (
    <div
      className={`fixed inset-0 overflow-hidden transition-colors duration-700 ${
        night ? 'bg-[linear-gradient(#141827,#262b40)]' : 'bg-[linear-gradient(#cfe1ec,#eef2f4)]'
      }`}
    >
      <div ref={mountRef} className="absolute inset-0 touch-none" aria-label="Low-poly living room" />

      <header className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-3 p-4">
        <div className={`max-w-md rounded-lg px-4 py-3 shadow-sm ${night ? 'bg-white/10 text-white' : 'bg-white/80 text-[#2a2233]'}`}>
          <h1 className="text-base font-semibold">Low-poly living room — proof of concept</h1>
          <p className="mt-1 text-sm opacity-80">
            Arrows / WASD or click to walk. E or Space uses what’s next to you. Click the record player, the lamp or Zeno.
          </p>
        </div>
        <Link
          href="/"
          className={`pointer-events-auto rounded-lg px-3 py-2 text-sm shadow-sm ${night ? 'bg-white/10 text-white' : 'bg-white/80 text-[#2a2233]'}`}
        >
          Back to the pixel house
        </Link>
      </header>

      <aside
        className={`absolute right-4 bottom-4 w-64 rounded-lg p-3 text-sm shadow-sm ${night ? 'bg-white/10 text-white' : 'bg-white/85 text-[#2a2233]'}`}
      >
        <h2 className="mb-2 font-semibold">Wardrobe</h2>
        <div className="grid grid-cols-2 gap-2">
          <Swatch label="Shirt" colour={SHIRTS[look.shirt]} onClick={() => cycle('shirt', SHIRTS)} />
          <Swatch label="Trousers" colour={TROUSERS[look.trousers]} onClick={() => cycle('trousers', TROUSERS)} />
          <Swatch label="Hair" colour={HAIR[look.hair]} onClick={() => cycle('hair', HAIR)} />
          <button type="button" className="rounded border border-current/20 px-2 py-1" onClick={() => setLook(JOAO)}>
            João’s look
          </button>
        </div>
        <button type="button" className="mt-3 w-full rounded border border-current/20 px-2 py-1" onClick={() => setNight((n) => !n)}>
          {night ? 'Switch to day' : 'Switch to night'}
        </button>
      </aside>

      {(hint || toast) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-52 flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-start sm:pl-20">
          {toast && <p className="rounded-lg bg-[#2a2233]/90 px-4 py-2 text-sm text-white">{toast}</p>}
          {hint && !toast && (
            <p className="rounded-lg bg-[#2a2233]/80 px-4 py-2 text-sm text-white">
              <kbd className="mr-2 rounded bg-white/20 px-1.5">E</kbd>
              {hint}
            </p>
          )}
        </div>
      )}

      {!loaded && (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-[#2a2233]/70">Loading the living room…</p>
      )}
    </div>
  )
}

function Swatch({ label, colour, onClick }: { label: string; colour: string; onClick: () => void }) {
  return (
    <button type="button" className="flex items-center gap-2 rounded border border-current/20 px-2 py-1 text-left" onClick={onClick}>
      <span className="inline-block size-3.5 shrink-0 rounded-full border border-black/20" style={{ background: colour }} />
      {label}
    </button>
  )
}
