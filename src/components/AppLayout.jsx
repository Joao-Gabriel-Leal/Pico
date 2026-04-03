import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth'

const navItems = [
  { to: '/mapa', label: 'Mapa', shortLabel: 'Mapa' },
  { to: '/eventos', label: 'Eventos', shortLabel: 'Eventos' },
  { to: '/conversas', label: 'Conversas', shortLabel: 'DM' },
  { to: '/feed', label: 'Feed', shortLabel: 'Feed' },
]

export default function AppLayout() {
  const { user, logout } = useAuth()

  return (
    <div className="app-shell app-instagram-shell">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <p className="eyebrow">Social dos picos</p>
          <Link className="brand-link" to="/mapa">
            PicoLiga
          </Link>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'sidebar-link active' : 'sidebar-link')}
            >
              <span className="sidebar-link-dot" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-actions">
          <Link className="primary-button small-link-button full-width" to="/novo-pico">
            Marcar novo pico
          </Link>
          <Link className="secondary-button small-link-button full-width" to="/perfil">
            Meu perfil
          </Link>
        </div>

        <div className="sidebar-user-card">
          {user ? (
            <>
              <div className="user-chip">
                <div className="avatar-circle avatar-mini">{user.displayName.slice(0, 1).toUpperCase()}</div>
                <div>
                  <strong>{user.displayName}</strong>
                  <p>@{user.username}</p>
                </div>
              </div>
              <button className="ghost-button" onClick={logout}>
                Sair
              </button>
            </>
          ) : (
            <Link className="primary-button small-link-button full-width" to="/entrar">
              Entrar
            </Link>
          )}
        </div>
      </aside>

      <div className="app-main-frame">
        <header className="app-topbar">
          <div>
            <p className="eyebrow">Mapa, eventos, DM e feed</p>
            <strong className="topbar-title">Experiencia estilo Instagram, feita para pico.</strong>
          </div>

          <div className="topbar-actions">
            <Link className="secondary-button small-link-button topbar-action" to="/novo-pico">
              Novo pico
            </Link>
            {user ? (
              <Link className="secondary-button small-link-button topbar-action" to="/perfil">
                Perfil
              </Link>
            ) : (
              <Link className="primary-button small-link-button topbar-action" to="/entrar">
                Entrar
              </Link>
            )}
          </div>
        </header>

        <main className="page-wrapper">
          <Outlet />
        </main>
      </div>

      <nav className="mobile-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => (isActive ? 'mobile-link active' : 'mobile-link')}
          >
            <span className="mobile-link-dot" />
            <span>{item.shortLabel}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
