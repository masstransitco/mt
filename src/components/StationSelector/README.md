# StationSelector Component Architecture

## Overview

This is the refactored version of the StationSelector component using a container/presentational pattern to separate UI from business logic. The component allows users to select departure and arrival stations for a trip.

## Migration Status

✅ **COMPLETED**: The migration is now complete. GMap.tsx has been updated to use this implementation, and the old StationSelector.tsx has been moved to the deprecated directory with a placeholder for backward compatibility.

## Claude AI Integration

The StationSelector uses `StationClaudeAIInfoCardSimple` to provide AI-powered information about stations. This component is dynamically imported in the main container (`index.tsx`) to avoid unnecessary loading during server-side rendering.

**Current Implementation:**
- Only `StationClaudeAIInfoCardSimple` is actively used in the StationSelector
- The component is imported as `StationClaudeAIInfoCard` in `index.tsx` for clarity
- It provides station information including weather, traffic, dining, and more
- Supports multiple languages and has expandable view

**Note:** All previously unused Claude components (alternate implementations) have been removed from the codebase to avoid confusion and maintain a clean architecture.

## Architecture

### Container/Presentational Pattern

The implementation follows the container/presentational pattern:

- **Container Component** (`index.tsx`): 
  - Connects to Redux store
  - Handles state management
  - Provides data and callbacks to presentational components
  - No direct UI rendering

- **Presentational Components** (in `presentation/`):
  - Focus purely on UI rendering
  - Receive data through props/context
  - No direct Redux dependencies
  - Reusable and easily testable

### Directory Structure

```
/StationSelector/
├── index.tsx               # Container component with Redux & logic
├── constants.ts            # Theme constants and configuration
├── presentation/           # Pure UI components
│   ├── AddressSearch.tsx   # Search input with predictions
│   ├── MainContent.tsx     # Main layout component
│   ├── PredictionsDropdown.tsx # Search results dropdown
│   ├── StationIcon.tsx     # Unified station icon (departure/arrival)
│   └── StationInput.tsx    # Combined station input with icon & actions
├── hooks/                  # Custom hooks
│   ├── useGooglePlacesSearch.ts # Google Places integration
│   └── useStationActions.ts     # Station selection actions
└── context/                # Context provider
    └── StationSelectorContext.tsx # Shared context for component state
```

### Context System

- `StationSelectorContext` provides a centralized way to share state and theme information across components
- Eliminates prop drilling
- Allows components to access shared configuration

### Custom Hooks

- `useGooglePlacesSearch`: Encapsulates Google Places API integration
- `useStationActions`: Manages station selection logic with Redux

## Key Improvements

1. **Separation of Concerns**:
   - UI rendering is cleanly separated from business logic
   - Components have single responsibilities

2. **Reduced Redundancy**:
   - Unified station icon component replacing separate departure/arrival icons
   - Centralized theme constants
   - Shared context for common data

3. **Improved Maintainability**:
   - Smaller, focused components are easier to understand and modify
   - Clear interfaces between components
   - Consistent styling approach

4. **Better Performance**:
   - Optimized Redux selectors via `shallowEqual`
   - Strategic memoization with React.memo
   - Lazy loading of expensive components

5. **Enhanced Testability**:
   - Pure presentational components can be tested in isolation
   - Business logic in hooks can be unit tested

## Usage

```tsx
// In parent component (like GMap.tsx)
<StationSelector
  inSheet={false}
  currentStep={bookingStep}
  onAddressSearch={handleAddressSearch}
  onClearDeparture={handleClearDeparture}
  onClearArrival={handleClearArrival}
  isQrScanStation={isQrScanStation}
  virtualStationId={virtualStationId}
  scannedCar={scannedCar}
/>
```

## Future Improvements

- Add comprehensive unit tests for all components
- Implement keyboard navigation for accessibility
- Add internationalization support
- Add proper touch interaction optimizations for mobile