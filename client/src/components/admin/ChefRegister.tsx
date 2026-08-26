// ═══════════════════════════════════════════════════════════════════════════
// DAS REGISTER — der Raum, in dem nichts verlorengeht (26.08.2026)
//
// Ein Verzeichnis ist nur so gut wie seine Suche. Deshalb steht sie oben und
// ist beim Betreten schon scharf: tippen, ohne vorher irgendwo hinzuklicken.
//
// Gesucht wird nicht nur im Namen, sondern auch in der Erklärung und in
// hinterlegten Nebenworten — wer „Ausweis" tippt, findet die KYC-Prüfung,
// obwohl das Wort im Namen gar nicht vorkommt.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, ArrowUpRight, ShieldAlert, Lock } from "lucide-react";
import { REGISTER, REGISTER_ANZAHL, type Registereintrag } from "./chef-register";
import { zahl } from "./chef-teile";

export default function ChefRegister({ stufe }: { stufe: string }) {
  const [q, setQ] = useState("");
  const feld = useRef<HTMLInputElement | null>(null);
  const darfGeld = stufe === "inhaber" || stufe === "geschaeftsfuehrung";

  useEffect(() => { feld.current?.focus(); }, []);

  const gruppen = useMemo(() => {
    const t = q.trim().toLowerCase();
    return REGISTER
      .map((g) => ({
        ...g,
        eintraege: g.eintraege.filter((e) => {
          if (e.nurGf && !darfGeld) return false;
          if (!t) return true;
          return (
            e.label.toLowerCase().includes(t) ||
            e.satz.toLowerCase().includes(t) ||
            (e.auch ?? "").toLowerCase().includes(t) ||
            g.titel.toLowerCase().includes(t)
          );
        }),
      }))
      .filter((g) => g.eintraege.length > 0);
  }, [q, darfGeld]);

  const gefunden = gruppen.reduce((s, g) => s + g.eintraege.length, 0);
  const verborgen = REGISTER_ANZAHL - REGISTER.reduce(
    (s, g) => s + g.eintraege.filter((e) => !e.nurGf || darfGeld).length, 0);

  const oeffnen = (e: Registereintrag, ev: React.MouseEvent) => {
    if (!e.gefahr) return;
    ev.preventDefault();
    if (window.confirm(
      `„${e.label}" öffnen?\n\n${e.satz}\n\nHier lassen sich viele Datensätze auf einmal verändern. Öffne das nur, wenn du weißt, was du suchst.`
    )) window.location.href = e.href;
  };

  return (
    <div className="cl cr">
      <header className="cl-kopf">
        <p className="cl-augenbraue">Register</p>
        <h1>Alles, was diese Plattform kann</h1>
        <p className="cl-untertitel">
          {zahl(REGISTER_ANZAHL)} Funktionen, nach Sachgebiet geordnet. Such nach
          dem Wort, das dir einfällt — auch wenn es im Namen nicht vorkommt.
        </p>
      </header>

      <div className="ck-suche cr-suche">
        <Search size={18} strokeWidth={1.6} aria-hidden="true" />
        <input ref={feld} value={q} onChange={(e) => setQ(e.target.value)}
               placeholder="Zum Beispiel: Ausweis, Mahnung, Provision, Kündigung"
               autoComplete="off" spellCheck={false} />
        {q && <button type="button" className="ck-leeren" onClick={() => setQ("")} aria-label="Suche leeren"><X size={15} strokeWidth={2} /></button>}
      </div>

      <p className="ck-lage" role="status">
        {q
          ? (gefunden === 0
              ? "Dazu findet sich nichts. Vielleicht heißt es hier anders — versuch ein anderes Wort."
              : <><b>{zahl(gefunden)}</b> {gefunden === 1 ? "Treffer" : "Treffer"}</>)
          : <>{zahl(REGISTER_ANZAHL - verborgen)} Funktionen für deine Stufe
              {verborgen > 0 && <> · {verborgen} weitere sind der Geschäftsführung vorbehalten</>}</>}
      </p>

      {gruppen.map((g) => (
        <section key={g.titel} className="cr-gruppe">
          <h2>{g.titel}</h2>
          <p className="cr-gruppensatz">{g.satz}</p>
          <div className="cr-eintraege">
            {g.eintraege.map((e) => (
              <a key={e.label} href={e.href} onClick={(ev) => oeffnen(e, ev)}
                 className={`cr-eintrag${e.gefahr ? " gefahr" : ""}`}>
                <span>
                  <b>
                    {e.label}
                    {e.gefahr && <i title="Wirkt auf viele Datensätze"><ShieldAlert size={13} strokeWidth={1.9} /></i>}
                    {e.nurGf && <i title="Nur ab Geschäftsführung"><Lock size={12} strokeWidth={1.9} /></i>}
                  </b>
                  <em>{e.satz}</em>
                </span>
                <ArrowUpRight size={15} strokeWidth={1.7} aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
