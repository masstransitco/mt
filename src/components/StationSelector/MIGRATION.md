# StationSelector Migration Guide

This document outlines how to migrate from the original monolithic StationSelector component to the new container/presentational architecture.

## Migration Status

✅ **Completed**: The container/presentational pattern has been implemented with all required functionality.

## Changes Made

1. **Directory Structure Created**
   - Organized component into focused subdirectories:
     - `/context` - Context provider for shared state
     - `/hooks` - Custom hooks for logic
     - `/presentation` - Pure UI components
     - `/constants.ts` - Shared theme constants

2. **Component Separation**
   - **Container** (`index.tsx`): Handles Redux and state management
   - **Presentation Components**:
     - `MainContent.tsx`: Main layout component
     - `StationInput.tsx`: Unified station input for departure/arrival
     - `StationIcon.tsx`: Icon component for both station types
     - `AddressSearch.tsx`: Search input component
     - `PredictionsDropdown.tsx`: Search results dropdown
     - `InfoBar.tsx`: Distance and time indicators

3. **Refined State Management**
   - Centralized StationSelectionManager access
   - Utilized React Context for prop sharing
   - Optimized Redux selectors with shallowEqual

4. **Added Enhanced Features**
   - QR scanning button properly integrated
   - Virtual station handling improved
   - Added proper accessibility attributes

## How to Use the New Component

The API remains fully backward compatible. You can use the component exactly as before:

```tsx
<StationSelector
  onAddressSearch={handleAddressSearch}
  onClearDeparture={handleClearDeparture}
  onClearArrival={handleClearArrival}
  onScan={handleOpenQrScanner}
  isQrScanStation={isQrScanStation}
  virtualStationId={virtualStationId}
  scannedCar={scannedCar}
  animateToLocation={cameraControls?.animateToLocation}
  inSheet={inSheet}
  currentStep={bookingStep}
/>
```

## Complete Migration Steps

### Step 1: Replace the Original File

Once testing is complete, rename the original file and update imports:

```bash
# Rename original file to keep as backup temporarily
mv /path/to/StationSelector.tsx /path/to/StationSelector.tsx.bak

# Ensure all imports reference the new component
# The import path remains the same since we're using index.tsx
```

### Step 2: Test Thoroughly

Test in different contexts:
1. In GMap (in the top bar)
2. In sheet (in the bottom drawer)
3. With all booking steps (1-4)
4. With QR scanning
5. With address search

### Step 3: Verify Functionality

Ensure all features work correctly:
- Station selection via map, list, and search
- QR scanning
- Departure/arrival clearing
- Proper styling in different contexts
- Consistent animations and transitions

## Benefits of the New Architecture

1. **Improved Maintainability**
   - Components are focused and single-purpose
   - Logic is separated from presentation
   - Theme constants are centralized

2. **Better Performance**
   - Optimized Redux usage with shallowEqual
   - Strategic React.memo usage
   - Reduced re-renders with proper dependencies

3. **Enhanced Testability**
   - Pure UI components can be tested in isolation
   - Hooks can be unit tested separately
   - Clear boundaries between presentation and logic

## Troubleshooting

### Missing QR Scan Button

If the QR scan button isn't appearing:
- Ensure `onScan` prop is passed to StationSelector
- Check that the component is in step 1 or 2
- Verify the component is showing a departure input

### Style Inconsistencies

If styling differs from the original component:
- Check the `inSheet` prop is correctly passed
- Verify theme constants match the original design
- Ensure all styles are properly applied via the theme context

### Redux Updates Not Working

If Redux state updates aren't working:
- Verify StationSelectionManager is being accessed properly
- Check that the component is receiving the expected props
- Ensure the Redux store is properly connected

## Future Improvements

1. Add comprehensive unit tests for all components
2. Implement keyboard navigation for better accessibility
3. Add internationalization support
4. Optimize for touch interactions on mobile
5. Implement performance monitoring