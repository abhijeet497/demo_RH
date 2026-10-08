import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/integrations/supabase/client"

export const useOnboarding = () => {
  const { user, loading, isRegularUser } = useAuth()
  const [shouldRun, setShouldRun] = useState(false)

  const hasOnboarded = Boolean(
   user?.user_metadata?.onboarded_at as string | undefined,
  )

  useEffect(() => {
    // The onboarding tour targets admin-only sidebar anchors (nav-dashboard,
    // nav-ai-inventory, etc.) that aren't rendered for regular users, so skip it.
    if (loading || !user || hasOnboarded || isRegularUser) {
      setShouldRun(false)
      return
    }

    const timer = window.setTimeout(() => setShouldRun(true), 600)
    return () => window.clearTimeout(timer)
  }, [loading, user, hasOnboarded, isRegularUser])

  const markOnboarded = useCallback(async () => {
    if (!user) return

    setShouldRun(false)
    const { error } = await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        onboarded_at: new Date().toISOString(),
      },
    })

    if (error) {
      console.error("Failed to persist onboarding status:", error)
    }
  }, [user])

  return { shouldRun, markOnboarded }
}
