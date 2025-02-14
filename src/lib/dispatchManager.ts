import { selectAllCars } from "@/store/carSlice";
import { selectAllDispatchLocations } from "@/store/dispatchSlice";
import { useAppSelector } from "@/store/store";
import { useMemo } from "react";

const RADIUS_METERS = 150;

export function useAvailableCarsForDispatch() {
  const cars = useAppSelector(selectAllCars);
  const dispatchLocations = useAppSelector(selectAllDispatchLocations);

  const availableCars = useMemo(() => {
    return cars.filter((car) => {
      return dispatchLocations.some((dispatch) => {
        const distance = calculateDistance(car.lat, car.lng, dispatch.lat, dispatch.lng);
        return distance <= RADIUS_METERS;
      });
    });
  }, [cars, dispatchLocations]);

  return availableCars;
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (val: number) => (val * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
