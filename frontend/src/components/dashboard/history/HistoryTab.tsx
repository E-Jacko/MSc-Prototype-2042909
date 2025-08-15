// single-column list of flows; filter + sort + refresh.
// any tx created by the connected identity is highlighted blue.

import { useEffect, useMemo, useState } from 'react'
import { useIdentity } from '../../../context/IdentityContext'
import HistoryRow from './HistoryRow'
import { fetchFlows, type FlowRow } from './HistoryApi'

const OVERLAY_API =
  (import.meta as any)?.env?.VITE_OVERLAY_API ?? 'http://localhost:8080'

type FilterMode = 'all' | 'my-orders' | 'my-commitments'
type SortMode = 'recent' | 'oldest'

export default function HistoryTab() {
  const { identityKey } = useIdentity()

  const [filter, setFilter] = useState<FilterMode>('all')
  const [sort, setSort] = useState<SortMode>('recent')
  const [rows, setRows] = useState<FlowRow[]>([])
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await fetchFlows({
        apiBase: OVERLAY_API,
        mode: filter,
        limit: 50,
        actorKey: identityKey ?? null,
        sort
      })
      setRows(data)
    } catch (e) {
      console.error('[HistoryTab] load failed', e)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  // load on mount and whenever filter/sort or identity changes
  useEffect(() => { void load() }, [filter, sort, identityKey])

  const title = useMemo(() => 'History', [])
  const statusText = loading ? 'Loading…' : rows.length ? `Showing ${rows.length} flow(s)` : 'No flows yet.'

  return (
    <div style={{ paddingTop: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ margin: 0, flex: 1 }}>{title}</h2>

        {/* filter */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>Filter</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value as FilterMode)}>
            <option value="all">All flows</option>
            <option value="my-orders">My orders</option>
            <option value="my-commitments">My commitments</option>
          </select>
        </label>

        {/* sort */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
            <option value="recent">Most recent</option>
            <option value="oldest">Oldest</option>
          </select>
        </label>

        <button onClick={() => void load()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>{statusText}</div>

      {/* flows */}
      <div style={{ marginTop: 16, display: 'grid', rowGap: 12 }}>
        {rows.map((r, i) => (
          <HistoryRow key={i} row={r} myKey={identityKey ?? null} />
        ))}
      </div>
    </div>
  )
}
