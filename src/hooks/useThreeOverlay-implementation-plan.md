# MeshPhong Material Consolidation Implementation Plan

## Impact Analysis

After reviewing the current implementation in `useThreeOverlay.ts`, I've determined that consolidating to MeshPhongMaterial will have **minimal disruption** to the existing render cycles, dependencies, and station selection functions.

### Non-Disruptive Elements

1. **Render Cycle**: The current render cycle is controlled by the dirty flag system and will continue to work the same way. Material changes happen during `onDraw`, which remains unchanged.

2. **Station Selection**: The raycasting system for station selection operates independently of material types - it works at the mesh/group level, so changing materials will not affect selection functionality.

3. **Redux Dependencies**: The hook's dependencies on Redux state (departureStationId, arrivalStationId, etc.) remain unchanged.

4. **Color Changes**: The existing pattern of updating material colors without reinitializing can be maintained.

### Minor Implementation Considerations

1. **Lighting**: MeshPhongMaterial responds more vividly to lighting than MeshLambertMaterial, so light intensities might need minor adjustments.

2. **GLB Model Materials**: When loading navigation cursor models, we need to traverse and replace their materials.

3. **Material Properties**: When removing the emissive breathing effect, we need an alternative visual indicator for step 3.

## Implementation Plan

### Phase 1: Material Factory and Constants (15 minutes)

1. Add a centralized material factory function at the top of the hook:

```typescript
// Consolidated material factory 
const createPhongMaterial = useCallback((color = 0xFFFFFF, opacity = 1.0) => {
  return new THREE.MeshPhongMaterial({
    color, 
    transparent: opacity < 1,
    opacity,
    shininess: 0, // No specular highlights
    side: THREE.FrontSide
  });
}, []);

// Create shared material instances for reuse to avoid memory allocation during render
const materialInstancesRef = useRef<{
  buildingDefault: THREE.MeshPhongMaterial | null;
  buildingSelected: THREE.MeshPhongMaterial | null;
  route: THREE.MeshPhongMaterial | null;
  cursor: THREE.MeshPhongMaterial | null;
  cursorInner: THREE.MeshPhongMaterial | null;
}>({
  buildingDefault: null,
  buildingSelected: null,
  route: null,
  cursor: null,
  cursorInner: null
});
```

2. Initialize the materials in the `onContextRestored` function:

```typescript
// Initialize shared materials
materialInstancesRef.current.buildingDefault = createPhongMaterial(BUILDING_DEFAULT_COLOR);
materialInstancesRef.current.buildingSelected = createPhongMaterial(BUILDING_SELECTED_COLOR);
materialInstancesRef.current.route = createPhongMaterial(ROUTE_TUBE_COLOR, 0.9);
materialInstancesRef.current.cursor = createPhongMaterial(0xFFFFFF, 0.8);
materialInstancesRef.current.cursorInner = createPhongMaterial(0xFFFFFF, 1.0);
```

### Phase 2: Update Building Creation (30 minutes)

1. Modify the `createExtrudedBuilding` function to use the shared materials:

```typescript
function createExtrudedBuilding(
  building: any,
  anchor: { lat: number; lng: number; altitude: number },
  index: number
): THREE.Group {
  // ... existing shape and geometry creation ...
  
  // Use shared material instance instead of creating new one
  const material = materialInstancesRef.current.buildingDefault;
  if (!material) return new THREE.Group(); // Safety check
  
  const buildingMesh = new THREE.Mesh(geometry, material);
  // ... rest remains unchanged ...
}
```

2. Update the building color assignment in `onDraw`:

```typescript
// Update building colors during onDraw
buildingGroupsRef.current.forEach((group) => {
  const stationId = group.userData.stationId;
  const mesh = group.children[0] as THREE.Mesh;
  
  // Switch the entire material reference instead of just changing color
  if (stationId === departureStationId || stationId === arrivalStationId) {
    mesh.material = materialInstancesRef.current.buildingSelected;
  } else {
    mesh.material = materialInstancesRef.current.buildingDefault;
  }
});
```

### Phase 3: Update Cursors and Route (30 minutes)

1. Update user location cursor creation:

