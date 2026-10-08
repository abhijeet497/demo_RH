import { useState } from "react"
import { Download, Copy, Info } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button, type ButtonProps } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/use-toast"
import { traceforcApi } from "@/integrations/traceforce/client"
import { downloadBlob } from "@/lib/csvUtils"
import { cn } from "@/lib/utils"

// Self-serve is built for dev and sandbox (scout BUILD_SELFSERVE). Sandbox is a Vercel
// prod deployment, so check VITE_TRIAL_MODE too, else it's hidden there.
const selfServeEnabled =
  import.meta.env.VITE_VERCEL_ENV !== "production" ||
  import.meta.env.VITE_TRIAL_MODE === "true"

type DeploymentMode = "" | "mdm" | "selfserve"

interface DownloadScannerDialogProps {
  triggerVariant?: ButtonProps["variant"]
  triggerSize?: ButtonProps["size"]
  triggerClassName?: string
  disabled?: boolean
}

const DownloadScannerDialog = ({
  triggerVariant = "default",
  triggerSize = "default",
  triggerClassName,
  disabled = false,
}: DownloadScannerDialogProps) => {
  const { session } = useAuth()
  const { toast } = useToast()

  const [open, setOpen] = useState(false)
  const [supportedOs, setSupportedOs] = useState<string[]>([])
  const [loadingOs, setLoadingOs] = useState(false)
  const [mode, setMode] = useState<DeploymentMode>("")
  const [selectedOs, setSelectedOs] = useState("")
  const [downloadUrl, setDownloadUrl] = useState("")
  const [loadingDownload, setLoadingDownload] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(false)

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "Success", description: `${label} copied to clipboard` })
    } catch {
      toast({ title: "Error", description: `Failed to copy ${label}`, variant: "destructive" })
    }
  }

  const fetchSupportedOs = async () => {
    if (!session?.access_token) return

    setLoadingOs(true)
    try {
      const response = await traceforcApi.getInstallers(session.access_token)
      if (response.error) {
        throw new Error(response.error)
      }
      if (response.data?.supported_os) {
        setSupportedOs(response.data.supported_os)
      }
    } catch (error) {
      console.error("Error fetching supported OS:", error)
      toast({ title: "Error", description: "Failed to load download options", variant: "destructive" })
    } finally {
      setLoadingOs(false)
    }
  }

  // In production no mode is selected, so the API is called without a mode param
  // and defaults to the MDM package — identical to the previous behavior.
  const fetchDownloadUrl = async (os: string, deploymentMode?: DeploymentMode) => {
    if (!session?.access_token) return

    setLoadingDownload(true)
    setDownloadUrl("")
    try {
      const response = await traceforcApi.getInstallerByOs(
        session.access_token,
        os,
        deploymentMode || undefined,
      )
      if (response.error) {
        throw new Error(response.error)
      }
      if (response.data?.download_url) {
        setDownloadUrl(response.data.download_url)
      }
    } catch (error) {
      console.error("Error fetching download URL:", error)
      toast({ title: "Error", description: "Failed to get download link", variant: "destructive" })
    } finally {
      setLoadingDownload(false)
    }
  }

  // macOS-only: download the org's configuration profile (.mobileconfig) bytes and save
  // them under the server-chosen filename (traceforce-<orgSlug>.mobileconfig).
  const handleDownloadCertificateProfile = async () => {
    if (!session?.access_token) return

    setLoadingProfile(true)
    try {
      const response = await traceforcApi.getCertificateProfile(session.access_token)
      if (response.error) {
        throw new Error(response.error)
      }
      if (!response.data?.blob) {
        throw new Error("No configuration profile returned")
      }
      downloadBlob(response.data.blob, response.data.filename || "traceforce.mobileconfig")
    } catch (error) {
      console.error("Error downloading configuration profile:", error)
      toast({ title: "Error", description: "Failed to download configuration profile", variant: "destructive" })
    } finally {
      setLoadingProfile(false)
    }
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setMode("")
      setSelectedOs("")
      setDownloadUrl("")
      if (supportedOs.length === 0) {
        fetchSupportedOs()
      }
    }
  }

  // Changing the deployment method invalidates any OS already picked, since the
  // download URL depends on both. Reset so a stale link is never shown.
  const handleModeSelect = (next: string) => {
    setMode(next as DeploymentMode)
    setSelectedOs("")
    setDownloadUrl("")
  }

  const handleOsSelect = (os: string) => {
    setSelectedOs(os)
    fetchDownloadUrl(os, selfServeEnabled ? mode : undefined)
  }

  const osDisabled = loadingOs || (selfServeEnabled && !mode)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant={triggerVariant}
          size={triggerSize}
          className={cn("gap-2", triggerClassName)}
          disabled={disabled}
        >
          <Download className="h-4 w-4" />
          Download Scanner Package
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Download Scanner Package</DialogTitle>
          <DialogDescription>
            {selfServeEnabled
              ? "Choose how you want to deploy, then select your operating system."
              : "Select your operating system to download the appropriate scanner package."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {selfServeEnabled && (
            <div className="space-y-2">
              <Label>Deployment method</Label>
              <RadioGroup value={mode} onValueChange={handleModeSelect}>
                <Label
                  htmlFor="mode-mdm"
                  className={cn(
                    "flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50",
                    mode === "mdm" && "border-primary",
                  )}
                >
                  <RadioGroupItem value="mdm" id="mode-mdm" className="mt-0.5" />
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Enterprise (MDM / RMM)</div>
                    <div className="text-xs text-muted-foreground">
                      Deploy fleet-wide through your MDM or RMM platform.
                    </div>
                  </div>
                </Label>
                <Label
                  htmlFor="mode-selfserve"
                  className={cn(
                    "flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50",
                    mode === "selfserve" && "border-primary",
                  )}
                >
                  <RadioGroupItem value="selfserve" id="mode-selfserve" className="mt-0.5" />
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Self-serve</div>
                    <div className="text-xs text-muted-foreground">
                      Install on a single device by running the installer and following the
                      prompts.
                    </div>
                  </div>
                </Label>
              </RadioGroup>
              {mode === "selfserve" && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Use a personal device where you are the administrator.{" "}
                    <span className="font-bold">
                      Do not use self-serve on a corporate or managed device.
                    </span>{" "}
                    Those are set up by your IT administrator through MDM.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="os-select">Operating System</Label>
            <Select value={selectedOs} onValueChange={handleOsSelect} disabled={osDisabled}>
              <SelectTrigger id="os-select">
                <SelectValue
                  placeholder={
                    loadingOs
                      ? "Loading..."
                      : selfServeEnabled && !mode
                        ? "Select a deployment method first"
                        : "Select an operating system"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {supportedOs.map((os) => (
                  <SelectItem key={os} value={os}>
                    {os}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!loadingOs && supportedOs.length === 0 && (
            <p className="text-sm text-destructive">Failed to load download options</p>
          )}

          {loadingDownload && (
            <div className="text-sm text-muted-foreground">Loading download link...</div>
          )}

          {downloadUrl && (
            <div className="space-y-2">
              <Label>Download Link</Label>
              <div className="flex gap-2">
                <Input value={downloadUrl} readOnly className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(downloadUrl, "Download link")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button className="w-full gap-2" onClick={() => window.open(downloadUrl, "_blank")}>
                <Download className="h-4 w-4" />
                Download Package
              </Button>
            </div>
          )}

          {/* MDM-only (and macOS-only): the profile is meant to be uploaded to an
              MDM, so it's hidden under self-serve. In prod there's no selection and
              deployment is MDM, so !selfServeEnabled shows it; in dev/sandbox it
              appears only once MDM is chosen. */}
          {selectedOs.startsWith("darwin") && (!selfServeEnabled || mode === "mdm") && (
            <div className="space-y-2 border-t pt-4">
              <Label>Configuration Profile</Label>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleDownloadCertificateProfile}
                disabled={loadingProfile}
              >
                <Download className="h-4 w-4" />
                {loadingProfile ? "Downloading..." : "Download Configuration Profile"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default DownloadScannerDialog
