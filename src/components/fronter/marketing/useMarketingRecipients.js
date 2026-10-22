import { useCallback, useEffect, useRef, useState } from 'react';

export default function useMarketingRecipients(call) {
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const request = useRef(0);
  const load = useCallback(async (next = null) => {
    const version = ++request.current;
    setLoading(true); setError('');
    try {
      const data = await call('recipients', { search: query, cursor: next });
      if (version !== request.current) return;
      setContacts(previous => next ? [...previous, ...data.items] : data.items);
      setTotal(data.total); setCursor(data.cursor); setHasMore(data.hasMore);
    } catch (e) { if (version === request.current) setError(e.message); }
    if (version === request.current) setLoading(false);
  }, [call, query]);
  useEffect(() => { const timer = setTimeout(() => load(), 250); return () => { clearTimeout(timer); request.current++; }; }, [load]);
  const toggle = id => setSelected(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id]);
  return { contacts, total, query, setQuery, selected, setSelected, toggle, loading, error, hasMore, loadMore: () => load(cursor) };
}