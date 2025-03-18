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

// ---------------------------------------------------------------------
// Geometry & Material Pools (persist between reinitializations)
// ---------------------------------------------------------------------
const GeometryPool = {
  hexagon: null as THREE.ExtrudeGeometry | null,
  hexagonRing: null as THREE.ExtrudeGeometry | null,
  tube: new Map<string, THREE.TubeGeometry>(),
  box: null as THREE.BoxGeometry | null,
}

const MaterialPool = {
  matGrey: null as THREE.MeshPhongMaterial | null,
  matBlue: null as THREE.MeshPhongMaterial | null,
  matRed: null as THREE.MeshPhongMaterial | null,
  dispatchMat: null as THREE.MeshPhongMaterial | null,
  ringMatGrey: null as THREE.MeshPhongMaterial | null,
  ringMatBlue: null as THREE.MeshPhongMaterial | null,
  ringMatRed: null as THREE.MeshPhongMaterial | null,
  dispatchTubeMat: null as THREE.MeshPhongMaterial | null,
  bookingTubeMat: null as THREE.MeshPhongMaterial | null,
}

function disposeGeometryPool() {
  if (GeometryPool.hexagon) {
    GeometryPool.hexagon.dispose()
    GeometryPool.hexagon = null
  }
  if (GeometryPool.hexagonRing) {
    GeometryPool.hexagonRing.dispose()
    GeometryPool.hexagonRing = null
  }
  if (GeometryPool.box) {
    GeometryPool.box.dispose()
    GeometryPool.box = null
  }
  GeometryPool.tube.forEach((geom) => geom.dispose())
  GeometryPool.tube.clear()
}

function disposeMaterial(material: THREE.Material) {
  if ("map" in material && material.map) {
    ;(material.map as THREE.Texture).dispose()
  }
  material.dispose()
}

function disposeMaterialPool() {
  if (MaterialPool.matGrey) {
    disposeMaterial(MaterialPool.matGrey)
    MaterialPool.matGrey = null
  }
  if (MaterialPool.matBlue) {
    disposeMaterial(MaterialPool.matBlue)
    MaterialPool.matBlue = null
  }
  if (MaterialPool.matRed) {
    disposeMaterial(MaterialPool.matRed)
    MaterialPool.matRed = null
  }
  if (MaterialPool.dispatchMat) {
    disposeMaterial(MaterialPool.dispatchMat)
    MaterialPool.dispatchMat = null
  }
  if (MaterialPool.ringMatGrey) {
    disposeMaterial(MaterialPool.ringMatGrey)
    MaterialPool.ringMatGrey = null
  }
  if (MaterialPool.ringMatBlue) {
    disposeMaterial(MaterialPool.ringMatBlue)
    MaterialPool.ringMatBlue = null
  }
  if (MaterialPool.ringMatRed) {
    disposeMaterial(MaterialPool.ringMatRed)
    MaterialPool.ringMatRed = null
  }
  if (MaterialPool.dispatchTubeMat) {
    disposeMaterial(MaterialPool.dispatchTubeMat)
    MaterialPool.dispatchTubeMat = null
  }
  if (MaterialPool.bookingTubeMat) {
    disposeMaterial(MaterialPool.bookingTubeMat)
    MaterialPool.bookingTubeMat = null
  }
}

// ---------------------------------------------------------------------
// Custom curve for tube geometry
// ---------------------------------------------------------------------
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
      return optionalTarget.copy(this.points[this.points.length - 1])
    }
    const p0 = this.points[index]
    const p1 = this.points[index + 1]
    return optionalTarget.copy(p0).lerp(p1, alpha)
  }
}

