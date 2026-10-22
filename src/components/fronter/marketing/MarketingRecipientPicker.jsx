export default function MarketingRecipientPicker({ recipients }) {
  const { contacts, total, query, setQuery, selected, setSelected, toggle, loading, error, hasMore, loadMore } = recipients;
  return <section className="calendar-panel space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Recipients · {total} matching contacts</h3><div className="flex gap-2"><button className="calendar-secondary" type="button" onClick={() => setSelected([...new Set([...selected, ...contacts.map(contact => contact.id)])])}>Select shown</button><button className="calendar-secondary" type="button" onClick={() => setSelected([])}>Clear selection</button></div></div>
    <input aria-label="Search marketing contacts" className="calendar-field" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, email or phone" />
    {loading && <p role="status" className="text-sm text-assistant-muted">Loading contacts…</p>}
    {error && <p role="alert" className="calendar-error">{error}</p>}
    {!loading && !error && !contacts.length && <p className="text-sm text-assistant-muted">No eligible contacts match this search.</p>}
    <div className="max-h-80 space-y-2 overflow-y-auto">
      {contacts.map(contact => <label key={contact.id} className="flex cursor-pointer items-center gap-3 rounded border border-assistant-border p-3"><input type="checkbox" aria-label={`Select ${contact.firstName || ''} ${contact.lastName || ''}`} checked={selected.includes(contact.id)} onChange={() => toggle(contact.id)} /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{contact.firstName} {contact.lastName}</span><span className="block break-all text-xs text-assistant-muted">{contact.email}{contact.phone ? ` · ${contact.phone}` : ''}</span></span><span className="text-xs text-assistant-muted">{contact.status}</span></label>)}
    </div>
    {hasMore && <button type="button" className="calendar-secondary" disabled={loading} onClick={loadMore}>Load more contacts</button>}
  </section>;
}