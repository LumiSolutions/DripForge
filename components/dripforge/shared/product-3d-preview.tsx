"use client"

import {
  forwardRef,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import { Canvas, useLoader } from "@react-three/fiber"
import { LEITBILD_3D_CANVAS_ATTR } from "@/lib/dripforge/capture-leitbild"
import {
  ContactShadows,
  Html,
  OrbitControls,
  useGLTF,
  useProgress,
} from "@react-three/drei"
import { Eye, EyeOff, Loader2, RotateCcw } from "lucide-react"
import type { BufferGeometry, Object3D } from "three"
import * as THREE from "three"
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js"
import { cn } from "@/lib/utils"
import {
  ObjectDimensionLines,
  type DimensionsMm,
} from "@/components/dripforge/shared/model-dimension-lines"
import {
  applyFilamentColorToScene,
  preparedSizeToDimensionsMm,
  prepareGltfScene,
  type PreparedSceneSize,
} from "@/lib/dripforge/prepare-gltf-scene"
import {
  getProduct3dModelFormat,
  type Product3dModelFormat,
} from "@/lib/dripforge/product-model-defaults"
import { ProductDetailErrorBoundary } from "@/components/dripforge/product-detail-error-boundary"

export type Product3DPreviewProps = {
  modelUrl?: string
  color?: string
  /** Feste Produktmasse für Bemaßungslabels im Viewer */
  fixedDimensionsMm?: DimensionsMm | null
  /** Produktdefinierte Standard-Orientierung (Grad) für die Initialansicht */
  initialRotationDeg?: { x?: number; y?: number; z?: number } | null
  /** Pausiert den Render-Loop (z. B. während Bild-Lightbox), ohne Canvas zu unmounten. */
  paused?: boolean
  className?: string
}

function normalizeFilamentHex(color: string | undefined): string {
  const trimmed = color?.trim() || "#1a1a1a"
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) {
    return trimmed
  }
  return "#1a1a1a"
}

function SceneLoader() {
  const { active, progress } = useProgress()
  if (!active) return null

  return (
    <Html center zIndexRange={[100, 0]}>
      <div className="flex flex-col items-center gap-2 rounded-lg border border-border/60 bg-background/95 px-4 py-3 shadow-md backdrop-blur-sm">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs font-medium text-foreground">
          3D-Modell wird geladen… {Math.round(progress)}%
        </p>
      </div>
    </Html>
  )
}

function usePreparedModel(
  scene: Object3D,
  color: string,
  tipSteps: number,
  onOrbitCenter: (y: number) => void,
  onPrepared: (scene: Object3D, sizeAt100: PreparedSceneSize) => void,
  initialRotationDeg?: { x?: number; y?: number; z?: number } | null
) {
  const rotationKey = initialRotationDeg
    ? `${initialRotationDeg.x ?? 0}|${initialRotationDeg.y ?? 0}|${initialRotationDeg.z ?? 0}`
    : ""
  const prepared = useMemo(() => {
    try {
      return prepareGltfScene(scene, {
        autoAlignFlat: true,
        tipSteps,
        extraRotationDeg: initialRotationDeg,
      })
    } catch (error) {
      console.warn("3D-Vorschau: prepareGltfScene fehlgeschlagen.", error)
      return null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, tipSteps, rotationKey])

  useEffect(() => {
    if (!prepared) return
    onOrbitCenter(prepared.orbitCenterY)
  }, [prepared, onOrbitCenter])

  useEffect(() => {
    if (!prepared) return
    onPrepared(prepared.scene, prepared.sizeAt100)
  }, [prepared, onPrepared])

  useEffect(() => {
    if (!prepared) return
    try {
      applyFilamentColorToScene(prepared.scene, color)
    } catch (error) {
      console.warn("3D-Vorschau: Filamentfarbe konnte nicht angewendet werden.", error)
    }
  }, [prepared, color])

  if (!prepared) {
    // Fehler an die innere ProductDetailErrorBoundary weiterreichen —
    // Galerie/Shop bleiben über die äussere Boundary nutzbar.
    throw new Error("3D-Modell konnte nicht vorbereitet werden.")
  }

  return prepared.scene
}

function GltfModel({
  url,
  color,
  tipSteps,
  onOrbitCenter,
  onPrepared,
  initialRotationDeg,
}: {
  url: string
  color: string
  tipSteps: number
  onOrbitCenter: (y: number) => void
  onPrepared: (scene: Object3D, sizeAt100: PreparedSceneSize) => void
  initialRotationDeg?: { x?: number; y?: number; z?: number } | null
}) {
  const { scene } = useGLTF(url)

  useEffect(() => {
    return () => {
      useGLTF.clear(url)
    }
  }, [url])

  const preparedScene = usePreparedModel(
    scene,
    color,
    tipSteps,
    onOrbitCenter,
    onPrepared,
    initialRotationDeg
  )
  return <primitive object={preparedScene} />
}

function StlModel({
  url,
  color,
  tipSteps,
  onOrbitCenter,
  onPrepared,
  initialRotationDeg,
}: {
  url: string
  color: string
  tipSteps: number
  onOrbitCenter: (y: number) => void
  onPrepared: (scene: Object3D, sizeAt100: PreparedSceneSize) => void
  initialRotationDeg?: { x?: number; y?: number; z?: number } | null
}) {
  const geometry = useLoader(STLLoader, url) as BufferGeometry
  const source = useMemo(() => {
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      metalness: 0.12,
      roughness: 0.62,
    })
    return new THREE.Mesh(geometry.clone(), material)
  }, [geometry, color])

  const preparedScene = usePreparedModel(
    source,
    color,
    tipSteps,
    onOrbitCenter,
    onPrepared,
    initialRotationDeg
  )
  return <primitive object={preparedScene} />
}

