import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext.jsx'
import { ApiError, api } from '../../lib/api.js'
import { isEmail } from '../../lib/validation.js'
import { STATUS_LABELS, STATUS_ORDER, TOTAL_SECTIONS, formatDate } from './format.js'
import { useToast } from './toast.js'
import { Busy, Modal, Panel, SearchBox, StatusPill } from './ui.jsx'

const COLUMNS = [
  ['name', 'Business name'],
  ['email', 'Contact email'],
  ['status', 'Status'],
  ['progress', 'Progress'],
  ['updated', 'Last updated'],
]
const GRID = { gridTemplateColumns: 'minmax(160px,1.3fr) minmax(180px,1.3fr) 150px 160px 108px 196px' }

function sortValue(c, key) {
  if (key === 'progress') return c.done
  if (key === 'status') return STATUS_ORDER.indexOf(c.status)
  if (key === 'updated') return c.updatedAt ?? ''
  return String(c[key] ?? '').toLowerCase()
}

function InvitePanel({ initial, onClose, onSent }) {
  const [form, setForm] = useState({ businessName: '', contactName: '', email: '', note: '', ...initial })
  const [errors, setErrors] = useState({})
  const [sending, setSending] = useState(false)
  const bind = (k) => ({
    value: form[k],
    onChange: (e) => {
      const v = e.target.value
      setForm((f) => ({ ...f, [k]: v }))
      setErrors((er) => ({ ...er, [k]: undefined }))
    },
  })

  async function send() {
    const err = {}
    if (!form.businessName.trim()) err.businessName = 'Enter the business name.'
    if (!form.contactName.trim()) err.contactName = 'Enter who the invite is for.'
    if (!form.email.trim()) err.email = 'Enter their email.'
    else if (!isEmail(form.email)) err.email = 'Enter a valid email address.'
    if (Object.keys(err).length) return setErrors(err)
    setSending(true)
    try {
      await api('/admin/invites', { method: 'POST', body: form })
      onSent(form.email.trim())
    } catch (e) {
      setErrors(e instanceof ApiError && Object.keys(e.fields).length ? e.fields : { email: e.message })
      setSending(false)
    }
  }

  const field = (k, label, props = {}) => (
    <div className="a-field">
      <label htmlFor={`inv-${k}`}>{label}</label>
      <input id={`inv-${k}`} className="a-input" aria-invalid={errors[k] ? 'true' : undefined} {...bind(k)} {...props} />
      {errors[k] && <span className="a-err">{errors[k]}</span>}
    </div>
  )

  return (
    <Panel
      title="Invite a client"
      intro="They'll get an email with a link to create their account. Invites last 7 days."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="a-link grey" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="a-btn" style={{ minWidth: 140 }} onClick={send} disabled={sending}>
            <Busy busy={sending} label="Send invite" busyLabel="Sending" />
          </button>
        </>
      }
    >
      {field('businessName', 'Business name', { placeholder: 'Adefine Jewellery' })}
      {field('contactName', 'Contact name', { placeholder: 'Amara Okafor' })}
      {field('email', 'Contact email', { type: 'email', placeholder: 'name@business.com' })}
      <div className="a-field">
        <label htmlFor="inv-note">
          Personal note <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span>
        </label>
        <textarea
          id="inv-note"
          className="a-textarea"
          placeholder="Great speaking with you on Tuesday. Here's your link to get started."
          {...bind('note')}
        />
        <span className="a-hint">Added to the top of the invite email.</span>
      </div>
    </Panel>
  )
}

