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
  box: null as THREE.BoxGeometry | null, // leftover if needed
}

const MaterialPool = {
  stationMaterial: null as THREE.MeshPhongMaterial | null,
  ringMaterial: null as THREE.MeshPhongMaterial | null,
  bookingTubeMat: null as THREE.MeshPhongMaterial | null,
}

// Pre-defined colors for stations
const COLORS = {
  GREY: new THREE.Color(0xeeeeee),
  BLUE: new THREE.Color(0x0000ff),
  RED: new THREE.Color(0xff0000),
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
  if (MaterialPool.stationMaterial) {
    disposeMaterial(MaterialPool.stationMaterial)
    MaterialPool.stationMaterial = null
  }
  if (MaterialPool.ringMaterial) {
    disposeMaterial(MaterialPool.ringMaterial)
    MaterialPool.ringMaterial = null
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
  altitude: number,
) {
  // If there's no valid path, just hide the mesh
  if (!decodedPath || decodedPath.length < 2) {
    if (meshRef.current) {
      meshRef.current.visible = false
    }
    return
  }

  try {
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

    // Generate a stable key
    const routeKey = `tube_${points[0].x}_${points[0].y}_${points[points.length - 1].x}_${points[points.length - 1].y}_${points.length}`
    let geometry: THREE.TubeGeometry

    if (GeometryPool.tube.has(routeKey)) {
      geometry = GeometryPool.tube.get(routeKey)!
    } else {
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
      if (meshRef.current.material !== material) {
        meshRef.current.material = material
      }
    }
  } catch (error) {
    console.error("Error creating/updating tube:", error)
  }
}

// ---------------------------------------------------------------------
// useThreeOverlay hook
// ---------------------------------------------------------------------
export function useThreeOverlay(
  googleMap: google.maps.Map | null,
  stations: StationFeature[],
  departureStationId: number | null,
  arrivalStationId: number | null,
  cars: Array<{ id: number; lat: number; lng: number }>,
) {
  // Refs for overlay, scene, initialization
  const overlayRef = useRef<ThreeJSOverlayView | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const isInitializedRef = useRef<boolean>(false)
  const isRenderingActiveRef = useRef<boolean>(false)

  // Single InstancedMesh for all stations and rings
  const stationInstancedMeshRef = useRef<THREE.InstancedMesh | null>(null)
  const ringInstancedMeshRef = useRef<THREE.InstancedMesh | null>(null)

  // Map stationId -> instanceIndex, for updates and raycasting
  const stationIdToInstanceIndexMap = useRef<Map<number, number>>(new Map())
  const instanceIndexToStationIdMap = useRef<Map<number, number>>(new Map())

  // Color attributes for station and ring
  const stationColorAttributeRef = useRef<THREE.InstancedBufferAttribute | null>(null)
  const ringColorAttributeRef = useRef<THREE.InstancedBufferAttribute | null>(null)
  const ringEmissiveAttributeRef = useRef<THREE.InstancedBufferAttribute | null>(null)

  // Animation state
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
  const redrawCountRef = useRef<number>(0)

  // Shared geometry
  const stationGeoRef = useRef<THREE.ExtrudeGeometry | null>(null)
  const stationRingGeoRef = useRef<THREE.ExtrudeGeometry | null>(null)

  // Tube mesh for booking route
  const bookingRouteMeshRef = useRef<THREE.Mesh | null>(null)

  // Material refs
  const stationMaterialRef = useRef<THREE.MeshPhongMaterial | null>(null)
  const ringMaterialRef = useRef<THREE.MeshPhongMaterial | null>(null)
  const bookingTubeMatRef = useRef<THREE.MeshPhongMaterial | null>(null)

  // Car-related refs
  const carGeoRef = useRef<THREE.Group | null>(null)
  const carsMatRef = useRef<THREE.MeshPhongMaterial | null>(null)
  const carModelsRef = useRef<Map<number, THREE.Object3D>>(new Map())

  // Map event listeners
  const mapEventListenersRef = useRef<google.maps.MapsEventListener[]>([])
  const observerRef = useRef<MutationObserver | null>(null)

  // Redux selector
  const bookingRouteDecoded = useAppSelector(selectRouteDecoded)

  // Memoized inputs
  const memoizedCars = useMemo(() => cars.map((car) => ({ ...car })), [cars])
  const memoizedStations = useMemo(() => stations, [stations])
  const stationSelection = useMemo(
    () => ({ departureStationId, arrivalStationId }),
    [departureStationId, arrivalStationId],
  )

  // Lights
  const lights = useMemo(() => {
    const ambient = new THREE.AmbientLight(0xffffff, 0.75)
    const directional = new THREE.DirectionalLight(0xffffff, 0.25)
    directional.position.set(0, 10, 50)
    return { ambient, directional }
  }, [])

  const ROUTE_ALTITUDE = 50

  // Simple check if overlay is ready
  const ensureOverlayIsReady = useCallback(() => {
    if (!overlayRef.current) {
      return false
    }
    return true
  }, [])

  // Continuous render loop - simplified
  const continuousRender = useCallback(() => {
    // Cancel any existing animation frame to prevent multiple loops
    if (continuousRenderFrameIdRef.current !== null) {
      cancelAnimationFrame(continuousRenderFrameIdRef.current)
      continuousRenderFrameIdRef.current = null
    }

    // Only continue if rendering is active
    if (!isRenderingActiveRef.current) {
      return
    }

    if (overlayRef.current) {
      try {
        overlayRef.current.requestRedraw()
        redrawCountRef.current++

        // Log every 100 redraws for debugging
        if (redrawCountRef.current % 100 === 0) {
          console.log(`ThreeOverlay: ${redrawCountRef.current} redraws completed`)
        }
      } catch (err) {
        console.error("Error in ThreeJSOverlay requestRedraw:", err)
      }
    }

    // Schedule next frame
    continuousRenderFrameIdRef.current = requestAnimationFrame(continuousRender)
  }, [])

  // Start and stop rendering
  const startContinuousRendering = useCallback(() => {
    if (!isRenderingActiveRef.current) {
      console.log("Starting continuous rendering")
      isRenderingActiveRef.current = true
      redrawCountRef.current = 0
      continuousRender()
    }
  }, [continuousRender])

  const stopContinuousRendering = useCallback(() => {
    isRenderingActiveRef.current = false
    if (continuousRenderFrameIdRef.current !== null) {
      cancelAnimationFrame(continuousRenderFrameIdRef.current)
      continuousRenderFrameIdRef.current = null
    }
    console.log("Continuous rendering stopped")
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
        // Interpolate color
        const currentColor = new THREE.Color().lerpColors(state.fromColor, state.toColor, progress)

        // Update color attributes
        const index = stationIdToInstanceIndexMap.current.get(stationId)
        if (index !== undefined) {
          if (stationColorAttributeRef.current) {
            stationColorAttributeRef.current.setXYZ(index, currentColor.r, currentColor.g, currentColor.b)
            stationColorAttributeRef.current.needsUpdate = true
          }
          if (ringColorAttributeRef.current) {
            ringColorAttributeRef.current.setXYZ(index, currentColor.r, currentColor.g, currentColor.b)
            ringColorAttributeRef.current.needsUpdate = true
          }
          if (ringEmissiveAttributeRef.current) {
            // Set emissive to a darker version of the color
            // const emissiveColor = currentColor.clone().multiplyScalar(0.2)
            // ringEmissiveAttributeRef.current.setXYZ(index, emissiveColor.r, emissiveColor.g, emissiveColor.b)
            // ringEmissiveAttributeRef.current.needsUpdate = true
          }
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

    // Request a redraw if we're animating colors
    if (hasActiveAnimations && overlayRef.current) {
      try {
        overlayRef.current.requestRedraw()
      } catch (err) {
        console.error("Error requesting redraw during animation:", err)
      }
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

  // Populate station meshes using the single InstancedMesh approach
  const populateInstancedMeshes = useCallback(() => {
    if (
      !stationInstancedMeshRef.current ||
      !ringInstancedMeshRef.current ||
      !overlayRef.current ||
      !stationColorAttributeRef.current ||
      !ringColorAttributeRef.current
    ) {
      return
    }

    const stationMesh = stationInstancedMeshRef.current
    const ringMesh = ringInstancedMeshRef.current
    const stationCount = memoizedStations.length

    // Clear existing mappings
    stationIdToInstanceIndexMap.current.clear()
    instanceIndexToStationIdMap.current.clear()

    // Set instance counts
    stationMesh.count = stationCount
    ringMesh.count = stationCount

    // Get attribute references
    const stationColorAttr = stationColorAttributeRef.current
    const ringColorAttr = ringColorAttributeRef.current

    const { departureStationId, arrivalStationId } = stationSelection

    for (let i = 0; i < stationCount; i++) {
      const station = memoizedStations[i]
      const [lng, lat] = station.geometry.coordinates

      // Convert lat/lng to 3D position
      overlayRef.current.latLngAltitudeToVector3({ lat, lng, altitude: DISPATCH_HUB.altitude + 50 }, tempVector)
      tempMatrix.makeTranslation(tempVector.x, tempVector.y, tempVector.z)

      // Set matrix for both meshes
      stationMesh.setMatrixAt(i, tempMatrix)
      ringMesh.setMatrixAt(i, tempMatrix)

      // Store mappings for raycasting and updates
      stationIdToInstanceIndexMap.current.set(station.id, i)
      instanceIndexToStationIdMap.current.set(i, station.id)

      // Default color is grey
      let colorToUse = COLORS.GREY

      if (station.id === departureStationId) {
        // Start color transition for departure station
        startColorTransition(station.id, COLORS.GREY.clone(), COLORS.BLUE.clone())
        colorToUse = COLORS.BLUE
      } else if (station.id === arrivalStationId) {
        // Start color transition for arrival station
        startColorTransition(station.id, COLORS.GREY.clone(), COLORS.RED.clone())
        colorToUse = COLORS.RED
      }

      // Set colors for both meshes using the standard 'color' attribute
      stationColorAttr.setXYZ(i, colorToUse.r, colorToUse.g, colorToUse.b)
      ringColorAttr.setXYZ(i, colorToUse.r, colorToUse.g, colorToUse.b)
    }

    // Update instance matrices and color attributes
    stationMesh.instanceMatrix.needsUpdate = true
    ringMesh.instanceMatrix.needsUpdate = true
    stationColorAttr.needsUpdate = true
    ringColorAttr.needsUpdate = true
  }, [memoizedStations, stationSelection, startColorTransition])

  // Update stations when selection changes
  useEffect(() => {
    if (!overlayRef.current) {
      return
    }

    populateInstancedMeshes()

    try {
      overlayRef.current.requestRedraw()
    } catch (err) {
      console.error("Error requesting redraw after populating meshes:", err)
    }
  }, [populateInstancedMeshes, memoizedStations.length, stationSelection])

  // Populate Car Models
  const populateCarModels = useCallback(() => {
    if (!overlayRef.current || !carGeoRef.current || !sceneRef.current) {
      return
    }

    try {
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
        overlayRef.current!.latLngAltitudeToVector3({ lat: car.lat, lng: car.lng, altitude: 50 }, tempVector)

        let carModel = carModelsRef.current.get(car.id)
        if (!carModel) {
          carModel = carGeoRef.current!.clone()
          carModel.userData = { isCar: true, carId: car.id }
          carModel.visible = true
          sceneRef.current!.add(carModel)
          carModelsRef.current.set(car.id, carModel)
        }
        carModel.position.set(tempVector.x, tempVector.y, tempVector.z)
        carModel.rotation.x = Math.PI / 2
      })
    } catch (error) {
      console.error("Error populating car models:", error)
    }
  }, [memoizedCars])

  // Load car model
  // @ts-expect-error
  const { scene: carModelScene, error: carModelError } = useGLTF("/cars/defaultModel.glb")

  useEffect(() => {
    if (carModelError) {
      console.error("Error loading car model:", carModelError)
    }
  }, [carModelError])

  // Main initialization
  useEffect(() => {
    if (!googleMap) {
      console.log("Google Map not available yet")
      return
    }

    if (isInitializedRef.current) {
      console.log("ThreeJS overlay already initialized")
      return
    }

    console.log("[useThreeOverlay] Initializing Three.js overlay...")

    try {
      // Create scene first
      const scene = new THREE.Scene()
      scene.background = null
      sceneRef.current = scene

      // Add lights before creating overlay
      scene.add(lights.ambient)
      scene.add(lights.directional)

      console.log("Creating ThreeJSOverlayView...")
      const overlay = new ThreeJSOverlayView({
        map: googleMap,
        scene,
        anchor: DISPATCH_HUB,
        // @ts-ignore
        THREE, // Pass THREE explicitly
      })

      console.log("ThreeJSOverlayView created successfully")
      overlayRef.current = overlay

      // Important: Call setMap to attach the overlay to the map
      overlay.setMap(googleMap)

      isInitializedRef.current = true

      // Station geometry
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

      // Ring geometry
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

      // Create station material with shader modifications
      // if (!stationMaterialRef.current) {
      //   if (MaterialPool.stationMaterial) {
      //     stationMaterialRef.current = MaterialPool.stationMaterial
      //   } else {
      //     const material = new THREE.MeshPhongMaterial({ color: 0xffffff })
      //     material.onBeforeCompile = (shader) => {
      //       // Insert instanceColor attribute
      //       shader.vertexShader = shader.vertexShader.replace(
      //         "void main() {",
      //         `
      // attribute vec3 instanceColor;
      // varying vec3 vInstanceColor;

      // void main() {
      //   vInstanceColor = instanceColor;
      // `,
      //       )
      //       // Multiply final color by vInstanceColor
      //       shader.fragmentShader = shader.fragmentShader.replace(
      //         "#include <color_fragment>",
      //         `
      // #include <color_fragment>
      // diffuseColor.rgb *= vInstanceColor;
      // `,
      //       )
      //     }
      //     MaterialPool.stationMaterial = material
      //     stationMaterialRef.current = material
      //   }
      // }

      // // Create ring material with shader modifications
      // if (!ringMaterialRef.current) {
      //   if (MaterialPool.ringMaterial) {
      //     ringMaterialRef.current = MaterialPool.ringMaterial
      //   } else {
      //     const material = new THREE.MeshPhongMaterial({
      //       color: 0xffffff,
      //       shininess: 80,
      //     })
      //     material.onBeforeCompile = (shader) => {
      //       // Insert instanceColor and instanceEmissive attributes
      //       shader.vertexShader = shader.vertexShader.replace(
      //         "void main() {",
      //         `
      // attribute vec3 instanceColor;
      // attribute vec3 instanceEmissive;
      // varying vec3 vInstanceColor;
      // varying vec3 vInstanceEmissive;

      // void main() {
      //   vInstanceColor = instanceColor;
      //   vInstanceEmissive = instanceEmissive;
      // `,
      //       )
      //       // Modify color and emissive in fragment shader
      //       shader.fragmentShader = shader.fragmentShader.replace(
      //         "#include <color_fragment>",
      //         `
      // #include <color_fragment>
      // diffuseColor.rgb *= vInstanceColor;
      // `,
      //       )
      //       shader.fragmentShader = shader.fragmentShader.replace(
      //         "#include <emissivemap_fragment>",
      //         `
      // #include <emissivemap_fragment>
      // totalEmissiveRadiance = vInstanceEmissive;
      // `,
      //       )
      //     }
      //     MaterialPool.ringMaterial = material
      //     ringMaterialRef.current = material
      //   }
      // }

      // Create standard materials with vertex colors enabled
      if (!stationMaterialRef.current) {
        if (MaterialPool.stationMaterial) {
          stationMaterialRef.current = MaterialPool.stationMaterial
        } else {
          const material = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            vertexColors: true,
            opacity: 0.95,
            transparent: true,
          })
          MaterialPool.stationMaterial = material
          stationMaterialRef.current = material
        }
      }

      if (!ringMaterialRef.current) {
        if (MaterialPool.ringMaterial) {
          ringMaterialRef.current = MaterialPool.ringMaterial
        } else {
          const material = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            vertexColors: true,
            shininess: 80,
            opacity: 0.95,
            transparent: true,
          })
          MaterialPool.ringMaterial = material
          ringMaterialRef.current = material
        }
      }

      // Create booking tube material
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

      // Create single InstancedMesh for stations
      const maxInstances = Math.max(memoizedStations.length, 1)

      // Create station mesh
      const stationMesh = new THREE.InstancedMesh(stationGeoRef.current!, stationMaterialRef.current!, maxInstances)
      stationMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      stationMesh.frustumCulled = false
      scene.add(stationMesh)
      stationInstancedMeshRef.current = stationMesh

      // Create ring mesh
      const ringMesh = new THREE.InstancedMesh(stationRingGeoRef.current!, ringMaterialRef.current!, maxInstances)
      ringMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      ringMesh.frustumCulled = false
      ringMesh.renderOrder = 998
      scene.add(ringMesh)
      ringInstancedMeshRef.current = ringMesh

      // Add color attributes
      // const stationColorArray = new Float32Array(maxInstances * 3)
      // const ringColorArray = new Float32Array(maxInstances * 3)
      // const ringEmissiveArray = new Float32Array(maxInstances * 3)

      // const stationColorAttr = new THREE.InstancedBufferAttribute(stationColorArray, 3)
      // const ringColorAttr = new THREE.InstancedBufferAttribute(ringColorArray, 3)
      // const ringEmissiveAttr = new THREE.InstancedBufferAttribute(ringEmissiveArray, 3)

      // stationMesh.geometry.setAttribute("instanceColor", stationColorAttr)
      // ringMesh.geometry.setAttribute("instanceColor", ringColorAttr)
      // ringMesh.geometry.setAttribute("instanceEmissive", ringEmissiveAttr)

      // stationColorAttributeRef.current = stationColorAttr
      // ringColorAttributeRef.current = ringColorAttr
      // ringEmissiveAttributeRef.current = ringEmissiveAttr

      // Add color attributes using the standard 'color' attribute name
      const stationColorArray = new Float32Array(maxInstances * 3)
      const ringColorArray = new Float32Array(maxInstances * 3)

      const stationColorAttr = new THREE.InstancedBufferAttribute(stationColorArray, 3)
      const ringColorAttr = new THREE.InstancedBufferAttribute(ringColorArray, 3)

      stationMesh.geometry.setAttribute("color", stationColorAttr)
      ringMesh.geometry.setAttribute("color", ringColorAttr)

      stationColorAttributeRef.current = stationColorAttr
      ringColorAttributeRef.current = ringColorAttr

      // If car model is loaded and not yet cached
      if (carModelScene && !carGeoRef.current) {
        console.log("Car model loaded successfully")
        const clonedScene = carModelScene.clone()
        clonedScene.scale.set(10, 10, 10)
        clonedScene.visible = false
        carGeoRef.current = clonedScene
        carsMatRef.current = new THREE.MeshPhongMaterial({
          color: 0xff5722,
          opacity: 0.95,
          transparent: true,
        })
      } else {
        console.warn("Car model not loaded properly")
      }

      // Populate at init
      console.log("Initial population of meshes")
      populateInstancedMeshes()
      populateCarModels()

      // Force initial redraw
      console.log("Requesting initial redraw")
      try {
        overlay.requestRedraw()
      } catch (err) {
        console.error("Error in initial redraw request:", err)
      }

      // Start continuous rendering
      console.log("Starting continuous rendering")
      startContinuousRendering()

      // Debounce for map events
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
        console.log("Debounced redraw triggered")
        if (overlayRef.current) {
          overlayRef.current.requestRedraw()
        }
      }, 150)

      // Map event listeners
      if (googleMap) {
        console.log("Adding map event listeners")
        mapEventListenersRef.current = [
          googleMap.addListener("idle", () => {
            console.log("Map idle event - requesting redraw")
            if (overlayRef.current) {
              overlayRef.current.requestRedraw()
            }
          }),
          googleMap.addListener("tilesloaded", () => {
            console.log("Tiles loaded - requesting redraw")
            if (overlayRef.current) {
              overlayRef.current.requestRedraw()
            }
          }),
          googleMap.addListener("zoom_changed", debouncedRedraw),
          googleMap.addListener("center_changed", debouncedRedraw),
          googleMap.addListener("bounds_changed", debouncedRedraw),
          googleMap.addListener("dragstart", debouncedRedraw),
          googleMap.addListener("dragend", () => {
            console.log("Map drag ended - requesting redraw")
            if (overlayRef.current) {
              overlayRef.current.requestRedraw()
            }
          }),
        ]
      }

      // Watch for map div changes
      if (googleMap.getDiv && typeof window !== "undefined" && window.MutationObserver) {
        const mapDiv = googleMap.getDiv()
        console.log("Setting up MutationObserver for map div")
        const observer = new MutationObserver((mutations) => {
          if (mutations.length > 0 && overlayRef.current) {
            console.log("Map div changed - requesting redraw")
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

      console.log("ThreeJS overlay initialization complete")
    } catch (error) {
      console.error("Error during ThreeJS overlay initialization:", error)
      isInitializedRef.current = false
    }

    // Cleanup
    return () => {
      console.log("[useThreeOverlay] Cleaning up Three.js overlay...")
      // Stop continuous rendering
      stopContinuousRendering()

      // Clean up observer
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }

      // Remove map event listeners
      mapEventListenersRef.current.forEach((listener) => {
        if (window.google && window.google.maps) {
          window.google.maps.event.removeListener(listener)
        }
      })
      mapEventListenersRef.current = []

      // Cancel any animation frames
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current)
        animationFrameIdRef.current = null
      }

      // Remove overlay from map
      if (overlayRef.current) {
        try {
          // Use type assertion to fix the TypeScript error
          ;(overlayRef.current.setMap as (map: google.maps.Map | null) => void)(null)
        } catch (err) {
          console.error("Error removing overlay from map:", err)
        }
      }

      // Remove car models
      carModelsRef.current.forEach((model) => {
        sceneRef.current?.remove(model)
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

      // Dispose station geometry
      stationGeoRef.current?.dispose()
      stationGeoRef.current = null
      stationRingGeoRef.current?.dispose()
      stationRingGeoRef.current = null

      // Dispose materials
      stationMaterialRef.current?.dispose()
      stationMaterialRef.current = null
      ringMaterialRef.current?.dispose()
      ringMaterialRef.current = null
      bookingTubeMatRef.current?.dispose()
      bookingTubeMatRef.current = null

      // Dispose car model geometry/material
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

      // Clean booking route mesh
      if (bookingRouteMeshRef.current) {
        if (!GeometryPool.tube.has((bookingRouteMeshRef.current.geometry as any).uuid)) {
          bookingRouteMeshRef.current.geometry.dispose()
        }
        sceneRef.current?.remove(bookingRouteMeshRef.current)
        bookingRouteMeshRef.current = null
      }

      // Clear scene
      sceneRef.current?.clear()
      sceneRef.current = null
      overlayRef.current = null
      isInitializedRef.current = false

      // Dispose pooled resources
      disposeGeometryPool()
      disposeMaterialPool()

      console.log("ThreeJS overlay cleanup complete")
    }
  }, [
    googleMap,
    memoizedStations,
    populateInstancedMeshes,
    populateCarModels,
    startContinuousRendering,
    stopContinuousRendering,
  ])

  // Update car models when cars change
  useEffect(() => {
    if (!overlayRef.current || !sceneRef.current) {
      console.log("Cannot update car models: scene or overlay not initialized")
      return
    }

    console.log("Updating car models")
    populateCarModels()

    try {
      overlayRef.current.requestRedraw()
    } catch (err) {
      console.error("Error requesting redraw after updating car models:", err)
    }
  }, [memoizedCars, populateCarModels])

  // Handle booking route
  useEffect(() => {
    if (!overlayRef.current || !sceneRef.current) {
      console.log("Cannot update booking route: scene or overlay not initialized")
      return
    }

    console.log("Updating booking route:", bookingRouteDecoded?.length ?? 0, "points")

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
      bookingRouteMeshRef.current.visible = false
    }

    try {
      overlayRef.current.requestRedraw()
    } catch (err) {
      console.error("Error requesting redraw after updating booking route:", err)
    }
  }, [bookingRouteDecoded])

  // Force a redraw when map center changes
  useEffect(() => {
    const requestSingleRedraw = () => {
      if (overlayRef.current && isInitializedRef.current) {
        try {
          console.log("Forcing redraw due to map center change")
          overlayRef.current.requestRedraw()
        } catch (err) {
          console.error("Error in forced redraw:", err)
        }
      }
    }

    // Request a redraw after a small delay to ensure map is ready
    const timer = setTimeout(requestSingleRedraw, 500)
    return () => clearTimeout(timer)
  }, [googleMap?.getCenter()?.toString()])

  // Public method to manually trigger a redraw
  const triggerRedraw = useCallback(() => {
    console.log("Manual redraw triggered")
    if (overlayRef.current) {
      try {
        overlayRef.current.requestRedraw()
        return true
      } catch (err) {
        console.error("Error in manual redraw:", err)
        return false
      }
    }
    return false
  }, [])

  return {
    overlayRef,
    sceneRef,
    stationInstancedMeshRef,
    ringInstancedMeshRef,
    stationIdToInstanceIndexMap,
    instanceIndexToStationIdMap,
    triggerRedraw,
  }
}

