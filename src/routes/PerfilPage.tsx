import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Save, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { perfilApi, type PerfilPatch } from '@/lib/api/perfil';
import { webpProxy } from '@/lib/utils/img';

function asString(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

export function PerfilPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nombre_y_apellido: '',
    telefono: '',
    correo_electronico: '',
    ciudad: '',
  });
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!user) return;
    setForm({
      nombre_y_apellido: asString(user.nombre_y_apellido),
      telefono: asString(user.telefono),
      correo_electronico: asString(user.correo_electronico),
      ciudad: asString(user.ciudad),
    });
  }, [user]);

  if (!user) return null;

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setErrMsg(null);
    setSuccessMsg(null);
    try {
      const patch: PerfilPatch = {
        nombre_y_apellido: form.nombre_y_apellido.trim() || null,
        telefono: form.telefono.trim() || null,
        correo_electronico: form.correo_electronico.trim() || null,
        ciudad: form.ciudad.trim() || null,
      };
      const res = await perfilApi.editar(patch);
      setUser(res.user);
      setSuccessMsg('Cambios guardados correctamente.');
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al guardar';
      setErrMsg(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrMsg('La imagen es muy grande (máx 5 MB)');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setUploadingFoto(true);
    setErrMsg(null);
    setSuccessMsg(null);
    try {
      const res = await perfilApi.subirFoto(file);
      setUser(res.user);
      setSuccessMsg('Foto actualizada.');
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err: unknown) {
      setErrMsg(err instanceof Error ? err.message : 'Error al subir foto');
    } finally {
      setUploadingFoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const fotoSrc = user.imagen_contacto
    ? webpProxy(user.imagen_contacto, 240) ?? user.imagen_contacto
    : null;
  const initial = (user.nombre_y_apellido || '?').charAt(0).toUpperCase();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-text-65 transition hover:text-cyan"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </button>

      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-text-white sm:text-3xl">
          Mi{' '}
          <span
            className="bg-clip-text font-extrabold text-transparent"
            style={{
              backgroundImage: 'linear-gradient(135deg, var(--cyan), var(--fuchsia))',
            }}
          >
            Perfil
          </span>
        </h1>
        <p className="mt-1.5 text-[12px] text-text-65">
          Edite sus datos personales. El carnet de identidad no es modificable.
        </p>
      </header>

      {/* Foto */}
      <section className="mb-6 flex flex-col items-center gap-3 rounded-2xl border border-glass-border bg-glass-bg p-5 sm:flex-row sm:items-center sm:gap-5">
        <div
          className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-cyan/40"
          style={{ background: 'var(--bg-elevated)' }}
        >
          {fotoSrc ? (
            <img
              src={fotoSrc}
              alt={user.nombre_y_apellido ?? 'Perfil'}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center font-display text-3xl font-bold text-cyan"
              style={{ background: 'var(--bg-card)' }}
            >
              {initial}
            </div>
          )}
          {uploadingFoto && (
            <div className="absolute inset-0 grid place-items-center bg-black/55 backdrop-blur-sm">
              <Loader2 className="h-7 w-7 animate-spin text-cyan" />
            </div>
          )}
        </div>
        <div className="flex flex-col items-center gap-2 sm:items-start">
          <button
            type="button"
            disabled={uploadingFoto}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-md border border-cyan/40 bg-cyan/10 px-3 py-1.5 text-[11px] font-semibold uppercase text-cyan transition hover:bg-cyan/20 disabled:opacity-50"
            style={{ letterSpacing: '0.5px' }}
          >
            <Camera className="h-3.5 w-3.5" />
            {uploadingFoto ? 'Subiendo…' : 'Cambiar foto'}
          </button>
          <p className="text-[10px] text-text-45">JPG, PNG, WEBP · máx 5 MB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFotoChange}
            className="hidden"
          />
        </div>
      </section>

      {/* Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        className="space-y-4 rounded-2xl border border-glass-border bg-glass-bg p-5"
      >
        <Field label="Nombre y apellido">
          <input
            type="text"
            value={form.nombre_y_apellido}
            onChange={(e) => setForm((f) => ({ ...f, nombre_y_apellido: e.target.value }))}
            className="input-perfil"
            required
          />
        </Field>

        <Field label="Carnet de identidad">
          <input
            type="text"
            value={user.numero_de_carnet ?? ''}
            readOnly
            disabled
            className="input-perfil opacity-60 cursor-not-allowed"
          />
          <p className="mt-1 text-[10px] text-text-45">No modificable</p>
        </Field>

        <Field label="Teléfono">
          <input
            type="tel"
            inputMode="numeric"
            value={form.telefono}
            onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
            className="input-perfil"
          />
        </Field>

        <Field label="Correo">
          <input
            type="email"
            value={form.correo_electronico}
            onChange={(e) => setForm((f) => ({ ...f, correo_electronico: e.target.value }))}
            className="input-perfil"
          />
        </Field>

        <Field label="Ciudad">
          <input
            type="text"
            value={form.ciudad}
            onChange={(e) => setForm((f) => ({ ...f, ciudad: e.target.value }))}
            className="input-perfil"
          />
        </Field>

        {errMsg && (
          <div className="flex items-start gap-2 rounded-md border border-red-400/40 bg-red-400/5 px-3 py-2 text-[12px] text-red-400">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{errMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="flex items-start gap-2 rounded-md border border-cyan/40 bg-cyan/5 px-3 py-2 text-[12px] text-cyan">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-1.5 rounded-full bg-cyan px-4 py-2.5 text-[12px] font-semibold uppercase text-[#04020F] transition hover:bg-[#66F0FF] disabled:opacity-50"
          style={{ letterSpacing: '0.6px' }}
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>

      <style>{`
        .input-perfil {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid var(--glass-border);
          background: rgba(8, 5, 30, 0.6);
          padding: 0.6rem 0.85rem;
          font-size: 13px;
          color: var(--text-white);
          outline: none;
          transition: border-color 0.15s, background 0.15s;
        }
        .input-perfil:focus {
          border-color: var(--cyan);
          background: rgba(8, 5, 30, 0.9);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span
        className="mb-1 block text-[10px] font-semibold uppercase text-text-65"
        style={{ letterSpacing: '0.6px' }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
