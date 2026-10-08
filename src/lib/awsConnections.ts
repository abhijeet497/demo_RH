import { formatDistance } from "date-fns"

/**
 * Connected AWS accounts (cloud_connections), as the API lists them.
 *
 * One connection per AWS account. The collector Lambda syncs each one hourly and
 * records the result in `status` / `lastError`.
 */

export interface AwsConnection {
  id: string
  accountId: string
  roleArn: string | null
  /** Optional display name chosen when connecting. */
  name: string | null
  regions: string[]
  /** proto IntegrationStatus: 1 pending, 2 connected, 3 disconnected (last sync failed). */
  status: number
  errorCode: string | null
  lastError: string | null
  lastSyncedAt: string | null
  createdAt: string
}

export type AwsConnectionState = "pending" | "connected" | "failed"

/** Unknown status values read as pending: the next sync settles them. */
export function connectionState(status: number): AwsConnectionState {
  if (status === 2) return "connected"
  if (status === 3) return "failed"
  return "pending"
}

/** Card title: the name chosen when connecting, else the account ID. */
export const connectionTitle = (c: Pick<AwsConnection, "name" | "accountId">): string =>
  c.name?.trim() || c.accountId

export const MAX_CONNECTION_NAME_LENGTH = 64

/** The card's sync line. Never throws on a malformed time: that would crash Settings. */
export function syncedText(c: Pick<AwsConnection, "status" | "lastSyncedAt">, now: number = Date.now()): string {
  if (connectionState(c.status) === "pending") return "Waiting for the first sync. This runs hourly."
  const at = c.lastSyncedAt ? Date.parse(c.lastSyncedAt) : NaN
  if (!Number.isFinite(at)) return "Not synced yet"
  return `Last synced ${formatDistance(at, now, { addSuffix: true })}`
}
