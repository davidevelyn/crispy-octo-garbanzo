import { Link } from 'react-router-dom'
import { getModules } from '../platform/registry'
import { useApp } from '../platform/store'

export function Home() {
  const activeProfileId = useApp((s) => s.activeProfileId)
  const modules = getModules()

  return (
    <main className="screen">
      <div className="home-cards">
        {modules.map((m) => (
          <m.HomeCard key={m.id} profileId={activeProfileId} />
        ))}
      </div>
      <Link to="/settings" className="row" style={{ marginTop: 8 }}>
        <div className="grow">
          <div className="title">Settings</div>
          <div className="sub">Profiles, units, plates, export</div>
        </div>
        <span className="end">›</span>
      </Link>
    </main>
  )
}
