import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActoRow } from '@/routes/tabs/ProgramaTab';

/**
 * Fila del programa: al tocarla se despliega la ficha esencial de la obra y el
 * coreógrafo con su foto. Los datos vienen del RPC sorteo_agrupaciones.
 */
const base = {
  id_inscripcion: 'i1',
  id_agrupacion: 'a1',
  nombre_agrupacion: 'BALLET PASO ADELANTE',
  agrupacion: 'BALLET PASO ADELANTE',
  obra: 'ECOS DE LA CHIQUITANIA',
  ciudad: 'Santa Cruz',
  subdivision: 'GRUPO GRANDE',
  modalidad: 'folklore oriental de proyeccion',
  dia: 'MARTES',
  bloque: 'MENOR',
  logo_url: null,
  orden: 1,
  duracion: '6:30',
  categoria: 'AGRUPACION',
  genero: 'FOLKLORE',
  coreografo: 'KELVIN SOSSA GUTIERREZ',
  coreografo_foto: 'https://festivaldanzarte.com/fotos/kelvin.jpg',
  n: 1,
  hora: '19:00',
  dur: '6:30',
  mio: false,
};

describe('ActoRow — fila desplegable del programa', () => {
  it('muestra la cabecera y mantiene el detalle cerrado al inicio', () => {
    render(<ActoRow r={base} esEnsayo={false} />);
    expect(screen.getByText('19:00')).toBeTruthy();
    expect(screen.getByText('01')).toBeTruthy();
    expect(screen.getByText('BALLET PASO ADELANTE')).toBeTruthy();
    // el detalle todavía no está
    expect(screen.queryByText('Coreógrafo')).toBeNull();
    expect(screen.queryByText('Modalidad')).toBeNull();
  });

  it('al hacer click despliega la ficha esencial de la obra', () => {
    render(<ActoRow r={base} esEnsayo={false} />);
    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('Obra')).toBeTruthy();
    expect(screen.getByText('Modalidad')).toBeTruthy();
    expect(screen.getByText('folklore oriental de proyeccion')).toBeTruthy();
    expect(screen.getByText('Género')).toBeTruthy();
    expect(screen.getByText('Categoría')).toBeTruthy();
    expect(screen.getByText('AGRUPACION')).toBeTruthy();
    expect(screen.getByText('Tamaño')).toBeTruthy();
    expect(screen.getByText('Duración')).toBeTruthy();
    expect(screen.getByText('6:30')).toBeTruthy();
    expect(screen.getByText('Ciudad')).toBeTruthy();
    expect(screen.getByText('Santa Cruz')).toBeTruthy();
  });

  it('muestra el coreógrafo con su nombre y su foto', () => {
    const { container } = render(<ActoRow r={base} esEnsayo={false} />);
    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('Coreógrafo')).toBeTruthy();
    expect(screen.getByText('KELVIN SOSSA GUTIERREZ')).toBeTruthy();
    // la foto se renderiza como <img> (no iniciales)
    const imgs = container.querySelectorAll('img');
    const fotos = Array.from(imgs).map((i) => i.getAttribute('src') ?? '');
    expect(fotos.some((s) => s.includes('kelvin.jpg'))).toBe(true);
  });

  it('sin foto de coreógrafo cae a iniciales, y sin coreógrafo lo aclara', () => {
    render(<ActoRow r={{ ...base, coreografo_foto: null }} esEnsayo={false} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('KELVIN SOSSA GUTIERREZ')).toBeTruthy();
    expect(screen.getByText('KS')).toBeTruthy(); // iniciales de respaldo

    render(<ActoRow r={{ ...base, coreografo: null, coreografo_foto: null }} esEnsayo={false} />);
    const filas = screen.getAllByRole('button');
    fireEvent.click(filas[filas.length - 1]);
    expect(screen.getByText('Sin coreógrafo registrado')).toBeTruthy();
  });

  it('en modo ensayo rotula la duración como Ensayo y cambia el badge propio', () => {
    render(<ActoRow r={{ ...base, mio: true, dur: '8:00' }} esEnsayo={true} />);
    expect(screen.getByText('Tu ensayo')).toBeTruthy();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Ensayo')).toBeTruthy();
    expect(screen.getByText('8:00')).toBeTruthy();
  });

  it('oculta los campos que vienen vacíos', () => {
    render(<ActoRow r={{ ...base, ciudad: null, genero: null }} esEnsayo={false} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByText('Ciudad')).toBeNull();
    expect(screen.queryByText('Género')).toBeNull();
    expect(screen.getByText('Modalidad')).toBeTruthy(); // los que sí tienen valor siguen
  });

  it('la foto del coreógrafo se amplía al tocarla, en alta resolución', () => {
    // jsdom no implementa showModal; se espía para comprobar que el lightbox abre.
    const showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.showModal = showModal as never;
    HTMLDialogElement.prototype.close = vi.fn() as never;

    const { container } = render(<ActoRow r={base} esEnsayo={false} />);
    fireEvent.click(screen.getByRole('button'));

    const zoom = screen.getByRole('button', { name: /Ampliar imagen: Coreógrafo KELVIN SOSSA GUTIERREZ/i });
    fireEvent.click(zoom);
    expect(showModal).toHaveBeenCalled();

    // La miniatura pide 96px; la ampliación pide una versión grande (no la miniatura).
    const anchos = Array.from(container.querySelectorAll('img'))
      .map((i) => new URL(i.getAttribute('src') ?? '', 'http://x').searchParams.get('w'))
      .filter(Boolean)
      .map(Number);
    expect(Math.max(...anchos)).toBeGreaterThan(Math.min(...anchos));
    expect(Math.max(...anchos)).toBeGreaterThanOrEqual(1400);
  });
});
