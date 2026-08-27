// ═══════════════════════════════════════════════════════════════════════════
// DAS LAGEZIMMER — die Startseite des Chefbüros (26.08.2026)
//
// Justin: „Ein VIP ULTRA HIGH END Dashboard, mit Glas, Animationen, 3D, tiefe
//          Schatten — einfach WOW. Viel Abstand, Luft lassen, nicht die Seite
//          überladen."
//
// ── DIE SPANNUNG ZWISCHEN „WOW" UND „NICHT ÜBERLADEN" ────────────────────
// Beides gleichzeitig geht nur über HIERARCHIE, nicht über Menge. Deshalb:
//
//   1. EINE Zahl ist groß. Der Monatsumsatz, gesetzt wie eine Schlagzeile.
//      Wer den Raum betritt, weiß in einer Sekunde, wie das Unternehmen
//      steht. Alles andere ordnet sich unter.
//   2. Vier Kennzahlen daneben, ruhig.
//   3. Was KLEMMT steht getrennt — und nur, wenn es klemmt. Ein leerer
//      Warnbereich, der jeden Tag dasteht, wird nach einer Woche übersehen.
//   4. Der Rest ist Fläche: viel Abstand, wenige Linien, keine Rahmen um
//      alles.
//
// ── WARUM JEDE ZAHL ANKLICKBAR IST ───────────────────────────────────────
// Eine Kennzahl, die man nur ansehen kann, erzeugt Fragen und beantwortet
// keine. Jede Zahl hier führt an den Ort, an dem man etwas tun kann — mit
// vorgewähltem Filter. Aus „207 überfällig" wird ein Klick auf die Liste
// dieser 207.
//
// ── DIE BEWEGUNG ─────────────────────────────────────────────────────────
// Karten kippen leicht zum Zeiger (3D), die große Zahl zählt beim Betreten
// einmal hoch, der Hintergrundfilm läuft langsam. Alles respektiert
// `prefers-reduced-motion`. Bewegung ist hier Tiefe, nicht Dekoration.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";
import {
  TrendingUp, TrendingDown, Users, Landmark, AlertTriangle, ArrowRight,
  Wallet, CalendarClock, Copy, PhoneOff, FileWarning, Sparkles,
} from "lucide-react";

const API = "/api/fiaon";

