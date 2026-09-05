// ═══════════════════════════════════════════════════════════════════════════
// /app — der neue Kundenbereich (Gerüst, Scheibe 1, 05.09.2026).
//
// Was hier steht, kommt aus EINEM Endpunkt: GET /api/fiaon/kunde/:ref/bereich.
// Die Seite rechnet keine Wahrheit selbst — Stufe, Etappen und der nächste
// Schritt kommen vom Server (fiaon-kunde-bereich.ts). Sie zeichnet nur.
//
// Aufbau (Handy zuerst):
//   Kopf (helles Glas) → Band (Aufforderung, keine Wand) → Zielkarte (das
//   EINE Navy-Glas: „Ihr Weg zu … €", x von y Schritten) → Jetzt dran →
//   Ihre Rate → Ansprechpartner → Bottom-Bar mit fünf Reitern.
//
// Drei Gesetze: (1) jeder Monat hat einen Betrag, den der Kunde nachrechnen
// kann, (2) wir erledigen statt zu raten, (3) der Kunde sieht die Arbeit.
// Karte, Konto und Rahmen sind ZIEL, nie Zusage — die Bank entscheidet.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import "@/styles/app.css";

// ── Typen: dieselbe Antwort wie mein-bereich.tsx, nur was das Gerüst braucht
interface Etappe { key: string; titel: string; text: string; stand: "fertig" | "jetzt" | "kommt"; datum: string | null; stempel: string | null; href?: string | null }
interface Rate { nr: number; betragCents: number; faelligAm: string | null; faelligIso: string | null; status: string; bezahltAm: string | null }
interface Bereich {
  kunde: { ref: string; vorname: string; nachname: string; email: string; kundeSeit: string | null };
  paket: { key: string | null; name: string; abo: boolean; rahmen: number | null; wunschlimit: number | null; monatlichCents: number | null; zahlungsstatus: string; zahlungsreferenz: string | null; faelligAm: string | null };
  stufe: { stufe: string | null; text: string | null; naechsterSchritt: string | null; vollAktiv: boolean; bezahlt: boolean };
  abo: { naechste: { nr: number; betragCents: number; faelligAm: string | null; status: string; referenz: string } | null; offen: number; bezahlt: number; raten: Rate[] };
  termin: { beginn: string; status: string; agent: string | null } | null;
  fahrplan: Etappe[];
  naechsterSchritt: { key: string; titel: string; text: string; href: string | null } | null;
  ansprechpartner: { name: string; rolle: string | null } | null;
  lastschrift: { mandat: string | null; status: string | null; aktiv: boolean };
  kontoVerbunden: boolean;
}

