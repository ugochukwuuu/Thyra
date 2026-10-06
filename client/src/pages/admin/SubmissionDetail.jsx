import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext.jsx'
import { ApiError, api } from '../../lib/api.js'
import { previewUrl } from '../onboarding/model.js'
import { buildSections, flaggableItems } from './sections.js'
import { downloadFile, formatDate } from './format.js'
import { useToast } from './toast.js'
import { Busy, DownloadIcon, Modal, Pill, StatusPill } from './ui.jsx'

const pad = (i) => String(i + 1).padStart(2, '0')
const fileName = (f) => f.name || f.publicId.split('/').pop()
const ext = (f) => (fileName(f).split('.').pop() || f.resourceType).slice(0, 4).toUpperCase()

function FileTile({ file, onDownload }) {
  const visual = file.resourceType !== 'raw'
  return (
    <div className="file">
      <div className="thumb">{visual ? <img src={previewUrl(file, 240)} alt="" loading="lazy" /> : <span className="ext">{ext(file)}</span>}</div>
      <div className="meta">
        <div className="nm clip" title={fileName(file)}>
          {fileName(file)}
          {file.caption && <div className="small">{file.caption}</div>}
        </div>
        <button type="button" className="dl-btn" aria-label={`Download ${fileName(file)}`} onClick={() => onDownload(file)}>
          <DownloadIcon />
        </button>
      </div>
    </div>
  )
}

function LongText({ value }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="long">
      <p>{value}</p>
      <button
        type="button"
        className="copy-btn"
        aria-label="Copy"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value)
            setCopied(true)
            setTimeout(() => setCopied(false), 1600)
          } catch {
            // Clipboard can be blocked; the text is still selectable.
          }
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
          <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
        </svg>
        {copied && <span>Copied</span>}
      </button>
    </div>
  )
}

