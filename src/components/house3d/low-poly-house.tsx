'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { HouseBridge } from '@/game/bridge'
import type { Direction, RoomId } from '@/game/layout'
import { LAYOUT, isOuter, makeGrid, tileKey, wallRuns, type Interactable3d, type Tile } from '@/game/house3d/layout'
import * as sfx from '../house/sfx'
import { TouchControls } from '../house/touch-controls'
import { RoomMap } from './room-map'

/**
 * Work in progress: the house rebuilt in low-poly 3D (issue #131). The flat
 * comes from src/game/house3d/house-layout.json, built in Blender by
 * scripts/lowpoly/build_house.py into one GLB per room in public/house3d/. The
 * hall loads first, so the visitor can start walking while the other rooms
 * arrive. João is joao.glb from scripts/lowpoly/build_character.py, animated by
 * the clips in joao-animations.glb.
 *
 * The camera looks in from the south-west and follows João. The flat's outer
 * south and west walls are cut down for good; inner walls stay full height and
 * drop only while they stand between him and the camera.
 */

const BASE = '/house3d/'
/** The hall first: it's where the visitor arrives. */
const ROOM_ORDER: RoomId[] = ['hall', ...LAYOUT.rooms.map((r) => r.id).filter((id) => id !== 'hall')]
const SPEED = 2.6
const RADIUS = 0.2
/** The pack's people are 3.3 units tall; this puts João at about door-handle-and-a-half next to the furniture. */
const CHAR_SCALE = 0.7
/** Walking_A covers about this much ground per second at normal speed, at CHAR_SCALE. */
const WALK_PACE = 2.2
/** Half the shorter side of the view, in units: about one room across on a phone held upright. */
const VIEW = 5.6
/** The camera looks in from here (south-west and above), towards what it follows. */
const CAMERA_DIR = new THREE.Vector3(-1, 1.15, 1).normalize()
/** How long a wall stays down after it last hid João, so walking along one doesn't make it flicker. */
const WALL_HOLD = 0.5
/** Points on João checked for walls in the way: [height in units, sideways offset]. */
const SIGHT_POINTS = [
  [0.25, 0],
  [1.1, 0],
  [2.0, 0],
  [1.1, -0.35],
  [1.1, 0.35],
]

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
  teleport: (room: RoomId) => void
}

/**
 * Rendering settings by device. Phones get a lower pixel ratio, a smaller
 * shadow map with hard edges, and no shadows from the lamp (a point light's
 * shadow renders the scene six more times).
 */
