import { PlayCircle, ArrowRight, Plus, Copy, Eye, EyeOff, Wrench } from "lucide-react"
import SandboxSetupCard from "@/components/SandboxSetupCard"
import DownloadScannerDialog from "@/components/DownloadScannerDialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/AuthContext"
import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { traceforcApi } from "@/integrations/traceforce/client"
import type { TraceforceApiClient } from "@/integrations/traceforce/types"
import { Link } from "react-router-dom"


const GettingStarted = () => {
  const { session } = useAuth()
  const { toast } = useToast()
  const [showCredentials, setShowCredentials] = useState(false)
  const [apiClients, setApiClients] = useState<TraceforceApiClient[]>([])
  const hasClients = apiClients.length > 0
  const [creating, setCreating] = useState(false)
  const [loadingApiClients, setLoadingApiClients] = useState(true)
  const [apiClientLoadingError, setApiClientLoadingError] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [clientName, setClientName] = useState("")

  const createApiClient = async () => {
    if (!session?.access_token || !clientName.trim()) {
      return
    }

    setCreating(true)
    try {
      const response = await traceforcApi.createApiClient(session.access_token, clientName.trim())
      
      if (response.error) {
        throw new Error(response.error)
      }
      
      if (response.data) {
        setApiClients(prev => [...prev, response.data as TraceforceApiClient])
        setShowCreateDialog(false)
        setClientName("")
        toast({
          title: "Success",
          description: "API client created successfully",
        })
      }
    } catch (error) {
      console.error('Error creating API client:', error)
      toast({
        title: "Error",
        description: "Failed to create API client",
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }

  const fetchTraceforceApiKeys = async () => {
    setLoadingApiClients(true)
    
    if (!session?.access_token) {
      setLoadingApiClients(false)
      return
    }
    setApiClientLoadingError(false)
    try {
      const response = await traceforcApi.getApiClients(session.access_token)
      
      if (response.error) {
        throw new Error(response.error)
      }

      if (response.data && response.data.length > 0) {
        setApiClients(response.data as TraceforceApiClient[])
      }
    } catch (error) {
      console.error('Error fetching API keys:', error)
      setApiClientLoadingError(true)
      toast({
        title: "Error",
        description: "Failed to fetch API keys",
        variant: "destructive",
      })
    } finally {
      setLoadingApiClients(false)
    }
  }

  useEffect(() => {
    if (session?.access_token) {
      fetchTraceforceApiKeys()
    }
  }, [session?.access_token])

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: "Success",
        description: `${type} copied to clipboard`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to copy ${type}`,
        variant: "destructive",
      })
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Getting Started</h1>
        <p className="text-muted-foreground">Set up your environment and start scanning</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-primary" />
            Getting Started with Traceforce
          </CardTitle>
          <CardDescription>
            Traceforce will perform an initial scan of your environment to identify potential AI security risks and configuration issues 
            across your devices. Follow the steps below to get started.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Overview */}
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
              1
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="font-semibold text-foreground">Create API Client</h3>
              <p className="text-sm text-muted-foreground">
                Generate your Client ID and Client Secret to authenticate the Traceforce scanner with your environment.
              </p>
              {loadingApiClients ? (
                <div className="pt-2 space-y-2">
                  <Skeleton className="h-8 w-40" />
                </div>
              ) : apiClientLoadingError ? (
                <div className="pt-2">
                  <p className="text-sm text-destructive">Failed to load API clients</p>
                </div>
              ) : !hasClients ? (
                <div className="pt-2">
                  <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-2">
                        <Plus className="h-4 w-4" />
                        Create API Client
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create API Client</DialogTitle>
                        <DialogDescription>
                          Enter a name for your API client. It must be unique within your organization.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="client-name">Client Name</Label>
                          <Input
                            id="client-name"
                            placeholder="Enter client name"
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowCreateDialog(false)
                            setClientName("")
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={createApiClient}
                          disabled={creating || !clientName.trim()}
                        >
                          {creating ? "Creating..." : "Create"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              ) : (
                <div className="pt-2 space-y-3">
                  {apiClients.map((client) => (
                    <div key={client.id} className="space-y-1">
                      <div className="text-xs font-medium">{client.name}</div>
                      <div className="grid gap-1">
                        <div className="flex items-center justify-between p-2 bg-muted/50 rounded text-xs">
                          <div>
                            <div className="text-muted-foreground mb-1">Client ID</div>
                            <div className="font-mono">
                              {showCredentials ? client.client_id : "••••••••••••••••"}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(client.client_id, 'Client ID')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-muted/50 rounded text-xs">
                          <div>
                            <div className="text-muted-foreground mb-1">Client Secret</div>
                            <div className="font-mono">
                              {showCredentials ? client.client_secret : "••••••••••••••••"}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(client.client_secret, 'Client Secret')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCredentials(!showCredentials)}
                    className="gap-2"
                  >
                    {showCredentials ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {showCredentials ? "Hide" : "Show"} Credentials
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
              2
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="font-semibold text-foreground">Download & Install Package</h3>
              <p className="text-sm text-muted-foreground">
                Follow the instructions in the package README to install the Traceforce scanner.
              </p>
              <div className="pt-2 space-y-3">
                <DownloadScannerDialog
                  triggerVariant="outline"
                  triggerSize="sm"
                  disabled={!hasClients}
                />
                {!hasClients && (
                  <p className="text-xs text-muted-foreground">
                    Complete Step 1 to download the package
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Step 3 (Optional) */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
              3
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="font-semibold text-foreground">Enable sandbox monitoring (optional)</h3>
              <SandboxSetupCard />
            </div>
          </div>

          {/* Start Scanning Section */}
          <div className="mt-6 pt-6 border-t">
            <div className="space-y-2">
              <h3 className="font-semibold text-foreground text-lg">Start Scanning</h3>
              <p className="text-sm text-muted-foreground">
                Once the package is installed and configured, the scanner will automatically begin analyzing your environment.
              </p>
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-md">
                <p className="text-sm text-foreground">
                  <strong>🚀 Ready to go!</strong> You'll typically see results in the dashboard within 30 minutes. Check the dashboard 
                  to review findings and take action on identified issues.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button className="gap-2" asChild>
              <Link to="/dashboard">
                View Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-6 pt-6 border-t">
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 font-semibold text-foreground text-lg">
                <Wrench className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                Troubleshoot
              </h3>
              <p className="text-sm text-muted-foreground">
                If scan results don&apos;t show up after you&apos;ve installed, use our{' '}
                <a
                  href="https://traceforce.readme.io/docs/troubleshoot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary font-medium underline underline-offset-2 hover:no-underline"
                >
                  troubleshooting guide
                </a>{' '}
                to verify installation and reinstall if needed.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default GettingStarted
