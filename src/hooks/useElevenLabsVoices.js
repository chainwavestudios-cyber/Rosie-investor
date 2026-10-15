import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';

export default function useElevenLabsVoices() {
  const { sessionUserId, sessionToken } = useDebtCoachAuth();
  const credentials = { sessionUserId, sessionToken };
  return useQuery({
    queryKey: ['elevenlabs-voices', sessionUserId],
    queryFn: async () => (await base44.functions.invoke('listElevenLabsVoices', credentials)).data,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}