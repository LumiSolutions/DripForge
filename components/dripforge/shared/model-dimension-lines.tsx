"use client"

import { useMemo } from "react"
import { Html, Line } from "@react-three/drei"
import type { BufferGeometry } from "three"
import * as THREE from "three"
import { cn } from "@/lib/utils"

export type DimensionsMm = {
  x: number
  y: number
  z: number
}

const LINE_COLOR = "#0891b2"
const LINE_COLOR_OVERSIZE = "#ef4444"
const EXTENSION_COLOR = "#94a3b8"
const BOUNDS_COLOR_OVERSIZE = "#dc2626"

function DimensionLabel({
  position,
  text,
  oversize,
}: {
  position: [number, number, number]
  text: string
  oversize?: boolean
}) {
  return (
    <Html position={position} center zIndexRange={[50, 0]} style={{ pointerEvents: "none" }}>
      <div
        className={cn(
          "whitespace-nowrap rounded border p-1 font-mono text-sm font-bold shadow-md",
          oversize
            ? "border-red-300 bg-red-50 text-red-800"
            : "border-gray-200 bg-white text-black"
        )}
      >
        {text}
      </div>
    </Html>
  )
}

function ModelBoundsBox({
  geometry,
  oversize,
}: {
  geometry: BufferGeometry
  oversize: boolean
}) {
  const edges = useMemo(() => {
    geometry.computeBoundingBox()
    const box = geometry.boundingBox
    if (!box) return [] as [THREE.Vector3, THREE.Vector3][]

    const { min, max } = box
    const c = [
      new THREE.Vector3(min.x, min.y, min.z),
      new THREE.Vector3(max.x, min.y, min.z),
      new THREE.Vector3(max.x, min.y, max.z),
      new THREE.Vector3(min.x, min.y, max.z),
      new THREE.Vector3(min.x, max.y, min.z),
      new THREE.Vector3(max.x, max.y, min.z),
      new THREE.Vector3(max.x, max.y, max.z),
      new THREE.Vector3(min.x, max.y, max.z),
    ]

    return [
      [c[0], c[1]],
      [c[1], c[2]],
      [c[2], c[3]],
      [c[3], c[0]],
      [c[4], c[5]],
      [c[5], c[6]],
      [c[6], c[7]],
      [c[7], c[4]],
      [c[0], c[4]],
      [c[1], c[5]],
      [c[2], c[6]],
      [c[3], c[7]],
    ] as [THREE.Vector3, THREE.Vector3][]
  }, [geometry])

  if (!oversize || edges.length === 0) return null

  return (
    <>
      {edges.map((pair, i) => (
        <Line
          key={`bounds-${i}`}
          points={pair}
          color={BOUNDS_COLOR_OVERSIZE}
          lineWidth={2}
        />
      ))}
    </>
  )
}

function toVec3(p: [number, number, number]) {
  return new THREE.Vector3(p[0], p[1], p[2])
}

function buildDimensionLayout(min: THREE.Vector3, max: THREE.Vector3) {
  const extent = Math.max(max.x - min.x, max.y - min.y, max.z - min.z)
  const pad = Math.max(extent * 0.1, 2)

  const yFloor = min.y + 0.05
  const zFront = min.z - pad
  const xLeft = min.x - pad
  const xRight = max.x + pad
  const zBack = max.z + pad * 0.35

  return { min, max, pad, yFloor, zFront, xLeft, xRight, zBack }
}

