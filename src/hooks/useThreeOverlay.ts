"use client"

import type React from "react"
import { useEffect, useRef, useMemo, useCallback } from "react"
import * as THREE from "three"
// ----------------------------------------------------------------------------
// Using google.maps.WebGLOverlayView (via ThreeJSOverlayView)
// ----------------------------------------------------------------------------
import { ThreeJSOverlayView } from "@googlemaps/three"
import { useGLTF } from "@react-three/drei"

// If you want to specifically load Draco-compressed GLBs imperatively:
// import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
// import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'
// etc.

// Redux + slices
import { useAppSelector } from "@/store/store"
import type { StationFeature } from "@/store/stationsSlice"
import { selectRouteDecoded } from "@/store/bookingSlice"

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
}

const MaterialPool = {
  matGrey: null as THREE.MeshPhongMaterial | null,
  matBlue: null as THREE.MeshPhongMaterial | null,
  matRed: null as THREE.MeshPhongMaterial | null,
  ringMatGrey: null as THREE.MeshPhongMaterial | null,
  ringMatBlue: null as THREE.MeshPhongMaterial | null,
  ringMatRed: null as THREE.MeshPhongMaterial | null,
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
  GeometryPool.tube.forEach((geom) => geom.dispose())
  GeometryPool.tube.clear()
}

