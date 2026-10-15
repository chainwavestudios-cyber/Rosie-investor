import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { HOT_LEADS_KEY, hotLeadsQuery } from '@/lib/hotLeads';

export default function useHotLeads(search) {
  const client = useQueryClient();
  const [term, setTerm] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const query = hotLeadsQuery(term);
  const freshness = { refetchInterval: 30000, refetchOnMount: 'always', refetchOnWindowFocus: 'always' };
  const list = useInfiniteQuery({
    queryKey: [...HOT_LEADS_KEY, 'list', term],
    initialPageParam: undefined,
    queryFn: ({ pageParam }) => base44.entities.DebtLead.filter(query, {
      sort: '-hotLeadTaggedAt', limit: 50, ...(pageParam ? { cursor: pageParam } : {}),
    }),
    getNextPageParam: page => page.has_more ? page.next_cursor : undefined,
    ...freshness,
  });
  const total = useQuery({
    queryKey: [...HOT_LEADS_KEY, 'count', term],
    queryFn: () => base44.entities.DebtLead.count(query),
    ...freshness,
  });
  useEffect(() => base44.entities.DebtLead.subscribe(() => {
    client.invalidateQueries({ queryKey: HOT_LEADS_KEY });
  }), [client]);
  return {
    leads: list.data?.pages.flatMap(page => page.items) || [],
    total: total.data,
    loading: list.isPending,
    refreshing: list.isFetching || total.isFetching,
    error: list.error || total.error,
    hasMore: list.hasNextPage,
    loadingMore: list.isFetchingNextPage,
    loadMore: () => list.fetchNextPage(),
    refresh: () => client.invalidateQueries({ queryKey: HOT_LEADS_KEY }),
  };
}