import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './store/index.ts'
import './index.css'
import App from './App.tsx'
import { OrbixErrorBoundary } from './components/ui/error/OrbixErrorBoundary.tsx'

function StartupHandoff() {
  useEffect(() => {
    // The static intro owns its counter and exit, so React never restarts it.
    window.dispatchEvent(new Event('orbix:ready'))
  }, [])
  return null
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StartupHandoff />
    <OrbixErrorBoundary level="app">
      <Provider store={store}>
        <App />
      </Provider>
    </OrbixErrorBoundary>
  </StrictMode>,
)
