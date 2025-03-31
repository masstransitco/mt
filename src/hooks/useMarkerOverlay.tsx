"use client"

import { useEffect, useRef, useCallback, useMemo } from "react"
import { toast } from "react-hot-toast"
import { useAppSelector, useAppDispatch, store } from "@/store/store"
import { selectStationsWithDistance, type StationFeature } from "@/store/stationsSlice"
import { selectStations3D } from "@/store/stations3DSlice"

import {
  selectBookingStep,
  selectDepartureStationId,
  selectArrivalStationId,
  advanceBookingStep,
  selectDepartureStation as doSelectDepartureStation,
  selectArrivalStation as doSelectArrivalStation,
  selectRoute as selectBookingRoute, // The route for DEPARTURE->ARRIVAL:
} from "@/store/bookingSlice"

// The route from dispatch hub -> departure station:
import { selectDispatchRoute } from "@/store/dispatchSlice"

// Declare google as any to avoid TypeScript errors
declare var google: any

function decodePolyline(encoded: string): google.maps.LatLngLiteral[] {
  if (!window.google?.maps?.geometry?.encoding) {
    console.warn("No geometry library available for decoding polyline")
    return []
  }
  const decodedPath = window.google.maps.geometry.encoding.decodePath(encoded)
  return decodedPath.map((latLng) => latLng.toJSON())
}

/**
 * Compute the "true" midpoint by walking along the route's cumulative distance.
 * Fallback: if geometry.spherical is missing, use the naive midIndex.
 */
function computeRouteMidpoint(routeCoords: google.maps.LatLngLiteral[]): google.maps.LatLngLiteral {
  if (!window.google?.maps?.geometry?.spherical) {
    console.warn("[useMarkerOverlay] geometry.spherical missing; fallback to midIndex")
    const midIndex = Math.floor(routeCoords.length / 2)
    return routeCoords[midIndex]
  }
  const spherical = window.google.maps.geometry.spherical
  const latLngs = routeCoords.map((p) => new window.google.maps.LatLng(p))
  const totalLength = spherical.computeLength(latLngs)
  const halfDist = totalLength / 2

  let accumulated = 0
  for (let i = 0; i < latLngs.length - 1; i++) {
    const segStart = latLngs[i]
    const segEnd = latLngs[i + 1]
    const segDist = spherical.computeDistanceBetween(segStart, segEnd)
    if (accumulated + segDist >= halfDist) {
      const overshoot = halfDist - accumulated
      const fraction = overshoot / segDist
      const midLatLng = spherical.interpolate(segStart, segEnd, fraction)
      return midLatLng.toJSON()
    }
    accumulated += segDist
  }
  // fallback
  return routeCoords[Math.floor(routeCoords.length / 2)]
}

interface UseMarkerOverlayOptions {
  onPickupClick?: (stationId: number) => void
  onTiltChange?: (tilt: number) => void
}

