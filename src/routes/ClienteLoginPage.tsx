import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useCliente } from '@/hooks/useCliente';
import { ApiError } from '@/lib/api/client';
import logoUrl from '@/assets/logo-danzarte.png';

/**
 * Ingreso de CLIENTES de membresía (público general).
 *
 * Nada que ver con LoginPage: allá se busca a la persona por nombre y la
 * contraseña es su número de carnet. Aquí es correo + una contraseña que la
 * persona eligió, porque un cliente no está en el padrón del festival.
 */
export function ClienteLoginPage() {
  const { cliente, login } = useCliente();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (cliente) return <Navigate to="/clientes" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Complete su correo y su contraseña.');
      return;
    }

    setCargando(true);
    try {
      await login(email.trim(), password);
      navigate('/clientes', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Correo o contraseña incorrectos.');
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Error al conectar. Intente de nuevo.');
      }
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-glass-border bg-glass-bg backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-8">
        <div className="flex justify-center mb-6">
          <img src={logoUrl} alt="Festival Danzarte 2026" className="h-24 w-auto" />
        </div>

        <h2 className="text-center text-xl font-semibold text-text-90 mb-1">Videos del Festival</h2>
        <p className="text-center text-sm text-text-45 mb-6">
          Ingrese con su correo y contraseña
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wide text-text-45 mb-1.5">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sucorreo@ejemplo.com"
              autoComplete="email"
              className="w-full rounded-lg border border-glass-border bg-elev px-3 py-2.5 text-text-90 placeholder:text-text-45 focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wide text-text-45 mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={verPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Su contraseña"
                autoComplete="current-password"
                className="w-full rounded-lg border border-glass-border bg-elev px-3 py-2.5 pr-11 text-text-90 placeholder:text-text-45 focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan"
              />
              <button
                type="button"
                onClick={() => setVerPassword((v) => !v)}
                aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                title={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                tabIndex={-1}
                className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-text-45 transition hover:text-cyan"
              >
                {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="w-full rounded-lg bg-[linear-gradient(135deg,var(--cyan),var(--fuchsia))] py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-lg transition active:scale-[0.99] hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cargando ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className="mt-6 border-t border-glass-border pt-4 text-center">
          <p className="text-sm text-text-45">
            ¿Todavía no tiene cuenta?{' '}
            <Link to="/clientes/registro" className="font-semibold text-cyan hover:underline">
              Cree una aquí
            </Link>
          </p>
          {/* Sin esta salida, un bailarín que cae aquí por error no tiene cómo
              volver: su carnet nunca va a funcionar en este formulario. */}
          <p className="mt-2 text-xs text-text-45">
            ¿Participa del festival?{' '}
            <Link to="/login" className="hover:text-cyan hover:underline">
              Entre por el portal de participantes
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
