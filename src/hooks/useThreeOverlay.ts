"use client"

import type React from "react"

import { useEffect, useRef, useMemo, useCallback } from "react"
import * as THREE from "three"
import { ThreeJSOverlayView } from "@googlemaps/three"
import { useGLTF } from "@react-three/drei"

// Redux + slices
import { useAppSelector } from "@/store/store"
import type { StationFeature } from "@/store/stationsSlice"
import { selectRouteDecoded } from "@/store/bookingSlice"
import { selectDispatchRouteDecoded } from "@/store/dispatchSlice"

// Constants
import { DISPATCH_HUB } from "@/constants/map"

// Pre-create reusable objects for calculations
const tempMatrix = new THREE.Matrix4()
const tempVector = new THREE.Vector3()

/**
 * A custom curve that interpolates between a set of points.
 * TubeGeometry requires a Curve subclass.
 */
class CustomCurve extends THREE.Curve<THREE.Vector3> {
  private points: THREE.Vector3[]

  constructor(points: THREE.Vector3[]) {
    super()
    this.points = points
  }

  getPoint(t: number, optionalTarget = new THREE.Vector3()) {
    const segment = (this.points.length - 1) * t
    const index = Math.floor(segment)
    const alpha = segment - index

    if (index >= this.points.length - 1) {
      // If t is 1 or beyond, return the last point
      return optionalTarget.copy(this.points[this.points.length - 1])
    }

    const p0 = this.points[index]
    const p1 = this.points[index + 1]
    return optionalTarget.copy(p0).lerp(p1, alpha)
  }
}

/**
 * Function: create or update a 3D TUBE from decoded route
 */
function createOrUpdateTube(
  decodedPath: Array<{ lat: number; lng: number }>,
  meshRef: React.MutableRefObject<THREE.Mesh | null>,
  material: THREE.MeshPhongMaterial,
  scene: THREE.Scene,
  overlay: ThreeJSOverlayView,
  altitude: number,
) {
  // Skip if route is too short
  if (!decodedPath || decodedPath.length < 2) {
    return
  }

  // Convert lat/lng to Vector3 array (with altitude offset)
  const points = decodedPath.map(({ lat, lng }) => {
    const vector = new THREE.Vector3()
    overlay.latLngAltitudeToVector3({ lat, lng, altitude }, vector)
    return vector
  })

  // Build a custom curve from these points
  const curve = new CustomCurve(points)

  // Increase segments for smoother tube
  const tubularSegments = Math.max(points.length * 2, 30)
  const radius = 8 // thickness of the tube in world units
  const radialSegments = 6 // how many segments around the radius
  const closed = false // open route

  // Create a new TubeGeometry
  const geometry = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, closed)

  if (!meshRef.current) {
    // Create a new mesh
    const mesh = new THREE.Mesh(geometry, material)

    // Ensure it's drawn "on top"
    mesh.renderOrder = 999

    meshRef.current = mesh
    scene.add(mesh)
  } else {
    // Update existing mesh geometry
    meshRef.current.geometry.dispose()
    meshRef.current.geometry = geometry
  }
}

// Animation state tracking for station color transitions
interface StationAnimationState {
  startTime: number
  duration: number
  fromColor: THREE.Color
  toColor: THREE.Color
  isAnimating: boolean
}

// Type guard for checking if an object is a car
function isCarObject(obj: THREE.Object3D): boolean {
  return (
    obj.userData !== undefined && obj.userData !== null && typeof obj.userData === "object" && "isCar" in obj.userData
  )
}

/**
 * Hook: useThreeOverlay with:
 *   1) InstancedMesh cubes for stations
 *   2) 3D Tube geometry for dispatch/booking routes
 *   3) InstancedMesh spheres for cars
 */
