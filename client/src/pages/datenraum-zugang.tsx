// ═══════════════════════════════════════════════════════════════════════════
// /datenraum/zugang (und /datenraum/raum) — DER DATENRAUM FÜR INVESTOREN, SEITE DES GASTES (E-489, 09.11.2026)
//
// Justin: „Wenn er eintritt, muss er alle Infos für die NDA angeben, dann diese direkt unterzeichnen und dann
// soll er direkt Zugriff haben."
//
//   Eintritt   persönlicher Link (#c=<Code>) oder Code eintippen — als Sperrbildschirm im Glas
//   Schritt 1  Angaben für die Vereinbarung (vorbefüllt, änderbar; eine neue E-Mail bestätigt ein Code)
//   Schritt 2  Vereinbarung lesen (auch als Entwurf im PDF) → „gelesen und einverstanden“
//   Schritt 3  zeichnen (Finger/Maus) + vollen Namen tippen → „Jetzt verbindlich unterzeichnen“
//   Raum       Projekte als Ordner, Dokumente ansehen/herunterladen, eigenes Exemplar als PDF
//   Tour       nach der Unterschrift (und bei jedem neuen Besuch) die Raumtour durch die Projekte
//              (components/datenraum/Raumtour.tsx); „Alle Unterlagen“ führt jederzeit in die Ordner
//
// Der Code steht nur kurz in der Adresse (im Anker #c=, der nie an den Server geht): Die Seite liest ihn und nimmt
// ihn sofort heraus (replaceState). Auf dieser Seite läuft keine Messung (EinwilligungsHinweis, OHNE_MESSUNG).
// Alle Inhalte (Raum, Projekte, Dokumente, Vereinbarung) liefert der Server erst nach dem Eintritt — in
// dieser Datei steht kein Name und kein Projekt. Gesiezt, wenig Text, geführt. Server: server/routes/fiaon-datenraum.ts.
//
// Nachbesserung (Gutachten 09.11.2026): Nach Schritt 1 übernimmt die Seite die GESPEICHERTEN Angaben (vorher prüfte
// die Unterschrift gegen den alten Namen und hing fest); die Schrittleiste ist kurz; die Nummern der Unterlagen sind
// ihre eigenen (00, 01 …), nicht die Position.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiaonWortmarke } from "@/components/marke/FiaonWortmarke";
import Raumtour from "@/components/datenraum/Raumtour";
import {
  DR_ANREDEN, DR_FELD_TEXT, DR_GAST_LEER, DR_LAENDER, DR_ZUSTIMMUNG, drAnredeKurz, drFesteLeerzeichen, drFettStuecke, drNamePasst,
  type DrAnrede, type DrGastAngaben, type DrNdaBlock,
} from "@shared/fiaon-datenraum-nda";
import "@/styles/datenraum-gast.css";

const API = "/api/fiaon/datenraum";
type Dok = { kennung: string; nr: number; titel: string; beschreibung: string; groesse: number; seiten: number | null; typ: string; ansehen: boolean };
type Projekt = { buchstabe: string; titel: string; beschreibung: string; abgedeckt: boolean; dokumente: Dok[]; anzahl: number | null };
type GastStand = DrGastAngaben & { angabenAm: string | null; fest?: boolean };
type Stand = {
  ok: boolean; angemeldet: boolean; schritt?: "angaben" | "vereinbarung" | "raum"; nachtrag?: boolean;
  gast?: GastStand; raum?: { titel: string }; projekte?: Projekt[];
  nda?: { unterzeichnetAm: string; fassung: string; hashKurz: string } | null; kontakt?: { name: string; email: string };
};
type Nda = { bloecke: DrNdaBlock[]; hash: string; fassung: string };
type Ansicht = "laedt" | "code" | "angaben" | "vereinbarung" | "unterschrift" | "raum" | "tour";
type Antwort = { status: number; j: any };

async function ruf(pfad: string, koerper?: unknown): Promise<Antwort> {
  try {
    const r = await fetch(`${API}${pfad}`, {
      method: koerper === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store",
      headers: koerper === undefined ? undefined : { "Content-Type": "application/json" },
      body: koerper === undefined ? undefined : JSON.stringify(koerper),
    });
    return { status: r.status, j: await r.json().catch(() => null) };
  } catch {
    return { status: 0, j: { ok: false, error: "Keine Verbindung — bitte prüfen Sie Ihre Internetverbindung." } };
  }
}
const zeitText = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" })} um ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })} Uhr`;
};
const groesse = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const zweistellig = (n: number) => String(n).padStart(2, "0");

/** Hat der Gast in dieser Sitzung des Browsers die Ordner statt der Tour gewählt? */
const ORDNER_MERKER = "drt-ordner";
const ordnerGewaehlt = () => { try { return window.sessionStorage.getItem(ORDNER_MERKER) === "1"; } catch { return false; } };
const ordnerMerken = (an: boolean) => { try { if (an) window.sessionStorage.setItem(ORDNER_MERKER, "1"); else window.sessionStorage.removeItem(ORDNER_MERKER); } catch { /* privat — egal */ } };

