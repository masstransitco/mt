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
  if (!decodedPath || decodedPath.length < 2) return

  // Convert lat/lng to Vector3 array (with altitude offset)
  const points = decodedPath.map(({ lat, lng }) => {
    const vector = new THREE.Vector3()
    overlay.latLngAltitudeToVector3({ lat, lng, altitude }, vector)
    return vector
  })

  // Build a custom curve from these points
  const curve = new CustomCurve(points)

  // Increase segments for smoother tube; clamp or tune as needed
  const tubularSegments = Math.min(Math.max(points.length * 2, 30), 150)
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
    meshRef.current.geometry.dispose() // Properly dispose old geometry
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

// Create a debounce function for throttling frequent events
function debounce(func: Function, wait: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null
  return (...args: any[]) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      func(...args)
      timeout = null
    }, wait)
  }
}

/**
 * Hook: useThreeOverlay
 *   1) InstancedMesh stations
 *   2) 3D Tube geometry for dispatch/booking routes
 *   3) 3D car models
 */
export function useThreeOverlay(
  googleMap: google.maps.Map | null,
  stations: StationFeature[],
  departureStationId: number | null,
  arrivalStationId: number | null,
  cars: Array<{ id: number; lat: number; lng: number }>,
) {
  // References to the overlay and scene
  const overlayRef = useRef<ThreeJSOverlayView | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const isInitializedRef = useRef<boolean>(false)

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
  const continuousRenderFrameIdRef = useRef<number | null>(null)

  // Shared geometry/material refs
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

  // --- Cars references ---
  const carGeoRef = useRef<THREE.Group | null>(null)
  const carsMatRef = useRef<THREE.MeshPhongMaterial | null>(null)
  const carModelsRef = useRef<Map<number, THREE.Object3D>>(new Map())

  // Store map event listeners for cleanup
  const mapEventListenersRef = useRef<google.maps.MapsEventListener[]>([])
  const observerRef = useRef<MutationObserver | null>(null)

  // Pull Decoded Routes from Redux
  const dispatchRouteDecoded = useAppSelector(selectDispatchRouteDecoded)
  const bookingRouteDecoded = useAppSelector(selectRouteDecoded)

  // Memoize cars data to prevent unnecessary updates
  const memoizedCars = useMemo(() => {
    return cars.map((car) => ({ ...car }))
  }, [cars])

  // Memoize station data to prevent unnecessary updates
  const memoizedStations = useMemo(() => {
    return stations
  }, [stations])

  // Memoize station selection to prevent unnecessary updates
  const stationSelection = useMemo(() => {
    return { departureStationId, arrivalStationId }
  }, [departureStationId, arrivalStationId])

  // Lights (memoized)
  const lights = useMemo(() => {
    const ambient = new THREE.AmbientLight(0xffffff, 0.75)
    const directional = new THREE.DirectionalLight(0xffffff, 0.25)
    directional.position.set(0, 10, 50)
    return { ambient, directional }
  }, [])

  // How high the route tubes float above ground
  const ROUTE_ALTITUDE = 50

  // Continuous render function to ensure visibility
  const continuousRender = useCallback(() => {
    // Request a redraw of the overlay
    if (overlayRef.current) {
      overlayRef.current.requestRedraw()
    }

    // Schedule the next frame
    continuousRenderFrameIdRef.current = requestAnimationFrame(continuousRender)
  }, [])

  // ---------- ANIMATION LOOP FOR COLOR TRANSITIONS ONLY -----------
  const animateFrame = useCallback(() => {
    const currentTime = performance.now()
    const deltaTime = currentTime - lastFrameTimeRef.current
    lastFrameTimeRef.current = currentTime

    let hasActiveAnimations = false

    // 1) Handle station color transitions
    animationStateRef.current.forEach((state, stationId) => {
      if (!state.isAnimating) return

      const elapsed = currentTime - state.startTime
      const progress = Math.min(elapsed / state.duration, 1)

      if (progress < 1) {
        hasActiveAnimations = true
        const currentColor = new THREE.Color().lerpColors(state.fromColor, state.toColor, progress)

        // Update whichever mesh this station belongs to
        const blueIndex = stationIndexMapsRef.current.blue.indexOf(stationId)
        const redIndex = stationIndexMapsRef.current.red.indexOf(stationId)

        if (blueIndex !== -1 && blueInstancedMeshRef.current && blueRingInstancedMeshRef.current) {
          const mainMat = blueInstancedMeshRef.current.material as THREE.MeshPhongMaterial
          const ringMat = blueRingInstancedMeshRef.current.material as THREE.MeshPhongMaterial
          mainMat.color.copy(currentColor)
          ringMat.color.copy(currentColor)
          ringMat.emissive.copy(currentColor).multiplyScalar(0.2)
        } else if (redIndex !== -1 && redInstancedMeshRef.current && redRingInstancedMeshRef.current) {
          const mainMat = redInstancedMeshRef.current.material as THREE.MeshPhongMaterial
          const ringMat = redRingInstancedMeshRef.current.material as THREE.MeshPhongMaterial
          mainMat.color.copy(currentColor)
          ringMat.color.copy(currentColor)
          ringMat.emissive.copy(currentColor).multiplyScalar(0.2)
        }
      } else {
        // Animation complete
        state.isAnimating = false
      }
    })

    // 2) If anything is still animating, continue the loop
    if (hasActiveAnimations) {
      animationFrameIdRef.current = requestAnimationFrame(animateFrame)
    } else {
      // Otherwise, stop
      animationFrameIdRef.current = null
    }
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
        animationFrameIdRef.current = requestAnimationFrame(animateFrame)
      }
    },
    [animateFrame],
  )

  // -------------------------------------------------
  // Function: populate station cubes in instanced meshes
  // -------------------------------------------------
  const populateInstancedMeshes = useCallback(() => {
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
    stationIndexMapsRef.current = { grey: [], blue: [], red: [] }

    memoizedStations.forEach((station) => {
      const [lng, lat] = station.geometry.coordinates
      overlayRef.current!.latLngAltitudeToVector3({ lat, lng, altitude: DISPATCH_HUB.altitude + 50 }, tempVector)

      tempMatrix.makeTranslation(tempVector.x, tempVector.y, tempVector.z)

      // Decide color based on departure/arrival
      if (station.id === stationSelection.departureStationId) {
        // If previously grey, start color transition
        if (matGreyRef.current && matBlueRef.current) {
          startColorTransition(station.id, matGreyRef.current.color.clone(), matBlueRef.current.color.clone())
        }
        blueMesh.setMatrixAt(counts.blue, tempMatrix)
        blueRingMesh.setMatrixAt(counts.blue, tempMatrix)
        stationIndexMapsRef.current.blue[counts.blue] = station.id
        counts.blue++
      } else if (station.id === stationSelection.arrivalStationId) {
        if (matGreyRef.current && matRedRef.current) {
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
  }, [memoizedStations, stationSelection, startColorTransition])

  // -------------------------------------------------
  // Populate cars with 3D models (clones)
  // -------------------------------------------------
  const populateCarModels = useCallback(() => {
    if (!carGeoRef.current || !overlayRef.current || !sceneRef.current) return

    // Track which cars are still present
    const currentCarIds = new Set(memoizedCars.map((car) => car.id))

    // Remove cars that are no longer in the data
    carModelsRef.current.forEach((carModel, carId) => {
      if (!currentCarIds.has(carId)) {
        sceneRef.current?.remove(carModel)
        carModelsRef.current.delete(carId)
      }
    })

    // Add or update cars
    memoizedCars.forEach((car) => {
      if (!carGeoRef.current || !overlayRef.current || !sceneRef.current) return

      overlayRef.current.latLngAltitudeToVector3({ lat: car.lat, lng: car.lng, altitude: 50 }, tempVector)

      let carModel: THREE.Object3D | undefined = carModelsRef.current.get(car.id)

      if (!carModel) {
        // Create new car model if it doesn't exist
        carModel = carGeoRef.current.clone()
        carModel.userData = { isCar: true, carId: car.id }
        carModel.visible = true
        sceneRef.current.add(carModel)
        carModelsRef.current.set(car.id, carModel)
      }

      // Update position
      carModel.position.set(tempVector.x, tempVector.y, tempVector.z)
      // Example rotation; depends on your model orientation
      carModel.rotation.x = Math.PI / 2
    })
  }, [memoizedCars])

  // Load a Draco-compressed GLB or normal GLB
  const { scene: carModelScene } = useGLTF("/cars/defaultModel.glb")

  // -------------------------------------------------
  // Initialize overlay + scene once
  // -------------------------------------------------
  useEffect(() => {
    if (!googleMap || memoizedStations.length === 0) return

    console.log("[useThreeOverlay] Initializing Three.js overlay...")
    isInitializedRef.current = false

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

    // IMPORTANT: Ensure the overlay is explicitly added to the map
    overlay.setMap(googleMap)

    // Create shared geometries if needed
    if (!dispatchBoxGeoRef.current) {
      dispatchBoxGeoRef.current = new THREE.BoxGeometry(50, 50, 50)
    }

    // Create station hexagon geometry
    if (!stationGeoRef.current) {
      const stationShape = new THREE.Shape()
      const size = 30
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i
        const x = size * Math.cos(angle)
        const y = size * Math.sin(angle)
        if (i === 0) stationShape.moveTo(x, y)
        else stationShape.lineTo(x, y)
      }
      stationShape.closePath()
      const extrudeSettings = { depth: 5, bevelEnabled: false }
      stationGeoRef.current = new THREE.ExtrudeGeometry(stationShape, extrudeSettings)
    }

    // Create station ring geometry
    if (!stationRingGeoRef.current) {
      const outerShape = new THREE.Shape()
      const innerShape = new THREE.Path()
      const outerSize = 38
      const innerSize = 32
      // Outer hex
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i
        const x = outerSize * Math.cos(angle)
        const y = outerSize * Math.sin(angle)
        if (i === 0) outerShape.moveTo(x, y)
        else outerShape.lineTo(x, y)
      }
      outerShape.closePath()
      // Inner hole
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i
        const x = innerSize * Math.cos(angle)
        const y = innerSize * Math.sin(angle)
        if (i === 0) innerShape.moveTo(x, y)
        else innerShape.lineTo(x, y)
      }
      innerShape.closePath()
      outerShape.holes.push(innerShape)
      const extrudeSettings = { depth: 3, bevelEnabled: false }
      stationRingGeoRef.current = new THREE.ExtrudeGeometry(outerShape, extrudeSettings)
    }

    // Create materials
    if (!matGreyRef.current) {
      matGreyRef.current = new THREE.MeshPhongMaterial({ color: 0xeeeeee })
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

    // Create InstancedMeshes for stations (only once)
    const maxInstances = memoizedStations.length
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
    colors.forEach((color) => {
      const mainMesh = new THREE.InstancedMesh(stationGeoRef.current!, materials[color], maxInstances)
      // Let frustum culling do its work:
      mainMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      // Disable frustum culling for blue/red to ensure they're always visible
      if (color === "blue" || color === "red") {
        mainMesh.frustumCulled = false
      }
      scene.add(mainMesh)
      meshRefs[color].current = mainMesh

      const ringMesh = new THREE.InstancedMesh(stationRingGeoRef.current!, ringMaterials[color], maxInstances)
      ringMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      // Disable frustum culling for blue/red rings
      if (color === "blue" || color === "red") {
        ringMesh.frustumCulled = false
      }
      ringMesh.renderOrder = 998
      scene.add(ringMesh)
      ringMeshRefs[color].current = ringMesh
    })

    // Prepare car model (store the loaded GLTF in a ref)
    if (carModelScene && !carGeoRef.current) {
      const clonedScene = carModelScene.clone()
      // Scale the model appropriately
      clonedScene.scale.set(10, 10, 10)
      // We'll keep it invisible as a reference
      clonedScene.visible = false
      carGeoRef.current = clonedScene

      // Keep a default cars material reference if needed
      carsMatRef.current = new THREE.MeshPhongMaterial({
        color: 0xff5722,
        opacity: 0.95,
        transparent: true,
      })
    }

    // Populate stations + cars once
    populateInstancedMeshes()
    populateCarModels()

    // Force an immediate redraw after initial setup
    overlay.requestRedraw()

    // Add a small delay before requesting another redraw
    const initialRenderTimer = setTimeout(() => {
      overlay.requestRedraw()
      isInitializedRef.current = true
    }, 100)

    // Create a debounced redraw function for high-frequency events
    const debouncedRedraw = debounce(() => {
      if (overlayRef.current) {
        overlayRef.current.requestRedraw()
      }
    }, 150)

    // Register map event listeners to ensure redraws happen on key map events
    if (googleMap) {
      mapEventListenersRef.current = [
        // Critical events - immediate redraw
        googleMap.addListener("idle", () => overlayRef.current?.requestRedraw()),
        googleMap.addListener("tilesloaded", () => overlayRef.current?.requestRedraw()),

        // High-frequency events - debounced redraw
        googleMap.addListener("zoom_changed", debouncedRedraw),
        googleMap.addListener("center_changed", debouncedRedraw),
        googleMap.addListener("bounds_changed", debouncedRedraw),
        googleMap.addListener("dragstart", debouncedRedraw),
        googleMap.addListener("dragend", () => overlayRef.current?.requestRedraw()),
      ]
    }

    // Set up a MutationObserver to watch for DOM changes to the map container
    // This helps ensure the overlay stays visible when the map undergoes structural changes
    if (googleMap.getDiv && typeof window !== "undefined" && window.MutationObserver) {
      const mapDiv = googleMap.getDiv()

      const observer = new MutationObserver((mutations) => {
        // Only request a redraw if there were actual changes
        if (mutations.length > 0 && overlayRef.current) {
          overlayRef.current.requestRedraw()
        }
      })

      observer.observe(mapDiv, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: ["style", "class"],
      })

      observerRef.current = observer
    }

    // Start continuous rendering to keep geometries visible
    continuousRender()

    // Cleanup on unmount
    return () => {
      console.log("[useThreeOverlay] Cleaning up Three.js overlay...")

      // Clear the timeout
      clearTimeout(initialRenderTimer)

      // Disconnect the MutationObserver
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }

      // Remove map event listeners
      mapEventListenersRef.current.forEach((listener) => {
        if (google && google.maps) {
          google.maps.event.removeListener(listener)
        }
      })
      mapEventListenersRef.current = []

      // Cancel any pending animation frames
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current)
        animationFrameIdRef.current = null
      }

      if (continuousRenderFrameIdRef.current !== null) {
        cancelAnimationFrame(continuousRenderFrameIdRef.current)
        continuousRenderFrameIdRef.current = null
      }

      // Remove overlay from map
      if (overlayRef.current) {
        // Depending on your TS definitions, you may need a cast:
        ;(overlayRef.current.setMap as (map: google.maps.Map | null) => void)(null)
      }

      // Clean up car models
      carModelsRef.current.forEach((model) => {
        if (sceneRef.current) {
          sceneRef.current.remove(model)
        }

        // Dispose of geometries and materials
        model.traverse((obj: THREE.Object3D) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh
            if (mesh.geometry) mesh.geometry.dispose()

            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((material) => material.dispose())
            } else if (mesh.material) {
              mesh.material.dispose()
            }
          }
        })
      })
      carModelsRef.current.clear()

      // Dispose geometry/material references
      dispatchBoxGeoRef.current?.dispose()
      dispatchBoxGeoRef.current = null

      stationGeoRef.current?.dispose()
      stationGeoRef.current = null

      stationRingGeoRef.current?.dispose()
      stationRingGeoRef.current = null

      matGreyRef.current?.dispose()
      matGreyRef.current = null
      matBlueRef.current?.dispose()
      matBlueRef.current = null
      matRedRef.current?.dispose()
      matRedRef.current = null
      dispatchMatRef.current?.dispose()
      dispatchMatRef.current = null

      ringMatGreyRef.current?.dispose()
      ringMatGreyRef.current = null
      ringMatBlueRef.current?.dispose()
      ringMatBlueRef.current = null
      ringMatRedRef.current?.dispose()
      ringMatRedRef.current = null

      dispatchTubeMatRef.current?.dispose()
      dispatchTubeMatRef.current = null
      bookingTubeMatRef.current?.dispose()
      bookingTubeMatRef.current = null

      // Dispose car model geometry/material
      if (carGeoRef.current) {
        carGeoRef.current.traverse((obj: any) => {
          if (obj.isMesh) {
            obj.geometry?.dispose()
            if (Array.isArray(obj.material)) {
              obj.material.forEach((mat: THREE.Material) => mat.dispose())
            } else {
              obj.material?.dispose()
            }
          }
        })
        carGeoRef.current = null
      }
      carsMatRef.current?.dispose()
      carsMatRef.current = null

      // Remove route meshes
      if (dispatchRouteMeshRef.current) {
        dispatchRouteMeshRef.current.geometry.dispose()
        if (sceneRef.current) {
          sceneRef.current.remove(dispatchRouteMeshRef.current)
        }
        dispatchRouteMeshRef.current = null
      }
      if (bookingRouteMeshRef.current) {
        bookingRouteMeshRef.current.geometry.dispose()
        if (sceneRef.current) {
          sceneRef.current.remove(bookingRouteMeshRef.current)
        }
        bookingRouteMeshRef.current = null
      }

      // Clear scene
      if (sceneRef.current) {
        sceneRef.current.clear()
      }
      sceneRef.current = null
      overlayRef.current = null
      isInitializedRef.current = false
    }
  }, [
    googleMap,
    memoizedStations.length,
    lights,
    carModelScene,
    populateInstancedMeshes,
    populateCarModels,
    continuousRender,
  ])

  // -------------------------------------------------
  // Update station selection or data
  // -------------------------------------------------
  useEffect(() => {
    if (!sceneRef.current || !overlayRef.current || !googleMap || memoizedStations.length === 0) return

    populateInstancedMeshes()
    // Request a redraw after updating station meshes
    if (overlayRef.current) {
      overlayRef.current.requestRedraw()
    }
  }, [stationSelection, memoizedStations.length, googleMap, populateInstancedMeshes])

  // -------------------------------------------------
  // Update cars as they change
  // -------------------------------------------------
  useEffect(() => {
    if (!sceneRef.current || !overlayRef.current) return

    populateCarModels()
    // Request a redraw after updating cars
    if (overlayRef.current) {
      overlayRef.current.requestRedraw()
    }
  }, [memoizedCars, populateCarModels])

  // -------------------------------------------------
  // Whenever routes change, draw TUBE geometry
  // -------------------------------------------------
  useEffect(() => {
    if (!sceneRef.current || !overlayRef.current) return

    // Dispatch route
    if (dispatchRouteDecoded && dispatchRouteDecoded.length >= 2 && dispatchTubeMatRef.current) {
      // As per your code: skip creating dispatch route #1, or remove it if present
      if (dispatchRouteMeshRef.current) {
        sceneRef.current.remove(dispatchRouteMeshRef.current)
        dispatchRouteMeshRef.current.geometry.dispose()
        dispatchRouteMeshRef.current = null
      }
    } else if (dispatchRouteMeshRef.current) {
      // Clear existing if no route
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
      // Clear existing if no route
      sceneRef.current.remove(bookingRouteMeshRef.current)
      bookingRouteMeshRef.current.geometry.dispose()
      bookingRouteMeshRef.current = null
    }

    // Request a redraw after route changes
    if (overlayRef.current) {
      overlayRef.current.requestRedraw()
    }
  }, [dispatchRouteDecoded, bookingRouteDecoded])

  // Return any refs if needed
  return {
    overlayRef,
    sceneRef,
    greyInstancedMeshRef,
    blueInstancedMeshRef,
    redInstancedMeshRef,
    stationIndexMapsRef,
  }
}

