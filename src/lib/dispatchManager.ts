// src/lib/dispatchManager.ts

import { selectAvailableForDispatch } from "@/store/carSlice";
import { useAppSelector } from "@/store/store";

/**
 * This hook returns whatever cars were marked available by the admin (in DispatchAdmin).
 * There's no automatic filtering by radius. 
 * The radius is just a reference tool in DispatchAdmin.
 */
export function useAvailableCarsForDispatch() {
  return useAppSelector(selectAvailableForDispatch);
}