function quality() {
  const phone = window.matchMedia('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 600
  return phone
    ? { pixelRatio: Math.min(window.devicePixelRatio, 1.5), shadowMap: 1024, shadowType: THREE.PCFShadowMap, lampShadow: false }
    : { pixelRatio: Math.min(window.devicePixelRatio, 2), shadowMap: 2048, shadowType: THREE.PCFSoftShadowMap, lampShadow: true }
}

/**
 * An inner wall the page lowers while it hides João: its boxes at full height
 * (checked whatever it's scaled to), and its objects once its room has loaded.
 */
interface CutAway {
  boxes: THREE.Box3[]
  objects: THREE.Object3D[]
  lintels: THREE.Object3D[]
  hiddenAt: number
  level: number
}

function cutAways(): Map<string, CutAway> {
  const { tile: T, wallHeight: H, innerWall, doorHeight } = LAYOUT.scale
  const walls = new Map<string, CutAway>()
  for (const wall of LAYOUT.walls) {
    if (isOuter(wall)) continue
    const line = wall.at * T
    const span = (a: number, b: number, y0: number) =>
      wall.axis === 'h'
        ? new THREE.Box3(new THREE.Vector3(a * T, y0, line - innerWall / 2), new THREE.Vector3(b * T, H, line + innerWall / 2))
        : new THREE.Box3(new THREE.Vector3(line - innerWall / 2, y0, a * T), new THREE.Vector3(line + innerWall / 2, H, b * T))
    const boxes = wallRuns(wall).map(([a, b]) => span(a, b, 0))
    for (const o of wall.openings) if (o.kind === 'door') boxes.push(span(o.from, o.from + o.width, doorHeight))
    walls.set(wall.id, { boxes, objects: [], lintels: [], hiddenAt: -Infinity, level: 1 })
  }
  return walls
}

export function LowPolyHouse() {
  const mountRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<SceneApi | null>(null)
  const mapOpenRef = useRef(false)
  const bridge = useMemo(() => new HouseBridge(), [])
  const [loaded, setLoaded] = useState(false)
  const [night, setNight] = useState(false)
  const [look, setLook] = useState<Look>(JOAO)
  const [hint, setHint] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [room, setRoom] = useState<RoomId | null>(null)
  const [mapOpen, setMapOpen] = useState(false)
  const [coarse, setCoarse] = useState(false)

  useEffect(() => {
    mapOpenRef.current = mapOpen
  }, [mapOpen])

  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)')
    const update = () => setCoarse(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let disposed = false
    let frame = 0
    const settings = quality()

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(settings.pixelRatio)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = settings.shadowType
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NeutralToneMapping
    mount.appendChild(renderer.domElement)

    const grid = makeGrid()
    const T = grid.tile
    const centre = (x: number, y: number) => new THREE.Vector3((x + 0.5) * T, 0, (y + 0.5) * T)
    const tileOf = (v: THREE.Vector3): Tile => [Math.floor(v.x / T), Math.floor(v.z / T)]
    const flatWidth = Math.max(...LAYOUT.rooms.map((r) => r.rect[0] + r.rect[2])) * T
    const flatDepth = Math.max(...LAYOUT.rooms.map((r) => r.rect[1] + r.rect[3])) * T

    const scene = new THREE.Scene()
    const house = new THREE.Group()
    scene.add(house)
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
    // On-screen up and right, flattened onto the floor, for camera-relative walking.
    const screenUp = new THREE.Vector3(1, 0, -1).normalize()
    const screenRight = new THREE.Vector3(1, 0, 1).normalize()

    const hemi = new THREE.HemisphereLight(0xeaf2ff, 0xb08a64, 1.5)
    scene.add(hemi)
    // The sun comes in through the street windows on the north wall. Its shadow
    // box follows the camera, recentred in jumps so the shadows don't shimmer.
    const SUN_OFFSET = new THREE.Vector3(1.5, 9, -7)
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.8)
    sun.castShadow = true
    sun.shadow.mapSize.set(settings.shadowMap, settings.shadowMap)
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 36 })
    sun.shadow.bias = -0.0008
    sun.shadow.normalBias = 0.05
    scene.add(sun, sun.target)
    const sunCentre = new THREE.Vector3(Infinity, 0, 0)
    const fill = new THREE.DirectionalLight(0xffffff, 0.7)
    fill.position.copy(CAMERA_DIR).multiplyScalar(30)
    scene.add(fill)
    const lampLight = new THREE.PointLight(0xffc77a, 0, 12, 1.4)
    lampLight.castShadow = settings.lampShadow
    lampLight.shadow.mapSize.set(1024, 1024)
    lampLight.shadow.bias = -0.004
    lampLight.shadow.normalBias = 0.06
    scene.add(lampLight)

    // --- Camera: follows João, zoomed so a room fills a phone's width ---
    const focus = new THREE.Vector3()
    let zoom = 1
    const resize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      renderer.setSize(w, h)
      const aspect = w / h
      const half = Math.max(VIEW, VIEW / aspect) / zoom
      Object.assign(camera, { left: -half * aspect, right: half * aspect, top: half, bottom: -half })
      camera.updateProjectionMatrix()
    }
    const placeCamera = () => {
      camera.position.copy(focus).addScaledVector(CAMERA_DIR, 30)
      camera.lookAt(focus)
      if (focus.distanceTo(sunCentre) > 1.5) {
        sunCentre.copy(focus)
        sun.position.copy(focus).add(SUN_OFFSET)
        sun.target.position.copy(focus)
      }
    }
    resize()
    window.addEventListener('resize', resize)
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      zoom = THREE.MathUtils.clamp(zoom * Math.exp(-event.deltaY * 0.001), 0.6, 1.8)
      resize()
    }
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false })

    // --- State the loop reads ---
    const keys = new Set<string>()
    let pad: Direction | null = null
    let path: Tile[] = []
    let pendingItem: Interactable3d | null = null
    let playing = false
    let lampOn = false
    let isNight = false
    let tailBoost = 0
    let toastTimer = 0
    let lastHint: string | null = null
    let lastRoom: RoomId | null = null
    let lastTile = ''

    const say = (text: string) => {
      setToast(text)
      window.clearTimeout(toastTimer)
      toastTimer = window.setTimeout(() => setToast(null), 3200)
    }

    // --- The house, room by room ---
    const materials = new Map<string, THREE.MeshStandardMaterial[]>()
    const named = new Map<string, THREE.Object3D>()
    const walls = cutAways()
    const collect = (o: THREE.Object3D) => {
      named.set(o.name, o)
      if (!(o instanceof THREE.Mesh)) return
      // Sunlight passes through the glazing, and floors have nothing under them to shade.
      o.castShadow = !o.name.startsWith('glass-') && !o.name.startsWith('floor-')
      o.receiveShadow = true
      for (const mat of (Array.isArray(o.material) ? o.material : [o.material]) as THREE.MeshStandardMaterial[]) {
        materials.set(mat.name, [...(materials.get(mat.name) ?? []), mat])
        if (mat.map) mat.map.anisotropy = 4
      }
    }
    const addRoom = (root: THREE.Object3D) => {
      house.add(root)
      root.traverse((o) => {
        collect(o)
        if (o.name.startsWith('wall-')) walls.get(o.name.slice('wall-'.length))?.objects.push(o)
        const lintel = /^lintel-(.+)-\d+$/.exec(o.name)
        if (lintel) walls.get(lintel[1])?.lintels.push(o)
      })
    }

    const items = LAYOUT.interactables
    /** The item João can reach from where he stands: the nearest one within a step, in the same room. */
    const nearestItem = (pos: THREE.Vector3) => {
      const here = grid.roomAt(...tileOf(pos))
      let best: Interactable3d | null = null
      let bestDist = T * 1.4
      for (const item of items)
        for (const [x, y] of item.tiles) {
          const d = Math.hypot(pos.x - (x + 0.5) * T, pos.z - (y + 0.5) * T)
          if (d < bestDist && grid.roomAt(x, y) === here) [bestDist, best] = [d, item]
        }
      return best
    }
    /** Which interactable a clicked mesh belongs to, walking up from it to its piece of furniture. */
    const itemOf = (object: THREE.Object3D | null) => {
      for (let o = object; o; o = o.parent) {
        const item = items.find((i) => i.furniture.includes(o!.name))
        if (item) return item
      }
      return null
    }

    const cleanups: (() => void)[] = [bridge.ui.on('padDirection', (direction) => (pad = direction))]
    const loader = new GLTFLoader()
    loader.setMeshoptDecoder(MeshoptDecoder)
    const roomFile = (id: RoomId) => loader.loadAsync(`${BASE}house-${id}.glb`)

    Promise.all([loader.loadAsync(BASE + 'joao.glb'), loader.loadAsync(BASE + 'joao-animations.glb'), roomFile(ROOM_ORDER[0])]).then(
      ([joaoGltf, animGltf, firstRoom]) => {
        if (disposed) return
        addRoom(firstRoom.scene)

        // João: the pack's skeleton, animated by its shared clips.
        const joao = new THREE.Group()
        const body = joaoGltf.scene
        body.scale.setScalar(CHAR_SCALE)
        // The animated body faces +Z, so joao.rotation.y = atan2(dir.x, dir.z) points him along dir.
        joao.add(body)
        joao.position.copy(centre(...LAYOUT.spawn))
        joao.rotation.y = -Math.PI / 4 // facing the camera
        scene.add(joao)
        body.traverse((o) => {
          collect(o)
          // Skinned meshes move away from their bind-pose bounds; don't cull them on those.
          if (o instanceof THREE.SkinnedMesh) o.frustumCulled = false
        })
        const mixer = new THREE.AnimationMixer(body)
        const clip = (name: string) => {
          const found = animGltf.animations.find((c) => c.name === name)!.clone()
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

        focus.copy(joao.position).setY(0.8)
        placeCamera()

        const placeLamp = () => {
          const lamp = named.get('floor_lamp')
          if (!lamp) return
          // The bulb sits inside the shade; the lamp mustn't shade itself.
          lamp.traverse((o) => (o.castShadow = false))
          const box = new THREE.Box3().setFromObject(lamp)
          lampLight.position.set((box.min.x + box.max.x) / 2, box.max.y - 0.45, (box.min.z + box.max.z) / 2)
        }

        const applyLight = () => {
          hemi.color.set(isNight ? 0x6a78a8 : 0xeaf2ff)
          hemi.groundColor.set(isNight ? 0x2a2230 : 0xb08a64)
          hemi.intensity = isNight ? 0.45 : 1.5
          sun.intensity = isNight ? 0 : 2.8
          fill.intensity = isNight ? 0.12 : 0.7
          lampLight.intensity = lampOn ? (isNight ? 16 : 4) : 0
          for (const glass of materials.get('glass') ?? []) {
            glass.emissive.set(isNight ? 0x1b2340 : 0xbfe2f5)
            glass.emissiveIntensity = isNight ? 0.6 : 0.5
            glass.color.set(isNight ? 0x283255 : 0xffffff)
          }
        }

        // The rest of the flat loads behind the scenes.
        for (const id of ROOM_ORDER.slice(1))
          roomFile(id).then((gltf) => {
            if (disposed) return
            addRoom(gltf.scene)
            if (id === 'living') placeLamp()
            applyLight()
          })

        const interact = (item: Interactable3d) => {
          playAction(use)
          if (item.id === 'recordplayer') {
            playing = !playing
            sfx.pop()
            say(playing ? 'Now playing — the real house opens the record player panel here.' : 'Record stopped.')
          } else if (item.id === 'lamp') {
            lampOn = !lampOn
            sfx.lightSwitch()
            applyLight()
            say(lampOn ? 'Lamp on.' : 'Lamp off.')
          } else if (item.id === 'zeno') {
            tailBoost = 3
            sfx.meow()
            say('Zeno purrs and flicks his tail.')
          } else {
            sfx.pop()
            say('In the real house this opens what I’m watching.')
          }
        }

        const faceItem = (item: Interactable3d) => {
          const [x, y] = item.tiles.reduce((a, b) => (centre(...a).distanceTo(joao.position) < centre(...b).distanceTo(joao.position) ? a : b))
          const face = centre(x, y).sub(joao.position)
          joao.rotation.y = Math.atan2(face.x, face.z)
        }

        apiRef.current = {
          setNight: (value) => {
            isNight = value
            if (value) lampOn = true
            applyLight()
          },
          setLook: (l) => {
            const set = (name: string, colour: THREE.Color) => materials.get(name)?.forEach((m) => m.color.copy(colour))
            const shirt = new THREE.Color(SHIRTS[l.shirt])
            set('role_shirt', shirt)
            // The scarf follows the shirt, a shade darker.
            set('role_scarf', shirt.clone().multiplyScalar(0.78))
            set('role_trousers', new THREE.Color(TROUSERS[l.trousers]))
            set('role_hair', new THREE.Color(HAIR[l.hair]))
          },
          interact: () => {
            const item = nearestItem(joao.position)
            if (!item) return
            path = []
            faceItem(item)
            interact(item)
          },
          teleport: (id) => {
            joao.position.copy(centre(...LAYOUT.rooms.find((r) => r.id === id)!.spawn))
            joao.rotation.y = -Math.PI / 4
            path = []
            pendingItem = null
            focus.copy(joao.position).setY(0.8)
            placeCamera()
          },
        }
        applyLight()
        setLoaded(true)

        // --- Clicking or tapping: walk to a tile, or up to an item and use it ---
        const raycaster = new THREE.Raycaster()
        const pointer = new THREE.Vector2()
        const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
        const pointAt = (clientX: number, clientY: number) => {
          const rect = renderer.domElement.getBoundingClientRect()
          pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
          raycaster.setFromCamera(pointer, camera)
          const hit = raycaster.intersectObject(house, true)[0]
          const item = itemOf(hit?.object ?? null)
          const start = tileOf(joao.position)
          if (item) {
            const found = grid.findPath(start, grid.standingTiles(item.tiles))
            if (found) {
              path = found
              pendingItem = item
            }
            return
          }
          // Walk to where the click landed first: a click on a wall goes to its foot, not the floor behind it.
          const point = hit?.point ?? raycaster.ray.intersectPlane(floorPlane, new THREE.Vector3())
          if (!point) return
          point.x = THREE.MathUtils.clamp(point.x, 0, flatWidth - 0.01)
          point.z = THREE.MathUtils.clamp(point.z, 0, flatDepth - 0.01)
          const [tx, ty] = tileOf(point)
          if (!grid.walkable(tx, ty)) return
          path = grid.findPath(start, new Set([tileKey(tx, ty)])) ?? []
          pendingItem = null
        }
        const onPointer = (event: PointerEvent) => {
          // Touches land on the touch controls' layer, which hands taps over the bridge.
          if (event.pointerType !== 'touch') pointAt(event.clientX, event.clientY)
        }
        renderer.domElement.addEventListener('pointerdown', onPointer)
        cleanups.push(
          () => renderer.domElement.removeEventListener('pointerdown', onPointer),
          bridge.ui.on('tapAt', ({ x, y }) => pointAt(x, y)),
        )

        // --- The loop ---
        const clock = new THREE.Clock()
        const ray = new THREE.Ray(new THREE.Vector3(), CAMERA_DIR)
        const target = new THREE.Vector3()
        const cutLevel = LAYOUT.scale.cutHeight / LAYOUT.scale.wallHeight
        const tick = () => {
          frame = requestAnimationFrame(tick)
          const dt = Math.min(clock.getDelta(), 0.05)
          const t = clock.elapsedTime

          const dir = new THREE.Vector3()
          const held = (arrow: string, letter: string, direction: Direction) => keys.has(arrow) || keys.has(letter) || pad === direction
          const ix = (held('ArrowRight', 'd', 'right') ? 1 : 0) - (held('ArrowLeft', 'a', 'left') ? 1 : 0)
          const iy = (held('ArrowUp', 'w', 'up') ? 1 : 0) - (held('ArrowDown', 's', 'down') ? 1 : 0)
          if (ix || iy) {
            path = []
            pendingItem = null
            dir.addScaledVector(screenRight, ix).addScaledVector(screenUp, iy).normalize()
          } else if (path.length) {
            const to = centre(...path[0]).sub(joao.position).setY(0)
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
            if (!grid.blocked(nx, joao.position.z, RADIUS)) joao.position.x = nx
            if (!grid.blocked(joao.position.x, nz, RADIUS)) joao.position.z = nz
            const want = Math.atan2(dir.x, dir.z)
            const diff = Math.atan2(Math.sin(want - joao.rotation.y), Math.cos(want - joao.rotation.y))
            joao.rotation.y += diff * Math.min(1, dt * 14)
            playAction(walk)
          } else if (current === walk) playAction(idle)
          mixer.update(dt)

          // A soft footstep each tile, and the room he's in for the HUD.
          const [tx, ty] = tileOf(joao.position)
          if (tileKey(tx, ty) !== lastTile) {
            if (lastTile && current === walk) sfx.step()
            lastTile = tileKey(tx, ty)
            const here = grid.roomAt(tx, ty)?.id ?? null
            if (here && here !== lastRoom) {
              lastRoom = here
              setRoom(here)
            }
          }

          focus.lerp(target.copy(joao.position).setY(0.8), 1 - Math.exp(-dt * 5))
          placeCamera()

          // Lower the inner walls between João and the camera, and raise them again once he's clear.
          for (const [height, side] of SIGHT_POINTS) {
            ray.origin.copy(joao.position).addScaledVector(screenRight, side).setY(height)
            for (const wall of walls.values()) if (wall.boxes.some((b) => ray.intersectsBox(b))) wall.hiddenAt = t
          }
          for (const wall of walls.values()) {
            const want = t - wall.hiddenAt < WALL_HOLD ? cutLevel : 1
            if (wall.level === want) continue
            wall.level = Math.abs(want - wall.level) < 0.002 ? want : wall.level + (want - wall.level) * (1 - Math.exp(-dt * 12))
            for (const o of wall.objects) o.scale.y = wall.level
            for (const o of wall.lintels) {
              o.scale.y = wall.level
              o.visible = wall.level > 0.85
            }
          }

          tailBoost = Math.max(0, tailBoost - dt)
          const tail = named.get('zeno_tail')
          if (tail) tail.rotation.z = Math.sin(t * (tailBoost > 0 ? 9 : 1.6)) * (tailBoost > 0 ? 0.45 : 0.18)
          const platter = named.get('record_platter')
          if (playing && platter) platter.rotation.y -= dt * 3.5

          const item = nearestItem(joao.position)
          const label = item ? item.label : null
          if (label !== lastHint) {
            lastHint = label
            setHint(label)
          }
          renderer.render(scene, camera)
        }
        tick()
      },
    )

    const onKeyDown = (event: KeyboardEvent) => {
      if (mapOpenRef.current) return
      const k = event.key.length === 1 ? event.key.toLowerCase() : event.key
      if (k === 'm') {
        keys.clear()
        setMapOpen(true)
        return
      }
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
      renderer.domElement.removeEventListener('wheel', onWheel)
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
  }, [bridge])

  useEffect(() => {
    if (loaded) apiRef.current?.setNight(night)
  }, [night, loaded])

  useEffect(() => {
    if (loaded) apiRef.current?.setLook(look)
  }, [look, loaded])

  const cycle = (part: keyof Look, options: string[]) => setLook((l) => ({ ...l, [part]: (l[part] + 1) % options.length }))
  const panel = night ? 'bg-white/10 text-white' : 'bg-white/80 text-[#2a2233]'
  const roomName = room ? LAYOUT.rooms.find((r) => r.id === room)?.name : null

  return (
    <div
      className={`fixed inset-0 overflow-hidden transition-colors duration-700 ${
        night ? 'bg-[linear-gradient(#141827,#262b40)]' : 'bg-[linear-gradient(#cfe1ec,#eef2f4)]'
      }`}
    >
      <div ref={mountRef} className="absolute inset-0 touch-none" aria-label="Low-poly house" />
      {loaded && coarse && !mapOpen && <TouchControls bridge={bridge} />}

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 sm:p-4">
        <div className={`max-w-md rounded-lg px-3 py-2 shadow-sm sm:px-4 sm:py-3 ${panel}`}>
          <h1 className="text-sm font-semibold sm:text-base">Low-poly house — work in progress</h1>
          <p className="text-sm" data-testid="room-name">
            {roomName ?? ' '}
          </p>
          <p className="mt-1 hidden text-sm opacity-80 sm:block">
            Arrows / WASD or click to walk. E or Space uses what’s next to you. M jumps to a room.
          </p>
        </div>
        <div className="pointer-events-auto flex shrink-0 gap-2">
          <button type="button" className={`rounded-lg px-3 py-2 text-sm shadow-sm ${panel}`} onClick={() => setMapOpen(true)}>
            Rooms
          </button>
          <Link href="/" className={`rounded-lg px-3 py-2 text-sm shadow-sm ${panel}`}>
            Pixel house
          </Link>
        </div>
      </header>

      <aside
        className={`absolute right-3 bottom-3 w-56 rounded-lg p-3 text-sm shadow-sm sm:right-4 sm:bottom-4 sm:w-64 ${
          night ? 'bg-white/10 text-white' : 'bg-white/85 text-[#2a2233]'
        }`}
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

      {mapOpen && (
        <RoomMap
          currentRoom={room}
          onTeleport={(id) => {
            apiRef.current?.teleport(id)
            setMapOpen(false)
          }}
          onClose={() => setMapOpen(false)}
        />
      )}

      {!loaded && <p className="absolute inset-0 flex items-center justify-center text-sm text-[#2a2233]/70">Loading the house…</p>}
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
