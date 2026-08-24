import { useState, type FormEvent } from "react";
import { Lock, LogIn, Activity } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { login, isLoggingIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    void (async () => {
      const ok = await login(username, password);
      if (!ok) {
        setError("Usuário ou senha inválidos.");
      }
    })();
  };

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={handleSubmit}>
        <div className="login-icon-wrapper">
          <Activity size={26} />
        </div>
        <h1 className="login-title">Painel de Operações</h1>
        <p className="card-subtitle login-subtitle">Entre com suas credenciais para continuar.</p>

        <label className="login-field">
          <span>Usuário</span>
          <input
            type="text"
            className="input-text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </label>

        <label className="login-field">
          <span>Senha</span>
          <input
            type="password"
            className="input-text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && (
          <div className="login-error">
            <Lock size={14} />
            {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary login-submit" disabled={isLoggingIn}>
          <LogIn size={16} className={isLoggingIn ? "spinner" : ""} />
          {isLoggingIn ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
