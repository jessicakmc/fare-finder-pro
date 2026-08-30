import { useEffect } from "react";

/**
 * Sets document.title for the lifetime of the calling page.
 * Replaces the per-route `head()` metadata TanStack Router provided during SSR —
 * in a static SPA there's no server render, so per-route <title> is set on mount instead.
 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
