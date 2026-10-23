import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  AREA_KINDS, boardBounds, footprint, seats, type FloorArea, type FloorTable,
} from '../../domain/floor'

/** Live data drawn over a table (waiter screen): top color and an optional floating badge. */
export interface TableOverlay {
  color: string
  badge?: string
  badgeColor?: string
}

export type FloorSelection = { type: 'table' | 'area'; key: string } | null
export type FloorView = '3d' | 'top'

export interface FloorSceneProps {
  areas: FloorArea[]
  tables: FloorTable[]
  overlays?: Record<string, TableOverlay>
  selected?: FloorSelection
  view: FloorView
  editable?: boolean
  onSelect?(selection: FloorSelection): void
  onMoveTable?(key: string, dx: number, dy: number, done: boolean): void
  onMoveArea?(key: string, dx: number, dy: number, done: boolean): void
  onResizeArea?(key: string, dx: number, dy: number, done: boolean): void
}

// Maquette look: matte white furniture on an off-white plinth over a wooden base.
const WHITE = new THREE.MeshStandardMaterial({ color: '#FBFAF7', roughness: 0.92 })
const SOFT = new THREE.MeshStandardMaterial({ color: '#F1EEE8', roughness: 0.95 })
const PLINTH = new THREE.MeshStandardMaterial({ color: '#F6F4EF', roughness: 0.9 })
const WOOD = new THREE.MeshStandardMaterial({ color: '#A8784C', roughness: 0.65 })
const ACCENT = new THREE.MeshBasicMaterial({ color: '#2F4A3A' })
const HANDLE = new THREE.MeshStandardMaterial({ color: '#A8784C', roughness: 0.5 })
const TOP_H = 0.75
const BAR_H = 1.05

const FONT = '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif'

function useFontsReady() {
  const [ready, setReady] = useState(() => typeof document === 'undefined' || !document.fonts)
  useEffect(() => {
    if (ready) return
    let alive = true
    void document.fonts.ready.then(() => alive && setReady(true))
    return () => { alive = false }
  }, [ready])
  return ready
}

/** Text painted on a canvas, used as a decal (table numbers, area names) or a floating badge. */
function useTextTexture(text: string, opts: { color: string; bg?: string; weight?: number; pill?: boolean }, fonts: boolean) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const size = 96
    if (!ctx) return { texture: null, aspect: 1 }
    ctx.font = `${opts.weight ?? 800} ${size}px ${FONT}`
    const pad = opts.pill ? size * 0.55 : size * 0.1
    const width = Math.ceil(ctx.measureText(text).width + pad * 2)
    canvas.width = Math.max(width, opts.pill ? size * 1.6 : 8)
    canvas.height = Math.ceil(size * 1.45)
    ctx.font = `${opts.weight ?? 800} ${size}px ${FONT}`
    if (opts.bg) {
      ctx.fillStyle = opts.bg
      const r = canvas.height / 2
      ctx.beginPath()
      ctx.roundRect(0, 0, canvas.width, canvas.height, r)
      ctx.fill()
    }
    ctx.fillStyle = opts.color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + size * 0.04)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return { texture: tex, aspect: canvas.width / canvas.height }
    // `fonts` forces a repaint once the web font is ready.
  }, [text, opts.color, opts.bg, opts.weight, opts.pill, fonts]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => texture.texture?.dispose(), [texture])
  return texture
}

function Decal({ text, height, y, color, fonts, maxWidth }:
  { text: string; height: number; y: number; color: string; fonts: boolean; maxWidth?: number }) {
  const { texture, aspect } = useTextTexture(text, { color }, fonts)
  if (!texture) return null
  let h = height
  if (maxWidth && h * aspect > maxWidth) h = maxWidth / aspect
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <planeGeometry args={[h * aspect, h]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  )
}

