import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { LoaderScreen } from "../components/shared/LoaderScreen";
import { useAppContext } from "./AppProvider";

function lazyPage(loader, exportName) {
  return lazy(() => loader().then((module) => ({ default: module[exportName] })));
}

const AuthPage = lazyPage(() => import("../pages/AuthPage"), "AuthPage");
const DiscoverPage = lazyPage(() => import("../pages/DiscoverPage"), "DiscoverPage");
const LikedPage = lazyPage(() => import("../pages/LikedPage"), "LikedPage");
const MatchesPage = lazyPage(() => import("../pages/MatchesPage"), "MatchesPage");
const RoomsPage = lazyPage(() => import("../pages/RoomsPage"), "RoomsPage");

function RequireAuth({ children }) {
  const { authReady, user } = useAppContext();
  const location = useLocation();

  if (!authReady) {
    return <LoaderScreen label="Carregando sua arena..." />;
  }

  if (!user) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate replace to={`/auth?redirect=${redirect}`} />;
  }

  return <AppShell>{children}</AppShell>;
}

function RedirectIfAuthenticated() {
  const { authReady, user } = useAppContext();
  const location = useLocation();

  if (!authReady) {
    return <LoaderScreen label="Conectando com sua conta..." />;
  }

  if (user) {
    const redirect = new URLSearchParams(location.search).get("redirect");
    return <Navigate replace to={redirect && redirect.startsWith("/") ? redirect : "/discover"} />;
  }

  return <AuthPage />;
}

export function AppRouter() {
  return (
    <Suspense fallback={<LoaderScreen label="Carregando página..." />}>
      <Routes>
        <Route path="/auth" element={<RedirectIfAuthenticated />} />
        <Route
          path="/discover"
          element={
            <RequireAuth>
              <DiscoverPage />
            </RequireAuth>
          }
        />
        <Route
          path="/liked"
          element={
            <RequireAuth>
              <LikedPage />
            </RequireAuth>
          }
        />
        <Route
          path="/matches"
          element={
            <RequireAuth>
              <MatchesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/rooms"
          element={
            <RequireAuth>
              <RoomsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/room/:roomId"
          element={
            <RequireAuth>
              <RoomsPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate replace to="/discover" />} />
      </Routes>
    </Suspense>
  );
}
