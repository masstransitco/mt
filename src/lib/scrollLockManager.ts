// scrollLockManager.ts

let openSheetsCount = 0;

export function incrementOpenSheets() {
  openSheetsCount++;
  updateBodyScroll();
}

export function decrementOpenSheets() {
  if (openSheetsCount > 0) {
    openSheetsCount--;
    updateBodyScroll();
  }
}

function updateBodyScroll() {
  if (openSheetsCount > 0) {
    // Lock scroll
    document.body.style.overflow = "hidden";

    // iOS-specific fix: prevent bounce
    document.body.addEventListener("touchmove", preventBodyScroll, { passive: false });
  } else {
    // Revert scroll
    document.body.style.overflow = "";

    // Remove iOS-specific listener
    document.body.removeEventListener("touchmove", preventBodyScroll);
  }
}

function preventBodyScroll(e: TouchEvent) {
  // We only want to prevent scrolling if the touch is outside
  // your bottom sheet area. If your sheet has its own scrollable
  // region, you may allow scrolling inside it.
  //
  // For a trivial approach, just always prevent:
  e.preventDefault();
}
