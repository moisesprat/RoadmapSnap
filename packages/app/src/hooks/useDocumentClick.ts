// Registers one document click listener for the lifetime of the component. The latest handler is kept in a ref,
// so a re-render with a new handler neither re-registers the listener nor calls a stale one. Lite adds its
// outside-click handlers once on DOMContentLoaded (js/app.js); this is the same lifetime in React.
import { useEffect, useRef } from 'react'

export function useDocumentClick(handler: (event: MouseEvent) => void): void {
  const latest = useRef(handler)
  latest.current = handler

  useEffect(() => {
    const listener = (event: MouseEvent) => latest.current(event)
    document.addEventListener('click', listener)
    return () => document.removeEventListener('click', listener)
  }, [])
}
