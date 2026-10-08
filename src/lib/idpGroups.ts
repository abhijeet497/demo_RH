// The public API speaks the provider string vocabulary ("okta", "jumpcloud",
// …), while the UI's badge/label helpers are keyed on the UserGroupSource
// enum ints — this is the bridge. Unmapped strings (a provider newer than
// this build) fall back to 0, which renders as "Unknown", the same graceful
// fallback used everywhere else.
export const USER_GROUP_SOURCE_ENUM_BY_STRING: Record<string, number> = {
  traceforce: 1,
  okta: 2,
  entra: 3,
  onelogin: 4,
  gsuite: 5,
  cyberark: 6,
  jumpcloud: 7,
  pingfederate: 8,
  rippling: 9,
  sailpoint: 10,
}

export const userGroupSourceEnumFromString = (source: string | null): number =>
  USER_GROUP_SOURCE_ENUM_BY_STRING[source ?? ""] ?? 0