function Product({ p, open, onToggle, onDownload }) {
  return (
    <div className="product">
      <button type="button" className="product-head" aria-expanded={open} onClick={onToggle}>
        <span className="p-thumb">{p.images[0] && <img src={previewUrl(p.images[0], 80)} alt="" loading="lazy" />}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
            <span className="clip">{p.name}</span>
            {p.issue && <span className="dot" title={p.issue} />}
          </span>
          <span className="small" style={{ display: 'block' }}>
            {p.meta}
          </span>
        </span>
        <span className={p.price ? undefined : 'miss'}>{p.price ?? 'No price'}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B655C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: '0 0 auto', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="product-body">
          {p.issue && (
            <div className="miss" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span className="dot" />
              {p.issue}
            </div>
          )}
          {(p.shortDescription || p.longDescription) && (
            <div>
              <div className="sub-label">Description</div>
              {p.shortDescription && <p style={{ margin: '0 0 6px', fontWeight: 600 }}>{p.shortDescription}</p>}
              {p.longDescription && <p style={{ margin: 0, lineHeight: 1.55, maxWidth: 620, whiteSpace: 'pre-wrap' }}>{p.longDescription}</p>}
            </div>
          )}
          <div>
            <div className="sub-label">Images · {p.images.length}</div>
            <div className="imgs">
              {p.images.map((im, j) => (
                <div key={im.publicId} className="img">
                  <div className="pic">
                    <img src={previewUrl(im, 208)} alt={j === 0 ? 'Main photo' : `Gallery photo ${j}`} loading="lazy" />
                  </div>
                  <button type="button" className="dl" aria-label={`Download ${fileName(im)}`} onClick={() => onDownload(im)}>
                    <span>
                      <DownloadIcon />
                    </span>
                  </button>
                  <div className="cap clip">{j === 0 ? 'Main · ' : ''}{fileName(im)}</div>
                </div>
              ))}
              {p.images.length === 0 && <span className="small" style={{ color: 'var(--faint)' }}>No images uploaded</span>}
            </div>
          </div>
          {p.variations.length ? (
            <div className="variations">
              {p.variations.map((v, k) => (
                <div key={k} className="variation">
                  <div className="vh">
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{v.name || 'Unnamed'}</span>
                    <span className="small">{v.priceVaries ? 'Price varies' : 'Same price'}</span>
                  </div>
                  {v.options.map((o, m) => (
                    <div key={m} className="vo">
                      <span>{o.label}</span>
                      <span className={o.price == null ? 'miss' : 'muted'}>{o.price ?? 'No price'}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <span className="small">No variations — sold as a single option.</span>
          )}
        </div>
      )}
    </div>
  )
}

function FieldValue({ f, open, toggle, onDownload }) {
  const empty = f.value == null || f.value === '' || (Array.isArray(f.value) && f.value.length === 0)
  if (empty) return <div className="f-val empty">Not provided</div>
  if (f.type === 'list')
    return (
      <div className="f-val chips">
        {f.value.map((it) => (
          <span key={it}>{it}</span>
        ))}
      </div>
    )
  if (f.type === 'long')
    return (
      <div className="f-val">
        <LongText value={f.value} />
      </div>
    )
  if (f.type === 'color') {
    const hex = `#${String(f.value).replace('#', '')}`.toUpperCase()
    return (
      <div className="f-val swatch-row">
        <span style={{ background: hex }} />
        <span className="mono">{hex}</span>
      </div>
    )
  }
  if (f.type === 'files')
    return (
      <div className="f-val file-grid">
        {f.value.map((file) => (
          <FileTile key={file.publicId} file={file} onDownload={onDownload} />
        ))}
      </div>
    )
  if (f.type === 'products')
    return (
      <div className="f-val products">
        {f.value.map((p) => (
          <Product key={p.id} p={p} open={!!open[p.id]} onToggle={() => toggle(p.id)} onDownload={onDownload} />
        ))}
      </div>
    )
  return <div className="f-val">{f.value}</div>
}

export default function SubmissionDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const canEdit = user.role === 'admin'
  const toast = useToast()
  const navigate = useNavigate()

  const [data, setData] = useState(null)
  const [missing, setMissing] = useState(false)
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState({})
  const [req, setReq] = useState(null) // { text, flags, error, sending } while the request form is open
  const [menu, setMenu] = useState(false)
  const [dialog, setDialog] = useState(null) // 'export' | 'archive' | 'delete'
  const [deleteText, setDeleteText] = useState('')
  const [busy, setBusy] = useState('') // 'export' | 'zip' | 'delete'

  const load = useCallback(async () => {
    try {
      setData(await api(`/admin/clients/${id}`))
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setMissing(true)
      else toast(err.message, 'error')
    }
  }, [id, toast])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    load()
  }, [load])

  if (missing)
    return (
      <div className="adm-wrap">
        <BackLink />
        <div className="box empty-box" style={{ marginTop: 12 }}>
          This client no longer exists.
        </div>
      </div>
    )
  if (!data)
    return (
      <div className="adm-wrap">
        <BackLink />
        <div className="box empty-box" style={{ marginTop: 12 }}>
          Loading…
        </div>
      </div>
    )

  const { client, submission, changeRequests, issues, exportIncludesNoImages } = data
  const sections = buildSections(submission)
  const done = client.done
  const flagged = new Set(changeRequests.filter((c) => !c.resolvedAt).map((c) => c.step))
  const sec = sections[active]
  const started = active < done
  const flagItems = started ? flaggableItems(sec) : []
  const issueGroups = [
    issues.noPrice.length && { label: `${issues.noPrice.length} ${issues.noPrice.length === 1 ? 'product has' : 'products have'} no price`, names: issues.noPrice },
    issues.noImages.length && {
      label: `${issues.noImages.length} ${issues.noImages.length === 1 ? 'product has' : 'products have'} no images`,
      names: issues.noImages,
      note: exportIncludesNoImages ? '' : 'These are left out of the CSV. You can change this in Settings → Export.',
    },
    issues.variationNoPrice.length && {
      label: `${issues.variationNoPrice.length} ${issues.variationNoPrice.length === 1 ? 'variation is' : 'variations are'} missing a price`,
      names: issues.variationNoPrice,
    },
  ].filter(Boolean)
  const items = submission.products?.items ?? []
  const hasProducts = items.length > 0
  const exportable = exportIncludesNoImages ? items.length : items.filter((p) => p.mainImage || p.images?.length).length
  const dateLabel = client.submittedAt ? `Submitted ${formatDate(client.submittedAt)}` : `Last updated ${formatDate(client.updatedAt)}`

  const select = (i) => {
    setActive(i)
    setReq(null)
  }

  const onDownload = async (file) => {
    try {
      await downloadFile(`/admin/clients/${id}/files?publicId=${encodeURIComponent(file.publicId)}`, fileName(file))
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const runExport = async () => {
    setDialog(null)
    setBusy('export')
    try {
      await downloadFile(`/admin/clients/${id}/products.csv`, 'products.csv')
      toast('Products exported. Your CSV is downloading.')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy('')
    }
  }

  const exportCsv = () => {
    if (busy) return
    if (!hasProducts) return toast('This client has no products to export yet.')
    if (!exportable) {
      return toast("None of these products have images, so the CSV would be empty. Add images, or include them in Settings → Export.", 'error')
    }
    if (issueGroups.length) setDialog('export')
    else runExport()
  }

  const downloadAll = async () => {
    if (busy) return
    setBusy('zip')
    toast('Preparing assets. Your zip will download shortly.')
    try {
      await downloadFile(`/admin/clients/${id}/assets.zip`, 'assets.zip')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy('')
    }
  }

  const reviewProducts = () => {
    const names = new Set(issueGroups.flatMap((g) => g.names.map((n) => n.split(' — ')[0])))
    const items = submission.products?.items ?? []
    setOpen(Object.fromEntries(items.filter((p) => names.has(p.name || 'Untitled product')).map((p) => [p.id, true])))
    setDialog(null)
    select(1)
  }

  const sendRequest = async () => {
    const message = req.text.trim()
    if (!message) return setReq({ ...req, error: 'Tell the client what to fix.' })
    setReq({ ...req, sending: true })
    try {
      await api(`/admin/clients/${id}/change-requests`, {
        method: 'POST',
        body: { step: active, message, items: Object.keys(req.flags).filter((k) => req.flags[k]) },
      })
      setReq(null)
      toast('Client notified.')
      await load()
    } catch (err) {
      setReq({ ...req, sending: false, error: err.message })
    }
  }

  const setArchived = async (archived) => {
    setMenu(false)
    setDialog(null)
    try {
      await api(`/admin/clients/${id}/${archived ? 'archive' : 'restore'}`, { method: 'POST', body: {} })
      toast(`${client.name} ${archived ? 'archived' : 'restored'}.`)
      await load()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const doDelete = async () => {
    setBusy('delete')
    try {
      await api(`/admin/clients/${id}`, { method: 'DELETE', body: { confirmName: deleteText } })
      navigate('/admin/submissions', { state: { deleted: client.name } })
    } catch (err) {
      setBusy('')
      toast(err.message, 'error')
    }
  }

  return (
    <div className="adm-wrap">
      <BackLink />

      {client.archived && (
        <div role="status" className="box" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 12, padding: '8px 8px 8px 18px', background: '#EFEAE0', borderRadius: 16 }}>
          <span style={{ flex: '1 1 240px' }}>Archived. This client is hidden from your inbox.</span>
          {canEdit && (
            <button type="button" className="a-btn-outline sm" onClick={() => setArchived(false)}>
              Restore
            </button>
          )}
        </div>
      )}

      <div className="box detail-head">
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1>{client.name}</h1>
            <StatusPill status={client.status} />
          </div>
          <div className="detail-meta">
            <span>{dateLabel}</span>
            <a href={`mailto:${client.email}`}>{client.email}</a>
            {client.phone && <a href={`tel:${client.phone.replace(/\s/g, '')}`}>{client.phone}</a>}
            {!client.emailVerified && <Pill kind="invited">Email not confirmed</Pill>}
          </div>
        </div>
        <div className="actions">
          <button type="button" className="a-btn-outline" onClick={downloadAll} disabled={busy === 'zip'}>
            <DownloadIcon />
            <Busy busy={busy === 'zip'} label="Download all assets" busyLabel="Preparing" />
          </button>
          <button type="button" className="a-btn" style={{ minWidth: 206 }} onClick={exportCsv}>
            <Busy busy={busy === 'export'} label="Export products (CSV)" busyLabel="Exporting" />
          </button>
          {canEdit && (
            <>
              <button type="button" className="round-btn" aria-label="More actions" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <circle cx="5" cy="12" r="1.8" />
                  <circle cx="12" cy="12" r="1.8" />
                  <circle cx="19" cy="12" r="1.8" />
                </svg>
              </button>
              {menu && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 55 }} onClick={() => setMenu(false)} />
                  <div role="menu" className="menu">
                    {client.archived ? (
                      <button type="button" role="menuitem" onClick={() => setArchived(false)}>
                        Restore client
                      </button>
                    ) : (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenu(false)
                          setDialog('archive')
                        }}
                      >
                        Archive client
                      </button>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      className="danger"
                      onClick={() => {
                        setMenu(false)
                        setDeleteText('')
                        setDialog('delete')
                      }}
                    >
                      Delete client
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="detail-body">
        <div className="box sec-nav desktop-only">
          <div className="top">
            <span className="eyebrow-sm">Sections</span>
            <span className="small">
              {done} of {sections.length}
            </span>
          </div>
          {sections.map((s, i) => {
            const st = i < done
            return (
              <button key={s.title} type="button" className={`sec-item${i === active ? ' on' : ''}${st ? ' started' : ''}`} aria-current={i === active ? 'true' : undefined} onClick={() => select(i)}>
                <span className="sec-num">{pad(i)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>{s.title}</span>
                {st && flagged.has(i) && <span className="sec-flag">Changes requested</span>}
                {st && !flagged.has(i) && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D9714E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-label="Complete">
                    <path d="M5.5 12.5l4 4 9-9" />
                  </svg>
                )}
                {!st && <span className="sec-ns">Not started</span>}
              </button>
            )
          })}
        </div>
        <div className="sec-chips mobile-only">
          {sections.map((s, i) => (
            <button key={s.title} type="button" className={`sec-chip${i === active ? ' on' : ''}${i < done ? ' started' : ''}`} onClick={() => select(i)}>
              <span className="sec-num">{pad(i)}</span>
              {s.title}
              {flagged.has(i) && <span className="dot" />}
            </button>
          ))}
        </div>

        <div className="box sec-box">
          <div className="sec-title">
            <span className="num">{pad(active)}</span>
            <h2 className="h2">{sec.title}</h2>
            {started && flagged.has(active) && <StatusPill status="changes" />}
            {canEdit && started && !req && (
              <button type="button" className="a-btn-outline sm" onClick={() => setReq({ text: '', flags: {}, error: '', sending: false })}>
                Request changes
              </button>
            )}
          </div>

          {req && (
            <div className="req-box">
              <div className="a-field">
                <label htmlFor="req-text">What does the client need to fix?</label>
                <textarea
                  id="req-text"
                  className="a-textarea"
                  placeholder="Be specific — the client sees this note at the top of the section."
                  value={req.text}
                  onChange={(e) => setReq({ ...req, text: e.target.value, error: '' })}
                />
                {req.error && <span className="a-err">{req.error}</span>}
              </div>
              {flagItems.length > 0 && (
                <div>
                  <div className="a-label">
                    {active === 1 ? 'Flag specific products' : 'Flag specific files'} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', marginTop: 4 }}>
                    {flagItems.map((n) => (
                      <button key={n} type="button" role="checkbox" aria-checked={!!req.flags[n]} className="check" onClick={() => setReq({ ...req, flags: { ...req.flags, [n]: !req.flags[n] } })}>
                        <span className="bx">{req.flags[n] ? '✓' : ''}</span>
                        <span style={{ overflowWrap: 'anywhere' }}>{n}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="a-link grey" onClick={() => setReq(null)}>
                  Cancel
                </button>
                <button type="button" className="a-btn" style={{ minWidth: 150 }} disabled={req.sending} onClick={sendRequest}>
                  <Busy busy={req.sending} label="Send to client" busyLabel="Sending" />
                </button>
              </div>
            </div>
          )}

          {started ? (
            <div className="fields">
              {sec.fields.map((f) => (
                <div key={f.label} className="f-row">
                  <span className="f-label">{f.label}</span>
                  <FieldValue f={f} open={open} toggle={(pid) => setOpen((o) => ({ ...o, [pid]: !o[pid] }))} onDownload={onDownload} />
                </div>
              ))}
            </div>
          ) : (
            <div className="not-started">
              <span className="ring" />
              <p style={{ margin: '6px 0 0', fontWeight: 600, fontSize: 15 }}>Not started</p>
              <p style={{ margin: 0, maxWidth: 340, fontSize: 14 }} className="muted">
                The client hasn&apos;t reached this section yet. It will appear here once they fill it in.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="box" style={{ marginTop: 24, padding: '20px clamp(18px,3vw,28px)' }}>
        <h2 className="h2">Change history</h2>
        <p style={{ margin: '0 0 12px', fontSize: 13.5 }} className="muted">
          Every change request sent to this client.
        </p>
        {changeRequests.length === 0 && (
          <p style={{ margin: 0, padding: '16px 0 4px', fontSize: 14, borderTop: '1px solid var(--line-3)' }} className="muted">
            No change requests yet.
          </p>
        )}
        {changeRequests.map((h) => (
          <div key={h.id} className="history-row">
            <div className="when">
              <span className="small">{formatDate(h.createdAt)}</span>
              <span style={{ fontWeight: 600 }}>{h.section}</span>
            </div>
            <div className="msg">
              <p>{h.message}</p>
              {h.items.length > 0 && <div className="small" style={{ marginTop: 6 }}>Flagged: {h.items.join(', ')}</div>}
            </div>
            <span style={{ alignSelf: 'flex-start' }}>
              <Pill kind={h.resolvedAt ? 'responded' : 'awaiting'}>{h.resolvedAt ? 'Client responded' : 'Awaiting client'}</Pill>
            </span>
          </div>
        ))}
      </div>

      {dialog === 'export' && (
        <Modal
          title="A few products need attention"
          onClose={() => setDialog(null)}
          footer={
            <>
              <button type="button" className="a-btn-outline" onClick={runExport}>
                Export anyway
              </button>
              <button type="button" className="a-btn" onClick={reviewProducts}>
                Review products
              </button>
            </>
          }
        >
          <p className="sheet-text" style={{ paddingBottom: 12 }}>
            These will import into WooCommerce incomplete. Fix them first, or export as they are.
          </p>
          <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column' }}>
            {issueGroups.map((g) => (
              <button key={g.label} type="button" className="issue" onClick={reviewProducts}>
                <span className="dot" style={{ width: 8, height: 8 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 600, fontSize: 14.5 }}>{g.label}</span>
                  <span className="small" style={{ display: 'block', overflowWrap: 'anywhere' }}>
                    {g.names.join(', ')}
                  </span>
                  {g.note && (
                    <span className="small" style={{ display: 'block', color: 'var(--rust)', marginTop: 2 }}>
                      {g.note}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {dialog === 'archive' && (
        <Modal
          alert
          title={`Archive ${client.name}?`}
          onClose={() => setDialog(null)}
          footer={
            <>
              <button type="button" className="a-link grey" onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button type="button" className="a-btn-outline" onClick={() => setArchived(true)}>
                Archive client
              </button>
            </>
          }
        >
          <p className="sheet-text" style={{ fontSize: 14.5 }}>
            They&apos;ll be hidden from your inbox. You can restore them anytime.
          </p>
        </Modal>
      )}

      {dialog === 'delete' && (
        <Modal
          alert
          title={`Delete ${client.name} permanently?`}
          onClose={() => setDialog(null)}
          footer={
            <>
              <button type="button" className="a-link grey" onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button type="button" className="a-btn-danger" disabled={deleteText.trim() !== client.name || busy === 'delete'} onClick={doDelete}>
                <Busy busy={busy === 'delete'} label="Delete permanently" busyLabel="Deleting" />
              </button>
            </>
          }
        >
          <p className="sheet-text" style={{ fontSize: 14.5, paddingBottom: 20 }}>
            This removes their account, submission and every uploaded file. This can&apos;t be undone.
          </p>
          <div className="a-field" style={{ padding: '0 24px 20px' }}>
            <label htmlFor="del-confirm">
              Type <strong>{client.name}</strong> to confirm
            </label>
            <input id="del-confirm" className="a-input" autoComplete="off" value={deleteText} onChange={(e) => setDeleteText(e.target.value)} />
          </div>
        </Modal>
      )}
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/admin/submissions" className="back-link">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      All submissions
    </Link>
  )
}

