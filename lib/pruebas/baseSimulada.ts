// Base de datos simulada en memoria para las pruebas de las acciones de servidor, con lo que estas
// usan del cliente de Supabase: from(tabla) con select (y una tabla anidada: «*, planes(*)»,
// «…, plan_piezas(estado)» o «…, estrategia_piezas(…)»), insert (una fila o varias), update,
// delete, eq, order y maybeSingle; rpc, y auth.getClaims (la sesión que se prepara en `sesion`).
// Se porta como PostgREST en lo que importa aquí: update y delete tocan solo las filas que cumplen
// los filtros y devuelven las tocadas. Así la prueba mira cómo queda la base, no solo qué se pidió.
// Con `antesDeEscribir`, otra persona cambia la base entre la lectura de una acción y su escritura.
//
// Cada archivo de pruebas la conecta en lugar del cliente real (vi.mock se eleva por encima de los
// import, así que el módulo se carga dentro de la fábrica):
//
//   vi.mock('@/lib/supabase/servidor', async () => {
//     const { clienteSimulado } = await import('@/lib/pruebas/baseSimulada');
//     return { crearClienteServidor: async () => clienteSimulado };
//   });
//
// y la prepara antes de cada prueba con `prepararBase()` (vacía y con las piezas y estrategias del
// prototipo) o `vaciarBase()` (vacía del todo). Las funciones de dentro leen `tablas`,
// `fallos` y `rpc` al llamarse, no al definirse. Solo la usan las pruebas.

import type { Tables } from '@/lib/supabase/tipos';

export type Fila = Record<string, unknown>;
export type ErrorBase = { code: string; message: string };
export type Escritura = {
  tabla: string;
  operacion: 'insert' | 'update' | 'delete';
  valores?: Fila | Fila[];
  filtros: [string, unknown][];
};

export const tablas = new Map<string, Fila[]>();
/**
 * Consultas que fallan con ese error: todas las de una tabla («piezas») o solo una operación suya
 * («estrategia_piezas.insert»), mientras sigan aquí.
 */
export const fallos = new Map<string, ErrorBase>();
/** Lo que se ha pedido escribir, en orden. */
export const escrituras: Escritura[] = [];
/** Llamadas a funciones de la base (rpc), en orden. */
export const llamadasRpc: [string, Record<string, unknown>][] = [];
/**
 * Lo que hace otra persona justo antes de la próxima escritura de una tabla («plan_piezas.update»):
 * para probar qué pasa si la fila cambia entre la lectura de la acción y su escritura. Corre una vez.
 */
export const antesDeEscribir = new Map<string, () => void>();
/** La sesión de la prueba, como la da `auth.getClaims()`: `null` es sin sesión. */
export const sesion: { claims: { sub: string; email?: string } | null } = { claims: null };
/** Lo que responde la próxima llamada a una función de la base. */
export const rpc: { respuesta: { data: unknown; error: ErrorBase | null } } = {
  respuesta: { data: null, error: null },
};

export function vaciarBase() {
  tablas.clear();
  fallos.clear();
  antesDeEscribir.clear();
  escrituras.length = 0;
  llamadasRpc.length = 0;
  rpc.respuesta = { data: null, error: null };
  sesion.claims = null;
}

/** La fila de esa tabla con ese id, tal como ha quedado. */
export const filaDe = (tabla: string, id: string) => tablas.get(tabla)?.find((f) => f.id === id);