```typescript
// Create an extruded circle (cylinder with minimal height)
const circleGeometry = new THREE.CylinderGeometry(15, 15, 2, 32);
const circle = new THREE.Mesh(circleGeometry, materialInstancesRef.current.cursor);

// Create a smaller inner circle for contrast
const innerCircleGeometry = new THREE.CylinderGeometry(5, 5, 3, 32);
const innerCircle = new THREE.Mesh(innerCircleGeometry, materialInstancesRef.current.cursorInner);
```

2. Update the route tube material:

```typescript
if (!tubeMaterialRef.current) {
  tubeMaterialRef.current = materialInstancesRef.current.route;
}
```

3. Replace the navigation cursor material after loading:

```typescript
loadModel('/map/cursor_navigation.glb', (originalModel) => {
  // ... existing setup ...
  
  // Replace materials with MeshPhong 
  originalModel.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      // Create a new material for this part of the model
      const newMaterial = createPhongMaterial(0xFFFFFF);
      newMaterial.side = THREE.DoubleSide;
      child.material = newMaterial;
    }
  });
  
  // ... rest remains unchanged ...
});
```

### Phase 4: Replace Breathing Animation (15 minutes)

Since we're removing the emissive breathing effect, implement a simple alternative for step 3:

```typescript
// Replace emissive breathing with scale animation
if (bookingStep === 3 && navigationCursorRef.current?.visible) {
  const elapsed = clockRef.current.getElapsedTime();
  const speed = 1.5;
  const animationTime = elapsed * speed;
  const scaleFactor = 1.0 + 0.05 * Math.sin(animationTime);
  
  // Apply gentle scale pulsing instead of emissive effect
  navigationCursorRef.current.scale.set(
    50 * scaleFactor, 
    50 * scaleFactor, 
    50 * scaleFactor
  );
  markNeedsRedraw();
}
```

### Phase 5: Cleanup and Material Disposal (15 minutes)

Update the material disposal in `onRemove` function:

```typescript
// In onRemove
// Dispose of all materials from our material instances ref
Object.values(materialInstancesRef.current).forEach(material => {
  if (material) material.dispose();
});

// Reset all material references
materialInstancesRef.current = {
  buildingDefault: null,
  buildingSelected: null,
  route: null,
  cursor: null,
  cursorInner: null
};
```

### Phase 6: Testing and Adjustment Plan (1-2 hours)

1. **Basic Functionality Testing**:
   - Test station selection via clicking 3D buildings
   - Verify color changes work correctly for selected stations
   - Confirm route tube renders properly

2. **Visual Quality Check**:
   - Assess building appearance with MeshPhongMaterial
   - Adjust lighting if buildings appear too shiny
   - Verify cursor visibility against map background

3. **Performance Testing**:
   - Monitor frame rate before and after changes
   - Check memory usage via Chrome DevTools
   - Verify reduced draw calls via WebGL inspector

4. **Mobile Testing**:
   - Test on lower-powered devices
   - Ensure smooth performance on various mobile GPUs
   - Validate touch interaction still works correctly

### Phase 7: Fallback Plan

In case of unexpected issues:

1. Implement a feature flag to toggle between the new consolidated materials and the original implementation
2. Create a version that keeps MeshLambertMaterial for buildings but consolidates the other materials
3. Have a backup of the original material creation code ready to revert if needed

## Integration Risk Assessment

| Component | Risk Level | Mitigation |
|-----------|------------|------------|
| Building color changes | Low | Material switching replaces color copying, but works similarly |
| Route tube | Low | Simple material replacement, same color/opacity |
| User location cursor | Low | Same geometry, just different material type |
| Navigation cursor | Medium | Requires replacing GLB materials and animation approach |
| Selection raycasting | Very Low | Independent of material types |
| Overall render cycle | Low | Same dirty flag system continues to work |

## Timeline

- **Total Implementation Time**: Approximately 2-3 hours plus testing
- **Best Time to Implement**: During a development cycle, not immediately before release
- **Staged Approach**: Can be implemented in parts, starting with buildings, then route, then cursors

## Conclusion

This material consolidation is a safe optimization with low risk to existing functionality. The core render cycle and selection mechanism will remain intact, while providing performance benefits and code simplification. The most significant change is replacing the emissive breathing effect with a scale animation, but this should maintain the same visual cue for users.