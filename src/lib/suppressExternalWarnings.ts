/**
 * suppressExternalWarnings.ts
 * 
 * Utility to suppress specific external warnings from third-party libraries.
 */

/**
 * Suppress specific Google Maps API warnings that are repetitive and not actionable.
 */
export function suppressGoogleMapsWarnings(): void {
  const originalWarn = console.warn;
  console.warn = function(...args) {
    // Filter out specific Google Maps warnings
    if (typeof args[0] === 'string' && 
        args[0].includes('AutocompleteService is not available')) {
      return;
    }
    originalWarn.apply(console, args);
  };
}

/**
 * Initialize all warning suppressions
 */
export function initWarningSuppressions(): void {
  suppressGoogleMapsWarnings();
}