function consulta(tabla: string) {
  let operacion: 'select' | Escritura['operacion'] = 'select';
  let valores: Fila | Fila[] | undefined;
  let anidada: string | null = null;
  let una = false;
  const filtros: [string, unknown][] = [];
  const cumple = (fila: Fila) => filtros.every(([columna, valor]) => fila[columna] === valor);

  // La tabla anidada se pega como la da PostgREST: un plan dentro de su pieza, las piezas dentro de
  // su plan y las de una estrategia dentro de ella.
  function conAnidada(fila: Fila): Fila {
    if (anidada === 'planes') {
      return { ...fila, planes: tablas.get('planes')?.find((p) => p.id === fila.plan_id) ?? null };
    }
    if (anidada === 'plan_piezas') {
      return { ...fila, plan_piezas: (tablas.get('plan_piezas') ?? []).filter((p) => p.plan_id === fila.id) };
    }
    if (anidada === 'estrategia_piezas') {
      return {
        ...fila,
        estrategia_piezas: (tablas.get('estrategia_piezas') ?? []).filter((i) => i.estrategia_id === fila.id),
      };
    }
    return { ...fila };
  }

  function ejecutar(): { data: unknown; error: ErrorBase | null } {
    if (operacion !== 'select') {
      const otraPersona = antesDeEscribir.get(`${tabla}.${operacion}`);
      antesDeEscribir.delete(`${tabla}.${operacion}`);
      otraPersona?.();
      escrituras.push({ tabla, operacion, valores, filtros });
    }
    const fallo = fallos.get(`${tabla}.${operacion}`) ?? fallos.get(tabla);
    if (fallo) return { data: null, error: fallo };

    const filas = tablas.get(tabla) ?? [];
    if (operacion === 'select') {
      const elegidas = filas.filter(cumple).map(conAnidada);
      return { data: una ? (elegidas[0] ?? null) : elegidas, error: null };
    }
    if (operacion === 'update') {
      const elegidas = filas.filter(cumple);
      for (const fila of elegidas) Object.assign(fila, valores);
      return { data: elegidas.map((fila) => ({ ...fila })), error: null };
    }
    if (operacion === 'delete') {
      tablas.set(tabla, filas.filter((fila) => !cumple(fila)));
      return { data: filas.filter(cumple), error: null };
    }
    const lista = Array.isArray(valores) ? valores : [valores];
    const nuevas = lista.map((v, i) => ({ id: `nueva-${filas.length + i + 1}`, ...v }));
    tablas.set(tabla, [...filas, ...nuevas]);
    return { data: nuevas, error: null };
  }

  const constructor = {
    select(columnas = '*') {
      anidada = /(planes|plan_piezas|estrategia_piezas)\(/.exec(columnas)?.[1] ?? null;
      return constructor;
    },
    insert(filas: Fila | Fila[]) {
      operacion = 'insert';
      valores = filas;
      return constructor;
    },
    update(cambios: Fila) {
      operacion = 'update';
      valores = cambios;
      return constructor;
    },
    delete() {
      operacion = 'delete';
      return constructor;
    },
    eq(columna: string, valor: unknown) {
      filtros.push([columna, valor]);
      return constructor;
    },
    order: () => constructor,
    maybeSingle() {
      una = true;
      return constructor;
    },
    then: (resolver: (r: unknown) => unknown, rechazar: (e: unknown) => unknown) =>
      Promise.resolve().then(ejecutar).then(resolver, rechazar),
  };
  return constructor;
}

/** Lo que las acciones reciben de `crearClienteServidor()` en las pruebas. */
export const clienteSimulado = {
  from: consulta,
  auth: {
    getClaims: async () => ({ data: sesion.claims ? { claims: sesion.claims } : null, error: null }),
  },
  rpc: async (funcion: string, argumentos: Record<string, unknown>) => {
    llamadasRpc.push([funcion, argumentos]);
    return rpc.respuesta;
  },
};

// --- Piezas y estrategias del prototipo -------------------------------------------------------------

// Como las da PostgREST: horas con segundos. Las del prototipo (prototipo/index.html), con hora
// habitual solo en el clip principal y, salvo que la prueba diga otra cosa, todos los días permitidos.
function filaPieza(cambios: Partial<Tables<'piezas'>> & Pick<Tables<'piezas'>, 'id' | 'nombre'>): Tables<'piezas'> {
  return {
    nombre_corto: cambios.nombre,
    formato: 'reel',
    canales: ['ig', 'tiktok', 'shorts'],
    dias_permitidos: [-1, 0, 1, 2, 3, 4, 5],
    dias_preparacion: 2,
    hora_habitual: null,
    archivada: false,
    ...cambios,
  };
}

/** Las piezas del prototipo, con los cambios que pida la prueba por id. */
export function filasPiezas(cambios: Record<string, Partial<Tables<'piezas'>>> = {}): Tables<'piezas'>[] {
  return [
    filaPieza({ id: 't1', nombre: 'T1 · Próximos invitados', nombre_corto: 'Próximos invitados', formato: 'slide', canales: ['ig', 'tiktok'] }),
    filaPieza({ id: 't2', nombre: 'T2 · Valor + CTA', nombre_corto: 'Valor + CTA', formato: 'slide', canales: ['ig', 'tiktok'], dias_preparacion: 3 }),
    filaPieza({ id: 't3', nombre: 'T3 · Frases de invitados', nombre_corto: 'Frases de invitados', formato: 'slide', canales: ['ig', 'tiktok'] }),
    filaPieza({ id: 't4', nombre: 'T4 · Historia del invitado', nombre_corto: 'Historia del invitado', formato: 'slide', canales: ['ig', 'tiktok'], dias_preparacion: 3 }),
    filaPieza({ id: 'rp', nombre: 'Clip principal', hora_habitual: '18:00:00' }),
    filaPieza({ id: 'rc', nombre: 'Clip secundario' }),
    filaPieza({ id: 'rt', nombre: 'Teaser' }),
    filaPieza({ id: 'ra', nombre: 'Clip de archivo', dias_preparacion: 1 }),
  ].map((fila) => ({ ...fila, ...cambios[fila.id] }));
}

// E1, E2 y E3 del prototipo: [id, nombre, con episodio, [pieza, desplazamiento]…].
const ESTRATEGIAS: [string, string, boolean, [string, number][]][] = [
  ['e1', 'E1 · Anticipación fuerte', true, [['t4', -1], ['rp', 0], ['rc', 2], ['t2', 4], ['rc', 5]]],
  ['e2', 'E2 · Valor primero', true, [['rt', -1], ['rp', 0], ['t2', 1], ['t3', 4], ['rc', 5]]],
  ['e3', 'E3 · Recopilación', false, [['t3', -1], ['ra', 1], ['ra', 4], ['t1', 5]]],
];

export function filasEstrategias(): Tables<'estrategias'>[] {
  return ESTRATEGIAS.map(([id, nombre, con_episodio]) => ({ id, nombre, con_episodio }));
}

export function filasEstrategiaPiezas(): Tables<'estrategia_piezas'>[] {
  return ESTRATEGIAS.flatMap(([estrategia_id, , , items]) =>
    items.map(([pieza_id, desplazamiento], i) => ({ id: `${estrategia_id}-${i + 1}`, estrategia_id, pieza_id, desplazamiento })),
  );
}

/** Vacía la base y pone las piezas y las estrategias del prototipo (sin planes). */
export function prepararBase() {
  vaciarBase();
  tablas.set('piezas', filasPiezas());
  tablas.set('estrategias', filasEstrategias());
  tablas.set('estrategia_piezas', filasEstrategiaPiezas());
  tablas.set('planes', []);
  tablas.set('plan_piezas', []);
}
