// ═══════════════════════════════════════════════════════════════════════════
// VERDIENST & WERT — der Raum, der Justins Frage beantwortet (27.08.2026)
//
// „Schau dir an was wir verdient haben, was wir monatlich verdienen (JEDES
// PAKET IST EIN 12-MONATS-ABO, also Umsatz = ×12, bitte gut und richtig
// darstellen). Und baue auch sowas wie eine Unternehmensbewertung ein."
//
// ── DIE DARSTELLUNGS-REGEL ────────────────────────────────────────────────
// Drei Geldbegriffe, die NIE vermischt werden — jede Karte sagt, welchen sie
// zeigt:
//   VERDIENT     bankbestätigt eingegangen und gebucht (Vergangenheit)
//   MONATLICH    MRR: vertraglich vereinbarte Monatsraten der aktiven Abos
//   VERTRAGSWERT ×12: was die laufenden Verträge über ihre Laufzeit wert
//                sind — getrennt in „schon vereinnahmt" und „steht noch aus"
// Die Bewertung ist eine SPANNE über ARR-Vielfache, mit offener Methodik.
//
// Gestaltung nach Justins Maßgabe („lege WIRKLICH an Design zu"): dunkle
// Bühne aus dem Chefbüro, EINE Navy-Glas-Bühne (der Wert-Hero), viel Luft,
// Zähler, die beim ersten Blick hochlaufen (und bei reduced-motion stehen).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import "@/styles/chef-zahlen.css";

interface Zahlen {
  stand: string;
  verdient: { ratenCents: number; ratenAnzahl: number; auskunftCents: number; auskunftAnzahl: number; gesamtCents: number };
  abo: { aktive: number; mrrCents: number; arrCents: number; vertrag12Cents: number; vereinnahmtCents: number; ausstehendCents: number; letzte30TageCents: number };
  jePaket: { paket: string; anzahl: number; mrrCents: number }[];
  monate: { monat: string; ratenCents: number; auskunftCents: number }[];
  bewertung: { arrCents: number; szenarien: { name: string; faktor: number; satz: string; wertCents: number }[] };
}

const eur = (cents: number, nachkomma = 0) =>
  (cents / 100).toLocaleString("de-DE", { minimumFractionDigits: nachkomma, maximumFractionDigits: nachkomma }) + " €";

const MONAT_NAME: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mär", "04": "Apr", "05": "Mai", "06": "Jun",
  "07": "Jul", "08": "Aug", "09": "Sep", "10": "Okt", "11": "Nov", "12": "Dez",
};