function Badge({ text, color, y, fonts }: { text: string; color: string; y: number; fonts: boolean }) {
  const { texture, aspect } = useTextTexture(text, { color: '#FFFFFF', bg: color, pill: true, weight: 800 }, fonts)
  if (!texture) return null
  const h = 0.58
  return (
    <sprite position={[0, y, 0]} scale={[h * aspect, h, 1]} renderOrder={5}>
      <spriteMaterial map={texture} depthTest={false} transparent />
    </sprite>
  )
}

function Chair({ x, z, bx, bz, stool, high }: { x: number; z: number; bx: number; bz: number; stool?: boolean; high?: boolean }) {
  const angle = Math.atan2(bx, bz)
  if (stool) {
    const h = high ? 0.75 : 0.65
    return (
      <group position={[x, 0, z]}>
        <mesh material={WHITE} position={[0, h / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.04, 0.09, h, 12]} />
        </mesh>
        <mesh material={WHITE} position={[0, h + 0.03, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.18, 0.18, 0.06, 20]} />
        </mesh>
      </group>
    )
  }
  return (
    <group position={[x, 0, z]} rotation={[0, angle, 0]}>
      <mesh material={WHITE} position={[0, 0.22, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.4, 0.44, 0.4]} />
      </mesh>
      <mesh material={WHITE} position={[0, 0.66, 0.17]} castShadow receiveShadow>
        <boxGeometry args={[0.4, 0.44, 0.06]} />
      </mesh>
    </group>
  )
}

function TableModel({ table, overlay, selected, editable, fonts, onPick, onDragStart }: {
  table: FloorTable
  overlay?: TableOverlay
  selected: boolean
  editable: boolean
  fonts: boolean
  onPick(): void
  onDragStart(e: ThreeEvent<PointerEvent>): void
}) {
  const { width, depth } = footprint(table.kind, table.capacity)
  const list = seats(table.kind, table.capacity)
  const round = table.kind === 'round' || table.kind === 'high'
  const topH = table.kind === 'bar' || table.kind === 'high' ? BAR_H : TOP_H
  const topColor = overlay?.color ?? '#FBFAF7'
  const topMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: topColor, roughness: 0.85 }), [topColor])
  useEffect(() => () => topMaterial.dispose(), [topMaterial])
  const [hover, setHover] = useState(false)
  const label = overlay ? '#FFFFFF' : '#1B1E1B'
  const ring = Math.max(width, depth) / 2 + 0.75

  return (
    <group position={[table.pos_x ?? 0, 0.06, table.pos_y ?? 0]} rotation={[0, (-table.rotation * Math.PI) / 180, 0]}
      onPointerDown={editable ? (e) => { onPick(); onDragStart(e) } : undefined}
      onClick={(e) => { e.stopPropagation(); if (!editable) onPick() }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = editable ? 'grab' : 'pointer' }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = '' }}>
      {(selected || hover) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} material={selected ? ACCENT : SOFT}>
          <ringGeometry args={[ring - 0.07, ring, 48]} />
        </mesh>
      )}
      {table.kind === 'bar' ? (
        <mesh material={WHITE} position={[0, BAR_H / 2 - 0.03, -0.05]} castShadow receiveShadow>
          <boxGeometry args={[width, BAR_H - 0.06, depth - 0.1]} />
        </mesh>
      ) : round ? (
        <mesh material={WHITE} position={[0, topH / 2, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, topH, 10]} />
        </mesh>
      ) : (
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
          <mesh key={`${sx}${sz}`} material={WHITE} position={[sx * (width / 2 - 0.06), topH / 2, sz * (depth / 2 - 0.06)]} castShadow>
            <boxGeometry args={[0.06, topH, 0.06]} />
          </mesh>
        ))
      )}
      {round ? (
        <mesh material={topMaterial} position={[0, topH, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[width / 2, width / 2, 0.05, 40]} />
        </mesh>
      ) : (
        <mesh material={topMaterial} position={[0, topH, 0]} castShadow receiveShadow>
          <boxGeometry args={[width, 0.05, depth]} />
        </mesh>
      )}
      {table.kind === 'booth' ? (
        [-1, 1].map((side) => (
          <group key={side} position={[0, 0, side * (depth / 2 + 0.32)]}>
            <mesh material={WHITE} position={[0, 0.22, 0]} castShadow receiveShadow>
              <boxGeometry args={[width + 0.2, 0.44, 0.48]} />
            </mesh>
            <mesh material={WHITE} position={[0, 0.6, side * 0.21]} castShadow receiveShadow>
              <boxGeometry args={[width + 0.2, 1.2, 0.08]} />
            </mesh>
          </group>
        ))
      ) : (
        list.map((s, i) => (
          <Chair key={i} x={s.x} z={s.y} bx={s.bx} bz={s.by} stool={table.kind === 'bar' || table.kind === 'high'}
            high={table.kind === 'high'} />
        ))
      )}
      <group rotation={[0, (table.rotation * Math.PI) / 180, 0]}>
        <Decal text={table.code} height={Math.min(0.42, depth * 0.55)} maxWidth={width * 0.8} y={topH + 0.03}
          color={label} fonts={fonts} />
        {overlay?.badge && <Badge text={overlay.badge} color={overlay.badgeColor ?? '#1B1E1B'} y={topH + 1.0} fonts={fonts} />}
      </group>
    </group>
  )
}

