// ═══════════════════════════════════════════════════════════════════════════
// DAS REGISTER — jede Funktion, alle im Chefbüro (27.08.2026 neu gefasst)
//
// Justin: „Es verlinken noch SEHR viele Seiten auf /admin/kunden. JEDE Seite
//          soll dort laufen, nicht aufs alte Admin Dashboard verlinken!"
//
// Das Register führte bis heute nach `/admin/...` — und weil sechs dieser
// Adressen nur Sprünge auf `/admin/kunden` mit einem Fragezeichen dahinter
// sind, landete man ständig auf derselben Seite. Genau das ist Justin
// aufgefallen.
//
// Jetzt kommt jeder Eintrag aus `chef-seiten.tsx`, also aus derselben Quelle
// wie die Kacheln der Räume: gleicher Name, gleiches Ziel, gleicher Filter.
// Ein Verweis ins Leere kann so gar nicht mehr entstehen.
//
// ── DIE SUCHE IST DER EIGENTLICHE WERT ────────────────────────────────────
// Gesucht wird nicht nur im Namen, sondern auch in der Erklärung und in
// hinterlegten Nebenworten — wer „Ausweis" tippt, findet die KYC-Prüfung,
// obwohl das Wort im Namen nicht vorkommt.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Search, X, ArrowUpRight, Lock } from "lucide-react";
import { CHEF_SEITEN, chefPfad, type ChefSeite } from "./chef-seiten";
import { CHEF_RAEUME, type ChefStufe } from "./ChefShell";
import { zahl } from "./chef-teile";

const RANG: Record<string, number> = { inhaber: 3, geschaeftsfuehrung: 2, leitung: 1 };

/** Was das Chefbüro selbst mitbringt — keine übernommene Seite, eigener Raum. */
const EIGENE: (ChefSeite & { eigen: true })[] = [
  { slug: "", label: "Lagezimmer", satz: "Alle Zahlen des Unternehmens auf einen Blick.", raum: "lage", auch: "umsatz zahlen dashboard start", Seite: null as any, eigen: true },
  { slug: "werkzeuge", label: "Werkstatt", satz: "Frag die Zahlen, Wahrheits-Check, Maschinenraum, Sprung, Freigaben, Posteingang.", raum: "werkzeuge", auch: "wahrheit mailbox cron lauf freigabe tickets anfragen", Seite: null as any, eigen: true },
  { slug: "kundenliste", label: "Alle Kunden", satz: "Der gesamte Bestand — eine Person, eine Zeile.", raum: "kundenliste", auch: "liste bestand personen suchen", Seite: null as any, eigen: true },
  { slug: "besucher", label: "Besucher", satz: "Wut-Klicks, tote Klicks, Scrolltiefe — wo Besucher nicht weiterkommen.", raum: "besucher", auch: "clarity besucher traffic seiten scroll", Seite: null as any, eigen: true },
  { slug: "zahlungen", label: "Zahlungszentrale", satz: "Jeder Eingang mit allen Angaben, gegengeprüft.", raum: "zahlungen", mindest: "geschaeftsfuehrung", auch: "umsatz eingang provision", Seite: null as any, eigen: true },
];

export default function ChefRegister({ stufe }: { stufe: string }) {
  const [q, setQ] = useState("");
  const feld = useRef<HTMLInputElement | null>(null);
  useEffect(() => { feld.current?.focus(); }, []);

  const meine = RANG[stufe] ?? 1;

  // Alles, was diese Stufe öffnen darf — eigene Räume zuerst, dann die
  // übernommenen Seiten in der Reihenfolge der Räume.
  const alles = useMemo(() => {
    const eigen = EIGENE.map((e) => ({ ...e, pfad: e.slug ? `/chef/${e.slug}` : "/chef" }));
    const uebernommen = CHEF_SEITEN
      .filter((s) => s.raum)                       // die Einzelakte ist kein Registereintrag
      .map((s) => ({ ...s, pfad: chefPfad(s), eigen: false as const }));
    return [...eigen, ...uebernommen].filter((s) => !s.mindest || meine >= RANG[s.mindest]);
  }, [meine]);

  const verborgen = useMemo(() => {
    const eigen = EIGENE.length + CHEF_SEITEN.filter((s) => s.raum).length;
    return eigen - alles.length;
  }, [alles.length]);

  const gruppen = useMemo(() => {
    const t = q.trim().toLowerCase();
    const passt = (s: (typeof alles)[number]) => !t
      || s.label.toLowerCase().includes(t)
      || s.satz.toLowerCase().includes(t)
      || (s.auch ?? "").toLowerCase().includes(t)
      || (CHEF_RAEUME.find((r) => r.key === s.raum)?.label ?? "").toLowerCase().includes(t);

    // Die Reihenfolge der Räume bestimmt die Reihenfolge der Abschnitte —
    // wer die Leiste kennt, findet sich im Register sofort zurecht.
    return CHEF_RAEUME
      .map((r) => ({
        raum: r,
        eintraege: alles.filter((s) => s.raum === r.key && passt(s)),
      }))
      .filter((g) => g.eintraege.length > 0);
  }, [q, alles]);

  const gefunden = gruppen.reduce((s, g) => s + g.eintraege.length, 0);

  return (
    <div className="cl cr">
      <header className="cl-kopf">
        <p className="cl-augenbraue">Register</p>
        <h1>Alles, was diese Plattform kann</h1>
        <p className="cl-untertitel">
          {zahl(alles.length)} Funktionen, nach Räumen geordnet — und jede läuft
          hier im Chefbüro. Such nach dem Wort, das dir einfällt, auch wenn es
          im Namen nicht vorkommt.
        </p>
      </header>

      <div className="ck-suche cr-suche">
        <Search size={18} strokeWidth={1.6} aria-hidden="true" />
        <input ref={feld} value={q} onChange={(e) => setQ(e.target.value)}
               placeholder="Zum Beispiel: Ausweis, Mahnung, Provision, Kündigung, Mailbox"
               autoComplete="off" spellCheck={false} />
        {q && <button type="button" className="ck-leeren" onClick={() => setQ("")} aria-label="Suche leeren"><X size={15} strokeWidth={2} /></button>}
      </div>

      <p className="ck-lage" role="status">
        {q
          ? (gefunden === 0
              ? "Dazu findet sich nichts. Vielleicht heißt es hier anders — versuch ein anderes Wort."
              : <><b>{zahl(gefunden)}</b> {gefunden === 1 ? "Treffer" : "Treffer"}</>)
          : <>{zahl(alles.length)} Funktionen für deine Stufe
              {verborgen > 0 && <> · {verborgen} weitere sind der Geschäftsführung vorbehalten</>}</>}
      </p>

      {gruppen.map((g) => (
        <section key={g.raum.key} className="cr-gruppe">
          <h2>{g.raum.label}</h2>
          <p className="cr-gruppensatz">{g.raum.satz}</p>
          <div className="cr-eintraege">
            {g.eintraege.map((e) => (
              <Link key={e.pfad + e.label} href={e.pfad} className={`cr-eintrag${e.eigen ? " eigen" : ""}`}>
                <span>
                  <b>
                    {e.label}
                    {e.mindest && <i title={`Nur ab Stufe ${e.mindest}`}><Lock size={12} strokeWidth={1.9} /></i>}
                  </b>
                  <em>{e.satz}</em>
                </span>
                <ArrowUpRight size={15} strokeWidth={1.7} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
