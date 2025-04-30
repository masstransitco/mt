# useThreeOverlay Hook Implementation

## Overview

The `useThreeOverlay` hook integrates Three.js with Google Maps to create 3D building visualizations, interactive stations, and route animations. It uses Google Maps' WebGLOverlayView to render custom Three.js scenes on the map.

## Material Optimization: Consolidation to MeshPhong

### Current Implementation

The implementation currently uses multiple material types:
- `MeshLambertMaterial` for buildings
- `MeshBasicMaterial` for route tubes and user location cursor
- Custom materials from imported GLB models

### Proposed Optimization: MeshPhongMaterial

Consolidate to a single `MeshPhongMaterial` type across all elements while preserving the current color scheme:

```typescript
// Consolidated material factory function
const createPhongMaterial = (color = 0xFFFFFF, opacity = 1.0) => {
  return new THREE.MeshPhongMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    shininess: 0, // No specular highlights for map elements
    side: THREE.FrontSide
  });
};

// Create instances with current color scheme
const buildingMaterial = createPhongMaterial(BUILDING_DEFAULT_COLOR);         // Gray (0x888888)
const selectedBuildingMaterial = createPhongMaterial(BUILDING_SELECTED_COLOR); // White (0xFFFFFF)
const routeMaterial = createPhongMaterial(ROUTE_TUBE_COLOR, 0.9);             // White with opacity
```

### Key Benefits

1. **Performance Improvements**:
   - Fewer shader program switches during rendering
   - More efficient GPU resource utilization
   - Reduced draw calls through material sharing

2. **Code Simplification**:
   - Single material type across all elements
   - Consistent material property handling
   - Centralized material creation

3. **Preserved Visual Quality**:
   - `MeshPhongMaterial` provides better lighting quality than `MeshLambertMaterial`
   - Maintains current color scheme (gray buildings, white selected buildings, white route)
   - Can adjust shininess to control reflectivity

### Implementation Notes

1. **Color Preservation**:
   - Keep `BUILDING_DEFAULT_COLOR` (0x888888)
   - Keep `BUILDING_SELECTED_COLOR` (0xFFFFFF)
   - Keep `ROUTE_TUBE_COLOR` (0xFFFFFF)

2. **Removed Effects**:
   - Remove emissive "breathing" effect from navigation cursor
   - Replace with simple material color changes if needed

3. **Lighting Adjustments**:
   - Keep current lighting setup as `MeshPhongMaterial` benefits from good lighting
   - Ambient Light: `THREE.AmbientLight(0xFFFFFF, 0.8)`
   - Directional Light: `THREE.DirectionalLight(0xFFFFFF, 0.5)`

## Current Rendering Architecture

### Initialization Flow

1. `onAdd`: Initial scene setup, creating 3D buildings
2. `onContextRestored`: Renderer setup, lighting, and model loading
3. `onDraw`: Per-frame rendering with state updates
4. `onContextLost`: Clean up WebGL context
5. `onRemove`: Full cleanup of Three.js resources

### Key Optimizations

The hook implements several optimizations:

1. **Dirty Flag System**: Only schedules redraws when needed
   ```typescript
   const markNeedsRedraw = useCallback(() => {
     dirtyRef.current = true;
   }, []);
   ```

2. **Material Color Updates**: Done in `onDraw` without reinitializing
   ```typescript
   // Updates material colors based on selection state
   if (stationId === departureStationId || stationId === arrivalStationId) {
     mat.color.copy(BUILDING_SELECTED_COLOR);
   } else {
     mat.color.copy(BUILDING_DEFAULT_COLOR);
   }
   ```

3. **Model Caching**: Reuses loaded models
   ```typescript
   // Store in cache
   modelCache.set(url, model.clone());
   ```

4. **Throttled Redraws**: Limits redraw frequency
   ```typescript
   if (now - lastRedrawTimeRef.current < MIN_REDRAW_INTERVAL) return;
   ```

## Current Materials, Colors, and Lighting

### Building Materials

Buildings use `MeshLambertMaterial` with different colors based on selection state:

1. **Default State**:
   - Color: `0x888888` (darker gray for better contrast)
   - Material: `THREE.MeshLambertMaterial`
   - Properties: `{ color: BUILDING_DEFAULT_COLOR, side: THREE.FrontSide }`

2. **Selected State** (departure or arrival station):
   - Color: `0xFFFFFF` (pure white)
   - Material: Same `MeshLambertMaterial` with color changed
   - No reinitializing of material, only color property is updated

### Cursor Geometries

1. **User Location Cursor**:
   - Primary Geometry: `THREE.CylinderGeometry(15, 15, 2, 32)` (extruded circle)
   - Material: `THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.8 })`
   - Inner Circle: Smaller cylinder with `(5, 5, 3, 32)` dimensions
   - Inner Material: `THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 1.0 })`
   - Position: Set slightly above ground (z=10)
   - Alignment: Rotated 90° on X-axis to align with ground plane

2. **Navigation Cursor** (booking step 3 & 4):
   - Model: Loaded from '/map/cursor_navigation.glb'
   - Scale: 50x normal size
   - Rotation: Aligned using quaternion transformation
   - Materials: Set to `THREE.DoubleSide` to ensure visibility from all angles
   - Animation (step 3): Subtle "breathing" effect via emissiveIntensity (to be removed)
   - Animation (step 4): Moves along route path using `CatmullRomCurve3`

### Route Visualization

- Geometry: `THREE.TubeGeometry` following path points
- Material: `THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.9, side: THREE.FrontSide })`
- Dimensions: 5 unit radius, adaptive segment count based on route length
- Position: Kept slightly above ground (z=10)

### Lighting Setup

The scene uses two light sources:

1. **Ambient Light**:
   - Type: `THREE.AmbientLight`
   - Color: `0xFFFFFF` (white)
   - Intensity: 0.8
   - Purpose: Provides base illumination so all objects have minimum visibility

2. **Directional Light**:
   - Type: `THREE.DirectionalLight`
   - Color: `0xFFFFFF` (white)
   - Intensity: 0.5
   - Position: `(50, 100, 200)` (top-right oriented)
   - Purpose: Creates directional shading for 3D effect on buildings

## Station Selection

Selection is handled through raycasting:

1. Pointer events are captured on the WebGL canvas
2. Raycaster determines which building was clicked
3. The station ID is extracted from building userData
4. Station selection is delegated to the StationSelectionManager
5. Material colors update on next draw cycle without reinitialization

## Material Color Changes

Material colors change dynamically without requiring reinitialization:

1. Redux state changes (departureStationId or arrivalStationId)
2. `markNeedsRedraw()` is called via useEffect dependency tracking
3. Next `onDraw` call updates material colors based on current state
4. Scene is rendered with new colors

## Conclusion

Consolidating to a single `MeshPhongMaterial` type while maintaining the current color scheme would improve performance and reduce code complexity without sacrificing visual quality. This optimization preserves the important visual distinctions (gray buildings, white selected buildings, white route) while streamlining the rendering pipeline.