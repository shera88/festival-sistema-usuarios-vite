import { useEffect, useId, useRef, useState } from 'react';
import { Eye, EyeOff, Film, Lock, Mail, MonitorSmartphone, Video } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useCliente } from '@/hooks/useCliente';
import { clientesApi } from '@/lib/api/clientes';
import { ApiError } from '@/lib/api/client';
import { MEMBRESIA_PAQUETE } from '@/lib/membresia';
import { VentaHeader } from '@/routes/clientes/VentaHeader';
import '@/styles/venta-videos.css';

/**
 * Pantalla promocional + alta de la membresía de videos (ruta pública
 * /clientes/registro, que es la que se enlaza desde el header del festival).
 *
 * ORDEN: la cuenta se crea ANTES de pagar. Con eso pasan dos cosas que importan:
 *
 *   1. La orden de WooCommerce sale con `_owner_id = <cliente_id>`, que es el
 *      ancla por la que n8n acredita la membresía. Sin cuenta previa ese id no
 *      existe y n8n hace `if (!ownerId) return []`: el cobro entra y la
 *      membresía no se marca nunca.
 *   2. La cookie `fdz_cliente` ya está puesta cuando WooCommerce devuelve a
 *      /clientes/videos?pago=ok, así que la persona vuelve del pago con la
 *      sesión abierta y los videos desbloqueados, sin pasar por un login.
 *
 * El alta y el pago son un solo envío: se crea la cuenta y en el mismo clic se
 * arranca el checkout. Pedirle que se registre, confirme, y recién después
 * busque dónde pagar es el camino donde más gente se cae.
 *
 * El estilo es el de festivaldanzarte.com y no el del panel: se llega aquí desde
 * el header del sitio, y un salto visual en medio de una compra se lee como
 * "esto ya no es la misma página". Todo el estilo vive en venta-videos.css,
 * colgado de `.fdz-venta`.
 */
