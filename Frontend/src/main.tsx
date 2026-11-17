import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './store'
import './index.css'
import App from './App.tsx'
import { OrbixErrorBoundary } from './components/ui/error/OrbixErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OrbixErrorBoundary level="app">
      <Provider store={store}>
        <App />
      </Provider>
    </OrbixErrorBoundary>
  </StrictMode>,
)
