import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import {
  AGENT,
  ALL_ATTACK_PLUGINS,
  FINDINGS,
  ORCHESTRATION_STAGES,
  type FindingSeed,
} from "./dataset"
import { RED_TEAM_AGENT } from "./targetAgent"

/**
 * Red Teaming state.
 *
 * The user chooses an attack plan (which attack types to include) and a target
 * agent, then runs a test. The run moves through the orchestration stages and
 * loads that agent's recorded assessment, narrowed to the selected attack
 * types. Findings exist only after a completed run, and only for agents with a
 * recorded assessment (today: the Invoice Operations Agent). Remediation
 * records a proposed fix and adds the case to the regression dataset; it never
 * marks a finding resolved, because no hardened run has been recorded yet.
 */

export type RunState = "idle" | "running" | "completed"
export type FindingStatus = "active" | "fix-proposed"

export interface RedTeamTarget {
  id: string
  name: string
  environment: string
}

export interface Finding extends FindingSeed {
  /** The agent this finding was recorded against. */
  agentName: string
  status: FindingStatus
  proposedFix?: string
  inRegression: boolean
}

/** The one agent with a recorded assessment. */
export const RED_TEAM_TARGET: RedTeamTarget = {
  id: RED_TEAM_AGENT?.id ?? "bedrock:invoice-operations-agent",
  name: RED_TEAM_AGENT?.agent_name ?? AGENT.name,
  environment: AGENT.environment,
}

export const assessmentAvailable = (agentId: string) => agentId === RED_TEAM_TARGET.id

interface Persisted {
  target: RedTeamTarget | null
  completedAt: number | null
  selectedAttacks: string[]
  findings: Record<string, { status: FindingStatus; proposedFix?: string; inRegression: boolean }>
}

const STORAGE_KEY = "tf-redteam-invoice-agent"
const STAGE_MS = 1100

const load = (): Persisted => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<Persisted>
      return {
        // Earlier saves had no target; a completed run was always the invoice agent.
        target: p.target ?? (p.completedAt ? RED_TEAM_TARGET : null),
        completedAt: p.completedAt ?? null,
        selectedAttacks: p.selectedAttacks?.length ? p.selectedAttacks : ALL_ATTACK_PLUGINS,
        findings: p.findings ?? {},
      }
    }
  } catch {
    /* storage unavailable */
  }
  return { target: null, completedAt: null, selectedAttacks: ALL_ATTACK_PLUGINS, findings: {} }
}

interface Ctx {
  target: RedTeamTarget | null
  runState: RunState
  stage: number
  completedAt: number | null
  /** Attack types (plugins) included in the test. */
  selectedAttacks: string[]
  setSelectedAttacks: (plugins: string[]) => void
  /** Findings for the current target, narrowed to the selected attack types. */
  findings: Finding[]
  /** Start (or restart) a test. Defaults to the recorded target. */
  startTest: (target?: RedTeamTarget) => void
  proposeFix: (id: string, text: string) => void
  addToRegression: (id: string) => void
  reset: () => void
}

const RedTeamContext = createContext<Ctx | null>(null)

export const RedTeamProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [persisted, setPersisted] = useState<Persisted>(load)
  const [running, setRunning] = useState(false)
  const [stage, setStage] = useState(0)
  const timers = useRef<number[]>([])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))
    } catch {
      /* storage unavailable */
    }
  }, [persisted])

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), [])

  const startTest = useCallback(
    (target: RedTeamTarget = RED_TEAM_TARGET) => {
      if (running || !assessmentAvailable(target.id)) return
      timers.current.forEach((t) => clearTimeout(t))
      timers.current = []
      setRunning(true)
      setStage(0)
      setPersisted((p) => ({ ...p, target, completedAt: null }))
      ORCHESTRATION_STAGES.forEach((_, i) => {
        timers.current.push(window.setTimeout(() => setStage(i), STAGE_MS * i))
      })
      timers.current.push(
        window.setTimeout(() => {
          setRunning(false)
          setStage(ORCHESTRATION_STAGES.length)
          setPersisted((p) => ({ ...p, completedAt: Date.now() }))
        }, STAGE_MS * ORCHESTRATION_STAGES.length),
      )
    },
    [running],
  )

  const setSelectedAttacks = useCallback((plugins: string[]) => {
    setPersisted((p) => ({ ...p, selectedAttacks: plugins }))
  }, [])

  const patch = (id: string, change: Partial<Persisted["findings"][string]>) =>
    setPersisted((p) => {
      const cur = p.findings[id] ?? { status: "active" as FindingStatus, inRegression: false }
      return { ...p, findings: { ...p.findings, [id]: { ...cur, ...change } } }
    })

  const proposeFix = useCallback((id: string, text: string) => {
    patch(id, { status: "fix-proposed", proposedFix: text })
  }, [])

  const addToRegression = useCallback((id: string) => {
    patch(id, { inRegression: true })
  }, [])

  const reset = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t))
    timers.current = []
    setRunning(false)
    setStage(0)
    setPersisted({ target: null, completedAt: null, selectedAttacks: ALL_ATTACK_PLUGINS, findings: {} })
  }, [])

  const runState: RunState = running ? "running" : persisted.completedAt ? "completed" : "idle"
  const target = persisted.target
  const selectedAttacks = persisted.selectedAttacks

  const findings: Finding[] =
    runState === "completed" && target && assessmentAvailable(target.id)
      ? FINDINGS.filter((f) => selectedAttacks.includes(f.plugin)).map((f) => {
          const s = persisted.findings[f.id]
          return {
            ...f,
            agentName: target.name,
            status: s?.status ?? "active",
            proposedFix: s?.proposedFix,
            inRegression: s?.inRegression ?? false,
          }
        })
      : []

  return (
    <RedTeamContext.Provider
      value={{
        target,
        runState,
        stage,
        completedAt: persisted.completedAt,
        selectedAttacks,
        setSelectedAttacks,
        findings,
        startTest,
        proposeFix,
        addToRegression,
        reset,
      }}
    >
      {children}
    </RedTeamContext.Provider>
  )
}

export const useRedTeam = (): Ctx => {
  const ctx = useContext(RedTeamContext)
  if (!ctx) throw new Error("useRedTeam must be used within a RedTeamProvider")
  return ctx
}
