import { BrowserRouter } from 'react-router-dom'
import { Providers } from './providers'
import { AppRouter } from './router'
import '@/styles/globals.css'
import '@/styles/animations.css'

export default function App() {
  return (
    <BrowserRouter>
      <Providers>
        <AppRouter />
      </Providers>
    </BrowserRouter>
  )
}
