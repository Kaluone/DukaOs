import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabaseClient'

export interface Shop {
  id: string
  owner_user_id: string
  name: string
  shop_type: string | null
  phone?: string | null
  vfd_enabled?: boolean | null
  created_at?: string
  [key: string]: unknown
}

export function useShop(userId?: string) {
  return useQuery<Shop | null>({
    queryKey: ['shop', userId],
    queryFn: async () => {
      if (!userId) return null
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('owner_user_id', userId)
        .limit(1)
      if (error) throw error
      return (data?.[0] as Shop) ?? null
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })
}
