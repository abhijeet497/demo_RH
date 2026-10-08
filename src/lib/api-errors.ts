// Shared helpers for turning raw API error strings into user-facing messages.
// The Traceforce API client surfaces failures as `API returned <status>: <body>`,
// where the body is usually `{ "error": "..." }`.

import type { TraceforceApiResponse } from "@/integrations/traceforce/types"

/**
 * Turn a failed structured API response into something safe to put in a toast.
 *
 * The backend's errors follow { error: human text, code: MACHINE_CODE }; the
 * client surfaces them as res.message / res.code. A non-JSON body (a proxy 502,
 * an HTML 404 page) leaves both unset — fall back to the status, never the body.
 * Client-generated failures (timeout, network) arrive as res.error with NO
 * statusCode; those strings are written by the client itself, so show them.
 */
export function apiErrorText(res: TraceforceApiResponse<unknown>): string {
  if (res.message) return res.message
  switch (res.statusCode) {
    // Split remedies, aligned with friendlyLoadError below: an expired session
    // and a permissions failure need different next steps.
    case 401:
      return "Your session may have expired. Try refreshing the page."
    case 403:
      return "You don't have permission to do this."
    case 404:
      return "Endpoint not found (HTTP 404). Is the API deployment current?"
    case 500:
      return "The server returned an error (HTTP 500). Check the API logs."
    default:
      if (res.statusCode) return `Request failed (HTTP ${res.statusCode}).`
      return res.error || "Request failed."
  }
}

/**
 * Pull the human-readable message out of the API's error envelope. Falls back to
 * the raw string when the body isn't the expected `{ "error": "..." }` JSON.
 */
export function extractApiError(raw: string): string {
  // Trim first: fetch().text() bodies often carry a trailing newline, which would
  // otherwise defeat the `}$` anchor and leak the raw envelope to the UI.
  const match = raw.trim().match(/\{[\s\S]*\}$/)
  if (match) {
    try {
      const parsed = JSON.parse(match[0])
      if (parsed?.error) return parsed.error
    } catch {
      /* not JSON — fall through */
    }
  }
  return raw
}

/**
 * Turn a raw load error into a message safe to show in the UI. Maps the common
 * auth failures (401/403) to plain guidance and otherwise unwraps the server's
 * own message (extractApiError), so a view never surfaces a raw `{"error":…}` blob.
 */
export function friendlyLoadError(raw: string): string {
  const status = raw.match(/^API returned (\d+)/)?.[1]
  // Session refresh is handled by Supabase, and nothing here signs the user out,
  // so don't assert the session has definitely expired — suggest a refresh.
  if (status === "401") return "Your session may have expired. Try refreshing the page."
  if (status === "403") return "You don't have permission to view this."
  return extractApiError(raw)
}
