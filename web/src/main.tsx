import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

if (import.meta.env.DEV && import.meta.env.VITE_DISABLE_REACT_DEVTOOLS !== '1') {
  void Promise.all([
    import('react-grab'),
    import('react-scan').then(({ scan }) =>
      scan({
        trackUnnecessaryRenders: true,
        onRender: (_fiber, renders) => {
          const sink = window.__reactScanRenders
          const flowStart = window.__reactScanFlowStart
          if (sink === undefined || flowStart === undefined || performance.now() < flowStart) return
          sink.push(...renders)
        },
      }),
    ),
  ])
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
