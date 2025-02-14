// src/lib/scrollLockManager.ts

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
    document.body.style.overflow = "hidden";
  } else {
    document.body.style.overflow = "";
  }
}
