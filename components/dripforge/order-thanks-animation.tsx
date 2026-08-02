"use client"

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Text } from "@react-three/drei"
import * as THREE from "three"
import { cn } from "@/lib/utils"

const ENGRAVE_TEXT = "Vielen Dank für Ihre Bestellung!"
const SECONDARY_LINE = "Bestellung erhalten — wartet auf Zahlung"

/** Raster: Laser fährt Zeile für Zeile links→rechts. */
const SCAN_LINES = 5
const SCAN_DURATION_SEC = 5.2

export type OrderThanksTheme = "printer" | "laser"

function pickTheme(): OrderThanksTheme {
  // Laser-Gravur ist die bevorzugte Dankes-Animation
  return Math.random() < 0.35 ? "printer" : "laser"
}

function scanPosition(progress: number): { x: number; z: number; line: number } {
  const p = THREE.MathUtils.clamp(progress, 0, 1)
  const scaled = p * SCAN_LINES
  const line = Math.min(SCAN_LINES - 1, Math.floor(scaled))
  const local = scaled - line
  const x = -3.35 + local * 6.7
  const z = 0.55 - line * 0.28
  return { x, z, line }
}

function SlateBed() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[8.6, 3.4]} />
        <meshStandardMaterial
          color="#1a1612"
          metalness={0.12}
          roughness={0.92}
        />
      </mesh>
      {/* Leichte Holz-/Schiefer-Struktur als zweite Schicht */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]}>
        <planeGeometry args={[8.4, 3.2]} />
        <meshStandardMaterial
          color="#2a221c"
          metalness={0.08}
          roughness={0.85}
          transparent
          opacity={0.55}
        />
      </mesh>
      {/* Rahmen / Arbeitsfläche */}
      <mesh position={[0, 0.02, -1.55]}>
        <boxGeometry args={[8.8, 0.08, 0.12]} />
        <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.02, 1.55]}>
        <boxGeometry args={[8.8, 0.08, 0.12]} />
        <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  )
}

function PrintBed() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
      <planeGeometry args={[8.2, 3.2]} />
      <meshStandardMaterial color="#1c1917" metalness={0.35} roughness={0.55} />
    </mesh>
  )
}

function PrinterGantry({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!group.current) return
    group.current.position.x = -3.4 + progressRef.current * 6.8
  })
  return (
    <group ref={group} position={[-3.4, 0.55, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.55, 0.18, 0.35]} />
        <meshStandardMaterial color="#f97316" metalness={0.4} roughness={0.35} />
      </mesh>
      <mesh position={[0, -0.28, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.02, 0.45, 12]} />
        <meshStandardMaterial
          color="#06b6d4"
          emissive="#06b6d4"
          emissiveIntensity={0.55}
        />
      </mesh>
      <mesh position={[0, -0.52, 0]}>
        <sphereGeometry args={[0.04, 10, 10]} />
        <meshStandardMaterial
          color="#fb923c"
          emissive="#f97316"
          emissiveIntensity={1.2}
        />
      </mesh>
    </group>
  )
}

