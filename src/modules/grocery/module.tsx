import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { BaseRecord, ModuleDefinition } from '../../platform/types'
import { STORES } from '../../platform/schema'
import { del, getAll, put } from '../../platform/db'
import { mergeRecords } from '../../platform/exportImport'
import { nowIso, uuid } from '../../platform/ids'

export interface GroceryItem extends BaseRecord {
  name: string
  checked: boolean
  checkedAt?: string
}

async function getItems(): Promise<GroceryItem[]> {
  const all = await getAll<GroceryItem>(STORES.grocery)
  return all.sort((a, b) => {
    if (a.checked !== b.checked) return a.checked ? 1 : -1
    return b.createdAt.localeCompare(a.createdAt)
  })
}

function GroceryScreen() {
  const [items, setItems] = useState<GroceryItem[]>([])
  const [name, setName] = useState('')

  const refresh = () => void getItems().then(setItems)
  useEffect(refresh, [])

  const add = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const now = nowIso()
    await put(STORES.grocery, {
      id: uuid(),
      profileId: 'shared',
      createdAt: now,
      updatedAt: now,
      name: trimmed,
      checked: false,
    } satisfies GroceryItem)
    setName('')
    refresh()
  }

  const toggle = async (item: GroceryItem) => {
    await put(STORES.grocery, {
      ...item,
      checked: !item.checked,
      checkedAt: !item.checked ? nowIso() : undefined,
      updatedAt: nowIso(),
    })
    refresh()
  }

  const clearChecked = async () => {
    for (const item of items.filter((i) => i.checked)) {
      await del(STORES.grocery, item.id)
    }
    refresh()
  }

  const checkedCount = items.filter((i) => i.checked).length

  return (
    <main className="screen">
      <form
        className="hstack"
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <input
          className="input"
          placeholder="Add to the list"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn small primary" type="submit" style={{ padding: '12px 18px' }}>
          Add
        </button>
      </form>

      {items.length === 0 && <div className="empty">The shared list is empty. Nice.</div>}
      <div className="list">
        {items.map((item) => (
          <button key={item.id} className={`row ${item.checked ? 'done' : ''}`} onClick={() => void toggle(item)}>
            <div className="grow">
              <div className="title">{item.name}</div>
            </div>
            <span className={`setcheck ${item.checked ? 'done' : ''}`} style={{ width: 26, height: 26, fontSize: 12 }}>
              ✓
            </span>
          </button>
        ))}
      </div>
      {checkedCount > 0 && (
        <button className="btn ghost faint" onClick={() => void clearChecked()}>
          Clear {checkedCount} checked
        </button>
      )}
    </main>
  )
}

function GroceryHomeCard() {
  const [openCount, setOpenCount] = useState<number | null>(null)
  useEffect(() => {
    void getItems().then((items) => setOpenCount(items.filter((i) => !i.checked).length))
  }, [])
  return (
    <Link to="/grocery" className="card" style={{ display: 'block' }}>
      <div className="kicker">Grocery</div>
      <h2>{openCount === null ? '…' : openCount === 0 ? 'List clear' : `${openCount} to get`}</h2>
      <div className="sub" style={{ marginTop: 4 }}>Shared list — either of you, any device</div>
    </Link>
  )
}

export const groceryModule: ModuleDefinition = {
  id: 'grocery',
  title: 'Grocery',
  basePath: '/grocery',
  HomeCard: GroceryHomeCard,
  stores: [STORES.grocery],
  routes: [{ path: '', element: <GroceryScreen /> }],
  async exportData() {
    return { items: await getAll<GroceryItem>(STORES.grocery) }
  },
  async importData(section, mode) {
    const s = (section ?? {}) as { items?: GroceryItem[] }
    return mergeRecords(STORES.grocery, s.items ?? [], mode)
  },
}
