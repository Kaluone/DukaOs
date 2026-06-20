import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface StaffSession {
  isStaffMode: boolean
  activeStaffId: string | null
  activeStaffName: string | null
  sessionToken: string | null
  sessionExpiresAt: string | null
  enterStaffMode: (id: string, name: string, token: string, expiresAt: string) => void
  exitStaffMode: () => void
}

export const useStaffSession = create<StaffSession>()(
  persist(
    (set) => ({
      isStaffMode: false,
      activeStaffId: null,
      activeStaffName: null,
      sessionToken: null,
      sessionExpiresAt: null,
      enterStaffMode: (id, name, token, expiresAt) =>
        set({ isStaffMode: true, activeStaffId: id, activeStaffName: name, sessionToken: token, sessionExpiresAt: expiresAt }),
      exitStaffMode: () =>
        set({ isStaffMode: false, activeStaffId: null, activeStaffName: null, sessionToken: null, sessionExpiresAt: null }),
    }),
    { name: 'duka-staff-session' }
  )
)

export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(pin))
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function isStaffSessionValid(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  return new Date(expiresAt) > new Date()
}

export function getOrCreateDeviceId(): string {
  const key = 'duka-device-id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}