// ---------------------------------------------------------------------
// Create or update a 3D tube from a decoded route, using pooling for geometry
// ---------------------------------------------------------------------
function createOrUpdateTube(
  decodedPath: Array<{ lat: number; lng: number }>,
  meshRef: React.MutableRefObject<THREE.Mesh | null>,
  material: THREE.MeshPhongMaterial,
  scene: THREE.Scene,
  overlay: ThreeJSOverlayView,
  altitude: number,
) {
  // If there's no valid path, just hide the mesh
  if (!decodedPath || decodedPath.length < 2) {
    if (meshRef.current) {
      meshRef.current.visible = false
    }
    return
  }

  // Convert route points to Vector3
  const points = decodedPath.map(({ lat, lng }) => {
    const vector = new THREE.Vector3()
    overlay.latLngAltitudeToVector3({ lat, lng, altitude }, vector)
    return vector
  })

  // Build or retrieve geometry
  const curve = new CustomCurve(points)
  const tubularSegments = Math.min(Math.max(points.length, 20), 80) // example detail
  const radius = 8
  const radialSegments = 4
  const closed = false

  // Generate a stable key; for example, based on endpoint coords + point count
  const routeKey = `tube_${points[0].x}_${points[0].y}_${points[points.length - 1].x}_${points[points.length - 1].y}_${points.length}`

  let geometry: THREE.TubeGeometry

  if (GeometryPool.tube.has(routeKey)) {
    // Geometry exists, but we want to ensure the curve is updated
    // In many cases, if the route is truly the same, no changes are needed
    // If you truly need to re-generate geometry, you can do:
    geometry = GeometryPool.tube.get(routeKey)!
  } else {
    // Create new geometry and store it
    geometry = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, closed)
    GeometryPool.tube.set(routeKey, geometry)
  }

  if (!meshRef.current) {
    // No mesh yet => create a new one and add to scene
    const mesh = new THREE.Mesh(geometry, material)
    mesh.renderOrder = 999
    meshRef.current = mesh
    scene.add(mesh)
  } else {
    // Reuse the existing mesh; show it and update geometry
    meshRef.current.visible = true
    meshRef.current.geometry = geometry

    // Ensure the material reference is the same (in case it changed)
    if (meshRef.current.material !== material) {
      meshRef.current.material = material
    }
  }
}

