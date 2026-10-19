// Barra lateral plegada o desplegada (solo escritorio). Es de cada navegador, como el tema
// (lib/tema.ts): se guarda en localStorage, clave `barra`, y no pasa por el servidor.
//
// Plegada, <html> lleva `data-barra="plegada"` y el CSS estrecha la barra a solo iconos
// (app/(app)/layout.module.css y navegacion.module.css). Desplegada no lleva nada: es lo que pinta
// el servidor.

const claveBarra = 'barra';
const plegada = 'plegada';

// localStorage puede no estar (servidor) o estar bloqueado (algunos modos privados): entonces,
// desplegada.
export function leerBarraPlegada(): boolean {
  try {
    return localStorage.getItem(claveBarra) === plegada;
  } catch {
    return false;
  }
}

// Desplegada no se guarda: sin valor es desplegada, igual que sin atributo.
export function guardarBarraPlegada(estaPlegada: boolean): void {
  try {
    if (estaPlegada) localStorage.setItem(claveBarra, plegada);
    else localStorage.removeItem(claveBarra);
  } catch {
    // Sin localStorage dura lo que la página abierta; no es motivo para fallar.
  }
}

export function aplicarBarra(estaPlegada: boolean): void {
  const raiz = document.documentElement;
  if (estaPlegada) raiz.setAttribute('data-barra', plegada);
  else raiz.removeAttribute('data-barra');
}

// Lo mismo que leerBarraPlegada + aplicarBarra, como texto: app/layout.tsx lo pone en línea en
// <head>, junto al del tema, para que la barra no se vea desplegada un instante antes de plegarse.
export const guionBarra =
  `try{if(localStorage.getItem(${JSON.stringify(claveBarra)})===${JSON.stringify(plegada)})` +
  `document.documentElement.setAttribute("data-barra",${JSON.stringify(plegada)})}catch(e){}`;