function Tree({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0.06, z]}>
      <mesh material={WHITE} position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.06, 0.9, 8]} />
      </mesh>
      <mesh material={WHITE} position={[0, 1.15, 0]} castShadow receiveShadow>
        <icosahedronGeometry args={[0.45, 1]} />
      </mesh>
    </group>
  )
}

function AreaBlock({ area, selected, editable, fonts, onPick, onDragStart, onResizeStart }: {
  area: FloorArea
  selected: boolean
  editable: boolean
  fonts: boolean
  onPick(): void
  onDragStart(e: ThreeEvent<PointerEvent>): void
  onResizeStart(e: ThreeEvent<PointerEvent>): void
}) {
  const meta = AREA_KINDS[area.kind]
  const floor = useMemo(() => new THREE.MeshStandardMaterial({ color: meta.floor, roughness: 0.95 }), [meta.floor])
  useEffect(() => () => floor.dispose(), [floor])
  const { width: w, depth: d, x, y } = area
  const t = 0.08
  const h = meta.wall
  const walls: [number, number, number, number][] = [
    [w / 2, 0, w, t], [w / 2, d, w, t], [0, d / 2, t, d], [w, d / 2, t, d],
  ]
  const trees = area.kind === 'jardin'
    ? [[0.7, 0.7], [w - 0.7, 0.7], [0.7, d - 0.7], [w - 0.7, d - 0.7]].filter(() => w > 2 && d > 2)
    : []

  return (
    <group position={[x, 0, y]}>
      <mesh material={floor} position={[w / 2, 0.03, d / 2]} receiveShadow
        onPointerDown={editable ? (e) => { onPick(); onDragStart(e) } : undefined}
        onClick={(e) => { e.stopPropagation(); if (!editable) onPick() }}>
        <boxGeometry args={[w - 0.02, 0.06, d - 0.02]} />
      </mesh>
      {walls.map(([cx, cz, ww, dd], i) => (
        <mesh key={i} material={WHITE} position={[cx, 0.06 + h / 2, cz]} castShadow receiveShadow>
          <boxGeometry args={[ww, h, dd]} />
        </mesh>
      ))}
      {trees.map(([tx, tz], i) => <Tree key={i} x={tx} z={tz} />)}
      <group position={[0.35, 0, 0.42]}>
        <AreaLabel text={area.name.toUpperCase()} fonts={fonts} maxWidth={w - 0.7} />
      </group>
      {selected && (
        <>
          <lineSegments position={[w / 2, 0.07, d / 2]}>
            <edgesGeometry args={[new THREE.BoxGeometry(w, 0.01, d)]} />
            <lineBasicMaterial color="#2F4A3A" />
          </lineSegments>
          {editable && (
            <mesh material={HANDLE} position={[w, 0.25, d]} castShadow
              onPointerDown={(e) => onResizeStart(e)}
              onPointerOver={() => { document.body.style.cursor = 'nwse-resize' }}
              onPointerOut={() => { document.body.style.cursor = '' }}>
              <sphereGeometry args={[0.22, 20, 16]} />
            </mesh>
          )}
        </>
      )}
    </group>
  )
}

