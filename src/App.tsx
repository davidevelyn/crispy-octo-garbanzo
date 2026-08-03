import { HashRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { getModules } from './platform/registry'
import { setLastProfileId } from './platform/profiles'
import { syncQuietly } from './platform/sync'
import { useApp, toast } from './platform/store'
import { Home } from './screens/Home'
import { Settings } from './screens/Settings'
import { RestTimerBar } from './modules/fitness/components/RestTimer'
import type { ProfileId } from './platform/types'

function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const activeProfileId = useApp((s) => s.activeProfileId)
  const profiles = useApp((s) => s.profiles)
  const setActiveProfile = useApp((s) => s.setActiveProfile)
  const isHome = location.pathname === '/'
  // Mid-workout the profile switcher hides — one thing at a time.
  const inWorkout = location.pathname.includes('/workout')

  const switchTo = (id: ProfileId) => {
    setActiveProfile(id)
    void setLastProfileId(id)
  }

  return (
    <header className="header">
      {!isHome && (
        <button className="back" onClick={() => navigate(-1)} aria-label="Back">
          ‹
        </button>
      )}
      <h1>{isHome ? 'Life OS' : ''}</h1>
      {!inWorkout && (
        <div className="profile-switch">
          {profiles.map((p) => (
            <button
              key={p.profileId}
              className={p.profileId === activeProfileId ? 'active' : ''}
              onClick={() => switchTo(p.profileId)}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </header>
  )
}

function Toast() {
  const toast = useApp((s) => s.toast)
  if (!toast) return null
  return <div className="toast">{toast}</div>
}

/** Background sync when the app opens or comes back to the foreground. */
let lastSyncAttempt = 0
function useFocusSync() {
  const bumpSyncTick = useApp((s) => s.bumpSyncTick)
  useEffect(() => {
    const attempt = () => {
      if (Date.now() - lastSyncAttempt < 60_000) return
      lastSyncAttempt = Date.now()
      void syncQuietly().then((result) => {
        if (result && result.pulled > 0) {
          bumpSyncTick()
          toast(`Synced — ${result.pulled} new`)
        }
      })
    }
    attempt()
    const onVisible = () => {
      if (document.visibilityState === 'visible') attempt()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [bumpSyncTick])
}

export default function App() {
  const modules = getModules()
  useFocusSync()
  return (
    <HashRouter>
      <div className="app">
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/settings" element={<Settings />} />
          {modules.flatMap((m) =>
            m.routes.map((r, i) => (
              <Route key={`${m.id}-${i}`} path={`${m.basePath}${r.path === '' ? '' : '/' + r.path}`} element={r.element} />
            )),
          )}
        </Routes>
        <RestTimerBar />
        <Toast />
      </div>
    </HashRouter>
  )
}

/** Scroll to top on navigation — small, but keeps "one thing on screen" honest. */
export function useScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])
}
