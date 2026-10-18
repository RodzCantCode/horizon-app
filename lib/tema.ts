// Tema de la app: claro, oscuro o el del sistema. Es de cada navegador (se guarda en localStorage,
// clave `tema`), no de la cuenta, y por eso no pasa por el servidor.
//
// En <html> hay dos atributos:
// - `data-tema` ("claro" u "oscuro") es el de la app: con él, app/global.css elige sus tokens. Sin
//   atributo es el tema del sistema, que global.css resuelve con @media (prefers-color-scheme).
// - `data-theme` ("light", "dark" o "system") es el de Mochi: con él elige sus colores base, el
//   color-scheme de los controles nativos y sus reglas propias de cada tema. El servidor lo pinta
//   como "system".

export type Tema = 'claro' | 'oscuro' | 'sistema';

const claveTema = 'tema';

const temaDeMochi: Record<Tema, string> = {
  claro: 'light',
  oscuro: 'dark',
  sistema: 'system',
};

function esTemaElegido(valor: string | null): valor is 'claro' | 'oscuro' {
  return valor === 'claro' || valor === 'oscuro';
}

// localStorage puede no estar (servidor) o estar bloqueado (algunos modos privados): entonces es el
// del sistema.
export function leerTema(): Tema {
  try {
    const guardado = localStorage.getItem(claveTema);
    return esTemaElegido(guardado) ? guardado : 'sistema';
  } catch {
    return 'sistema';
  }
}

// «Sistema» no se guarda: sin valor es sistema, igual que sin atributo.
export function guardarTema(tema: Tema): void {
  try {
    if (tema === 'sistema') localStorage.removeItem(claveTema);
    else localStorage.setItem(claveTema, tema);
  } catch {
    // Sin localStorage el tema dura lo que la página abierta; no es motivo para fallar.
  }
}

export function aplicarTema(tema: Tema): void {
  const raiz = document.documentElement;
  if (tema === 'sistema') raiz.removeAttribute('data-tema');
  else raiz.setAttribute('data-tema', tema);
  raiz.setAttribute('data-theme', temaDeMochi[tema]);
}

// Lo mismo que leerTema + aplicarTema, como texto: app/layout.tsx lo pone en línea en <head> para
// que corra antes de pintar y no se vea un destello del tema equivocado. Solo actúa si hay un tema
// elegido; si no, se queda lo que pinta el servidor (sistema).
export const guionTema =
  `try{var t=localStorage.getItem(${JSON.stringify(claveTema)});` +
  `if(t==="claro"||t==="oscuro"){var r=document.documentElement;` +
  `r.setAttribute("data-tema",t);` +
  `r.setAttribute("data-theme",t==="claro"?${JSON.stringify(temaDeMochi.claro)}:${JSON.stringify(temaDeMochi.oscuro)})}}` +
  `catch(e){}`;