function AreaLabel({ text, fonts, maxWidth }: { text: string; fonts: boolean; maxWidth: number }) {
  const { texture, aspect } = useTextTexture(text, { color: '#77736A', weight: 800 }, fonts)
  if (!texture || maxWidth <= 0) return null
  let h = 0.42
  if (h * aspect > maxWidth) h = maxWidth / aspect
  const w = h * aspect
  return (
    <mesh position={[w / 2, 0.065, h / 2 - 0.1]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  )
}

function Controls({ center, board, view, controlsRef }: {
  center: [number, number]
  board: { width: number; depth: number }
  view: FloorView
  controlsRef: React.MutableRefObject<OrbitControls | null>
}) {
  const { camera, gl, invalidate, size } = useThree()
  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement)
    c.enableDamping = true
    c.dampingFactor = 0.12
    c.maxPolarAngle = Math.PI / 2.3
    c.minDistance = 3
    c.maxDistance = 120
    c.screenSpacePanning = false
    c.addEventListener('change', () => invalidate())
    controlsRef.current = c
    return () => { c.dispose(); controlsRef.current = null }
  }, [camera, gl, invalidate, controlsRef])

  // Frame the board whenever the view or the board size changes.
  const [cx, cz] = center
  useEffect(() => {
    const c = controlsRef.current
    if (!c) return
    // Distance that fits the board (plus its base) in both directions for this canvas shape.
    const fov = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180
    const aspect = size.width / Math.max(1, size.height)
    const w = board.width + 2.6
    const d = board.depth + 2.6
    const t = 2 * Math.tan(fov / 2)
    // Seen at an angle the board's diagonal sets the width it takes on screen.
    const dist = view === 'top' ? Math.max(w / aspect, d) / t * 1.05 + 1 : Math.max(Math.hypot(w, d) / aspect, d) / t * 1.02 + 1
    c.target.set(cx, 0, cz)
    if (view === 'top') {
      camera.position.set(cx, dist, cz + 0.001)
      c.enableRotate = false
    } else {
      const polar = 0.9
      const azimuth = -0.4
      camera.position.set(cx + dist * Math.sin(polar) * Math.sin(azimuth), dist * Math.cos(polar),
        cz + dist * Math.sin(polar) * Math.cos(azimuth))
      c.enableRotate = true
    }
    c.update()
    invalidate()
  }, [view, cx, cz, board.width, board.depth, size.width, size.height, camera, controlsRef, invalidate])

  useFrame(() => {
    if (controlsRef.current?.update()) invalidate()
  })
  return null
}

type DragMove = (dx: number, dy: number, done: boolean) => void

