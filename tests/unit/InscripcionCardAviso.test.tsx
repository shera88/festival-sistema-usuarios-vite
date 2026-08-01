import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Inscripcion } from '@/types/domain';

/**
 * Aviso de audio que se pasa del tiempo, en la tarjeta de la obra.
 * Se simula la medición del archivo (en el navegador la hace el <audio>) para
 * comprobar lo que de verdad importa acá: que con esa duración la etiqueta
 * aparece, y que sin exceso no aparece nada.
 */

let duracionSimulada: number | null = null;
vi.mock('@/hooks/useDuracionAudio', () => ({
  useDuracionAudio: () => duracionSimulada,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id_contacto: 'c1' }, puedeEditar: true }),
}));

// Subcomponentes pesados o irrelevantes para este aviso.
vi.mock('@/routes/tabs/PagosTab', () => ({ InscripcionPagosPanel: () => null }));
vi.mock('@/components/cards/EditarInscripcionModal', () => ({ EditarInscripcionModal: () => null }));
vi.mock('@/components/cards/MultimediaDialog', () => ({ MultimediaDialog: () => null }));
vi.mock('@/components/cards/VideoModal', () => ({ VideoModal: () => null }));
vi.mock('@/components/cards/JuradoCard', () => ({ JuradoCard: () => null }));

const { InscripcionCard } = await import('@/components/cards/InscripcionCard');

const obra = (subdivision: string): Inscripcion =>
  ({
    id_inscripcion: 'i1',
    id_agrupacion: 'a1',
    agrupacion: 'RITMO BOLIVIANO',
    nombre_de_la_obra: 'SAYA AFRO CAPORAL',
    subdivision,
    modalidad: 'FOLCLORE POPULAR SAYA Y CAPORAL',
    categoria: 'AGRUPACION',
    dia: 'JUEVES',
    duracion: '5:00',
    audio_url_multimedia: 'https://ejemplo.test/saya.mp3',
    musica: null,
    url_video: null,
    enlace_del_logo: null,
    estado_pago: 'pendiente',
  }) as unknown as Inscripcion;

function montar(insc: Inscripcion) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <InscripcionCard insc={insc} notas={[]} year="2026" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  duracionSimulada = null;
});

describe('etiqueta de audio fuera de tiempo', () => {
  it('aparece con el caso real: grupo pequeño con audio de 5:30', () => {
    duracionSimulada = 330;
    montar(obra('GRUPO PEQUEÑO'));
    expect(screen.getByText(/Audio excede 5:00/i)).toBeTruthy();
  });

  it('explica en el título cuánto dura, cuál es el límite y cuánto se pasa', () => {
    duracionSimulada = 330;
    montar(obra('GRUPO PEQUEÑO'));
    const chip = screen.getByText(/Audio excede 5:00/i).closest('span[title]');
    const titulo = chip?.getAttribute('title') ?? '';
    expect(titulo).toContain('5:30');
    expect(titulo).toContain('5:00');
    expect(titulo).toContain('grupo pequeño');
    expect(titulo).toContain('30 s');
  });

  it('no aparece cuando el audio entra justo en el límite', () => {
    duracionSimulada = 300;
    montar(obra('GRUPO PEQUEÑO'));
    expect(screen.queryByText(/Audio excede/i)).toBeNull();
  });

  it('no aparece mientras no hay medida del audio', () => {
    duracionSimulada = null;
    montar(obra('GRUPO PEQUEÑO'));
    expect(screen.queryByText(/Audio excede/i)).toBeNull();
  });

  it('usa el límite de cada subdivisión: 5:30 se pasa en grupo pequeño pero no en grande', () => {
    duracionSimulada = 330;
    const { unmount } = montar(obra('GRUPO PEQUEÑO'));
    expect(screen.queryByText(/Audio excede/i)).not.toBeNull();
    unmount();

    montar(obra('GRUPO GRANDE'));
    expect(screen.queryByText(/Audio excede/i)).toBeNull();
  });

  it('marca un solo de 2:31 (límite 2:30)', () => {
    duracionSimulada = 151;
    montar(obra('SOLO'));
    expect(screen.getByText(/Audio excede 2:30/i)).toBeTruthy();
  });

  it('marca un dúo de 3:33 (límite 3:30)', () => {
    duracionSimulada = 213;
    montar(obra('DUO'));
    expect(screen.getByText(/Audio excede 3:30/i)).toBeTruthy();
  });
});
