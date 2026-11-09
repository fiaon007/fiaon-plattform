// ═══════════════════════════════════════════════════════════════════════════
// DIE RAUMTOUR DES DATENRAUMS (E-489, 09.11.2026)
//
// Justin: „stelle alles PERFEKT dar … FOKUS auf das [Hauptprojekt] — aber natürlich auch die anderen — aber
// perfekt, cinematisch — einfach HIGH END — er soll durch die Räume geführt werden wie bei einer 3D-Tour."
//
// Nach der Unterschrift (und bei jedem neuen Besuch) führt die Tour den Gast durch die Projekte:
//   Auftakt     „Willkommen im Datenraum.“ — Navy-Glas, eine Flucht aus Portalen (ein Portal je Raum)
//   Raum 1…n    das Hauptprojekt zuerst und am größten: Augenzeile, großer Satz, Kennzahlen (zählen hoch),
//               Kurve (zeichnet sich), Kapitel mit den passenden Unterlagen, alle Unterlagen des Raums,
//               „Vertragsentwurf anfordern“; die anderen Räume ruhiger, mit „Frage stellen“
//   Schritt     „Ihr nächster Schritt“ — Vertragsentwurf (Hauptprojekt vorgewählt), Frage, Rückblick
// Bewegung: Jeder Raum ist eine Bühne mit Tiefe (CSS perspective/translateZ) — beim Weitergehen tritt man durch
// die Tür des Raums in den nächsten; Raumlinien mit leiser Parallaxe (Maus), Inhalte gleiten einmal herein.
// Steuerung: „Weiter“/„Zurück“ unten, Fortschritt „Raum 1 von 3“ oben, Tastatur ← →, Wischen am Telefon.
// prefers-reduced-motion → ruhige Überblendung. „Alle Unterlagen“ (die Ordneransicht) ist jederzeit oben rechts.
//
// Inhalte (Bühnen) kommen vom Server erst nach der Vereinbarung (GET /api/fiaon/datenraum/buehnen) — in dieser
// Datei steht kein Projekt, keine Zahl. Ohne Bühne zeigt ein Raum Titel, Beschreibung und Unterlagen.
// Kein WebGL, keine Bibliothek, keine Bilder: nur SVG und CSS (client/src/styles/datenraum-tour.css).
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { FiaonWortmarke } from "@/components/marke/FiaonWortmarke";
import { drAnredeKurz, type DrGastAngaben } from "@shared/fiaon-datenraum-nda";
import { DR_ANFRAGE_TEXT, DR_TOUR_TEXTE, type DrBuehne, type DrBuehneKapitel, type DrBuehneKennzahl, type DrBuehneKurve } from "@shared/fiaon-datenraum-buehne";
import "@/styles/datenraum-tour.css";

const API = "/api/fiaon/datenraum";
const MERKER = "drt-station";

export interface TourDok { kennung: string; nr: number; titel: string; beschreibung: string; groesse: number; seiten: number | null; typ: string; ansehen: boolean }
export interface TourProjekt { buchstabe: string; titel: string; beschreibung: string; abgedeckt: boolean; dokumente: TourDok[] }
export interface TourStand {
  gast?: DrGastAngaben;
  raum?: { titel: string };
  projekte?: TourProjekt[];
  nda?: { unterzeichnetAm: string } | null;
  kontakt?: { name: string; email: string };
  nachtrag?: boolean;
}
interface Raum { projekt: TourProjekt; buehne: DrBuehne | null; haupt: boolean; nr: number }
type Station = { art: "auftakt" } | ({ art: "raum" } & Raum) | { art: "schritt" };
type AnfrageStand = { laeuft?: boolean; fertig?: string; fehler?: string };
type Senden = (art: "vertrag" | "frage", projekt: string | null, text?: string) => Promise<boolean>;
type Oeffnen = (d: TourDok, e: ReactMouseEvent<HTMLAnchorElement>) => void;

// ── Kleine Helfer ──────────────────────────────────────────────────────────
async function ruf(pfad: string, koerper?: unknown): Promise<{ status: number; j: any }> {
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
const ruhigGewuenscht = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
const grosseLeinwand = () => { try { return window.matchMedia("(min-width: 900px) and (pointer: fine)").matches; } catch { return false; } };
const zweistellig = (n: number) => String(n).padStart(2, "0");
const v = (i: number): CSSProperties => ({ "--i": i } as CSSProperties);
const ZAHLWORT = ["keinen", "einen", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf"];
const dokUrl = (d: TourDok) => `${API}/dokument/${encodeURIComponent(d.kennung)}`;
const groesse = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const dokMeta = (d: TourDok) => [d.typ, d.seiten ? `${d.seiten} ${d.seiten === 1 ? "Seite" : "Seiten"}` : "", groesse(d.groesse)].filter(Boolean).join(" · ");
const datumText = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" });
};

/** Einmal sichtbar geworden? (Inhalte gleiten EINMAL herein — nie an die Scrollposition gekoppelt.) */
function useSichtbar<T extends Element>(): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [da, setDa] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || da) return;
    if (typeof IntersectionObserver === "undefined" || ruhigGewuenscht()) { setDa(true); return; }
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { setDa(true); io.disconnect(); } }, { threshold: 0.01, rootMargin: "0px 0px -8% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [da]);
  return [ref, da];
}
function Block({ klasse, label, children }: { klasse: string; label?: string; children: (da: boolean) => ReactNode }) {
  const [ref, da] = useSichtbar<HTMLElement>();
  return <section ref={ref} className={`${klasse} drt-gleit${da ? " da" : ""}`} aria-label={label}>{children(da)}</section>;
}