/** Drag on the floor plane: reports the offset from where the pointer went down, in meters. */
function useGroundDrag(controlsRef: React.MutableRefObject<OrbitControls | null>) {
  const { camera, gl } = useThree()
  return useCallback((e: ThreeEvent<PointerEvent>, onMove: DragMove) => {
    e.stopPropagation()
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const hit = new THREE.Vector3()
    const project = (clientX: number, clientY: number) => {
      const r = gl.domElement.getBoundingClientRect()
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      return raycaster.ray.intersectPlane(plane, hit) ? { x: hit.x, y: hit.z } : null
    }
    const start = project(e.nativeEvent.clientX, e.nativeEvent.clientY)
    if (!start) return
    if (controlsRef.current) controlsRef.current.enabled = false
    let last = { dx: 0, dy: 0 }
    const move = (ev: PointerEvent) => {
      const p = project(ev.clientX, ev.clientY)
      if (!p) return
      last = { dx: p.x - start.x, dy: p.y - start.y }
      onMove(last.dx, last.dy, false)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (controlsRef.current) controlsRef.current.enabled = true
      onMove(last.dx, last.dy, true)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }, [camera, gl, controlsRef])
}

function Scene(p: FloorSceneProps) {
  const fonts = useFontsReady()
  const controlsRef = useRef<OrbitControls | null>(null)
  const drag = useGroundDrag(controlsRef)
  const bounds = boardBounds(p.areas, p.tables)
  const center: [number, number] = [bounds.width / 2, bounds.depth / 2]
  const span = Math.max(bounds.width, bounds.depth)
  const placed = p.tables.filter((t) => t.pos_x !== null && t.pos_y !== null)
  const editable = !!p.editable
  const sun = useRef<THREE.DirectionalLight>(null)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    sun.current?.target.position.set(center[0], 0, center[1])
    sun.current?.target.updateMatrixWorld()
    sun.current?.shadow.camera.updateProjectionMatrix()
    invalidate()
  }, [center[0], center[1], span, invalidate]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <color attach="background" args={['#FFFFFF']} />
      <hemisphereLight args={['#FFFFFF', '#E6DFD2', 1.8]} />
      <directionalLight ref={sun} position={[center[0] - span * 0.9, span * 0.85, center[1] - span * 0.45]} intensity={1.45} castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02}
        shadow-camera-left={-span} shadow-camera-right={span} shadow-camera-top={span} shadow-camera-bottom={-span}
        shadow-camera-near={0.5} shadow-camera-far={span * 4} />
      <Controls center={center} board={bounds} view={p.view} controlsRef={controlsRef} />

      {/* Wooden base and white plinth, like a 3D-printed model on its stand. */}
      <mesh material={WOOD} position={[center[0], -0.45, center[1]]} receiveShadow>
        <boxGeometry args={[bounds.width + 2.6, 0.5, bounds.depth + 2.6]} />
      </mesh>
      <mesh material={PLINTH} position={[center[0], -0.1, center[1]]} receiveShadow
        onClick={(e) => { if (e.delta < 6) p.onSelect?.(null) }}>
        <boxGeometry args={[bounds.width + 1.4, 0.2, bounds.depth + 1.4]} />
      </mesh>

      {p.areas.map((a) => (
        <AreaBlock key={a.key} area={a} fonts={fonts} editable={editable}
          selected={p.selected?.type === 'area' && p.selected.key === a.key}
          onPick={() => p.onSelect?.({ type: 'area', key: a.key })}
          onDragStart={(e) => drag(e, (dx, dy, done) => p.onMoveArea?.(a.key, dx, dy, done))}
          onResizeStart={(e) => drag(e, (dx, dy, done) => p.onResizeArea?.(a.key, dx, dy, done))} />
      ))}
      {placed.map((t) => (
        <TableModel key={t.key} table={t} overlay={p.overlays?.[t.key]} fonts={fonts} editable={editable}
          selected={p.selected?.type === 'table' && p.selected.key === t.key}
          onPick={() => p.onSelect?.({ type: 'table', key: t.key })}
          onDragStart={(e) => drag(e, (dx, dy, done) => p.onMoveTable?.(t.key, dx, dy, done))} />
      ))}
    </>
  )
}

/** The floor plan as a white 3D maquette: orbit with one finger or the mouse, zoom with pinch or the wheel. */
export function FloorScene({ className = '', ...props }: FloorSceneProps & { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-[18px] border border-linea bg-white ${className}`}>
      <Canvas shadows flat frameloop="demand" onCreated={(s) => { if (import.meta.env.DEV) (window as unknown as { __r3f: unknown }).__r3f = s }} dpr={[1, 2]} camera={{ fov: 32, near: 0.1, far: 500, position: [10, 14, 22] }}
        onPointerMissed={(e) => { if (e.type === 'click') props.onSelect?.(null) }}>
        <Scene {...props} />
      </Canvas>
    </div>
  )
}
