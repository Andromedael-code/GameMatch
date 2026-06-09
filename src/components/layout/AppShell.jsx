import { NavLink, useLocation } from "react-router-dom";
import { useAppContext } from "../../app/AppProvider";
import { DiscoverIcon, HeartIcon, LogoutIcon, MatchIcon, RoomIcon, ThemeIcon } from "../shared/Icons";
import { ToastViewport } from "../shared/ToastViewport";

const navigationItems = [
  { to: "/discover", label: "Descobrir", icon: DiscoverIcon },
  { to: "/liked", label: "Curtidos", icon: HeartIcon },
  { to: "/matches", label: "Matches", icon: MatchIcon },
  { to: "/rooms", label: "Salas", icon: RoomIcon },
];

export function AppShell({ children }) {
  const { profile, user, room, toggleTheme, logout, toasts } = useAppContext();
  const location = useLocation();

  return (
    <div className="shell">
      <aside className="shell__sidebar">
        <div className="shell__brand">
          <div>
            <div className="brand-lockup">
              <img className="brand-lockup__logo" src="/logo.png" alt="" width="48" height="48" />
              <span>GameMatch</span>
            </div>
            <h1>Escolha o que jogar.</h1>
          </div>
        </div>

        <p className="shell__copy">Curta jogos, salve favoritos e combine a próxima rodada com a galera.</p>

        <nav className="shell__nav" aria-label="Principal">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                className={({ isActive }) => `shell__nav-link${isActive ? " is-active" : ""}`}
                key={item.to}
                to={item.to}
              >
                <span className="shell__nav-icon">
                  <Icon />
                </span>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="shell__status-card">
          <p className="eyebrow">Conta</p>
          <strong>{profile.nickname || "Jogador"}</strong>
          <p>{user?.email}</p>
          <span className="tag">{room?.id ? `Sala ${room.id}` : "Sem sala ativa"}</span>
        </div>
      </aside>

      <div className="shell__body">
        <header className="shell__topbar">
          <div className="shell__topbar-actions">
            <button className="icon-button" type="button" onClick={toggleTheme} aria-label="Alternar tema">
              <ThemeIcon />
            </button>
            <button className="icon-button" type="button" onClick={logout} aria-label="Sair">
              <LogoutIcon />
            </button>
          </div>
        </header>

        <main className="shell__content" key={location.pathname}>
          {children}
        </main>

        <nav className="mobile-nav" aria-label="Navegação rápida">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                className={({ isActive }) => `mobile-nav__link${isActive ? " is-active" : ""}`}
                key={item.to}
                to={item.to}
              >
                <Icon />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <ToastViewport toasts={toasts} />
    </div>
  );
}
