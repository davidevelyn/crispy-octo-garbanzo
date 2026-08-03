import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './styles/global.css'
import { registerModules } from './platform/registry'
import { modules } from './modules'
import { seedProfiles, getProfiles, getLastProfileId } from './platform/profiles'
import { useApp } from './platform/store'

registerModules(modules)

registerSW({ immediate: true })

async function boot() {
  await seedProfiles()
  const [profiles, lastId] = await Promise.all([getProfiles(), getLastProfileId()])
  useApp.setState({ profiles, activeProfileId: lastId })
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

void boot()
