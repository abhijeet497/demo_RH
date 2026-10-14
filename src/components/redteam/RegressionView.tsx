import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRedTeam } from "@/lib/redteam/store"
import { BT_DATASETS, RELEASE_GATE } from "@/lib/redteam/dataset"

export const RegressionView = () => {
  const { findings } = useRedTeam()
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regression datasets</CardTitle>
          <CardDescription>
            Each case stores the attack, its starting state and the expected safe behavior. A fix
            is verified when the same cases pass on a re-run with the same scorers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dataset</TableHead>
                <TableHead>Cases</TableHead>
                <TableHead>Contents</TableHead>
                <TableHead>Findings tracked</TableHead>
                <TableHead>Verified fix</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {BT_DATASETS.map((d) => {
                const tracked = findings.filter((f) => f.dataset === d.name && f.inRegression)
                return (
                  <TableRow key={d.name}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell>{d.cases}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.contents}</TableCell>
                    <TableCell>
                      {tracked.length ? (
                        <div className="flex flex-wrap gap-1">
                          {tracked.map((f) => (
                            <Badge key={f.id} variant="secondary">{f.category}</Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">Not yet run</Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Release gate</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {RELEASE_GATE.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
