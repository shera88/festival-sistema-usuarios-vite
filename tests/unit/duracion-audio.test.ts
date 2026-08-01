import { describe, it, expect } from 'vitest';
import { evaluarExcesoAudio, limiteSegDe, mmss } from '@/lib/duracion-audio';

describe('límites de la convocatoria por subdivisión', () => {
  it('asigna a cada subdivisión el tiempo de la convocatoria', () => {
    expect(limiteSegDe('SOLO')).toBe(150); // 2:30
    expect(limiteSegDe('DUO')).toBe(210); // 3:30
    expect(limiteSegDe('GRUPO PEQUEÑO')).toBe(300); // 5:00
    expect(limiteSegDe('GRUPO GRANDE')).toBe(390); // 6:30
  });

  it('acepta las variantes de escritura que hay en los datos', () => {
    expect(limiteSegDe('DÚO')).toBe(210);
    expect(limiteSegDe('dúo')).toBe(210);
    expect(limiteSegDe('  grupo pequeño ')).toBe(300);
    expect(limiteSegDe('GRUPO CHICO')).toBe(300); // sinónimo antiguo
  });

  it('no inventa un límite para una subdivisión que no conoce', () => {
    expect(limiteSegDe('CUARTETO')).toBeNull();
    expect(limiteSegDe(null)).toBeNull();
    expect(limiteSegDe('')).toBeNull();
  });
});

describe('aviso de audio que se pasa del tiempo', () => {
  it('marca el caso real: grupo pequeño con un audio de 5:30', () => {
    const r = evaluarExcesoAudio(330, 'GRUPO PEQUEÑO');
    expect(r).not.toBeNull();
    expect(r!.duracionTexto).toBe('5:30');
    expect(r!.limiteTexto).toBe('5:00');
    expect(r!.excesoSeg).toBe(30);
    expect(r!.excesoTexto).toBe('30 s');
    expect(r!.subdivisionTexto).toBe('grupo pequeño');
  });

  it('no marca un audio que dura exactamente el límite', () => {
    expect(evaluarExcesoAudio(300, 'GRUPO PEQUEÑO')).toBeNull();
    expect(evaluarExcesoAudio(150, 'SOLO')).toBeNull();
    expect(evaluarExcesoAudio(210, 'DUO')).toBeNull();
    expect(evaluarExcesoAudio(390, 'GRUPO GRANDE')).toBeNull();
  });

  it('trunca las fracciones: 5:00,9 sigue siendo cinco minutos', () => {
    expect(evaluarExcesoAudio(300.9, 'GRUPO PEQUEÑO')).toBeNull();
    expect(evaluarExcesoAudio(300.999, 'GRUPO PEQUEÑO')).toBeNull();
  });

  it('marca desde el primer segundo de más', () => {
    const r = evaluarExcesoAudio(301, 'GRUPO PEQUEÑO');
    expect(r!.excesoSeg).toBe(1);
    expect(r!.excesoTexto).toBe('1 s');
  });

  it('expresa en minutos los excesos de un minuto o más', () => {
    const r = evaluarExcesoAudio(300 + 95, 'GRUPO PEQUEÑO');
    expect(r!.excesoTexto).toBe('1:35');
  });

  it('aplica el límite propio de cada subdivisión', () => {
    // 4:00 (240 s): se pasa en solo y en dúo, no en los grupos.
    expect(evaluarExcesoAudio(240, 'SOLO')).not.toBeNull();
    expect(evaluarExcesoAudio(240, 'DUO')).not.toBeNull();
    expect(evaluarExcesoAudio(240, 'GRUPO PEQUEÑO')).toBeNull();
    expect(evaluarExcesoAudio(240, 'GRUPO GRANDE')).toBeNull();
  });

  it('no avisa si no hay medida del audio', () => {
    expect(evaluarExcesoAudio(null, 'GRUPO PEQUEÑO')).toBeNull();
    expect(evaluarExcesoAudio(undefined, 'GRUPO PEQUEÑO')).toBeNull();
    expect(evaluarExcesoAudio(0, 'GRUPO PEQUEÑO')).toBeNull();
    expect(evaluarExcesoAudio(NaN, 'GRUPO PEQUEÑO')).toBeNull();
    expect(evaluarExcesoAudio(Infinity, 'GRUPO PEQUEÑO')).toBeNull();
  });

  it('no avisa si la subdivisión no permite saber el límite', () => {
    // Preferimos callar antes que acusar a alguien de pasarse sin saberlo.
    expect(evaluarExcesoAudio(9999, null)).toBeNull();
    expect(evaluarExcesoAudio(9999, 'OTRA COSA')).toBeNull();
  });
});

describe('formato de tiempo', () => {
  it('coincide con lo que muestra el reproductor', () => {
    expect(mmss(0)).toBe('0:00');
    expect(mmss(9)).toBe('0:09');
    expect(mmss(330)).toBe('5:30');
    expect(mmss(390)).toBe('6:30');
    expect(mmss(330.7)).toBe('5:30');
  });
});
