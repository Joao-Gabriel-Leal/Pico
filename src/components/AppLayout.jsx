import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { apiRequest } from '../api'
import { useAuth } from '../auth'
import {
  BellIcon,
  CalendarIcon,
  FeedIcon,
  MapIcon,
  MessageIcon,
  PlusIcon,
  ProfileIcon,
  SearchIcon,
} from './AppIcons'
import MediaAsset from './MediaAsset'

const navItems = [
  { to: '/mapa', label: 'Mapa', shortLabel: 'Mapa', Icon: MapIcon },
  { to: '/eventos', label: 'Eventos', shortLabel: 'Agenda', Icon: CalendarIcon },
  { to: '/pesquisa', label: 'Buscar', shortLabel: 'Buscar', Icon: SearchIcon },
  { to: '/conversas', label: 'DM', shortLabel: 'DM', Icon: MessageIcon },
  { to: '/feed', label: 'Feed', shortLabel: 'Feed', Icon: FeedIcon },
]

export default function AppLayout() {
  const location = useLocation()
  const { user, token, logout } = useAuth()
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const [unreadNotifications, setUnreadNotifications] = useState(0)

  useEffect(() => {
    setShowCreateMenu(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    let intervalId = 0

    async function loadNotifications() {
      if (!token) {
        setUnreadNotifications(0)
        return
      }

      try {
        const payload = await apiRequest('/api/notifications', { token })
        setUnreadNotifications(payload.unreadCount || 0)
      } catch {}
    }

    loadNotifications()

    if (token) {
      intervalId = window.setInterval(loadNotifications, 12000)
    }

    return () => {
      if (intervalId) window.clearInterval(intervalId)
    }
  }, [token, location.pathname])

  useEffect(() => {
    function handleNotificationsUpdated(event) {
      setUnreadNotifications(event.detail?.unreadCount || 0)
    }

    window.addEventListener('notifications:updated', handleNotificationsUpdated)
    return () => window.removeEventListener('notifications:updated', handleNotificationsUpdated)
  }, [])

  return (
    <div className="app-shell app-instagram-shell">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <Link className="brand-link" to="/mapa">
            PicoMap
          </Link>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'sidebar-link active' : 'sidebar-link')}
            >
              <item.Icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
          {user ? (
            <NavLink
              to="/atividade"
              className={({ isActive }) => (isActive ? 'sidebar-link active' : 'sidebar-link')}
            >
              <BellIcon size={20} />
              <span>Atividade</span>
              {unreadNotifications ? <span className="nav-count-badge">{unreadNotifications}</span> : null}
            </NavLink>
          ) : null}
        </nav>

        <div className="sidebar-actions">
          <button className="secondary-button small-link-button full-width" onClick={() => setShowCreateMenu((current) => !current)}>
            Criar
          </button>
          <Link className="primary-button small-link-button full-width" to="/novo-pico">
            Novo pico
          </Link>
          <Link className="secondary-button small-link-button full-width" to="/perfil">
            Perfil
          </Link>
        </div>

        <div className="sidebar-user-card">
          {user ? (
            <>
              <div className="user-chip">
                {user.avatarUrl ? (
                  <MediaAsset className="avatar-circle avatar-mini" src={user.avatarUrl} alt={user.displayName} />
                ) : (
                  <div className="avatar-circle avatar-mini">{user.displayName.slice(0, 1).toUpperCase()}</div>
                )}
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
            PicoMap
          </Link>

          <div className="topbar-actions">
            <button
              className="topbar-icon-button"
              type="button"
              aria-label="Criar"
              onClick={() => setShowCreateMenu((current) => !current)}
            >
              <PlusIcon size={21} />
            </button>
            {user ? (
              <Link className="topbar-icon-button activity-button" to="/atividade" aria-label="Abrir atividade">
                <BellIcon size={21} filled={location.pathname === '/atividade'} />
                {unreadNotifications ? <span className="activity-badge">{unreadNotifications}</span> : null}
              </Link>
            ) : null}
            {user ? (
              <Link className="profile-nav-button" to="/perfil" aria-label="Abrir perfil">
                {user.avatarUrl ? (
                  <MediaAsset className="profile-nav-avatar-image" src={user.avatarUrl} alt={user.displayName} />
                ) : (
                  <span className="profile-nav-avatar">{user.displayName.slice(0, 1).toUpperCase()}</span>
                )}
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
            aria-label={item.label}
          >
            <item.Icon size={23} />
            <span>{item.shortLabel}</span>
          </NavLink>
        ))}
        {user ? (
          <NavLink
            to="/perfil"
            className={({ isActive }) => (isActive ? 'mobile-link active' : 'mobile-link')}
            aria-label="Perfil"
          >
            {user.avatarUrl ? (
              <MediaAsset className="mobile-link-avatar-image" src={user.avatarUrl} alt={user.displayName} />
            ) : (
              <ProfileIcon size={23} />
            )}
            <span>Perfil</span>
          </NavLink>
        ) : null}
      </nav>
    </div>
  )
}