// ── Formate ────────────────────────────────────────────────────────────────
const eur = (cents: number) =>
  (cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const eurKurz = (cents: number) => {
  const v = cents / 100;
  if (Math.abs(v) >= 1000) return (v / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + "k €";
  return v.toLocaleString("de-DE", { maximumFractionDigits: 0 }) + " €";
};
const zahl = (n: number) => n.toLocaleString("de-DE");
const monatsName = (m: string) => {
  const [j, mo] = m.split("-").map(Number);
  return new Date(j, mo - 1, 1).toLocaleDateString("de-DE", { month: "short" });
};

interface Lage {
  stand: string;
  geld: {
    eingangHeute: number; eingangMonat: number; eingangVormonat: number;
    ratenOffen: number; ratenUeberfaellig: number; ueberfaelligSumme: number;
    provOffen: number; provOffenSumme: number; abrechnungenOffen: number;
  };
  kunden: { menschenGesamt: number; zahlende: number; imPool: number; neuHeute: number; mandate: number; gesperrt: number };
  team: { teamAktiv: number; kontakteHeute: number; termineHeute: number; termineOhneErgebnis: number };
  klemmt: { zusageGebrochen: number; ohneTermin: number; dublettenVerdacht: number; nummerOhneLand: number };
  verlauf: { monat: string; cents: number; zahlungen: number }[];
  mitarbeiter: { id: number; name: string; rolle: string; satzBp: number; mandate: number; heute: number; provisionMonat: number }[];
  letzteZahlungen: { am: string; cents: number; referenz: string | null; rateNr: number; kunde: string; personId: number | null; paket: string | null; betreuer: string | null }[];
}

/**
 * Eine Zahl, die beim Erscheinen einmal hochzählt.
 * Nicht als Spielerei: Der Blick folgt der Bewegung und bleibt an der Zahl
 * hängen — genau dort, wo er hin soll. Danach ist Ruhe.
 */
function Hochzaehler({ ziel, dauer = 1100, formatieren }: {
  ziel: number; dauer?: number; formatieren: (n: number) => string;
}) {
  const [wert, setWert] = useState(0);
  const gelaufen = useRef(false);
  useEffect(() => {
    if (gelaufen.current) { setWert(ziel); return; }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setWert(ziel); return; }
    gelaufen.current = true;
    const start = performance.now();
    let laeuft = true;
    const tick = (t: number) => {
      if (!laeuft) return;
      const p = Math.min(1, (t - start) / dauer);
      // Weiches Auslaufen — eine Zahl, die abrupt stoppt, wirkt wie ein Fehler.
      setWert(Math.round(ziel * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => { laeuft = false; };
  }, [ziel, dauer]);
  return <>{formatieren(wert)}</>;
}

/** Eine Glaskarte, die sich leicht zum Zeiger neigt. */
function Karte({ children, klasse = "", href, onClick }: {
  children: React.ReactNode; klasse?: string; href?: string; onClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const neigen = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--kx", String(-y * 5));
    el.style.setProperty("--ky", String(x * 5));
    el.style.setProperty("--lx", `${(x + 0.5) * 100}%`);
    el.style.setProperty("--ly", `${(y + 0.5) * 100}%`);
  };
  const zurueck = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--kx", "0");
    el.style.setProperty("--ky", "0");
  };
  const inhalt = (
    <div ref={ref} className={`cl-karte ${klasse}`} onMouseMove={neigen} onMouseLeave={zurueck}>
      <span className="cl-glanz" aria-hidden="true" />
      {children}
    </div>
  );
  if (href) return <a href={href} className="cl-karte-link">{inhalt}</a>;
  if (onClick) return <button type="button" className="cl-karte-link" onClick={onClick}>{inhalt}</button>;
  return inhalt;
}

/** Der Sechs-Monats-Verlauf als ruhige Fläche. */
function Verlauf({ daten }: { daten: Lage["verlauf"] }) {
  const max = Math.max(1, ...daten.map((d) => d.cents));
  const punkte = daten.map((d, i) => ({
    x: daten.length > 1 ? (i / (daten.length - 1)) * 100 : 50,
    y: 100 - (d.cents / max) * 82 - 9,
    ...d,
  }));
  const linie = punkte.map((p) => `${p.x},${p.y}`).join(" ");
  const flaeche = `0,100 ${linie} 100,100`;
  return (
    <div className="cl-verlauf">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img"
           aria-label={`Zahlungseingang der letzten ${daten.length} Monate`}>
        <defs>
          <linearGradient id="clFlaeche" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity=".28" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={flaeche} fill="url(#clFlaeche)" />
        <polyline points={linie} fill="none" stroke="#60a5fa" strokeWidth="0.8"
                  vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        {punkte.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={i === punkte.length - 1 ? 1.6 : 0.9}
                  fill={i === punkte.length - 1 ? "#fff" : "#60a5fa"} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="cl-verlauf-achse">
        {daten.map((d) => (
          <span key={d.monat}>
            <b>{monatsName(d.monat)}</b>
            <em>{eurKurz(d.cents)}</em>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ChefLagezimmer({ name }: { name: string | null }) {
  const [l, setL] = useState<Lage | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    let weg = false;
    fetch(`${API}/chef/lage`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (weg) return; if (j?.ok) setL(j); else setFehler(j?.error || "Die Lage ließ sich nicht laden."); })
      .catch(() => { if (!weg) setFehler("Keine Verbindung zum Server."); });
    return () => { weg = true; };
  }, []);

  const vorname = String(name || "").split(" ")[0];
  const stunde = new Date().getHours();
  const gruss = stunde < 11 ? "Guten Morgen" : stunde < 18 ? "Guten Tag" : "Guten Abend";

  // Der Vergleich zum Vormonat — auf den Tag heruntergerechnet, sonst
  // vergleicht man den halben August mit dem ganzen Juli.
  const trend = useMemo(() => {
    if (!l) return null;
    const tag = new Date().getDate();
    const tageVormonat = new Date(new Date().getFullYear(), new Date().getMonth(), 0).getDate();
    const anteilVormonat = l.geld.eingangVormonat * (tag / tageVormonat);
    if (anteilVormonat < 100) return null;
    const p = ((l.geld.eingangMonat - anteilVormonat) / anteilVormonat) * 100;
    return { prozent: Math.round(p), besser: p >= 0 };
  }, [l]);

  if (fehler) return <div className="cl-fehler" role="alert">{fehler}</div>;
  if (!l) return <div className="cl-laedt"><span /><span /><span /></div>;

  const klemmer = [
    { n: l.klemmt.zusageGebrochen, was: "gebrochene Zahlungszusagen", wo: "/chef/kundenliste?filter=ueberfaellig", Icon: FileWarning },
    { n: l.geld.ratenUeberfaellig, was: "überfällige Raten", wo: "/chef/s/zahlungen-verwalten", Icon: Wallet, extra: eur(l.geld.ueberfaelligSumme) },
    { n: l.klemmt.ohneTermin, was: "bezahlt, ohne Startgespräch", wo: "/chef/s/termine", Icon: CalendarClock },
    { n: l.team.termineOhneErgebnis, was: "Termine ohne Ergebnis", wo: "/chef/s/termine", Icon: PhoneOff },
    { n: l.geld.abrechnungenOffen, was: "Abrechnungen nie versendet", wo: "/chef/s/abrechnungen", Icon: FileWarning },
    { n: l.klemmt.dublettenVerdacht, was: "Verdacht auf Dubletten", wo: "/chef/s/dubletten", Icon: Copy },
    { n: l.klemmt.nummerOhneLand, was: "Nummern ohne Land", wo: "/chef/s/kunden?nummerOhneLand=1", Icon: PhoneOff },
  ].filter((k) => k.n > 0).sort((a, b) => b.n - a.n);

  return (
    <div className="cl">

      {/* ── Der Aufschlag: eine Zahl, groß ─────────────────────────────── */}
      <section className="cl-aufschlag">
        <p className="cl-gruss">{vorname ? `${gruss}, ${vorname}.` : gruss}</p>
        <p className="cl-label">Zahlungseingang im laufenden Monat</p>
        <h1 className="cl-riesenzahl">
          <Hochzaehler ziel={l.geld.eingangMonat} formatieren={eur} />
        </h1>
        <div className="cl-aufschlag-zeile">
          {trend && (
            <span className={`cl-trend${trend.besser ? " gut" : " schlecht"}`}>
              {trend.besser ? <TrendingUp size={15} strokeWidth={2} /> : <TrendingDown size={15} strokeWidth={2} />}
              {trend.besser ? "+" : ""}{trend.prozent} % gegenüber dem Vormonat, auf denselben Tag gerechnet
            </span>
          )}
          {l.geld.eingangHeute > 0 && (
            <span className="cl-heute">Heute bereits <b>{eur(l.geld.eingangHeute)}</b></span>
          )}
        </div>
      </section>

      {/* ── Vier Kennzahlen ────────────────────────────────────────────── */}
      <section className="cl-vier">
        <Karte href="/chef/kundenliste?filter=zahlende" klasse="cl-kennzahl">
          <i><Users size={17} strokeWidth={1.75} /></i>
          <b><Hochzaehler ziel={l.kunden.zahlende} formatieren={zahl} /></b>
          <small>zahlende Kunden</small>
          <em>{zahl(l.kunden.menschenGesamt)} Menschen insgesamt</em>
        </Karte>
        <Karte href="/chef/team" klasse="cl-kennzahl">
          <i><Sparkles size={17} strokeWidth={1.75} /></i>
          <b><Hochzaehler ziel={l.kunden.mandate} formatieren={zahl} /></b>
          <small>Mandate</small>
          <em>{zahl(l.kunden.imPool)} warten im Kundenpool</em>
        </Karte>
        <Karte href="/chef/s/auszahlungen" klasse="cl-kennzahl">
          <i><Landmark size={17} strokeWidth={1.75} /></i>
          <b><Hochzaehler ziel={l.geld.provOffenSumme} formatieren={eur} /></b>
          <small>Provision, noch nicht ausgezahlt</small>
          <em>{zahl(l.geld.provOffen)} Positionen</em>
        </Karte>
        <Karte href="/chef/team" klasse="cl-kennzahl">
          <i><CalendarClock size={17} strokeWidth={1.75} /></i>
          <b><Hochzaehler ziel={l.team.kontakteHeute} formatieren={zahl} /></b>
          <small>dokumentierte Gespräche heute</small>
          <em>{zahl(l.team.termineHeute)} Termine stehen an</em>
        </Karte>
      </section>

      {/* ── Was klemmt — nur wenn es klemmt ────────────────────────────── */}
      {klemmer.length > 0 && (
        <section className="cl-block">
          <div className="cl-block-kopf">
            <h2><AlertTriangle size={17} strokeWidth={1.9} /> Was heute klemmt</h2>
            <small>Jede Zeile führt dorthin, wo man es löst.</small>
          </div>
          <div className="cl-klemmer">
            {klemmer.map((k) => (
              <a key={k.was} href={k.wo} className="cl-klemmzeile">
                <i><k.Icon size={16} strokeWidth={1.75} /></i>
                <b>{zahl(k.n)}</b>
                <span>{k.was}</span>
                {k.extra && <em>{k.extra}</em>}
                <ArrowRight size={15} strokeWidth={1.75} className="pfeil" />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ── Verlauf und Team nebeneinander ─────────────────────────────── */}
      <div className="cl-zwei">
        <section className="cl-block">
          <div className="cl-block-kopf">
            <h2>Sechs Monate</h2>
            <small>Zahlungseingang je Monat</small>
          </div>
          <Verlauf daten={l.verlauf} />
        </section>

        <section className="cl-block">
          <div className="cl-block-kopf">
            <h2>Das Team heute</h2>
            <small>Gespräche, Mandate, Provision im Monat</small>
          </div>
          <div className="cl-team">
            {l.mitarbeiter.map((m) => (
              <a key={m.id} href={`/chef/s/team?agent=${m.id}`} className="cl-teamzeile">
                <span className="cl-avatar" aria-hidden="true">{m.name.split(" ").map((t) => t[0]).slice(0, 2).join("")}</span>
                <span className="cl-teamname">
                  <b>{m.name}</b>
                  <small>{m.mandate} Mandate · {(m.satzBp / 100).toLocaleString("de-DE")} %</small>
                </span>
                <span className="cl-teamzahl" title="dokumentierte Gespräche heute">
                  <b>{m.heute}</b><em>heute</em>
                </span>
                <span className="cl-teamzahl" title="Provision im laufenden Monat">
                  <b>{eurKurz(m.provisionMonat)}</b><em>Monat</em>
                </span>
              </a>
            ))}
          </div>
        </section>
      </div>

      {/* ── Die letzten Zahlungen ──────────────────────────────────────── */}
      <section className="cl-block">
        <div className="cl-block-kopf">
          <h2>Zuletzt eingegangen</h2>
          <small>Die zwölf jüngsten Zahlungen · <a href="/chef/zahlungen">alle ansehen</a></small>
        </div>
        <div className="cl-tab-huelle">
          <table className="cl-tab">
            <thead>
              <tr><th>Eingang</th><th>Kunde</th><th>Paket</th><th>Rate</th><th>Betreuer</th><th className="r">Betrag</th></tr>
            </thead>
            <tbody>
              {l.letzteZahlungen.map((z, i) => (
                <tr key={i}>
                  <td className="cl-zeit">{new Date(z.am).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })}</td>
                  <td>{z.personId ? <a href={`/chef/s/akte?id=${z.personId}`}>{z.kunde}</a> : z.kunde}</td>
                  <td className="cl-leise">{z.paket ?? "—"}</td>
                  <td className="cl-leise">{z.rateNr > 0 ? `${z.rateNr}.` : "—"}</td>
                  <td className="cl-leise">{z.betreuer ?? "—"}</td>
                  <td className="r"><b>{eur(z.cents)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="cl-stand">
        Stand {new Date(l.stand).toLocaleString("de-DE", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Berlin" })} ·
        Alle Zahlen unmittelbar aus der Datenbank gezählt.
      </p>
    </div>
  );
}
