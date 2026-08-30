import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useCliente } from '@/hooks/useCliente';
import { ApiError } from '@/lib/api/client';
import logoUrl from '@/assets/logo-danzarte.png';

/**
 * Alta de cuenta para comprar la membresía de videos.
 *
 * Al terminar deja la sesión abierta y lleva a /clientes, desde donde arranca el
 * checkout: hacer que la persona vuelva a escribir la contraseña justo después
 * de elegirla es la forma más barata de perder una venta.
 */
export function ClienteRegistroPage() {
  const { cliente, registro } = useCliente();
  const navigate = useNavigate();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [repetida, setRepetida] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (cliente) return <Navigate to="/clientes" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Se valida aquí lo mismo que valida el servidor, sólo para avisar antes y
    // sin una vuelta de red. El que manda sigue siendo el servidor.
    if (nombre.trim().length < 2) {
      setError('Ingrese su nombre completo.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Ingrese un correo electrónico válido.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== repetida) {
      setError('Las dos contraseñas no coinciden.');
      return;
    }

    setCargando(true);
    try {
      await registro({
        nombre: nombre.trim(),
        email: email.trim(),
        password,
        telefono: telefono.trim() || undefined,
      });
      navigate('/clientes', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);   // el backend ya manda 409 y 422 en castellano
      } else {
        setError('Error al conectar. Intente de nuevo.');
      }
    } finally {
      setCargando(false);
    }
  }

  const campo =
    'w-full rounded-lg border border-glass-border bg-elev px-3 py-2.5 text-text-90 placeholder:text-text-45 focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan';
  const etiqueta = 'block text-xs uppercase tracking-wide text-text-45 mb-1.5';

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-glass-border bg-glass-bg backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-8">
        <div className="flex justify-center mb-6">
          <img src={logoUrl} alt="Festival Danzarte 2026" className="h-24 w-auto" />
        </div>

        <h2 className="text-center text-xl font-semibold text-text-90 mb-1">Cree su cuenta</h2>
        <p className="text-center text-sm text-text-45 mb-6">
          Para ver los videos del XVIII Festival Danzarte
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={etiqueta}>Nombre completo</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Su nombre y apellido"
              autoComplete="name"
              className={campo}
            />
          </div>

          <div>
            <label className={etiqueta}>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sucorreo@ejemplo.com"
              autoComplete="email"
              className={campo}
            />
          </div>

          <div>
            <label className={etiqueta}>
              Teléfono <span className="normal-case">(opcional)</span>
            </label>
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="70000000"
              autoComplete="tel"
              className={campo}
            />
          </div>

          <div>
            <label className={etiqueta}>Contraseña</label>
            <div className="relative">
              <input
                type={verPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Al menos 8 caracteres"
                autoComplete="new-password"
                className={campo + ' pr-11'}
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

          <div>
            <label className={etiqueta}>Repita la contraseña</label>
            <input
              type={verPassword ? 'text' : 'password'}
              value={repetida}
              onChange={(e) => setRepetida(e.target.value)}
              placeholder="La misma contraseña"
              autoComplete="new-password"
              className={campo}
            />
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="w-full rounded-lg bg-[linear-gradient(135deg,var(--cyan),var(--fuchsia))] py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-lg transition active:scale-[0.99] hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cargando ? 'Creando su cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <div className="mt-6 border-t border-glass-border pt-4 text-center">
          <p className="text-sm text-text-45">
            ¿Ya tiene cuenta?{' '}
            <Link to="/clientes/login" className="font-semibold text-cyan hover:underline">
              Inicie sesión
            </Link>
          </p>
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
