

## Rename "Agent Fleet" to "Agents in Use" and show both agent + instance counts

### What changes

**File: `src/pages/Agents.tsx`**

1. **Rename the card title** from `"Agent Fleet"` to `"Agents in Use"` (line 477).

2. **Fetch total agent instances count** by adding a parallel query to `agent_instances` (counting non-deleted rows) inside `fetchAgents`. This will be stored in new state like `totalInstances`.

   ```ts
   const instanceCountPromise = supabase
     .from('agent_instances')
     .select('id', { count: 'exact', head: true })
     .is('deleted_at', null)
   ```

3. **Update the card content** (lines 478-483) to display two metrics side by side instead of one centered number:

   ```
   ┌─────────────────────────┐
   │  Agents in Use          │
   │                         │
   │   42          187       │
   │  Agents    Instances    │
   └─────────────────────────┘
   ```

   Both numbers displayed with the same styling (`text-4xl font-bold`) with their labels underneath, laid out in a horizontal flex row with spacing.

### Technical details

- The agents count comes from `filteredAgents.length` (already available).
- The instances count comes from a new `agent_instances` query with `count: 'exact'` and `head: true` for efficiency.
- When device filters are active, the instances count should also be filtered to those devices (using `.in('device_id', currentDeviceFilters)`).
- New state: `const [totalInstances, setTotalInstances] = useState<number>(0)`.

