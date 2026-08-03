import { describe, it, expect } from 'vitest';
import {
  fechaPresentacionDe,
  fechaEnsayoDe,
  fechaLarga,
  textoFechaEnsayo,
} from '@/lib/fechas-festival';

/**
 * Festival 2026: martes 4 a domingo 9 de agosto. Cada agrupación ensaya el día
 * ANTERIOR al que se presenta; las finales del fin de semana no tienen ensayo.
 */

describe('fechas de presentación', () => {
  it('cubre los seis días del festival', () => {
    expect(fechaPresentacionDe('MARTES')).toBe('2026-08-04');
    expect(fechaPresentacionDe('MIERCOLES')).toBe('2026-08-05');
    expect(fechaPresentacionDe('JUEVES')).toBe('2026-08-06');
    expect(fechaPresentacionDe('VIERNES')).toBe('2026-08-07');
    expect(fechaPresentacionDe('SABADO')).toBe('2026-08-08');
    expect(fechaPresentacionDe('DOMINGO')).toBe('2026-08-09');
  });

  it('no inventa fechas para un día desconocido', () => {
    expect(fechaPresentacionDe('LUNES')).toBeNull();
    expect(fechaPresentacionDe(null)).toBeNull();
  });
});

describe('fecha del ensayo: el día anterior', () => {
  it('quien baila el martes ensaya el lunes', () => {
    expect(fechaEnsayoDe('MARTES')).toBe('2026-08-03');
    expect(textoFechaEnsayo('MARTES')).toBe('Lunes 03 de agosto');
  });

  it('corre un día para cada jornada', () => {
    expect(textoFechaEnsayo('MIERCOLES')).toBe('Martes 04 de agosto');
    expect(textoFechaEnsayo('JUEVES')).toBe('Miércoles 05 de agosto');
    expect(textoFechaEnsayo('VIERNES')).toBe('Jueves 06 de agosto');
  });

  it('sábado y domingo no tienen ensayo', () => {
    expect(fechaEnsayoDe('SABADO')).toBeNull();
    expect(fechaEnsayoDe('DOMINGO')).toBeNull();
    expect(textoFechaEnsayo('SABADO')).toBe('');
    expect(textoFechaEnsayo('DOMINGO')).toBe('');
  });

  it('acepta el día en cualquier forma de escritura', () => {
    expect(fechaEnsayoDe('martes')).toBe('2026-08-03');
    expect(fechaEnsayoDe('  Martes ')).toBe('2026-08-03');
  });

  it('no ensaya nadie en un día que no existe', () => {
    expect(fechaEnsayoDe('LUNES')).toBeNull();
    expect(fechaEnsayoDe(null)).toBeNull();
    expect(fechaEnsayoDe('')).toBeNull();
  });

  it('todos los ensayos caen de lunes a viernes', () => {
    // Lo pidió así el festival: no se ensaya en fin de semana.
    for (const dia of ['MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES']) {
      const iso = fechaEnsayoDe(dia)!;
      const [y, m, d] = iso.split('-').map(Number);
      const diaSemana = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 dom … 6 sáb
      expect(diaSemana).toBeGreaterThanOrEqual(1);
      expect(diaSemana).toBeLessThanOrEqual(5);
    }
  });
});

describe('formato de fecha', () => {
  it('se lee como lo escribe el festival', () => {
    expect(fechaLarga('2026-08-03')).toBe('Lunes 03 de agosto');
    expect(fechaLarga('2026-08-09')).toBe('Domingo 09 de agosto');
  });

  it('no se corre un día según la zona horaria del equipo', () => {
    // Con `new Date('2026-08-03')` interpretado en local, en América esto daría
    // el día 2. Por eso el módulo trabaja en UTC.
    expect(fechaLarga('2026-08-03')).toContain('03');
  });

  it('devuelve vacío si la fecha no sirve', () => {
    expect(fechaLarga(null)).toBe('');
    expect(fechaLarga('')).toBe('');
    expect(fechaLarga('03/08/2026')).toBe('');
  });
});
