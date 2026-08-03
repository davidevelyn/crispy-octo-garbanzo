import type { BaseRecord, ISODateTime } from '../../platform/types'

/* ---------- Exercise library (static content, ships in the bundle) ---------- */

export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'forearms'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'core' | 'full-body'

export type MovementPattern =
  | 'squat' | 'hinge' | 'push-v' | 'push-h' | 'pull-v' | 'pull-h'
  | 'lunge' | 'carry' | 'rotation' | 'anti-rotation' | 'jump-throw'
  | 'mobility' | 'conditioning' | 'core'

export type Equipment =
  | 'barbell' | 'trap-bar' | 'dumbbell' | 'bench' | 'dip-bar'
  | 'pullup-bar' | 'med-ball' | 'band' | 'treadmill' | 'bodyweight'

export interface Exercise {
  /** stable slug, e.g. 'trap-bar-deadlift' */
  id: string
  name: string
  muscleGroups: { primary: MuscleGroup[]; secondary: MuscleGroup[] }
  movementPattern: MovementPattern
  equipment: Equipment[]
  unilateral: boolean
  golfRelevant: boolean
  instructions: string
}

/* ---------- Prescribed & logged sets ---------- */

export type SetType = 'warmup' | 'working' | 'amrap' | 'drop'

/** A prescribed set — engine output, frozen into the session at start. */
export interface SetEntry {
  setType: SetType
  targetWeightLbs?: number
  targetReps?: number
  /** top of a double-progression rep range */
  targetRepsMax?: number
  targetRpeCap?: number
  targetSeconds?: number
  amrap?: boolean
}

/** What actually happened. */
export interface LoggedSet {
  id: string
  setType: SetType
  weightLbs?: number
  reps?: number
  rpe?: number
  seconds?: number
  completedAt: ISODateTime
}

export interface SessionExercise {
  exerciseId: string
  /** link back to the program slot when programmed */
  slotId?: string
  supersetGroup?: string
  restSec: number
  prescribed: SetEntry[]
  sets: LoggedSet[]
  /** items ticked for checklist schemes */
  checklistDone?: string[]
  /** one-line note shown under the exercise name (e.g. "swapped: round tomorrow") */
  note?: string
}

export interface WorkoutSession extends BaseRecord {
  status: 'active' | 'finished' | 'discarded'
  programId?: string
  programStateId?: string
  week?: number
  day?: number
  dayName?: string
  startedAt: ISODateTime
  finishedAt?: ISODateTime
  exercises: SessionExercise[]
  notes?: string
  summary?: {
    totalVolumeLbs: number
    workingSets: number
    prEvents: ProgressionEvent[]
  }
}

/* ---------- Schemes: how a slot prescribes work ---------- */

export type Scheme =
  /** 5/3/1-style percentage of training max; rpeCap applies to AMRAP sets ("leave one in the tank") */
  | { kind: 'percentTM'; liftKey: string; sets: Array<{ pct: number; reps: number; amrap?: boolean }>; roundLbs?: number; rpeCap?: number }
  /** fixed sets×reps at an optional load — jumps, throws, technique work, carries */
  | { kind: 'fixedSets'; sets: number; reps: number; loadLbs?: number; perSide?: boolean; note?: string }
  /** GZCLP-style staged linear progression */
  | {
      kind: 'linearStages'
      liftKey: string
      stages: Array<{ sets: number; reps: number; amrapLast: boolean }>
      incrementLbs: number
    }
  /** classic double progression within a rep range */
  | { kind: 'doubleProgression'; sets: number; repMin: number; repMax: number; startLbs: number; incrementLbs: number }
  /** single all-out set capped at an RPE — weight rides the last logged weight */
  | { kind: 'amrapRpeCap'; sets?: number; targetRpe: number; startLbs?: number; note?: string }
  /** time/distance work (treadmill, carries) */
  | { kind: 'timeDistance'; minutes?: number; zone?: 'z2' | 'z4'; note?: string }
  /** tick-off list (mobility primers, throws) */
  | { kind: 'checklist'; items: string[] }
  /** week-12: work to a heavy top set, propose new TM */
  | { kind: 'tmTest'; liftKey: string }

/* ---------- Programs (static content) ---------- */

export interface ProgramLift {
  key: string
  exerciseId: string
  tmIncrementLbs: number
}

export interface Slot {
  /** stable id, e.g. 'd1-squat-t1' (unique within a day) */
  id: string
  exerciseId: string
  scheme: Scheme
  supersetGroup?: string
  restSec: number
  /** eligible for the golf swap */
  heavyLower?: boolean
  golfAlternate?: { exerciseId: string; scheme: Scheme }
}

export interface ProgramDay {
  day: number
  name: string
  /** short mobility/power primer shown as a checklist before the lifts */
  primer?: string[]
  slots: Slot[]
}

export interface ProgramWeek {
  week: number
  deload?: boolean
  /** short line shown under the week, e.g. 'Leader 1 · 5s PRO + FSL' */
  label?: string
  days: ProgramDay[]
}

export interface Program {
  id: string
  name: string
  tagline: string
  description: string
  level: 'beginner' | 'intermediate' | 'advanced'
  daysPerWeek: number
  lifts: ProgramLift[]
  weeks: ProgramWeek[]
}

/* ---------- Program state (per profile, persisted) ---------- */

export interface ProgramState extends BaseRecord {
  programId: string
  startDate: ISODateTime
  /** pointer to the next un-done day */
  currentWeek: number
  currentDay: number
  /** liftKey → training max, lbs */
  trainingMaxes: Record<string, number>
  /** completed percentTM waves per lift (drives TM bumps) */
  cycleCount: number
  /** liftKey → linearStages progress */
  stageState: Record<string, { stageIndex: number; loadLbs: number }>
  /** slotKey (programId:slotId) → current double-progression load */
  dpLoads: Record<string, number>
  completedDays: Array<{ week: number; day: number; sessionId: string }>
  status: 'active' | 'completed' | 'abandoned'
}

/* ---------- Progression events (feed celebrations + summaries) ---------- */

export type ProgressionEvent =
  | { type: 'weightPr'; exerciseId: string; weightLbs: number; reps: number }
  | { type: 'repPr'; exerciseId: string; weightLbs: number; reps: number; prevReps: number }
  | { type: 'e1rmPr'; exerciseId: string; e1rm: number }
  | { type: 'tmBump'; liftKey: string; fromLbs: number; toLbs: number }
  | { type: 'tmProposal'; liftKey: string; fromLbs: number; toLbs: number }
  | { type: 'stageAdvance'; liftKey: string; toStage: number }
  | { type: 'stageReset'; liftKey: string; newLoadLbs: number }
  | { type: 'dpBump'; slotKey: string; toLbs: number }

/* ---------- Measurements ---------- */

export type Metric = 'bodyweight' | 'waist' | 'chest' | 'hips' | 'arm' | 'thigh'

export interface MeasurementEntry extends BaseRecord {
  metric: Metric
  /** lbs for bodyweight, inches for girths */
  value: number
  takenAt: ISODateTime
}

/* ---------- Prescribed session (engine output for tonight) ---------- */

export interface PrescribedExercise {
  exerciseId: string
  slotId: string
  supersetGroup?: string
  restSec: number
  prescribed: SetEntry[]
  ghosts: LoggedSet[]
  checklist?: string[]
  note?: string
}

export interface PrescribedSession {
  programId: string
  week: number
  day: number
  dayName: string
  weekLabel?: string
  deload: boolean
  primer?: string[]
  exercises: PrescribedExercise[]
}
