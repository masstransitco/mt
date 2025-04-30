import { useEffect, useState } from 'react';
import debounce from 'lodash.debounce';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Create a debounced function that updates state
    const debouncedSetValue = debounce((newValue: T) => {
      setDebouncedValue(newValue);
    }, delay);

    // Call it immediately with current value
    debouncedSetValue(value);

    // Clean up the debounced function on unmount or when value/delay changes
    return () => {
      debouncedSetValue.cancel();
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
