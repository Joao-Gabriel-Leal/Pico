import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'

const navItems = [
  { to: '/mapa', label: 'Mapa', shortLabel: 'Mapa' },
  { to: '/eventos', label: 'Eventos', shortLabel: 'Agenda' },
  { to: '/pesquisa', label: 'Buscar', shortLabel: 'Buscar' },
  { to: '/conversas', label: 'DM', shortLabel: 'DM' },
  { to: '/feed', label: 'Feed', shortLabel: 'Feed' },
]

export default function AppLayout() {
  const location = useLocation()
  const { user, logout } = useAuth()
  const [showCreateMenu, setShowCreateMenu] = useState(false)

  useEffect(() => {
    setShowCreateMenu(false)
  }, [location.pathname, location.search])

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
          <button className="secondary-button small-link-button full-width" onClick={() => setShowCreateMenu((current) => !current)}>
            Criar
          </button>
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
          <Link className="brand-link topbar-brand" to="/mapa">
            PicoLiga
          </Link>

          <div className="topbar-actions">
            <button className="secondary-button small-link-button topbar-action" onClick={() => setShowCreateMenu((current) => !current)}>
              +
            </button>
            {user ? (
              <Link className="profile-nav-button" to="/perfil" aria-label="Abrir perfil">
                <span className="profile-nav-avatar">{user.displayName.slice(0, 1).toUpperCase()}</span>
              </Link>
            ) : (
              <Link className="primary-button small-link-button topbar-action" to="/entrar">
                Entrar
              </Link>
            )}
          </div>
        </header>

        {showCreateMenu ? (
          <div className="create-menu-shell">
            <div className="create-menu-card">
              <Link className="create-menu-link" to="/feed?compose=1">
                Nova publicacao
              </Link>
              <Link className="create-menu-link" to="/eventos?compose=1">
                Novo evento
              </Link>
              <Link className="create-menu-link" to="/novo-pico">
                Novo pico
              </Link>
            </div>
          </div>
        ) : null}

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
        {user ? (
          <NavLink to="/perfil" className={({ isActive }) => (isActive ? 'mobile-link active' : 'mobile-link')}>
            <span className="mobile-link-avatar">{user.displayName.slice(0, 1).toUpperCase()}</span>
            <span>Perfil</span>
          </NavLink>
        ) : null}
      </nav>
    </div>
  )
}
