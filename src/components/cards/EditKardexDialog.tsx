import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { X, Save, AlertCircle, Camera } from 'lucide-react';
import type { KardexRow as KRow } from '@/types/domain';
import { kardexApi, type KardexEditablePatch } from '@/lib/api/kardex';
import { webpProxy } from '@/lib/utils/img';

interface Props {
  open: boolean;
  row: KRow | null;
  onClose: () => void;
}

const CARGOS = ['BAILARÍN', 'COREÓGRAFO', 'DIRECTOR', 'STAFF'];

function asString(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

export function EditKardexDialog({ open, row, onClose }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nombre_y_apellido: '',
    cargo: '',
    telefono: '',
    correo_electronico: '',
    ci: '',
    ciudad: '',
    edad: '',
  });
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [fotoFailed, setFotoFailed] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const localUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !row) return;
    setForm({
      nombre_y_apellido: asString(row.nombre_y_apellido),
      cargo: asString(row.cargo).toUpperCase(),
      telefono: asString(row.telefono),
      correo_electronico: asString(row.correo_electronico),
      ci: asString(row.ci),
      ciudad: asString(row.ciudad),
      edad: asString(row.edad),
    });
    setFotoUrl(row.foto ?? null);
    setFotoFailed(false);
    setPendingFile(null);
    setPreviewOpen(false);
    if (localUrlRef.current) {
      URL.revokeObjectURL(localUrlRef.current);
      localUrlRef.current = null;
    }
    setErrMsg(null);
  }, [open, row]);

  // Cleanup blob URL al desmontar
  useEffect(() => {
    return () => {
      if (localUrlRef.current) {
        URL.revokeObjectURL(localUrlRef.current);
        localUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, saving, onClose]);

  if (!open || !row || !row.id_kardex) return null;

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrMsg('La imagen es muy grande (máx 5 MB)');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setErrMsg(null);
    // Preview local diferido. NO sube hasta GUARDAR.
    if (localUrlRef.current) URL.revokeObjectURL(localUrlRef.current);
    const localUrl = URL.createObjectURL(file);
    localUrlRef.current = localUrl;
    setFotoUrl(localUrl);
    setFotoFailed(false);
    setPendingFile(file);
  }

  async function handleSave() {
    if (!row?.id_kardex) return;
    setSaving(true);
    setErrMsg(null);
    try {
      // 1. Subir foto pendiente si hay (antes del PATCH)
      if (pendingFile) {
        await kardexApi.subirFoto(row.id_kardex, pendingFile);
      }
      // 2. Patch data form
      const patch: KardexEditablePatch = {
        nombre_y_apellido: form.nombre_y_apellido.trim() || null,
        cargo: form.cargo.trim() || null,
        telefono: form.telefono.trim() || null,
        correo_electronico: form.correo_electronico.trim() || null,
        ci: form.ci.trim() || null,
        ciudad: form.ciudad.trim() || null,
        edad: form.edad.trim() === '' ? null : Number(form.edad.trim()),
      };
      await kardexApi.editar(row.id_kardex, patch);
      await qc.invalidateQueries({ queryKey: ['kardex'] });
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al guardar';
      setErrMsg(msg);
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/80 backdrop-blur-md anim-fade-in sm:items-center sm:px-4"
      onClick={saving ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-t-2xl border-x border-t border-glass-border shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.8)] anim-fade-in-up sm:rounded-2xl sm:border"
        style={{ background: 'var(--bg-card)', maxHeight: '90vh' }}
      >
        <div className="flex items-center justify-between border-b border-glass-border px-4 py-3">
          <div>
            <h3 className="text-[14px] font-semibold uppercase text-text-white" style={{ letterSpacing: '0.6px' }}>
              Editar integrante
            </h3>
            <p className="mt-0.5 truncate text-[11px] text-text-45">{row.nombre_y_apellido ?? ''}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar"
            className="grid h-8 w-8 place-items-center rounded-full text-text-45 transition hover:bg-white/10 hover:text-text-white disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="space-y-3 overflow-y-auto px-4 py-4"
          style={{ maxHeight: 'calc(90vh - 130px)' }}
        >
          {/* Foto */}
          <div className="flex items-center gap-3 pb-1">
            <button
              type="button"
              onClick={() => fotoUrl && !fotoFailed && setPreviewOpen(true)}
              aria-label="Ver foto en grande"
              className="relative h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-glass-border transition hover:border-cyan hover:shadow-[0_0_18px_rgba(0,229,255,0.25)]"
              style={{ background: 'var(--bg-elevated)' }}
            >
              {fotoUrl && !fotoFailed ? (
                <img
                  src={fotoUrl.startsWith('blob:') ? fotoUrl : (webpProxy(fotoUrl, 160) ?? fotoUrl)}
                  alt={form.nombre_y_apellido || 'Foto'}
                  className="h-full w-full object-cover"
                  draggable={false}
                  onError={() => setFotoFailed(true)}
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-text-45"
                  style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(0,229,255,0.05) 100%)' }}
                >
                  <Camera className="h-7 w-7" />
                </div>
              )}
              {pendingFile && (
                <span
                  className="absolute bottom-0 left-0 right-0 bg-cyan/90 py-0.5 text-center text-[9px] font-bold uppercase text-[#04020F]"
                  style={{ letterSpacing: '0.5px' }}
                >
                  Pendiente
                </span>
              )}
            </button>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-md border border-cyan/40 bg-cyan/10 px-3 py-1.5 text-[11px] font-semibold uppercase text-cyan transition hover:bg-cyan/20"
                style={{ letterSpacing: '0.5px' }}
              >
                <Camera className="h-3 w-3" />
                Cambiar foto
              </button>
              <p className="text-[10px] text-text-45">JPG, PNG o WEBP · máx 5 MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFotoChange}
                className="hidden"
              />
            </div>
          </div>

          <Field label="Nombre y apellido">
            <input
              type="text"
              value={form.nombre_y_apellido}
              onChange={(e) => setForm((f) => ({ ...f, nombre_y_apellido: e.target.value }))}
              className="w-full rounded-md border border-glass-border bg-[rgba(8,5,30,0.6)] px-3 py-2 text-[13px] text-text-white outline-none transition focus:border-cyan focus:bg-[rgba(8,5,30,0.85)]"
              required
            />
          </Field>

          <Field label="Cargo">
            <select
              value={form.cargo}
              onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}
              className="w-full rounded-md border border-glass-border bg-[rgba(8,5,30,0.6)] px-3 py-2 text-[13px] text-text-white outline-none transition focus:border-cyan focus:bg-[rgba(8,5,30,0.85)]"
            >
              <option value="">—</option>
              {CARGOS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              {form.cargo && !CARGOS.includes(form.cargo) && (
                <option value={form.cargo}>{form.cargo}</option>
              )}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="CI">
              <input
                type="text"
                inputMode="numeric"
                value={form.ci}
                onChange={(e) => setForm((f) => ({ ...f, ci: e.target.value }))}
                className="w-full rounded-md border border-glass-border bg-[rgba(8,5,30,0.6)] px-3 py-2 text-[13px] text-text-white outline-none transition focus:border-cyan focus:bg-[rgba(8,5,30,0.85)]"
              />
            </Field>
            <Field label="Edad">
              <input
                type="text"
                inputMode="numeric"
                value={form.edad}
                onChange={(e) => setForm((f) => ({ ...f, edad: e.target.value }))}
                className="w-full rounded-md border border-glass-border bg-[rgba(8,5,30,0.6)] px-3 py-2 text-[13px] text-text-white outline-none transition focus:border-cyan focus:bg-[rgba(8,5,30,0.85)]"
              />
            </Field>
          </div>

          <Field label="Teléfono">
            <input
              type="tel"
              inputMode="numeric"
              value={form.telefono}
              onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
              className="w-full rounded-md border border-glass-border bg-[rgba(8,5,30,0.6)] px-3 py-2 text-[13px] text-text-white outline-none transition focus:border-cyan focus:bg-[rgba(8,5,30,0.85)]"
            />
          </Field>

          <Field label="Correo">
            <input
              type="email"
              value={form.correo_electronico}
              onChange={(e) => setForm((f) => ({ ...f, correo_electronico: e.target.value }))}
              className="w-full rounded-md border border-glass-border bg-[rgba(8,5,30,0.6)] px-3 py-2 text-[13px] text-text-white outline-none transition focus:border-cyan focus:bg-[rgba(8,5,30,0.85)]"
            />
          </Field>

          <Field label="Ciudad">
            <input
              type="text"
              value={form.ciudad}
              onChange={(e) => setForm((f) => ({ ...f, ciudad: e.target.value }))}
              className="w-full rounded-md border border-glass-border bg-[rgba(8,5,30,0.6)] px-3 py-2 text-[13px] text-text-white outline-none transition focus:border-cyan focus:bg-[rgba(8,5,30,0.85)]"
            />
          </Field>

          {errMsg && (
            <div className="flex items-start gap-2 rounded-md border border-red-400/40 bg-red-400/5 px-3 py-2 text-[12px] text-red-400">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{errMsg}</span>
            </div>
          )}
        </form>

        <div className="flex gap-2 border-t border-glass-border px-4 py-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-full border border-glass-border bg-glass-bg px-4 py-2 text-[12px] font-semibold uppercase text-text-65 transition hover:border-text-45 hover:text-text-white disabled:opacity-50"
            style={{ letterSpacing: '0.6px' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-cyan px-4 py-2 text-[12px] font-semibold uppercase text-[#04020F] transition hover:bg-[#66F0FF] disabled:opacity-50"
            style={{ letterSpacing: '0.6px' }}
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      {previewOpen && fotoUrl && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 p-6 anim-fade-in"
          onClick={(e) => {
            e.stopPropagation();
            setPreviewOpen(false);
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewOpen(false);
            }}
            aria-label="Cerrar"
            className="absolute right-4 top-4 grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-md transition hover:border-cyan hover:text-cyan"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={fotoUrl.startsWith('blob:') ? fotoUrl : (webpProxy(fotoUrl, 800) ?? fotoUrl)}
            alt={form.nombre_y_apellido || 'Foto'}
            onClick={(e) => e.stopPropagation()}
            draggable={false}
            className="max-h-[80vh] max-w-full rounded-2xl shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]"
          />
        </div>
      )}
    </div>,
    document.body,
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span
        className="mb-1 block text-[9px] font-medium uppercase text-text-45"
        style={{ letterSpacing: '0.8px' }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
