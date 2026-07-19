import { useState, useEffect } from 'react'

/**
 * Returns a debounced version of the input value.
 * The returned value only updates after `delay` ms of no changes.
 *
 * @param {any} value - the value to debounce (e.g. raw search input)
 * @param {number} delay - debounce delay in ms (default 300)
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}