import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppContext } from "../app/AppProvider";
import { usePageTitle } from "../hooks/usePageTitle";
import { signIn, signUp } from "../services/auth";
import { isValidEmail } from "../utils/validators";

function resolveRedirect(value) {
  if (!value || !value.startsWith("/")) {
    return "/discover";
  }

  return value;
}

function parseAuthError(error) {
  const code = String(error?.code || "");

  if (code === "auth/invalid-email") {
    return "Email inválido. Confira o formato antes de tentar novamente.";
  }

  if (code === "auth/user-not-found" || code === "auth/invalid-credential") {
    return "Conta não encontrada ou senha incorreta.";
  }

  if (code === "auth/email-already-in-use") {
    return "Já existe uma conta com esse email.";
  }

  if (code === "auth/weak-password") {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }

  if (code === "auth/network-request-failed") {
    return "Não foi possível conectar ao Firebase agora.";
  }

  return error?.message || "Não foi possível autenticar sua conta.";
}

export function AuthPage() {
  usePageTitle("Entrar");

  const navigate = useNavigate();
  const location = useLocation();
  const { user, notify } = useAppContext();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const redirect = resolveRedirect(searchParams.get("redirect"));
  const invitedRoomId = redirect.startsWith("/room/") ? redirect.split("/room/")[1]?.split("?")[0] : "";

  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      navigate(redirect, { replace: true });
    }
  }, [user, navigate, redirect]);

  async function handleSubmit(event) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      notify({
        title: "Faltam dados",
        description: "Preencha email e senha para continuar.",
        tone: "warning",
      });
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      notify({
        title: "Email inválido",
        description: "Use um email no formato nome@provedor.com.",
        tone: "warning",
      });
      return;
    }

    if (password.length < 6) {
      notify({
        title: "Senha curta",
        description: "A senha precisa ter pelo menos 6 caracteres.",
        tone: "warning",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "login") {
        await signIn(normalizedEmail, password);
      } else {
        await signUp(normalizedEmail, password);
      }

      notify({
        title: mode === "login" ? "Sessão iniciada" : "Conta criada",
        description: "Você já pode explorar a plataforma.",
        tone: "success",
      });
    } catch (error) {
      notify({
        title: "Falha na autenticação",
        description: parseAuthError(error),
        tone: "danger",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-page__hero">
        <div className="auth-page__backdrop" />
        <div className="auth-page__brand">
          <div>
            <div className="brand-lockup brand-lockup--hero">
              <img className="brand-lockup__logo" src="/logo.png" alt="" width="64" height="64" />
              <span>GameMatch</span>
            </div>
            <h1>Escolha o próximo jogo sem complicação.</h1>
          </div>
        </div>

        <p className="auth-page__lead">
          Veja jogos, trailers e matches em grupo em um só lugar. Entre, crie uma sala e decida rápido o que
          jogar.
        </p>

        <div className="auth-page__feature-grid">
          <article className="feature-card">
            <span className="feature-card__kicker">01</span>
            <strong>Curta ou passe</strong>
            <p>Arraste, clique ou use o teclado para filtrar os jogos da rodada.</p>
          </article>
          <article className="feature-card">
            <span className="feature-card__kicker">02</span>
            <strong>Salas com amigos</strong>
            <p>Crie uma sala, envie o link e acompanhe quem entrou em tempo real.</p>
          </article>
          <article className="feature-card">
            <span className="feature-card__kicker">03</span>
            <strong>Seus favoritos</strong>
            <p>Guarde os jogos curtidos e volte neles depois sem precisar procurar de novo.</p>
          </article>
        </div>

        <div className="auth-page__hero-footer">
          <div className="auth-page__hero-badge">
            <span>Salas privadas</span>
            <strong>Convite por link</strong>
          </div>
          <div className="auth-page__hero-badge">
            <span>Descoberta rápida</span>
            <strong>Trailer e página do jogo</strong>
          </div>
        </div>
      </section>

      <section className="auth-page__panel">
        <div className="auth-card">
          <div className="auth-card__header">
            <p className="eyebrow">{mode === "login" ? "Entrar" : "Criar conta"}</p>
            <h2>{mode === "login" ? "Entre na sua conta" : "Crie sua conta"}</h2>
            {invitedRoomId ? <p className="muted">Convite encontrado para a sala {invitedRoomId}.</p> : null}
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Email</span>
              <input
                autoComplete="email"
                inputMode="email"
                placeholder="voce@exemplo.com"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Senha</span>
              <input
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="Mínimo de 6 caracteres"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            <button className="button button--primary button--block" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Conectando..." : mode === "login" ? "Entrar agora" : "Criar conta"}
            </button>
          </form>

          <button
            className="button button--ghost button--block"
            type="button"
            onClick={() => setMode((current) => (current === "login" ? "signup" : "login"))}
          >
            {mode === "login" ? "Ainda não tenho conta" : "Já tenho conta"}
          </button>
        </div>
      </section>
    </div>
  );
}