export function ClienteCompraPage() {
  const { cliente, membresia, loading, registro, login } = useCliente();
  const id = useId();
  const cajaError = useRef<HTMLDivElement | null>(null);

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [repetida, setRepetida] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El error se dibuja arriba de la tarjeta y el botón que lo dispara está unos
  // 500 px más abajo: en un teléfono queda fuera de pantalla o detrás del header
  // pegajoso, y la persona ve que no pasa NADA y vuelve a pulsar. Se lo trae a
  // la vista y se le da el foco para que también lo anuncie un lector.
  useEffect(() => {
    if (!error) return;
    const caja = cajaError.current;
    if (!caja) return;
    const quietud = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    caja.scrollIntoView({ behavior: quietud ? 'auto' : 'smooth', block: 'center' });
    caja.focus({ preventScroll: true });
  }, [error]);

  // Mientras se resuelve me() todavía no se sabe quién es. Pintar la oferta en
  // esa ventana le muestra "compre por Bs 70" a quien YA pagó.
  if (loading) {
    return (
      <div className="fdz-venta min-h-screen">
        <VentaHeader />
        <p className="px-4 py-24 text-center text-[13px] font-light text-white/50">Cargando…</p>
      </div>
    );
  }

  // Quien ya pagó no tiene nada que hacer en una página de venta.
  if (cliente && membresia?.paquete_pagada) return <Navigate to="/clientes/videos" replace />;

  const precio = MEMBRESIA_PAQUETE.precioOferta ?? MEMBRESIA_PAQUETE.precioRegular;
  const hayOferta = precio < MEMBRESIA_PAQUETE.precioRegular;

  // Cada línea con su propio ícono, no cuatro tildes iguales: la tilde repetida
  // sólo dice "sí" cuatro veces, mientras que el ícono adelanta de qué habla la
  // línea antes de leerla.
  const incluye = [
    { icono: Film, texto: 'Todas las presentaciones del XVIII Festival Danzarte 2026' },
    { icono: Video, texto: 'Video completo' },
    { icono: MonitorSmartphone, texto: 'Acceso desde cualquier dispositivo, cuando quiera' },
    { icono: Mail, texto: 'Al completar la compra le llega un correo de confirmación' },
  ];

  /** Crea la orden en WooCommerce y manda a pagar. Exige la sesión ya abierta. */
  async function irAPagar() {
    const { pay_url } = await clientesApi.checkout();
    window.location.href = pay_url;
  }

  /**
   * Botón de la tarjeta de la oferta. Si ya hay sesión no hay nada que
   * preguntar y se va derecho al pago; si no, baja al formulario y deja el
   * cursor en el primer campo. En un teléfono la oferta y el formulario no
   * entran juntos en pantalla, y sin esto hay que descubrir que había que
   * seguir bajando.
   */
  function irAlFormulario() {
    if (cliente) {
      setCargando(true);
      setError(null);
      irAPagar().catch(() => {
        setError('No se pudo abrir el pago. Intente de nuevo.');
        setCargando(false);
      });
      return;
    }
    const campo = document.getElementById(`${id}-nombre`);
    if (!campo) return;
    const quietud = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    campo.scrollIntoView({ behavior: quietud ? 'auto' : 'smooth', block: 'center' });
    campo.focus({ preventScroll: true });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Mismas validaciones que el servidor, sólo para avisar sin una vuelta de
    // red. El que manda sigue siendo el servidor.
    if (nombre.trim().length < 2) return setError('Ingrese su nombre completo.');
    if (!email.trim() || !email.includes('@')) return setError('Ingrese un correo electrónico válido.');
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    // Repetirla no es burocracia: esta contraseña se teclea UNA vez, oculta, y
    // es la única llave de un producto que se acaba de pagar. En el área de
    // clientes todavía no hay recuperación de contraseña, así que un error de
    // tipeo deja a la persona pagada y afuera en cuanto caduque la cookie.
    if (password !== repetida) return setError('Las dos contraseñas no coinciden.');

    setCargando(true);

    // Dos try separados a propósito: el 401 del alta significa "esa contraseña
    // no es la de esa cuenta", y el 401 del checkout significa "se perdió la
    // sesión". Con un solo catch, el segundo se le mostraba a la persona como
    // un problema de contraseña y la mandaba a corregir algo que estaba bien.
    try {
      try {
        await registro({
          nombre: nombre.trim(),
          email: email.trim(),
          password,
          telefono: telefono.trim() || undefined,
        });
      } catch (err) {
        // 409 = ese correo ya tiene cuenta. En vez de frenar la compra con un
        // "ya existe", se intenta entrar con la contraseña que acaba de
        // escribir: si es la suya, para ella el trámite fue uno solo.
        if (err instanceof ApiError && err.status === 409) {
          await login(email.trim(), password);
        } else {
          throw err;
        }
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 401
            ? 'Ya existe una cuenta con ese correo y la contraseña no coincide. Inicie sesión para continuar con la compra.'
            : err.message,
        );
      } else {
        setError('Error al conectar. Intente de nuevo.');
      }
      setCargando(false);
      return;
    }

    try {
      await irAPagar();
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? 'Su cuenta quedó creada, pero se perdió la sesión. Inicie sesión y pulse Comprar.'
          : 'Su cuenta quedó creada, pero no se pudo abrir el pago. Intente de nuevo.',
      );
      setCargando(false);
    }
    // Si salió bien no se apaga `cargando`: la página se está yendo al pago, y
    // rehabilitar el botón sólo invita a un segundo clic y a una segunda orden.
  }

  return (
    <div className="fdz-venta min-h-screen">
      <VentaHeader />

      <main className="mx-auto w-full max-w-[1080px] px-4 py-12 sm:px-6 sm:py-16">
        <header className="mb-12 flex flex-col items-center text-center">
          {hayOferta && <div className="venta-eyebrow">Oferta solo por la premiación</div>}
          <h1 className="venta-titulo mt-4 text-3xl uppercase sm:text-4xl md:text-5xl">
            Adquiera los videos del festival
          </h1>
          <p className="mx-auto mt-6 max-w-[58ch] text-[14px] font-light leading-[1.7] text-white/70 sm:text-[15px]">
            Llévese la grabación completa del XVIII Festival Danzarte 2026 y vuelva a ver su
            presentación, y la de todos, las veces que quiera.
          </p>
        </header>

        <div className="grid items-start gap-6 md:grid-cols-2">
          {/* ---------- La oferta ---------- */}
          <section
            aria-labelledby={`${id}-oferta`}
            className="venta-card venta-card-oferta overflow-hidden rounded-2xl"
          >
            <div className="px-7 pb-7 pt-7">
              <h2 id={`${id}-oferta`} className="venta-eyebrow">
                Paquete Completo 2026
              </h2>

              {hayOferta && (
                <div className="mt-5 flex items-baseline gap-2.5">
                  <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/60">
                    Antes
                  </span>
                  {/* El tachado va en fucsia de marca y no en gris: es la cifra
                      que hace atractiva la oferta, y un gris tenue la esconde
                      justo cuando conviene que se vea. */}
                  <s
                    className="text-[22px] font-light tabular-nums decoration-2"
                    style={{
                      color: 'rgba(255,255,255,0.6)',
                      textDecorationColor: 'var(--venta-fuchsia)',
                    }}
                  >
                    Bs {MEMBRESIA_PAQUETE.precioRegular}
                  </s>
                </div>
              )}

              <div className="mt-1.5">
                <span className="text-[64px] font-light leading-none tracking-[-0.03em] text-white tabular-nums">
                  Bs {precio}
                </span>
              </div>

              <p className="mt-3 text-[13px] font-light text-white/60">
                Pago único, sin renovación.
              </p>

              <button
                type="button"
                onClick={irAlFormulario}
                disabled={cargando}
                className="venta-btn mt-6"
              >
                {cargando ? 'Abriendo el pago...' : `Comprar ahora · Bs ${precio}`}
              </button>

              <p className="mt-4 text-center text-[13px] font-light text-white/60">
                ¿Ya compró la membresía?{' '}
                <Link
                  to="/clientes/login"
                  className="font-medium text-[var(--venta-cyan)] hover:underline"
                >
                  Inicie sesión
                </Link>
              </p>
            </div>

            {/* Línea de perforación, como el talón de una entrada. Es un borde
                punteado y no una muesca recortada: la muesca hay que rellenarla
                con el color exacto del fondo, y basta que el fondo cambie para
                que quede un parche visible. */}
            <div className="border-t border-dashed border-white/12" />

            <div className="px-7 pb-7 pt-6">
              <ul className="space-y-3">
                {incluye.map(({ icono: Icono, texto }) => (
                  <li
                    key={texto}
                    className="flex items-start gap-3 text-[14px] font-light leading-snug text-white/80"
                  >
                    <Icono
                      aria-hidden
                      className="mt-0.5 h-[18px] w-[18px] shrink-0"
                      style={{ color: 'var(--venta-cyan)' }}
                    />
                    {texto}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* ---------- La cuenta, antes del pago ---------- */}
          <section aria-labelledby={`${id}-alta`} className="venta-card rounded-2xl px-7 py-7">
            {error && (
              <div
                ref={cajaError}
                role="alert"
                aria-live="assertive"
                tabIndex={-1}
                className="mb-5 rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-[13px] font-light text-red-200 focus:outline-none"
              >
                {error}
              </div>
            )}

            {cliente ? (
              // Ya tiene sesión abierta y no pagó: no se le vuelven a pedir los datos.
              <div className="flex min-h-[380px] flex-col justify-center text-center">
                <h2 id={`${id}-alta`} className="text-[15px] font-light text-white/85">
                  Su cuenta ya está creada, <strong className="font-medium">{cliente.nombre}</strong>.
                </h2>
                <p className="mt-2 text-[13px] font-light text-white/60">
                  Solo falta completar el pago.
                </p>
                <button
                  type="button"
                  disabled={cargando}
                  onClick={irAlFormulario}
                  className="venta-btn mt-7"
                >
                  {cargando ? 'Abriendo el pago...' : `Pagar Bs ${precio}`}
                </button>
              </div>
            ) : (
              <>
                <h2 id={`${id}-alta`} className="venta-eyebrow">
                  Cree su cuenta
                </h2>
                <p className="mb-6 mt-2.5 text-[13px] font-light leading-relaxed text-white/60">
                  Primero su cuenta, y enseguida el pago. Al terminar vuelve aquí, ya con la sesión
                  abierta y los videos desbloqueados.
                </p>

                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  <div>
                    <label htmlFor={`${id}-nombre`} className="venta-label">
                      Nombre completo
                    </label>
                    <input
                      id={`${id}-nombre`}
                      type="text"
                      required
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Su nombre y apellido"
                      autoComplete="name"
                      className="venta-input"
                    />
                  </div>

                  <div>
                    <label htmlFor={`${id}-email`} className="venta-label">
                      Correo electrónico
                    </label>
                    <input
                      id={`${id}-email`}
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="sucorreo@ejemplo.com"
                      autoComplete="email"
                      className="venta-input"
                    />
                  </div>

                  <div>
                    <label htmlFor={`${id}-telefono`} className="venta-label">
                      Teléfono <span className="normal-case tracking-normal">(opcional)</span>
                    </label>
                    <input
                      id={`${id}-telefono`}
                      type="tel"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="70000000"
                      autoComplete="tel"
                      className="venta-input"
                    />
                  </div>

                  <div>
                    <label htmlFor={`${id}-password`} className="venta-label">
                      Contraseña
                    </label>
                    <div className="relative">
                      <input
                        id={`${id}-password`}
                        type={verPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Al menos 8 caracteres"
                        autoComplete="new-password"
                        aria-describedby={`${id}-password-ayuda`}
                        className="venta-input venta-input-con-boton"
                      />
                      {/* Alcanzable con teclado (sin tabIndex -1) y de 44px: es
                          la única forma de comprobar lo que se escribió. */}
                      <button
                        type="button"
                        onClick={() => setVerPassword((v) => !v)}
                        aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        aria-pressed={verPassword}
                        title={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg text-white/60 transition-colors hover:text-[var(--venta-cyan)]"
                      >
                        {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p
                      id={`${id}-password-ayuda`}
                      className="mt-2 text-[12px] font-light text-white/60"
                    >
                      La usará para volver a entrar a ver sus videos.
                    </p>
                  </div>

                  <div>
                    <label htmlFor={`${id}-repetida`} className="venta-label">
                      Repita la contraseña
                    </label>
                    <input
                      id={`${id}-repetida`}
                      type={verPassword ? 'text' : 'password'}
                      required
                      value={repetida}
                      onChange={(e) => setRepetida(e.target.value)}
                      placeholder="La misma contraseña"
                      autoComplete="new-password"
                      className="venta-input"
                    />
                  </div>

                  <button type="submit" disabled={cargando} className="venta-btn">
                    {cargando ? 'Abriendo el pago...' : `Crear cuenta y pagar · Bs ${precio}`}
                  </button>

                  <p className="flex items-center justify-center gap-1.5 text-[12px] font-light text-white/60">
                    <Lock className="h-3 w-3" />
                    El pago se procesa en el sitio del festival.
                  </p>
                </form>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