/** Den Code aus der Adresse lesen (#c= oder ?c=) und sofort herausnehmen. */
function codeAusAdresse(): string {
  try {
    const u = new URL(window.location.href);
    const aus = new URLSearchParams(u.hash.replace(/^#/, "")).get("c") || u.searchParams.get("c") || "";
    if (aus) { u.searchParams.delete("c"); u.hash = ""; window.history.replaceState(null, "", u.pathname + (u.search || "")); }
    return aus.trim().slice(0, 40);
  } catch { return ""; }
}

// ═══════════════════════════════════════════════════════════════════════════
export default function DatenraumZugang() {
  const [ansicht, setAnsicht] = useState<Ansicht>("laedt");
  const [stand, setStand] = useState<Stand | null>(null);
  const [nda, setNda] = useState<Nda | null>(null);
  const [meldung, setMeldung] = useState<{ art: "gut" | "schlecht" | "info"; text: string } | null>(null);
  const [gelesen, setGelesen] = useState(false);
  const [frisch, setFrisch] = useState(false);
  const oben = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.title = "Datenraum — FIAON";
    let m = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!m) { m = document.createElement("meta"); m.name = "robots"; document.head.appendChild(m); }
    m.content = "noindex,nofollow";
    let r = document.querySelector('meta[name="referrer"]') as HTMLMetaElement | null;
    if (!r) { r = document.createElement("meta"); r.name = "referrer"; document.head.appendChild(r); }
    r.content = "no-referrer";
  }, []);

  const zeigen = useCallback((a: Ansicht) => {
    setAnsicht(a);
    window.setTimeout(() => oben.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  }, []);

  const ndaHolen = useCallback(async (): Promise<boolean> => {
    const r = await ruf("/nda");
    if (r.j?.ok && r.j.nda) { setNda(r.j.nda as Nda); return true; }
    if (r.status === 401) { setStand(null); zeigen("code"); setMeldung({ art: "info", text: r.j?.error || "Bitte melden Sie sich erneut an." }); return false; }
    setMeldung({ art: r.j?.code === "LEER" ? "info" : "schlecht", text: r.j?.error || "Die Vereinbarung ließ sich nicht laden." });
    return false;
  }, [zeigen]);

  /** Den Stand des Servers übernehmen und die passende Ansicht wählen. */
  const uebernehmen = useCallback(async (s: Stand) => {
    if (!s?.angemeldet) { setStand(null); zeigen("code"); return; }
    setStand(s);
    if (s.schritt === "raum") { zeigen(ordnerGewaehlt() ? "raum" : "tour"); return; }
    if (s.schritt === "vereinbarung") { if (await ndaHolen()) { setGelesen(false); zeigen("vereinbarung"); } else zeigen("angaben"); return; }
    zeigen("angaben");
  }, [ndaHolen, zeigen]);

  useEffect(() => {
    let weg = false;
    (async () => {
      const code = codeAusAdresse();
      if (code) {
        const r = await ruf("/eintreten", { code });
        if (weg) return;
        if (r.j?.ok) { await uebernehmen(r.j as Stand); return; }
        setMeldung({ art: "schlecht", text: r.j?.error || "Der Zugang ließ sich nicht prüfen." });
        zeigen("code");
        return;
      }
      const r = await ruf("/stand");
      if (weg) return;
      if (r.j?.ok) await uebernehmen(r.j as Stand);
      else { setMeldung({ art: "schlecht", text: r.j?.error || "Der Datenraum ist gerade nicht erreichbar." }); zeigen("code"); }
    })();
    return () => { weg = true; };
  }, [uebernehmen, zeigen]);

  const abmelden = async () => {
    await ruf("/abmelden", {});
    setStand(null); setNda(null); setMeldung({ art: "info", text: "Sie sind abgemeldet." }); zeigen("code");
  };
  const abgelaufen = () => { setStand(null); zeigen("code"); setMeldung({ art: "info", text: "Bitte melden Sie sich erneut an." }); };

  const schritt = ansicht === "angaben" ? 1 : ansicht === "vereinbarung" ? 2 : ansicht === "unterschrift" ? 3 : 0;
  const ergaenzung = !!stand?.nda && (ansicht === "vereinbarung" || ansicht === "unterschrift");
  const sperre = ansicht === "code" || ansicht === "laedt";

  if (ansicht === "tour" && stand) {
    return (
      <Raumtour stand={stand} frisch={frisch} abmelden={abmelden}
        alleUnterlagen={() => { ordnerMerken(true); setMeldung(null); zeigen("raum"); }}
        nachtrag={async () => { setMeldung(null); if (await ndaHolen()) { setGelesen(false); zeigen("vereinbarung"); } }}
        abgelaufen={() => { setStand(null); zeigen("code"); setMeldung({ art: "info", text: "Bitte melden Sie sich erneut an." }); }} />
    );
  }

  return (
    <div className={`drg${sperre ? " drg-sperre" : ""}`} data-fiaon="datenraum-gast" ref={oben}>
      <header className="drg-kopf">
        <div className="drg-kopf-innen">
          <span className="drg-kopf-marke"><FiaonWortmarke hoehe="21px" farbe="#fff" /><span>Datenraum</span></span>
          <span className="drg-kopf-rechts"><Schloss />Vertraulich</span>
        </div>
      </header>
      <main className="drg-blatt">
        {schritt > 0 && !ergaenzung && (
          <div className="drg-schritte-rahmen">
            <p className="drg-schritt-zahl">Schritt {schritt} von 3</p>
            <ol className="drg-schritte" aria-label="Fortschritt">
              {["Angaben", "Lesen", "Unterzeichnen"].map((t, i) => (
                <li key={t} className={i + 1 < schritt ? "fertig" : i + 1 === schritt ? "aktiv" : ""} aria-current={i + 1 === schritt ? "step" : undefined}>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {meldung && <p className={`drg-meldung ${meldung.art === "info" ? "" : meldung.art}`} role={meldung.art === "schlecht" ? "alert" : "status"}>{meldung.text}</p>}

        {ansicht === "laedt" && <div className="drg-laedt" role="status">Ihr Zugang wird geprüft …</div>}
        {ansicht === "code" && <CodeEingabe weiter={async (s) => { setMeldung(null); await uebernehmen(s); }} fehler={(t) => setMeldung({ art: "schlecht", text: t })} />}
        {ansicht === "angaben" && stand?.gast && (
          <Angaben gast={stand.gast} raumTitel={stand.raum?.titel ?? ""} projekte={stand.projekte ?? []}
            fertig={(n, gast) => {
              // Die gespeicherten Angaben übernehmen — Vertrag, Zusammenfassung und Namensprüfung lesen alle dieselbe Quelle.
              setStand((s) => (s ? { ...s, gast: gast ?? s.gast, schritt: "vereinbarung" } : s));
              setMeldung(null); setNda(n); setGelesen(false); zeigen("vereinbarung");
            }}
            gespeichert={(gast) => setStand((s) => (s ? { ...s, gast: gast ?? s.gast } : s))}
            abgelaufen={abgelaufen} />
        )}
        {ansicht === "vereinbarung" && nda && (
          <section>
            <p className="drg-auge">{ergaenzung ? "Ergänzte Vereinbarung" : "Vertraulichkeit"}</p>
            <h1>{ergaenzung ? "Ihre Vereinbarung wird ergänzt." : "Bitte lesen Sie die Vereinbarung."}</h1>
            <p className="drg-lead">{ergaenzung
              ? "Ein Thema ist hinzugekommen oder genauer beschrieben. Die Vereinbarung nennt jetzt alle Themen des Datenraums — mit Ihrer Unterschrift öffnen sich die Unterlagen dazu."
              : "Ihre Angaben stehen als Partei 3 darin, die Themen des Datenraums in § 1. Danach unterzeichnen Sie im nächsten Schritt."}</p>
            <p className="drg-fein"><a href={`${API}/nda-entwurf.pdf`} target="_blank" rel="noopener" data-fiaon="dr-entwurf">Als PDF ansehen</a> — zum Gegenlesen, zum Beispiel durch Ihren Anwalt (Entwurf, nicht unterzeichnet).</p>
            <Vereinbarung bloecke={nda.bloecke} />
            <label className={`drg-haken${gelesen ? " an" : ""}`}>
              <input type="checkbox" checked={gelesen} onChange={(e) => setGelesen(e.target.checked)} data-fiaon="nda-gelesen" />
              <span>{DR_ZUSTIMMUNG}</span>
            </label>
            <div className="drg-knoepfe">
              <button type="button" className="drg-knopf breit" disabled={!gelesen} onClick={() => { setMeldung(null); zeigen("unterschrift"); }}>Weiter zur Unterschrift</button>
              {!ergaenzung && !stand?.gast?.fest && <button type="button" className="drg-link" onClick={() => zeigen("angaben")}>Angaben ändern</button>}
            </div>
          </section>
        )}
        {ansicht === "unterschrift" && nda && stand?.gast && (
          <Unterschrift nda={nda} gelesen={gelesen}
            zurueck={() => zeigen("vereinbarung")}
            fertig={(s) => { setMeldung({ art: "gut", text: "Vereinbarung unterzeichnet — Ihr Datenraum ist freigeschaltet. Eine Kopie kommt per E-Mail." }); setStand(s); setFrisch(true); ordnerMerken(false); zeigen("tour"); }}
            geaendert={async (t) => { setMeldung({ art: "info", text: t }); if (await ndaHolen()) { setGelesen(false); zeigen("vereinbarung"); } }}
            abgelaufen={abgelaufen} />
        )}
        {ansicht === "raum" && stand && (
          <Raum stand={stand} abmelden={abmelden} tour={() => { ordnerMerken(false); setMeldung(null); zeigen("tour"); }}
            nachtrag={async () => { setMeldung(null); if (await ndaHolen()) { setGelesen(false); zeigen("vereinbarung"); } }} />
        )}
      </main>
      <footer className="drg-fuss">
        <span>FIAON LTD · 128 City Road, London EC1V 2NX</span>
        <span><a href="/impressum">Impressum</a> · <a href="/datenschutz#datenraum">Datenschutz</a></span>
      </footer>
    </div>
  );
}

// ── Eintritt ───────────────────────────────────────────────────────────────
function CodeEingabe({ weiter, fehler }: { weiter: (s: Stand) => Promise<void>; fehler: (t: string) => void }) {
  const [code, setCode] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const senden = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || laeuft) return;
    setLaeuft(true);
    const r = await ruf("/eintreten", { code });
    setLaeuft(false);
    if (r.j?.ok) await weiter(r.j as Stand); else fehler(r.j?.error || "Der Code ließ sich nicht prüfen.");
  };
  return (
    <section className="drg-eintritt">
      <span className="drg-eintritt-schloss" aria-hidden="true"><Schloss /></span>
      <p className="drg-auge">Persönliche Einladung</p>
      <h1>Willkommen im Datenraum.</h1>
      <p className="drg-lead">Bitte geben Sie Ihren Einladungscode ein. Sie finden ihn in Ihrer Einladung.</p>
      <form className="drg-form" onSubmit={senden}>
        <label className="drg-feld drg-code">
          <span>Einladungscode</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="DR-XXXX-XXXX-XXXX" autoComplete="one-time-code"
            autoCapitalize="characters" autoCorrect="off" spellCheck={false} inputMode="text" maxLength={40} data-fiaon="dr-code" />
        </label>
        <div className="drg-knoepfe"><button type="submit" className="drg-knopf breit" disabled={laeuft || code.trim().length < 6}>{laeuft ? "Wird geprüft …" : "Eintreten"}</button></div>
        <p className="drg-fein">Noch keine Einladung? <a href="/datenraum#anfrage">Zugang anfragen</a></p>
      </form>
    </section>
  );
}

// ── Schritt 1: Angaben ─────────────────────────────────────────────────────
function Angaben({ gast, raumTitel, projekte, fertig, gespeichert, abgelaufen }: {
  gast: GastStand; raumTitel: string; projekte: Projekt[]; fertig: (n: Nda, gast: GastStand | null) => void; gespeichert: (gast: GastStand | null) => void; abgelaufen: () => void;
}) {
  const [w, setW] = useState<DrGastAngaben>(() => ({ ...DR_GAST_LEER, ...gast }));
  const [fehler, setFehler] = useState<Partial<Record<keyof DrGastAngaben, string>>>({});
  const [satz, setSatz] = useState<{ text: string; art: "schlecht" | "info" } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  // Eine andere E-Mail als die der Einladung: Der Server schickt einen Code an genau diese Adresse.
  const [codeFeld, setCodeFeld] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const setze = (k: keyof DrGastAngaben, v: string) => {
    setW((x) => ({ ...x, [k]: v }));
    if (fehler[k]) setFehler((f) => ({ ...f, [k]: undefined }));
    if (k === "email") { setCodeFeld(false); setEmailCode(""); }
  };
  const senden = async (e: React.FormEvent) => {
    e.preventDefault();
    if (laeuft) return;
    setLaeuft(true); setSatz(null);
    const r = await ruf("/angaben", { angaben: w, ...(codeFeld && emailCode.trim() ? { emailCode: emailCode.trim() } : {}) });
    setLaeuft(false);
    if (r.status === 401) return abgelaufen();
    if (r.j?.ok && r.j.nda) return fertig(r.j.nda as Nda, (r.j.gast as GastStand) ?? null);
    if (r.j?.ok) { gespeichert((r.j.gast as GastStand) ?? null); setSatz({ art: "info", text: r.j.hinweis || "Ihre Angaben sind gespeichert. Die Vereinbarung ist gerade nicht verfügbar — bitte versuchen Sie es etwas später noch einmal." }); return; }
    if (r.j?.code === "EMAIL_CODE" || r.j?.code === "EMAIL_CODE_FALSCH") {
      setCodeFeld(true);
      setSatz({ art: r.j.code === "EMAIL_CODE" ? "info" : "schlecht", text: r.j.error });
      window.setTimeout(() => (document.querySelector('[data-fiaon="dr-email-code"]') as HTMLInputElement | null)?.focus(), 30);
      return;
    }
    setFehler((r.j?.fehler ?? {}) as Partial<Record<keyof DrGastAngaben, string>>);
    setSatz({ art: "schlecht", text: r.j?.error || "Bitte prüfen Sie Ihre Angaben." });
    window.setTimeout(() => (document.querySelector(".drg-feld.fehlt input") as HTMLInputElement | null)?.focus(), 30);
  };
  const feld = (k: keyof DrGastAngaben, klasse: string, opt: { typ?: string; auto?: string; pflicht?: boolean; liste?: string; modus?: React.HTMLAttributes<HTMLInputElement>["inputMode"] } = {}) => (
    <label className={`drg-feld ${klasse}${fehler[k] ? " fehlt" : ""}`}>
      <span>{DR_FELD_TEXT[k]}{opt.pflicht === false ? <em> · optional</em> : null}</span>
      <input type={opt.typ ?? "text"} value={w[k]} onChange={(e) => setze(k, e.target.value)} autoComplete={opt.auto} list={opt.liste} inputMode={opt.modus}
        aria-invalid={!!fehler[k]} required={opt.pflicht !== false} data-fiaon={`dr-${k}`} />
      {fehler[k] && <small>{fehler[k]}</small>}
    </label>
  );
  return (
    <section>
      <p className="drg-auge">{raumTitel || "Datenraum"}</p>
      <h1>Ihre Angaben für die Vereinbarung.</h1>
      <p className="drg-lead">So stehen Sie in der Vertraulichkeitsvereinbarung. Wir haben vorbereitet, was wir wissen — bitte prüfen und ergänzen.</p>
      {projekte.length > 0 && <p className="drg-fein">Themen: {projekte.map((p) => `${p.buchstabe} · ${p.titel}`).join(", ")}</p>}
      <form className="drg-form" onSubmit={senden} noValidate>
        <div className="drg-feld">
          <span>{DR_FELD_TEXT.anrede}</span>
          <div className="drg-wahl" role="group" aria-label="Anrede">
            {DR_ANREDEN.map((a) => <button key={a.text} type="button" aria-pressed={w.anrede === a.wert} onClick={() => setze("anrede", a.wert as DrAnrede)}>{a.text}</button>)}
          </div>
        </div>
        <div className="drg-raster">
          {feld("vorname", "drg-s3", { auto: "given-name" })}
          {feld("nachname", "drg-s3", { auto: "family-name" })}
          {feld("firma", "drg-s4", { auto: "organization", pflicht: false })}
          {feld("funktion", "drg-s2", { auto: "organization-title", pflicht: false })}
          {feld("strasse", "drg-s6", { auto: "street-address" })}
          {feld("plz", "drg-s2", { auto: "postal-code" })}
          {feld("ort", "drg-s2", { auto: "address-level2" })}
          {feld("land", "drg-s2", { auto: "country-name", liste: "drg-laender" })}
          {feld("email", "drg-s3", { typ: "email", auto: "email", modus: "email" })}
          {feld("telefon", "drg-s3", { typ: "tel", auto: "tel", modus: "tel", pflicht: false })}
          {codeFeld && (
            <label className={`drg-feld drg-s6${satz?.art === "schlecht" ? " fehlt" : ""}`}>
              <span>Bestätigungscode aus der E-Mail an {w.email}</span>
              <input value={emailCode} onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code"
                placeholder="6 Ziffern" maxLength={6} data-fiaon="dr-email-code" />
              <span className="drg-fein" style={{ margin: 0 }}>Kein Code angekommen? Feld leer lassen und erneut auf „Weiter“ — dann kommt ein neuer.</span>
            </label>
          )}
          <label className={`drg-feld drg-s6${fehler.weitergabe ? " fehlt" : ""}`}>
            <span>{DR_FELD_TEXT.weitergabe}<em> · optional</em></span>
            <input value={w.weitergabe} onChange={(e) => setze("weitergabe", e.target.value)} maxLength={600} data-fiaon="dr-weitergabe" placeholder="leer lassen, wenn niemand" />
            {fehler.weitergabe && <small>{fehler.weitergabe}</small>}
            <span className="drg-fein" style={{ margin: 0 }}>Nur ausfüllen, wenn Informationen zu den Themen schon an andere gingen als an Ihre Mitarbeitenden oder Berater. Die Namen stehen dann in Anlage 1 (§ 8).</span>
          </label>
        </div>
        <datalist id="drg-laender">{DR_LAENDER.map((l) => <option key={l} value={l} />)}</datalist>
        {satz && <p className={`drg-meldung ${satz.art === "schlecht" ? "schlecht" : ""}`} role={satz.art === "schlecht" ? "alert" : "status"}>{satz.text}</p>}
        <div className="drg-knoepfe"><button type="submit" className="drg-knopf breit" disabled={laeuft || (codeFeld && emailCode.length > 0 && emailCode.length < 6)} data-fiaon="dr-angaben-weiter">{laeuft ? "Wird gespeichert …" : "Weiter zur Vereinbarung"}</button></div>
        <p className="drg-fein">Ihre Angaben nutzen wir nur für diese Vereinbarung und den Datenraum — <a href="/datenschutz#datenraum" target="_blank" rel="noopener">Datenschutz</a>.</p>
      </form>
    </section>
  );
}

// ── Die Vereinbarung ───────────────────────────────────────────────────────
function Fett({ text }: { text: string }) {
  return <>{drFettStuecke(drFesteLeerzeichen(text)).map((s, i) => (s.fett ? <b key={i}>{s.text}</b> : <span key={i}>{s.text}</span>))}</>;
}
function Vereinbarung({ bloecke }: { bloecke: DrNdaBlock[] }) {
  // Aufeinanderfolgende Parteien und Themen stehen je in EINEM Rahmen.
  const gruppen = useMemo(() => {
    const out: (DrNdaBlock | { art: "parteien"; liste: Extract<DrNdaBlock, { art: "partei" }>[] } | { art: "themen"; liste: Extract<DrNdaBlock, { art: "thema" }>[] })[] = [];
    for (const b of bloecke) {
      const letzte = out[out.length - 1] as any;
      if (b.art === "partei") { if (letzte?.art === "parteien") letzte.liste.push(b); else out.push({ art: "parteien", liste: [b] }); }
      else if (b.art === "thema") { if (letzte?.art === "themen") letzte.liste.push(b); else out.push({ art: "themen", liste: [b] }); }
      else out.push(b);
    }
    return out;
  }, [bloecke]);
  return (
    <article className="drg-vertrag" lang="de" data-fiaon="nda-text">
      {gruppen.map((b, i) => {
        switch (b.art) {
          case "auge": return <p key={i} className="drg-v-auge">{b.text}</p>;
          case "titel": return <h2 key={i} className="drg-v-titel">{b.text}</h2>;
          case "unter": return <p key={i} className="drg-v-unter">{b.text}</p>;
          case "zwischen": return <p key={i} className="drg-v-zwischen">{b.text}</p>;
          case "parteien": return (
            <div key={i} className="drg-parteien">
              {b.liste.map((p) => <div key={p.nr} className="drg-partei"><div className="nr">{p.nr}</div><p className="name">{p.name}</p><p className="text">{p.text}</p></div>)}
            </div>
          );
          case "text": return <p key={i}><Fett text={b.text} /></p>;
          case "paragraf": return <h3 key={i}><span className="nr">{b.nr}</span>{b.titel}</h3>;
          case "abs": return <p key={i} className="drg-abs"><span className="z">{b.z}</span><Fett text={b.text} /></p>;
          case "punkt": return <p key={i} className="drg-punkt"><span className="z">{b.z}</span><Fett text={b.text} /></p>;
          case "themen": return (
            <div key={i} className="drg-themen">
              {b.liste.map((t) => <div key={t.bu} className="drg-thema"><span className="bu">{t.bu}</span><span><b>{t.titel}</b> – {t.text}</span></div>)}
            </div>
          );
          case "anlage": return (
            <div key={i} className="drg-anlage">
              <h3><span className="nr">{b.nr}</span>{b.titel}</h3>
              {b.zeilen.map((z, j) => <p key={j}>{z}</p>)}
            </div>
          );
          default: return null;
        }
      })}
    </article>
  );
}

// ── Schritt 3: Unterschrift ────────────────────────────────────────────────
function Unterschrift({ nda, gelesen, zurueck, fertig, geaendert, abgelaufen }: {
  nda: Nda; gelesen: boolean; zurueck: () => void; fertig: (s: Stand) => void; geaendert: (t: string) => void; abgelaufen: () => void;
}) {
  const [png, setPng] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [satz, setSatz] = useState<string | null>(null);
  // Partei 3 genau so, wie sie in DIESER Vereinbarung steht (dieselbe Quelle wie der Text darüber).
  const partei3 = nda.bloecke.find((b): b is Extract<DrNdaBlock, { art: "partei" }> => b.art === "partei" && b.nr === "Partei 3");
  const p3Name = (partei3?.name ?? "").replace(/^(Herr|Frau)\s+/, "");
  const teile = p3Name.trim().split(/\s+/);
  const p3 = { vorname: teile.slice(0, -1).join(" ") || teile[0] || "", nachname: teile.length > 1 ? teile[teile.length - 1] : "" };
  const soll = p3Name.trim();
  const namePasst = !!soll && drNamePasst(name, p3);
  const themen = nda.bloecke.filter((b): b is Extract<DrNdaBlock, { art: "thema" }> => b.art === "thema");
  const unterzeichnen = async () => {
    if (!png || !namePasst || laeuft) return;
    setLaeuft(true); setSatz(null);
    const r = await ruf("/unterzeichnen", { textHash: nda.hash, gelesen, name, png });
    setLaeuft(false);
    if (r.status === 401) return abgelaufen();
    if (r.j?.ok) return fertig(r.j as Stand);
    if (r.j?.code === "GEAENDERT") return geaendert(r.j.error);
    setSatz(r.j?.error || "Die Unterschrift ließ sich nicht speichern. Bitte versuchen Sie es noch einmal.");
  };
  return (
    <section>
      <p className="drg-auge">Unterzeichnen</p>
      <h1>Ihre Unterschrift.</h1>
      <p className="drg-lead">Zeichnen Sie im Feld und tragen Sie Ihren vollen Namen ein. Danach ist Ihr Datenraum sofort geöffnet.</p>
      <dl className="drg-zusammen">
        <div><dt>Partei 3</dt><dd>{partei3?.name ?? ""}</dd></div>
        <div><dt>Themen</dt><dd>{themen.map((t) => `${t.bu} · ${t.titel}`).join(", ")}</dd></div>
        <div><dt>Fassung</dt><dd>{nda.fassung}</dd></div>
      </dl>
      <div className="drg-form">
        <div className="drg-feld">
          <span>Unterschrift (mit dem Finger oder der Maus)</span>
          <Zeichenfeld melden={setPng} gesperrt={laeuft} />
        </div>
        <label className={`drg-feld${name && !namePasst ? " fehlt" : ""}`}>
          <span>Ihr voller Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder={soll} maxLength={160} disabled={laeuft} data-fiaon="dr-name" />
          {name && !namePasst && <small>Bitte genau so eintragen, wie Sie in der Vereinbarung stehen: {soll}.</small>}
        </label>
        <p className="drg-hinweis">Sie unterzeichnen mit einer einfachen elektronischen Unterschrift. Gespeichert werden Ihre Zeichnung, Ihr Name, Zeitpunkt, IP-Adresse und Browser sowie der Wortlaut mit seiner Prüfsumme. Die FIAON-Seite nimmt die Vereinbarung mit der Freischaltung des Datenraums an.</p>
        {satz && <p className="drg-meldung schlecht" role="alert">{satz}</p>}
        <div className="drg-knoepfe">
          <button type="button" className="drg-knopf breit" disabled={!png || !namePasst || !gelesen || laeuft} onClick={() => void unterzeichnen()} data-fiaon="dr-unterzeichnen">
            {laeuft ? "Wird unterzeichnet …" : "Jetzt verbindlich unterzeichnen"}
          </button>
          <button type="button" className="drg-link" onClick={zurueck} disabled={laeuft}>Zurück zur Vereinbarung</button>
        </div>
        {(!png || !namePasst) && <p className="drg-fein">{!png ? "Es fehlt noch Ihre Zeichnung." : "Es fehlt noch Ihr voller Name."}</p>}
      </div>
    </section>
  );
}

const TINTE = "#12284a";
/** Höchstens so groß schickt die Seite die Zeichnung (der Server nimmt bis 2400 × 1000 Punkte und 300 KB an). */
const BILD_MAX = { breite: 2000, hoehe: 800 } as const;
/** Zeichenfeld: Finger, Stift, Maus (Pointer-Ereignisse), scharf auf jedem Bildschirm; meldet ein zugeschnittenes PNG. */
function Zeichenfeld({ melden, gesperrt }: { melden: (png: string | null) => void; gesperrt: boolean }) {
  const feld = useRef<HTMLDivElement | null>(null);
  const cv = useRef<HTMLCanvasElement | null>(null);
  const striche = useRef<[number, number, number][][]>([]);
  const strich = useRef<[number, number, number][] | null>(null);
  const masse = useRef({ w: 1, h: 1, dpr: 1 });
  const dick = useRef(2.4);
  const zuletzt = useRef(0);
  const [tinte, setTinte] = useState(false);

  const neuZeichnen = useCallback(() => {
    const c = cv.current?.getContext("2d"); if (!c) return;
    const { w, h } = masse.current;
    c.clearRect(0, 0, w, h);
    c.strokeStyle = TINTE; c.lineCap = "round"; c.lineJoin = "round";
    for (const s of striche.current) for (let j = 1; j < s.length; j++) { c.lineWidth = s[j][2]; c.beginPath(); c.moveTo(s[j - 1][0] * w, s[j - 1][1] * h); c.lineTo(s[j][0] * w, s[j][1] * h); c.stroke(); }
  }, []);
  const groesse = useCallback(() => {
    const q = feld.current?.getBoundingClientRect(); const c = cv.current;
    if (!q || !c || q.width < 10) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (Math.round(q.width) === Math.round(masse.current.w) && Math.round(q.height) === Math.round(masse.current.h) && dpr === masse.current.dpr) return;
    masse.current = { w: q.width, h: q.height, dpr };
    c.width = Math.round(q.width * dpr); c.height = Math.round(q.height * dpr);
    c.getContext("2d")!.setTransform(dpr, 0, 0, dpr, 0, 0);
    neuZeichnen();
  }, [neuZeichnen]);
  useEffect(() => {
    groesse();
    if (typeof ResizeObserver === "undefined" || !feld.current) return;
    const ro = new ResizeObserver(() => groesse()); ro.observe(feld.current);
    return () => ro.disconnect();
  }, [groesse]);

  /** Zugeschnitten auf die Tinte (mit Rand) und höchstens BILD_MAX groß, damit die Unterschrift im PDF groß und klar steht. */
  const bild = (): string | null => {
    const { w, h, dpr } = masse.current;
    let laenge = 0; let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    for (const s of striche.current) for (let j = 0; j < s.length; j++) {
      const x = s[j][0] * w; const y = s[j][1] * h;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      if (j > 0) laenge += Math.hypot(x - s[j - 1][0] * w, y - s[j - 1][1] * h);
    }
    if (laenge < 60 || !cv.current) return null;
    const rand = 12;
    const bx = Math.max(0, x0 - rand); const by = Math.max(0, y0 - rand);
    const bw = Math.min(w, x1 + rand) - bx; const bh = Math.min(h, y1 + rand) - by;
    const breite = Math.max(160, bw); const hoehe = Math.max(60, bh);
    const f = Math.min(1, BILD_MAX.breite / (breite * dpr), BILD_MAX.hoehe / (hoehe * dpr));
    try {
      const z = document.createElement("canvas"); z.width = Math.round(breite * dpr * f); z.height = Math.round(hoehe * dpr * f);
      z.getContext("2d")!.drawImage(cv.current, Math.round(bx * dpr), Math.round(by * dpr), Math.round(bw * dpr), Math.round(bh * dpr), 0, 0, Math.round(bw * dpr * f), Math.round(bh * dpr * f));
      return z.toDataURL("image/png");
    } catch { return null; }
  };
  const pos = (e: React.PointerEvent) => { const q = cv.current!.getBoundingClientRect(); return [e.clientX - q.left, e.clientY - q.top]; };
  const runter = (e: React.PointerEvent) => {
    if (gesperrt) return;
    e.preventDefault(); groesse();
    const [x, y] = pos(e);
    strich.current = [[x / masse.current.w, y / masse.current.h, dick.current]];
    striche.current.push(strich.current);
    zuletzt.current = performance.now();
    try { cv.current?.setPointerCapture(e.pointerId); } catch { /* egal */ }
    setTinte(true);
  };
  const ziehen = (e: React.PointerEvent) => {
    if (!strich.current) return;
    const [x, y] = pos(e); const n = performance.now();
    const l = strich.current[strich.current.length - 1];
    const lx = l[0] * masse.current.w; const ly = l[1] * masse.current.h;
    const d = Math.hypot(x - lx, y - ly);
    if (d < 0.6) return;
    const v = d / Math.max(1, n - zuletzt.current);
    dick.current = dick.current * 0.7 + Math.max(1.3, 3.2 - v * 1.5) * 0.3;
    const c = cv.current!.getContext("2d")!;
    c.strokeStyle = TINTE; c.lineCap = "round"; c.lineWidth = dick.current;
    c.beginPath(); c.moveTo(lx, ly); c.lineTo(x, y); c.stroke();
    strich.current.push([x / masse.current.w, y / masse.current.h, dick.current]);
    zuletzt.current = n;
  };
  const hoch = () => { if (!strich.current) return; strich.current = null; melden(bild()); };
  const leeren = () => { striche.current = []; neuZeichnen(); setTinte(false); melden(null); };
  return (
    <>
      <div className="drg-pad" ref={feld}>
        <canvas ref={cv} onPointerDown={runter} onPointerMove={ziehen} onPointerUp={hoch} onPointerCancel={hoch} onPointerLeave={hoch}
          role="img" aria-label="Unterschriftsfeld" data-fiaon="dr-zeichenfeld" />
        <span className="linie" aria-hidden="true" />
        <span className="x" aria-hidden="true">×</span>
        {!tinte && <span className="platz" aria-hidden="true">Hier unterschreiben</span>}
      </div>
      <div className="drg-pad-fuss">
        <span className="drg-fein" style={{ margin: 0 }}>{tinte ? " " : "Mit dem Finger oder der Maus."}</span>
        <button type="button" className="drg-link" onClick={leeren} disabled={gesperrt || !tinte}>Neu zeichnen</button>
      </div>
    </>
  );
}

// ── Der Raum ───────────────────────────────────────────────────────────────
function Raum({ stand, abmelden, nachtrag, tour }: { stand: Stand; abmelden: () => void; nachtrag: () => void; tour: () => void }) {
  const [zu, setZu] = useState<Record<string, boolean>>({});
  const g = stand.gast;
  const projekte = stand.projekte ?? [];
  const offen = projekte.filter((p) => p.abgedeckt);
  return (
    <section data-fiaon="dr-raum">
      <p className="drg-auge">{stand.raum?.titel || "Datenraum"}</p>
      <h1>{g ? `Willkommen, ${drAnredeKurz(g)}.` : "Willkommen."}</h1>
      <div className="drg-status">
        <span className="gruen"><Haken />Vereinbarung unterzeichnet{stand.nda ? ` am ${zeitText(stand.nda.unterzeichnetAm)}` : ""}</span>
        <a href={`${API}/nda.pdf`} target="_blank" rel="noopener">Ihr Exemplar (PDF)</a>
      </div>
      <p className="drg-fein">Alle Unterlagen sind vertraulich; jede PDF-Seite trägt Ihren Namen und eine Vorgangsnummer. Jeder Abruf wird protokolliert.</p>
      {offen.length > 0 && (
        <div className="drt-einstieg" data-fiaon="dr-tour-starten">
          <p>Geführter Rundgang<small>Raum für Raum durch die Projekte — mit Kennzahlen und Unterlagen.</small></p>
          <button type="button" className="drg-knopf klein" onClick={tour}>Rundgang starten</button>
        </div>
      )}
      {stand.nachtrag && (
        <div className="drg-nachtrag">
          <p>Zu einem weiteren oder genauer beschriebenen Thema liegen Unterlagen bereit. Dafür ergänzen wir Ihre Vereinbarung.</p>
          <button type="button" className="drg-knopf klein" onClick={nachtrag}>Ergänzte Vereinbarung ansehen</button>
        </div>
      )}
      {offen.length === 0 && <p className="drg-meldung">Die Unterlagen werden gerade eingestellt. Bitte schauen Sie etwas später wieder vorbei.</p>}
      {offen.map((p) => {
        const auf = !zu[p.buchstabe];
        // Die eigenen Nummern der Unterlagen (00, 01 …) — die Projektübersicht verweist darauf. Nur ohne Nummern zählt die Position.
        const mitNummer = p.dokumente.some((d) => d.nr > 0);
        return (
          <section key={p.buchstabe} className="drg-ordner" data-fiaon="dr-ordner">
            <button type="button" className="drg-ordner-kopf" aria-expanded={auf} onClick={() => setZu((z) => ({ ...z, [p.buchstabe]: auf }))}>
              <span className="bu" aria-hidden="true">{p.buchstabe}</span>
              <span><b>{p.titel}</b>{p.beschreibung ? <small>{p.beschreibung}</small> : null}</span>
              <span className="zahl">{p.dokumente.length} {p.dokumente.length === 1 ? "Unterlage" : "Unterlagen"}<Pfeil /></span>
            </button>
            {auf && (p.dokumente.length === 0 ? <p className="drg-leer">Zu diesem Thema folgen die Unterlagen in Kürze.</p> : (
              <ol>
                {p.dokumente.map((d, i) => (
                  <li key={d.kennung} className="drg-dok">
                    <span className="nr">{zweistellig(mitNummer ? d.nr : i + 1)}</span>
                    <div>
                      <b>{d.titel}</b>
                      {d.beschreibung && <p>{d.beschreibung}</p>}
                      <div className="meta">{[d.typ, d.seiten ? `${d.seiten} ${d.seiten === 1 ? "Seite" : "Seiten"}` : "", groesse(d.groesse)].filter(Boolean).join(" · ")}</div>
                    </div>
                    <div className="wege">
                      {d.ansehen && <a className="drg-knopf klein still" href={`${API}/dokument/${encodeURIComponent(d.kennung)}`} target="_blank" rel="noopener">Ansehen</a>}
                      <a className="drg-knopf klein still" href={`${API}/dokument/${encodeURIComponent(d.kennung)}?laden=1`} download>Herunterladen</a>
                    </div>
                  </li>
                ))}
              </ol>
            ))}
          </section>
        );
      })}
      <h2>Fragen?</h2>
      <p>{stand.kontakt?.name} beantwortet sie persönlich: <a href={`mailto:${stand.kontakt?.email ?? ""}`}>{stand.kontakt?.email}</a></p>
      <div className="drg-knoepfe" style={{ marginTop: 18 }}><button type="button" className="drg-link" onClick={abmelden}>Abmelden</button></div>
    </section>
  );
}

// ── Zeichen (selbst gezeichnet, 1,5 px, currentColor) ──────────────────────
function Schloss() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" /></svg>; }
function Haken() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12.4l2.7 2.6L16.2 9.5" /></svg>; }
function Pfeil() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>; }
