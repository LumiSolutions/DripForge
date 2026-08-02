"use client"

/**
 * 3D Live-Vorschau mit @react-three/fiber und @react-three/drei.
 */

import { forwardRef, Suspense, useMemo, useState } from "react"
import { Canvas } from "@react-three/fiber"
import { LEITBILD_3D_CANVAS_ATTR } from "@/lib/dripforge/capture-leitbild"
import { ContactShadows, OrbitControls } from "@react-three/drei"
import type { BufferGeometry, Material, Object3D } from "three"
import * as THREE from "three"
import {
  getDimensionGeometryFromObject,
  getGeometryOrbitTarget,
  getObjectOrbitTarget,
  getPartsOrbitTarget,
  type ModelMeshPart,
} from "@/lib/dripforge/load-3d-geometry"
import {
  ModelDimensionLines,
  type DimensionsMm,
} from "@/components/dripforge/shared/model-dimension-lines"
import { Box, Eye, EyeOff, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type ColoredMeshPart = {
  geometry: BufferGeometry
  color: string
  material?: Material | Material[] | null
  hasVertexColors?: boolean
  preserveOriginalAppearance?: boolean
}

type Model3DPreviewProps = {
  geometry?: BufferGeometry | null
  meshParts?: ColoredMeshPart[] | null
  nativeScene?: Object3D | null
  preserveEmbeddedColors?: boolean
  color?: string
  scaleFactor: number
  dimensionsMm?: DimensionsMm | null
  isOversized?: boolean
  isLoading?: boolean
  error?: string | null
  className?: string
}

function MeshPart({
  part,
  fallbackColor,
}: {
  part: ColoredMeshPart
  fallbackColor: string
}) {
  if (part.preserveOriginalAppearance && part.material) {
    const materials = Array.isArray(part.material)
      ? part.material
      : [part.material]
    return (
      <mesh geometry={part.geometry} castShadow receiveShadow>
        {materials.length > 1
          ? materials.map((material, index) => (
              <primitive
                key={index}
                object={material}
                attach={`material-${index}`}
              />
            ))
          : (
              <primitive object={materials[0]} attach="material" />
            )}
      </mesh>
    )
  }

  if (part.hasVertexColors) {
    return (
      <mesh geometry={part.geometry} castShadow receiveShadow>
        <meshStandardMaterial
          vertexColors
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>
    )
  }

  return (
    <mesh geometry={part.geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color={part.color || fallbackColor}
        roughness={0.4}
        metalness={0.1}
      />
    </mesh>
  )
}

function PreviewMeshes({
  parts,
  fallbackColor,
}: {
  parts: ColoredMeshPart[]
  fallbackColor: string
}) {
  return (
    <>
      {parts.map((part, index) => (
        <MeshPart key={index} part={part} fallbackColor={fallbackColor} />
      ))}
    </>
  )
}

function PreviewScene({
  geometry,
  meshParts,
  nativeScene,
  preserveEmbeddedColors,
  color,
  scaleFactor,
  dimensionsMm,
  showDimensions,
  isOversized,
}: {
  geometry: BufferGeometry | null
  meshParts: ColoredMeshPart[] | null
  nativeScene: Object3D | null
  preserveEmbeddedColors: boolean
  color: string
  scaleFactor: number
  dimensionsMm: DimensionsMm | null
  showDimensions: boolean
  isOversized: boolean
}) {
  const useNativeScene = Boolean(
    preserveEmbeddedColors && nativeScene
  )

  const resolvedParts = useMemo((): ColoredMeshPart[] => {
    if (useNativeScene) return []
    if (meshParts && meshParts.length > 0) return meshParts
    if (geometry) return [{ geometry, color }]
    return []
  }, [useNativeScene, geometry, meshParts, color])

  const dimensionGeometry = useMemo(() => {
    if (useNativeScene && nativeScene) {
      return getDimensionGeometryFromObject(nativeScene)
    }
    if (geometry) return geometry
    return resolvedParts[0]?.geometry ?? null
  }, [useNativeScene, nativeScene, geometry, resolvedParts])

  const orbitTarget = useMemo(() => {
    if (useNativeScene && nativeScene) {
      return getObjectOrbitTarget(nativeScene, scaleFactor)
    }
    if (meshParts && meshParts.length > 0) {
      const rawParts: ModelMeshPart[] = meshParts.map((p, i) => ({
        geometry: p.geometry,
        partIndex: i,
      }))
      return getPartsOrbitTarget(rawParts, scaleFactor)
    }
    if (geometry) return getGeometryOrbitTarget(geometry, scaleFactor)
    return [0, 50 * scaleFactor, 0] as [number, number, number]
  }, [useNativeScene, nativeScene, geometry, meshParts, scaleFactor])

  if (!useNativeScene && resolvedParts.length === 0) return null

  return (
    <>
      <ambientLight intensity={0.8} />
      <hemisphereLight
        intensity={0.55}
        color="#ffffff"
        groundColor="#e5e7eb"
      />
      <directionalLight
        position={[5, 10, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={400}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
      />
      <directionalLight position={[-6, 6, -4]} intensity={0.45} />
      <directionalLight position={[0, 4, -10]} intensity={0.25} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[240, 240]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.95} metalness={0} />
      </mesh>

      <group scale={[scaleFactor, scaleFactor, scaleFactor]}>
        {useNativeScene && nativeScene ? (
          <primitive object={nativeScene} />
        ) : (
          <PreviewMeshes parts={resolvedParts} fallbackColor={color} />
        )}
        {showDimensions && dimensionsMm && dimensionGeometry && (
          <ModelDimensionLines
            geometry={dimensionGeometry}
            dimensionsMm={dimensionsMm}
            isOversized={isOversized}
          />
        )}
      </group>

      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={0.6}
        scale={120}
        blur={1.8}
        far={40}
        color="#475569"
        resolution={1024}
      />

      <OrbitControls
        makeDefault
        target={orbitTarget}
        enableZoom
        enablePan
        enableRotate
        enableDamping
        dampingFactor={0.08}
        panSpeed={0.8}
        screenSpacePanning
        minDistance={40}
        maxDistance={280}
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
      />
    </>
  )
}

function PreviewPlaceholder({
  isLoading,
  error,
}: {
  isLoading?: boolean
  error?: string | null
}) {
  return (
    <div className="flex aspect-square w-full flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-gradient-to-br from-secondary/60 via-background to-secondary/40 px-6 text-center">
      {isLoading ? (
        <>
          <Loader2 className="mb-3 h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">
            3D-Modell wird geladen…
          </p>
        </>
      ) : error ? (
        <>
          <Box className="mb-3 h-12 w-12 text-red-400/80" />
          <p className="text-sm font-medium text-red-400">{error}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Bitte STL, OBJ, GLB oder GLTF wählen.
          </p>
        </>
      ) : (
        <>
          <Box className="mb-3 h-14 w-14 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">
            Lade deine 3D-Datei hoch, um die Live-Vorschau zu starten
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Drehen, Zoomen und Farben direkt im Viewer prüfen
          </p>
        </>
      )}
    </div>
  )
}

export const Model3DPreview = forwardRef<
  HTMLCanvasElement,
  Model3DPreviewProps
>(function Model3DPreview(
  {
    geometry = null,
    meshParts = null,
    nativeScene = null,
    preserveEmbeddedColors = false,
    color = "#1a1a1a",
    scaleFactor,
    dimensionsMm = null,
    isOversized = false,
    isLoading,
    error,
    className,
  },
  ref
) {
  const [showDimensions, setShowDimensions] = useState(true)

  const hasModel =
    Boolean(geometry) ||
    Boolean(meshParts && meshParts.length > 0) ||
    Boolean(nativeScene)

  if (!hasModel || isLoading || error) {
    return (
      <PreviewPlaceholder isLoading={isLoading} error={error ?? undefined} />
    )
  }

  return (
    <div
      className={cn(
        "relative aspect-square w-full overflow-hidden rounded-xl border bg-gradient-to-br from-muted/50 via-background to-secondary/30 shadow-inner touch-none",
        isOversized
          ? "border-2 border-red-500/70 ring-2 ring-red-500/20"
          : "border-border/50",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setShowDimensions((v) => !v)}
        className={cn(
          "absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-lg border border-border/60 bg-white/90 px-2.5 py-1.5 text-[10px] font-medium text-zinc-700 shadow-sm backdrop-blur-sm transition-colors hover:border-primary/40 hover:text-primary dark:bg-card/90 dark:text-foreground"
        )}
        title={showDimensions ? "Masse ausblenden" : "Masse einblenden"}
      >
        {showDimensions ? (
          <Eye className="h-3.5 w-3.5" />
        ) : (
          <EyeOff className="h-3.5 w-3.5" />
        )}
        <span className="hidden sm:inline">
          {showDimensions ? "Masse aus" : "Masse ein"}
        </span>
      </button>

      <Canvas
        ref={ref}
        shadows
        camera={{ position: [90, 70, 90], fov: 42, near: 0.1, far: 2000 }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        className="h-full w-full"
        style={{ background: "transparent" }}
        {...{ [LEITBILD_3D_CANVAS_ATTR]: "true" }}
      >
        <Suspense fallback={null}>
          <PreviewScene
            geometry={geometry}
            meshParts={meshParts}
            nativeScene={nativeScene}
            preserveEmbeddedColors={preserveEmbeddedColors}
            color={color}
            scaleFactor={scaleFactor}
            dimensionsMm={dimensionsMm}
            showDimensions={showDimensions}
            isOversized={isOversized}
          />
        </Suspense>
      </Canvas>
      <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
        Drehen · Scroll/Pinch zoomen · Rechtsklick/Shift oder 2 Finger: verschieben
      </p>
    </div>
  )
})
