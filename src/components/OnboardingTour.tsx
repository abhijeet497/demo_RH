import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Joyride,
  ACTIONS,
  EVENTS,
  STATUS,
  type EventData,
  type Step,
  type ButtonType,
} from "react-joyride"
import { ONBOARDING_STEPS } from "@/lib/onboardingSteps"
import { useOnboarding } from "@/hooks/use-onboarding"

const START_DELAY_MS = 400

const joyrideStyles = {
  tooltip: {
    borderRadius: 8,
    fontSize: 14,
    textAlign: "left" as const,
  },
  tooltipTitle: {
    textAlign: "left" as const,
  },
  tooltipContent: {
    textAlign: "left" as const,
  },
  buttonPrimary: {
    borderRadius: 6,
    fontSize: 13,
  },
  buttonBack: {
    fontSize: 13,
  },
  buttonSkip: {
    fontSize: 13,
  },
}

const joyrideOptions = {
  buttons: ["back", "skip", "primary"] as ButtonType[],
  showProgress: true,
  spotlightPadding: 6,
  primaryColor: "hsl(var(--primary))",
  textColor: "hsl(var(--popover-foreground))",
  zIndex: 10000,
}

export function OnboardingTour() {
  const { shouldRun, markOnboarded } = useOnboarding()
  const [showTour, setShowTour] = useState(false)
  const [run, setRun] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  const steps = useMemo<Step[]>(
    () =>
      ONBOARDING_STEPS.map((step) => ({
        target: step.target,
        title: step.title,
        content: step.content,
        skipBeacon: true,
        placement: "right" as const,
      })),
    [],
  )

  const finishTour = useCallback(() => {
    setRun(false)
    setShowTour(false)
    void markOnboarded()
  }, [markOnboarded])

  useEffect(() => {
    if (!shouldRun) {
      setRun(false)
      setShowTour(false)
      return
    }

    // The tour only spotlights the persistent sidebar — no route changes — so
    // we just need a brief delay to ensure the sidebar is mounted before start.
    setShowTour(true)
    setStepIndex(0)
    const timer = window.setTimeout(() => setRun(true), START_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [shouldRun])

  const handleEvent = useCallback(
    (data: EventData) => {
      const { action, index, status, type } = data

      if (
        status === STATUS.FINISHED ||
        status === STATUS.SKIPPED ||
        type === EVENTS.TOUR_END ||
        action === ACTIONS.SKIP ||
        action === ACTIONS.CLOSE
      ) {
        finishTour()
        return
      }

      // In controlled mode Joyride cannot advance itself when a target is not
      // mounted. Skip the missing step so the overlay never traps the user.
      if (type === EVENTS.TARGET_NOT_FOUND) {
        const nextIndex = action === ACTIONS.PREV ? index - 1 : index + 1
        if (nextIndex >= 0 && nextIndex < ONBOARDING_STEPS.length) {
          setStepIndex(nextIndex)
        } else {
          finishTour()
        }
        return
      }

      if (type !== EVENTS.STEP_AFTER) return

      if (action === ACTIONS.NEXT) {
        const nextIndex = index + 1
        if (nextIndex < ONBOARDING_STEPS.length) {
          setStepIndex(nextIndex)
        } else {
          // Last step "Done" — joyride v3 may not emit FINISHED here.
          finishTour()
        }
        return
      }

      if (action === ACTIONS.PREV && index > 0) {
        setStepIndex(index - 1)
      }
    },
    [finishTour],
  )

  if (!showTour) return null

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      continuous
      options={joyrideOptions}
      onEvent={handleEvent}
      styles={joyrideStyles}
      locale={{
        back: "Back",
        close: "Close",
        last: "Done",
        next: "Next",
        skip: "Skip tour",
      }}
    />
  )
}
