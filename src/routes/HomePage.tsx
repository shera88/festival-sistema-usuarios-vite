import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Users,
  Award,
  Video,
  FilePlus,
  FileText,
  Music,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useInscripciones, useKardex, useCalificaciones, useVideos } from '@/hooks/queries';
import type { Inscripcion, KardexRow, Nota, VideoItem } from '@/types/domain';

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Carga 2025 (año con más data histórica) para estadísticas
  const inscQ = useInscripciones('2025', !!user);
  const kardexQ = useKardex('2025', !!user);
  const califQ = useCalificaciones('2025', !!user);
  const videosQ = useVideos(!!user);

  const inscripciones = (inscQ.data?.['2025'] ?? []) as Inscripcion[];
  const kardex = (kardexQ.data?.['2025'] ?? []) as KardexRow[];
  const notas = (califQ.data?.['2025'] ?? []) as Nota[];
  const videosData = (videosQ.data ?? {}) as Record<string, VideoItem[]>;
  const totalVideos = Object.values(videosData).reduce((s, v) => s + v.length, 0);

  // Promedio calificaciones
  const obrasNotas: Record<string, number[]> = {};
  for (const n of notas) {
    const k = n.id_inscripcion || `${n.agrupacion}-${n.dia}`;
    const score =
      (Number(n.tematica) || 0) +
      (Number(n.interpretacion) || 0) +
      (Number(n.coreografia) || 0) +
      (Number(n.dificultad_y_ejecucion) || 0);
    (obrasNotas[k] ||= []).push(score);
  }
  const promedios = Object.values(obrasNotas).map(
    (arr) => arr.reduce((a, b) => a + b, 0) / arr.length,
  );
  const promedioGlobal =
    promedios.length === 0
      ? 0
      : Number((promedios.reduce((a, b) => a + b, 0) / promedios.length).toFixed(1));

  const stats = [
    {
      label: 'Inscripciones 2025',
      value: inscripciones.length,
      icon: ClipboardList,
      color: 'var(--cyan)',
      to: '/inscripciones',
    },
    {
      label: 'Integrantes Kardex',
      value: kardex.length,
      icon: Users,
      color: 'var(--fuchsia)',
      to: '/kardex',
    },
    {
      label: 'Total Videos',
      value: totalVideos,
      icon: Video,
      color: 'var(--purple)',
      to: '/videos',
    },
  ];

  const promedioCard = {
    label: 'Promedio Calificaciones',
    value: promedioGlobal,
    icon: Award,
    color: 'var(--gold)',
    to: '/calificaciones',
  };

  const quickActions = [
    {
      to: '/inscripcion',
      label: 'Inscribir Obra',
      desc: 'Registrar una nueva obra al festival',
      icon: FilePlus,
      primary: true,
    },
    {
      to: '/kardex-form',
      label: 'Registrar Integrante',
      desc: 'Sumar bailarines al kardex',
      icon: Music,
      primary: false,
    },
    {
      to: '/solicitud',
      label: 'Enviar Solicitud',
      desc: 'Trámites y solicitudes especiales',
      icon: FileText,
      primary: false,
    },
  ];

  return (
    <div className="space-y-8 p-4 sm:p-6">
      <header>
        <h2 className="text-3xl font-bold tracking-tight text-white">Panel de Control</h2>
        <p className="mt-1 text-text-45">
          Bienvenido de nuevo, <span className="text-white">{user?.nombre_y_apellido}</span>.
          ¿Qué haremos hoy?
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[...stats, promedioCard].map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.label}
              type="button"
              onClick={() => navigate(s.to)}
              className="group flex flex-col items-start gap-3 overflow-hidden rounded-3xl border border-brand-border p-5 text-left transition hover:-translate-y-0.5 hover:border-white/20"
              style={{ background: 'var(--brand-card)' }}
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full transition group-hover:scale-110"
                style={{ background: 'rgba(255,255,255,0.05)', color: s.color }}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <div className="text-3xl font-bold leading-none text-white">{s.value}</div>
                <p
                  className="mt-1 text-[11px] font-medium uppercase text-text-45"
                  style={{ letterSpacing: '0.5px' }}
                >
                  {s.label}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <section className="space-y-4">
        <h3 className="text-xl font-semibold text-white">Acciones Rápidas</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.to}
                type="button"
                onClick={() => navigate(a.to)}
                className={`group flex items-center gap-4 rounded-3xl border p-5 text-left transition hover:-translate-y-0.5 ${
                  a.primary
                    ? 'border-cyan/30 hover:border-cyan/60'
                    : 'border-brand-border hover:border-white/20'
                }`}
                style={{
                  background: a.primary
                    ? 'rgba(0,245,255,0.05)'
                    : 'rgba(255,255,255,0.04)',
                }}
              >
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                  style={
                    a.primary
                      ? {
                          background: 'var(--brand-accent)',
                          color: 'var(--brand-bg)',
                        }
                      : { background: 'rgba(255,255,255,0.08)' }
                  }
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-[14px] font-bold text-white">{a.label}</h4>
                  <p className="mt-0.5 text-[12px] text-text-45">{a.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-text-45 transition group-hover:translate-x-1 group-hover:text-cyan" />
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-white">Actividad Reciente</h3>
          <button
            type="button"
            onClick={() => navigate('/inscripciones')}
            className="text-[12px] text-text-45 transition hover:text-cyan"
          >
            Ver todas →
          </button>
        </div>
        {inscripciones.length === 0 ? (
          <div
            className="rounded-3xl border border-brand-border p-8 text-center text-[13px] text-text-45"
            style={{ background: 'var(--brand-card)' }}
          >
            Sin inscripciones recientes en 2025.
          </div>
        ) : (
          <div className="space-y-2">
            {inscripciones.slice(0, 5).map((i) => (
              <div
                key={i.id_inscripcion}
                className="flex items-center gap-4 rounded-2xl border border-brand-border p-3 transition hover:border-white/20"
                style={{ background: 'var(--brand-card)' }}
              >
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-brand-border"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  {i.enlace_del_logo ? (
                    <img
                      src={i.enlace_del_logo}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ClipboardList className="h-5 w-5 text-cyan" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold text-white">
                    {i.nombre_de_la_obra || 'Sin título'}
                  </div>
                  <div
                    className="mt-0.5 truncate text-[11px] uppercase text-text-45"
                    style={{ letterSpacing: '0.3px' }}
                  >
                    {i.agrupacion} {i.dia && `• ${i.dia}`} {i.modalidad && `• ${i.modalidad}`}
                  </div>
                </div>
                {i.categoria && (
                  <span
                    className="hidden shrink-0 rounded-md border border-cyan/30 bg-cyan/10 px-2 py-1 text-[10px] font-medium uppercase text-cyan sm:inline-block"
                    style={{ letterSpacing: '0.5px' }}
                  >
                    {i.categoria}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
