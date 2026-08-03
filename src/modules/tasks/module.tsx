import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { BaseRecord, ModuleDefinition, ProfileId } from '../../platform/types'
import { STORES } from '../../platform/schema'
import { getAll, put } from '../../platform/db'
import { mergeRecords } from '../../platform/exportImport'
import { nowIso, uuid } from '../../platform/ids'
import { useApp } from '../../platform/store'
import { notDeleted, softDelete } from '../../platform/tombstones'

export interface HouseTask extends BaseRecord {
  title: string
  done: boolean
  doneAt?: string
  assignee: ProfileId | 'both'
}

async function getTasks(): Promise<HouseTask[]> {
  const all = notDeleted(await getAll<HouseTask>(STORES.tasks))
  return all.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    return b.createdAt.localeCompare(a.createdAt)
  })
}

function TasksScreen() {
  const profiles = useApp((s) => s.profiles)
  const activeProfileId = useApp((s) => s.activeProfileId)
  const [tasks, setTasks] = useState<HouseTask[]>([])
  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState<ProfileId | 'both'>(activeProfileId)
  const syncTick = useApp((s) => s.syncTick)

  const refresh = () => void getTasks().then(setTasks)
  useEffect(refresh, [syncTick])

  const nameOf = (id: ProfileId | 'both') =>
    id === 'both' ? 'Both' : profiles.find((p) => p.profileId === id)?.name ?? id

  const add = async () => {
    const trimmed = title.trim()
    if (!trimmed) return
    const now = nowIso()
    await put(STORES.tasks, {
      id: uuid(),
      profileId: 'shared',
      createdAt: now,
      updatedAt: now,
      title: trimmed,
      done: false,
      assignee,
    } satisfies HouseTask)
    setTitle('')
    refresh()
  }

  const toggle = async (task: HouseTask) => {
    await put(STORES.tasks, {
      ...task,
      done: !task.done,
      doneAt: !task.done ? nowIso() : undefined,
      updatedAt: nowIso(),
    })
    refresh()
  }

  const clearDone = async () => {
    for (const t of tasks.filter((t) => t.done)) {
      await softDelete(STORES.tasks, t)
    }
    refresh()
  }

  const doneCount = tasks.filter((t) => t.done).length

  return (
    <main className="screen">
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <input
          className="input"
          placeholder="What needs doing?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="hstack">
          {([...profiles.map((p) => p.profileId), 'both'] as Array<ProfileId | 'both'>).map((a) => (
            <button
              key={a}
              type="button"
              className={`chip ${assignee === a ? 'on' : ''}`}
              onClick={() => setAssignee(a)}
            >
              {nameOf(a)}
            </button>
          ))}
          <span className="grow" />
          <button className="btn small primary" type="submit">
            Add
          </button>
        </div>
      </form>

      {tasks.length === 0 && <div className="empty">Nothing on the board.</div>}
      <div className="list">
        {tasks.map((task) => (
          <button key={task.id} className={`row ${task.done ? 'done' : ''}`} onClick={() => void toggle(task)}>
            <div className="grow">
              <div className="title">{task.title}</div>
              <div className="sub">{nameOf(task.assignee)}</div>
            </div>
            <span className={`setcheck ${task.done ? 'done' : ''}`} style={{ width: 26, height: 26, fontSize: 12 }}>
              ✓
            </span>
          </button>
        ))}
      </div>
      {doneCount > 0 && (
        <button className="btn ghost faint" onClick={() => void clearDone()}>
          Clear {doneCount} done
        </button>
      )}
    </main>
  )
}

function TasksHomeCard({ profileId }: { profileId: ProfileId }) {
  const syncTick = useApp((s) => s.syncTick)
  const [mine, setMine] = useState<number | null>(null)
  useEffect(() => {
    void getTasks().then((tasks) =>
      setMine(tasks.filter((t) => !t.done && (t.assignee === profileId || t.assignee === 'both')).length),
    )
  }, [profileId, syncTick])
  return (
    <Link to="/tasks" className="card" style={{ display: 'block' }}>
      <div className="kicker">Tasks</div>
      <h2>{mine === null ? '…' : mine === 0 ? 'All clear' : `${mine} for you`}</h2>
      <div className="sub" style={{ marginTop: 4 }}>Small asks between the two of you</div>
    </Link>
  )
}

export const tasksModule: ModuleDefinition = {
  id: 'tasks',
  title: 'Tasks',
  basePath: '/tasks',
  HomeCard: TasksHomeCard,
  stores: [STORES.tasks],
  routes: [{ path: '', element: <TasksScreen /> }],
  async exportData() {
    return { tasks: await getAll<HouseTask>(STORES.tasks) }
  },
  async importData(section, mode) {
    const s = (section ?? {}) as { tasks?: HouseTask[] }
    return mergeRecords(STORES.tasks, s.tasks ?? [], mode)
  },
}
