import { useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/shared/lib/supabaseClient'
import { clearAllCaches } from '@/shared/lib/cache'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({ user: session?.user ?? null, session, loading: false })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, session, loading: false })
      if (!session) clearAllCaches()
    })

    return () => subscription.unsubscribe()
  }, [])

  return state
}

export async function signInWithGoogle(): Promise<void> {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/dashboard`,
    },
  })
}

export async function signOut(): Promise<void> {
  clearAllCaches()
  await supabase.auth.signOut()
}
