import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';

export default function useAIAgentPipeline() {
  const { sessionUserId, sessionToken } = useDebtCoachAuth();
  const credentials = { sessionUserId, sessionToken };
  const query = useQuery({
    queryKey: ['ai-agent-pipeline', sessionUserId],
    queryFn: async () => (await base44.functions.invoke('aiAgentPipeline', { action: 'status', ...credentials })).data,
    refetchInterval: 10000, retry: false,
  });
  const saveConfig = async config => {
    const result = await base44.functions.invoke('aiAgentPipeline', { action: 'save', config, ...credentials });
    await query.refetch();
    return result.data.config;
  };
  return { ...query, saveConfig };
}