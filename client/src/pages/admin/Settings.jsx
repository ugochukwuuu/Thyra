import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthContext.jsx'
import { ApiError, api } from '../../lib/api.js'
import { isEmail } from '../../lib/validation.js'
import { initials } from './format.js'
import { useToast } from './toast.js'
import { Switch } from './ui.jsx'

const GROUPS = [
  ['account', 'Account', false],
  ['team', 'Team', true],
  ['notif', 'Notifications', false],
  ['onboarding', 'Onboarding form', true],
  ['export', 'Export', true],
]
const NOTIFS = [
  ['signup', 'New client sign-up', 'Email me when someone creates an account.'],
  ['submitted', 'Onboarding submitted', 'Email me when a client confirms their details.'],
  ['stalled', 'Onboarding stalled', "Email me when a client hasn't continued for 7 days."],
  ['weekly', 'Weekly summary', 'A Monday email with new sign-ups and submissions.'],
]
const EXPIRY = [
  [24, '24 hours'],
  [48, '48 hours'],
  [168, '7 days'],
]
const STOCK = [
  ['instock', 'In stock'],
  ['outofstock', 'Out of stock'],
  ['onbackorder', 'On backorder'],
]
const ROLE_LABEL = { admin: 'Admin', viewer: 'Viewer' }

let nextId = 0
const toRows = (list) => list.map((v) => ({ id: `r${nextId++}`, v }))
const fromRows = (rows) => rows.map((r) => r.v)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

function Field({ id, label, error, hint, children }) {
  return (
    <div className="a-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && <span className="a-err">{error}</span>}
      {hint && <span className="a-hint">{hint}</span>}
    </div>
  )
}

