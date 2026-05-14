import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import type { SearchResult } from '@/types/domain';
import logoUrl from '@/assets/logo-danzarte.png';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [password, setPassword] = useState('');
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  const showSuggestions =
    !dismissed &&
    !(selected && query === selected.nombre) &&
    query.trim().length >= 2 &&
    suggestions.length > 0;

  useEffect(() => {
    if (selected && query === selected.nombre) return;
    const q = query.trim();
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      if (q.length < 2) {
        setSuggestions([]);
        return;
      }
      try {
        const results = await authApi.searchParticipants(q);
        setSuggestions(results);
      } catch (err) {
        console.error('search error:', err);
        setSuggestions([]);
      }
    }, 300);
  }, [query, selected]);

  if (user) return <Navigate to="/" replace />;

  function pickSuggestion(s: SearchResult) {
    setSelected(s);
    setQuery(s.nombre);
    setDismissed(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!query.trim() || !password.trim()) {
      setError('Complete todos los campos');
      return;
    }

    let userToLogin = selected;
    if (!userToLogin) {
      try {
        const results = await authApi.searchParticipants(query.trim());
        userToLogin =
          results.find((p) => p.nombre.toLowerCase() === query.trim().toLowerCase()) ||
          results[0] ||
          null;
      } catch {
        userToLogin = null;
      }
    }

    if (!userToLogin) {
      setError('Usuario no encontrado');
      return;
    }

    setLoading(true);
    try {
      await login(userToLogin.id_contacto, password);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Carnet o contraseña incorrectos');
      } else {
        setError('Error al conectar. Intente de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-glass-border bg-glass-bg backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-8">
        <div className="flex justify-center mb-6">
          <img src={logoUrl} alt="Festival Danzarte 2026" className="h-24 w-auto" />
        </div>

        <h2 className="text-center text-xl font-semibold text-text-90 mb-1">Mi Cuenta</h2>
        <p className="text-center text-sm text-text-45 mb-6">
          Ingrese con su carnet o teléfono
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <label className="block text-xs uppercase tracking-wide text-text-45 mb-1.5">
              Participante
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
                setDismissed(false);
              }}
              onFocus={() => setDismissed(false)}
              placeholder="Busque su nombre, carnet o teléfono..."
              autoComplete="off"
              className="w-full rounded-lg border border-glass-border bg-elev px-3 py-2.5 text-text-90 placeholder:text-text-45 focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan"
            />
            {showSuggestions && (
              <div className="absolute z-10 mt-1 w-full max-h-72 overflow-auto rounded-lg border border-glass-border bg-elev shadow-xl">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => pickSuggestion(s)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-glass-bg text-left"
                  >
                    {s.foto ? (
                      <img
                        src={s.foto}
                        alt={s.nombre}
                        className="h-10 w-10 rounded-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold bg-[linear-gradient(135deg,var(--cyan),var(--fuchsia))]">
                        {(s.nombre || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-text-90 text-sm truncate">{s.nombre}</div>
                      <div className="text-text-45 text-xs truncate">
                        {s.nombre_agrupacion || s.rol || ''}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wide text-text-45 mb-1.5">
              Contraseña (Carnet)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Su número de carnet"
              className="w-full rounded-lg border border-glass-border bg-elev px-3 py-2.5 text-text-90 placeholder:text-text-45 focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[linear-gradient(135deg,var(--cyan),var(--fuchsia))] py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-lg transition active:scale-[0.99] hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
