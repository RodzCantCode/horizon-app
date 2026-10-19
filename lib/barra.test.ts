import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aplicarBarra, guardarBarraPlegada, guionBarra, leerBarraPlegada } from '@/lib/barra';

// Como en lib/tema.test.ts: sin navegador, un localStorage en memoria y un <html> falso.
function almacenEnMemoria(): Storage {
  const datos = new Map<string, string>();
  return {
    get length() {
      return datos.size;
    },
    clear: () => datos.clear(),
    getItem: (clave) => datos.get(clave) ?? null,
    key: (indice) => [...datos.keys()][indice] ?? null,
    removeItem: (clave) => {
      datos.delete(clave);
    },
    setItem: (clave, valor) => {
      datos.set(clave, String(valor));
    },
  };
}

function raizFalsa() {
  const atributos = new Map<string, string>();
  return {
    atributos,
    setAttribute: (nombre: string, valor: string) => atributos.set(nombre, valor),
    removeAttribute: (nombre: string) => atributos.delete(nombre),
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', almacenEnMemoria());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('barra lateral plegada', () => {
  it('sin nada guardado, desplegada', () => {
    expect(leerBarraPlegada()).toBe(false);
  });

  it('guarda plegada y, al desplegar, borra la clave', () => {
    guardarBarraPlegada(true);
    expect(leerBarraPlegada()).toBe(true);
    guardarBarraPlegada(false);
    expect(leerBarraPlegada()).toBe(false);
    expect(localStorage.length).toBe(0);
  });

  it('sin localStorage, desplegada y sin fallar', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    });
    expect(leerBarraPlegada()).toBe(false);
    expect(() => guardarBarraPlegada(true)).not.toThrow();
  });

  it('aplicarBarra pone y quita data-barra', () => {
    const raiz = raizFalsa();
    vi.stubGlobal('document', { documentElement: raiz });
    aplicarBarra(true);
    expect(Object.fromEntries(raiz.atributos)).toEqual({ 'data-barra': 'plegada' });
    aplicarBarra(false);
    expect(raiz.atributos.size).toBe(0);
  });

  it('el guion en línea hace lo mismo que leer y aplicar', () => {
    for (const estaPlegada of [true, false]) {
      const almacen = almacenEnMemoria();
      vi.stubGlobal('localStorage', almacen);
      guardarBarraPlegada(estaPlegada);
      const raiz = raizFalsa();
      new Function('localStorage', 'document', guionBarra)(almacen, { documentElement: raiz });
      expect(raiz.atributos.get('data-barra')).toBe(estaPlegada ? 'plegada' : undefined);
    }
  });
});