function ListEditor({ title, hint, rows, placeholder, addLabel, onChange }) {
  return (
    <div>
      <div className="a-label" style={{ marginBottom: 4 }}>
        {title}
      </div>
      <div className="a-hint" style={{ marginBottom: 12 }}>
        {hint}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((r, i) => (
          <div key={r.id} className="list-row">
            <input
              className="a-input"
              aria-label={`${title} ${i + 1}`}
              placeholder={placeholder}
              value={r.v}
              onChange={(e) => onChange(rows.map((x) => (x.id === r.id ? { ...x, v: e.target.value } : x)))}
            />
            <button type="button" className="round-btn" title="Remove" aria-label={`Remove ${r.v || placeholder}`} onClick={() => onChange(rows.filter((x) => x.id !== r.id))}>
              –
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="a-link" style={{ padding: '6px 0', marginTop: 10 }} onClick={() => onChange([...rows, ...toRows([''])])}>
        + {addLabel}
      </button>
    </div>
  )
}

export default function Settings() {
  const { user, setUser } = useAuth()
  const isAdmin = user.role === 'admin'
  const toast = useToast()
  const groups = GROUPS.filter(([, , adminOnly]) => isAdmin || !adminOnly)

  const [group, setGroup] = useState('account')
  const [saved, setSaved] = useState(null)
  const [draft, setDraft] = useState(null)
  const [members, setMembers] = useState([])
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [invite, setInvite] = useState(null) // { email, role, error } while the invite row is open
  const [confirmId, setConfirmId] = useState(null)
  const [resent, setResent] = useState({})
  // Read through a ref so saving the account (which updates the user) doesn't reload every group.
  const userRef = useRef(user)
  useEffect(() => {
    userRef.current = user
  }, [user])

  const load = useCallback(async () => {
    const [{ notifications }, settings, team] = await Promise.all([
      api('/admin/me/notifications'),
      isAdmin ? api('/admin/settings') : Promise.resolve(null),
      isAdmin ? api('/admin/team') : Promise.resolve(null),
    ])
    const s = {
      account: { fullName: userRef.current.fullName ?? '', email: userRef.current.email },
      notif: notifications,
      onboarding: settings && {
        ...settings.settings.onboarding,
        businessTypes: toRows(settings.settings.onboarding.businessTypes),
        socialPlatforms: toRows(settings.settings.onboarding.socialPlatforms),
      },
      export: settings?.settings.export ?? null,
      team: Object.fromEntries((team?.members ?? []).map((m) => [m.id, m.role])),
    }
    setSaved(s)
    setDraft(structuredClone(s))
    if (team) setMembers([...team.members, ...team.invites])
  }, [isAdmin, setSaved, setDraft, setMembers])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    load().catch((err) => toast(err.message, 'error'))
  }, [load, toast])

  if (!draft) return <div className="adm-wrap narrow">Loading…</div>

  const dirtyGroup = (g) => {
    if (g === 'account') return !same(draft.account, saved.account) || Boolean(pw.current || pw.next || pw.confirm)
    if (g === 'team') return !same(draft.team, saved.team)
    if (g === 'notif') return !same(draft.notif, saved.notif)
    return !same(draft[g], saved[g])
  }
  const dirty = dirtyGroup(group)
  const set = (g, patch) => {
    setDraft((d) => ({ ...d, [g]: { ...d[g], ...patch } }))
    setErrors({})
  }

  const discard = () => {
    setDraft((d) => ({ ...d, [group]: structuredClone(saved[group]) }))
    if (group === 'account') setPw({ current: '', next: '', confirm: '' })
    setErrors({})
  }

  async function save() {
    setErrors({})
    const fail = (errs) => setErrors(errs)
    try {
      setSaving(true)
      if (group === 'account') {
        const a = draft.account
        const err = {}
        if (!a.fullName.trim()) err.fullName = 'Enter your name.'
        if (!isEmail(a.email)) err.email = 'Enter a valid email address.'
        if (pw.next && pw.next.length < 8) err.newPassword = 'Use at least 8 characters.'
        if (pw.next && pw.confirm !== pw.next) err.confirmPassword = "Those passwords don't match."
        if ((pw.next || a.email.trim().toLowerCase() !== saved.account.email) && !pw.current) err.currentPassword = 'Enter your current password.'
        if (Object.keys(err).length) return fail(err)
        const { user: updated } = await api('/admin/me/account', {
          method: 'PUT',
          body: { fullName: a.fullName, email: a.email, currentPassword: pw.current, newPassword: pw.next, confirmPassword: pw.confirm },
        })
        setUser(updated)
        const acc = { fullName: updated.fullName ?? '', email: updated.email }
        setSaved((s) => ({ ...s, account: acc }))
        setDraft((d) => ({ ...d, account: acc }))
        setPw({ current: '', next: '', confirm: '' })
      } else if (group === 'notif') {
        if (!isEmail(draft.notif.to)) return fail({ to: 'Enter a valid email address.' })
        const { notifications } = await api('/admin/me/notifications', { method: 'PUT', body: draft.notif })
        setSaved((s) => ({ ...s, notif: notifications }))
        setDraft((d) => ({ ...d, notif: notifications }))
      } else if (group === 'onboarding') {
        const o = draft.onboarding
        if (o.replyTo.trim() && !isEmail(o.replyTo)) return fail({ replyTo: 'Enter a valid email address.' })
        const body = { ...o, businessTypes: fromRows(o.businessTypes), socialPlatforms: fromRows(o.socialPlatforms), replyTo: o.replyTo.trim() }
        await api('/admin/settings/onboarding', { method: 'PUT', body })
        // Reload to pick up how the server cleaned the lists (blanks and duplicates removed).
        await load()
      } else if (group === 'export') {
        const { settings } = await api('/admin/settings/export', { method: 'PUT', body: draft.export })
        setSaved((s) => ({ ...s, export: settings }))
        setDraft((d) => ({ ...d, export: settings }))
      } else if (group === 'team') {
        const changed = Object.entries(draft.team).filter(([id, role]) => saved.team[id] !== role)
        for (const [id, role] of changed) await api(`/admin/team/${id}`, { method: 'PATCH', body: { role } })
        setSaved((s) => ({ ...s, team: { ...draft.team } }))
      }
      toast('Changes saved.')
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) fail(err.fields)
      else toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function sendInvite() {
    const email = invite.email.trim()
    if (!isEmail(email)) return setInvite({ ...invite, error: 'Enter a valid email address.' })
    try {
      await api('/admin/team/invites', { method: 'POST', body: { email, role: invite.role } })
      setInvite(null)
      toast(`Invite sent to ${email}.`)
      const team = await api('/admin/team')
      setMembers([...team.members, ...team.invites])
    } catch (err) {
      setInvite({ ...invite, error: err.fields?.email ?? err.message })
    }
  }

  async function remove(m) {
    try {
      await api(m.kind === 'invite' ? `/admin/invites/${m.id}` : `/admin/team/${m.id}`, { method: 'DELETE' })
      setMembers((ms) => ms.filter((x) => x.id !== m.id))
      setConfirmId(null)
      const strip = (t) => Object.fromEntries(Object.entries(t).filter(([id]) => id !== m.id))
      setSaved((s) => ({ ...s, team: strip(s.team) }))
      setDraft((d) => ({ ...d, team: strip(d.team) }))
      toast(m.kind === 'invite' ? 'Invite cancelled.' : `${m.name || m.email} removed.`)
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  async function resend(m) {
    try {
      await api(`/admin/invites/${m.id}/resend`, { method: 'POST', body: {} })
      setResent((r) => ({ ...r, [m.id]: true }))
      toast(`Invite resent to ${m.email}.`)
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const a = draft.account
  const n = draft.notif
  const o = draft.onboarding
  const x = draft.export

  return (
    <div className="adm-wrap narrow">
      <h1 className="page">Settings</h1>

      <div className="settings-body">
        <div className="box groups" role="tablist" aria-label="Settings groups">
          {groups.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={group === k} className={`group-btn${group === k ? ' on' : ''}`} onClick={() => setGroup(k)}>
              <span style={{ flex: 1 }}>{label}</span>
              {dirtyGroup(k) && <span className="dot" title="Unsaved changes" />}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {group === 'account' && (
            <>
              <div className="box box-pad">
                <h2>Account</h2>
                <p className="lead">Your name and the email you log in with.</p>
                <div className="grid2">
                  <Field id="acc-name" label="Full name" error={errors.fullName}>
                    <input id="acc-name" className="a-input" value={a.fullName} onChange={(e) => set('account', { fullName: e.target.value })} />
                  </Field>
                  <Field id="acc-email" label="Email address" error={errors.email}>
                    <input id="acc-email" type="email" className="a-input" value={a.email} onChange={(e) => set('account', { email: e.target.value })} />
                  </Field>
                </div>
              </div>
              <div className="box box-pad">
                <h2>Change password</h2>
                <p className="lead">Leave these blank to keep your current password. Changing your email also needs your current password.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400 }}>
                  {[
                    ['current', 'Current password', 'currentPassword', 'current-password', ''],
                    ['next', 'New password', 'newPassword', 'new-password', 'At least 8 characters'],
                    ['confirm', 'Confirm new password', 'confirmPassword', 'new-password', ''],
                  ].map(([k, label, errKey, auto, ph]) => (
                    <Field key={k} id={`pw-${k}`} label={label} error={errors[errKey]}>
                      <input
                        id={`pw-${k}`}
                        type="password"
                        className="a-input"
                        autoComplete={auto}
                        placeholder={ph}
                        value={pw[k]}
                        onChange={(e) => {
                          setPw((p) => ({ ...p, [k]: e.target.value }))
                          setErrors({})
                        }}
                      />
                    </Field>
                  ))}
                </div>
              </div>
            </>
          )}

          {group === 'team' && (
            <div className="box box-pad">
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ flex: '1 1 320px', minWidth: 200 }}>
                  <h2>Team</h2>
                  <p style={{ margin: 0, fontSize: 13.5 }} className="muted">
                    Admins have full access and can change settings. Viewers can view and export submissions. Invites and removals take effect right away; role changes need saving.
                  </p>
                </div>
                {!invite && (
                  <button type="button" className="a-btn-outline sm" onClick={() => setInvite({ email: '', role: 'viewer', error: '' })}>
                    <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>Invite team member
                  </button>
                )}
              </div>

              {invite && (
                <div className="req-box" style={{ margin: '20px 0 0', padding: 16 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                    <input
                      type="email"
                      className="a-input"
                      aria-label="Email"
                      placeholder="name@thyratechnology.com"
                      style={{ flex: '1 1 220px', minHeight: 44 }}
                      value={invite.email}
                      onChange={(e) => setInvite({ ...invite, email: e.target.value, error: '' })}
                    />
                    <select className="a-select" aria-label="Role" style={{ flex: '0 0 140px', minHeight: 44 }} value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
                      <option value="admin">Admin</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button type="button" className="a-btn sm" style={{ background: 'var(--charcoal)' }} onClick={sendInvite}>
                      Send invite
                    </button>
                    <button type="button" className="a-link grey" onClick={() => setInvite(null)}>
                      Cancel
                    </button>
                  </div>
                  {invite.error && <div className="a-err" style={{ marginTop: 8 }}>{invite.error}</div>}
                </div>
              )}

              <div style={{ marginTop: 20, borderTop: '1px solid rgba(26,23,20,0.08)' }}>
                {members.map((m) => {
                  const you = m.id === user.id
                  const pending = m.kind === 'invite'
                  return (
                    <div key={m.id} className="member">
                      <div className="member-row">
                        <span className={`m-avatar${pending ? ' pending' : ''}`} aria-hidden="true">
                          {initials(m.name, m.email)}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600 }}>{m.name || m.email}</span>
                            {you && <span className="small">(you)</span>}
                            {pending && <span className={`pill ${m.expired ? 'notstarted' : 'invited'}`}>{m.expired ? 'Invite expired' : 'Invited'}</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} className="small">
                            <span className="clip">{m.email}</span>
                            {pending && (
                              <button type="button" className="a-link" style={{ padding: 0, fontSize: 13 }} onClick={() => resend(m)}>
                                {resent[m.id] ? 'Resent' : 'Resend'}
                              </button>
                            )}
                          </div>
                        </div>
                        {you || pending ? (
                          <span className="muted" style={{ fontSize: 13.5, paddingLeft: 14 }}>
                            {ROLE_LABEL[m.role]}
                          </span>
                        ) : (
                          <select
                            className="a-select role-select"
                            aria-label={`Role for ${m.name || m.email}`}
                            value={draft.team[m.id] ?? m.role}
                            onChange={(e) => setDraft((d) => ({ ...d, team: { ...d.team, [m.id]: e.target.value } }))}
                          >
                            <option value="admin">Admin</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        )}
                        {you ? (
                          <span />
                        ) : (
                          <button type="button" className="round-btn" title={pending ? 'Cancel invite' : 'Remove'} aria-label={pending ? `Cancel invite for ${m.email}` : `Remove ${m.name || m.email}`} onClick={() => setConfirmId(m.id)}>
                            –
                          </button>
                        )}
                      </div>
                      {confirmId === m.id && (
                        <div role="alertdialog" className="confirm-inline">
                          <span style={{ flex: '1 1 280px', fontSize: 13.5 }}>
                            {pending ? `Cancel the invite to ${m.email}? The link will stop working.` : `Remove ${m.name || m.email}? They'll lose access right away.`}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button type="button" className="a-link grey" onClick={() => setConfirmId(null)}>
                              Cancel
                            </button>
                            <button type="button" className="a-btn-outline danger sm" onClick={() => remove(m)}>
                              {pending ? 'Cancel invite' : 'Remove'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {members.length <= 1 && (
                <p style={{ margin: '24px 0 4px', textAlign: 'center', fontSize: 14 }} className="muted">
                  It&apos;s just you for now. Invite a team member when you&apos;re ready.
                </p>
              )}
            </div>
          )}

          {group === 'notif' && (
            <div className="box box-pad">
              <h2>Notifications</h2>
              <p className="lead" style={{ marginBottom: 12 }}>
                Choose which emails you get about client activity.
              </p>
              {NOTIFS.map(([k, label, desc]) => (
                <div key={k} className="switch-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t">{label}</div>
                    <div className="d">{desc}</div>
                  </div>
                  <Switch label={label} on={n[k]} onChange={(v) => set('notif', { [k]: v })} />
                </div>
              ))}
              <div style={{ marginTop: 24, maxWidth: 400 }}>
                <Field id="notif-to" label="Send notifications to" error={errors.to} hint="Defaults to your account email.">
                  <input id="notif-to" type="email" className="a-input" value={n.to} onChange={(e) => set('notif', { to: e.target.value })} />
                </Field>
              </div>
            </div>
          )}

          {group === 'onboarding' && o && (
            <>
              <div className="box box-pad">
                <h2>Form options</h2>
                <p className="lead">What clients and leads can pick from.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 32 }}>
                  <ListEditor
                    title="Business type options"
                    hint="Shown in the business type dropdown on the lead form."
                    placeholder="Business type"
                    addLabel="Add business type"
                    rows={o.businessTypes}
                    onChange={(rows) => set('onboarding', { businessTypes: rows })}
                  />
                  <ListEditor
                    title="Social platforms"
                    hint="Offered in the Social Media section."
                    placeholder="Platform"
                    addLabel="Add platform"
                    rows={o.socialPlatforms}
                    onChange={(rows) => set('onboarding', { socialPlatforms: rows })}
                  />
                </div>
                {errors.businessTypes && <div className="a-err" style={{ marginTop: 8 }}>{errors.businessTypes}</div>}
                {errors.socialPlatforms && <div className="a-err" style={{ marginTop: 8 }}>{errors.socialPlatforms}</div>}
                <div className="switch-row" style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid rgba(26,23,20,0.08)', borderBottom: 'none' }}>
                  <div style={{ flex: 1 }}>
                    <div className="t">Voice input on long text fields</div>
                    <div className="d">Lets clients dictate answers like their brand story.</div>
                  </div>
                  <Switch label="Voice input on long text fields" on={o.voiceInput} onChange={(v) => set('onboarding', { voiceInput: v })} />
                </div>
              </div>

              <div className="box box-pad">
                <h2>Client emails</h2>
                <p className="lead">Used for verification and confirmation emails.</p>
                <div className="grid2">
                  <Field id="onb-sender" label="Sender name">
                    <input id="onb-sender" className="a-input" value={o.senderName} onChange={(e) => set('onboarding', { senderName: e.target.value })} />
                  </Field>
                  <Field id="onb-reply" label="Reply-to email" error={errors.replyTo} hint="Leave blank to use the sending address.">
                    <input id="onb-reply" type="email" className="a-input" placeholder="hello@thyratechnology.com" value={o.replyTo} onChange={(e) => set('onboarding', { replyTo: e.target.value })} />
                  </Field>
                  <Field id="onb-expiry" label="Verification link expiry">
                    <select id="onb-expiry" className="a-select" value={o.verificationHours} onChange={(e) => set('onboarding', { verificationHours: Number(e.target.value) })}>
                      {EXPIRY.map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>
            </>
          )}

          {group === 'export' && x && (
            <div className="box box-pad">
              <h2>Export</h2>
              <p className="lead">Defaults applied when generating the WooCommerce CSV.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 520 }}>
                <div style={{ maxWidth: 260 }}>
                  <Field id="exp-sku" label="SKU prefix" error={errors.skuPrefix} hint="Added to every product SKU in the export">
                    <input id="exp-sku" className="a-input mono" placeholder="THY-" value={x.skuPrefix} onChange={(e) => set('export', { skuPrefix: e.target.value })} />
                  </Field>
                </div>
                <div role="radiogroup" aria-label="Import products as" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span className="a-label">Import products as</span>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {[
                      ['draft', 'Draft'],
                      ['published', 'Published'],
                    ].map(([v, label]) => (
                      <button key={v} type="button" role="radio" aria-checked={x.importAs === v} className="radio" onClick={() => set('export', { importAs: v })}>
                        <span className="o">
                          <i />
                        </span>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ maxWidth: 260 }}>
                  <Field id="exp-stock" label="Default stock status">
                    <select id="exp-stock" className="a-select" value={x.stockStatus} onChange={(e) => set('export', { stockStatus: e.target.value })}>
                      {STOCK.map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>
              <div className="switch-row" style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid rgba(26,23,20,0.08)', borderBottom: 'none' }}>
                <div style={{ flex: 1 }}>
                  <div className="t">Include products with no images</div>
                  <div className="d">When off, products without images are left out of the CSV.</div>
                </div>
                <Switch label="Include products with no images" on={x.includeNoImages} onChange={(v) => set('export', { includeNoImages: v })} />
              </div>
            </div>
          )}

          <div className="save-bar">
            {dirty && (
              <>
                <span className="small" style={{ fontSize: 13 }}>
                  Unsaved changes
                </span>
                <button type="button" className="a-link grey" onClick={discard}>
                  Discard
                </button>
              </>
            )}
            <button type="button" className="a-btn" disabled={!dirty || saving} onClick={save}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