// ---------------------------------------------------------------------
// Hook: useThreeOverlay
// ---------------------------------------------------------------------
export function useThreeOverlay(
  googleMap: google.maps.Map | null,
  stations: StationFeature[],
  departureStationId: number | null,
  arrivalStationId: number | null,
  cars: Array<{ id: number; lat: number; lng: number }>,
) {
  // Refs for overlay, scene, and a flag to track initialization
  const overlayRef = useRef<ThreeJSOverlayView | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const isInitializedRef = useRef<boolean>(false)

  // InstancedMesh refs for station cubes and rings
  const greyInstancedMeshRef = useRef<THREE.InstancedMesh | null>(null)
  const blueInstancedMeshRef = useRef<THREE.InstancedMesh | null>(null)
  const redInstancedMeshRef = useRef<THREE.InstancedMesh | null>(null)
  const greyRingInstancedMeshRef = useRef<THREE.InstancedMesh | null>(null)
  const blueRingInstancedMeshRef = useRef<THREE.InstancedMesh | null>(null)
  const redRingInstancedMeshRef = useRef<THREE.InstancedMesh | null>(null)
  const stationIndexMapsRef = useRef<{ grey: number[]; blue: number[]; red: number[] }>({ grey: [], blue: [], red: [] })

  // Animation state for color transitions
  const animationStateRef = useRef<
    Map<
      number,
      {
        startTime: number
        duration: number
        fromColor: THREE.Color
        toColor: THREE.Color
        isAnimating: boolean
      }
    >
  >(new Map())
  const lastFrameTimeRef = useRef<number>(0)
  const animationFrameIdRef = useRef<number | null>(null)
  const continuousRenderFrameIdRef = useRef<number | null>(null)

  // Shared geometry/material refs (for pooling)
  const stationGeoRef = useRef<THREE.ExtrudeGeometry | null>(null)
  const stationRingGeoRef = useRef<THREE.ExtrudeGeometry | null>(null)
  const dispatchBoxGeoRef = useRef<THREE.BoxGeometry | null>(null)

  // Tube mesh refs
  const dispatchRouteMeshRef = useRef<THREE.Mesh | null>(null)
  const bookingRouteMeshRef = useRef<THREE.Mesh | null>(null)

  // Material refs (using pooling)
  const matGreyRef = useRef<THREE.MeshPhongMaterial | null>(null)
  const matBlueRef = useRef<THREE.MeshPhongMaterial | null>(null)
  const matRedRef = useRef<THREE.MeshPhongMaterial | null>(null)
  const dispatchMatRef = useRef<THREE.MeshPhongMaterial | null>(null)
  const ringMatGreyRef = useRef<THREE.MeshPhongMaterial | null>(null)
  const ringMatBlueRef = useRef<THREE.MeshPhongMaterial | null>(null)
  const ringMatRedRef = useRef<THREE.MeshPhongMaterial | null>(null)
  const dispatchTubeMatRef = useRef<THREE.MeshPhongMaterial | null>(null)
  const bookingTubeMatRef = useRef<THREE.MeshPhongMaterial | null>(null)

  // Car-related refs
  const carGeoRef = useRef<THREE.Group | null>(null)
  const carsMatRef = useRef<THREE.MeshPhongMaterial | null>(null)
  const carModelsRef = useRef<Map<number, THREE.Object3D>>(new Map())

  // Map event listeners and MutationObserver
  const mapEventListenersRef = useRef<google.maps.MapsEventListener[]>([])
  const observerRef = useRef<MutationObserver | null>(null)

  // Redux selectors for routes
  const dispatchRouteDecoded = useAppSelector(selectDispatchRouteDecoded)
  const bookingRouteDecoded = useAppSelector(selectRouteDecoded)

  // Memoize input arrays so we don't recalc them every render
  const memoizedCars = useMemo(() => cars.map((car) => ({ ...car })), [cars])
  const memoizedStations = useMemo(() => stations, [stations])
  const stationSelection = useMemo(() => ({ departureStationId, arrivalStationId }), [departureStationId, arrivalStationId])

  // Setup lights (assumed static)
  const lights = useMemo(() => {
    const ambient = new THREE.AmbientLight(0xffffff, 0.75)
    const directional = new THREE.DirectionalLight(0xffffff, 0.25)
    directional.position.set(0, 10, 50)
    return { ambient, directional }
  }, [])

  const ROUTE_ALTITUDE = 50

  // Continuous render loop remains active for overlay visibility
  const continuousRender = useCallback(() => {
    overlayRef.current?.requestRedraw()
    continuousRenderFrameIdRef.current = requestAnimationFrame(continuousRender)
  }, [])

  // Animation loop for color transitions
  const animateFrame = useCallback(() => {
    const currentTime = performance.now()
    lastFrameTimeRef.current = currentTime
    let hasActiveAnimations = false

    animationStateRef.current.forEach((state, stationId) => {
      if (!state.isAnimating) return
      const elapsed = currentTime - state.startTime
      const progress = Math.min(elapsed / state.duration, 1)
      if (progress < 1) {
        hasActiveAnimations = true
        // Reuse a temporary color instance
        const currentColor = new THREE.Color().lerpColors(state.fromColor, state.toColor, progress)
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
        state.isAnimating = false
      }
    })

    if (hasActiveAnimations) {
      animationFrameIdRef.current = requestAnimationFrame(animateFrame)
    } else {
      animationFrameIdRef.current = null
    }
  }, [])

  const startColorTransition = useCallback(
    (stationId: number, fromColor: THREE.Color, toColor: THREE.Color) => {
      const state = {
        startTime: performance.now(),
        duration: 800,
        fromColor,
        toColor,
        isAnimating: true,
      }
      animationStateRef.current.set(stationId, state)
      if (animationFrameIdRef.current === null) {
        lastFrameTimeRef.current = performance.now()
        animationFrameIdRef.current = requestAnimationFrame(animateFrame)
      }
    },
    [animateFrame],
  )

  // ----------------------------
  // Populate Station InstancedMeshes
  // ----------------------------
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

      if (station.id === stationSelection.departureStationId) {
        // Animate color from grey => blue
        if (matGreyRef.current && matBlueRef.current) {
          startColorTransition(station.id, matGreyRef.current.color.clone(), matBlueRef.current.color.clone())
        }
        blueMesh.setMatrixAt(counts.blue, tempMatrix)
        blueRingMesh.setMatrixAt(counts.blue, tempMatrix)
        stationIndexMapsRef.current.blue[counts.blue] = station.id
        counts.blue++
      } else if (station.id === stationSelection.arrivalStationId) {
        // Animate color from grey => red
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

  // When stations or selection changes, update the instanced meshes
  useEffect(() => {
    if (!overlayRef.current) return
    populateInstancedMeshes()
    overlayRef.current.requestRedraw()
  }, [populateInstancedMeshes, memoizedStations.length, stationSelection])

  // ----------------------------
  // Populate Car Models
  // ----------------------------
  const populateCarModels = useCallback(() => {
    if (!carGeoRef.current || !overlayRef.current || !sceneRef.current) return

    const currentCarIds = new Set(memoizedCars.map((car) => car.id))
    // Remove old cars no longer in the data
    carModelsRef.current.forEach((carModel, carId) => {
      if (!currentCarIds.has(carId)) {
        sceneRef.current?.remove(carModel)
        carModelsRef.current.delete(carId)
      }
    })

    // Add or update each car
    memoizedCars.forEach((car) => {
      if (!carGeoRef.current || !overlayRef.current || !sceneRef.current) return

      overlayRef.current.latLngAltitudeToVector3({ lat: car.lat, lng: car.lng, altitude: 50 }, tempVector)
      let carModel: THREE.Object3D | undefined = carModelsRef.current.get(car.id)
      if (!carModel) {
        carModel = carGeoRef.current.clone()
        carModel.userData = { isCar: true, carId: car.id }
        carModel.visible = true
        sceneRef.current.add(carModel)
        carModelsRef.current.set(car.id, carModel)
      }
      carModel.position.set(tempVector.x, tempVector.y, tempVector.z)
      carModel.rotation.x = Math.PI / 2
    })
  }, [memoizedCars])

  // Load car model (draco or glb)
  const { scene: carModelScene } = useGLTF("/cars/defaultModel.glb")

  // ---------------------------------------------------------------------
  // MAIN INITIALIZATION (Runs Only Once when googleMap becomes available)
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!googleMap) return
    if (isInitializedRef.current) return // Already set up

    console.log("[useThreeOverlay] Initializing Three.js overlay...")
    isInitializedRef.current = true // Mark as initialized

    // Create the scene + overlay
    const scene = new THREE.Scene()
    scene.background = null
    sceneRef.current = scene
    scene.add(lights.ambient)
    scene.add(lights.directional)

    const overlay = new ThreeJSOverlayView({
      map: googleMap,
      scene,
      anchor: DISPATCH_HUB,
      // @ts-expect-error - ThreeJSOverlayView might not have perfect TS types
      THREE,
    })
    overlayRef.current = overlay
    overlay.setMap(googleMap)

    // Use pooled geometries/materials if available, else create once
    if (!dispatchBoxGeoRef.current) {
      if (GeometryPool.box) {
        dispatchBoxGeoRef.current = GeometryPool.box
      } else {
        const boxGeom = new THREE.BoxGeometry(50, 50, 50)
        GeometryPool.box = boxGeom
        dispatchBoxGeoRef.current = boxGeom
      }
    }

    if (!stationGeoRef.current) {
      if (GeometryPool.hexagon) {
        stationGeoRef.current = GeometryPool.hexagon
      } else {
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
        const hexGeom = new THREE.ExtrudeGeometry(stationShape, extrudeSettings)
        GeometryPool.hexagon = hexGeom
        stationGeoRef.current = hexGeom
      }
    }

    if (!stationRingGeoRef.current) {
      if (GeometryPool.hexagonRing) {
        stationRingGeoRef.current = GeometryPool.hexagonRing
      } else {
        const outerShape = new THREE.Shape()
        const innerShape = new THREE.Path()
        const outerSize = 38
        const innerSize = 32
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i
          const x = outerSize * Math.cos(angle)
          const y = outerSize * Math.sin(angle)
          if (i === 0) outerShape.moveTo(x, y)
          else outerShape.lineTo(x, y)
        }
        outerShape.closePath()

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
        const ringGeom = new THREE.ExtrudeGeometry(outerShape, extrudeSettings)
        GeometryPool.hexagonRing = ringGeom
        stationRingGeoRef.current = ringGeom
      }
    }

    // Materials from pool
    if (!matGreyRef.current) {
      if (MaterialPool.matGrey) {
        matGreyRef.current = MaterialPool.matGrey
      } else {
        const material = new THREE.MeshPhongMaterial({ color: 0xeeeeee })
        MaterialPool.matGrey = material
        matGreyRef.current = material
      }
    }
    if (!matBlueRef.current) {
      if (MaterialPool.matBlue) {
        matBlueRef.current = MaterialPool.matBlue
      } else {
        const material = new THREE.MeshPhongMaterial({
          color: 0x0000ff,
          opacity: 0.95,
          transparent: true,
        })
        MaterialPool.matBlue = material
        matBlueRef.current = material
      }
    }
    if (!matRedRef.current) {
      if (MaterialPool.matRed) {
        matRedRef.current = MaterialPool.matRed
      } else {
        const material = new THREE.MeshPhongMaterial({
          color: 0xff0000,
          opacity: 0.95,
          transparent: true,
        })
        MaterialPool.matRed = material
        matRedRef.current = material
      }
    }
    if (!dispatchMatRef.current) {
      if (MaterialPool.dispatchMat) {
        dispatchMatRef.current = MaterialPool.dispatchMat
      } else {
        const material = new THREE.MeshPhongMaterial({
          color: 0x00ff00,
          opacity: 0.8,
          transparent: true,
        })
        MaterialPool.dispatchMat = material
        dispatchMatRef.current = material
      }
    }
    if (!ringMatGreyRef.current) {
      if (MaterialPool.ringMatGrey) {
        ringMatGreyRef.current = MaterialPool.ringMatGrey
      } else {
        const material = new THREE.MeshPhongMaterial({
          color: 0xcccccc,
          emissive: 0x333333,
          shininess: 80,
        })
        MaterialPool.ringMatGrey = material
        ringMatGreyRef.current = material
      }
    }
    if (!ringMatBlueRef.current) {
      if (MaterialPool.ringMatBlue) {
        ringMatBlueRef.current = MaterialPool.ringMatBlue
      } else {
        const material = new THREE.MeshPhongMaterial({
          color: 0x0000ff,
          emissive: 0x000033,
          shininess: 80,
          opacity: 0.95,
          transparent: true,
        })
        MaterialPool.ringMatBlue = material
        ringMatBlueRef.current = material
      }
    }
    if (!ringMatRedRef.current) {
      if (MaterialPool.ringMatRed) {
        ringMatRedRef.current = MaterialPool.ringMatRed
      } else {
        const material = new THREE.MeshPhongMaterial({
          color: 0xff0000,
          emissive: 0x330000,
          shininess: 80,
          opacity: 0.95,
          transparent: true,
        })
        MaterialPool.ringMatRed = material
        ringMatRedRef.current = material
      }
    }
    if (!dispatchTubeMatRef.current) {
      if (MaterialPool.dispatchTubeMat) {
        dispatchTubeMatRef.current = MaterialPool.dispatchTubeMat
      } else {
        const material = new THREE.MeshPhongMaterial({
          color: 0xf5f5f5,
          opacity: 0.5,
          transparent: true,
        })
        MaterialPool.dispatchTubeMat = material
        dispatchTubeMatRef.current = material
      }
    }
    if (!bookingTubeMatRef.current) {
      if (MaterialPool.bookingTubeMat) {
        bookingTubeMatRef.current = MaterialPool.bookingTubeMat
      } else {
        const material = new THREE.MeshPhongMaterial({
          color: 0x03a9f4,
          opacity: 0.8,
          transparent: true,
        })
        MaterialPool.bookingTubeMat = material
        bookingTubeMatRef.current = material
      }
    }

    // Create InstancedMeshes for stations
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
      mainMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      if (color === "blue" || color === "red") {
        // Keep them always visible
        mainMesh.frustumCulled = false
      }
      scene.add(mainMesh)
      meshRefs[color].current = mainMesh

      const ringMesh = new THREE.InstancedMesh(stationRingGeoRef.current!, ringMaterials[color], maxInstances)
      ringMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      if (color === "blue" || color === "red") {
        ringMesh.frustumCulled = false
      }
      ringMesh.renderOrder = 998
      scene.add(ringMesh)
      ringMeshRefs[color].current = ringMesh
    })

    // If car model is loaded and not yet cached
    if (carModelScene && !carGeoRef.current) {
      const clonedScene = carModelScene.clone()
      clonedScene.scale.set(10, 10, 10)
      clonedScene.visible = false
      carGeoRef.current = clonedScene
      carsMatRef.current = new THREE.MeshPhongMaterial({
        color: 0xff5722,
        opacity: 0.95,
        transparent: true,
      })
    }

    // Populate once at init
    populateInstancedMeshes()
    populateCarModels()
    overlay.requestRedraw()

    // Start continuous rendering
    continuousRender()

    // Debounce helper for map events
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
    const debouncedRedraw = debounce(() => {
      overlayRef.current?.requestRedraw()
    }, 150)

    // Map event listeners
    if (googleMap) {
      mapEventListenersRef.current = [
        googleMap.addListener("idle", () => overlayRef.current?.requestRedraw()),
        googleMap.addListener("tilesloaded", () => overlayRef.current?.requestRedraw()),
        googleMap.addListener("zoom_changed", debouncedRedraw),
        googleMap.addListener("center_changed", debouncedRedraw),
        googleMap.addListener("bounds_changed", debouncedRedraw),
        googleMap.addListener("dragstart", debouncedRedraw),
        googleMap.addListener("dragend", () => overlayRef.current?.requestRedraw()),
      ]
    }
    if (googleMap.getDiv && typeof window !== "undefined" && window.MutationObserver) {
      const mapDiv = googleMap.getDiv()
      const observer = new MutationObserver((mutations) => {
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

    // Cleanup only on final unmount
    return () => {
      console.log("[useThreeOverlay] Cleaning up Three.js overlay...")
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
      mapEventListenersRef.current.forEach((listener) => {
        if (google && google.maps) {
          google.maps.event.removeListener(listener)
        }
      })
      mapEventListenersRef.current = []
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current)
        animationFrameIdRef.current = null
      }
      if (continuousRenderFrameIdRef.current !== null) {
        cancelAnimationFrame(continuousRenderFrameIdRef.current)
        continuousRenderFrameIdRef.current = null
      }
      if (overlayRef.current) {
        ;(overlayRef.current.setMap as (map: google.maps.Map | null) => void)(null)
      }

      // Remove and dispose car models
      carModelsRef.current.forEach((model) => {
        if (sceneRef.current) {
          sceneRef.current.remove(model)
        }
        model.traverse((obj: THREE.Object3D) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh
            if (mesh.geometry) mesh.geometry.dispose()
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((mat) => mat.dispose())
            } else if (mesh.material) {
              mesh.material.dispose()
            }
          }
        })
      })
      carModelsRef.current.clear()

      // Dispose geometry references we created (if not from pool)
      dispatchBoxGeoRef.current?.dispose()
      dispatchBoxGeoRef.current = null
      stationGeoRef.current?.dispose()
      stationGeoRef.current = null
      stationRingGeoRef.current?.dispose()
      stationRingGeoRef.current = null

      // Dispose materials
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

      // Dispose the car model geometry/material
      if (carGeoRef.current) {
        carGeoRef.current.traverse((obj: any) => {
          if (obj.isMesh) {
            obj.geometry?.dispose()
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m: THREE.Material) => m.dispose())
            } else {
              obj.material?.dispose()
            }
          }
        })
        carGeoRef.current = null
      }
      carsMatRef.current?.dispose()
      carsMatRef.current = null

      // Clean up any route meshes. If the geometry is not from the pool, dispose it.
      if (dispatchRouteMeshRef.current) {
        if (!GeometryPool.tube.has((dispatchRouteMeshRef.current.geometry as any).uuid)) {
          dispatchRouteMeshRef.current.geometry.dispose()
        }
        sceneRef.current?.remove(dispatchRouteMeshRef.current)
        dispatchRouteMeshRef.current = null
      }
      if (bookingRouteMeshRef.current) {
        if (!GeometryPool.tube.has((bookingRouteMeshRef.current.geometry as any).uuid)) {
          bookingRouteMeshRef.current.geometry.dispose()
        }
        sceneRef.current?.remove(bookingRouteMeshRef.current)
        bookingRouteMeshRef.current = null
      }

      sceneRef.current?.clear()
      sceneRef.current = null
      overlayRef.current = null
      isInitializedRef.current = false

      // Finally, dispose any pooled resources if truly done
      disposeGeometryPool()
      disposeMaterialPool()
    }
  }, [googleMap]) // <-- Only depends on googleMap

  // Update car models when cars change
  useEffect(() => {
    if (!sceneRef.current || !overlayRef.current) return
    populateCarModels()
    overlayRef.current.requestRedraw()
  }, [memoizedCars, populateCarModels])

  // ---------------------------------------------------------------------
  // Handle route updates using the new createOrUpdateTube
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!sceneRef.current || !overlayRef.current) return

    // Dispatch route
    if (dispatchRouteDecoded && dispatchRouteDecoded.length >= 2 && dispatchTubeMatRef.current) {
      createOrUpdateTube(
        dispatchRouteDecoded,
        dispatchRouteMeshRef,
        dispatchTubeMatRef.current,
        sceneRef.current,
        overlayRef.current,
        ROUTE_ALTITUDE
      )
    } else if (dispatchRouteMeshRef.current) {
      // Hide the mesh if no valid path
      dispatchRouteMeshRef.current.visible = false
    }

    // Booking route
    if (bookingRouteDecoded && bookingRouteDecoded.length >= 2 && bookingTubeMatRef.current) {
      createOrUpdateTube(
        bookingRouteDecoded,
        bookingRouteMeshRef,
        bookingTubeMatRef.current,
        sceneRef.current,
        overlayRef.current,
        ROUTE_ALTITUDE
      )
    } else if (bookingRouteMeshRef.current) {
      // Hide the mesh if no valid path
      bookingRouteMeshRef.current.visible = false
    }

    overlayRef.current.requestRedraw()
  }, [dispatchRouteDecoded, bookingRouteDecoded])

  return {
    overlayRef,
    sceneRef,
    greyInstancedMeshRef,
    blueInstancedMeshRef,
    redInstancedMeshRef,
    stationIndexMapsRef,
  }
}
