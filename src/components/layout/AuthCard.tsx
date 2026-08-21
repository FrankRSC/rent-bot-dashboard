// THESIS: Split-screen terminal entry — dark hardware body left, illuminated white
// display right. Refuses floating-white-card-on-dark-ink. Seed key c7daea66.
"use client";

import Image from "next/image";
// Import estático: Next infiere ancho/alto y sirve WebP redimensionado. El PNG
// original mide 1442×221 (305 KB) y se muestra a 24 px de alto.
import logo from "../../../public/save-time-logo.png";

/**
 * El degradado del hero de la landing (`savetime.shiftly.mx`), trasladado al
 * panel que sostiene el logotipo.
 *
 * Son tres *blooms* radiales sobre una base lineal. Cada bloom arranca casi en
 * blanco y va cayendo al color —el blanco vive dentro del propio fade, no en un
 * velo aparte—: cian `--ember` arriba a la derecha, un halo frío arriba a la
 * izquierda y verde musgo `--moss` entrando por el costado.
 *
 * Los radios van en porcentaje y no en píxeles como en el sitio: allí la caja
 * mide 1180 px de ancho y aquí 420–460 px, así que un bloom de 720 px fijos
 * taparía el panel entero. En porcentaje conserva la proporción al cambiar de
 * breakpoint.
 */
const PANEL_BG = [
  "radial-gradient(140% 48% at 92% 16%, rgba(190,236,255,.20) 0%, rgba(70,200,245,.24) 22%, rgba(22,169,232,.20) 46%, rgba(22,169,232,.05) 68%, transparent 82%)",
  "radial-gradient(190% 36% at 22% 2%, rgba(150,196,232,.14) 0%, rgba(150,196,232,.06) 30%, transparent 62%)",
  "radial-gradient(170% 44% at 0% 36%, rgba(78,216,172,.14) 0%, rgba(78,216,172,.07) 30%, transparent 62%)",
  "linear-gradient(180deg, #0A2839 0%, #071B2D 46%, #041018 100%)",
].join(", ");

/**
 * Placa del logotipo con los colores de la landing (`savetime.shiftly.mx`):
 * el radio de 9 px de su `.logo-mark` y el punto cian `--ember` (#16A9E8) que
 * ese mosaico lleva en la esquina.
 *
 * La placa va clara y no en el `#0E1A28` del sitio porque el logotipo tiene
 * "Save" en tinta oscura y sobre un fondo oscuro desaparece — verificado en
 * pantalla. `#EEF4F9` es el `--ink` de la propia landing.
 */
function LogoPlate({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative bg-[#EEF4F9] rounded-[9px] px-4 py-2.5 inline-flex ${className}`}
    >
      <Image src={logo} alt="Save Time" priority className="h-6 w-auto object-contain" />
      <span className="absolute right-[3px] bottom-[3px] w-1.5 h-1.5 rounded-full bg-[#16A9E8]" />
    </div>
  );
}

export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    // El degradado también va en la raíz porque en móvil no hay panel: el
    // logotipo se apoya directamente sobre este fondo.
    <div className="min-h-screen flex bg-[#0B1426]" style={{ background: PANEL_BG }}>

      {/* ── Panel izquierdo: cuerpo oscuro del terminal (solo lg+) ─────────── */}
      <div
        className="hidden lg:flex lg:w-[420px] xl:w-[460px] flex-shrink-0 flex-col justify-between p-10 border-r border-white/[0.07]"
        style={{ background: PANEL_BG }}
      >

        <LogoPlate className="self-start" />

        {/* Tagline */}
        <p className="text-white text-[22px] font-semibold leading-snug tracking-tight">
          Tu cobranza de rentas,<br />automatizada.
        </p>

        <p className="text-[11px] text-slate-500">
          © {new Date().getFullYear()} Save Time. Todos los derechos reservados.
        </p>
      </div>

      {/* ── Panel derecho: pantalla iluminada — formulario ─────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:bg-white">

        {/* Logotipo — visible solo en mobile */}
        <div className="lg:hidden mb-8">
          <LogoPlate />
        </div>

        {/* Contenedor del formulario:
            mobile → tarjeta blanca con padding y radio
            desktop → contenido directo sobre el panel blanco */}
        <div className="w-full max-w-sm bg-white lg:bg-transparent rounded-2xl lg:rounded-none p-8 lg:p-0">
          {children}
        </div>
      </div>

    </div>
  );
}
