import { useEffect, useRef, useCallback } from "react";
import { toast } from "react-hot-toast";
import { useAppSelector, store } from "@/store/store";
import {
  selectStationsWithDistance,
  StationFeature,
} from "@/store/stationsSlice";
import { selectStations3D } from "@/store/stations3DSlice";

import {
  selectBookingStep,
  selectDepartureStationId,
  selectArrivalStationId,
  advanceBookingStep,
  selectDepartureStation as doSelectDepartureStation,
  selectArrivalStation as doSelectArrivalStation,
} from "@/store/bookingSlice";

interface UseMarkerOverlayOptions {
  /** If you want a custom callback for the "Pickup car here" event */
  onPickupClick?: (stationId: number) => void;

  /** If you want to react to map tilt changes externally */
  onTiltChange?: (tilt: number) => void;
}

/**
 * useMarkerOverlay
 * Creates an AdvancedMarkerElement for each station’s 3D building polygon center.
 * - Collapsed marker => circle flag + vertical “sign post” line
 * - Expanded marker => info box + its own vertical line
 * - “Pickup car here” button is only shown during step 2.
 */
export function useMarkerOverlay(
  googleMap: google.maps.Map | null,
  options?: UseMarkerOverlayOptions
) {
  const stations = useAppSelector(selectStationsWithDistance);
  const buildings3D = useAppSelector(selectStations3D);

  // Booking state
  const bookingStep = useAppSelector(selectBookingStep);
  const departureStationId = useAppSelector(selectDepartureStationId);
  const arrivalStationId = useAppSelector(selectArrivalStationId);

  // Keep references to marker instances
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const markersCreatedRef = useRef(false);

  // Store the current tilt here to avoid frequent React state updates
  const tiltRef = useRef(0);

  /**
   * isStationSelected
   * For styling: highlight departure in steps 1–2, arrival in steps 3–4.
   */
  const isStationSelected = useCallback(
    (stationId: number): boolean => {
      if (bookingStep < 3) {
        return stationId === departureStationId;
      } else {
        return stationId === arrivalStationId;
      }
    },
    [bookingStep, departureStationId, arrivalStationId]
  );

  /**
   * Main click handler for the station marker (collapsed or expanded).
   * Sets departure or arrival station, depending on the booking step.
   */
  const handleStationClick = useCallback((stationId: number) => {
    const currentStep = store.getState().booking.step;
    if (currentStep === 1 || currentStep === 2) {
      store.dispatch(doSelectDepartureStation(stationId));
      toast.success(`Departure station #${stationId} selected!`);
    } else if (currentStep === 3 || currentStep === 4) {
      store.dispatch(doSelectArrivalStation(stationId));
      toast.success(`Arrival station #${stationId} selected!`);
    } else {
      console.log(`Marker clicked at step ${currentStep}, no action taken.`);
    }
  }, []);

  /**
   * Build DOM container for each station:
   *  - Collapsed marker => circle with a vertical post below it
   *  - Expanded marker => info box with a vertical post below it
   */
  const buildMarkerContainer = useCallback(
    (station: StationFeature) => {
      const container = document.createElement("div");
      container.classList.add("marker-container");
      container.style.position = "relative";
      container.style.pointerEvents = "auto";

      // ------------------------------------------
      // 1) Collapsed marker (circle + post)
      // ------------------------------------------
      const collapsedWrapper = document.createElement("div");
      collapsedWrapper.classList.add("collapsed-wrapper");
      collapsedWrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        pointer-events: none; /* Let .collapsed-view capture clicks */
      `;

      const collapsedDiv = document.createElement("div");
      collapsedDiv.classList.add("collapsed-view");
      collapsedDiv.style.cssText = `
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: linear-gradient(135deg, #46474B, #505156);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #F2F2F7;
        font-size: 14px;
        border: 2px solid #2C2C2E; /* default border, updated dynamically */
        cursor: pointer;
        box-shadow: 0 0 4px rgba(0,0,0,0.4);
        pointer-events: auto;
      `;
      collapsedDiv.textContent = "⚑";
      collapsedDiv.addEventListener("click", (ev) => {
        ev.stopPropagation();
        handleStationClick(station.id);
      });

      // Vertical post under the circle marker
      const collapsedPost = document.createElement("div");
      collapsedPost.style.cssText = `
        width: 2px;
        height: 28px;
        background: #AAA;
        margin-top: 2px;
        pointer-events: none;
      `;

      collapsedWrapper.appendChild(collapsedDiv);
      collapsedWrapper.appendChild(collapsedPost);

      // ------------------------------------------
      // 2) Expanded marker (info box + post)
      // ------------------------------------------
      const expandedWrapper = document.createElement("div");
      expandedWrapper.classList.add("expanded-wrapper");
      expandedWrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        pointer-events: none; /* The box itself handles clicks inside */
        position: relative;
      `;

      const expandedDiv = document.createElement("div");
      expandedDiv.classList.add("expanded-view");
      expandedDiv.style.cssText = `
        width: 220px;
        background: #2C2C2E;
        color: #F2F2F7;
        border: 2px solid #505156; /* updated dynamically for departure/arrival */
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.5);
        padding: 12px;
        cursor: pointer;
        pointer-events: auto;
      `;
      expandedDiv.innerHTML = `
        <div style="margin-bottom: 8px;">
          <div style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">
            ${station.properties.Place || `Station ${station.id}`}
          </div>
          <div style="font-size: 14px; opacity: 0.8;">
            ${station.properties.Address || "No address available"}
          </div>
        </div>
        <button class="pickup-btn" style="
          display: inline-block;
          padding: 8px 12px;
          background: #10A37F; /* muted green */
          color: #1C1C1E;
          font-size: 14px;
          font-weight: 600;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.2s ease-in-out;
        ">
          Pickup car here
        </button>
      `;

      // “Pickup car here” button logic
      const pickupBtn = expandedDiv.querySelector(".pickup-btn");
      if (pickupBtn) {
        pickupBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const currentStep = store.getState().booking.step;
          if (currentStep === 2) {
            store.dispatch(advanceBookingStep(3));
            toast.success(
              "Departure confirmed! Now choose your arrival station."
            );
            options?.onPickupClick?.(station.id);
          }
        });
      }

      // Clicking anywhere else in the expanded box => select station
      expandedDiv.addEventListener("click", (ev) => {
        ev.stopPropagation();
        handleStationClick(station.id);
      });

      // Vertical post under the expanded box
      const expandedPost = document.createElement("div");
      expandedPost.style.cssText = `
        width: 2px;
        height: 28px;
        background: #AAA;
        margin-top: 2px;
        pointer-events: none;
      `;

      expandedWrapper.appendChild(expandedDiv);
      expandedWrapper.appendChild(expandedPost);

      // ------------------------------------------
      // Combine everything into the container
      // ------------------------------------------
      container.appendChild(collapsedWrapper);
      container.appendChild(expandedWrapper);

      // By default, show collapsed, hide expanded
      collapsedWrapper.style.display = "flex";
      expandedWrapper.style.display = "none";

      return container;
    },
    [handleStationClick, options]
  );

  /**
   * Creates all markers once, attaching them to the map.
   * Uses station => building mapping to place markers at building center.
   */
  const createMarkers = useCallback(() => {
    if (!googleMap || markersCreatedRef.current) return;
    if (!window.google?.maps?.marker?.AdvancedMarkerElement) {
      console.warn(
        "AdvancedMarkerElement not available. Make sure &libraries=marker is included."
      );
      return;
    }
    markersCreatedRef.current = true;

    const { AdvancedMarkerElement } = window.google.maps.marker;
    const stationByObjectId = new Map<number, StationFeature>();

    // Map building ObjectId => station
    stations.forEach((st) => {
      const objId = st.properties.ObjectId;
      if (typeof objId === "number") {
        stationByObjectId.set(objId, st);
      }
    });

    // Create marker for each 3D building that maps to a station
    buildings3D.forEach((bld) => {
      const objId = bld.properties?.ObjectId;
      if (!objId) return;
      const station = stationByObjectId.get(objId);
      if (!station) return;

      // Approx building center
      const coords = bld.geometry?.coordinates?.[0] as
        | [number, number][]
        | undefined;
      if (!coords || coords.length < 3) return;

      let totalLat = 0;
      let totalLng = 0;
      coords.forEach(([lng, lat]) => {
        totalLat += lat;
        totalLng += lng;
      });
      const centerLat = totalLat / coords.length;
      const centerLng = totalLng / coords.length;

      // For altitude usage
      const topHeight = bld.properties?.topHeight ?? 250;
      const altitude = topHeight + 5;

      // Build the container with both collapsed & expanded
      const container = buildMarkerContainer(station);

      // Create the AdvancedMarker
      const marker = new AdvancedMarkerElement({
        map: googleMap,
        position: {
          lat: centerLat,
          lng: centerLng,
          altitude,
        } as google.maps.LatLngAltitudeLiteral,
        collisionBehavior:
          "OPTIONAL_AND_HIDES_LOWER_PRIORITY" as any,
        gmpClickable: true,
        content: container,
      });

      // Store references
      (marker as any)._container = container;
      (marker as any)._stationData = station;

      markersRef.current.push(marker);
    });
  }, [googleMap, stations, buildings3D, buildMarkerContainer]);

  /**
   * Helper for vertical post dynamic height based on tilt
   */
  const computePostHeight = useCallback((baseHeight: number, tilt: number) => {
    // tilt is 0..45 => fraction
    const fraction = Math.min(Math.max(tilt / 45, 0), 1);
    return baseHeight * fraction;
  }, []);

  /**
   * refreshMarkers
   *  - Toggle expanded vs. collapsed
   *  - Update collisionBehavior
   *  - Show/hide the "Pickup car" button if we are in step 2
   *  - Apply green border for departure, blue for arrival
   */
  const refreshMarkers = useCallback(() => {
    const currentTilt = tiltRef.current;

    markersRef.current.forEach((marker) => {
      const station = (marker as any)._stationData as StationFeature;
      const container = (marker as any)._container as HTMLDivElement | null;
      if (!container) return;

      const expanded = isStationSelected(station.id);

      // Force the marker not to hide behind others when expanded
      marker.collisionBehavior = expanded
        ? ("REQUIRED" as any)
        : ("OPTIONAL_AND_HIDES_LOWER_PRIORITY" as any);

      // Raise zIndex if expanded
      if (marker.element) {
        marker.element.style.zIndex = expanded ? "9999" : "1";
      }

      // Dynamic vertical Post Height
      const collapsedPost = container.querySelector<HTMLDivElement>(
        ".collapsed-wrapper > div:last-child"
      );
      const expandedPost = container.querySelector<HTMLDivElement>(
        ".expanded-wrapper > div:last-child"
      );

      if (collapsedPost) {
        const newHeight = computePostHeight(28, currentTilt);
        collapsedPost.style.height = `${newHeight}px`;
      }
      if (expandedPost) {
        const newHeight = computePostHeight(28, currentTilt);
        expandedPost.style.height = `${newHeight}px`;
      }

      // Show/hide wrappers
      const collapsedWrapper =
        container.querySelector<HTMLDivElement>(".collapsed-wrapper");
      const expandedWrapper =
        container.querySelector<HTMLDivElement>(".expanded-wrapper");
      if (collapsedWrapper && expandedWrapper) {
        collapsedWrapper.style.display = expanded ? "none" : "flex";
        expandedWrapper.style.display = expanded ? "flex" : "none";
      }

      // Show/hide pickup button if it exists
      const pickupBtn =
        container.querySelector<HTMLButtonElement>(".pickup-btn");
      if (pickupBtn) {
        pickupBtn.style.display = bookingStep === 2 ? "inline-block" : "none";
      }

      // Apply departure/arrival border color
      const isDeparture = station.id === departureStationId;
      const isArrival = station.id === arrivalStationId;
      const borderColor = isDeparture
        ? "#10A37F" // green for departure
        : isArrival
        ? "#276EF1" // blue for arrival
        : "#505156"; // fallback

      // Collapsed circle border
      const collapsedDiv =
        container.querySelector<HTMLDivElement>(".collapsed-view");
      if (collapsedDiv) {
        collapsedDiv.style.border = `2px solid ${borderColor}`;
      }
      // Expanded box border
      const expandedDiv =
        container.querySelector<HTMLDivElement>(".expanded-view");
      if (expandedDiv) {
        expandedDiv.style.border = `2px solid ${borderColor}`;
      }
    });
  }, [
    bookingStep,
    isStationSelected,
    departureStationId,
    arrivalStationId,
    computePostHeight,
  ]);

  /**
   * updateMarkerTilt
   * Called by GMap whenever `tilt_changed` fires to set the new tilt value
   */
  const updateMarkerTilt = useCallback(
    (newTilt: number) => {
      tiltRef.current = newTilt;
      // Let the consumer know if needed
      options?.onTiltChange?.(newTilt);
      refreshMarkers();
    },
    [options, refreshMarkers]
  );

  // Create markers once
  useEffect(() => {
    createMarkers();
  }, [createMarkers]);

  // Refresh expansions/appearance whenever step or selection changes
  useEffect(() => {
    if (markersCreatedRef.current) {
      refreshMarkers();
    }
  }, [bookingStep, departureStationId, arrivalStationId, refreshMarkers]);

  // Return markersRef (if you need it) and the tilt updater
  return {
    markersRef,
    updateMarkerTilt,
  };
}