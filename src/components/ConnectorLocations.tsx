import { useState } from "react"
import { Button } from "@/components/ui/button"
import { type ConnectorLocation, scopedProject, webAppName } from "@/lib/connectorLocation"

const VISIBLE_LOCATIONS = 3

interface ConnectorLocationsProps {
  locations: ConnectorLocation[]
  // Web connectors live in an account, not a file; pass it where no other column shows it.
  accountEmail?: string | null
}

// Paths wrap in full rather than truncating behind a tooltip: this is what the admin acts on.
const ConnectorLocations = ({ locations, accountEmail }: ConnectorLocationsProps) => {
  const [showAll, setShowAll] = useState(false)
  if (locations.length === 0) return <span className="text-muted-foreground">-</span>

  const shown = showAll ? locations : locations.slice(0, VISIBLE_LOCATIONS)
  return (
    <div className="min-w-[200px] max-w-[340px] space-y-1">
      {shown.map((loc) => {
        const app = webAppName(loc.location)
        if (app) {
          return (
            <div key={loc.location} className="text-sm">
              {app} account
              {accountEmail && <div className="text-xs text-muted-foreground break-all">{accountEmail}</div>}
            </div>
          )
        }
        const project = scopedProject(loc)
        return (
          <div key={`${loc.location}|${loc.project_path}`} className="font-mono text-xs break-all">
            {loc.location}
            {project && <div className="text-muted-foreground">project {project}</div>}
          </div>
        )
      })}
      {!showAll && locations.length > VISIBLE_LOCATIONS && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 -ml-2 px-2 text-xs text-muted-foreground"
          onClick={() => setShowAll(true)}
        >
          Show {locations.length - VISIBLE_LOCATIONS} more
        </Button>
      )}
    </div>
  )
}

export default ConnectorLocations