function ProductPreviewScene({
  modelUrl,
  modelFormat,
  color,
  tipSteps,
  fixedDimensionsMm,
  showDimensions,
  initialRotationDeg,
}: {
  modelUrl: string
  modelFormat: Product3dModelFormat
  color: string
  tipSteps: number
  fixedDimensionsMm?: DimensionsMm | null
  showDimensions: boolean
  initialRotationDeg?: { x?: number; y?: number; z?: number } | null
}) {
  const [orbitCenterY, setOrbitCenterY] = useState(50)
  const [modelScene, setModelScene] = useState<Object3D | null>(null)
  const [sizeAt100, setSizeAt100] = useState<PreparedSceneSize | null>(null)

  const handlePrepared = useCallback((scene: Object3D, size: PreparedSceneSize) => {
    setModelScene(scene)
    setSizeAt100(size)
  }, [])

  const dimensionsMm = useMemo((): DimensionsMm | null => {
    if (fixedDimensionsMm) return fixedDimensionsMm
    if (!sizeAt100) return null
    return preparedSizeToDimensionsMm(sizeAt100, 1)
  }, [fixedDimensionsMm, sizeAt100])

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

      <group>
        {modelFormat === "stl" ? (
          <StlModel
            key={`${modelUrl}-${tipSteps}`}
            url={modelUrl}
            color={color}
            tipSteps={tipSteps}
            onOrbitCenter={setOrbitCenterY}
            onPrepared={handlePrepared}
            initialRotationDeg={initialRotationDeg}
          />
        ) : (
          <GltfModel
            key={`${modelUrl}-${tipSteps}`}
            url={modelUrl}
            color={color}
            tipSteps={tipSteps}
            onOrbitCenter={setOrbitCenterY}
            onPrepared={handlePrepared}
            initialRotationDeg={initialRotationDeg}
          />
        )}
        {showDimensions && modelScene && dimensionsMm && (
          <ObjectDimensionLines object={modelScene} dimensionsMm={dimensionsMm} />
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
        target={[0, orbitCenterY, 0]}
        enableZoom
        enablePan
        enableRotate
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.9}
        zoomSpeed={0.85}
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

      <SceneLoader />
    </>
  )
}

export const Product3DPreview = forwardRef<
  HTMLCanvasElement,
  Product3DPreviewProps
>(function Product3DPreview(
  {
    modelUrl,
    color = "#1a1a1a",
    fixedDimensionsMm = null,
    initialRotationDeg = null,
    paused = false,
    className,
  },
  ref
) {
  const [showDimensions, setShowDimensions] = useState(true)
  const [tipSteps, setTipSteps] = useState(0)
  const resolvedUrl = modelUrl?.trim() ?? ""
  const modelFormat = getProduct3dModelFormat(resolvedUrl)
  const safeColor = normalizeFilamentHex(color)

  useEffect(() => {
    setTipSteps(0)
  }, [resolvedUrl])

  // Ohne gültige URL/Format keinen Canvas mounten — Galerie bleibt sichtbar.
  if (!resolvedUrl || !modelFormat) {
    return null
  }

  return (
    <div
      className={cn(
        "relative aspect-square w-full max-h-[450px] overflow-hidden rounded-xl border border-border/50 bg-muted/40 shadow-inner",
        className
      )}
      style={{ touchAction: "none" }}
    >
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => setShowDimensions((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border border-border/60 bg-white/90 px-2.5 py-1.5 text-[10px] font-medium text-zinc-700 shadow-sm backdrop-blur-sm transition-colors hover:border-primary/40 hover:text-primary dark:bg-card/90 dark:text-foreground"
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
        <button
          type="button"
          onClick={() => setTipSteps((n) => (n + 1) % 4)}
          className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-white/90 px-2.5 py-1.5 text-[10px] font-medium text-zinc-700 shadow-sm backdrop-blur-sm transition-colors hover:border-primary/40 hover:text-primary dark:bg-card/90 dark:text-foreground"
          title="Modell kippen / ausrichten"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Kippen</span>
        </button>
      </div>

      <ProductDetailErrorBoundary
        fallbackTitle="3D-Vorschau konnte nicht geladen werden. Das Produkt bleibt weiterhin bestellbar."
      >
        <Canvas
          ref={ref}
          shadows
          frameloop={paused ? "never" : "always"}
          camera={{ position: [90, 70, 90], fov: 42, near: 0.1, far: 2000 }}
          gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
          className="h-full w-full touch-none"
          style={{ background: "transparent", touchAction: "none" }}
          onCreated={({ gl }) => {
            gl.domElement.style.touchAction = "none"
            const canvas = gl.domElement
            const onContextLost = (event: Event) => {
              // Verhindert, dass Context-Loss als unhandled Error die Seite killt.
              event.preventDefault()
              console.warn("3D-Vorschau: WebGL-Context verloren — Canvas bleibt gemountet.")
            }
            canvas.addEventListener("webglcontextlost", onContextLost, false)
          }}
          {...{ [LEITBILD_3D_CANVAS_ATTR]: "true" }}
        >
          <Suspense fallback={null}>
            <ProductPreviewScene
              key={resolvedUrl}
              modelUrl={resolvedUrl}
              modelFormat={modelFormat}
              color={safeColor}
              tipSteps={tipSteps}
              fixedDimensionsMm={fixedDimensionsMm}
              showDimensions={showDimensions}
              initialRotationDeg={initialRotationDeg}
            />
          </Suspense>
        </Canvas>
      </ProductDetailErrorBoundary>
      <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
        Drehen · Scroll/Pinch zoomen · Rechtsklick/Shift oder 2 Finger: verschieben
      </p>
    </div>
  )
})
