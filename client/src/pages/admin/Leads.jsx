import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext.jsx'
import { api } from '../../lib/api.js'
import { STAGE_LABELS, STAGE_ORDER, formatDate } from './format.js'
import { useToast } from './toast.js'
import { Pill, SearchBox } from './ui.jsx'

const GRID = { gridTemplateColumns: 'minmax(170px,1.4fr) 150px 150px minmax(170px,1.3fr) 110px 120px 104px 150px 190px' }
const CHEVRON = (hex) =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(hex)}' stroke-width='2.6' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`
// Colours of each stage pill, matched by the stage dropdown.
const STAGE_COLOURS = {
  new: { bg: 'transparent', fg: '#4A453F', border: '1px dashed rgba(26,23,20,0.35)' },
  booked: { bg: '#E4DDD0', fg: '#1A1714', border: '1px solid transparent' },
  won: { bg: '#D9714E', fg: '#FFFFFF', border: '1px solid #D9714E' },
  notfit: { bg: '#EFEAE0', fg: '#6B655C', border: '1px solid transparent' },
}

function StageSelect({ lead, onChange }) {
  const c = STAGE_COLOURS[lead.stage]
  return (
    <select
      className="lead-stage"
      aria-label={`Stage for ${lead.businessName}`}
      value={lead.stage}
      onChange={(e) => onChange(e.target.value)}
      style={{ backgroundColor: c.bg, color: c.fg, border: c.border, backgroundImage: CHEVRON(c.fg) }}
    >
      {STAGE_ORDER.map((k) => (
        <option key={k} value={k}>
          {STAGE_LABELS[k]}
        </option>
      ))}
    </select>
  )
}

export default function Leads() {
  const { user } = useAuth()
  const canEdit = user.role === 'admin'
  const toast = useToast()
  const [leads, setLeads] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')

  const load = useCallback(async () => {
    try {
      setLeads((await api('/admin/leads')).leads)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    load()
  }, [load])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (leads ?? []).filter((l) => (filter === 'all' || l.stage === filter) && (!q || l.businessName.toLowerCase().includes(q) || l.email.toLowerCase().includes(q)))
  }, [leads, query, filter])

  const setStage = async (lead, stage) => {
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, stage } : l)))
    try {
      await api(`/admin/leads/${lead.id}`, { method: 'PATCH', body: { stage } })
      toast(`${lead.businessName} moved to ${STAGE_LABELS[stage]}.`)
    } catch (err) {
      toast(err.message, 'error')
      load()
    }
  }

  const inviteHref = (l) =>
    `/admin/submissions?${new URLSearchParams({ invite: '1', biz: l.businessName, name: l.contactName, email: l.email })}`
  const stage = (l) => (canEdit ? <StageSelect lead={l} onChange={(v) => setStage(l, v)} /> : <Pill kind={l.stage}>{STAGE_LABELS[l.stage]}</Pill>)
  const call = (l) => <span style={{ whiteSpace: 'nowrap', color: l.callDate ? 'var(--ink)' : 'var(--faint)' }}>{l.callDate ? formatDate(l.callDate) : 'Not booked'}</span>
  const counts = Object.fromEntries(STAGE_ORDER.map((k) => [k, (leads ?? []).filter((l) => l.stage === k).length]))

  return (
    <div className="adm-wrap">
      <h1 className="page">Leads</h1>
      <div className="page-sub">People who booked a call from the landing page.</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
        <SearchBox value={query} onChange={setQuery} />
        <div className="filters">
          {[['all', 'All', (leads ?? []).length], ...STAGE_ORDER.map((k) => [k, STAGE_LABELS[k], counts[k]])].map(([k, label, n]) => (
            <button key={k} type="button" className={`filter${filter === k ? ' on' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {label}
              <span className="n">{n}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <div className="box empty-box">{error}</div>}
      {!leads && !error && <div className="box empty-box">Loading leads…</div>}
      {leads && rows.length === 0 && (
        <div className="box empty-box">
          {leads.length === 0 ? "No leads yet. When someone books a call from the landing page, they'll show up here." : 'No leads match that search.'}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="box table desktop-only">
            <div style={{ minWidth: 1492 }}>
              <div className="row head" style={GRID}>
                <span>Business</span>
                <span>Type</span>
                <span>Phone</span>
                <span>Email</span>
                <span>Budget</span>
                <span>Timeline</span>
                <span>Call date</span>
                <span>Stage</span>
                <span />
              </div>
              {rows.map((l) => (
                <div key={l.id} className="row" style={{ ...GRID, fontSize: 13.5, padding: '8px 24px' }}>
                  <div className="cell-name">
                    <div className="clip" style={{ fontWeight: 600 }}>
                      {l.businessName}
                    </div>
                    <div className="small">{l.contactName}</div>
                  </div>
                  <span className="muted">{l.businessType}</span>
                  <a href={`tel:${l.phone.replace(/\s/g, '')}`} style={{ color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                    {l.phone}
                  </a>
                  <a href={`mailto:${l.email}`} className="clip" style={{ color: 'var(--ink)' }}>
                    {l.email}
                  </a>
                  <span>{l.budget}</span>
                  <span className="muted">{l.timeline}</span>
                  {call(l)}
                  <span>{stage(l)}</span>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    {canEdit && l.stage === 'won' && (
                      <Link to={inviteHref(l)} className="a-btn sm">
                        Invite to onboarding
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="cards mobile-only">
            {rows.map((l) => (
              <div key={l.id} className="card-row">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{l.businessName}</div>
                    <div className="small">{[l.contactName, l.businessType].filter(Boolean).join(' · ')}</div>
                  </div>
                  {stage(l)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', marginTop: 12, fontSize: 13.5 }}>
                  <span className="muted">Phone</span>
                  <a href={`tel:${l.phone.replace(/\s/g, '')}`} style={{ color: 'var(--ink)' }}>
                    {l.phone || '—'}
                  </a>
                  <span className="muted">Email</span>
                  <a href={`mailto:${l.email}`} style={{ color: 'var(--ink)', overflowWrap: 'anywhere' }}>
                    {l.email}
                  </a>
                  <span className="muted">Budget</span>
                  <span>{l.budget || '—'}</span>
                  <span className="muted">Timeline</span>
                  <span>{l.timeline || '—'}</span>
                  <span className="muted">Call date</span>
                  {call(l)}
                </div>
                {canEdit && l.stage === 'won' && (
                  <Link to={inviteHref(l)} className="a-btn" style={{ width: '100%', marginTop: 14 }}>
                    Invite to onboarding
                  </Link>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