function FilamentTrail({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const mesh = useRef<THREE.Mesh>(null)
  useFrame(() => {
    if (!mesh.current) return
    const progress = progressRef.current
    const width = Math.max(0.05, progress * 6.6)
    mesh.current.scale.x = width
    mesh.current.position.x = -3.3 + width / 2
  })
  return (
    <mesh ref={mesh} position={[-3.3, 0.02, 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1, 0.08]} />
      <meshStandardMaterial
        color="#f97316"
        emissive="#ea580c"
        emissiveIntensity={0.85}
        transparent
        opacity={0.92}
      />
    </mesh>
  )
}

function LaserEngraverHead({
  progressRef,
}: {
  progressRef: MutableRefObject<number>
}) {
  const group = useRef<THREE.Group>(null)
  const beam = useRef<THREE.Mesh>(null)
  const glow = useRef<THREE.PointLight>(null)

  useFrame(({ clock }) => {
    if (!group.current) return
    const progress = progressRef.current
    const { x, z } = scanPosition(progress)
    const engraving = progress < 0.995
    group.current.position.x = x
    group.current.position.z = z
    group.current.position.y = 0.78

    if (beam.current) {
      const mat = beam.current.material as THREE.MeshStandardMaterial
      const pulse = engraving ? 0.85 + Math.sin(clock.elapsedTime * 28) * 0.15 : 0.15
      mat.emissiveIntensity = engraving ? 3.2 * pulse : 0.2
      mat.opacity = engraving ? 0.92 : 0.15
    }
    if (glow.current) {
      glow.current.intensity = engraving ? 2.4 + Math.sin(clock.elapsedTime * 22) * 0.6 : 0.2
      glow.current.position.set(0, -0.72, 0)
    }
  })

  return (
    <group ref={group} position={[-3.4, 0.78, 0.55]}>
      {/* Gantry-Schlitten */}
      <mesh castShadow position={[0, 0.08, 0]}>
        <boxGeometry args={[0.85, 0.2, 0.42]} />
        <meshStandardMaterial color="#1e293b" metalness={0.78} roughness={0.22} />
      </mesh>
      <mesh position={[0, 0.18, 0]}>
        <boxGeometry args={[0.55, 0.08, 0.28]} />
        <meshStandardMaterial color="#334155" metalness={0.65} roughness={0.28} />
      </mesh>
      {/* Optik */}
      <mesh position={[0, -0.22, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.07, 0.38, 16]} />
        <meshStandardMaterial color="#0ea5e9" metalness={0.55} roughness={0.25} />
      </mesh>
      <mesh position={[0, -0.42, 0]}>
        <cylinderGeometry args={[0.045, 0.03, 0.18, 12]} />
        <meshStandardMaterial
          color="#67e8f9"
          emissive="#22d3ee"
          emissiveIntensity={1.4}
        />
      </mesh>
      {/* Laserstrahl */}
      <mesh ref={beam} position={[0, -0.72, 0]}>
        <cylinderGeometry args={[0.012, 0.004, 0.58, 8]} />
        <meshStandardMaterial
          color="#f43f5e"
          emissive="#fb7185"
          emissiveIntensity={2.8}
          transparent
          opacity={0.9}
          depthWrite={false}
        />
      </mesh>
      {/* Kontaktpunkt */}
      <mesh position={[0, -1.02, 0]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshStandardMaterial
          color="#fecdd3"
          emissive="#fb7185"
          emissiveIntensity={4}
          transparent
          opacity={0.95}
        />
      </mesh>
      <pointLight
        ref={glow}
        color="#fb7185"
        intensity={2.2}
        distance={2.4}
        decay={2}
      />
    </group>
  )
}

function LaserSparks({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const ref = useRef<THREE.Points>(null)
  const { positions, velocities, lifetimes } = useMemo(() => {
    const count = 90
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    const lifetimes = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0
      positions[i * 3 + 1] = -10
      positions[i * 3 + 2] = 0
      velocities[i * 3] = 0
      velocities[i * 3 + 1] = 0
      velocities[i * 3 + 2] = 0
      lifetimes[i] = Math.random()
    }
    return { positions, velocities, lifetimes }
  }, [])

  useFrame((_, delta) => {
    const points = ref.current
    if (!points) return
    const progress = progressRef.current
    const engraving = progress < 0.995
    const { x, z } = scanPosition(progress)
    const attr = points.geometry.attributes.position as THREE.BufferAttribute
    const arr = attr.array as Float32Array

    for (let i = 0; i < lifetimes.length; i++) {
      lifetimes[i]! -= delta * (1.6 + Math.random())
      arr[i * 3]! += velocities[i * 3]! * delta
      arr[i * 3 + 1]! += velocities[i * 3 + 1]! * delta
      arr[i * 3 + 2]! += velocities[i * 3 + 2]! * delta
      velocities[i * 3 + 1]! -= 2.4 * delta

      if (lifetimes[i]! <= 0 || arr[i * 3 + 1]! < -0.05) {
        if (!engraving) {
          arr[i * 3 + 1] = -10
          lifetimes[i] = 1
          continue
        }
        arr[i * 3] = x + (Math.random() - 0.5) * 0.08
        arr[i * 3 + 1] = 0.04 + Math.random() * 0.06
        arr[i * 3 + 2] = z + (Math.random() - 0.5) * 0.08
        velocities[i * 3] = (Math.random() - 0.5) * 1.1
        velocities[i * 3 + 1] = Math.random() * 1.6 + 0.4
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 1.1
        lifetimes[i] = 0.35 + Math.random() * 0.55
      }
    }
    attr.needsUpdate = true
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.038}
        color="#fde68a"
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  )
}

/** Charred engraved typography — opacity follows scan progress. */
function EngravedThanksText({
  progressRef,
}: {
  progressRef: MutableRefObject<number>
}) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null)
  const glowRef = useRef<THREE.MeshBasicMaterial>(null)

  useFrame(() => {
    const p = progressRef.current
    // Text erscheint schrittweise mit dem Raster
    const reveal = THREE.MathUtils.smoothstep(p, 0.08, 0.92)
    if (matRef.current) matRef.current.opacity = 0.25 + reveal * 0.75
    if (glowRef.current) {
      glowRef.current.opacity = reveal * 0.55
    }
  })

  return (
    <group position={[0, 0.04, 0.05]}>
      {/* Leicht versenkter Glow (frisch graviert / warm) */}
      <Text
        position={[0, 0.02, 0]}
        fontSize={0.42}
        maxWidth={7.4}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
        color="#fbbf24"
        outlineWidth={0.018}
        outlineColor="#78350f"
      >
        {ENGRAVE_TEXT}
        <meshBasicMaterial
          ref={glowRef}
          color="#f59e0b"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </Text>
      {/* Premium charred lettering */}
      <Text
        position={[0, 0.025, 0.01]}
        fontSize={0.42}
        maxWidth={7.4}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
        color="#e7e5e4"
        outlineWidth={0.01}
        outlineColor="#292524"
      >
        {ENGRAVE_TEXT}
        <meshBasicMaterial
          ref={matRef}
          color="#d6d3d1"
          transparent
          opacity={0.2}
        />
      </Text>
    </group>
  )
}

