import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aplicarTema, guardarTema, guionTema, leerTema, type Tema } from '@/lib/tema';

// Las pruebas corren en Node, sin navegador: basta un localStorage en memoria y un <html> falso que
// apunte sus atributos.
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

describe('leerTema y guardarTema', () => {
  it('sin valor guardado es el del sistema', () => {
    expect(leerTema()).toBe('sistema');
  });

  it('un valor que no es un tema cuenta como sistema', () => {
    localStorage.setItem('tema', 'rosa');
    expect(leerTema()).toBe('sistema');
  });

  it('guarda y lee claro y oscuro', () => {
    guardarTema('claro');
    expect(leerTema()).toBe('claro');
    guardarTema('oscuro');
    expect(leerTema()).toBe('oscuro');
  });

  it('volver a sistema borra la clave', () => {
    guardarTema('oscuro');
    guardarTema('sistema');
    expect(localStorage.getItem('tema')).toBe(null);
    expect(leerTema()).toBe('sistema');
  });

  it('si el navegador bloquea localStorage, se queda en sistema sin fallar', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
      removeItem: () => {
        throw new Error('bloqueado');
      },
    });
    expect(() => guardarTema('claro')).not.toThrow();
    expect(leerTema()).toBe('sistema');
  });
});

describe('aplicarTema y el guion previo al pintado', () => {
  // Lo que deja el guion en <html> al cargar, con lo que haya guardado.
  function atributosDelGuion(guardado: string | null) {
    const almacen = almacenEnMemoria();
    if (guardado !== null) almacen.setItem('tema', guardado);
    const raiz = raizFalsa();
    new Function('localStorage', 'document', guionTema)(almacen, { documentElement: raiz });
    return Object.fromEntries(raiz.atributos);
  }

  // Lo que deja aplicarTema partiendo del <html> que pinta el servidor (data-theme="system").
  function atributosDeAplicar(tema: Tema) {
    const raiz = raizFalsa();
    raiz.setAttribute('data-theme', 'system');
    vi.stubGlobal('document', { documentElement: raiz });
    aplicarTema(tema);
    return Object.fromEntries(raiz.atributos);
  }

  it('claro y oscuro ponen data-tema y el data-theme de Mochi', () => {
    expect(atributosDelGuion('claro')).toEqual({ 'data-tema': 'claro', 'data-theme': 'light' });
    expect(atributosDelGuion('oscuro')).toEqual({ 'data-tema': 'oscuro', 'data-theme': 'dark' });
  });

  it('sin tema guardado, o con uno desconocido, el guion no toca nada', () => {
    expect(atributosDelGuion(null)).toEqual({});
    expect(atributosDelGuion('rosa')).toEqual({});
  });

  it('aplicarTema deja lo mismo que el guion', () => {
    expect(atributosDeAplicar('claro')).toEqual(atributosDelGuion('claro'));
    expect(atributosDeAplicar('oscuro')).toEqual(atributosDelGuion('oscuro'));
  });

  it('aplicarTema a sistema quita data-tema y deja a Mochi siguiendo al sistema', () => {
    const raiz = raizFalsa();
    raiz.setAttribute('data-tema', 'oscuro');
    raiz.setAttribute('data-theme', 'dark');
    vi.stubGlobal('document', { documentElement: raiz });
    aplicarTema('sistema');
    expect(Object.fromEntries(raiz.atributos)).toEqual({ 'data-theme': 'system' });
  });
});
