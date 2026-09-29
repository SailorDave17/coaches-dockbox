import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Imported first so a missing setting stops the app at boot, not at the first request (ADR 011).
import './config.ts'
import './index.css'
import App from './App.tsx'

const root = document.getElementById('root')
if (!root) throw new Error('index.html has no #root element')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
