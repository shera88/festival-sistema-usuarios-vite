import { api } from './client';
import type { VideoItem, GanadoresBloque, GanadoresCuadro, NominadosResponse } from '@/types/domain';

/**
 * API del área de CLIENTES: público general que compra la membresía de videos y
 * no participa del festival.
 *
 * Va contra `/clientes/*.php`, que usa una cookie propia (`fdz_cliente`). No
 * comparte nada con `authApi`: son dos sesiones distintas y a propósito, porque
 * las credenciales son de distinta calidad —el participante entra con su número
 * de carnet, el cliente con una contraseña bcrypt que eligió—. Una persona puede
 * tener las dos sesiones abiertas a la vez sin que se pisen.
 */

export interface Cliente {
  cliente_id: string;
  email: string;
  nombre: string;
  telefono: string | null;
}

export interface Membresia {
  /** Pagó el Paquete Completo: ve todos los videos del festival. */
  paquete_pagada: boolean;
}

export interface SesionCliente {
  cliente: Cliente;
  membresia: Membresia;
}

export interface DatosRegistro {
  email: string;
  password: string;
  nombre: string;
  telefono?: string;
}

export interface VideosCliente {
  videos: Record<string, VideoItem[]>;
  membresia: Membresia;
}

/** Ganadores para clientes. Llega `publicado: false` mientras la organización no
 *  habilite los resultados: el payload trae lugar y nota, así que se muestra
 *  recién cuando ellos lo digan. */
export interface GanadoresCliente {
  publicado: boolean;
  total: number;
  bloques: GanadoresBloque[];
  absolutos: GanadoresCuadro[];
}

export const clientesApi = {
  registro: (datos: DatosRegistro) => api.post<SesionCliente>('/clientes/registro.php', datos),

  login: (email: string, password: string) =>
    api.post<SesionCliente>('/clientes/login.php', { email, password }),

  logout: () => api.post<{ ok: true }>('/clientes/logout.php', {}),

  me: () => api.get<SesionCliente>('/clientes/me.php'),

  videos: () => api.get<VideosCliente>('/clientes/videos.php'),

  /** Nominados sale del MISMO endpoint que usa el portal: nominados.php acepta
   *  las dos sesiones. Esa lista va mezclada y sin el lugar, así que no hay
   *  nada que recortarle a un cliente. */
  nominados: () => api.get<NominadosResponse>('/nominados.php'),

  ganadores: () => api.get<GanadoresCliente>('/clientes/ganadores.php'),

  /** Crea la orden pendiente en WooCommerce y devuelve a dónde mandar a pagar. */
  checkout: () =>
    api.post<{ pay_url: string; order_id: number; precio: number }>(
      '/clientes/membresia-checkout.php',
      {},
    ),
};
