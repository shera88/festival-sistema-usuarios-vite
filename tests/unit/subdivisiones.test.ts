import { describe, it, expect } from 'vitest';
import { SUBDIVISIONES, SUBDIVISIONES_BLOQUEADAS, step2Schema } from '@/lib/schemas/inscripcion';

/**
 * Solo y Dúo quedaron habilitados el 20/07/2026, sin fecha de cierre.
 * Antes había un gate por fecha que los cerraba solo; estos casos existen para
 * que, si alguien reintroduce un gate así, se note acá y no en producción.
 */
describe('subdivisiones — Solo y Dúo habilitados', () => {
  const solo = SUBDIVISIONES.find((s) => s.value === 'solo')!;
  const duo = SUBDIVISIONES.find((s) => s.value === 'duo')!;

  it('Solo y Dúo se pueden seleccionar en el formulario', () => {
    expect(solo.disabled).toBe(false);
    expect(duo.disabled).toBe(false);
  });

  it('no queda ninguna subdivisión bloqueada', () => {
    expect(SUBDIVISIONES_BLOQUEADAS).toHaveLength(0);
  });

  it('los rangos de integrantes siguen siendo los correctos', () => {
    expect([solo.min, solo.max]).toEqual([1, 1]);
    expect([duo.min, duo.max]).toEqual([2, 2]);
  });

  // Lo que la interfaz no muestra: que la validación del envío también los acepte.
  const base = {
    agrupacion: 'AGRUPACION DE PRUEBA',
    nombre_de_la_obra: 'OBRA DE PRUEBA',
    coreografo: 'COREOGRAFO DE PRUEBA',
    categoria: 'agrupacion',
    division: 'juvenil',
    modalidad: 'FOLCLORE ANDINO',
  } as const;

  it('el esquema acepta Solo con 1 integrante y Dúo con 2', () => {
    expect(step2Schema.safeParse({ ...base, subdivision: 'solo', cantidad: 1 }).success).toBe(true);
    expect(step2Schema.safeParse({ ...base, subdivision: 'duo', cantidad: 2 }).success).toBe(true);
  });

  it('sigue rechazando una cantidad que no coincide con la subdivisión', () => {
    expect(step2Schema.safeParse({ ...base, subdivision: 'solo', cantidad: 3 }).success).toBe(false);
    expect(step2Schema.safeParse({ ...base, subdivision: 'duo', cantidad: 1 }).success).toBe(false);
  });
});
