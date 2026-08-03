# Data schema — the agent contract

Everything Life OS knows lives in IndexedDB on the device (database `life-os`,
version 1). One tap in **Settings → Export everything** produces a single JSON
document containing all of it. This file documents that document — it is the
stable contract for any external agent (OpenClaw or otherwise) that reads or
writes Life OS data. Import merges by `updatedAt` (newer wins), so an agent can
also *produce* a partial export and hand it back to be imported.

## Export document

```jsonc
{
  "schemaVersion": 1,
  "exportedAt": "2026-08-03T22:14:00.000Z",
  "app": "life-os",
  "profiles": [ Profile, Profile ],
  "modules": {
    "fitness":  { "sessions": [...], "programStates": [...], "measurements": [...] },
    "grocery":  { "items": [...] },
    "tasks":    { "tasks": [...] }
  }
}
```

Unknown module sections are ignored on import — forward-compatible by design.

## Conventions

Every record shares the base shape:

```ts
{
  id: string          // uuid, stable forever
  profileId: 'david' | 'margs' | 'shared'
  createdAt: string   // ISO 8601
  updatedAt: string   // ISO 8601 — the merge key; bump it when you change a record
}
```

All weights are stored in **lbs** (kg is a display conversion). All dates are
ISO 8601 strings. Static content (the exercise library and program
definitions) is **not** exported — it ships with the app; records reference it
by stable slug (`exerciseId: "trap-bar-deadlift"`, `programId:
"golf-athlete-531"`). Library source:
`src/modules/fitness/content/exercises.json` and
`src/modules/fitness/content/programs.ts`.

## Profile

```ts
{ ...base, profileId: 'david' | 'margs',
  name: string, units: 'lbs' | 'kg',
  barWeightLbs: number, platesLbs: number[],   // per-side inventory
  roundTomorrow: boolean }                     // golf flag: swaps heavy lower work
```

## fitness.sessions — WorkoutSession

```ts
{ ...base,
  status: 'active' | 'finished' | 'discarded',
  programId?: string, programStateId?: string,
  week?: number, day?: number, dayName?: string,
  startedAt: string, finishedAt?: string,
  exercises: [{
    exerciseId: string, slotId?: string, supersetGroup?: string, restSec: number,
    prescribed: [{ setType, targetWeightLbs?, targetReps?, targetRepsMax?, targetRpeCap?, targetSeconds?, amrap? }],
    sets:       [{ id, setType: 'warmup'|'working'|'amrap'|'drop', weightLbs?, reps?, rpe?, seconds?, completedAt }],
    checklistDone?: string[], note?: string
  }],
  notes?: string,
  summary?: { totalVolumeLbs: number, workingSets: number, prEvents: ProgressionEvent[] } }
```

`prescribed` is what the program asked for (frozen at session start);
`sets` is what actually happened. An agent analyzing training should read
`sets` and treat `prescribed` as intent.

## fitness.programStates — ProgramState

```ts
{ ...base,
  programId: string, startDate: string,
  currentWeek: number, currentDay: number,        // pointer to the next un-done day
  trainingMaxes: { [liftKey]: number },           // 5/3/1 TMs, lbs
  cycleCount: number,
  stageState: { [liftKey]: { stageIndex: number, loadLbs: number } },  // GZCLP
  dpLoads: { [programId:slotId]: number },        // double-progression loads
  completedDays: [{ week, day, sessionId }],
  status: 'active' | 'completed' | 'abandoned' }
```

## fitness.measurements — MeasurementEntry

```ts
{ ...base, metric: 'bodyweight'|'waist'|'chest'|'hips'|'arm'|'thigh',
  value: number,      // lbs for bodyweight, inches for girths
  takenAt: string }
```

## grocery.items — GroceryItem

```ts
{ ...base /* profileId: 'shared' */, name: string, checked: boolean, checkedAt?: string }
```

## tasks.tasks — HouseTask

```ts
{ ...base /* profileId: 'shared' */, title: string, done: boolean, doneAt?: string,
  assignee: 'david' | 'margs' | 'both' }
```

## ProgressionEvent (inside session summaries)

```ts
  { type: 'weightPr',  exerciseId, weightLbs, reps }
| { type: 'repPr',     exerciseId, weightLbs, reps, prevReps }
| { type: 'e1rmPr',    exerciseId, e1rm }
| { type: 'tmBump',    liftKey, fromLbs, toLbs }      // wave completed
| { type: 'tmProposal',liftKey, fromLbs, toLbs }      // week-12 test result
| { type: 'stageAdvance', liftKey, toStage }          // GZCLP scheme change
| { type: 'stageReset',   liftKey, newLoadLbs }
| { type: 'dpBump',    slotKey, toLbs }
```

## Writing data back (for agents)

1. Produce a document in the export shape (partial is fine — only the stores
   you touched, but keep the top-level `app`/`schemaVersion` fields).
2. New records: fresh uuid, both timestamps now.
3. Edited records: keep `id` and `createdAt`, set `updatedAt` to now — import
   keeps whichever side is newer.
4. Never renumber `week`/`day` or invent `slotId`s — they must match the
   program content.

## Adding a module (for future layers)

One `ModuleDefinition` in `src/modules/<name>/module.tsx` registered in
`src/modules/index.ts`: routes, a home card, owned store names (add stores in
`src/platform/schema.ts` with a version bump), and `exportData`/`importData`.
The platform handles the rest — routing, the home screen, and the export
envelope pick it up automatically.
