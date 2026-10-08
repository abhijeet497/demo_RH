# Creating Policies in Traceforce

## Overview

Policies apply a risk framework to selected AI agents and devices. New policies are created inactive so you can review their controls before activation.

## Create a policy

1. Open **Policies** and select **New Policy**.
2. Enter a unique name and optional description.
3. Choose an agent category:
   - **General Purpose Agents:** Claude, ChatGPT, and Microsoft 365 Copilot.
   - **Coding Agents:** Cursor, Claude Code, and GitHub Copilot.
4. Select an agent risk framework and review the selected agents.
5. Apply the policy to **All Devices** or selected **User Groups**.
6. Create the policy deactivated initially, review its controls, then activate it from the policy details page.

## Policy controls

Each supported framework rule becomes a policy control with:

- an enabled or disabled state;
- a requirement; and
- an action to take when the requirement is violated.

Traceforce groups controls by capability:

- **Enforceable by Traceforce:** Traceforce can detect violations and apply a compatible enforcement action.
- **Monitor & Alert:** Traceforce can detect violations, but the selected agents do not support enforcement yet.

Available actions depend on the selected agents and their remediation compatibility. Coding-agent policies are enforced via Traceforce-managed hooks. For agents that do not support hooks, enforcement is performed via browser extension and/or Traceforce-managed local proxies.

Some controls have additional settings. For example, Sensitive Data controls can target specific data types, while User Activity Logging controls can redact sensitive data from stored logs.

## Activate or deactivate

Use the status action beside the policy name on the policy details page. Activating or deactivating a policy does not remove its scope or control configuration.
