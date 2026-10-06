// ═══════════════════════════════════════════════════════════════════════════
// DAS BILD IM SCHLUSSBAND (06.10.2026, E-293, Bauplan 2.9, Scheibe C)
//
// HF-4: ein leerer Boardroom über einer US-Skyline zur blauen Stunde, auf dem
// Tisch die Urkunde mit Siegel — die Erzählklammer zum Hero. Desktop: das
// 16:9-Standbild hinter dem Text, ein Verlauf von links legt den Text in den
// Lichtkegel. Handy (≤ 720 px): der 4:5-Ausschnitt über dem Text, unten in das
// Navy des Bandes verlaufend. Der Film bleibt aus, bis er perfekt ist
// (GLOBAL_BILDER.boardroom.film = null). KI-Kennzeichnung: szeneKi aus i18n,
// unten rechts am Bild. Gilt für /business und die 78 Unterseiten.
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_BILDER } from "@/lib/global-bilder";

export default function GlobalSchlussBild({ nachweis }: { nachweis: string }) {
  const b = GLOBAL_BILDER.boardroom, v = GLOBAL_BILDER.version;
  return (
    <div className="fg-schluss-buehne">
      <picture>
        <source media="(max-width: 720px)" srcSet={`${b.hoch}?v=${v}`} width={b.hochMasse[0]} height={b.hochMasse[1]} />
        <img src={`${b.quer}?v=${v}`} width={b.querMasse[0]} height={b.querMasse[1]} alt="" loading="lazy" decoding="async" />
      </picture>
      <span className="fg-schluss-nachweis">{nachweis}</span>
    </div>
  );
}