// ═══════════════════════════════════════════════════════════════════════════
export default function Raumtour({ stand, frisch = false, alleUnterlagen, nachtrag, abgelaufen, abmelden }: {
  stand: TourStand;
  /** Eben unterzeichnet — dann beginnt die Tour beim Auftakt und sagt, dass die Kopie per E-Mail kommt. */
  frisch?: boolean;
  alleUnterlagen: () => void;
  nachtrag: () => void;
  abgelaufen: () => void;
  abmelden: () => void;
}) {
  const [buehnen, setBuehnen] = useState<Record<string, DrBuehne> | null>(null);
  const [station, setStation] = useState<number>(() => {
    if (frisch) return 0;
    try { const n = Number(window.sessionStorage.getItem(MERKER)); return Number.isInteger(n) && n > 0 ? n : 0; } catch { return 0; }
  });
  const [weg, setWeg] = useState<{ von: number; richtung: 1 | -1; nr: number } | null>(null);
  const [leinwand, setLeinwand] = useState<TourDok | null>(null);
  const [anfragen, setAnfragen] = useState<Record<string, AnfrageStand>>({});
  const [ruhig] = useState(ruhigGewuenscht);
  const wurzel = useRef<HTMLDivElement | null>(null);
  const buehne = useRef<HTMLElement | null>(null);
  const wisch = useRef<{ x: number; y: number; t: number } | null>(null);
  const gesehen = useRef<Set<string>>(new Set());
  const genavigiert = useRef(false);

  // Bühnen holen — erst nach der Vereinbarung gibt es sie (sonst 403 → Ordneransicht, die den Weg kennt).
  useEffect(() => {
    let aus = false;
    (async () => {
      const r = await ruf("/buehnen");
      if (aus) return;
      if (r.status === 401) { abgelaufen(); return; }
      if (r.status === 403) { alleUnterlagen(); return; }
      setBuehnen(r.j?.ok && r.j.buehnen && typeof r.j.buehnen === "object" ? (r.j.buehnen as Record<string, DrBuehne>) : {});
    })();
    return () => { aus = true; };
    // Nur beim Öffnen der Tour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Räume: alle Projekte, die die Vereinbarung abdeckt — das Hauptprojekt zuerst.
  const raeume = useMemo<Raum[]>(() => {
    const offen = (stand.projekte ?? []).filter((p) => p.abgedeckt);
    const b = buehnen ?? {};
    const haupt = offen.find((p) => b[p.buchstabe]?.hauptprojekt) ?? null;
    const reihe = haupt ? [haupt, ...offen.filter((p) => p !== haupt)] : offen;
    return reihe.map((p, i) => ({ projekt: p, buehne: b[p.buchstabe] ?? null, haupt: p === haupt, nr: i + 1 }));
  }, [stand.projekte, buehnen]);
  const stationen = useMemo<Station[]>(() => [{ art: "auftakt" }, ...raeume.map((r) => ({ art: "raum" as const, ...r })), { art: "schritt" }], [raeume]);
  const letzte = stationen.length - 1;
  const aktiv = Math.min(station, letzte);
  const aktivRef = useRef(aktiv);
  aktivRef.current = aktiv;
  const leinwandRef = useRef(false);
  leinwandRef.current = !!leinwand;

  // Ohne ein einziges freigeschaltetes Projekt gibt es nichts zu führen → Ordneransicht (sie erklärt den Stand).
  useEffect(() => { if (buehnen && raeume.length === 0) alleUnterlagen(); }, [buehnen, raeume.length, alleUnterlagen]);

  const gehe = useCallback((ziel: number) => {
    const jetzt = aktivRef.current;
    const z = Math.max(0, Math.min(letzte, ziel));
    if (z === jetzt) return;
    genavigiert.current = true;
    setWeg({ von: jetzt, richtung: z > jetzt ? 1 : -1, nr: Date.now() });
    setStation(z);
  }, [letzte]);

  useEffect(() => {
    if (!weg) return;
    const t = window.setTimeout(() => setWeg(null), ruhig ? 420 : 1080);
    return () => window.clearTimeout(t);
  }, [weg, ruhig]);
  useEffect(() => { try { window.sessionStorage.setItem(MERKER, String(aktiv)); } catch { /* privat — egal */ } }, [aktiv]);
  // Nach jedem Raumwechsel: der Kopf des neuen Raums bekommt den Fokus (Bildschirmleser hören, wo sie sind).
  useEffect(() => {
    if (!genavigiert.current) return;
    const t = window.setTimeout(() => buehne.current?.querySelector<HTMLElement>(`[data-station="${aktiv}"] [data-kopf]`)?.focus({ preventScroll: true }), 80);
    return () => window.clearTimeout(t);
  }, [aktiv]);

  // Tastatur ← → (nicht in Feldern, nicht über der Leinwand), Escape schließt die Leinwand.
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (leinwandRef.current) { if (e.key === "Escape") setLeinwand(null); return; }
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("input, textarea, select, [contenteditable='true']")) return;
      if (e.key === "ArrowRight") { e.preventDefault(); gehe(aktivRef.current + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); gehe(aktivRef.current - 1); }
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [gehe]);

  // Leise Parallaxe der Raumlinien mit der Maus (nur großer Bildschirm, nur mit Bewegung).
  useEffect(() => {
    const el = wurzel.current;
    if (!el || ruhig || !grosseLeinwand()) return;
    let f = 0; let px = 0; let py = 0;
    const zug = (e: PointerEvent) => {
      px = e.clientX / Math.max(1, window.innerWidth) - 0.5; py = e.clientY / Math.max(1, window.innerHeight) - 0.5;
      if (!f) f = window.requestAnimationFrame(() => { f = 0; el.style.setProperty("--drt-px", px.toFixed(3)); el.style.setProperty("--drt-py", py.toFixed(3)); });
    };
    window.addEventListener("pointermove", zug, { passive: true });
    return () => { window.removeEventListener("pointermove", zug); if (f) window.cancelAnimationFrame(f); };
  }, [ruhig]);

  const oeffnen = useCallback<Oeffnen>((d, e) => {
    if (!d.ansehen) return;
    const bild = d.typ === "PNG" || d.typ === "JPG";
    if (bild || (d.typ === "PDF" && grosseLeinwand())) { e.preventDefault(); setLeinwand(d); }
  }, []);

  const senden = useCallback<Senden>(async (art, projekt, text = "") => {
    const k = `${art}:${projekt ?? "-"}`;
    setAnfragen((a) => ({ ...a, [k]: { laeuft: true } }));
    const r = await ruf("/anfrage", { art, projekt, text });
    if (r.status === 401) { abgelaufen(); return false; }
    if (r.j?.ok) { setAnfragen((a) => ({ ...a, [k]: { fertig: String(r.j.meldung || "Danke — Ihre Nachricht ist bei uns.") } })); return true; }
    setAnfragen((a) => ({ ...a, [k]: { fehler: String(r.j?.error || "Das hat gerade nicht geklappt. Bitte versuchen Sie es noch einmal.") } }));
    return false;
  }, [abgelaufen]);
  const zuruecksetzen = useCallback((k: string) => setAnfragen((a) => { const n = { ...a }; delete n[k]; return n; }), []);

  const kontakt = stand.kontakt ?? { name: "", email: "" };
  const s = stationen[aktiv];
  const fortschritt = s.art === "auftakt" ? "Auftakt" : s.art === "schritt" ? "Ihr nächster Schritt" : `Raum ${s.nr} von ${raeume.length}`;
  const titel = s.art === "raum" ? s.projekt.titel : "";
  const naechste = aktiv < letzte ? stationen[aktiv + 1] : null;
  const naechsterName = !naechste ? "" : naechste.art === "raum" ? `Raum ${naechste.projekt.buchstabe}` : naechste.art === "schritt" ? "Ihr nächster Schritt" : "";

  const wischStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (e.touches.length !== 1 || (e.target as HTMLElement).closest?.("textarea, input, [data-kein-wischen]")) { wisch.current = null; return; }
    wisch.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const wischEnde = (e: React.TouchEvent) => {
    const a = wisch.current; wisch.current = null;
    if (!a) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - a.x; const dy = t.clientY - a.y;
    if (Math.abs(dx) > 64 && Math.abs(dx) > 1.8 * Math.abs(dy) && Date.now() - a.t < 800) gehe(aktivRef.current + (dx < 0 ? 1 : -1));
  };

  // Beim Lesen tritt die Bühne leise zurück (nur Deckkraft — erlaubt, weil es keine Bewegung ist).
  const tiefe = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.parentElement?.style.setProperty("--drt-tiefe", Math.min(1, el.scrollTop / 520).toFixed(3));
  };
  const zeigeStation = (i: number, klasse: string) => {
    const st = stationen[i];
    if (!st) return null;
    const schluessel = st.art === "raum" ? `raum-${st.projekt.buchstabe}` : st.art;
    const geht = klasse.startsWith("geht");
    let inhalt: ReactNode;
    if (st.art === "auftakt") {
      inhalt = <Auftakt stand={stand} raeume={raeume} frisch={frisch} beginnen={() => gehe(1)} alleUnterlagen={alleUnterlagen} nachtrag={nachtrag} />;
    } else if (st.art === "raum") {
      inhalt = <RaumBuehne r={st} gesamt={raeume.length} gesehen={gesehen.current} oeffnen={oeffnen} anfragen={anfragen} senden={senden} zuruecksetzen={zuruecksetzen} kontakt={kontakt} email={stand.gast?.email ?? ""} />;
    } else {
      inhalt = <Schritt raeume={raeume} anfragen={anfragen} senden={senden} zuruecksetzen={zuruecksetzen} kontakt={kontakt} email={stand.gast?.email ?? ""} gehe={gehe} alleUnterlagen={alleUnterlagen} abmelden={abmelden} />;
    }
    return (
      <section key={schluessel} className={`drt-station ${klasse} ${st.art}`} data-station={i} aria-hidden={geht || undefined}>
        {st.art !== "auftakt" && <Raumlinien />}
        <div className="drt-raum" data-fiaon={`drt-station-${st.art}`} onScroll={tiefe}>
          <div className="drt-raum-innen">
            {inhalt}
            <p className="drt-impressum">FIAON LTD · 128 City Road, London EC1V 2NX · <a href="/impressum">Impressum</a> · <a href="/datenschutz">Datenschutz</a></p>
          </div>
        </div>
      </section>
    );
  };

  return (
    <div className={`drt${ruhig ? " ruhig" : ""}`} ref={wurzel} data-fiaon="datenraum-tour">
      <header className="drt-kopf">
        <div className="drt-kopf-zeile">
          <span className="drt-marke"><FiaonWortmarke hoehe="19px" farbe="#12284a" /><span>Datenraum</span></span>
          <span className="drt-vertraulich"><Schloss />Vertraulich</span>
          <button type="button" className="drt-alle" onClick={alleUnterlagen} data-fiaon="drt-alle"><Raster /><span>Alle Unterlagen</span></button>
        </div>
        <nav className="drt-fortschritt" aria-label="Rundgang">
          <p className="drt-fortschritt-text"><b>{fortschritt}</b>{titel ? <span> · {titel}</span> : null}</p>
          <ol className="drt-segmente">
            {raeume.map((r, i) => {
              const nr = i + 1;
              const art = aktiv === letzte || nr < aktiv ? "fertig" : nr === aktiv ? "aktiv" : "";
              return (
                <li key={r.projekt.buchstabe} className={`${art}${r.haupt ? " haupt" : ""}`}>
                  <button type="button" onClick={() => gehe(nr)} aria-label={`Raum ${nr} von ${raeume.length}: ${r.projekt.titel}`} aria-current={nr === aktiv ? "step" : undefined} />
                </li>
              );
            })}
          </ol>
        </nav>
      </header>

      <main className="drt-buehne" ref={buehne} onTouchStart={wischStart} onTouchEnd={wischEnde}>
        {buehnen === null ? (
          <div className="drt-laedt" role="status"><span className="drt-laedt-linie" aria-hidden="true" />Ihr Rundgang wird vorbereitet …</div>
        ) : (
          <>
            {weg && weg.von !== aktiv && zeigeStation(weg.von, weg.richtung > 0 ? "geht-vor" : "geht-zurueck")}
            {zeigeStation(aktiv, weg ? (weg.richtung > 0 ? "kommt-vor" : "kommt-zurueck") : "steht")}
          </>
        )}
      </main>

      <footer className="drt-steuer">
        <button type="button" className="drt-zurueck" onClick={() => gehe(aktiv - 1)} disabled={aktiv === 0 || buehnen === null} data-fiaon="drt-zurueck"><Pfeil links />Zurück</button>
        <span className="drt-tasten" aria-hidden="true"><kbd>←</kbd><kbd>→</kbd></span>
        {aktiv < letzte ? (
          <button type="button" className="drt-weiter" onClick={() => gehe(aktiv + 1)} disabled={buehnen === null} data-fiaon="drt-weiter">
            Weiter{naechsterName ? <span className="drt-weiter-ziel"> · {naechsterName}</span> : null}<Pfeil />
          </button>
        ) : (
          <button type="button" className="drt-weiter" onClick={alleUnterlagen} data-fiaon="drt-weiter">Alle Unterlagen<Pfeil /></button>
        )}
      </footer>
      <p className="drt-unsichtbar" aria-live="polite">{buehnen === null ? "" : `${fortschritt}${titel ? ` · ${titel}` : ""}`}</p>
      {leinwand && <Leinwand dok={leinwand} zu={() => setLeinwand(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUFTAKT — die eine Navy-Glasfläche dieser Ansicht
// ═══════════════════════════════════════════════════════════════════════════
function Auftakt({ stand, raeume, frisch, beginnen, alleUnterlagen, nachtrag }: {
  stand: TourStand; raeume: Raum[]; frisch: boolean; beginnen: () => void; alleUnterlagen: () => void; nachtrag: () => void;
}) {
  const n = raeume.length;
  const haupt = raeume.find((r) => r.haupt) ?? null;
  const anrede = stand.gast ? drAnredeKurz(stand.gast) : "";
  const zahl = n < ZAHLWORT.length ? ZAHLWORT[n] : String(n);
  const datum = datumText(stand.nda?.unterzeichnetAm);
  return (
    <div className="drt-auftakt">
      <div className="drt-auftakt-glas drt-schicht" style={v(0)}>
        <span className="drt-auftakt-licht" aria-hidden="true" />
        <p className="drt-auge hell drt-schicht" style={v(1)}>{stand.raum?.titel || "Datenraum"}</p>
        <h1 className="drt-auftakt-titel drt-schicht" style={v(2)} data-kopf tabIndex={-1}>Willkommen im Datenraum.</h1>
        <p className="drt-auftakt-lead drt-schicht" style={v(3)}>
          {anrede ? `${anrede}, Ihr` : "Ihr"} Rundgang führt durch {zahl} {n === 1 ? "Raum" : "Räume"}{haupt ? <> — zuerst <b>{haupt.projekt.titel}</b></> : null}.
        </p>
        <Flucht raeume={raeume} />
        <ol className="drt-flucht-liste drt-schicht" style={v(5)}>
          {raeume.map((r) => (
            <li key={r.projekt.buchstabe} className={r.haupt ? "haupt" : ""}>
              <span className="bu" aria-hidden="true">{r.projekt.buchstabe}</span>
              <span>{r.projekt.titel}{r.haupt ? <em>Hauptprojekt</em> : null}</span>
            </li>
          ))}
        </ol>
        <div className="drt-auftakt-wege drt-schicht" style={v(6)}>
          <button type="button" className="drt-knopf hell gross" onClick={beginnen} data-fiaon="drt-beginnen">Rundgang beginnen<Pfeil /></button>
          <button type="button" className="drt-link hell" onClick={alleUnterlagen}>Gleich zu allen Unterlagen</button>
        </div>
      </div>
      <div className="drt-signiert drt-schicht" style={v(7)}>
        <span className="gruen"><Haken />Vereinbarung unterzeichnet{datum ? ` am ${datum}` : ""}</span>
        <a href={`${API}/nda.pdf`} target="_blank" rel="noopener">Ihr Exemplar (PDF)</a>
        {frisch ? <span>Eine Kopie kommt per E-Mail.</span> : null}
      </div>
      {stand.nachtrag ? (
        <div className="drt-nachtrag drt-schicht" style={v(8)}>
          <p>Zu einem weiteren Thema liegen Unterlagen bereit. Dafür ergänzen wir Ihre Vereinbarung um dieses Thema.</p>
          <button type="button" className="drt-knopf klein" onClick={nachtrag}>Ergänzte Vereinbarung ansehen</button>
        </div>
      ) : null}
    </div>
  );
}

/** Die Flucht: ein Portal je Raum, in Zentralperspektive — das Hauptprojekt vorn und leuchtend. */
function Flucht({ raeume }: { raeume: Raum[] }) {
  const gid = `drt-f-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const W = 600; const H = 300; const cx = W / 2; const cy = H / 2;
  const portale = raeume.slice(0, 8).map((r, i) => {
    const s = 1 / (1 + i * 0.82);
    const w = 360 * s; const h = 180 * s;
    return { r, i, s, x: cx - w / 2, y: cy - h / 2, w, h };
  });
  const hinten = portale[portale.length - 1] ?? { x: cx - 40, y: cy - 20, w: 80, h: 40, s: 0.2 };
  const tief = { x: cx - hinten.w * 0.42, y: cy - hinten.h * 0.42, w: hinten.w * 0.84, h: hinten.h * 0.84 };
  const boden = [0.16, 0.33, 0.5, 0.67, 0.84].map((t) => {
    const x0 = t * W; const k = (H - (tief.y + tief.h)) / (H - cy);
    return `M${x0.toFixed(1)} ${H}L${(x0 + (cx - x0) * k).toFixed(1)} ${(tief.y + tief.h).toFixed(1)}`;
  }).join("");
  return (
    <svg className="drt-flucht drt-schicht" style={v(4)} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Ein Gang durch ${raeume.length} Räume`}>
      <defs>
        <radialGradient id={gid} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#e3efff" stopOpacity="0.9" />
          <stop offset="0.45" stopColor="#7fb4ff" stopOpacity="0.32" />
          <stop offset="1" stopColor="#7fb4ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse className="drt-flucht-licht" cx={cx} cy={cy} rx={Math.max(60, tief.w * 1.15)} ry={Math.max(34, tief.h * 1.2)} fill={`url(#${gid})`} />
      <rect className="drt-flucht-tiefe" x={tief.x} y={tief.y} width={tief.w} height={tief.h} rx="2" />
      <g className="drt-flucht-kanten">
        <path d={`M0 0L${tief.x} ${tief.y}M${W} 0L${tief.x + tief.w} ${tief.y}M0 ${H}L${tief.x} ${tief.y + tief.h}M${W} ${H}L${tief.x + tief.w} ${tief.y + tief.h}`} />
        <path d={boden} />
      </g>
      {portale.slice().reverse().map((p) => (
        <g key={p.r.projekt.buchstabe} className={`drt-portal${p.r.haupt ? " haupt" : ""}`} style={{ "--t": p.i } as CSSProperties}>
          <path d={`M${p.x.toFixed(1)} ${p.y.toFixed(1)}H${(p.x + p.w).toFixed(1)}V${(p.y + p.h).toFixed(1)}H${p.x.toFixed(1)}Z`} pathLength={1} />
          <text x={p.x + 14 * p.s} y={p.y + 34 * p.s} fontSize={30 * p.s}>{p.r.projekt.buchstabe}</text>
        </g>
      ))}
    </svg>
  );
}

/** Die Linien eines Raums (Zentralperspektive, Fluchtpunkt auf Augenhöhe) — leise, mit Parallaxe. */
function Raumlinien() {
  // Rückwand ähnlich zum Rahmen um den Fluchtpunkt (800, 400) skaliert — so laufen alle Kanten durch ihn.
  return (
    <div className="drt-linien" aria-hidden="true">
      <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
        <rect className="tuer" x="592" y="296" width="416" height="260" rx="3" />
        <g className="kanten">
          <path d="M0 0L592 296M1600 0L1008 296M0 1000L592 556M1600 1000L1008 556" />
          <path d="M320 1000L675.2 556M640 1000L758.4 556M960 1000L841.6 556M1280 1000L924.8 556" />
          <path d="M266.7 800H1333.3M436.4 672.7H1163.6M550 587.5H1050" />
          <path d="M266.7 133.3V800M436.4 218.2V672.7M550 275V587.5M1333.3 133.3V800M1163.6 218.2V672.7M1050 275V587.5" />
          <path d="M400 0L696 296M800 0V296M1200 0L904 296" />
        </g>
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EIN RAUM — die Bühne eines Projekts
// ═══════════════════════════════════════════════════════════════════════════
function RaumBuehne({ r, gesamt, gesehen, oeffnen, anfragen, senden, zuruecksetzen, kontakt, email }: {
  r: Raum; gesamt: number; gesehen: Set<string>; oeffnen: Oeffnen; anfragen: Record<string, AnfrageStand>; senden: Senden;
  zuruecksetzen: (k: string) => void; kontakt: { name: string; email: string }; email: string;
}) {
  const b = r.buehne;
  const p = r.projekt;
  // Beim ersten Besuch zählen die Kennzahlen hoch — kommt der Gast zurück, stehen sie einfach da.
  const merk = `raum-${p.buchstabe}`;
  const [zaehlen] = useState(() => !gesehen.has(merk));
  useEffect(() => { gesehen.add(merk); }, [gesehen, merk]);
  const claim = b?.claim || p.titel;
  const unter = b ? b.untertitel : p.beschreibung;
  const nachNr = useMemo(() => new Map(p.dokumente.map((d) => [d.nr, d])), [p.dokumente]);
  return (
    <article className={`drt-raum-inhalt${r.haupt ? " haupt" : ""}`}>
      <header className="drt-raum-kopf">
        <span className="drt-riese" aria-hidden="true">{p.buchstabe}</span>
        <p className="drt-meta drt-schicht" style={v(0)}>
          <span className="drt-bu" aria-hidden="true">{p.buchstabe}</span>
          <span>Raum {r.nr} von {gesamt} · {p.titel}</span>
          {r.haupt ? <span className="drt-pille">Hauptprojekt</span> : null}
        </p>
        {b?.kicker ? <p className="drt-auge drt-schicht" style={v(1)}>{b.kicker}</p> : null}
        <h2 className="drt-claim drt-schicht" style={v(2)} data-kopf tabIndex={-1}>{claim}</h2>
        {unter ? <p className="drt-unter drt-schicht" style={v(3)}>{unter}</p> : null}
      </header>
      {b && b.kennzahlen.length > 0 ? <Kennzahlen liste={b.kennzahlen} navy={r.haupt} zaehlen={zaehlen} /> : null}
      {b?.kurve ? <Kurve kurve={b.kurve} /> : null}
      {b && b.kapitel.length > 0 ? <Kapitel liste={b.kapitel} nachNr={nachNr} oeffnen={oeffnen} /> : null}
      <Unterlagen docs={p.dokumente} titel={p.titel} oeffnen={oeffnen} />
      {r.haupt ? (
        <Block klasse="drt-abschluss" label="Vertragsentwurf">
          {() => (
            <>
              <div className="drt-abschluss-text">
                <p className="drt-auge">Vertragsentwurf</p>
                <h3>Der nächste Schritt zu {p.titel}.</h3>
              </div>
              <div className="drt-abschluss-wege">
                <AbschlussKnopf r={r} anfragen={anfragen} senden={senden} kontakt={kontakt} />
                <FrageFeld projekt={p.buchstabe} anfragen={anfragen} senden={senden} zuruecksetzen={zuruecksetzen} email={email} />
              </div>
            </>
          )}
        </Block>
      ) : (
        <Block klasse="drt-frage-zeile" label="Frage stellen">
          {() => (
            <>
              <p>Fragen zu {p.titel}? {kontakt.name ? `${kontakt.name} antwortet persönlich.` : ""}</p>
              <FrageFeld projekt={p.buchstabe} anfragen={anfragen} senden={senden} zuruecksetzen={zuruecksetzen} email={email} />
            </>
          )}
        </Block>
      )}
      {b?.hinweis ? <p className="drt-kleingedruckt">{b.hinweis}</p> : null}
    </article>
  );
}

function Kennzahlen({ liste, navy, zaehlen }: { liste: DrBuehneKennzahl[]; navy: boolean; zaehlen: boolean }) {
  return (
    <Block klasse={`drt-kennzahlen${navy ? " navy" : ""} n${Math.min(6, liste.length)}`} label="Kennzahlen">
      {(da) => liste.map((k, i) => (
        <div key={i} className="drt-kachel" style={{ "--j": i } as CSSProperties}>
          <Zahl wert={k.wert} los={da && zaehlen} verzug={260 + i * 120} />
          <span className="drt-kachel-label">{k.label}</span>
          {k.hinweis ? <span className="drt-kachel-hinweis">{k.hinweis}</span> : null}
        </div>
      ))}
    </Block>
  );
}

/** Die erste Zahl im Wert (deutsch geschrieben: 1.250 oder 12,5) — Vorsilbe, Nachsilbe, Nachkommastellen, Tausenderzeichen. */
function zahlTeile(wert: string): { vor: string; nach: string; roh: string; zahl: number; stellen: number; tausend: string } | null {
  const m = /(\d{1,3}(?:([.   ’' ])\d{3})+|\d+)(?:,(\d+))?/.exec(wert);
  if (!m) return null;
  const tausend = m[2] ?? "";
  const ganz = Number(m[1].replace(/[^\d]/g, ""));
  const stellen = m[3]?.length ?? 0;
  const zahl = ganz + (stellen ? Number(`0.${m[3]}`) : 0);
  if (!Number.isFinite(zahl) || zahl === 0) return null;
  return { vor: wert.slice(0, m.index), nach: wert.slice(m.index + m[0].length), roh: m[0], zahl, stellen, tausend };
}
function zahlSchreiben(n: number, t: { stellen: number; tausend: string }): string {
  const [g, k] = n.toFixed(t.stellen).split(".");
  const ganz = t.tausend ? g.replace(/\B(?=(\d{3})+(?!\d))/g, t.tausend) : g;
  return k ? `${ganz},${k}` : ganz;
}
/**
 * Zählt einmal hoch (1,2 s, sanft auslaufend) und endet GENAU auf dem gespeicherten Text. Die Einheit davor und
 * danach („€“, „Mio.“, „Monate“) steht klein neben der großen Zahl.
 */
function Zahl({ wert, los, verzug }: { wert: string; los: boolean; verzug: number }) {
  const teile = useMemo(() => zahlTeile(wert), [wert]);
  const [anzeige, setAnzeige] = useState<string | null>(null);
  useEffect(() => {
    if (!los || !teile || ruhigGewuenscht()) { setAnzeige(null); return; }
    let f = 0; let t0 = 0;
    setAnzeige(zahlSchreiben(0, teile));
    const schritt = (t: number) => {
      if (!t0) t0 = t;
      const x = Math.min(1, Math.max(0, (t - t0 - verzug) / 1200));
      const e = 1 - Math.pow(1 - x, 3);
      if (x >= 1) { setAnzeige(null); return; }
      setAnzeige(zahlSchreiben(teile.zahl * e, teile));
      f = window.requestAnimationFrame(schritt);
    };
    f = window.requestAnimationFrame(schritt);
    return () => window.cancelAnimationFrame(f);
  }, [los, teile, verzug]);
  const satz = (zahl: string) => (teile ? <>{teile.vor ? <span className="einheit">{teile.vor}</span> : null}{zahl}{teile.nach ? <span className="einheit">{teile.nach}</span> : null}</> : wert);
  return (
    <span className="drt-zahl" aria-label={wert}>
      <span className="mass" aria-hidden="true">{satz(teile?.roh ?? wert)}</span>
      <span className="lauf" aria-hidden="true">{satz(anzeige ?? teile?.roh ?? wert)}</span>
    </span>
  );
}

// ── Die Kurve: ruhiges SVG, misst seine Breite selbst (Schrift bleibt am Telefon lesbar) ──
function schoeneStufen(lo: number, hi: number, anzahl = 4): number[] {
  const roh = (hi - lo) / Math.max(1, anzahl);
  const p = Math.pow(10, Math.floor(Math.log10(roh)));
  const n = roh / p;
  const stufe = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  const a = Math.floor(lo / stufe) * stufe; const b = Math.ceil(hi / stufe) * stufe;
  const out: number[] = [];
  for (let x = a; x <= b + stufe / 2 && out.length < 12; x += stufe) out.push(Number(x.toFixed(10)));
  return out;
}
const f1 = (n: number) => n.toFixed(1);
/** Monotone kubische Kurve (Fritsch–Carlson): ruhig, ohne Überschwinger. */
function monotonPfad(p: [number, number][]): string {
  const n = p.length;
  if (n < 2) return "";
  if (n === 2) return `M${f1(p[0][0])},${f1(p[0][1])}L${f1(p[1][0])},${f1(p[1][1])}`;
  const dx: number[] = []; const m: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = p[i + 1][0] - p[i][0]; m[i] = dx[i] === 0 ? 0 : (p[i + 1][1] - p[i][1]) / dx[i]; }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  t[n - 1] = m[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i]; const b = t[i + 1] / m[i]; const q = a * a + b * b;
    if (q > 9) { const k = 3 / Math.sqrt(q); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${f1(p[0][0])},${f1(p[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${f1(p[i][0] + h)},${f1(p[i][1] + t[i] * h)} ${f1(p[i + 1][0] - h)},${f1(p[i + 1][1] - t[i + 1] * h)} ${f1(p[i + 1][0])},${f1(p[i + 1][1])}`;
  }
  return d;
}
function Kurve({ kurve }: { kurve: DrBuehneKurve }) {
  const box = useRef<HTMLDivElement | null>(null);
  const [breite, setBreite] = useState(640);
  const gid = `drt-k-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // clientWidth = Breite im Layout — unabhängig von der 3D-Bewegung beim Raumwechsel.
    const messen = () => setBreite(Math.max(240, Math.round(el.clientWidth)));
    messen();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(messen);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = breite < 520 ? 210 : 280;
  const L = breite < 520 ? 40 : 52; const R = 18; const T = 22; const U = 30;
  const plan = useMemo(() => {
    const alle = kurve.reihen.flatMap((r) => r.punkte);
    if (!alle.length) return null;
    const zahlen = alle.every((x) => typeof x.x === "number");
    const xs: (string | number)[] = [];
    for (const q of alle) if (!xs.some((x) => String(x) === String(q.x))) xs.push(q.x);
    if (zahlen) xs.sort((a, b) => Number(a) - Number(b));
    const xMin = zahlen ? Number(xs[0]) : 0; const xMax = zahlen ? Number(xs[xs.length - 1]) : xs.length - 1;
    const xPos = (x: string | number) => {
      const w = zahlen ? Number(x) : xs.findIndex((y) => String(y) === String(x));
      return L + (xMax === xMin ? (breite - L - R) / 2 : ((w - xMin) / (xMax - xMin)) * (breite - L - R));
    };
    const ys = alle.map((q) => q.y);
    let lo = Math.min(0, ...ys); let hi = Math.max(...ys);
    if (hi === lo) hi = lo + 1;
    const stufen = schoeneStufen(lo, hi, 4);
    lo = stufen[0]; hi = stufen[stufen.length - 1];
    const yPos = (y: number) => T + (1 - (y - lo) / (hi - lo)) * (H - T - U);
    const schritt = stufen.length > 1 ? stufen[1] - stufen[0] : 1;
    const stellen = schritt < 1 ? Math.min(3, Math.ceil(-Math.log10(schritt) - 1e-9)) : 0;
    const reihen = kurve.reihen.map((r) => {
      const pts = r.punkte.map((q) => [xPos(q.x), yPos(q.y)] as [number, number]).sort((a, b) => a[0] - b[0]);
      const sortiert = r.punkte.slice().sort((a, b) => xPos(a.x) - xPos(b.x));
      return { name: r.name, d: monotonPfad(pts), pts, erste: sortiert[0], letzte: sortiert[sortiert.length - 1] };
    });
    const r0 = reihen[0];
    const flaeche = r0 && r0.pts.length > 1 ? `${r0.d}L${f1(r0.pts[r0.pts.length - 1][0])},${f1(yPos(lo))}L${f1(r0.pts[0][0])},${f1(yPos(lo))}Z` : "";
    const jede = xs.length <= 8 ? 1 : Math.ceil(xs.length / 6);
    const xMarken = xs.map((x, i) => ({ x, i })).filter(({ i }) => i % jede === 0 || i === xs.length - 1);
    return { reihen, flaeche, stufen, stellen, yPos, xPos, xMarken, lo };
  }, [kurve, breite, H, L]);
  if (!plan) return null;
  const zahl = (n: number, s = 2) => n.toLocaleString("de-DE", { maximumFractionDigits: s });
  const xText = (x: string | number) => (typeof x === "number" ? x.toLocaleString("de-DE", { useGrouping: false, maximumFractionDigits: 2 }) : x);
  const ende = plan.reihen[0]?.letzte;
  const endeX = ende ? plan.xPos(ende.x) : 0;
  const beschreibung = `${kurve.titel}${kurve.einheit ? ` (in ${kurve.einheit})` : ""}: ` + plan.reihen.map((r) => `${r.name} von ${zahl(r.erste.y)} (${xText(r.erste.x)}) bis ${zahl(r.letzte.y)} (${xText(r.letzte.x)})`).join("; ");
  return (
    <Block klasse="drt-kurve" label={kurve.titel}>
      {(da) => (
        <figure>
          <figcaption><b>{kurve.titel}</b>{kurve.einheit ? <span>in {kurve.einheit}</span> : null}</figcaption>
          <div className="drt-kurve-flaeche" ref={box}>
            <svg viewBox={`0 0 ${breite} ${H}`} width={breite} height={H} role="img" aria-label={beschreibung}>
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#288dfa" stopOpacity="0.2" />
                  <stop offset="1" stopColor="#288dfa" stopOpacity="0" />
                </linearGradient>
              </defs>
              {plan.stufen.map((t) => (
                <g key={t}>
                  <line className={t === 0 ? "null" : "gitter"} x1={L} x2={breite - R} y1={plan.yPos(t)} y2={plan.yPos(t)} />
                  <text className="achse" x={L - 10} y={plan.yPos(t) + 4} textAnchor="end">{zahl(t, plan.stellen)}</text>
                </g>
              ))}
              {plan.xMarken.map(({ x }) => (
                <text key={String(x)} className="achse" x={plan.xPos(x)} y={H - 9} textAnchor="middle">{xText(x)}</text>
              ))}
              {plan.flaeche ? <path className={`flaeche${da ? " an" : ""}`} d={plan.flaeche} fill={`url(#${gid})`} /> : null}
              {plan.reihen.map((r, i) => <path key={i} className={`linie l${i}${da ? " an" : ""}`} d={r.d} pathLength={1} />)}
              {ende ? (
                <g className={`ende${da ? " an" : ""}`}>
                  <circle cx={endeX} cy={plan.yPos(ende.y)} r="4.5" />
                  <text x={endeX - 2} y={plan.yPos(ende.y) - 12} textAnchor="end">{zahl(ende.y)}</text>
                </g>
              ) : null}
            </svg>
          </div>
          {plan.reihen.length > 1 ? (
            <ul className="drt-legende">{plan.reihen.map((r, i) => <li key={i}><span className={`strich l${i}`} aria-hidden="true" />{r.name}</li>)}</ul>
          ) : null}
          {kurve.fussnote ? <p className="drt-fussnote">{kurve.fussnote}</p> : null}
        </figure>
      )}
    </Block>
  );
}

function Kapitel({ liste, nachNr, oeffnen }: { liste: DrBuehneKapitel[]; nachNr: Map<number, TourDok>; oeffnen: Oeffnen }) {
  return (
    <div className="drt-kapitel">
      {liste.map((k, i) => {
        const passend = (k.dokumente ?? []).map((n) => nachNr.get(n)).filter((d): d is TourDok => !!d);
        return (
          <Block key={i} klasse="drt-kapitel-eintrag" label={k.titel}>
            {() => (
              <>
                <span className="drt-kapitel-nr" aria-hidden="true">{zweistellig(i + 1)}</span>
                <h3>{k.titel}</h3>
                <div className="drt-kapitel-text">
                  {k.text.split(/\n+/).map((t, j) => <p key={j}>{t}</p>)}
                  {passend.length ? (
                    <div className="drt-chips">
                      {passend.map((d) => (
                        <DokLink key={d.kennung} d={d} oeffnen={oeffnen} klasse="drt-chip"><Blatt />{d.titel}<span>{d.ansehen ? "Ansehen" : "Laden"}</span></DokLink>
                      ))}
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </Block>
        );
      })}
    </div>
  );
}

function DokLink({ d, oeffnen, klasse, children }: { d: TourDok; oeffnen: Oeffnen; klasse: string; children: ReactNode }) {
  if (!d.ansehen) return <a className={klasse} href={`${dokUrl(d)}?laden=1`} download>{children}</a>;
  return <a className={klasse} href={dokUrl(d)} target="_blank" rel="noopener" onClick={(e) => oeffnen(d, e)}>{children}</a>;
}

function Unterlagen({ docs, titel, oeffnen }: { docs: TourDok[]; titel: string; oeffnen: Oeffnen }) {
  return (
    <Block klasse="drt-unterlagen" label={`Unterlagen zu ${titel}`}>
      {() => (
        <>
          <h3 className="drt-abschnitt">Unterlagen <span>{docs.length || ""}</span></h3>
          {docs.length === 0 ? <p className="drt-fein">Zu diesem Raum folgen die Unterlagen in Kürze.</p> : (
            <ol>
              {docs.map((d, i) => (
                <li key={d.kennung} className="drt-dok">
                  <span className="nr" aria-hidden="true">{zweistellig(i + 1)}</span>
                  <div className="drt-dok-text">
                    <b>{d.titel}</b>
                    {d.beschreibung ? <p>{d.beschreibung}</p> : null}
                    <span className="meta">{dokMeta(d)}</span>
                  </div>
                  <div className="drt-dok-wege">
                    {d.ansehen ? <DokLink d={d} oeffnen={oeffnen} klasse="drt-knopf klein still">Ansehen</DokLink> : null}
                    <a className="drt-knopf klein still" href={`${dokUrl(d)}?laden=1`} download>Herunterladen</a>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </Block>
  );
}

// ── Abschluss und Frage ────────────────────────────────────────────────────
function AbschlussKnopf({ r, anfragen, senden, kontakt, hell = false }: {
  r: Raum; anfragen: Record<string, AnfrageStand>; senden: Senden; kontakt: { name: string; email: string }; hell?: boolean;
}) {
  const st = anfragen[`vertrag:${r.projekt.buchstabe}`];
  const text = r.buehne?.abschluss?.knopf || DR_TOUR_TEXTE.abschlussKnopf;
  const satz = r.buehne?.abschluss?.satz || (kontakt.name ? `Unverbindlich — Sie erhalten den Entwurf persönlich von ${kontakt.name}.` : "Unverbindlich — Sie erhalten den Entwurf persönlich.");
  if (st?.fertig) return <div className={`drt-bestaetigt${hell ? " hell" : ""}`} role="status"><Haken /><p>{st.fertig}</p></div>;
  return (
    <div className="drt-abschluss-knopf">
      <button type="button" className={`drt-knopf gross${hell ? " hell" : ""}`} disabled={!!st?.laeuft} onClick={() => void senden("vertrag", r.projekt.buchstabe)} data-fiaon="drt-vertrag">
        {st?.laeuft ? "Wird gesendet …" : text}<Pfeil />
      </button>
      <p className={`drt-fein${hell ? " hell" : ""}`}>{satz}</p>
      {st?.fehler ? <p className="drt-fehler" role="alert">{st.fehler}</p> : null}
    </div>
  );
}

function FrageFeld({ projekt, anfragen, senden, zuruecksetzen, email, offenStart = false, hell = false }: {
  projekt: string | null; anfragen: Record<string, AnfrageStand>; senden: Senden; zuruecksetzen: (k: string) => void; email: string; offenStart?: boolean; hell?: boolean;
}) {
  const [offen, setOffen] = useState(offenStart);
  const [text, setText] = useState("");
  const k = `frage:${projekt ?? "-"}`;
  const st = anfragen[k];
  if (st?.fertig) {
    return (
      <div className={`drt-bestaetigt${hell ? " hell" : ""}`} role="status">
        <Haken /><p>{st.fertig}</p>
        <button type="button" className={`drt-link${hell ? " hell" : ""}`} onClick={() => { zuruecksetzen(k); setText(""); setOffen(true); }}>Weitere Frage stellen</button>
      </div>
    );
  }
  if (!offen) return <button type="button" className={`drt-link${hell ? " hell" : ""}`} onClick={() => setOffen(true)} data-fiaon="drt-frage">Frage stellen</button>;
  const zuKurz = text.trim().length < DR_ANFRAGE_TEXT.min;
  return (
    <form className="drt-frage" onSubmit={async (e) => { e.preventDefault(); if (zuKurz || st?.laeuft) return; if (await senden("frage", projekt, text)) setText(""); }}>
      <label className="drt-feld">
        <span>Ihre Frage</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={DR_ANFRAGE_TEXT.max} data-fiaon="drt-frage-text" />
      </label>
      {st?.fehler ? <p className="drt-fehler" role="alert">{st.fehler}</p> : null}
      <div className="drt-knoepfe">
        <button type="submit" className="drt-knopf klein" disabled={zuKurz || !!st?.laeuft}>{st?.laeuft ? "Wird gesendet …" : "Frage senden"}</button>
        <button type="button" className="drt-link" onClick={() => setOffen(false)}>Abbrechen</button>
      </div>
      {email ? <p className="drt-fein">Die Antwort kommt per E-Mail an {email}.</p> : null}
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LETZTER RAUM — „Ihr nächster Schritt“
// ═══════════════════════════════════════════════════════════════════════════
function Schritt({ raeume, anfragen, senden, zuruecksetzen, kontakt, email, gehe, alleUnterlagen, abmelden }: {
  raeume: Raum[]; anfragen: Record<string, AnfrageStand>; senden: Senden; zuruecksetzen: (k: string) => void;
  kontakt: { name: string; email: string }; email: string; gehe: (i: number) => void; alleUnterlagen: () => void; abmelden: () => void;
}) {
  const [wahl, setWahl] = useState<string>(() => (raeume.find((r) => r.haupt) ?? raeume[0])?.projekt.buchstabe ?? "");
  const gewaehlt = raeume.find((r) => r.projekt.buchstabe === wahl) ?? raeume[0];
  return (
    <article className="drt-raum-inhalt schritt">
      <header className="drt-raum-kopf">
        <p className="drt-auge drt-schicht" style={v(0)}>Ihr nächster Schritt</p>
        <h2 className="drt-claim drt-schicht" style={v(1)} data-kopf tabIndex={-1}>Gehen wir den nächsten Schritt gemeinsam.</h2>
        <p className="drt-unter drt-schicht" style={v(2)}>Fordern Sie den Vertragsentwurf an oder stellen Sie Ihre Frage{kontakt.name ? ` — ${kontakt.name} antwortet persönlich` : ""}.</p>
      </header>
      {gewaehlt ? (
        <section className="drt-schritt-glas drt-schicht" style={v(3)} aria-label="Vertragsentwurf anfordern">
          <span className="drt-auftakt-licht" aria-hidden="true" />
          <p className="drt-auge hell">Vertragsentwurf</p>
          {raeume.length > 1 ? (
            <div className="drt-wahl" role="radiogroup" aria-label="Projekt">
              {raeume.map((r) => (
                <button key={r.projekt.buchstabe} type="button" role="radio" aria-checked={r === gewaehlt} onClick={() => setWahl(r.projekt.buchstabe)}>
                  <span className="bu">{r.projekt.buchstabe}</span>{r.projekt.titel}{r.haupt ? <em>Hauptprojekt</em> : null}
                </button>
              ))}
            </div>
          ) : null}
          <h3 className="drt-schritt-titel">{gewaehlt.projekt.titel}</h3>
          {gewaehlt.buehne?.claim ? <p className="drt-schritt-claim">{gewaehlt.buehne.claim}</p> : null}
          <AbschlussKnopf r={gewaehlt} anfragen={anfragen} senden={senden} kontakt={kontakt} hell />
        </section>
      ) : null}
      <Block klasse="drt-frage-karte" label="Frage stellen">
        {() => (
          <>
            <h3>Eine Frage vorab?</h3>
            <FrageFeld projekt={null} anfragen={anfragen} senden={senden} zuruecksetzen={zuruecksetzen} email={email} offenStart />
          </>
        )}
      </Block>
      <Block klasse="drt-rueckblick" label="Ihr Rundgang">
        {() => (
          <>
            <h3 className="drt-abschnitt">Ihr Rundgang</h3>
            <ol>
              {raeume.map((r, i) => (
                <li key={r.projekt.buchstabe}>
                  <button type="button" onClick={() => gehe(i + 1)}>
                    <span className="bu" aria-hidden="true">{r.projekt.buchstabe}</span>
                    <span><b>{r.projekt.titel}</b>{r.buehne?.claim ? <small>{r.buehne.claim}</small> : null}</span>
                    <Pfeil />
                  </button>
                </li>
              ))}
            </ol>
            <div className="drt-rueckblick-wege">
              <button type="button" className="drt-knopf klein still" onClick={alleUnterlagen}>Alle Unterlagen</button>
              <a className="drt-knopf klein still" href={`${API}/nda.pdf`} target="_blank" rel="noopener">Ihr Exemplar der Vereinbarung</a>
            </div>
          </>
        )}
      </Block>
      {kontakt.name ? <p className="drt-kontakt">{kontakt.name} · <a href={`mailto:${kontakt.email}`}>{kontakt.email}</a></p> : null}
      <p className="drt-abmelden"><button type="button" className="drt-link" onClick={abmelden}>Abmelden</button></p>
    </article>
  );
}

// ── Leinwand: PDF und Bilder im Raum öffnen (am Telefon öffnen PDFs im neuen Tab) ──
function Leinwand({ dok, zu }: { dok: TourDok; zu: () => void }) {
  const knopf = useRef<HTMLButtonElement | null>(null);
  const url = dokUrl(dok);
  const bild = dok.typ === "PNG" || dok.typ === "JPG";
  useEffect(() => {
    const vorher = document.activeElement as HTMLElement | null;
    knopf.current?.focus();
    return () => { vorher?.focus?.(); };
  }, []);
  return (
    <div className="drt-leinwand" role="dialog" aria-modal="true" aria-label={dok.titel} onClick={(e) => { if (e.target === e.currentTarget) zu(); }}>
      <div className="drt-leinwand-blatt">
        <div className="drt-leinwand-kopf">
          <span className="drt-leinwand-titel"><b>{dok.titel}</b><small>{dokMeta(dok)} · vertraulich</small></span>
          <span className="drt-leinwand-wege">
            <a href={url} target="_blank" rel="noopener">Neuer Tab</a>
            <a href={`${url}?laden=1`} download>Herunterladen</a>
            <button ref={knopf} type="button" onClick={zu} aria-label="Schließen"><Kreuz /></button>
          </span>
        </div>
        <div className="drt-leinwand-flaeche">{bild ? <img src={url} alt={dok.titel} /> : <iframe src={url} title={dok.titel} />}</div>
      </div>
    </div>
  );
}

// ── Zeichen (selbst gezeichnet, 1,5 px, currentColor) ──────────────────────
function Pfeil({ links = false }: { links?: boolean }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="drt-pfeil">{links ? <path d="M14.5 6.5L9 12l5.5 5.5" /> : <path d="M9.5 6.5L15 12l-5.5 5.5" />}</svg>; }
function Schloss() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" /></svg>; }
function Haken() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12.4l2.7 2.6L16.2 9.5" /></svg>; }
function Raster() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></svg>; }
function Blatt() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z" /><path d="M14 3.5V8h4" /></svg>; }
function Kreuz() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></svg>; }