function disposeMaterial(material: THREE.Material) {
  if ("map" in material && material.map) {
    (material.map as THREE.Texture).dispose()
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
// Create or update a 3D tube from a decoded route, using pooling
// ---------------------------------------------------------------------
function createOrUpdateTube(
  decodedPath: Array<{ lat: number; lng: number }>,
  meshRef: React.MutableRefObject<THREE.Mesh | null>,
  material: THREE.MeshPhongMaterial,
  scene: THREE.Scene,
  overlay: ThreeJSOverlayView,
  altitude: number
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
  const tubularSegments = Math.min(Math.max(points.length, 20), 80)
  const radius = 8
  const radialSegments = 4
  const closed = false

  // Cache key
  const routeKey = `tube_${points[0].x}_${points[0].y}_${points[points.length - 1].x}_${points[points.length - 1].y}_${points.length}`

  let geometry: THREE.TubeGeometry
  if (GeometryPool.tube.has(routeKey)) {
    geometry = GeometryPool.tube.get(routeKey)!
  } else {
    geometry = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, closed)
    GeometryPool.tube.set(routeKey, geometry)
  }

  if (!meshRef.current) {
    // Create a new mesh and add to scene
    const mesh = new THREE.Mesh(geometry, material)
    mesh.renderOrder = 999
    meshRef.current = mesh
    scene.add(mesh)
  } else {
    // Reuse the existing mesh
    meshRef.current.visible = true
    meshRef.current.geometry = geometry
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
  cars: Array<{ id: number; lat: number; lng: number }>
) {
  // Scene & Overlay references
  const overlayRef = useRef<ThreeJSOverlayView | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const isInitializedRef = useRef<boolean>(false)

  // For continuous rendering
  const continuousRenderFrameIdRef = useRef<number | null>(null)

  // InstancedMesh refs for stations
  const greyInstancedMeshRef = useRef<THREE.InstancedMesh | null>(null)
  const blueInstancedMeshRef = useRef<THREE.InstancedMesh | null>(null)
  const redInstancedMeshRef = useRef<THREE.InstancedMesh | null>(null)
  const greyRingInstancedMeshRef = useRef<THREE.InstancedMesh | null>(null)
  const blueRingInstancedMeshRef = useRef<THREE.InstancedMesh | null>(null)
  const redRingInstancedMeshRef = useRef<THREE.InstancedMesh | null>(null)

  // For tracking which station is in which instanced slot
  const stationIndexMapsRef = useRef<{ grey: number[]; blue: number[]; red: number[] }>({
    grey: [],
    blue: [],
    red: [],
  })

  // Shared geometry/material references (from pool)
  const stationGeoRef = useRef<THREE.ExtrudeGeometry | null>(null)
  const stationRingGeoRef = useRef<THREE.ExtrudeGeometry | null>(null)

  // Material refs
  const matGreyRef = useRef<THREE.MeshPhongMaterial | null>(null)
  const matBlueRef = useRef<THREE.MeshPhongMaterial | null>(null)
  const matRedRef = useRef<THREE.MeshPhongMaterial | null>(null)
  const ringMatGreyRef = useRef<THREE.MeshPhongMaterial | null>(null)
  const ringMatBlueRef = useRef<THREE.MeshPhongMaterial | null>(null)
  const ringMatRedRef = useRef<THREE.MeshPhongMaterial | null>(null)
  const bookingTubeMatRef = useRef<THREE.MeshPhongMaterial | null>(null)

  // Booking route tube mesh
  const bookingRouteMeshRef = useRef<THREE.Mesh | null>(null)

  // Car-related
  const carGeoRef = useRef<THREE.Group | null>(null)
  const carsMatRef = useRef<THREE.MeshPhongMaterial | null>(null)
  const carModelsRef = useRef<Map<number, THREE.Object3D>>(new Map())

  // **Optional**: a reference to your pinned GLTF model
  const pinnedModelRef = useRef<THREE.Object3D | null>(null)

  // Redux selector for the booking route
  const bookingRouteDecoded = useAppSelector(selectRouteDecoded)

  // For convenience, re-memo cars/stations/selection
  const memoizedCars = useMemo(() => cars.map((c) => ({ ...c })), [cars])
  const memoizedStations = useMemo(() => stations, [stations])
  const stationSelection = useMemo(() => ({ departureStationId, arrivalStationId }), [
    departureStationId,
    arrivalStationId,
  ])

  // -- If you want to do a minimal React-based Draco load, we keep the below. --
  // But from the snippet, you're likely using an imperative GLTFLoader in onAdd
  // So you can remove or keep useGLTF depending on your approach:
  const { scene: carModelScene } = useGLTF("/cars/defaultModel.glb")

  // Basic lights
  const lights = useMemo(() => {
    const ambient = new THREE.AmbientLight(0xffffff, 0.75)
    const directional = new THREE.DirectionalLight(0xffffff, 0.25)
    directional.position.set(0, 10, 50)
    return { ambient, directional }
  }, [])

  // ---------------------------------------------------------------------
  // Continuous render loop: forces Google Maps to call onDraw every frame
  // ---------------------------------------------------------------------
  const continuousRender = useCallback(() => {
    overlayRef.current?.requestRedraw()
    continuousRenderFrameIdRef.current = requestAnimationFrame(continuousRender)
  }, [])

  // ---------------------------------------------------------------------
  // Populate Instanced Meshes for Stations
  // ---------------------------------------------------------------------
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
    const greyRing = greyRingInstancedMeshRef.current
    const blueRing = blueRingInstancedMeshRef.current
    const redRing = redRingInstancedMeshRef.current

    const counts = { grey: 0, blue: 0, red: 0 }
    stationIndexMapsRef.current = { grey: [], blue: [], red: [] }

    memoizedStations.forEach((station) => {
      const [lng, lat] = station.geometry.coordinates
      overlayRef.current!.latLngAltitudeToVector3(
        { lat, lng, altitude: DISPATCH_HUB.altitude + 50 },
        tempVector
      )
      tempMatrix.makeTranslation(tempVector.x, tempVector.y, tempVector.z)

      if (station.id === stationSelection.departureStationId) {
        blueMesh.setMatrixAt(counts.blue, tempMatrix)
        blueRing.setMatrixAt(counts.blue, tempMatrix)
        stationIndexMapsRef.current.blue[counts.blue] = station.id
        counts.blue++
      } else if (station.id === stationSelection.arrivalStationId) {
        redMesh.setMatrixAt(counts.red, tempMatrix)
        redRing.setMatrixAt(counts.red, tempMatrix)
        stationIndexMapsRef.current.red[counts.red] = station.id
        counts.red++
      } else {
        greyMesh.setMatrixAt(counts.grey, tempMatrix)
        greyRing.setMatrixAt(counts.grey, tempMatrix)
        stationIndexMapsRef.current.grey[counts.grey] = station.id
        counts.grey++
      }
    })

    // Update instance counts
    greyMesh.count = counts.grey
    greyMesh.instanceMatrix.needsUpdate = true

    blueMesh.count = counts.blue
    blueMesh.instanceMatrix.needsUpdate = true

    redMesh.count = counts.red
    redMesh.instanceMatrix.needsUpdate = true

    greyRing.count = counts.grey
    greyRing.instanceMatrix.needsUpdate = true

    blueRing.count = counts.blue
    blueRing.instanceMatrix.needsUpdate = true

    redRing.count = counts.red
    redRing.instanceMatrix.needsUpdate = true
  }, [memoizedStations, stationSelection])

  // ---------------------------------------------------------------------
  // Populate or Update Car Models
  // ---------------------------------------------------------------------
  const populateCarModels = useCallback(() => {
    if (!carGeoRef.current || !overlayRef.current || !sceneRef.current) return

    const scene = sceneRef.current
    const currentCarIds = new Set(memoizedCars.map((c) => c.id))

    // Remove old cars no longer in the data
    carModelsRef.current.forEach((carModel, carId) => {
      if (!currentCarIds.has(carId)) {
        scene.remove(carModel)
        carModelsRef.current.delete(carId)
      }
    })

    // Add or update each car
    memoizedCars.forEach((car) => {
      overlayRef.current!.latLngAltitudeToVector3(
        { lat: car.lat, lng: car.lng, altitude: 50 },
        tempVector
      )
      let carModel = carModelsRef.current.get(car.id)
      if (!carModel) {
        // Clone base model
        carModel = carGeoRef.current!.clone()
        carModel.userData = { isCar: true, carId: car.id }
        carModel.visible = true
        scene.add(carModel)
        carModelsRef.current.set(car.id, carModel)
      }
      carModel.position.set(tempVector.x, tempVector.y, tempVector.z)
      carModel.rotation.x = Math.PI / 2
    })
  }, [memoizedCars])

  // ---------------------------------------------------------------------
  // Main Effect: Initialize the Overlay (runs once)
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!googleMap) return
    if (isInitializedRef.current) return

    isInitializedRef.current = true
    console.log("[useThreeOverlay] Initializing Three.js overlay...")

    // Create a Three.js scene
    const scene = new THREE.Scene()
    scene.background = null
    sceneRef.current = scene

    // Add lights
    scene.add(lights.ambient)
    scene.add(lights.directional)

    // Create the Overlay
    const overlay = new ThreeJSOverlayView({
      map: googleMap,
      scene,
      anchor: DISPATCH_HUB,
      // @ts-ignore
      THREE,
    })
    overlay.setMap(googleMap)
    overlayRef.current = overlay

    // ------------------------------------------
    // (A) Imperative glTF loading from snippet
    // ------------------------------------------
    // If you want to load a single pinned glTF model (Draco or otherwise),
    // you can do so imperatively using GLTFLoader.
    // The code below is an example. Adjust file path, scale, rotation, etc.
    /*
    const gltfLoader = new GLTFLoader()
    // If Draco-compressed, you also configure the DRACOLoader:
    // const dracoLoader = new DRACOLoader()
    // dracoLoader.setDecoderPath('/path/to/draco/')
    // gltfLoader.setDRACOLoader(dracoLoader)

    gltfLoader.load('/pin.gltf', (gltf) => {
      // e.g. gltf.scene.scale.set(25, 25, 25)
      // gltf.scene.rotation.x = Math.PI
      pinnedModelRef.current = gltf.scene
      scene.add(gltf.scene)
    })
    */

    // ---------------------------------------------------------------------
    // Prepare geometry & materials from pool (Stations, etc.)
    // ---------------------------------------------------------------------
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
        const ringGeom = new THREE.ExtrudeGeometry(outerShape, {
          depth: 3,
          bevelEnabled: false,
        })
        GeometryPool.hexagonRing = ringGeom
        stationRingGeoRef.current = ringGeom
      }
    }

    // Station materials
    if (!matGreyRef.current) {
      if (MaterialPool.matGrey) {
        matGreyRef.current = MaterialPool.matGrey
      } else {
        const mat = new THREE.MeshPhongMaterial({ color: 0xeeeeee })
        MaterialPool.matGrey = mat
        matGreyRef.current = mat
      }
    }
    if (!matBlueRef.current) {
      if (MaterialPool.matBlue) {
        matBlueRef.current = MaterialPool.matBlue
      } else {
        const mat = new THREE.MeshPhongMaterial({
          color: 0x0000ff,
          opacity: 0.95,
          transparent: true,
        })
        MaterialPool.matBlue = mat
        matBlueRef.current = mat
      }
    }
    if (!matRedRef.current) {
      if (MaterialPool.matRed) {
        matRedRef.current = MaterialPool.matRed
      } else {
        const mat = new THREE.MeshPhongMaterial({
          color: 0xff0000,
          opacity: 0.95,
          transparent: true,
        })
        MaterialPool.matRed = mat
        matRedRef.current = mat
      }
    }
    if (!ringMatGreyRef.current) {
      if (MaterialPool.ringMatGrey) {
        ringMatGreyRef.current = MaterialPool.ringMatGrey
      } else {
        const mat = new THREE.MeshPhongMaterial({
          color: 0xcccccc,
          emissive: 0x333333,
          shininess: 80,
        })
        MaterialPool.ringMatGrey = mat
        ringMatGreyRef.current = mat
      }
    }
    if (!ringMatBlueRef.current) {
      if (MaterialPool.ringMatBlue) {
        ringMatBlueRef.current = MaterialPool.ringMatBlue
      } else {
        const mat = new THREE.MeshPhongMaterial({
          color: 0x0000ff,
          emissive: 0x000033,
          shininess: 80,
          opacity: 0.95,
          transparent: true,
        })
        MaterialPool.ringMatBlue = mat
        ringMatBlueRef.current = mat
      }
    }
    if (!ringMatRedRef.current) {
      if (MaterialPool.ringMatRed) {
        ringMatRedRef.current = MaterialPool.ringMatRed
      } else {
        const mat = new THREE.MeshPhongMaterial({
          color: 0xff0000,
          emissive: 0x330000,
          shininess: 80,
          opacity: 0.95,
          transparent: true,
        })
        MaterialPool.ringMatRed = mat
        ringMatRedRef.current = mat
      }
    }
    if (!bookingTubeMatRef.current) {
      if (MaterialPool.bookingTubeMat) {
        bookingTubeMatRef.current = MaterialPool.bookingTubeMat
      } else {
        const mat = new THREE.MeshPhongMaterial({
          color: 0x03a9f4,
          opacity: 0.8,
          transparent: true,
        })
        MaterialPool.bookingTubeMat = mat
        bookingTubeMatRef.current = mat
      }
    }

    // ---------------------------------------------------------------------
    // Create InstancedMeshes for stations
    // ---------------------------------------------------------------------
    const maxInstances = memoizedStations.length
    const colorKeys = ["grey", "blue", "red"] as const

    const colorToMainMat = {
      grey: matGreyRef.current!,
      blue: matBlueRef.current!,
      red: matRedRef.current!,
    }
    const colorToRingMat = {
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

    colorKeys.forEach((color) => {
      const mainMesh = new THREE.InstancedMesh(stationGeoRef.current!, colorToMainMat[color], maxInstances)
      mainMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mainMesh.frustumCulled = false
      scene.add(mainMesh)
      meshRefs[color].current = mainMesh

      const ringMesh = new THREE.InstancedMesh(stationRingGeoRef.current!, colorToRingMat[color], maxInstances)
      ringMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      ringMesh.frustumCulled = false
      ringMesh.renderOrder = 998
      scene.add(ringMesh)
      ringMeshRefs[color].current = ringMesh
    })

    // ---------------------------------------------------------------------
    // Create or Clone Car Model
    // ---------------------------------------------------------------------
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

    // Place stations and cars initially
    populateInstancedMeshes()
    populateCarModels()

    // *** Start continuous rendering ***
    continuousRender()

    // Cleanup
    return () => {
      console.log("[useThreeOverlay] Cleaning up Three.js overlay...")

      // Stop continuous rendering
      if (continuousRenderFrameIdRef.current !== null) {
        cancelAnimationFrame(continuousRenderFrameIdRef.current)
        continuousRenderFrameIdRef.current = null
      }

      // Safely remove overlay from map (TypeScript fix)
      ;(overlay.setMap as unknown as (map: google.maps.Map | null) => void)(null)
      overlayRef.current = null

      // Remove all cars
      carModelsRef.current.forEach((model) => {
        scene.remove(model)
        model.traverse((obj: THREE.Object3D) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh
            mesh.geometry.dispose()
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((m) => m.dispose())
            } else {
              mesh.material.dispose()
            }
          }
        })
      })
      carModelsRef.current.clear()

      // Remove pinned model if you loaded one
      if (pinnedModelRef.current) {
        scene.remove(pinnedModelRef.current)
        pinnedModelRef.current.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh
            mesh.geometry.dispose()
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((m) => m.dispose())
            } else {
              mesh.material.dispose()
            }
          }
        })
        pinnedModelRef.current = null
      }

      // Dispose station geometry if not keeping in the pool
      stationGeoRef.current = null
      stationRingGeoRef.current = null

      // Dispose materials if not pooling
      matGreyRef.current = null
      matBlueRef.current = null
      matRedRef.current = null
      ringMatGreyRef.current = null
      ringMatBlueRef.current = null
      ringMatRedRef.current = null
      bookingTubeMatRef.current = null

      // Dispose car geometry
      if (carGeoRef.current) {
        carGeoRef.current.traverse((obj) => {
          const mesh = obj as THREE.Mesh
          if (mesh && mesh.geometry) mesh.geometry.dispose()
          if (mesh && mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((mat) => mat.dispose())
            } else {
              mesh.material.dispose()
            }
          }
        })
        carGeoRef.current = null
      }
      carsMatRef.current?.dispose()
      carsMatRef.current = null

      // Clear scene
      scene.clear()
      sceneRef.current = null
      isInitializedRef.current = false

      // Finally, dispose any pooled resources if desired
      disposeGeometryPool()
      disposeMaterialPool()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleMap])

  // ---------------------------------------------------------------------
  // Re-populate station instanced meshes when data or selection changes
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!overlayRef.current) return
    populateInstancedMeshes()
    overlayRef.current.requestRedraw()
  }, [populateInstancedMeshes, memoizedStations.length, stationSelection])

  // ---------------------------------------------------------------------
  // Re-populate car models when car data changes
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!sceneRef.current || !overlayRef.current) return
    populateCarModels()
    overlayRef.current.requestRedraw()
  }, [memoizedCars, populateCarModels])

  // ---------------------------------------------------------------------
  // Handle booking route changes
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!sceneRef.current || !overlayRef.current) return
    if (bookingRouteDecoded && bookingRouteDecoded.length >= 2 && bookingTubeMatRef.current) {
      createOrUpdateTube(
        bookingRouteDecoded,
        bookingRouteMeshRef,
        bookingTubeMatRef.current,
        sceneRef.current,
        overlayRef.current,
        50 // altitude for route
      )
    } else if (bookingRouteMeshRef.current) {
      bookingRouteMeshRef.current.visible = false
    }
    overlayRef.current.requestRedraw()
  }, [bookingRouteDecoded])

  return {
    // Expose whatever references or methods you need
    overlayRef,
    sceneRef,
    greyInstancedMeshRef,
    blueInstancedMeshRef,
    redInstancedMeshRef,
    stationIndexMapsRef,
    pinnedModelRef, // If you want direct access to the pinned glTF model
  }
}
