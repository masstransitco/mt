"use client"

import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { useMemo } from "react"

interface CameraControllerProps {
  /**
   * The position where the camera should move.
   * E.g. [x, y, z]
   */
  targetPosition: [number, number, number]
  /**
   * A small offset so the camera looks a bit above or aside from targetPosition.
   * Default is [0, 0, 0].
   */
  lookAtOffset?: [number, number, number]
  /**
   * Adjust how quickly or slowly the camera moves each frame (0.1 ~ moderate speed).
   */
  lerpSpeed?: number
  /**
   * An optional callback if you want to run code once the camera is "close enough."
   * This is simplistic – you can refine if you need more precise detection.
   */
  onAnimationComplete?: () => void
}

/**
 * A simple camera controller that smoothly “lerps” the camera position/orientation
 * toward `targetPosition` each frame, so transitions are less abrupt.
 */
export function CameraController({
  targetPosition,
  lookAtOffset = [0, 0, 0],
  lerpSpeed = 0.1,
  onAnimationComplete,
}: CameraControllerProps) {
  const { camera } = useThree()

  // Turn array into a Vector3 for easier math
  const targetPos = useMemo(() => new THREE.Vector3(...targetPosition), [targetPosition])
  const lookAtPos = useMemo(
    () =>
      new THREE.Vector3(
        targetPosition[0] + lookAtOffset[0],
        targetPosition[1] + lookAtOffset[1],
        targetPosition[2] + lookAtOffset[2]
      ),
    [targetPosition, lookAtOffset]
  )

  useFrame(() => {
    // Move camera a fraction (lerpSpeed) of the way to target each frame
    camera.position.lerp(targetPos, lerpSpeed)
    // Re-orient camera to look at the offset position
    camera.lookAt(lookAtPos)

    // (Optional) If you need to detect when it’s “close enough,” you can do so here:
    if (onAnimationComplete) {
      // If the distance to target is small, call it “complete”
      const distance = camera.position.distanceTo(targetPos)
      if (distance < 0.05) {
        onAnimationComplete()
      }
    }
  })

  return null
}