const eur = (cents: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
const zeit = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return iso;
  // timeZone mit Absicht: Ein Kunde in Lissabon oder Istanbul sieht sonst eine
  // andere Uhrzeit als sein Ansprechpartner (Zeit-Falle Berlin, E-136-Nachtrag).
  return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);
};
const eurGanz = (euro: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(euro);
const api = async (pfad: string) => {
  const r = await fetch(`/api/fiaon${pfad}`, { credentials: "include" });
  if (r.status === 401) throw new Error("401");
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
};

// Demo-Ansicht: /app/demo/* zeichnet das Demo-Konto FIAON-DEMO (fiaon-demo.ts,
// feste Daten ohne Datenbank, ohne Login). Für Vorführung, Investoren und
// zum Bauen — nie ein echter Datensatz.
const DEMO_REF = "FIAON-DEMO";
const basisVon = (ort: string) => (ort === "/app/demo" || ort.startsWith("/app/demo/") ? "/app/demo" : "/app");

// ── Reiter der Bottom-Bar ──────────────────────────────────────────────────
type Reiter = "start" | "weg" | "ansprueche" | "post" | "mehr";
const REITER: { key: Reiter; pfad: string; name: string; icon: JSX.Element }[] = [
  { key: "start", pfad: "", name: "Start", icon: <svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /></svg> },
  { key: "weg", pfad: "/weg", name: "Ihr Weg", icon: <svg viewBox="0 0 24 24"><path d="M5 20V4" /><path d="M5 5h11l-2 3 2 3H5" /></svg> },
  { key: "ansprueche", pfad: "/ansprueche", name: "Ansprüche", icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><path d="M9.5 10.2c0-1.2 1.1-2 2.5-2s2.5.8 2.5 2c0 1.9-5 1.3-5 3.6 0 1.2 1.1 2 2.5 2s2.5-.8 2.5-2M12 6.5v1.7M12 15.8v1.7" /></svg> },
  { key: "post", pfad: "/post", name: "Post", icon: <svg viewBox="0 0 24 24"><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="m3.5 7 8.5 6 8.5-6" /></svg> },
  { key: "mehr", pfad: "/mehr", name: "Mehr", icon: <svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="18" cy="12" r="1.4" /></svg> },
];
const reiterAus = (pfad: string, basis: string): Reiter => {
  const t = pfad.slice(basis.length).replace(/^\//, "").split("/")[0];
  return (REITER.find((r) => r.key === t)?.key ?? "start") as Reiter;
};

export default function AppBereich() {
  const [ort, navigiere] = useLocation();
  const [b, setB] = useState<Bereich | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const basis = basisVon(ort);
  const demo = basis === "/app/demo";
  const reiter = reiterAus(ort, basis);

  // Die Seite scrollt im Fenster (siehe app.css). Beim Verlassen zurückdrehen.
  useEffect(() => {
    document.documentElement.classList.add("ap-scroll");
    return () => document.documentElement.classList.remove("ap-scroll");
  }, []);

  useEffect(() => {
    document.title = "Mein FIAON";
    (async () => {
      try {
        if (demo) { setB(await api(`/kunde/${DEMO_REF}/bereich`)); return; }
        const me = await api("/kunde/me");
        if (!me?.eingeloggt || !me.ref) { navigiere("/app/login"); return; }
        setB(await api(`/kunde/${encodeURIComponent(me.ref)}/bereich`));
      } catch (e: any) {
        if (e?.message === "401") { navigiere("/app/login"); return; }
        setFehler("Ihr Bereich konnte gerade nicht geladen werden.");
      }
    })();
  }, []);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [reiter]);

  return (
    <div className="ap-root">
      <Kopf b={b} basis={basis} demo={demo} />
      <main className="ap-inhalt">
        {fehler && <div className="ap-karte ap-leer"><b>{fehler}</b>Bitte laden Sie die Seite in einem Moment neu.</div>}
        {!b && !fehler && <Skelett />}
        {b && reiter === "start" && <Start b={b} />}
        {b && reiter === "weg" && <Weg b={b} />}
        {b && (reiter === "ansprueche" || reiter === "post" || reiter === "mehr") && <Baustelle reiter={reiter} />}
      </main>
      <BottomBar aktiv={reiter} basis={basis} />
    </div>
  );
}

// ── Kopf ───────────────────────────────────────────────────────────────────
function Kopf({ b, basis, demo }: { b: Bereich | null; basis: string; demo: boolean }) {
  const initialen = b ? `${b.kunde.vorname?.[0] ?? ""}${b.kunde.nachname?.[0] ?? ""}`.toUpperCase() : "";
  return (
    <header className="ap-kopf">
      <div className="ap-kopf-innen">
        <a className="ap-marke" href={basis} aria-label="Mein FIAON">
          <span className="ap-marke-zeichen">F</span>
          <span className="ap-marke-wort">FIAON</span>
        </a>
        <div className="ap-kopf-rechts">
          {demo ? <span className="ap-status" title="Feste Vorführdaten, kein echtes Konto">Demo-Ansicht</span> : b?.kunde.ref && <span className="ap-mono" title="Ihre Kundennummer">{b.kunde.ref}</span>}
          <a className="ap-avatar" href={`${basis}/mehr`} aria-label="Profil">{initialen || "·"}</a>
        </div>
      </div>
    </header>
  );
}

// ── Start ──────────────────────────────────────────────────────────────────
function Start({ b }: { b: Bereich }) {
  const std = new Date().getHours();
  const gruss = std < 11 ? "Guten Morgen" : std < 18 ? "Guten Tag" : "Guten Abend";
  const jetzt = b.fahrplan.find((e) => e.stand === "jetzt") ?? null;
  const naechste = b.abo?.naechste ?? null;
  const puenktlich = b.abo?.raten?.filter((r) => r.status === "bezahlt" || r.status === "paid").length ?? 0;
  const ratenGesamt = b.abo?.raten?.length ?? 0;

  return (
    <>
      <h1 className="ap-gruss ap-auf">{gruss}, {b.kunde.vorname}.<small>{b.stufe.text ?? "Hier ist Ihr Stand."}</small></h1>

      {!b.stufe.vollAktiv && b.naechsterSchritt && (
        <a className="ap-band ap-auf v1" href={b.naechsterSchritt.href ?? "#"}>
          <div><b>{b.naechsterSchritt.titel}</b><span>{b.naechsterSchritt.text}</span></div>
          <span aria-hidden="true" style={{ color: "var(--fi-primaer)", fontWeight: 700 }}>→</span>
        </a>
      )}

      <div className="ap-auf v1"><Zielkarte b={b} /></div>

      {jetzt && (
        <section className="ap-abschnitt ap-auf v2">
          <h2 className="ap-abschnitt-titel">Jetzt dran</h2>
          <div className="ap-karte">
            <div className="ap-karte-kopf"><h3>{jetzt.titel}</h3>{jetzt.stempel && <span className="ap-stempel">{jetzt.stempel}</span>}</div>
            <p>{jetzt.text}</p>
            {(jetzt.href || b.naechsterSchritt?.href) && <a className="ap-knopf" style={{ marginTop: 14 }} href={jetzt.href || b.naechsterSchritt?.href || "#"}>Jetzt erledigen</a>}
          </div>
        </section>
      )}

      {b.paket.abo && (naechste || ratenGesamt > 0) && (
        <section className="ap-abschnitt ap-auf v3">
          <h2 className="ap-abschnitt-titel">Ihre Rate</h2>
          <div className="ap-karte">
            {naechste ? (
              <>
                <div className="ap-zahl">{eur(naechste.betragCents)}<small>{naechste.faelligAm ? `fällig ${naechste.faelligAm}` : ""}</small></div>
                <div className="ap-zeile" style={{ marginTop: 8 }}><span>Rate {naechste.nr} von {ratenGesamt || 12}</span><b className={`ap-status ${b.lastschrift.aktiv ? "gut" : ""}`}>{b.lastschrift.aktiv ? "Lastschrift eingerichtet" : "Überweisung"}</b></div>
              </>
            ) : (
              <div className="ap-zahl">{puenktlich} von {ratenGesamt}<small>Raten bezahlt</small></div>
            )}
            <div className="ap-zeile" style={{ marginTop: 6 }}><span>Bisher bezahlt</span><b>{puenktlich} von {ratenGesamt}</b></div>
            {naechste?.referenz && <div className="ap-zeile" style={{ marginTop: 6 }}><span>Verwendungszweck</span><b className="ap-mono">{naechste.referenz}</b></div>}
            <p style={{ fontSize: 13 }}>Jede pünktliche Rate ist zugleich Ihr Zahlungsnachweis für den Weg zur Karte.</p>
          </div>
        </section>
      )}

      {b.ansprechpartner && (
        <section className="ap-abschnitt ap-auf v4">
          <h2 className="ap-abschnitt-titel">Ihr Ansprechpartner</h2>
          <div className="ap-karte" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span className="ap-avatar" style={{ width: 44, height: 44, fontSize: 16 }}>{b.ansprechpartner.name.split(" ").map((t) => t[0]).join("").slice(0, 2).toUpperCase()}</span>
            <div style={{ flex: 1 }}><b style={{ display: "block" }}>{b.ansprechpartner.name}</b><span style={{ fontSize: 14, color: "var(--fi-text-leise)" }}>{b.ansprechpartner.rolle ?? "FIAON"}</span></div>
            {b.termin?.beginn && <span className="ap-stempel">Termin<br />{zeit(b.termin.beginn)}</span>}
          </div>
        </section>
      )}
    </>
  );
}

// ── Zielkarte: das eine Navy-Glas ──────────────────────────────────────────
function Zielkarte({ b }: { b: Bereich }) {
  const ziel = b.paket.wunschlimit ?? b.paket.rahmen ?? null;
  const gesamt = b.fahrplan.length;
  const fertig = b.fahrplan.filter((e) => e.stand === "fertig").length;
  const jetzt = b.fahrplan.find((e) => e.stand === "jetzt");
  return (
    <section className="ap-ziel" aria-label="Ihr Weg zur Karte">
      <div className="ap-ziel-ueber">{ziel ? "Ihr Weg zu Ihrem Wunschrahmen" : "Ihr Weg zur Karte"}</div>
      {ziel ? <div className="ap-ziel-zahl">{eurGanz(ziel)}<small>€</small></div> : <div className="ap-ziel-zahl" style={{ fontSize: 30 }}>Kreditkarte</div>}
      <div className="ap-ziel-unter">Paket <b>{b.paket.name}</b>{b.kunde.kundeSeit ? <> · dabei seit <b>{b.kunde.kundeSeit}</b></> : null}</div>
      <div className="ap-stufen" role="img" aria-label={`${fertig} von ${gesamt} Schritten erledigt`}>
        {b.fahrplan.map((e) => <span key={e.key} className={`ap-stufe ${e.stand}`} />)}
      </div>
      <div className="ap-ziel-stand">
        <b>{fertig} von {gesamt} Schritten</b>
        {jetzt && <span>Jetzt: {jetzt.titel}</span>}
      </div>
      <div className="ap-ziel-hinweis">Jeder Schritt hier ist Ihre Vorbereitung. Über Karte und Rahmen entscheidet am Ende die Bank.</div>
    </section>
  );
}

// ── Ihr Weg: alle Etappen, alle Raten ──────────────────────────────────────
function Weg({ b }: { b: Bereich }) {
  return (
    <>
      <h1 className="ap-gruss ap-auf">Ihr Weg<small>Jede Etappe mit Stand und Datum. Nichts davon ist eine Zusage.</small></h1>
      <div className="ap-auf v1"><Zielkarte b={b} /></div>
      <section className="ap-abschnitt ap-auf v2">
        <h2 className="ap-abschnitt-titel">Die Etappen</h2>
        <div className="ap-karte">
          <ol className="ap-etappen">
            {b.fahrplan.map((e, i) => (
              <li key={e.key} className={`ap-etappe ${e.stand}`}>
                <span className={`ap-punkt ${e.stand}`}>{e.stand === "fertig" ? "✓" : e.stand === "kommt" ? <span style={{ color: "var(--fi-text-still)", fontSize: 12 }}>{i + 1}</span> : null}</span>
                <div><b>{e.titel}</b><small>{e.text}</small></div>
                <span className="ap-stempel">{e.stempel ?? e.datum ?? ""}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
      {b.abo?.raten?.length > 0 && (
        <section className="ap-abschnitt ap-auf v3">
          <h2 className="ap-abschnitt-titel">Ihre Raten</h2>
          <div className="ap-karte">
            <ol className="ap-etappen">
              {b.abo.raten.map((r) => {
                const bezahlt = r.status === "bezahlt" || r.status === "paid";
                return (
                  <li key={r.nr} className={`ap-etappe ${bezahlt ? "fertig" : "kommt"}`}>
                    <span className={`ap-punkt ${bezahlt ? "fertig" : ""}`}>{bezahlt ? "✓" : <span style={{ color: "var(--fi-text-still)", fontSize: 12 }}>{r.nr}</span>}</span>
                    <div><b>{eur(r.betragCents)}</b><small>{bezahlt ? `bezahlt${r.bezahltAm ? ` am ${r.bezahltAm}` : ""}` : r.faelligAm ? `fällig am ${r.faelligAm}` : "offen"}</small></div>
                    <span className="ap-stempel">Rate {r.nr}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      )}
    </>
  );
}

// ── Baustelle: ehrlicher Platzhalter für die nächsten Scheiben ─────────────
function Baustelle({ reiter }: { reiter: Reiter }) {
  const name = REITER.find((r) => r.key === reiter)?.name ?? "";
  return (
    <div className="ap-karte ap-leer ap-auf">
      <b>{name}</b>
      Dieser Bereich entsteht gerade. Sie sehen ihn hier, sobald er fertig ist.
    </div>
  );
}

function Skelett() {
  return (
    <>
      <div className="ap-skelett" style={{ height: 28, width: "60%" }} />
      <div className="ap-skelett" style={{ height: 210, borderRadius: 22 }} />
      <div className="ap-skelett" style={{ height: 120, borderRadius: 18 }} />
      <div className="ap-skelett" style={{ height: 120, borderRadius: 18 }} />
    </>
  );
}

function BottomBar({ aktiv, basis }: { aktiv: Reiter; basis: string }) {
  return (
    <nav className="ap-bar" aria-label="Bereiche">
      <div className="ap-bar-innen">
        {REITER.map((r) => (
          <a key={r.key} href={`${basis}${r.pfad}`} className={`ap-reiter ${aktiv === r.key ? "aktiv" : ""}`} aria-current={aktiv === r.key ? "page" : undefined}>
            {r.icon}<span>{r.name}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}
