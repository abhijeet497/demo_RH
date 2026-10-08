import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** "Jul 1, 2026" — full date, null-safe (renders "—" for missing values). */
export const formatDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—"

/** "Jul 1" — compact month/day, null-safe (renders "—" for missing values). */
export const formatDateShort = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"

export const transformMcpName = (name: string): string => {
  const githubPattern = /^(.+?)\s+\(https:\/\/github\.com\/([^/]+)\//
  const match = name.match(githubPattern)
  
  if (match) {
    const [, displayName, owner] = match
    return `${displayName} (${owner})`
  }
  
  return name
}