function LaserScanTrail({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const mesh = useRef<THREE.Mesh>(null)
  useFrame(() => {
    if (!mesh.current) return
    const { x, z, line } = scanPosition(progressRef.current)
    const local = (progressRef.current * SCAN_LINES) % 1
    const width = Math.max(0.04, local * 6.7)
    mesh.current.position.x = -3.35 + width / 2
    mesh.current.position.z = z
    mesh.current.scale.x = width
    const mat = mesh.current.material as THREE.MeshStandardMaterial
    mat.opacity = progressRef.current < 0.995 ? 0.35 : 0.08
    void line
  })
  return (
    <mesh ref={mesh} position={[-3.35, 0.03, 0.55]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1, 0.06]} />
      <meshStandardMaterial
        color="#67e8f9"
        emissive="#22d3ee"
        emissiveIntensity={1.8}
        transparent
        opacity={0.35}
        depthWrite={false}
      />
    </mesh>
  )
}

function LaserThanksScene({ loop = false }: { loop?: boolean }) {
  const progressRef = useRef(0)
  const holdRef = useRef(0)

  useFrame((_, delta) => {
    if (progressRef.current < 1) {
      progressRef.current = Math.min(
        1,
        progressRef.current + delta / SCAN_DURATION_SEC
      )
      return
    }
    // Clean ending: kurz halten, optional sanft neu starten
    holdRef.current += delta
    if (loop && holdRef.current > 2.2) {
      progressRef.current = 0
      holdRef.current = 0
    }
  })

  return (
    <>
      <color attach="background" args={["#0a0c10"]} />
      <fog attach="fog" args={["#0a0c10", 7, 16]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[3.5, 6, 2]} intensity={0.95} castShadow />
      <pointLight position={[0, 2.5, 1]} intensity={0.55} color="#94a3b8" />
      <pointLight position={[-2, 1.5, 2]} intensity={0.35} color="#22d3ee" />

      <SlateBed />
      <LaserScanTrail progressRef={progressRef} />
      <EngravedThanksText progressRef={progressRef} />
      <LaserEngraverHead progressRef={progressRef} />
      <LaserSparks progressRef={progressRef} />
    </>
  )
}

