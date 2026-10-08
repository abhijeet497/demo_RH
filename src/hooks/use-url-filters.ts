import { useCallback, useMemo } from "react"
import { useLocation, useSearchParams } from "react-router-dom"

// Standard URL-backed filter state. The URL is the single source of truth:
// values are derived from the current search params and setters write back with
// replace:true (so filter changes don't stack up as history entries), omitting
// default values to keep URLs clean. Filters therefore survive Back/refresh/share
// automatically, with no re-sync effects and no state/URL races.
//
// CAUTION: react-router resolves functional setSearchParams against the params of
// the current render, so two setter calls in the same event handler clobber each
// other. To change multiple keys in one event, make a single updateParams call.

export function useUrlFilterParams() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()

  // Filter changes replace by default. Pass { replace: false } for URL updates that
  // are view navigation (e.g. registry grid→detail), where Back should step back.
  // location.state is re-passed on every write: setSearchParams navigates, and a
  // navigation without state would null the history entry's state — wiping
  // backSearch the moment the user touches any filter/tab on the page.
  const updateParams = useCallback((updates: Record<string, string | null>, opts?: { replace?: boolean }) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      for (const [key, value] of Object.entries(updates)) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      return next
    }, { replace: opts?.replace ?? true, state: location.state })
  }, [setSearchParams, location.state])

  return { searchParams, updateParams }
}

// Single-value filter (Select, status tabs, search input). The default value is
// represented by the param's absence in the URL.
export function useUrlStringFilter(key: string, defaultValue = ""): [string, (value: string) => void] {
  const { searchParams, updateParams } = useUrlFilterParams()
  // || (not ??): a present-but-empty param (?status=) is a hand-edited URL, not a
  // state our setters produce — treat it as absent rather than a real "" value.
  const value = searchParams.get(key) || defaultValue

  const setValue = useCallback(
    (v: string) => updateParams({ [key]: !v || v === defaultValue ? null : v }),
    [key, defaultValue, updateParams]
  )

  return [value, setValue]
}

// Multi-value filter (MultiSelect), stored comma-separated. Empty selection is
// represented by the param's absence in the URL.
export function useUrlArrayFilter(key: string): [string[], (values: string[]) => void] {
  const { searchParams, updateParams } = useUrlFilterParams()
  const raw = searchParams.get(key)
  const value = useMemo(() => raw?.split(',').filter(Boolean) || [], [raw])

  const setValue = useCallback(
    (values: string[]) => updateParams({ [key]: values.join(',') || null }),
    [key, updateParams]
  )

  return [value, setValue]
}
