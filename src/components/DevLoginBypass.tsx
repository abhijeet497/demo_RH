import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

/**
 * Dev-only login helper for the real auth flow.
 *
 * Paste a copied Supabase session (the whole sb-<ref>-auth-token localStorage
 * row, or the full localStorage dump) and it extracts the tokens and calls
 * supabase.auth.setSession — re-establishing the real session from a prior Okta
 * SSO login. The normal "Continue with SSO" flow is untouched.
 *
 * Gated to development builds (or VITE_DEV_LOGIN=true) so it never ships to
 * production.
 */
const DEV_LOGIN_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_DEV_LOGIN === "true"

function extractTokens(text: string): { access_token: string; refresh_token: string } | null {
  const at = text.match(/"access_token"\s*:\s*"([^"]+)"/)
  const rt = text.match(/"refresh_token"\s*:\s*"([^"]+)"/)
  if (at?.[1] && rt?.[1]) return { access_token: at[1], refresh_token: rt[1] }
  return null
}

export const DevLoginBypass = () => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)

  if (!DEV_LOGIN_ENABLED) return null

  const handleForceLogin = async () => {
    const tokens = extractTokens(value)
    if (!tokens) {
      toast({
        title: "Couldn't find a session",
        description: "Paste the sb-<ref>-auth-token row (it must contain access_token and refresh_token).",
        variant: "destructive",
      })
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.auth.setSession(tokens)
      if (error) {
        toast({ title: "Login failed", description: error.message, variant: "destructive" })
        return
      }
      try {
        localStorage.setItem("tf-last-activity-at", String(Date.now()))
        localStorage.removeItem("traceforce_intentional_signout_at")
      } catch {
        /* private mode */
      }
      toast({ title: "Signed in", description: "Session restored." })
      navigate("/")
    } catch (e) {
      toast({
        title: "Login failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 w-80 rounded-lg border bg-card p-4 shadow-lg">
      <div className="text-sm font-semibold text-primary">Dev Login Bypass</div>
      <p className="mt-1 text-xs text-muted-foreground">
        Paste anything containing your session (the whole sb-&lt;ref&gt;-auth-token row is fine) —
        the tokens are picked out automatically.
      </p>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Paste the copied session here…"
        rows={4}
        className="mt-3 font-mono text-xs"
      />
      <Button
        variant="secondary"
        className="mt-2 w-full gap-2"
        disabled={busy || !value.trim()}
        onClick={handleForceLogin}
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Force Login
      </Button>
    </div>
  )
}
