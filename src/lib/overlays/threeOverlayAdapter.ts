import * as THREE from 'three';
import { MapOverlay } from '@/lib/mapOverlayManager';
import type { StationFeature } from '@/store/stationsSlice';
import threeResourceManager from '@/lib/threeResourceManager';
import { latLngAltToVector3 } from "@/lib/geo-utils";

/**
 * Interface for Three.js overlay configuration
 */
export interface ThreeOptions {
  /**
   * Callback when a 3D station is selected
   */
  onStationSelected?: (stationId: number) => void;
  
  /**
   * Whether to show the route tube
   */
  showRouteTube?: boolean;
  
  /**
   * Custom color for selected buildings
   */
  selectedColor?: THREE.Color;
  
  /**
   * Custom color for unselected buildings
   */
  defaultColor?: THREE.Color;
  
  /**
   * Whether to show navigation cursor
   */
  showNavigationCursor?: boolean;
}

/**
 * Create a Three.js overlay adapter that implements the MapOverlay interface
 * @param options Options for the Three.js overlay
 * @returns MapOverlay implementation for Three.js
 */
export function createThreeOverlay(options: ThreeOptions): MapOverlay {
  // Default colors
  const BUILDING_DEFAULT_COLOR = new THREE.Color(0x888888); // Gray
  const BUILDING_SELECTED_COLOR = new THREE.Color(0xffffff); // White
  
  // Private state for the overlay
  let overlayView: google.maps.WebGLOverlayView | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let buildings: THREE.Group[] = [];
  let routeTube: THREE.Mesh | null = null;
  let navCursor: THREE.Group | null = null;
  let userCursor: THREE.Group | null = null;
  let raycaster: THREE.Raycaster | null = null;
  let mapInstance: google.maps.Map | null = null;
  
  // Anchor point for coordinate transformations
  const anchor = { lat: 0, lng: 0, altitude: 0 };
  
  // Overlay options
  let customOptions: ThreeOptions = {
    ...options,
    selectedColor: options.selectedColor || BUILDING_SELECTED_COLOR,
    defaultColor: options.defaultColor || BUILDING_DEFAULT_COLOR
  };
  
  // Event handler cleanup function
  let removeListeners: () => void = () => {};
  
  /**
   * Create the WebGL overlay instance
   */
  function createOverlay(map: google.maps.Map): google.maps.WebGLOverlayView {
    const overlay = new google.maps.WebGLOverlayView();
    
    // Set up the overlay callback functions
    overlay.onAdd = () => {
      console.log('[ThreeOverlayAdapter] onAdd');
      
      // Create the scene
      scene = new THREE.Scene();
      
      // Create the camera
      camera = new THREE.PerspectiveCamera();
      camera.far = 100000;
      camera.updateProjectionMatrix();
      
      // Initialize the anchor point
      const center = map.getCenter();
      if (center) {
        anchor.lat = center.lat();
        anchor.lng = center.lng();
        anchor.altitude = 0;
      }
      
      // Set up scene
      initializeScene();
    };
    
    overlay.onContextRestored = ({ gl }) => {
      console.log('[ThreeOverlayAdapter] onContextRestored');
      
      if (!scene || !camera) return;
      
      // Set up the renderer
      renderer = new THREE.WebGLRenderer({
        canvas: gl.canvas as HTMLCanvasElement,
        context: gl,
        ...gl.getContextAttributes(),
      });
      renderer.autoClear = false;
      
      // Set up basic lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
      scene.add(ambientLight);
      
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
      directionalLight.position.set(50, 100, 200);
      scene.add(directionalLight);
      
      // Set up raycasting for picking
      raycaster = new THREE.Raycaster();
      
      // Set up picking interactions
      const canvas = gl.canvas as HTMLCanvasElement;
      canvas.style.zIndex = "50";
      canvas.style.position = "absolute";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.pointerEvents = "auto";
      
      // Set up event listener for picking
      const handlePointerDown = (ev: PointerEvent) => {
        if (!customOptions.onStationSelected) return;
        
        // Implementation of picking would go here
        console.log('Picked a building');
        
        // Find the station ID and call onStationSelected
        // customOptions.onStationSelected(stationId);
      };
      
      // Add the event listener
      canvas.addEventListener("pointerdown", handlePointerDown);
      
      // Set up the removal function
      removeListeners = () => {
        canvas.removeEventListener("pointerdown", handlePointerDown);
      };
    };
    
    overlay.onDraw = ({ gl, transformer }) => {
      if (!scene || !camera || !renderer) return;
      
      // Update camera projection
      const camMatArr = transformer.fromLatLngAltitude({
        lat: anchor.lat,
        lng: anchor.lng,
        altitude: anchor.altitude,
      });
      camera.projectionMatrix.fromArray(camMatArr);
      
      // Update building colors based on selection state
      updateBuildingColors();
      
      // Update cursor positions
      updateCursors();
      
      // Render the scene
      renderer.setViewport(0, 0, gl.canvas.width, gl.canvas.height);
      renderer.render(scene, camera);
      renderer.resetState();
    };
    
    overlay.onContextLost = () => {
      console.log('[ThreeOverlayAdapter] onContextLost');
      
      if (renderer) {
        renderer.dispose();
        renderer = null;
      }
    };
    
    overlay.onRemove = () => {
      console.log('[ThreeOverlayAdapter] onRemove');
      
      // Remove event listeners
      removeListeners();
      
      // Clean up Three.js resources
      cleanupThreeResources();
      
      // Clear references
      scene = null;
      camera = null;
      renderer = null;
      raycaster = null;
      buildings = [];
      routeTube = null;
      navCursor = null;
      userCursor = null;
    };
    
    return overlay;
  }
  
  /**
   * Initialize the scene with buildings, cursors, etc.
   */
  function initializeScene() {
    if (!scene) return;
    
    // Create the user cursor (simple cylinder)
    createUserCursor();
    
    // Load the navigation cursor model
    loadNavigationCursor();
    
    // Load and create buildings
    // This would typically use building data from Redux or props
    
    console.log('[ThreeOverlayAdapter] Scene initialized');
  }
  
  /**
   * Create a simple user location cursor
   */
  function createUserCursor() {
    if (!scene) return;
    
    // Create a group to hold the cursor
    const cursorGroup = new THREE.Group();
    
    // Create an extruded circle (cylinder with minimal height)
    const circleGeometry = threeResourceManager.getGeometry('user-cursor-circle', () => 
      new THREE.CylinderGeometry(15, 15, 2, 32)
    );
    
    const circleMaterial = threeResourceManager.getMaterial('user-cursor-circle', () => 
      new THREE.MeshBasicMaterial({ 
        color: 0xFFFFFF,  // White color
        transparent: true,
        opacity: 0.8
      })
    );
    
    const circle = new THREE.Mesh(circleGeometry, circleMaterial);
    
    // Create a smaller inner circle for contrast
    const innerCircleGeometry = threeResourceManager.getGeometry('user-cursor-inner', () => 
      new THREE.CylinderGeometry(5, 5, 3, 32)
    );
    
    const innerCircleMaterial = threeResourceManager.getMaterial('user-cursor-inner', () => 
      new THREE.MeshBasicMaterial({ 
        color: 0xFFFFFF,  // Also white
        transparent: true,
        opacity: 1.0
      })
    );
    
    const innerCircle = new THREE.Mesh(innerCircleGeometry, innerCircleMaterial);
    innerCircle.position.set(0, 0, 1); // Slightly above the main circle
    
    // Add circles to the group
    cursorGroup.add(circle);
    cursorGroup.add(innerCircle);
    
    // Initial position and visibility
    cursorGroup.visible = false;
    cursorGroup.rotation.set(Math.PI/2, 0, 0); // Align with ground
    
    // Add to scene
    scene.add(cursorGroup);
    userCursor = cursorGroup;
  }
  
  /**
   * Load the navigation cursor model
   */
  function loadNavigationCursor() {
    // Would load the cursor model using GLTFLoader
    // Simplified for now
    console.log('[ThreeOverlayAdapter] Navigation cursor loaded');
  }
  
  /**
   * Update building colors based on selection state
   */
  function updateBuildingColors() {
    // For each building, update its color based on selection state
    // This would use data from Redux to determine selection
    
    buildings.forEach(building => {
      const mesh = building.children[0] as THREE.Mesh;
      const material = mesh.material as THREE.MeshBasicMaterial;
      
      // Check if this building is selected
      const isSelected = false; // Would check against departureStationId, arrivalStationId
      
      // Update color
      if (isSelected) {
        material.color.copy(customOptions.selectedColor || BUILDING_SELECTED_COLOR);
      } else {
        material.color.copy(customOptions.defaultColor || BUILDING_DEFAULT_COLOR);
      }
    });
  }
  
  /**
   * Update cursor positions based on user location and route
   */
  function updateCursors() {
    // Update user cursor position based on user location
    // Update navigation cursor for route animation
    
    // Simplified for now
    console.log('[ThreeOverlayAdapter] Cursor positions updated');
  }
  
  /**
   * Clean up Three.js resources
   */
  function cleanupThreeResources() {
    if (!scene) return;
    
    // Clean up buildings
    buildings.forEach(group => {
      scene?.remove(group);
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) {
            threeResourceManager.releaseGeometry('building-geometry');
          }
          
          if (Array.isArray(child.material)) {
            child.material.forEach((material, index) => {
              threeResourceManager.releaseMaterial(`building-material-${index}`);
            });
          } else if (child.material) {
            threeResourceManager.releaseMaterial('building-material');
          }
        }
      });
    });
    
    // Clean up cursors
    if (userCursor) {
      scene.remove(userCursor);
      userCursor.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) {
            // Release geometry - would use specific key names
            threeResourceManager.releaseGeometry('user-cursor-circle');
            threeResourceManager.releaseGeometry('user-cursor-inner');
          }
          
          if (child.material) {
            // Release material - would use specific key names
            threeResourceManager.releaseMaterial('user-cursor-circle');
            threeResourceManager.releaseMaterial('user-cursor-inner');
          }
        }
      });
      userCursor = null;
    }
    
    // Clean up navigation cursor
    if (navCursor) {
      scene.remove(navCursor);
      // Would release resources
      navCursor = null;
    }
    
    // Clean up route tube
    if (routeTube) {
      scene.remove(routeTube);
      // Would release resources
      routeTube = null;
    }
    
    buildings = [];
  }
  
  /**
   * The MapOverlay implementation
   */
  return {
    type: 'three',
    
    initialize(map: google.maps.Map) {
      console.log('[ThreeOverlayAdapter] Initializing with map');
      mapInstance = map;
      
      // Create and initialize the overlay
      overlayView = createOverlay(map);
      overlayView.setMap(map);
    },
    
    update(newOptions: ThreeOptions) {
      console.log('[ThreeOverlayAdapter] Updating with new options');
      
      // Update options
      customOptions = {
        ...customOptions,
        ...newOptions
      };
      
      // Update scene based on new options
      if (scene) {
        // Update route tube visibility
        if (routeTube) {
          routeTube.visible = !!customOptions.showRouteTube;
        }
        
        // Update navigation cursor visibility
        if (navCursor) {
          navCursor.visible = !!customOptions.showNavigationCursor;
        }
        
        // Update building colors
        updateBuildingColors();
      }
    },
    
    setVisible(visible: boolean) {
      console.log(`[ThreeOverlayAdapter] Setting visibility: ${visible}`);
      
      // Toggle visibility of entire scene
      if (scene) {
        scene.visible = visible;
      }
      
      // Force a redraw to apply the change
      overlayView?.requestRedraw();
    },
    
    dispose() {
      console.log('[ThreeOverlayAdapter] Disposing');
      
      // Set map to null to trigger onRemove
      if (overlayView) {
        overlayView.setMap(null);
      }
      
      // Clean up references
      overlayView = null;
      mapInstance = null;
    }
  };
}