function PrinterThanksScene() {
  const progressRef = useRef(0)
  const [reveal, setReveal] = useState(0)
  const frameGate = useRef(0)

  useFrame((_, delta) => {
    progressRef.current = Math.min(1, progressRef.current + delta * 0.18)
    frameGate.current += 1
    if (frameGate.current % 3 === 0) {
      setReveal(Math.min(1, progressRef.current * 1.15))
    }
  })

  const line1Opacity = THREE.MathUtils.smoothstep(reveal, 0.05, 0.55)
  const line2Opacity = THREE.MathUtils.smoothstep(reveal, 0.35, 0.95)

  return (
    <>
      <color attach="background" args={["#111827"]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 3]} intensity={1.25} castShadow />
      <pointLight position={[0, 2, 2]} intensity={0.9} color="#fb923c" />
      <PrintBed />
      <FilamentTrail progressRef={progressRef} />
      <PrinterGantry progressRef={progressRef} />
      <Text
        position={[0, 0.35, 0.2]}
        fontSize={0.38}
        maxWidth={7.2}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
        color="#fff7ed"
        fillOpacity={line1Opacity}
        outlineWidth={0.012}
        outlineColor="#ea580c"
      >
        {ENGRAVE_TEXT}
      </Text>
      <Text
        position={[0, -0.2, 0.2]}
        fontSize={0.26}
        maxWidth={7.2}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
        color="#fdba74"
        fillOpacity={line2Opacity}
      >
        {SECONDARY_LINE}
      </Text>
    </>
  )
}

function ThanksScene({ theme }: { theme: OrderThanksTheme }) {
  if (theme === "printer") return <PrinterThanksScene />
  return <LaserThanksScene loop={false} />
}

/**
 * WebGL-Dankes-Animation: Lasergravur (Standard) oder 3D-Drucker.
 * Laser: zeilenweises Gravieren von «Vielen Dank für Ihre Bestellung!» auf Schiefer.
 */
export function OrderThanksAnimation({
  className,
  active = true,
  theme: themeProp,
  compact = false,
}: {
  className?: string
  active?: boolean
  /** Optional festes Theme; sonst bevorzugt Laser */
  theme?: OrderThanksTheme
  compact?: boolean
}) {
  const [theme] = useState<OrderThanksTheme>(() => themeProp ?? pickTheme())

  if (!active) return null

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border border-border/50 bg-zinc-950 shadow-lg shadow-cyan-500/10",
        compact ? "h-[160px]" : "h-[260px] sm:h-[320px]",
        className
      )}
      aria-label={ENGRAVE_TEXT}
    >
      <Canvas
        camera={{ position: [0, 3.1, 5.6], fov: 40 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        frameloop="always"
      >
        <Suspense fallback={null}>
          <ThanksScene theme={theme} />
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-8 text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-cyan-200/75">
          {theme === "printer" ? "3D-Druck" : "Lasergravur"} · DripForge
        </p>
      </div>
      <p className="sr-only">{ENGRAVE_TEXT}</p>
    </div>
  )
}

