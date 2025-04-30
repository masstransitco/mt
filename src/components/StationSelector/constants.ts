// Station selector theme constants

// Station colors
export const STATION_COLORS = {
  DEPARTURE: "#FFFFFF", // Changed from blue to white
  ARRIVAL: "#3E6AE1",   // Changed from red to blue
  QR_SCAN: "#10A37F"    // Green for QR scan remains unchanged
};

// Size variations based on context
export const CONTEXT_SIZES = {
  SHEET: {
    ICON: "w-4 h-4",
    DOT: "w-1.5 h-1.5",
    CONTAINER_HEIGHT: "h-11",
    CONTAINER_PADDING: "px-3 py-1.5",
    BUTTON_PADDING: "p-1",
    INFO_MARGIN: "mt-1"
  },
  MAP: {
    ICON: "w-4 h-4",
    DOT: "w-1.5 h-1.5",
    CONTAINER_HEIGHT: "h-12",
    CONTAINER_PADDING: "px-3 py-2",
    BUTTON_PADDING: "p-1",
    INFO_MARGIN: "mt-2"
  }
};

// Container style
export const CONTAINER_STYLE = {
  backgroundColor: "rgba(0, 0, 0, 0.9)" // Ultra-black background for both containers
};