export function useThreeOverlay(
  googleMap: google.maps.Map | null,
  stations: StationFeature[],
  departureStationId: number | null,
  arrivalStationId: number | null,
  cars: Array<{ id: number; lat: number; lng: number }>, // <-- NEW parameter
) {
  // References to the overlay and scene
  const overlayRef = useRef<ThreeJSOverlayView | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)

  // Refs for the station InstancedMeshes
  const greyInstancedMeshRef = useRef<THREE.InstancedMesh | null>(null)
  const blueInstancedMeshRef = useRef<THREE.InstancedMesh | null>(null)
  const redInstancedMeshRef = useRef<THREE.InstancedMesh | null>(null)

  // Refs for the station ring InstancedMeshes
  const greyRingInstancedMeshRef = useRef<THREE.InstancedMesh | null>(null)
  const blueRingInstancedMeshRef = useRef<THREE.InstancedMesh | null>(null)
  const redRingInstancedMeshRef = useRef<THREE.InstancedMesh | null>(null)

  // Station ID mapping refs
  const stationIndexMapsRef = useRef<{
    grey: number[]
    blue: number[]
    red: number[]
  }>({
    grey: [],
    blue: [],
    red: [],
  })

  // Animation state for color transitions
  const animationStateRef = useRef<Map<number, StationAnimationState>>(new Map())
  const lastFrameTimeRef = useRef<number>(0)
  const animationFrameIdRef = useRef<number | null>(null)

  // Shared geometry/material refs with proper disposal
  const stationGeoRef = useRef<THREE.ExtrudeGeometry | null>(null)
  const stationRingGeoRef = useRef<THREE.ExtrudeGeometry | null>(null)
  const dispatchBoxGeoRef = useRef<THREE.BoxGeometry | null>(null)

  // Tube mesh references
  const dispatchRouteMeshRef = useRef<THREE.Mesh | null>(null)
  const bookingRouteMeshRef = useRef<THREE.Mesh | null>(null)

  // Materials for station cubes
  const matGreyRef = useRef<THREE.MeshPhongMaterial | null>(null)
  const matBlueRef = useRef<THREE.MeshPhongMaterial | null>(null)
  const matRedRef = useRef<THREE.MeshPhongMaterial | null>(null)
  const dispatchMatRef = useRef<THREE.MeshPhongMaterial | null>(null)

  // Materials for station rings
  const ringMatGreyRef = useRef<THREE.MeshPhongMaterial | null>(null)
  const ringMatBlueRef = useRef<THREE.MeshPhongMaterial | null>(null)
  const ringMatRedRef = useRef<THREE.MeshPhongMaterial | null>(null)

  // Materials for tubes
  const dispatchTubeMatRef = useRef<THREE.MeshPhongMaterial | null>(null)
  const bookingTubeMatRef = useRef<THREE.MeshPhongMaterial | null>(null)

  // --- NEW: Cars references ---
  const carGeoRef = useRef<THREE.Group | null>(null)
  const carsMatRef = useRef<THREE.MeshPhongMaterial | null>(null)
  const carsInstancedMeshRef = useRef<THREE.InstancedMesh | null>(null)

  // Pull Decoded Routes from Redux
  const dispatchRouteDecoded = useAppSelector(selectDispatchRouteDecoded)
  const bookingRouteDecoded = useAppSelector(selectRouteDecoded)

  // Lights (memoized)
  const lights = useMemo(
    () => ({
      ambient: new THREE.AmbientLight(0xffffff, 0.75),
      directional: (() => {
        const light = new THREE.DirectionalLight(0xffffff, 0.25)
        light.position.set(0, 10, 50)
        return light
      })(),
    }),
    [],
  )

  // How high the route tubes float above ground
  const ROUTE_ALTITUDE = 50

  // Add a new ref for the animation frame ID for continuous rendering
  const continuousRenderFrameIdRef = useRef<number | null>(null)

  // Animation function for color transitions
  const animateStationColors = useCallback(() => {
    const currentTime = performance.now()
    const deltaTime = currentTime - lastFrameTimeRef.current
    lastFrameTimeRef.current = currentTime

    let hasActiveAnimations = false

    animationStateRef.current.forEach((state, stationId) => {
      if (!state.isAnimating) return

      const elapsed = currentTime - state.startTime
      const progress = Math.min(elapsed / state.duration, 1)

      if (progress < 1) {
        hasActiveAnimations = true

        // Interpolate color
        const currentColor = new THREE.Color().lerpColors(state.fromColor, state.toColor, progress)

        // Find which mesh this station is in
        const blueIndex = stationIndexMapsRef.current.blue.indexOf(stationId)
        const redIndex = stationIndexMapsRef.current.red.indexOf(stationId)

        if (blueIndex !== -1 && blueInstancedMeshRef.current && blueRingInstancedMeshRef.current) {
          // Update the material color for this instance
          const tempMaterial = blueInstancedMeshRef.current.material as THREE.MeshPhongMaterial
          tempMaterial.color.copy(currentColor)

          const ringMaterial = blueRingInstancedMeshRef.current.material as THREE.MeshPhongMaterial
          ringMaterial.color.copy(currentColor)
          ringMaterial.emissive.copy(currentColor).multiplyScalar(0.2)
        } else if (redIndex !== -1 && redInstancedMeshRef.current && redRingInstancedMeshRef.current) {
          // Update the material color for this instance
          const tempMaterial = redInstancedMeshRef.current.material as THREE.MeshPhongMaterial
          tempMaterial.color.copy(currentColor)

          const ringMaterial = redRingInstancedMeshRef.current.material as THREE.MeshPhongMaterial
          ringMaterial.color.copy(currentColor)
          ringMaterial.emissive.copy(currentColor).multiplyScalar(0.2)
        }
      } else {
        // Animation complete
        state.isAnimating = false
      }
    })

    // Request next frame if we have active animations
    if (hasActiveAnimations) {
      animationFrameIdRef.current = requestAnimationFrame(animateStationColors)

      // Request a redraw of the overlay
      if (overlayRef.current) {
        overlayRef.current.requestRedraw()
      }
    } else {
      animationFrameIdRef.current = null
    }
  }, [])

  // Add a continuous render function after the animateStationColors function
  const continuousRender = useCallback(() => {
    // Request a redraw of the overlay
    if (overlayRef.current) {
      overlayRef.current.requestRedraw()
    }

    // Schedule the next frame
    continuousRenderFrameIdRef.current = requestAnimationFrame(continuousRender)
  }, [])

  // Start a color transition animation for a station
  const startColorTransition = useCallback(
    (stationId: number, fromColor: THREE.Color, toColor: THREE.Color) => {
      const state: StationAnimationState = {
        startTime: performance.now(),
        duration: 800, // 800ms transition
        fromColor,
        toColor,
        isAnimating: true,
      }

      animationStateRef.current.set(stationId, state)

      // Start animation loop if not already running
      if (animationFrameIdRef.current === null) {
        lastFrameTimeRef.current = performance.now()
        animationFrameIdRef.current = requestAnimationFrame(animateStationColors)
      }
    },
    [animateStationColors],
  )

  // -------------------------------------------------
  // Function: populate station cubes in instanced meshes
  // -------------------------------------------------
  function populateInstancedMeshes() {
    if (
      !greyInstancedMeshRef.current ||
      !blueInstancedMeshRef.current ||
      !redInstancedMeshRef.current ||
      !greyRingInstancedMeshRef.current ||
      !blueRingInstancedMeshRef.current ||
      !redRingInstancedMeshRef.current ||
      !overlayRef.current
    ) {
      return
    }

    const greyMesh = greyInstancedMeshRef.current
    const blueMesh = blueInstancedMeshRef.current
    const redMesh = redInstancedMeshRef.current

    const greyRingMesh = greyRingInstancedMeshRef.current
    const blueRingMesh = blueRingInstancedMeshRef.current
    const redRingMesh = redRingInstancedMeshRef.current

    const counts = { grey: 0, blue: 0, red: 0 }

    // Clear existing maps
    stationIndexMapsRef.current = { grey: [], blue: [], red: [] }

    // Batch process stations
    stations.forEach((station) => {
      const [lng, lat] = station.geometry.coordinates

      // Convert lat/lng to 3D coords
      overlayRef.current!.latLngAltitudeToVector3({ lat, lng, altitude: DISPATCH_HUB.altitude + 50 }, tempVector)

      // Reuse tempMatrix for transform
      tempMatrix.makeTranslation(tempVector.x, tempVector.y, tempVector.z)

      // Color stations by departure/arrival or normal
      if (station.id === departureStationId) {
        // Check if this station was previously grey and needs animation
        const wasGrey =
          !stationIndexMapsRef.current.blue.includes(station.id) &&
          !stationIndexMapsRef.current.red.includes(station.id)

        if (wasGrey && matGreyRef.current && matBlueRef.current) {
          // Start color transition animation
          startColorTransition(station.id, matGreyRef.current.color.clone(), matBlueRef.current.color.clone())
        }

        blueMesh.setMatrixAt(counts.blue, tempMatrix)
        blueRingMesh.setMatrixAt(counts.blue, tempMatrix)
        stationIndexMapsRef.current.blue[counts.blue] = station.id
        counts.blue++
      } else if (station.id === arrivalStationId) {
        // Check if this station was previously grey and needs animation
        const wasGrey =
          !stationIndexMapsRef.current.blue.includes(station.id) &&
          !stationIndexMapsRef.current.red.includes(station.id)

        if (wasGrey && matGreyRef.current && matRedRef.current) {
          // Start color transition animation
          startColorTransition(station.id, matGreyRef.current.color.clone(), matRedRef.current.color.clone())
        }

        redMesh.setMatrixAt(counts.red, tempMatrix)
        redRingMesh.setMatrixAt(counts.red, tempMatrix)
        stationIndexMapsRef.current.red[counts.red] = station.id
        counts.red++
      } else {
        greyMesh.setMatrixAt(counts.grey, tempMatrix)
        greyRingMesh.setMatrixAt(counts.grey, tempMatrix)
        stationIndexMapsRef.current.grey[counts.grey] = station.id
        counts.grey++
      }
    })

    greyMesh.count = counts.grey
    blueMesh.count = counts.blue
    redMesh.count = counts.red

    greyRingMesh.count = counts.grey
    blueRingMesh.count = counts.blue
    redRingMesh.count = counts.red

    greyMesh.instanceMatrix.needsUpdate = true
    blueMesh.instanceMatrix.needsUpdate = true
    redMesh.instanceMatrix.needsUpdate = true

    greyRingMesh.instanceMatrix.needsUpdate = true
    blueRingMesh.instanceMatrix.needsUpdate = true
    redRingMesh.instanceMatrix.needsUpdate = true
  }

  // -------------------------------------------------
  // NEW: Populate cars with 3D models instead of instanced meshes
  // -------------------------------------------------
  function populateCarsInstancedMesh() {
    if (!carGeoRef.current || !overlayRef.current || !sceneRef.current) return

    // Remove previous car models
    const existingCars: THREE.Object3D[] = []
    sceneRef.current.children.forEach((child: THREE.Object3D) => {
      if (isCarObject(child)) {
        existingCars.push(child)
      }
    })

    existingCars.forEach((car) => {
      if (sceneRef.current) {
        sceneRef.current.remove(car)
      }
    })

    // Position each car
    cars.forEach((car) => {
      if (!carGeoRef.current || !overlayRef.current || !sceneRef.current) return

      // Convert lat/lng to 3D position
      overlayRef.current.latLngAltitudeToVector3({ lat: car.lat, lng: car.lng, altitude: 50 }, tempVector)

      // Clone the car model
      const carModel = carGeoRef.current.clone()
      carModel.userData = {
        isCar: true,
        carId: car.id,
      }

      // Position the car
      carModel.position.set(tempVector.x, tempVector.y, tempVector.z)

      // Rotate to face the direction of travel (if needed)
      // This assumes cars are facing +Z in the model
      carModel.rotation.x = Math.PI / 2 // Rotate to point upward

      // Make the model visible
      carModel.visible = true

      // Add to scene
      sceneRef.current.add(carModel)
    })

    // Request a redraw
    if (overlayRef.current) {
      overlayRef.current.requestRedraw()
    }
  }

  const carModelData = useGLTF("/cars/defaultModel.glb")

  // -------------------------------------------------
  // Initialize overlay + scene
  // -------------------------------------------------
  useEffect(() => {
    // Only init once map + stations are loaded
    if (!googleMap || stations.length === 0) return

    console.log("[useThreeOverlay] Initializing Three.js overlay...")

    // Create scene
    const scene = new THREE.Scene()
    scene.background = null
    sceneRef.current = scene

    // Add lights
    scene.add(lights.ambient)
    scene.add(lights.directional)

    // Create overlay
    const overlay = new ThreeJSOverlayView({
      map: googleMap,
      scene,
      anchor: DISPATCH_HUB,
      // @ts-expect-error - (typings for Google Maps + Three might need ignoring)
      THREE,
    })
    overlayRef.current = overlay

    // Create shared geometries (station boxes, dispatch box)
    if (!dispatchBoxGeoRef.current) {
      dispatchBoxGeoRef.current = new THREE.BoxGeometry(50, 50, 50)
    }

    // Create station hexagon geometry
    if (!stationGeoRef.current) {
      // Create a more minimal station marker - a flat hexagon with slight extrusion
      const stationShape = new THREE.Shape()
      const size = 30 // Increased size for better touch target

      // Create a hexagon shape
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i
        const x = size * Math.cos(angle)
        const y = size * Math.sin(angle)
        if (i === 0) stationShape.moveTo(x, y)
        else stationShape.lineTo(x, y)
      }
      stationShape.closePath()

      const extrudeSettings = {
        depth: 5, // Thin extrusion
        bevelEnabled: false,
      }

      stationGeoRef.current = new THREE.ExtrudeGeometry(stationShape, extrudeSettings)
    }

    // Create station ring geometry (outer ring)
    if (!stationRingGeoRef.current) {
      // Create outer ring as a hollow hexagon
      const outerShape = new THREE.Shape()
      const innerShape = new THREE.Path()

      const outerSize = 38 // Outer ring size
      const innerSize = 32 // Inner hole size (slightly larger than the station hexagon)

      // Create outer hexagon
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i
        const x = outerSize * Math.cos(angle)
        const y = outerSize * Math.sin(angle)
        if (i === 0) outerShape.moveTo(x, y)
        else outerShape.lineTo(x, y)
      }
      outerShape.closePath()

      // Create inner hexagon (hole)
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i
        const x = innerSize * Math.cos(angle)
        const y = innerSize * Math.sin(angle)
        if (i === 0) innerShape.moveTo(x, y)
        else innerShape.lineTo(x, y)
      }
      innerShape.closePath()

      // Add the inner shape as a hole in the outer shape
      outerShape.holes.push(innerShape)

      const extrudeSettings = {
        depth: 3, // Thinner than the main hexagon
        bevelEnabled: false,
      }

      stationRingGeoRef.current = new THREE.ExtrudeGeometry(outerShape, extrudeSettings)
    }

    // Create shared materials for station hexagons
    if (!matGreyRef.current) {
      matGreyRef.current = new THREE.MeshPhongMaterial({
        color: 0xeeeeee,
      })
    }
    if (!matBlueRef.current) {
      matBlueRef.current = new THREE.MeshPhongMaterial({
        color: 0x0000ff,
        opacity: 0.95,
        transparent: true,
      })
    }
    if (!matRedRef.current) {
      matRedRef.current = new THREE.MeshPhongMaterial({
        color: 0xff0000,
        opacity: 0.95,
        transparent: true,
      })
    }
    if (!dispatchMatRef.current) {
      dispatchMatRef.current = new THREE.MeshPhongMaterial({
        color: 0x00ff00,
        opacity: 0.8,
        transparent: true,
      })
    }

    // Create materials for station rings with slight glow effect
    if (!ringMatGreyRef.current) {
      ringMatGreyRef.current = new THREE.MeshPhongMaterial({
        color: 0xcccccc,
        emissive: 0x333333,
        shininess: 80,
      })
    }
    if (!ringMatBlueRef.current) {
      ringMatBlueRef.current = new THREE.MeshPhongMaterial({
        color: 0x0000ff,
        emissive: 0x000033,
        shininess: 80,
        opacity: 0.95,
        transparent: true,
      })
    }
    if (!ringMatRedRef.current) {
      ringMatRedRef.current = new THREE.MeshPhongMaterial({
        color: 0xff0000,
        emissive: 0x330000,
        shininess: 80,
        opacity: 0.95,
        transparent: true,
      })
    }

    // Create materials for route tubes
    if (!dispatchTubeMatRef.current) {
      dispatchTubeMatRef.current = new THREE.MeshPhongMaterial({
        color: 0xf5f5f5,
        opacity: 0.5,
        transparent: true,
      })
    }
    if (!bookingTubeMatRef.current) {
      bookingTubeMatRef.current = new THREE.MeshPhongMaterial({
        color: 0x03a9f4,
        opacity: 0.8,
        transparent: true,
      })
    }

    // Create InstancedMeshes for stations
    const maxInstances = stations.length
    const colors = ["grey", "blue", "red"] as const
    const materials = {
      grey: matGreyRef.current!,
      blue: matBlueRef.current!,
      red: matRedRef.current!,
    }
    const ringMaterials = {
      grey: ringMatGreyRef.current!,
      blue: ringMatBlueRef.current!,
      red: ringMatRedRef.current!,
    }
    const meshRefs = {
      grey: greyInstancedMeshRef,
      blue: blueInstancedMeshRef,
      red: redInstancedMeshRef,
    }
    const ringMeshRefs = {
      grey: greyRingInstancedMeshRef,
      blue: blueRingInstancedMeshRef,
      red: redRingInstancedMeshRef,
    }

    // Create both the station hexagons and their rings
    colors.forEach((color) => {
      // Create the main hexagon mesh
      const mesh = new THREE.InstancedMesh(stationGeoRef.current!, materials[color], maxInstances)
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      // Disable culling for BLUE/RED:
      if (color === "blue" || color === "red") {
        mesh.frustumCulled = false
      }
      scene.add(mesh)
      meshRefs[color].current = mesh

      // Create the ring mesh
      const ringMesh = new THREE.InstancedMesh(stationRingGeoRef.current!, ringMaterials[color], maxInstances)
      ringMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      if (color === "blue" || color === "red") {
        ringMesh.frustumCulled = false
      }
      // Set render order to ensure ring is drawn behind the main hexagon
      ringMesh.renderOrder = 998
      scene.add(ringMesh)
      ringMeshRefs[color].current = ringMesh
    })

    // --- NEW: Load 3D car model instead of creating a shape ---
    if (carModelData && !carGeoRef.current) {
      // Load the car model
      const { scene: modelScene } = carModelData as any

      // Create a Group to hold the car model instances
      const group = new THREE.Group()

      // Clone the model for reference
      const clonedScene = modelScene.clone()

      // Scale the model appropriately for the map
      clonedScene.scale.set(10, 10, 10)

      // Hide the original reference model
      clonedScene.visible = false

      // Store the reference
      carGeoRef.current = clonedScene

      // Add to scene for later cloning
      scene.add(group)
    }

    if (!carsMatRef.current) {
      // We'll still keep a material reference for potential highlighting
      carsMatRef.current = new THREE.MeshPhongMaterial({
        color: 0xff5722, // Bright orange for high contrast on dark gray map
        opacity: 0.95,
        transparent: true,
      })
    }

    // Populate station cubes, cars, etc.
    populateInstancedMeshes()
    populateCarsInstancedMesh()
    overlay.requestRedraw()

    // Start continuous rendering to keep geometries visible
    continuousRender()

    // Cleanup
    return () => {
      console.log("[useThreeOverlay] Cleaning up Three.js overlay...")

      // Cancel any ongoing animations
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current)
        animationFrameIdRef.current = null
      }

      // Cancel continuous rendering
      if (continuousRenderFrameIdRef.current !== null) {
        cancelAnimationFrame(continuousRenderFrameIdRef.current)
        continuousRenderFrameIdRef.current = null
      }

      // Remove overlay
      if (overlayRef.current) {
        ;(overlayRef.current.setMap as (map: google.maps.Map | null) => void)(null)
      }

      // Clear scene
      scene.clear()
      sceneRef.current = null

      // Dispose station geometries
      dispatchBoxGeoRef.current?.dispose()
      stationGeoRef.current?.dispose()
      stationRingGeoRef.current?.dispose()

      // Dispose station materials
      matGreyRef.current?.dispose()
      matBlueRef.current?.dispose()
      matRedRef.current?.dispose()
      dispatchMatRef.current?.dispose()

      // Dispose ring materials
      ringMatGreyRef.current?.dispose()
      ringMatBlueRef.current?.dispose()
      ringMatRedRef.current?.dispose()

      // Dispose route tube materials
      dispatchTubeMatRef.current?.dispose()
      bookingTubeMatRef.current?.dispose()

      // Dispose car geometry + material
      if (carGeoRef.current) {
        carGeoRef.current.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry?.dispose()
            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach((mat) => mat.dispose())
              } else {
                object.material.dispose()
              }
            }
          }
        })
        carGeoRef.current = null
      }
      carsMatRef.current?.dispose()
      carsMatRef.current = null

      // Remove car instances from scene
      if (sceneRef.current) {
        // Find all car objects in the scene
        const carInstances: THREE.Object3D[] = []

        // Use for loop instead of forEach to avoid type issues
        for (let i = 0; i < scene.children.length; i++) {
          const child = scene.children[i]
          if (isCarObject(child)) {
            carInstances.push(child)
          }
        }

        // Remove each car from the scene
        carInstances.forEach((car) => {
          scene.remove(car)
        })
      }

      // Null out references
      dispatchBoxGeoRef.current = null
      stationGeoRef.current = null
      stationRingGeoRef.current = null

      matGreyRef.current = null
      matBlueRef.current = null
      matRedRef.current = null
      dispatchMatRef.current = null

      ringMatGreyRef.current = null
      ringMatBlueRef.current = null
      ringMatRedRef.current = null

      dispatchTubeMatRef.current = null
      bookingTubeMatRef.current = null
      carGeoRef.current = null
      carsMatRef.current = null

      greyInstancedMeshRef.current = null
      blueInstancedMeshRef.current = null
      redInstancedMeshRef.current = null
      greyRingInstancedMeshRef.current = null
      blueRingInstancedMeshRef.current = null
      redRingInstancedMeshRef.current = null
      carsInstancedMeshRef.current = null

      // Remove route meshes
      if (dispatchRouteMeshRef.current) {
        dispatchRouteMeshRef.current.geometry.dispose()
      }
      dispatchRouteMeshRef.current = null

      if (bookingRouteMeshRef.current) {
        bookingRouteMeshRef.current.geometry.dispose()
      }
      bookingRouteMeshRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleMap, stations.length, lights, startColorTransition, carModelData])

  // -------------------------------------------------
  // Whenever station selection changes, re-populate cubes
  // -------------------------------------------------
  useEffect(() => {
    if (!sceneRef.current || !overlayRef.current || !googleMap || stations.length === 0) {
      return
    }
    populateInstancedMeshes()
    overlayRef.current.requestRedraw()
  }, [departureStationId, arrivalStationId, stations.length, googleMap])

  // -------------------------------------------------
  // Whenever cars change, re-populate the car instanced mesh
  // -------------------------------------------------
  useEffect(() => {
    if (!sceneRef.current || !overlayRef.current) return
    populateCarsInstancedMesh()
    overlayRef.current.requestRedraw()
  }, [cars])

  // -------------------------------------------------
  // Whenever routes change, draw TUBE geometry routes
  // -------------------------------------------------
  useEffect(() => {
    if (!sceneRef.current || !overlayRef.current) return

    // Dispatch route
    if (dispatchRouteDecoded && dispatchRouteDecoded.length >= 2 && dispatchTubeMatRef.current) {
      // Skip creating dispatch routes as per requirement #1
      if (dispatchRouteMeshRef.current) {
        sceneRef.current.remove(dispatchRouteMeshRef.current)
        dispatchRouteMeshRef.current.geometry.dispose()
        dispatchRouteMeshRef.current = null
      }
    } else if (dispatchRouteMeshRef.current) {
      // Clear existing mesh if route is empty or too short
      sceneRef.current.remove(dispatchRouteMeshRef.current)
      dispatchRouteMeshRef.current.geometry.dispose()
      dispatchRouteMeshRef.current = null
    }

    // Booking route
    if (bookingRouteDecoded && bookingRouteDecoded.length >= 2 && bookingTubeMatRef.current) {
      createOrUpdateTube(
        bookingRouteDecoded,
        bookingRouteMeshRef,
        bookingTubeMatRef.current,
        sceneRef.current,
        overlayRef.current,
        ROUTE_ALTITUDE,
      )
    } else if (bookingRouteMeshRef.current) {
      // Clear existing mesh if route is empty or too short
      sceneRef.current.remove(bookingRouteMeshRef.current)
      bookingRouteMeshRef.current.geometry.dispose()
      bookingRouteMeshRef.current = null
    }

    overlayRef.current.requestRedraw()
  }, [dispatchRouteDecoded, bookingRouteDecoded, googleMap])

  // Return any refs or data you need
  return {
    overlayRef,
    sceneRef,
    greyInstancedMeshRef,
    blueInstancedMeshRef,
    redInstancedMeshRef,
    carsInstancedMeshRef, // optionally expose this
    stationIndexMapsRef,
  }
}