function ThanksTextOnly({
  className,
  compact,
}: {
  className?: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center rounded-2xl border border-border/50 bg-muted/30 px-4 text-center",
        compact ? "min-h-[100px] py-4" : "min-h-[160px] py-8",
        className
      )}
    >
      <p className="text-lg font-semibold sm:text-xl">{ENGRAVE_TEXT}</p>
      <p className="mt-1 text-sm text-muted-foreground">{SECONDARY_LINE}</p>
    </div>
  )
}

function ThanksMedia({
  className,
  compact,
  mediaUrl,
  mediaKind,
}: {
  className?: string
  compact?: boolean
  mediaUrl: string
  mediaKind: "mp4" | "gif" | "lottie" | null
}) {
  const heightClass = compact ? "h-[160px]" : "h-[260px] sm:h-[320px]"
  const kind =
    mediaKind ??
    (mediaUrl.endsWith(".json")
      ? "lottie"
      : mediaUrl.match(/\.(gif)(\?|$)/i)
        ? "gif"
        : "mp4")

  if (kind === "lottie") {
    return (
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-2xl border border-border/50 bg-zinc-950",
          heightClass,
          className
        )}
      >
        <iframe
          title="Dankes-Animation"
          src={`https://lottie.host/embed/?src=${encodeURIComponent(mediaUrl)}`}
          className="h-full w-full border-0"
          allow="autoplay"
        />
      </div>
    )
  }

  if (kind === "mp4") {
    return (
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-2xl border border-border/50 bg-zinc-950",
          heightClass,
          className
        )}
      >
        <video
          className="h-full w-full object-contain"
          src={mediaUrl}
          autoPlay
          muted
          loop
          playsInline
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border border-border/50 bg-zinc-950",
        heightClass,
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mediaUrl}
        alt="Vielen Dank"
        className="h-full w-full object-contain"
      />
    </div>
  )
}

/**
 * Lädt die Admin-Dankesseiten-Einstellungen und rendert Text, Interaktiv oder Medien.
 */
export function OrderThanksFromSettings({
  className,
  active = true,
  compact = false,
}: {
  className?: string
  active?: boolean
  compact?: boolean
}) {
  const [mode, setMode] = useState<"text" | "interactive" | "media">(
    "interactive"
  )
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [mediaKind, setMediaKind] = useState<"mp4" | "gif" | "lottie" | null>(
    null
  )
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/settings/thanks-page", {
          cache: "no-store",
        })
        const data = (await res.json()) as {
          animationMode?: string
          mediaUrl?: string | null
          mediaKind?: "mp4" | "gif" | "lottie" | null
        }
        if (cancelled) return
        if (
          data.animationMode === "text" ||
          data.animationMode === "interactive" ||
          data.animationMode === "media"
        ) {
          setMode(data.animationMode)
        }
        setMediaUrl(
          typeof data.mediaUrl === "string" && data.mediaUrl.trim()
            ? data.mediaUrl.trim()
            : null
        )
        setMediaKind(
          data.mediaKind === "mp4" ||
            data.mediaKind === "gif" ||
            data.mediaKind === "lottie"
            ? data.mediaKind
            : null
        )
      } catch {
        /* defaults */
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [active])

  if (!active) return null
  if (!ready) {
    return (
      <div
        className={cn(
          "w-full animate-pulse rounded-2xl bg-muted/40",
          compact ? "h-[160px]" : "h-[200px]",
          className
        )}
        aria-hidden
      />
    )
  }

  if (mode === "text") {
    return <ThanksTextOnly className={className} compact={compact} />
  }

  if (mode === "media" && mediaUrl) {
    return (
      <ThanksMedia
        className={className}
        compact={compact}
        mediaUrl={mediaUrl}
        mediaKind={mediaKind}
      />
    )
  }

  return (
    <OrderThanksAnimation
      className={className}
      active={active}
      compact={compact}
      theme="laser"
    />
  )
}