export default function Submissions() {
  const { user } = useAuth()
  const canEdit = user.role === 'admin'
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()

  const [clients, setClients] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState({ key: 'updated', dir: 'desc' })
  const [invite, setInvite] = useState(null) // prefill for the open invite panel
  const [confirm, setConfirm] = useState(null)

  const load = useCallback(async () => {
    try {
      setClients((await api('/admin/clients')).clients)
    } catch (err) {
      setLoadError(err.message)
    }
  }, [])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    load()
  }, [load])

  // "Invite to onboarding" on the Leads page arrives here with the details in the URL.
  useEffect(() => {
    if (params.get('invite') !== '1' || !canEdit) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInvite({ businessName: params.get('biz') ?? '', contactName: params.get('name') ?? '', email: params.get('email') ?? '' })
    setParams({}, { replace: true })
  }, [params, setParams, canEdit])

  // A client deleted on the detail page comes back here with a confirmation.
  useEffect(() => {
    const deleted = location.state?.deleted
    if (!deleted) return
    toast(`${deleted} was deleted.`)
    navigate(location.pathname, { replace: true, state: null })
  }, [location, navigate, toast])

  const view = useMemo(() => {
    const all = clients ?? []
    const active = all.filter((c) => !c.archived)
    const archived = all.filter((c) => c.archived)
    const count = (k) => active.filter((c) => c.status === k).length
    const pool = filter === 'archived' ? archived : active.filter((c) => filter === 'all' || c.status === filter)
    const q = query.trim().toLowerCase()
    const rows = pool
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
      .sort((a, b) => {
        const x = sortValue(a, sort.key)
        const y = sortValue(b, sort.key)
        const r = x < y ? -1 : x > y ? 1 : 0
        return sort.dir === 'asc' ? r : -r
      })
    const filters = [['all', 'All', active.length], ...STATUS_ORDER.map((k) => [k, STATUS_LABELS[k], count(k)]), ['archived', 'Archived', archived.length]]
    return { all, active, archived, rows, filters, stats: STATUS_ORDER.map((k) => ({ k, value: count(k) })) }
  }, [clients, filter, query, sort])

  const toggleSort = (key) =>
    setSort((s) => ({ key, dir: s.key === key ? (s.dir === 'asc' ? 'desc' : 'asc') : key === 'updated' || key === 'progress' ? 'desc' : 'asc' }))

  const act = async (fn, message) => {
    try {
      await fn()
      toast(message)
      await load()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const resend = (c) => act(() => api(`/admin/invites/${c.id}/resend`, { method: 'POST', body: {} }), `Invite resent to ${c.email}.`)
  const restore = (c) => act(() => api(`/admin/clients/${c.id}/restore`, { method: 'POST', body: {} }), `${c.name} restored.`)
  const askRevoke = (c) =>
    setConfirm({
      title: 'Revoke this invite?',
      body: `The link sent to ${c.email} will stop working. You can invite ${c.name} again later.`,
      label: 'Revoke invite',
      run: () => act(() => api(`/admin/invites/${c.id}`, { method: 'DELETE' }), `Invite to ${c.email} revoked.`),
    })

  const progress = (c) =>
    c.status === 'invited' ? (c.inviteExpired ? 'Invite expired' : `Invite sent ${formatDate(c.invitedAt, { year: false })}`) : `${c.done} of ${TOTAL_SECTIONS} sections`
  const href = (c) => `/admin/submissions/${c.id}`

  const rowActions = (c, mobile) => {
    if (c.archived) {
      return canEdit ? (
        <button type="button" className="a-btn-outline sm" style={mobile ? { flex: 1 } : undefined} onClick={() => restore(c)}>
          Restore
        </button>
      ) : null
    }
    if (c.kind === 'invite') {
      return canEdit ? (
        <>
          <button type="button" className="a-link" onClick={() => resend(c)}>
            Resend invite
          </button>
          <button type="button" className="a-link grey" style={mobile ? { marginLeft: 'auto' } : undefined} onClick={() => askRevoke(c)}>
            Revoke invite
          </button>
        </>
      ) : null
    }
    return (
      <Link to={href(c)} className="a-btn-outline sm" style={mobile ? { flex: 1 } : undefined}>
        View
      </Link>
    )
  }

  const Name = ({ c }) => (c.kind === 'invite' ? <span style={{ fontWeight: 600 }}>{c.name}</span> : <Link to={href(c)}>{c.name}</Link>)

  return (
    <div className="adm-wrap">
      <div className="page-head">
        <div>
          <h1 className="page">Submissions</h1>
          <div className="page-sub">{clients ? `${view.active.length} active clients` : ' '}</div>
        </div>
        {canEdit && (
          <button type="button" className="a-btn" onClick={() => setInvite({})}>
            <span style={{ fontSize: 17, lineHeight: 1 }}>+</span>Invite client
          </button>
        )}
      </div>

      <div className="stats">
        {view.stats.map((s) => (
          <div key={s.k} className="stat">
            <div className="v">{clients ? s.value : '–'}</div>
            <div className="l">{STATUS_LABELS[s.k]}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 28 }}>
        <SearchBox value={query} onChange={setQuery} />
        <div className="filters">
          {view.filters.map(([k, label, n]) => (
            <button key={k} type="button" className={`filter${filter === k ? ' on' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {label}
              <span className="n">{n}</span>
            </button>
          ))}
        </div>
      </div>

      {loadError && <div className="box empty-box">{loadError}</div>}
      {!clients && !loadError && <div className="box empty-box">Loading clients…</div>}

      {clients && view.all.length === 0 && (
        <div className="box empty-box">
          <p style={{ margin: 0, maxWidth: 360 }}>No submissions yet. When clients start their onboarding, they&apos;ll show up here.</p>
        </div>
      )}
      {clients && view.all.length > 0 && view.rows.length === 0 && (
        <div className="box empty-box">
          <p style={{ margin: 0 }}>{query.trim() ? 'No clients match that search.' : filter === 'archived' ? 'No archived clients.' : 'No clients with this status.'}</p>
          <button
            type="button"
            className="a-btn-outline sm"
            onClick={() => {
              setQuery('')
              setFilter('all')
            }}
          >
            Show all clients
          </button>
        </div>
      )}

      {view.rows.length > 0 && (
        <>
          <div className="box table desktop-only">
            <div style={{ minWidth: 1082 }}>
              <div className="row head" style={GRID}>
                {COLUMNS.map(([k, label]) => (
                  <button key={k} type="button" className={`sort${sort.key === k ? ' on' : ''}`} onClick={() => toggleSort(k)}>
                    {label}
                    <span className="arr">{sort.key === k ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}</span>
                  </button>
                ))}
                <span />
              </div>
              {view.rows.map((c) => (
                <div key={`${c.kind}-${c.id}`} className="row" style={GRID}>
                  <div className="cell-name">
                    <div className="clip">
                      <Name c={c} />
                    </div>
                    <div className="small clip">{c.contact}</div>
                  </div>
                  <span className="muted clip">{c.email}</span>
                  <span>
                    <StatusPill status={c.status} />
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 13 }}>{progress(c)}</span>
                    {c.status !== 'invited' && (
                      <span className={`bar${c.status === 'submitted' ? ' done' : ''}`}>
                        <span style={{ width: `${(c.done / TOTAL_SECTIONS) * 100}%` }} />
                      </span>
                    )}
                  </div>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {formatDate(c.updatedAt)}
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>{rowActions(c, false)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="cards mobile-only">
            {view.rows.map((c) => (
              <div key={`${c.kind}-${c.id}`} className="card-row">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div className="cell-name" style={{ flex: 1, fontSize: 15 }}>
                    <Name c={c} />
                    <div className="small" style={{ overflowWrap: 'anywhere' }}>
                      {c.email}
                    </div>
                  </div>
                  <StatusPill status={c.status} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, fontSize: 13 }} className="muted">
                  <span style={{ color: 'var(--ink)' }}>{progress(c)}</span>
                  {c.status !== 'invited' && (
                    <span className={`bar${c.status === 'submitted' ? ' done' : ''}`} style={{ flex: 1, maxWidth: 120 }}>
                      <span style={{ width: `${(c.done / TOTAL_SECTIONS) * 100}%` }} />
                    </span>
                  )}
                  <span style={{ marginLeft: 'auto' }}>{formatDate(c.updatedAt)}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--line-3)' }}>{rowActions(c, true)}</div>
              </div>
            ))}
          </div>
          <div className="small" style={{ marginTop: 12 }}>
            Showing {view.rows.length} of {filter === 'archived' ? `${view.archived.length} archived clients` : `${view.active.length} clients`}
          </div>
        </>
      )}

      {invite && (
        <InvitePanel
          initial={invite}
          onClose={() => setInvite(null)}
          onSent={(email) => {
            setInvite(null)
            setFilter('all')
            toast(`Invite sent to ${email}.`)
            load()
          }}
        />
      )}

      {confirm && (
        <Modal
          alert
          title={confirm.title}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button type="button" className="a-link grey" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="a-btn-outline danger"
                onClick={() => {
                  confirm.run()
                  setConfirm(null)
                }}
              >
                {confirm.label}
              </button>
            </>
          }
        >
          <p className="sheet-text" style={{ fontSize: 14.5 }}>
            {confirm.body}
          </p>
        </Modal>
      )}
    </div>
  )
}
