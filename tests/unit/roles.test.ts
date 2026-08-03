import { describe, it, expect } from 'vitest';
import { esStaffDeAgrupacion, pagosVisibleParaRol, inscripcionesVisibleParaRol } from '@/lib/roles';

/**
 * Secciones reservadas al staff de la agrupación. Los bailarines figuran en la
 * base como `solicitante`, sin ninguno de los tres indicadores de rol.
 */
const encargado = { es_representante: true, es_director: false, es_coreografo: false };
const director = { es_representante: false, es_director: true, es_coreografo: false };
const coreografo = { es_representante: false, es_director: false, es_coreografo: true };
const bailarin = { es_representante: false, es_director: false, es_coreografo: false };

describe('staff de la agrupación', () => {
  it('reconoce a encargado, director y coreógrafo', () => {
    expect(esStaffDeAgrupacion(encargado)).toBe(true);
    expect(esStaffDeAgrupacion(director)).toBe(true);
    expect(esStaffDeAgrupacion(coreografo)).toBe(true);
  });

  it('reconoce a quien acumula varios roles', () => {
    expect(esStaffDeAgrupacion({ es_representante: true, es_director: true, es_coreografo: true })).toBe(true);
  });

  it('deja fuera al bailarín', () => {
    expect(esStaffDeAgrupacion(bailarin)).toBe(false);
  });

  it('deja fuera a la sesión ausente o incompleta', () => {
    expect(esStaffDeAgrupacion(null)).toBe(false);
    expect(esStaffDeAgrupacion(undefined)).toBe(false);
    expect(esStaffDeAgrupacion({})).toBe(false);
  });
});

describe('acceso a Inscripciones', () => {
  it('lo tienen encargado, director y coreógrafo', () => {
    expect(inscripcionesVisibleParaRol(encargado)).toBe(true);
    expect(inscripcionesVisibleParaRol(director)).toBe(true);
    expect(inscripcionesVisibleParaRol(coreografo)).toBe(true);
  });

  it('NO lo tiene el bailarín', () => {
    expect(inscripcionesVisibleParaRol(bailarin)).toBe(false);
    expect(inscripcionesVisibleParaRol(null)).toBe(false);
  });

  it('usa el mismo criterio que Pagos', () => {
    for (const u of [encargado, director, coreografo, bailarin, null, undefined]) {
      expect(inscripcionesVisibleParaRol(u)).toBe(pagosVisibleParaRol(u));
    }
  });
});
