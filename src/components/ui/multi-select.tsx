import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface MultiSelectProps {
  options: { id: string; name: string }[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  label?: string;
  /** Plural of label when it isn't label + "s" (e.g. "model families"). */
  pluralLabel?: string;
  disabled?: boolean;
  compact?: boolean;
  // Optional "select all" row pinned at the top of the list. When selectAllLabel is
  // provided the row renders; the parent owns what it does (so it can, e.g., also
  // populate a linked field) via onToggleSelectAll, and controls its checkbox via
  // selectAllChecked.
  selectAllLabel?: string;
  selectAllChecked?: boolean;
  onToggleSelectAll?: () => void;
}

export function MultiSelect({
  options,
  selectedIds,
  onChange,
  placeholder = "Select items...",
  searchPlaceholder = "Search...",
  emptyMessage = "No items found.",
  label = "item",
  pluralLabel,
  disabled = false,
  compact = false,
  selectAllLabel,
  selectAllChecked = false,
  onToggleSelectAll,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  
  // Create lookup map for better performance
  const optionsMap = new Map(options.map(opt => [opt.id, opt]));

  const toggleItem = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter(selectedId => selectedId !== id)
        : [...selectedIds, id]
    );
  };

  const removeItem = (id: string) => {
    onChange(selectedIds.filter(selectedId => selectedId !== id));
  };

  return (
    <div className="space-y-2 min-w-0">
      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <div className="min-w-0">
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full min-w-0 justify-between bg-background"
              disabled={disabled}
            >
              <span className="min-w-0 truncate text-left">
                {selectedIds.length > 0
                  ? `${selectedIds.length} ${selectedIds.length > 1 ? pluralLabel ?? `${label}s` : label} selected`
                  : placeholder}
              </span>
              <span className="flex shrink-0 items-center gap-0.5">
                {selectedIds.length > 0 && !disabled && (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="Clear selection"
                    className="p-0.5 rounded hover:bg-muted inline-flex cursor-pointer"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange([]); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onChange([]); } }}
                  >
                    <X className="h-4 w-4 opacity-50 hover:opacity-100" />
                  </span>
                )}
                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
              </span>
            </Button>
          </PopoverTrigger>
        </div>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              {selectAllLabel && onToggleSelectAll && (
                <CommandGroup>
                  <CommandItem
                    value="__select_all__"
                    keywords={[selectAllLabel]}
                    onSelect={() => onToggleSelectAll()}
                    className="font-medium"
                  >
                    <Checkbox
                      checked={selectAllChecked}
                      className="mr-2"
                      onCheckedChange={() => {}}
                    />
                    {selectAllLabel}
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.id}
                    // cmdk identifies items by value (default: rendered text); two
                    // options with the same label would otherwise act as one.
                    value={option.id}
                    keywords={[option.name]}
                    onSelect={() => toggleItem(option.id)}
                  >
                    <Checkbox
                      checked={selectedIds.includes(option.id)}
                      className="mr-2"
                      onCheckedChange={() => {}} 
                    />
                    {option.name}
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        selectedIds.includes(option.id) ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {!compact && selectedIds.length > 0 && (
        <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
          {selectedIds.map(id => {
            const option = optionsMap.get(id);
            return option ? (
              <Badge
                key={id}
                variant="secondary"
              >
                {option.name}
                {/* Honor `disabled`: a disabled control must not allow edits. Without
                    this, the remove ✕ stays active and an admin could delete saved
                    selections through the badges even while the field is disabled, then
                    silently lose them on save. */}
                {!disabled && (
                  <X
                    className="ml-1 h-3 w-3 cursor-pointer"
                    onClick={() => removeItem(id)}
                  />
                )}
              </Badge>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}
