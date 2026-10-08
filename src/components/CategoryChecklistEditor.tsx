import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

/**
 * Shared category/item checklist editor for the rule-9 (Sensitive Data) and
 * rule-19 (Risky Action) custom controls. Both rules persist a flat "included"
 * allowlist (settings.enabled_sensitive_data_types / enabled_risky_action_subcategories)
 * where:
 *   - null / absent -> every item detected (all on)
 *   - number[]      -> the explicit included set of detected item ids
 *
 * The per-category Switch bulk-adds/removes that category's items; a category
 * reads as "on" when any of its items are selected. "All selected" collapses back
 * to null on write (via onChange), matching the normalizeX helpers.
 */
export interface CategoryChecklistEditorProps {
  /** Category id -> display label. */
  categoryLabels: Record<number, string>;
  /** Category id -> ordered list of item ids (renders in this order). */
  idsByCategory: Record<number, number[]>;
  /** Item id -> display label. */
  itemLabels: Record<number, string>;
  /** Current selection: null = all detected, otherwise the included id set. */
  selected: number[] | null;
  /** Emits the next selection (null = all detected). */
  onChange: (next: number[] | null) => void;
  /** Prefix for element ids/labels, e.g. "sd" or "ra". */
  idPrefix: string;
  /** Intro copy shown above the categories. */
  description: string;
  /** Message shown when the selection is an explicit empty set (blocks Save). */
  emptyMessage: string;
}

export function CategoryChecklistEditor({
  categoryLabels,
  idsByCategory,
  itemLabels,
  selected,
  onChange,
  idPrefix,
  description,
  emptyMessage,
}: CategoryChecklistEditorProps) {
  const allIds = Object.values(idsByCategory).flat();

  // Materialize null ("all") into the concrete id set to edit, then collapse
  // "all" back to null on write.
  const materialize = (): number[] => (selected === null ? [...allIds] : [...selected]);
  const commit = (nextArr: number[]) => {
    const next = allIds.filter((id) => nextArr.includes(id));
    onChange(next.length === allIds.length ? null : next);
  };

  const isItemChecked = (itemId: number): boolean =>
    selected === null || selected.includes(itemId);
  const isCategoryEnabled = (categoryId: number): boolean =>
    selected === null ||
    (idsByCategory[categoryId] ?? []).some((id) => selected.includes(id));
  const toggleCategory = (categoryId: number, enabled: boolean) => {
    const catItems = idsByCategory[categoryId] ?? [];
    const eff = materialize();
    commit(enabled ? Array.from(new Set([...eff, ...catItems])) : eff.filter((id) => !catItems.includes(id)));
  };
  const toggleItem = (itemId: number, checked: boolean) => {
    const eff = materialize();
    commit(checked ? Array.from(new Set([...eff, itemId])) : eff.filter((id) => id !== itemId));
  };

  const isEmpty = selected !== null && selected.length === 0;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{description}</p>
      {Object.entries(idsByCategory).map(([categoryIdStr, itemIds]) => {
        const categoryId = Number(categoryIdStr);
        const enabled = isCategoryEnabled(categoryId);
        return (
          <div key={categoryId} className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              <Switch
                id={`edit-control-${idPrefix}-cat-${categoryId}`}
                checked={enabled}
                onCheckedChange={(checked) => toggleCategory(categoryId, !!checked)}
              />
              <label
                htmlFor={`edit-control-${idPrefix}-cat-${categoryId}`}
                className="text-xs font-medium text-muted-foreground uppercase tracking-wide cursor-pointer"
              >
                {categoryLabels[categoryId]}
              </label>
            </div>
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 ${enabled ? '' : 'opacity-50'}`}>
              {itemIds.map((itemId) => (
                <div key={itemId} className="flex items-center gap-2">
                  <Checkbox
                    id={`edit-control-${idPrefix}-item-${itemId}`}
                    checked={isItemChecked(itemId)}
                    disabled={!enabled}
                    onCheckedChange={(checked) => toggleItem(itemId, !!checked)}
                  />
                  <label
                    htmlFor={`edit-control-${idPrefix}-item-${itemId}`}
                    className={`text-sm font-medium ${!enabled ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer'}`}
                  >
                    {itemLabels[itemId]}
                  </label>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {isEmpty && <p className="text-sm text-destructive">{emptyMessage}</p>}
    </div>
  );
}
