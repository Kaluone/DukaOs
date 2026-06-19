import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabaseClient'

export type PermissionCode =
  | 'view_profit' | 'view_cost_price' | 'refund_sale' | 'delete_sale'
  | 'delete_expense' | 'export_reports' | 'manage_billing' | 'manage_staff'
  | 'manage_products' | 'manage_branches' | 'manage_customers' | 'manage_purchases'
  | 'manage_suppliers' | 'access_ai' | 'access_admin' | 'configure_vfd'
  | 'approve_requests' | 'manage_inventory' | 'view_audit' | 'manage_coupons'
  | 'manage_promotions' | 'close_shift' | 'manage_tax'

interface UsePermissionsOptions {
  shopId?: string
  staffId?: string
}

export function usePermissions({ shopId, staffId }: UsePermissionsOptions) {
  const { data: grantedCodes = [] } = useQuery<PermissionCode[]>({
    queryKey: ['staff-permissions', shopId, staffId],
    enabled: !!shopId && !!staffId,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      // Get role permissions via the staff's role
      const { data: staffData } = await supabase
        .from('staff')
        .select('role_id')
        .eq('id', staffId!)
        .eq('shop_id', shopId!)
        .single()

      const rolePerms: PermissionCode[] = []
      if (staffData?.role_id) {
        const { data: rp } = await supabase
          .from('role_permissions')
          .select('permissions(code)')
          .eq('role_id', staffData.role_id)
        rolePerms.push(...(rp ?? []).map((r: any) => r.permissions?.code).filter(Boolean))
      }

      // Get user-level overrides
      const { data: overrides } = await supabase
        .from('user_permissions')
        .select('permission_id, granted, permissions(code)')
        .eq('shop_id', shopId!)
        .eq('staff_id', staffId!)

      const granted = new Set(rolePerms)
      for (const ov of overrides ?? []) {
        const code = (ov as any).permissions?.code
        if (!code) continue
        if (ov.granted) granted.add(code)
        else granted.delete(code)
      }

      return Array.from(granted) as PermissionCode[]
    },
  })

  const can = (code: PermissionCode): boolean => grantedCodes.includes(code)
  const canAny = (...codes: PermissionCode[]): boolean => codes.some(c => can(c))
  const canAll = (...codes: PermissionCode[]): boolean => codes.every(c => can(c))

  return { can, canAny, canAll, grantedCodes }
}
