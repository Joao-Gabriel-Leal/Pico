import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth'
import AppLayout from './components/AppLayout'
import AuthPage from './pages/AuthPage'
import ChatsPage from './pages/ChatsPage'
import EventDetailPage from './pages/EventDetailPage'
import EventsPage from './pages/EventsPage'
import ExplorePage from './pages/ExplorePage'
import FeedPage from './pages/FeedPage'
import NewPicoPage from './pages/NewPicoPage'
import NewRoutePage from './pages/NewRoutePage'
import NotificationsPage from './pages/NotificationsPage'
import PicoPage from './pages/PicoPage'
import ProfilePage from './pages/ProfilePage'
import RouteDetailPage from './pages/RouteDetailPage'
import SearchPage from './pages/SearchPage'
import UserProfilePage from './pages/UserProfilePage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/mapa" replace />} />
        <Route path="/entrar" element={<AuthPage />} />
        <Route element={<AppLayout />}>
          <Route path="/explorar" element={<Navigate to="/mapa" replace />} />
          <Route path="/mapa" element={<ExplorePage />} />
          <Route path="/eventos" element={<EventsPage />} />
          <Route path="/pesquisa" element={<SearchPage />} />
          <Route path="/eventos/:eventId" element={<EventDetailPage />} />
          <Route path="/conversas" element={<ChatsPage />} />
          <Route path="/videos" element={<Navigate to="/feed" replace />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/atividade" element={<NotificationsPage />} />
          <Route path="/picos/:slug" element={<PicoPage />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/pessoas/:userId" element={<UserProfilePage />} />
          <Route path="/novo-pico" element={<NewPicoPage />} />
          <Route path="/nova-rota" element={<NewRoutePage />} />
          <Route path="/rotas/:routeId" element={<RouteDetailPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
