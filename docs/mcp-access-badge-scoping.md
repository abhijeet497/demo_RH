# MCP Access — inventory badge scoping (design notes, ENG-519)

How the **Access** column on the MCP inventory resolves and aggregates, once the
`get_mcp_access_status` resolver lands. These are the agreed semantics; capture
here so the resolver-consumer (McpsTable Access column) is built to match.

## Core rule — effective access for one MCP + one group

Evaluated top-down; first match wins:

1. **Group governed by any policy** (a specific group policy, or the org
   default policy)? **No → `unenforced`. STOP.** Nothing is gated — the MCP runs
   as before. Admin decisions/grants do **not** apply to an ungoverned group
   (there is no enforcement to override).
2. **Group-scoped admin decision** (mcp_access_decisions) → allow / block.
3. **Org-scoped admin decision** → allow / block.
4. **Policy verdict**: take the group's *specific* policies (the org default is
   used only when there is no specific policy — specific replaces default, never
   layers). For each: `score < threshold` **and** category not denied → allow;
   else block; **unscored → needs-review**. Multiple specific policies on one
   group → combine **most-conservative** (block > allow). No priority numbers.

Notes:
- Risk uses **strict `<`** at the band edges (Low<40, Medium<60, High<80,
  matching `getRiskLevel` / `get_org_scorecard_rollup`). An MCP averaging exactly
  60 is High → blocked under "up to Medium". (The old scenarios fixture used
  `<=`; that was the bug.)
- `unenforced` short-circuits **above** decisions — a grant on an ungoverned
  group is inert.

## Enforcement units — what the badge aggregates over

The badge always answers "status across the **units** in scope". A filter that
pins down which groups/users are in view sets the scope; MCP-property filters
(search, category, risk, source) only shrink the row list, never the scope.

| Scope (filter) | Units | Each unit's verdict |
|---|---|---|
| Group filter / no filter | **groups** | the core rule for that group |
| Device filter | **devices** | collapse of the device owner's groups (block > allow > needs-review) |

Rollup across units: all allowed → **Allowed**; all non-allowed → **Blocked**;
mixed → **Varies**; unscored/undecided in scope → **Needs review**; no governed
unit in scope → **— no policy**. A **single unit shows its own verdict** (never
"Varies").

Only groups that survive **both** the filter selection **and** policy coverage
participate — ungoverned groups drop out of the rollup entirely.

## Single device filter — the device's actual verdict (never "Varies")

    Filter: Device = Priya's MacBook  (owner priya@acme.com · Engineering, Contractors)

     MCP                 Risk     Access
     GitHub              Medium   ● Allowed
     Snowflake           High     ● Blocked
     Docker              High     ● Blocked        ← Contractors policy blocks; Eng allows → block wins
     Notion (custom)     —        ● Needs review

A device enforces exactly one outcome = the collapse of its owner's groups
(block > allow > needs-review). Popover explains the collapse (per-group lines,
which one won). If the owner is in no governed group → whole device is
**— no policy** (enforces nothing).

## Multi device filter — rollup OVER devices (each collapsed), can vary

    Filter: Devices = 3 selected  (owners span Engineering, Sales, Contractors)

     MCP                 Risk     Access
     GitHub              Medium   ● Allowed              ← allowed on all 3
     Snowflake           High     ● Blocked              ← blocked on all 3
     Slack               Low      ◐ Varies by device     ← allowed on 2, blocked on 1
     Notion (custom)     —        ● Needs review

Roll up over the selected **devices**, not the flattened group set. This matters:
if all selected devices are blocked for *different* group reasons, the badge is
**Blocked** (every device is actually blocked) — flattening to the group union
would wrongly say "Varies". Popover breaks down allowed-on-N / blocked-on-M by
device. Badge word is "Varies by device" (vs "Varies by group" for the group
scope) so it names the unit in view.

Open: confirm the inventory actually supports a multi-device filter (in the
mockup, device scope came only from the single-device DeviceDetail page; the
multi-device case is new design, not yet a real page state).

## Three consumers, one resolver

`get_mcp_access_status(org, group_ids[], mcp_types[])` returns per (MCP, group).
The surfaces are thin projections — no precedence logic is duplicated:

- **Policy page** — one policy's rules vs the catalog (pure evaluator, no
  decisions); save-preview diffs draft vs current.
- **Inventory** — group scope → rollup (can be "Varies"); device scope → per
  device collapse then rollup over devices.
- **Device-config (enforcement)** — one device's owner's groups → collapse to a
  single verdict per MCP; `needs_review` collapses to block on-device (with the
  request link); unenforced groups emit nothing (device runs as before).
