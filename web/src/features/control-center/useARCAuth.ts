import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabaseClient'

export type ARCRole = 'founder' | 'chief_admin' | 'support_agent' | 'finance_admin' | 'technical_admin'

export interface ARCAdmin {
  id: string
  user_id: string
  email: string
  full_name: string
  role: ARCRole
  avatar_url: string | null
  is_active: boolean
  totp_enabled: boolean
  last_login_at: string | null
}

const ROLE_LABELS: Record<ARCRole, string> = {
  founder: 'Founder',
  chief_admin: 'Chief Admin',
  support_agent: 'Support Agent',
  finance_admin: 'Finance Admin',
  technical_admin: 'Technical Admin',
}

export const ROLE_LABEL = (role: ARCRole) => ROLE_LABELS[role] ?? role

export const ROLE_PERMS: Record<ARCRole, Record<string, boolean>> = {
  founder: {
    dashboard: true, tenants: true, revenue: true, support: true,
    reports: true, system: true, analytics: true, backup: true,
    admins: true, impersonate: true, delete_tenant: true,
    manage_billing: true, audit: true, broadcast: true,
  },
  chief_admin: {
    dashboard: true, tenants: true, revenue: false, support: true,
    reports: true, system: false, analytics: false, backup: false,
    admins: false, impersonate: false, delete_tenant: false,
    manage_billing: true, audit: true, broadcast: true,
  },
  support_agent: {
    dashboard: true, tenants: false, revenue: false, support: true,
    reports: false, system: false, analytics: false, backup: false,
    admins: false, impersonate: false, delete_tenant: false,
    manage_billing: false, audit: false, broadcast: false,
  },
  finance_admin: {
    dashboard: true, tenants: false, revenue: true, support: false,
    reports: true, system: false, analytics: true, backup: false,
    admins: false, impersonate: false, delete_tenant: false,
    manage_billing: false, audit: false, broadcast: false,
  },
  technical_admin: {
    dashboard: true, tenants: false, revenue: false, support: false,
    reports: false, system: true, analytics: false, backup: true,
    admins: false, impersonate: false, delete_tenant: false,
    manage_billing: false, audit: true, broadcast: false,
  },
}

export function hasPerm(role: ARCRole, perm: string): boolean {
  return ROLE_PERMS[role]?.[perm] ?? false
}

export function useARCAdmin() {
  return useQuery<ARCAdmin | null>({
    queryKey: ['arc-admin-me'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data, error } = await supabase
        .from('arc_admins')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()
      if (error || !data) return null
      return data as ARCAdmin
    },
    staleTime: 60_000,
  })
}

export function useARCSignIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      // Verify this user is an ARC admin
      const { data: admin, error: adminErr } = await supabase
        .from('arc_admins')
        .select('*')
        .eq('user_id', data.user.id)
        .eq('is_active', true)
        .maybeSingle()
      if (adminErr || !admin) {
        await supabase.auth.signOut()
        throw new Error('Access denied. This account is not authorized for the Control Center.')
      }
      // Log the login
      await supabase.from('arc_audit_logs').insert({
        admin_id: admin.id,
        admin_email: admin.email,
        admin_role: admin.role,
        action: 'login',
        details: { method: 'password' },
      })
      return admin as ARCAdmin
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['arc-admin-me'] }),
  })
}

export function useARCAuditLog() {
  return useMutation({
    mutationFn: async (params: {
      admin: ARCAdmin
      action: string
      resource_type?: string
      resource_id?: string
      resource_name?: string
      details?: Record<string, unknown>
    }) => {
      await supabase.from('arc_audit_logs').insert({
        admin_id: params.admin.id,
        admin_email: params.admin.email,
        admin_role: params.admin.role,
        action: params.action,
        resource_type: params.resource_type,
        resource_id: params.resource_id,
        resource_name: params.resource_name,
        details: params.details ?? {},
      })
    },
  })
}
