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
import { Float, Text } from "@react-three/drei"
import * as THREE from "three"
import { cn } from "@/lib/utils"

const THANKS_LINES = [
  "Vielen Dank für Ihre Bestellung!",
  "Bestellung erhalten — wartet auf Zahlung",
] as const

export type OrderThanksTheme = "printer" | "laser"

function pickTheme(): OrderThanksTheme {
  return Math.random() < 0.5 ? "printer" : "laser"
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
        <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={0.55} />
      </mesh>
      <mesh position={[0, -0.52, 0]}>
        <sphereGeometry args={[0.04, 10, 10]} />
        <meshStandardMaterial color="#fb923c" emissive="#f97316" emissiveIntensity={1.2} />
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

function LaserHead({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!group.current) return
    const progress = progressRef.current
    group.current.position.x = -3.4 + progress * 6.8
    group.current.position.y = 0.7 + Math.sin(progress * Math.PI * 8) * 0.08
  })
  return (
    <group ref={group} position={[-3.4, 0.7, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.7, 0.22, 0.28]} />
        <meshStandardMaterial color="#334155" metalness={0.65} roughness={0.25} />
      </mesh>
      <mesh position={[0, -0.35, 0]}>
        <cylinderGeometry args={[0.035, 0.02, 0.55, 10]} />
        <meshStandardMaterial color="#0ea5e9" emissive="#22d3ee" emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[0, -0.62, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.55, 8]} />
        <meshStandardMaterial
          color="#f43f5e"
          emissive="#fb7185"
          emissiveIntensity={2.4}
          transparent
          opacity={0.9}
        />
      </mesh>
    </group>
  )
}

function SparkParticles({
  progressRef,
}: {
  progressRef: MutableRefObject<number>
}) {
  const ref = useRef<THREE.Points>(null)
  const { positions, velocities } = useMemo(() => {
    const count = 120
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = 0
      velocities[i * 3] = (Math.random() - 0.5) * 0.8
      velocities[i * 3 + 1] = Math.random() * 1.2 + 0.2
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.8
    }
    return { positions, velocities }
  }, [])

  useFrame((_, delta) => {
    const points = ref.current
    if (!points) return
    const progress = progressRef.current
    if (progress >= 0.98) return
    const attr = points.geometry.attributes.position as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    const headX = -3.4 + progress * 6.8
    for (let i = 0; i < arr.length / 3; i++) {
      arr[i * 3]! += velocities[i * 3]! * delta
      arr[i * 3 + 1]! += velocities[i * 3 + 1]! * delta
      arr[i * 3 + 2]! += velocities[i * 3 + 2]! * delta
      velocities[i * 3 + 1]! -= 1.8 * delta
      if (arr[i * 3 + 1]! < 0 || Math.random() < 0.02) {
        arr[i * 3] = headX + (Math.random() - 0.5) * 0.15
        arr[i * 3 + 1] = 0.05 + Math.random() * 0.1
        arr[i * 3 + 2] = (Math.random() - 0.5) * 0.2
        velocities[i * 3] = (Math.random() - 0.5) * 0.9
        velocities[i * 3 + 1] = Math.random() * 1.4 + 0.3
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.9
      }
    }
    attr.needsUpdate = true
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.045}
        color="#fbbf24"
        transparent
        opacity={0.95}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

function EngravedGlow({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const mesh = useRef<THREE.Mesh>(null)
  useFrame(() => {
    if (!mesh.current) return
    const progress = progressRef.current
    const width = Math.max(0.05, progress * 6.6)
    mesh.current.scale.x = width
    mesh.current.position.x = -3.3 + width / 2
  })
  return (
    <mesh ref={mesh} position={[-3.3, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1, 0.12]} />
      <meshStandardMaterial
        color="#67e8f9"
        emissive="#22d3ee"
        emissiveIntensity={1.6}
        transparent
        opacity={0.75}
      />
    </mesh>
  )
}

function ThanksScene({ theme }: { theme: OrderThanksTheme }) {
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
      <color attach="background" args={[theme === "laser" ? "#0a0f14" : "#111827"]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 3]} intensity={1.25} castShadow />
      <pointLight
        position={[0, 2, 2]}
        intensity={theme === "laser" ? 1.4 : 0.9}
        color={theme === "laser" ? "#22d3ee" : "#fb923c"}
      />

      <PrintBed />
      {theme === "printer" ? (
        <>
          <FilamentTrail progressRef={progressRef} />
          <PrinterGantry progressRef={progressRef} />
        </>
      ) : (
        <>
          <EngravedGlow progressRef={progressRef} />
          <LaserHead progressRef={progressRef} />
          <SparkParticles progressRef={progressRef} />
        </>
      )}

      <Float speed={1.2} rotationIntensity={0.05} floatIntensity={0.08}>
        <Text
          position={[0, 0.35, 0.2]}
          fontSize={0.38}
          maxWidth={7.2}
          textAlign="center"
          anchorX="center"
          anchorY="middle"
          color={theme === "laser" ? "#ecfeff" : "#fff7ed"}
          fillOpacity={line1Opacity}
          outlineWidth={0.012}
          outlineColor={theme === "laser" ? "#0891b2" : "#ea580c"}
        >
          {THANKS_LINES[0]}
        </Text>
        <Text
          position={[0, -0.2, 0.2]}
          fontSize={0.26}
          maxWidth={7.2}
          textAlign="center"
          anchorX="center"
          anchorY="middle"
          color={theme === "laser" ? "#a5f3fc" : "#fdba74"}
          fillOpacity={line2Opacity}
        >
          {THANKS_LINES[1]}
        </Text>
      </Float>
    </>
  )
}

/**
 * Zufällige WebGL-Dankes-Animation: 3D-Drucker oder Lasergravur.
 */
export function OrderThanksAnimation({
  className,
  active = true,
  theme: themeProp,
  compact = false,
}: {
  className?: string
  active?: boolean
  /** Optional festes Theme; sonst 50/50 Zufall beim Mount */
  theme?: OrderThanksTheme
  compact?: boolean
}) {
  const [theme] = useState<OrderThanksTheme>(() => themeProp ?? pickTheme())

  if (!active) return null

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border border-border/50 bg-zinc-950 shadow-lg shadow-orange-500/10",
        compact ? "h-[160px]" : "h-[260px] sm:h-[320px]",
        className
      )}
      aria-label={`${THANKS_LINES[0]} ${THANKS_LINES[1]}`}
    >
      <Canvas
        camera={{ position: [0, 2.8, 5.2], fov: 42 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: false }}
      >
        <Suspense fallback={null}>
          <ThanksScene theme={theme} />
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-3 pb-2 pt-8 text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-orange-200/80">
          {theme === "printer" ? "3D-Druck" : "Lasergravur"} · DripForge
        </p>
      </div>
      <p className="sr-only">
        {THANKS_LINES[0]} {THANKS_LINES[1]}
      </p>
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
      <p className="text-lg font-semibold sm:text-xl">{THANKS_LINES[0]}</p>
      <p className="mt-1 text-sm text-muted-foreground">{THANKS_LINES[1]}</p>
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
    />
  )
}