function DimensionLinesContent({
  layout,
  dimensionsMm,
  isOversized = false,
  boundsGeometry,
}: {
  layout: ReturnType<typeof buildDimensionLayout>
  dimensionsMm: DimensionsMm
  isOversized?: boolean
  boundsGeometry?: BufferGeometry
}) {
  const { min, max, yFloor, zFront, xLeft, xRight, zBack, pad } = layout

  const xDimStart: [number, number, number] = [min.x, yFloor, zFront]
  const xDimEnd: [number, number, number] = [max.x, yFloor, zFront]
  const xLabel: [number, number, number] = [
    (min.x + max.x) / 2,
    yFloor,
    zFront - pad * 0.25,
  ]

  const zDimStart: [number, number, number] = [xLeft, yFloor, min.z]
  const zDimEnd: [number, number, number] = [xLeft, yFloor, max.z]
  const zLabel: [number, number, number] = [
    xLeft - pad * 0.25,
    yFloor,
    (min.z + max.z) / 2,
  ]

  const yDimStart: [number, number, number] = [xRight, min.y, zBack]
  const yDimEnd: [number, number, number] = [xRight, max.y, zBack]
  const yLabel: [number, number, number] = [
    xRight + pad * 0.2,
    (min.y + max.y) / 2,
    zBack,
  ]

  const xExtensions: [THREE.Vector3, THREE.Vector3][] = [
    [toVec3([min.x, min.y, min.z]), toVec3([min.x, yFloor, zFront])],
    [toVec3([max.x, min.y, min.z]), toVec3([max.x, yFloor, zFront])],
  ]

  const zExtensions: [THREE.Vector3, THREE.Vector3][] = [
    [toVec3([min.x, min.y, min.z]), toVec3([xLeft, yFloor, min.z])],
    [toVec3([min.x, min.y, max.z]), toVec3([xLeft, yFloor, max.z])],
  ]

  const yExtensions: [THREE.Vector3, THREE.Vector3][] = [
    [toVec3([max.x, min.y, max.z]), toVec3([xRight, min.y, zBack])],
    [toVec3([max.x, max.y, max.z]), toVec3([xRight, max.y, zBack])],
  ]

  const lineColor = isOversized ? LINE_COLOR_OVERSIZE : LINE_COLOR

  return (
    <group>
      {boundsGeometry && (
        <ModelBoundsBox geometry={boundsGeometry} oversize={isOversized} />
      )}

      {xExtensions.map((pair, i) => (
        <Line
          key={`x-ext-${i}`}
          points={pair}
          color={EXTENSION_COLOR}
          lineWidth={1}
          transparent
          opacity={0.85}
        />
      ))}
      {zExtensions.map((pair, i) => (
        <Line
          key={`z-ext-${i}`}
          points={pair}
          color={EXTENSION_COLOR}
          lineWidth={1}
          transparent
          opacity={0.85}
        />
      ))}
      {yExtensions.map((pair, i) => (
        <Line
          key={`y-ext-${i}`}
          points={pair}
          color={EXTENSION_COLOR}
          lineWidth={1}
          transparent
          opacity={0.85}
        />
      ))}

      <Line
        points={[toVec3(xDimStart), toVec3(xDimEnd)]}
        color={lineColor}
        lineWidth={1.5}
        transparent
        opacity={0.9}
      />
      <Line
        points={[toVec3(zDimStart), toVec3(zDimEnd)]}
        color={lineColor}
        lineWidth={1.5}
        transparent
        opacity={0.9}
      />
      <Line
        points={[toVec3(yDimStart), toVec3(yDimEnd)]}
        color={lineColor}
        lineWidth={1.5}
        transparent
        opacity={0.9}
      />

      <DimensionLabel
        position={xLabel}
        text={`${dimensionsMm.x.toFixed(1)} mm`}
        oversize={isOversized}
      />
      <DimensionLabel
        position={zLabel}
        text={`${dimensionsMm.z.toFixed(1)} mm`}
        oversize={isOversized}
      />
      <DimensionLabel
        position={yLabel}
        text={`${dimensionsMm.y.toFixed(1)} mm`}
        oversize={isOversized}
      />
    </group>
  )
}

export function ObjectDimensionLines({
  object,
  dimensionsMm,
  isOversized = false,
}: {
  object: THREE.Object3D
  dimensionsMm: DimensionsMm
  isOversized?: boolean
}) {
  const layout = useMemo(() => {
    const box = new THREE.Box3().setFromObject(object)
    if (box.isEmpty()) return null
    return buildDimensionLayout(box.min, box.max)
  }, [object, dimensionsMm.x, dimensionsMm.y, dimensionsMm.z])

  if (!layout) return null

  return (
    <DimensionLinesContent
      layout={layout}
      dimensionsMm={dimensionsMm}
      isOversized={isOversized}
    />
  )
}

export function ModelDimensionLines({
  geometry,
  dimensionsMm,
  isOversized = false,
}: {
  geometry: BufferGeometry
  dimensionsMm: DimensionsMm
  isOversized?: boolean
}) {
  const layout = useMemo(() => {
    geometry.computeBoundingBox()
    const box = geometry.boundingBox
    if (!box) return null

    const min = box.min
    const max = box.max
    return buildDimensionLayout(box.min, box.max)
  }, [geometry])

  if (!layout) return null

  return (
    <DimensionLinesContent
      layout={layout}
      dimensionsMm={dimensionsMm}
      isOversized={isOversized}
      boundsGeometry={geometry}
    />
  )
}