export function useMarkerOverlay(
  googleMap: google.maps.Map | null,
  options?: UseMarkerOverlayOptions,
) {
  const dispatch = useAppDispatch()

  // Redux state
  const stations = useAppSelector(selectStationsWithDistance)
  const buildings3D = useAppSelector(selectStations3D)

  const bookingStep = useAppSelector(selectBookingStep)
  const departureStationId = useAppSelector(selectDepartureStationId)
  const arrivalStationId = useAppSelector(selectArrivalStationId)

  // The route from dispatch hub -> departure station
  const dispatchRoute = useAppSelector(selectDispatchRoute)
  // The route from departure -> arrival
  const bookingRoute = useAppSelector(selectBookingRoute)

  // Station "candidates" with geometry + station ID.
  const candidateStationsRef = useRef<{
    stationId: number
    position: google.maps.LatLngAltitudeLiteral
    stationData?: StationFeature
    refs?: ReturnType<typeof buildMarkerContainer>
    marker?: google.maps.marker.AdvancedMarkerElement | null
  }[]>([])

  // Single route marker for the departure->arrival route
  const routeMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)

  // Keep track of current tilt
  const tiltRef = useRef(0)

  // For the departure station, show "Pickup in X minutes"
  const pickupMins = useMemo(() => {
    if (!dispatchRoute?.duration) return null
    const drivingMins = dispatchRoute.duration / 60
    return Math.ceil(drivingMins + 15)
  }, [dispatchRoute])

  // Decide if a station marker is forced visible (departure or arrival)
  const isForceVisible = useCallback(
    (stationId: number): boolean =>
      stationId === departureStationId || stationId === arrivalStationId,
    [departureStationId, arrivalStationId],
  )

  // Which station(s) are expanded?
  // - Step < 3: only departure station is expanded (once chosen).
  // - Step >= 3: expand both departure and arrival (if chosen).
  const isExpanded = useCallback(
    (stationId: number): boolean => {
      const isDeparture = stationId === departureStationId
      const isArrival = stationId === arrivalStationId
      if (bookingStep < 3) {
        return isDeparture
      }
      return isDeparture || isArrival
    },
    [bookingStep, departureStationId, arrivalStationId],
  )

  // UPDATED: fetch booking step from store to avoid stale closure
  const handleStationClick = useCallback(
    (stationId: number) => {
      const currentStep = store.getState().booking.step
      if (currentStep === 1 || currentStep === 2) {
        dispatch(doSelectDepartureStation(stationId))
        toast.success(`Departure station #${stationId} selected!`)
      } else if (currentStep === 3 || currentStep === 4) {
        dispatch(doSelectArrivalStation(stationId))
        toast.success(`Arrival station #${stationId} selected!`)
      }
    },
    [dispatch],
  )

  // Build DOM for each station marker, hooking up events
  const buildMarkerContainer = useCallback(
    (station: StationFeature) => {
      const container = document.createElement("div")
      container.classList.add("marker-container")
      container.style.cssText = `
        position: relative;
        pointer-events: auto;
        transform-origin: center bottom;
        transition: transform 0.3s cubic-bezier(0.2, 0, 0.2, 1), opacity 0.3s ease;
        transform: scale(0);
        opacity: 1;
      `

      // Collapsed marker
      const collapsedWrapper = document.createElement("div")
      collapsedWrapper.classList.add("collapsed-wrapper")
      collapsedWrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        pointer-events: none;
        transition: opacity 0.25s ease-out, transform 0.25s cubic-bezier(0.2, 0, 0.2, 1);
      `

      const collapsedDiv = document.createElement("div")
      collapsedDiv.classList.add("collapsed-view")
      collapsedDiv.style.cssText = `
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: linear-gradient(135deg, #1C1C1E, #2C2C2E);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #F2F2F7;
        font-size: 14px;
        border: 2px solid #505156;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        pointer-events: auto;
        transform-origin: center;
        transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
      `
      collapsedDiv.textContent = "⚑"

      // Marker click → station selection
      collapsedDiv.addEventListener("click", (ev) => {
        ev.stopPropagation()
        handleStationClick(station.id)
      })

      // Hover effect
      collapsedDiv.addEventListener("mouseenter", () => {
        collapsedDiv.style.transform = "scale(1.1)"
        collapsedDiv.style.boxShadow = "0 4px 12px rgba(0,0,0,0.6)"
      })
      collapsedDiv.addEventListener("mouseleave", () => {
        collapsedDiv.style.transform = ""
        collapsedDiv.style.boxShadow = "0 2px 8px rgba(0,0,0,0.5)"
      })

      const collapsedPost = document.createElement("div")
      collapsedPost.style.cssText = `
        width: 2px;
        height: 28px;
        background: linear-gradient(to bottom, rgba(170,170,170,0.8), rgba(170,170,170,0.2));
        margin-top: 2px;
        pointer-events: none;
        transition: height 0.3s ease, opacity 0.3s ease;
      `
      collapsedWrapper.appendChild(collapsedDiv)
      collapsedWrapper.appendChild(collapsedPost)

      // Expanded marker
      const expandedWrapper = document.createElement("div")
      expandedWrapper.classList.add("expanded-wrapper")
      expandedWrapper.style.cssText = `
        display: none;
        flex-direction: column;
        align-items: center;
        transition: opacity 0.25s ease-out, transform 0.25s cubic-bezier(0.2, 0, 0.2, 1);
      `

      const expandedDiv = document.createElement("div")
      expandedDiv.classList.add("expanded-view")
      expandedDiv.style.cssText = `
        width: 220px;
        background: linear-gradient(145deg, #1C1C1E, #2C2C2E);
        color: #F2F2F7;
        border: 2px solid #505156;
        border-radius: 12px;
        box-shadow: 0 8px 16px rgba(0,0,0,0.5);
        padding: 12px;
        cursor: pointer;
        pointer-events: auto;
        transform-origin: center;
        transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
      `
      expandedDiv.innerHTML = `
        <div class="expanded-info-section" style="margin-bottom: 8px;"></div>
        <button class="pickup-btn" style="
          display: inline-block;
          padding: 8px 12px;
          background: #10A37F;
          color: #FFFFFF;
          font-size: 14px;
          font-weight: 600;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease-in-out;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          width: 100%;
        ">
          Pickup car here
        </button>
      `

      // Hover effect
      expandedDiv.addEventListener("mouseenter", () => {
        expandedDiv.style.transform = "scale(1.02)"
        expandedDiv.style.boxShadow = "0 12px 24px rgba(0,0,0,0.6)"
      })
      expandedDiv.addEventListener("mouseleave", () => {
        expandedDiv.style.transform = ""
        expandedDiv.style.boxShadow = "0 8px 16px rgba(0,0,0,0.5)"
      })

      // "Pickup car here" button → only in step 2
      const pickupBtn = expandedDiv.querySelector<HTMLButtonElement>(".pickup-btn")
      if (pickupBtn) {
        pickupBtn.addEventListener("mouseenter", () => {
          pickupBtn.style.background = "#0D8C6D"
          pickupBtn.style.transform = "translateY(-1px)"
          pickupBtn.style.boxShadow = "0 4px 8px rgba(0,0,0,0.4)"
        })
        pickupBtn.addEventListener("mouseleave", () => {
          pickupBtn.style.background = "#10A37F"
          pickupBtn.style.transform = ""
          pickupBtn.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)"
        })
        pickupBtn.addEventListener("click", (ev) => {
          ev.stopPropagation()
          if (store.getState().booking.step === 2) {
            dispatch(advanceBookingStep(3))
            toast.success("Departure confirmed! Now choose your arrival station.")
            options?.onPickupClick?.(station.id)
          }
        })
      }

      // Clicking the expanded area also selects the station
      expandedDiv.addEventListener("click", (ev) => {
        ev.stopPropagation()
        handleStationClick(station.id)
      })

      const expandedPost = document.createElement("div")
      expandedPost.style.cssText = `
        width: 2px;
        height: 28px;
        background: linear-gradient(to bottom, rgba(170,170,170,0.8), rgba(170,170,170,0.2));
        margin-top: 2px;
        pointer-events: none;
        transition: height 0.3s ease, opacity 0.3s ease;
      `
      expandedWrapper.appendChild(expandedDiv)
      expandedWrapper.appendChild(expandedPost)

      // Combine
      container.appendChild(collapsedWrapper)
      container.appendChild(expandedWrapper)

      return {
        container,
        collapsedWrapper,
        collapsedDiv,
        collapsedPost,
        expandedWrapper,
        expandedDiv,
        expandedPost,
        pickupBtn,
        expandedInfoSection: expandedDiv.querySelector<HTMLDivElement>(".expanded-info-section"),
      }
    },
    [dispatch, handleStationClick, options],
  )

  // Adjust post height based on tilt
  const computePostHeight = useCallback((baseHeight: number, tilt: number) => {
    const fraction = Math.min(Math.max(tilt / 45, 0), 1)
    return baseHeight * fraction
  }, [])

  // Create or update the route marker for DEPARTURE->ARRIVAL
  const createOrUpdateRouteMarker = useCallback(() => {
    if (!googleMap) return
    if (!window.google?.maps?.marker?.AdvancedMarkerElement) return

    const hasRoute = bookingRoute?.polyline && bookingRoute.duration
    const showMarker = bookingStep === 4 && arrivalStationId != null && hasRoute

    if (!showMarker) {
      // Fade out if not needed
      if (routeMarkerRef.current) {
        const content = routeMarkerRef.current.content as HTMLElement
        if (content) {
          content.style.transform = "scale(0)"
          content.style.opacity = "0"
          setTimeout(() => {
            if (routeMarkerRef.current) {
              routeMarkerRef.current.map = null
              routeMarkerRef.current = null
            }
          }, 300)
        } else {
          routeMarkerRef.current.map = null
          routeMarkerRef.current = null
        }
      }
      return
    }

    // Decode the polyline
    const path = decodePolyline(bookingRoute.polyline)
    if (path.length < 2) return

    // Compute route midpoint
    const midpoint = computeRouteMidpoint(path)
    const altitude = 15
    const driveMins = Math.ceil(bookingRoute.duration / 60)

    const { AdvancedMarkerElement } = window.google.maps.marker

    if (!routeMarkerRef.current) {
      // Create new route marker
      const container = document.createElement("div")
      container.style.cssText = `
        position: relative;
        transform: scale(0);
        opacity: 0;
        transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease;
      `

      const wrapper = document.createElement("div")
      wrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        pointer-events: none;
      `

      const boxDiv = document.createElement("div")
      boxDiv.classList.add("route-box")
      boxDiv.style.cssText = `
        width: 140px;
        background: linear-gradient(145deg, #1C1C1E, #2C2C2E);
        color: #FFFFFF;
        border: 2px solid #FFFFFF;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        padding: 8px;
        text-align: center;
        pointer-events: auto;
        font-size: 15px;
        font-weight: 600;
        cursor: default;
        transition: transform 0.2s ease;
      `
      boxDiv.innerHTML = `${driveMins} mins drive`

      const postDiv = document.createElement("div")
      postDiv.classList.add("route-post")
      postDiv.style.cssText = `
        width: 2px;
        height: 28px;
        background: linear-gradient(to bottom, rgba(255,255,255,0.8), rgba(255,255,255,0.2));
        margin-top: 2px;
        pointer-events: none;
        transition: height 0.3s ease;
      `

      wrapper.appendChild(boxDiv)
      wrapper.appendChild(postDiv)
      container.appendChild(wrapper)

      const rMarker = new AdvancedMarkerElement({
        map: googleMap,
        position: {
          lat: midpoint.lat,
          lng: midpoint.lng,
          altitude,
        } as google.maps.LatLngAltitudeLiteral,
        collisionBehavior: "REQUIRED" as any, // stay on top
        gmpClickable: false,
        content: container,
      })

      routeMarkerRef.current = rMarker

      // Animate in
      requestAnimationFrame(() => {
        container.style.transform = "scale(1)"
        container.style.opacity = "1"
      })
    } else {
      // Update existing
      routeMarkerRef.current.position = { lat: midpoint.lat, lng: midpoint.lng, altitude }
      routeMarkerRef.current.collisionBehavior = "REQUIRED" as any
    }

    // Update text & post height
    const rm = routeMarkerRef.current!
    const c = rm.content as HTMLDivElement
    if (c) {
      const textDiv = c.querySelector<HTMLDivElement>(".route-box")
      if (textDiv) {
        textDiv.innerHTML = `${driveMins} mins drive`
      }
      const post = c.querySelector<HTMLDivElement>(".route-post")
      if (post) {
        const newHeight = computePostHeight(28, tiltRef.current)
        post.style.height = `${newHeight}px`
      }
    }
  }, [googleMap, bookingRoute, bookingStep, arrivalStationId, computePostHeight])

  // Build candidate station list once
  const initializeCandidateStations = useCallback(() => {
    if (!candidateStationsRef.current.length) {
      const stationByObjectId = new Map<number, StationFeature>()
      stations.forEach((st) => {
        const objId = st.properties.ObjectId
        if (typeof objId === "number") {
          stationByObjectId.set(objId, st)
        }
      })

      const candidateList: typeof candidateStationsRef.current = []
      buildings3D.forEach((bld) => {
        const objId = bld.properties?.ObjectId
        if (!objId) return
        const station = stationByObjectId.get(objId)
        if (!station) return

        // Approx polygon center
        const coords = bld.geometry?.coordinates?.[0] as [number, number][] | undefined
        if (!coords || coords.length < 3) return

        let totalLat = 0
        let totalLng = 0
        coords.forEach(([lng, lat]) => {
          totalLat += lat
          totalLng += lng
        })
        const centerLat = totalLat / coords.length
        const centerLng = totalLng / coords.length

        const topHeight = bld.properties?.topHeight ?? 250
        const altitude = topHeight + 5

        candidateList.push({
          stationId: station.id,
          position: { lat: centerLat, lng: centerLng, altitude },
          stationData: station,
          marker: null,
        })
      })

      candidateStationsRef.current = candidateList
    }
  }, [stations, buildings3D])

  // Create an AdvancedMarker for a station
  const createStationMarker = useCallback(
    (entry: typeof candidateStationsRef.current[number]) => {
      if (!googleMap) return
      if (!window.google?.maps?.marker?.AdvancedMarkerElement) return

      // Build DOM for marker if not built yet
      if (!entry.refs) {
        if (!entry.stationData) return
        entry.refs = buildMarkerContainer(entry.stationData)
      }
      const { container } = entry.refs || {}
      if (!container) return

      const { AdvancedMarkerElement } = window.google.maps.marker
      entry.marker = new AdvancedMarkerElement({
        position: entry.position,
        collisionBehavior: "OPTIONAL_AND_HIDES_LOWER_PRIORITY" as any,
        gmpClickable: true,
        content: container,
        map: googleMap,
      })
      ;(entry.marker as any)._refs = entry.refs
      ;(entry.marker as any)._stationData = entry.stationData

      // Animate in
      container.style.transitionDelay = `${Math.random() * 300}ms`
      requestAnimationFrame(() => {
        container.style.transform = "scale(1)"
      })
    },
    [googleMap, buildMarkerContainer],
  )

  // Master refresh logic for markers
  const refreshMarkers = useCallback(() => {
    const currentTilt = tiltRef.current

    candidateStationsRef.current.forEach((entry) => {
      if (!entry.marker) return

      const marker = entry.marker
      const station = (marker as any)._stationData as StationFeature
      const refs = (marker as any)._refs
      if (!refs) return

      const forceVis = isForceVisible(station.id)
      marker.collisionBehavior = forceVis
        ? ("REQUIRED" as any)
        : ("OPTIONAL_AND_HIDES_LOWER_PRIORITY" as any)

      if (marker.element) {
        marker.element.style.zIndex = forceVis ? "9999" : "1"
      }

      // Expanded/collapsed logic
      const expanded = isExpanded(station.id)
      if (expanded) {
        refs.collapsedWrapper.style.opacity = "0"
        refs.collapsedWrapper.style.transform = "scale(0.8)"
        refs.expandedWrapper.style.display = "flex"
        requestAnimationFrame(() => {
          refs.expandedWrapper.style.opacity = "1"
          refs.expandedWrapper.style.transform = "scale(1)"
        })
      } else {
        refs.collapsedWrapper.style.opacity = "1"
        refs.collapsedWrapper.style.transform = "scale(1)"
        refs.expandedWrapper.style.opacity = "0"
        refs.expandedWrapper.style.transform = "scale(0.95)"
        setTimeout(() => {
          refs.expandedWrapper.style.display = "none"
        }, 250)
      }

      // Post heights
      const newHeight = computePostHeight(28, currentTilt)
      const showPosts = currentTilt > 5 ? "1" : "0"
      refs.collapsedPost.style.height = `${newHeight}px`
      refs.collapsedPost.style.opacity = showPosts
      refs.expandedPost.style.height = `${newHeight}px`
      refs.expandedPost.style.opacity = showPosts

      // "Pickup car here" only in step 2
      if (refs.pickupBtn) {
        refs.pickupBtn.style.display = bookingStep === 2 ? "inline-block" : "none"
      }

      // Border color + glow if departure/arrival
      const isDeparture = station.id === departureStationId
      const isArrival = station.id === arrivalStationId
      const borderColor = isDeparture
        ? "#10A37F"
        : isArrival
        ? "#276EF1"
        : "#505156"

      // Collapsed style
      refs.collapsedDiv.style.borderColor = borderColor
      if (isDeparture || isArrival) {
        const glowColor = isDeparture
          ? "rgba(16, 163, 127, 0.5)"
          : "rgba(39, 110, 241, 0.5)"
        refs.collapsedDiv.style.boxShadow =
          `0 2px 8px rgba(0,0,0,0.5), 0 0 12px ${glowColor}`
      } else {
        refs.collapsedDiv.style.boxShadow = "0 2px 8px rgba(0,0,0,0.5)"
      }

      // Expanded style
      refs.expandedDiv.style.borderColor = borderColor
      if (isDeparture || isArrival) {
        const glowColor = isDeparture
          ? "rgba(16, 163, 127, 0.5)"
          : "rgba(39, 110, 241, 0.5)"
        refs.expandedDiv.style.boxShadow =
          `0 8px 16px rgba(0,0,0,0.5), 0 0 16px ${glowColor}`
      } else {
        refs.expandedDiv.style.boxShadow = "0 8px 16px rgba(0,0,0,0.5)"
      }

      // Info section
      if (!refs.expandedInfoSection) return
      if (isDeparture && bookingStep >= 3 && pickupMins !== null) {
        refs.expandedInfoSection.innerHTML = `
          <div style="font-size: 16px; font-weight: 600; margin-bottom: 4px; color: #10A37F;">
            Pickup in ${pickupMins} minutes
          </div>
          <div style="font-size: 14px; opacity: 0.8;">
            ${station.properties.Address || "No address available"}
          </div>
        `
      } else {
        const placeName = station.properties.Place || `Station ${station.id}`
        const address = station.properties.Address || "No address available"
        const titleColor = isDeparture ? "#10A37F" : isArrival ? "#276EF1" : "#F2F2F7"
        refs.expandedInfoSection.innerHTML = `
          <div style="font-size: 16px; font-weight: 600; margin-bottom: 4px; color: ${titleColor};">
            ${placeName}
          </div>
          <div style="font-size: 14px; opacity: 0.8;">
            ${address}
          </div>
        `
      }
    })

    // Refresh route marker too
    createOrUpdateRouteMarker()
  }, [
    bookingStep,
    departureStationId,
    arrivalStationId,
    pickupMins,
    computePostHeight,
    createOrUpdateRouteMarker,
    isForceVisible,
    isExpanded,
  ])

  // Tilt change → re-style markers
  const updateMarkerTilt = useCallback(
    (newTilt: number) => {
      tiltRef.current = newTilt
      options?.onTiltChange?.(newTilt)
      refreshMarkers()
    },
    [options, refreshMarkers],
  )

  // Initialize candidate stations only once
  useEffect(() => {
    initializeCandidateStations()
  }, [initializeCandidateStations])

  // The function that handles map bounds changes (which markers to add/remove)
  const handleMapBoundsChange = useCallback(() => {
    if (!googleMap) return
    const bounds = googleMap.getBounds()
    if (!bounds) return

    candidateStationsRef.current.forEach((entry) => {
      const { stationId, position, marker } = entry

      // Forced visible?
      if (isForceVisible(stationId)) {
        if (!marker) {
          createStationMarker(entry)
        } else if (!marker.map) {
          marker.map = googleMap
        }
        return
      }

      // Is the station center in the viewport?
      const isInBounds = bounds.contains({ lat: position.lat, lng: position.lng })
      if (isInBounds) {
        if (!marker) {
          createStationMarker(entry)
        } else if (!marker.map) {
          marker.map = googleMap
        }
      } else {
        // Out of view → remove
        if (marker?.map) {
          marker.map = null
        }
      }
    })

    // Re-style after potential new markers appear
    refreshMarkers()
  }, [googleMap, isForceVisible, createStationMarker, refreshMarkers])

  // Add map bounds listener with the current handleMapBoundsChange
  useEffect(() => {
    if (!googleMap) return
    const listener = googleMap.addListener("idle", () => {
      handleMapBoundsChange()
    })
    return () => {
      google.maps.event.removeListener(listener)
    }
  }, [googleMap, handleMapBoundsChange])

  // Re-run styling whenever booking step or route changes
  useEffect(() => {
    refreshMarkers()
  }, [
    bookingStep,
    departureStationId,
    arrivalStationId,
    dispatchRoute, // updates pickupMins
    bookingRoute,  // route marker
    refreshMarkers,
  ])

  // Cleanup: fade out on unmount
  useEffect(() => {
    return () => {
      candidateStationsRef.current.forEach((entry) => {
        if (entry.marker) {
          const refs = (entry.marker as any)._refs
          if (refs?.container) {
            refs.container.style.transform = "scale(0)"
            refs.container.style.opacity = "0"
          }
        }
      })

      if (routeMarkerRef.current) {
        const content = routeMarkerRef.current.content as HTMLElement
        if (content) {
          content.style.transform = "scale(0)"
          content.style.opacity = "0"
        }
      }

      setTimeout(() => {
        candidateStationsRef.current.forEach((entry) => {
          if (entry.marker) {
            entry.marker.map = null
            entry.marker = null
          }
        })
        if (routeMarkerRef.current) {
          routeMarkerRef.current.map = null
          routeMarkerRef.current = null
        }
      }, 300)
    }
  }, [])

  return {
    routeMarkerRef,
    updateMarkerTilt,
  }
}
