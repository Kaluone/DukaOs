import { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      retry: (failureCount, error: unknown) => {
        const msg = String(error).toLowerCase()
        if (msg.includes('rls') || msg.includes('403') || msg.includes('unauthorized')) return false
        return failureCount < 2
      },
    },
    mutations: {
      retry: false,
    },
  },
})

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