/** Zahl, die beim Erscheinen hochläuft — steht sofort still, wenn Bewegung unerwünscht ist. */
function Zaehler({ cents, dauerMs = 1400 }: { cents: number; dauerMs?: number }) {
  const ruhig = typeof window !== "undefined"
    && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [wert, setWert] = useState(ruhig ? cents : 0);
  const lief = useRef(false);
  useEffect(() => {
    if (ruhig || lief.current) { setWert(cents); return; }
    lief.current = true;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const x = Math.min(1, (t - start) / dauerMs);
      // Sanft auslaufen — eine Zahl, die abrupt stoppt, wirkt wie ein Fehler.
      const eased = 1 - Math.pow(1 - x, 3);
      setWert(Math.round(cents * eased));
      if (x < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cents]);
  return <>{eur(wert)}</>;
}

export default function ChefZahlen() {
  const [d, setD] = useState<Zahlen | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/fiaon/chef/zahlen", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => (j.ok ? setD(j) : setFehler(j.error || "Die Zahlen konnten nicht geladen werden.")))
      .catch(() => setFehler("Keine Verbindung."));
  }, []);

  if (fehler) return <div className="cz-fehler">{fehler}</div>;
  if (!d) return <div className="cz-laedt">Zahlen werden gerechnet …</div>;

  const spanneVon = d.bewertung.szenarien[0]?.wertCents ?? 0;
  const spanneBis = d.bewertung.szenarien[d.bewertung.szenarien.length - 1]?.wertCents ?? 0;
  const mitte = d.bewertung.szenarien[1]?.wertCents ?? Math.round((spanneVon + spanneBis) / 2);
  const maxMonat = Math.max(1, ...d.monate.map((m) => m.ratenCents + m.auskunftCents));
  const maxPaketMrr = Math.max(1, ...d.jePaket.map((p) => p.mrrCents));
  const anteilVereinnahmt = d.abo.vertrag12Cents > 0
    ? d.abo.vereinnahmtCents / d.abo.vertrag12Cents : 0;
  const heuteMonat = new Date().toISOString().slice(0, 7);

  return (
    <div className="cz">
      {/* ── DER WERT-HERO — die eine Navy-Glas-Bühne ───────────────────── */}
      <section className="cz-hero">
        <span className="cz-hero-schein" aria-hidden="true" />
        <p className="cz-augenbraue">Unternehmenswert · interner Richtwert</p>
        <h1 className="cz-wert">
          <Zaehler cents={mitte} />
        </h1>
        <p className="cz-spanne">
          Spanne {eur(spanneVon)} – {eur(spanneBis)} · gerechnet auf {eur(d.bewertung.arrCents)} Jahresumsatz (ARR)
        </p>
        <div className="cz-hero-zeile">
          <div><b><Zaehler cents={d.abo.mrrCents} /></b><span>vertraglich je Monat (MRR)</span></div>
          <div><b>{d.abo.aktive}</b><span>aktive 12-Monats-Abos</span></div>
          <div><b><Zaehler cents={d.verdient.gesamtCents} /></b><span>bankbestätigt verdient</span></div>
        </div>
      </section>

      {/* ── VERDIENT — Vergangenheit, hartes Geld ──────────────────────── */}
      <section className="cz-block">
        <header><h2>Verdient</h2><p>Nur bankbestätigt gebuchtes Geld. Keine Ankündigungen, keine Testkonten.</p></header>
        <div className="cz-karten drei">
          <article className="cz-karte">
            <small>Gesamt eingegangen</small>
            <b>{eur(d.verdient.gesamtCents)}</b>
            <span>{d.verdient.ratenAnzahl} Raten + {d.verdient.auskunftAnzahl} Bonitätsauskünfte</span>
          </article>
          <article className="cz-karte">
            <small>Davon Abo-Raten</small>
            <b>{eur(d.verdient.ratenCents)}</b>
            <span>Start- und Monatsraten der Pakete</span>
          </article>
          <article className="cz-karte">
            <small>Davon Bonitätsauskünfte</small>
            <b>{eur(d.verdient.auskunftCents)}</b>
            <span>Einmalerlöse — bewusst getrennt vom Abo</span>
          </article>
        </div>

        <div className="cz-monate" role="img" aria-label="Einnahmen je Monat">
          {d.monate.map((m) => {
            const summe = m.ratenCents + m.auskunftCents;
            const [jahr, mm] = m.monat.split("-");
            return (
              <div key={m.monat} className={`cz-monat${m.monat === heuteMonat ? " laufend" : ""}`}
                   title={`${MONAT_NAME[mm]} ${jahr}: ${eur(m.ratenCents)} Raten + ${eur(m.auskunftCents)} Auskünfte`}>
                <i style={{ height: `${Math.max(3, Math.round((summe / maxMonat) * 100))}%` }}>
                  <em style={{ height: `${summe > 0 ? Math.round((m.auskunftCents / summe) * 100) : 0}%` }} />
                </i>
                <b>{eur(summe)}</b>
                <span>{MONAT_NAME[mm]}{m.monat === heuteMonat ? " · läuft" : ""}</span>
              </div>
            );
          })}
        </div>
        <p className="cz-fuss">Heller Abschnitt im Balken = Bonitätsauskünfte. Der laufende Monat ist noch nicht zu Ende — er wird noch größer.</p>
      </section>

      {/* ── DER ABO-MOTOR — Justins ×12, richtig erzählt ───────────────── */}
      <section className="cz-block">
        <header>
          <h2>Der Abo-Motor</h2>
          <p>Jedes Paket ist ein 12-Monats-Abo: Eine Kundin für {eur(5999)} ist kein {eur(5999)}-Geschäft, sondern ein {eur(71988)}-Vertrag.</p>
        </header>
        <div className="cz-vertrag">
          <div className="cz-vertrag-zahlen">
            <div><small>Vertragsbestand (×12)</small><b><Zaehler cents={d.abo.vertrag12Cents} /></b><span>{d.abo.aktive} Abos × 12 Monatsraten</span></div>
            <div><small>Davon schon vereinnahmt</small><b>{eur(d.abo.vereinnahmtCents)}</b><span>{Math.round(anteilVereinnahmt * 100)} % der Vertragssumme ist bezahlt</span></div>
            <div><small>Steht vertraglich noch aus</small><b>{eur(d.abo.ausstehendCents)}</b><span>kommt über die Laufzeit herein — wenn die Raten gehalten werden</span></div>
          </div>
          <div className="cz-leiste" role="img"
               aria-label={`${Math.round(anteilVereinnahmt * 100)} Prozent der Vertragssumme vereinnahmt`}>
            {Array.from({ length: 12 }, (_, i) => {
              const bis = (i + 1) / 12;
              const voll = anteilVereinnahmt >= bis;
              const teil = !voll && anteilVereinnahmt > i / 12;
              return <i key={i} className={voll ? "voll" : teil ? "teil" : ""} />;
            })}
          </div>
          <p className="cz-fuss">
            Die zwölf Segmente sind die zwölf Monatsraten eines Abo-Jahres über den ganzen Bestand.
            Real eingegangen in den letzten 30 Tagen: <b>{eur(d.abo.letzte30TageCents)}</b> — die ehrliche
            Gegenzahl zum vertraglichen MRR von {eur(d.abo.mrrCents)}. Die Lücke sind junge Ketten und offene Raten.
          </p>
        </div>

        <div className="cz-pakete">
          {d.jePaket.map((p) => (
            <div key={p.paket} className="cz-paket" title={`${p.anzahl} Abos · ${eur(p.mrrCents)} je Monat · ${eur(p.mrrCents * 12)} im Jahr`}>
              <span className="name">{p.paket}</span>
              <i><em style={{ width: `${Math.max(2, Math.round((p.mrrCents / maxPaketMrr) * 100))}%` }} /></i>
              <span className="zahl">{p.anzahl} Abos · {eur(p.mrrCents)}/Monat</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── DIE BEWERTUNG ──────────────────────────────────────────────── */}
      <section className="cz-block">
        <header>
          <h2>Unternehmensbewertung</h2>
          <p>Drei Blickwinkel auf denselben Jahresumsatz von {eur(d.bewertung.arrCents)} (MRR × 12).</p>
        </header>
        <div className="cz-karten drei">
          {d.bewertung.szenarien.map((s, i) => (
            <article key={s.name} className={`cz-karte szenario${i === 1 ? " mitte" : ""}`}>
              <small>{s.name} · {s.faktor}× ARR</small>
              <b>{eur(s.wertCents)}</b>
              <span>{s.satz}</span>
            </article>
          ))}
        </div>
        <p className="cz-fuss">
          Methodik: Vielfache auf den wiederkehrenden Jahresumsatz (ARR), wie bei Abo-Geschäften üblich.
          Was den Wert nach oben treibt: belegtes Wachstum, niedrige Kündigungsquote, saubere Zahlen
          (genau dafür ist diese Seite da). Interner Richtwert — keine Anlageberatung, kein Gutachten.
        </p>
      </section>

      <p className="cz-stand">
        Stand {new Date(d.stand).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} Uhr ·
        Quelle: bezahlte Raten und Bestellungen im System (bankbestätigt), Testkonten ausgeschlossen.
        Das alte Dashboard rechnete mit Stripe-Kartenzahlungen — dort lief zuletzt fast nichts mehr, deshalb stimmten die Zahlen nicht.
      </p>
    </div>
  );
}
