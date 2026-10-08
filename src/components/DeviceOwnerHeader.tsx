import { Info, Lock, AlertTriangle } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getMdmProviderLabel, getMdmSyncStatusText, sortMdmByCreatedAt } from "@/lib/appUtils"
import type { MdmIntegration } from "@/integrations/traceforce/types"

interface DeviceOwnerHeaderProps {
  mdmIntegrations: MdmIntegration[]
  mdmNotConfigured: boolean
  mdmNeedsAttention: boolean
}

// Shared "Device Owner" table-header cell with the MDM sync tooltip + setup/attention links.
// tabIndex={-1} on the tooltip trigger keeps it out of dialog auto-focus, so the tooltip
// doesn't pop open by itself when a modal containing this header opens.
export const DeviceOwnerHeader = ({ mdmIntegrations, mdmNotConfigured, mdmNeedsAttention }: DeviceOwnerHeaderProps) => {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col gap-1">
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        Device Owner
        {mdmIntegrations.length > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger tabIndex={-1} onClick={(e) => e.stopPropagation()}>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                {/* One line per connected provider, oldest first; getMdmSyncStatusText prefers
                    "Sync failed" over "Waiting for first sync" when the last attempt errored. */}
                {sortMdmByCreatedAt(mdmIntegrations).map((i) => (
                  <div key={i.id}>
                    {getMdmProviderLabel(i.provider)} · {getMdmSyncStatusText(i)}
                  </div>
                ))}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </span>
      {mdmNotConfigured && (
        <Button
          variant="link"
          className="h-auto p-0 text-xs whitespace-nowrap inline-flex items-center gap-1 justify-start"
          onClick={(e) => { e.stopPropagation(); navigate('/settings?section=mdm-integration') }}
        >
          <Lock className="h-3 w-3" />
          Set up →
        </Button>
      )}
      {mdmNeedsAttention && (
        <Button
          variant="link"
          className="h-auto p-0 text-xs text-amber-600 hover:text-amber-700 whitespace-nowrap inline-flex items-center gap-1 justify-start"
          onClick={(e) => { e.stopPropagation(); navigate('/settings?section=mdm-integration') }}
        >
          <AlertTriangle className="h-3 w-3" />
          Action needed →
        </Button>
      )}
    </div>
  )
}
