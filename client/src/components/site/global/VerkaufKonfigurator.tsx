// ═══════════════════════════════════════════════════════════════════════════
// DER HONORARRECHNER (im Code „Konfigurator“) — das Herz des Verkaufsmotors von FIAON Global (Register E-509, 12.11.2026)
//
// E-510 (13.11.2026, Sprachleitfaden 7.7 und 8.4): sichtbar heißt das Werkzeug „Honorarrechner“, der Abschnitt „Ihr Angebot“.
// Die EINE Haupt-Handlung heißt auf jedem Knopf gleich: „Angebot anfordern“ — am Honorarblatt, am Formular, in der Leiste
// am Handy. Am Regler stehen S9 und S1, im Honorarblatt die drei Zeilen des Honorars, die Geld-zurück-Garantie in der
// Kurz-Form mit Fristbeginn und Ziffer 4 und die Zeile S5-C; am Absende-Knopf der Vertragspartner mit Registernummer.
// Der Satz nach dem Absenden hat zwei Fassungen: „öffnet sich“ nur, wenn es für diesen Besucher stimmt (sicht.an).
//
// Justin: „… kann man auswählen für was man sich interessiert — Funding, Kreditkarte, Unternehmensberatung … und dann
// soll er seine Funding Summe auswählen — beginnend bei 50k $ endet bei 1 Mio … und dann eben unsere Preise — einfach so
// gestalten dass der Kunde selbstständig abschließen kann.“
//
// Drei Dinge auf einer Fläche (die EINE dunkle Glasfläche der Seite): Schwerpunkte wählen, Kapitalrahmen wählen,
// Honorar lesen. Dann die Angaben — und das Angebot öffnet sich oder kommt persönlich. Jede Zahl rechnet mit denselben Funktionen wie der
// Vertrag (shared/fiaon-global-verkauf.ts → kapitalCStaffelHonorarCents); jeder Satz steht dort, die Wortwand liest ihn.
// Welcher Weg am Ende gilt (Selbstabschluss oder persönlich), sagt verkaufWeg — dieselbe Funktion wie auf dem Server.
//
// ZWEI ARTEN, DIESELBE FLÄCHE (12.11.2026): Der Server sagt beim Laden, ob für DIESEN Besucher sofort ein Angebot entsteht
// (sicht.an). Wenn nicht (Notschalter, Probebetrieb), bleibt alles gleich — nur verspricht kein Satz und kein Knopf mehr,
// dass sich das Angebot sofort öffnet: Es kommt persönlich (K.persoenlich). Für den Besucher ist das kein Hinweis auf einen
// Probebetrieb, sondern schlicht der persönliche Weg.
//
// BEWEGUNG (Feinschliff 13.11.2026, Justin: „achte auf die Formatierung … ein paar mehr Animationen“) — bewegt wird nur
// transform und opacity, alles läuft einmal oder beim Bedienen, nichts hängt an der Scrollposition:
//   · Zahlen ROLLEN zum neuen Wert: Nur die Ziffern, die sich ändern, gleiten (RollZahl) — keine springenden Ziffern.
//     Die große Zahl steht in natürlicher Ziffernbreite (keine Lücke nach der 1), die Einheit klein daneben; im
//     Preisblatt stehen Tabellenziffern mit fester Breite, damit links nichts neu umbricht.
//   · Der Regler: Der echte Schieberegler liegt unsichtbar darüber (Tastatur, Screenreader, Finger wie gewohnt);
//     gezeichnet werden Spur, Füllung und Daumen, die weich zum nächsten Rasterpunkt gleiten.
//   · Das Preisblatt hat drei Lagen (Preis, Miami, ohne Kapital) im selben Feld — der Wechsel ist eine Überblendung,
//     das Blatt behält seine Höhe, der Knopf seinen Platz.
//   · Der Schritt zu „Ihre Angaben“ gleitet (hinaus nach links, herein von rechts; zurück umgekehrt).
//   · Am Handy gleitet eine Leiste mit dem Preis herein, solange das Blatt selbst noch nicht im Bild ist.
// Bei „weniger Bewegung“ steht alles sofort; Screenreader bekommen nur den Endwert (ein ruhiger Satz, aria-live).
//
// E-510 (13.11.2026, Gestaltung — UX-Prüfung 2.3 und 3.13):
//   · Die Schwerpunkte sind keine vier Kästen im Kasten mehr, sondern vier Zeilen an Haarlinien mit einem Haken.
//   · Der Regler trägt feine Marken (Anfang, Viertel, Mitte, Dreiviertel, Ende des Rahmens) mit ihren Werten.
//   · Die Zahlen des Honorarblatts blenden über (ein Hauch Weg, kein Rollen über die ganze Höhe, kein Hochzählen).
//   · Die Angaben: Beschriftung über dem Feld, geprüft wird beim Verlassen des Felds mit DERSELBEN Funktion wie auf dem
//     Server (verkaufEingabeLesen) — der Satz steht am Feld (aria-describedby, aria-invalid). „Fehlt noch“ trägt eine blaue
//     Linie, „falsch“ eine rote; beim Absenden springt der Fokus ins erste Feld mit Hinweis. Die Anrede sind echte Radios.
//     Über den Angaben steht die eigene Wahl (Schwerpunkte und Kapitalrahmen) — aus den Wörtern, die schon da sind.
//   · Überschriften: die Schritte sind Überschriften (h3, auf der eigenen Seite h2), keine Absätze.
//   · Die Ansage für Screenreader wartet, bis der Regler ruht (650 ms) — der Regler selbst sagt seinen Wert.
//   · Die Schwelle „ab 1 Mio. US-Dollar persönlich in Miami“ ist ein ruhiger Zustand des Blatts, keine Sperre.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import {
  VERKAUF_TEXTE, VERKAUF_RAHMEN, VERKAUF_INTERESSEN, VERKAUF_LAENDER, VERKAUF_PREISE,
  verkaufStopps, verkaufPreis, verkaufEur, verkaufUsd, verkaufWeg, verkaufStoppNahe, verkaufUsdAusPaket, verkaufEingabeLesen,
  type VerkaufInteresse, type VerkaufLand, type VerkaufSprache,
} from "@shared/fiaon-global-verkauf";
import { useVerkaufSicht, verkaufTag, verkaufKurs } from "@/lib/verkauf";
import { ruhigGewuenscht, useEinmalSichtbar } from "@/components/site/global/bewegung";
import { sauber as W } from "@/components/site/global/VerkaufSatz";
import { werbeEreignis, kampagne } from "@/lib/werbung";
import "@/styles/global-tokens.css";
import "@/styles/global-verkauf.css";

// ── Eine Zahl, deren Ziffern einzeln zum neuen Wert rollen ──────────────────
// Jede Stelle hat ihren festen Platz (von rechts gezählt). Ändert sich ein Zeichen, gleitet das alte hinaus und das neue
// herein — steigt der Wert, von unten nach oben, sinkt er, von oben nach unten. Was gleich bleibt, steht still. Wird die
// Zahl länger oder kürzer, erscheint sie als Ganzes neu (die Plätze verschieben sich ohnehin). Nur Anzeige (aria-hidden):
// Wer die Zahl vorgelesen bekommt, hört den Endwert aus dem Text daneben.
interface RollPlatz { z: string; alt: string | null; n: number; hoch: boolean }
interface RollStand { text: string; wert: number; n: number; plaetze: RollPlatz[] }
function RollZahl({ text, wert }: { text: string; wert: number }) {
  const [gemerkt, setGemerkt] = useState<RollStand>(() => ({ text, wert, n: 0, plaetze: Array.from(text).reverse().map((z) => ({ z, alt: null, n: 0, hoch: true })) }));
  let s = gemerkt;
  if (gemerkt.text !== text) {
    const neu = Array.from(text).reverse(); const n = gemerkt.n + 1; const hoch = wert >= gemerkt.wert;
    const gleichLang = neu.length === gemerkt.plaetze.length;
    s = { text, wert, n, plaetze: neu.map((z, p) => { const v = gemerkt.plaetze[p]; return gleichLang && v.z === z ? v : { z, alt: gleichLang ? v.z : null, n, hoch }; }) };
    setGemerkt(s);
  }
  const letzter = s.plaetze.length - 1;
  return (
    <span className="vk-roll" aria-hidden="true">
      {s.plaetze.map((p, i) => (
        <span key={i} className="vk-roll-platz" data-r={p.n ? (p.hoch ? "hoch" : "runter") : undefined} style={p.n ? { ["--s" as string]: String(Math.min(letzter - i, 6)) } : undefined}>
          {p.alt !== null && <span key={`a${p.n}`} className="vk-roll-raus">{p.alt}</span>}
          <span key={`z${p.n}`} className={p.n ? "vk-roll-rein" : undefined}>{p.z}</span>
        </span>
      )).reverse()}
    </span>
  );
}

type Schritt = "wahl" | "kontakt" | "fertig";

// ── Die Angaben: ein Feld, sein Zustand, sein Satz ──────────────────────────
// „fehlt“ = nach dem Absenden leer (blaue Linie, der Satz in der Schriftfarbe) · „falsch“ = ausgefüllt, aber so nicht
// brauchbar (rote Linie, roter Satz). Geprüft wird mit verkaufEingabeLesen — derselben Funktion, mit der der Server die
// Eingabe liest. So steht am Feld wortgleich der Satz, den auch der Server zurückgäbe, und hier wird keiner getippt.
type Eingabefeld = "vorname" | "nachname" | "email" | "telefon";
const EINGABEFELDER: readonly Eingabefeld[] = ["vorname", "nachname", "email", "telefon"];
interface FeldHinweis { art: "fehlt" | "falsch"; text: string }
function feldPruefen(name: Eingabefeld, wert: string, sprache: VerkaufSprache): FeldHinweis | null {
  // Alle anderen Felder tragen einen brauchbaren Platzhalter — fällt die Prüfung durch, liegt es an diesem einen Feld.
  const probe = { sprache, interessen: [VERKAUF_INTERESSEN[0]], usd: VERKAUF_RAHMEN.startUsd, land: VERKAUF_LAENDER[0], vorname: "A", nachname: "A", email: "a@b.de", telefon: "0000000", [name]: wert };
  const r = verkaufEingabeLesen(probe);
  if (r.ok || r.feld !== name) return null;
  return { art: wert.trim() ? "falsch" : "fehlt", text: sprache === "en" ? r.errorEn : r.error };
}

interface Ergebnis { art: "angebot" | "mail" | "anfrage"; titel?: string; text: string; url?: string; knopf?: string }
const Pfeil = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
/**
 * Die feinen Bögen der beiden persönlichen Lagen des Preisblatts („Persönlich in Miami“, ohne Kapital): Kreise um die untere
 * rechte Ecke ihres Feldes, von denen je ein Viertel zu sehen ist. Sie wachsen einmal aus der Ecke (nur transform und opacity,
 * als Übergang — der Endzustand steht auch, wenn das Feld beim Wechsel außerhalb des Bildes lag). Reiner Schmuck (aria-hidden):
 * Sie füllen das Blatt, wo sonst die Zahlen stehen, damit es in jeder Lage gleich hoch und ruhig bleibt.
 */
const Boegen = () => (
  <div className="vk-boegen" aria-hidden="true">
    {[0, 1, 2, 3, 4, 5, 6].map((i) => <i key={i} style={{ ["--i" as string]: String(i) }} />)}
  </div>
);

/**
 * Der Lead über dem Konfigurator (Startseite und /business/start): Der erste Satz steht sofort, der zweite blendet ein,
 * sobald der Server gesagt hat, welcher Weg für diesen Besucher gilt — so steht nie ein Versprechen da, das nicht stimmt,
 * und nichts springt (der Platz ist mit dem Satz des Selbstabschlusses reserviert, unsichtbar bis zur Antwort).
 */
export function VerkaufKonfigLead({ sprache }: { sprache: VerkaufSprache }) {
  const K = VERKAUF_TEXTE[sprache].konfig;
  const { sicht } = useVerkaufSicht();
  return (
    <p className="fg-lead">
      {K.leadA} <span className={`vk-lead-b${sicht.geladen ? " da" : ""}`} aria-hidden={!sicht.geladen}>{W(sicht.geladen && !sicht.an ? K.persoenlich.leadB : K.leadB)}</span>
    </p>
  );
}

export default function VerkaufKonfigurator({ sprache, eigeneSeite = false }: { sprache: VerkaufSprache; eigeneSeite?: boolean }) {
  const T = VERKAUF_TEXTE[sprache]; const K = T.konfig; const en = sprache === "en";
  const { sicht, neu } = useVerkaufSicht();
  const wurzel = useRef<HTMLDivElement>(null);
  const flaeche = useRef<HTMLDivElement>(null);
  const knopf = useRef<HTMLButtonElement>(null);
  useEinmalSichtbar(wurzel, 0, "0px 0px -18% 0px");
  const id = useId();
  // Überschriften-Ebenen: Auf der Startseite steht die Fläche unter einer h2 (Schritte = h3), auf der eigenen Seite unter der h1.
  const H = eigeneSeite ? "h2" : "h3";
  const Hu = eigeneSeite ? "h3" : "h4";

  // Die Rasterpunkte — ein Deckel aus der Einstellung schneidet den Selbstabschluss ab, die Million bleibt der Miami-Fall.
  const stopps = useMemo(() => verkaufStopps().filter((u) => u <= sicht.selbstMaxUsd || u === VERKAUF_RAHMEN.maxUsd), [sicht.selbstMaxUsd]);
  const [interessen, setInteressen] = useState<VerkaufInteresse[]>(["kapital"]);
  const [usd, setUsd] = useState<number>(VERKAUF_RAHMEN.startUsd);
  const [schritt, setSchritt] = useState<Schritt>("wahl");
  // Der Schritt-Übergang: „raus“ = der alte Inhalt gleitet hinaus; n zählt die Übergänge (der erste Auftritt gleitet nicht).
  const [gleiten, setGleiten] = useState({ raus: false, vor: true, n: 0 });
  const [form, setForm] = useState({ anrede: "" as "" | "Herr" | "Frau", vorname: "", nachname: "", email: "", telefon: "", land: "DE" as VerkaufLand, bestand: false, nachricht: "", falle: "" });
  const [laeuft, setLaeuft] = useState(false);
  // Hinweise an den Feldern (fehlt · falsch) und die eine Meldung für alles, was kein Feld ist (Netz, zu viele Versuche).
  const [hinweise, setHinweise] = useState<Partial<Record<Eingabefeld, FeldHinweis>>>({});
  const [fehler, setFehler] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  // Die Leiste am Handy: an, solange die Fläche im Bild steht und der Knopf des Honorarblatts noch nicht erreicht ist.
  const [leiste, setLeiste] = useState(false);
  // Für Screenreader: das Honorar als ein Satz — erst, wenn der Regler ruht.
  const [ansage, setAnsage] = useState("");

  // Alte Links: ?rahmen=250000 oder ?paket=global_kapital stellen den Regler.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const r = Number(q.get("rahmen")); const p = verkaufUsdAusPaket(q.get("paket"));
    const wunsch = Number.isFinite(r) && r > 0 ? r : p;
    if (wunsch) setUsd(verkaufStoppNahe(wunsch));
  }, []);
  useEffect(() => { if (!stopps.includes(usd)) setUsd(stopps.reduce((b, x) => (Math.abs(x - usd) < Math.abs(b - usd) ? x : b), stopps[0])); }, [stopps, usd]);

  const mitKapital = interessen.includes("kapital");
  const index = Math.max(0, stopps.indexOf(usd));
  const preis = verkaufPreis(Math.min(usd, VERKAUF_RAHMEN.maxUsd), sicht.kursUsdJeEur);
  const weg = verkaufWeg({ interessen, usd, land: form.land, bestand: form.bestand });
  const wegVorKontakt = verkaufWeg({ interessen, usd, land: "DE", bestand: false });
  const miami = mitKapital && usd >= VERKAUF_RAHMEN.maxUsd;
  // Welche Lage das Honorarblatt zeigt.
  const lage: "preis" | "miami" | "ohne" = miami ? "miami" : mitKapital ? "preis" : "ohne";

  const umschalten = (k: VerkaufInteresse) => setInteressen((alt) => (alt.includes(k) ? (alt.length > 1 ? alt.filter((x) => x !== k) : alt) : VERKAUF_INTERESSEN.filter((x) => x === k || alt.includes(x))));

  // Ein Feld ändert sich: Steht dort schon ein Hinweis, verschwindet er, sobald die Eingabe passt (nie ein neuer beim Tippen).
  const feld = (name: Eingabefeld | "nachricht" | "falle") => (ev: { target: { value: string } }) => {
    const wert = ev.target.value;
    setForm((f) => ({ ...f, [name]: wert }));
    if (fehler) setFehler(null);
    if (name !== "nachricht" && name !== "falle" && hinweise[name] && !feldPruefen(name, wert, sprache)) setHinweise(({ [name]: _weg, ...rest }) => rest);
  };
  // Ein Feld wird verlassen: geprüft wird, was eingetragen ist. Ein leeres Feld mahnt erst nach dem Absenden.
  const verlassen = (name: Eingabefeld) => () => {
    const wert = form[name];
    if (!wert.trim() && !hinweise[name]) return;
    const h = feldPruefen(name, wert, sprache);
    setHinweise(({ [name]: _alt, ...rest }) => (h ? { ...rest, [name]: h } : rest));
  };

  // Von einem Schritt zum nächsten: erst gleitet der alte Inhalt hinaus (0,23 s), dann kommt der neue. Bei „weniger Bewegung“ sofort.
  const uhr = useRef(0);
  useEffect(() => () => window.clearTimeout(uhr.current), []);
  const zumAnfang = () => wurzel.current?.scrollIntoView({ behavior: ruhigGewuenscht() ? "auto" : "smooth", block: "start" });
  const weiterZu = (ziel: Schritt, vor: boolean, danach?: () => void) => {
    window.clearTimeout(uhr.current);
    const da = () => { setGleiten((g) => ({ raus: false, vor, n: g.n + 1 })); setSchritt(ziel); if (danach) requestAnimationFrame(danach); };
    if (ruhigGewuenscht()) { da(); return; }
    setGleiten((g) => ({ ...g, raus: true, vor }));
    uhr.current = window.setTimeout(da, 230);
  };

  const zuKontakt = () => {
    werbeEreignis("global_beauftragen_klick", { seite: window.location.pathname, ort: "konfigurator", rahmen: usd });
    weiterZu("kontakt", true, () => document.getElementById(`${id}-vorname`)?.focus({ preventScroll: true }));
    // Sauberes Ziel: Die Fläche beginnt unter der Kopfleiste (scroll-margin-top der Fläche), nichts steht halb darunter.
    zumAnfang();
  };

  // Die Leiste (nur in einer Spalte sichtbar, CSS): Fläche im mittleren Band des Bildes UND der Knopf des Blatts weder im Bild
  // noch schon überscrollt. Zwei Beobachter, kein Scroll-Lauscher.
  useEffect(() => {
    const f = flaeche.current; const k = knopf.current;
    if (schritt !== "wahl" || !f || !k || typeof IntersectionObserver === "undefined") { setLeiste(false); return; }
    let imBand = false; let erreicht = false;
    const melden = () => setLeiste(imBand && !erreicht);
    const band = new IntersectionObserver(([e]) => { imBand = e.isIntersecting; melden(); }, { rootMargin: "-40% 0px -25% 0px" });
    const ziel = new IntersectionObserver(([e]) => { erreicht = e.isIntersecting || e.boundingClientRect.top < (e.rootBounds?.top ?? 0); melden(); }, { rootMargin: "0px 0px -88px 0px" });
    band.observe(f); ziel.observe(k);
    return () => { band.disconnect(); ziel.disconnect(); };
  }, [schritt]);

  // Die Ansage: 650 ms, nachdem sich zuletzt etwas geändert hat — einmal, nicht bei jedem Rasterpunkt. Der erste Stand
  // (beim Laden) wird nicht angesagt. Den Kapitalrahmen selbst sagt der Regler (aria-valuetext).
  const ersteAnsage = useRef(true);
  useEffect(() => {
    if (ersteAnsage.current) { ersteAnsage.current = false; return; }
    const text = lage === "preis" ? `${K.blatt.eintragung}: ${verkaufEur(preis.erfolgCents, sprache)} — ${K.blatt.jahr1}: ${verkaufEur(preis.erstesJahrCents, sprache)}`
      : lage === "miami" ? K.wege.miami.titel : K.ohneKapitalBlatt;
    const t = window.setTimeout(() => setAnsage(text), 650);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lage, preis.erfolgCents, preis.erstesJahrCents, sprache]);

  async function absenden(ev: FormEvent) {
    ev.preventDefault();
    if (laeuft) return;
    // Erst die Felder: jedes mit Hinweis bekommt seinen Satz, der Fokus springt ins erste.
    const offen: Partial<Record<Eingabefeld, FeldHinweis>> = {};
    for (const n of EINGABEFELDER) { const h = feldPruefen(n, form[n], sprache); if (h) offen[n] = h; }
    setHinweise(offen);
    const erstes = EINGABEFELDER.find((n) => offen[n]);
    if (erstes) { setFehler(null); document.getElementById(`${id}-${erstes}`)?.focus(); return; }
    setLaeuft(true); setFehler(null);
    const senden = async (siegel: string) => {
      const res = await fetch("/api/fiaon/global/verkauf/start", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ sprache, interessen, usd, land: form.land, bestand: form.bestand, anrede: form.anrede, vorname: form.vorname, nachname: form.nachname, email: form.email, telefon: form.telefon, nachricht: form.nachricht, falle: form.falle, siegel, kampagne: kampagne() }),
      });
      return { status: res.status, d: await res.json().catch(() => ({})) as Record<string, any> };
    };
    try {
      let a = await senden(sicht.siegel);
      // Das Siegel ist abgelaufen (die Seite stand lange offen): ein frisches holen, die Mindestzeit abwarten, noch einmal.
      if (a.status === 409 && a.d?.code === "SIEGEL_ALT") {
        const frisch = await neu();
        await new Promise((r) => setTimeout(r, 4300));
        a = await senden(frisch.siegel);
      }
      if (a.d?.ok) {
        const art = a.d.art as Ergebnis["art"];
        werbeEreignis("global_konfigurator", { art, weg: String(a.d.weg ?? "abschluss"), rahmen: usd });
        // „aus“: Der Weg wäre der Selbstabschluss gewesen, das Angebot kommt aber persönlich (Notschalter, Probebetrieb, Grenze).
        setErgebnis({ art, titel: a.d.titel ?? (a.d.aus ? K.persoenlich.titel : undefined), text: art === "anfrage" ? String(a.d.danke ?? "") : String(a.d.text ?? ""), url: a.d.url, knopf: a.d.knopf });
        // Die Bestätigung steht oben in der Fläche — dorthin, mit dem Fokus (am Handy stand man sonst am Ende des Formulars).
        weiterZu("fertig", true, () => document.getElementById(`${id}-fertig`)?.focus({ preventScroll: true }));
        zumAnfang();
        if (art === "angebot" && a.d.url) window.setTimeout(() => window.location.assign(String(a.d.url)), ruhigGewuenscht() ? 300 : 1700);
      } else {
        const text = a.status === 429 ? K.fehler.zuViel : String(a.d?.error || K.fehler.netz);
        const amFeld = EINGABEFELDER.find((n) => n === a.d?.feld);
        if (amFeld) { setHinweise({ [amFeld]: { art: form[amFeld].trim() ? "falsch" : "fehlt", text } }); document.getElementById(`${id}-${amFeld}`)?.focus(); }
        else setFehler(text);
      }
    } catch {
      setFehler(K.fehler.netz);
    } finally {
      setLaeuft(false);
    }
  }

  const fuellung = stopps.length > 1 ? index / (stopps.length - 1) : 0;
  const abschluss = weg === "abschluss";
  const hinweisWeg = weg !== "abschluss" ? K.wege[weg] : null;
  // Öffnet sich das Angebot gleich nach dem Absenden? Nur im Selbstabschluss UND wenn er für diesen Besucher frei ist.
  const sofort = abschluss && sicht.an;

  // Die große Zahl: Betrag und Einheit getrennt gesetzt (deutsch „150.000“ + „US-$“, englisch „US$“ + „150,000“).
  const ohneEinheit = (u: number) => verkaufUsd(u, sprache).replace(en ? "US$" : " US-$", "");
  const zahlText = miami ? (en ? "1m +" : "1 Mio.") : ohneEinheit(usd);
  const einheit = en ? "US$" : miami ? "US-$ +" : "US-$";
  // Die Marken des Reglers: Anfang, Viertel, Mitte, Dreiviertel und Ende des Rahmens — jede dort, wo ihr Rasterpunkt liegt.
  // Marken, die zu dicht an der nächsten stünden (ein Deckel aus der Einstellung staucht das Raster), fallen weg.
  const marken = useMemo(() => {
    const max = VERKAUF_RAHMEN.maxUsd; const letzter = stopps.length - 1;
    const alle = [VERKAUF_RAHMEN.minUsd, max / 4, max / 2, (max * 3) / 4, max].filter((u) => stopps.includes(u)).map((u) => ({ usd: u, p: letzter > 0 ? stopps.indexOf(u) / letzter : 0 }));
    return alle.filter((m, i) => i === alle.length - 1 || alle[i + 1].p - m.p >= 0.12);
  }, [stopps]);
  /** Ein Betrag des Honorarblatts: sichtbar blendet die Zahl über, vorgelesen wird der Endwert. */
  const betrag = (cents: number) => { const t = verkaufEur(cents, sprache); return <><span className="vk-nur-sr">{t}</span><RollZahl text={t} wert={cents} /></>; };
  const zeileHeute = <div><dt>{K.blatt.heute}<small>{K.blatt.heuteText}</small></dt><dd>{verkaufEur(VERKAUF_PREISE.gruendungCents, sprache)}</dd></div>;
  const zeileJahr2 = <div className="leise"><dt>{K.blatt.jahr2}<small>{K.blatt.jahr2Text}</small></dt><dd>{verkaufEur(VERKAUF_PREISE.jahresCents, sprache)}</dd></div>;
  const knopfText = wegVorKontakt === "abschluss" ? K.weiter : K.wege[wegVorKontakt].knopf;
  const leisteDa = leiste && schritt === "wahl" && !gleiten.raus;
  // Die eigene Wahl über den Angaben — aus den Titeln der Schwerpunkte und dem Kapitalrahmen (kein neuer Wortlaut).
  const wahlZeile = [...VERKAUF_INTERESSEN.filter((k) => interessen.includes(k)).map((k) => K.interessen[k].titel), ...(mitKapital ? [miami ? K.wege.miami.titel : verkaufUsd(usd, sprache)] : [])];

  /** Ein Textfeld der Angaben mit Beschriftung darüber und seinem Hinweis darunter. */
  const eingabe = (name: Eingabefeld, art: "text" | "email" | "tel", auto: string, max: number, taste: "next" | "send") => {
    const h = hinweise[name];
    return (
      <div className={`vk-feld${h ? ` ${h.art}` : ""}`}>
        <label htmlFor={`${id}-${name}`}>{K.form[name]}</label>
        <input id={`${id}-${name}`} type={art} inputMode={art === "text" ? undefined : art} value={form[name]} onChange={feld(name)} onBlur={verlassen(name)}
          autoComplete={auto} enterKeyHint={taste} required maxLength={max} aria-invalid={h ? true : undefined} aria-describedby={h ? `${id}-${name}-hinweis` : undefined} />
        {h && <p className="vk-feld-hinweis" id={`${id}-${name}-hinweis`}>{W(h.text)}</p>}
      </div>
    );
  };

  return (
    <div className={`vk-konfig${eigeneSeite ? " eigen" : ""}`} ref={wurzel} id="konfigurator" data-schritt={schritt}>
      <div className="vk-flaeche" ref={flaeche}>
        {/* ── Links: wählen ─────────────────────────────────────────────── */}
        <div className="vk-wahl" data-gleiten={gleiten.raus ? "raus" : gleiten.n > 0 ? "rein" : undefined} data-vor={gleiten.vor ? "1" : "0"}>
          {schritt === "wahl" && (
            <>
              <div className="vk-block">
                <H className="vk-nr" id={`${id}-s1`}><i aria-hidden="true">1</i>{K.schritt1}</H>
                <p className="vk-sub">{K.schritt1Sub}</p>
                {/* Vier Zeilen an Haarlinien — jede ein Schalter (aria-pressed), mehrere sind möglich, eine bleibt immer gewählt. */}
                <div className="vk-wahlliste" role="group" aria-labelledby={`${id}-s1`}>
                  {VERKAUF_INTERESSEN.map((k, i) => {
                    const an = interessen.includes(k);
                    return (
                      <button key={k} type="button" className={`vk-wahlzeile${an ? " an" : ""}`} aria-pressed={an} onClick={() => umschalten(k)} style={{ ["--i" as string]: String(i) } as CSSProperties}>
                        <span className="vk-wahl-haken" aria-hidden="true"><svg viewBox="0 0 16 16" width="12" height="12"><path d="M3.2 8.4l3 3 6.6-7" pathLength={1} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                        <span className="vk-wahl-text"><b>{K.interessen[k].titel}</b><span>{W(K.interessen[k].zeile)}</span></span>
                        <em>{K.interessen[k].preis}</em>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={`vk-block vk-rahmen${mitKapital ? "" : " aus"}`}>
                <H className="vk-nr"><i aria-hidden="true">2</i>{K.schritt2}</H>
                <p className="vk-sub">{K.schritt2Sub}</p>
                <div className="vk-zahl" aria-hidden="true">
                  <span className="vk-zahl-wert">
                    {en && <span className="vk-zahl-einheit">{einheit}</span>}
                    <RollZahl text={zahlText} wert={usd} />
                    {!en && <span className="vk-zahl-einheit">{einheit}</span>}
                  </span>
                  <span className="vk-zahl-euro">{miami ? <span key="miami">{K.wege.miami.titel}</span> : K.rahmenEuro(verkaufEur(preis.rahmenEurCents, sprache))}</span>
                </div>
                <div className="vk-regler" style={{ ["--f" as string]: String(fuellung) } as CSSProperties}>
                  <input type="range" min={0} max={stopps.length - 1} step={1} value={index} disabled={!mitKapital}
                    aria-label={K.rahmenLabel} aria-valuetext={miami ? K.wege.miami.titel : verkaufUsd(usd, sprache)}
                    onChange={(ev) => setUsd(stopps[Number(ev.target.value)] ?? usd)} />
                  <div className="vk-regler-bild" aria-hidden="true">
                    <span className="vk-regler-fuell" />
                    <span className="vk-regler-schlitten"><i className="vk-regler-daumen" /></span>
                  </div>
                  <div className="vk-skala" aria-hidden="true">
                    {marken.map((m, i) => (
                      <span key={m.usd} className={i === 0 ? "anfang" : i === marken.length - 1 ? "ende" : "mitte"} data-erreicht={m.p <= fuellung ? "1" : undefined} style={{ ["--p" as string]: String(m.p) } as CSSProperties}>
                        <b>{m.usd === VERKAUF_RAHMEN.minUsd ? K.rahmenMin : m.usd === VERKAUF_RAHMEN.maxUsd ? K.rahmenMax : ohneEinheit(m.usd)}</b>
                      </span>
                    ))}
                  </div>
                </div>
                <p className="vk-fein">{W(`${K.rahmenInstitut} ${K.rahmenHinweis}`)}</p>
              </div>
            </>
          )}

          {schritt === "kontakt" && (
            <form className="vk-form" onSubmit={absenden} noValidate aria-busy={laeuft}>
              <H className="vk-nr"><i aria-hidden="true">3</i>{K.form.titel}</H>
              <p className="vk-sub">{W((sofort ? K.form.sub : abschluss ? K.persoenlich.sub : hinweisWeg?.text) ?? "")}</p>
              {/* Die eigene Wahl: Schwerpunkte und Kapitalrahmen — „Zurück“ führt zur Wahl. */}
              <p className="vk-wahl-zeile">
                <span>{wahlZeile.join(" · ")}</span>
                <button type="button" onClick={() => { setFehler(null); weiterZu("wahl", false); }} disabled={laeuft}>{K.zurueck}</button>
              </p>
              <fieldset className="vk-anrede">
                <legend>{K.form.anrede}</legend>
                <div>
                  {(["Herr", "Frau"] as const).map((a) => (
                    <label key={a}>
                      <input type="radio" name={`${id}-anrede`} value={a} checked={form.anrede === a} onChange={() => setForm((f) => ({ ...f, anrede: a }))} />
                      <span>{a === "Herr" ? K.form.herr : K.form.frau}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="vk-felder">
                {eingabe("vorname", "text", "given-name", 80, "next")}
                {eingabe("nachname", "text", "family-name", 80, "next")}
                {eingabe("email", "email", "email", 160, "next")}
                {eingabe("telefon", "tel", "tel", 40, "next")}
                <div className="vk-feld breit">
                  <label htmlFor={`${id}-land`}>{K.form.land}</label>
                  <select id={`${id}-land`} value={form.land} autoComplete="country" onChange={(ev) => setForm((f) => ({ ...f, land: ev.target.value as VerkaufLand }))}>
                    {VERKAUF_LAENDER.map((l) => <option key={l} value={l}>{K.form.laender[l]}</option>)}
                  </select>
                </div>
                <label className="breit vk-haken">
                  <input type="checkbox" checked={form.bestand} onChange={(ev) => setForm((f) => ({ ...f, bestand: ev.target.checked }))} />
                  <span><b>{W(K.form.bestand)}</b><small>{K.form.bestandSub}</small></span>
                </label>
                <div className="vk-feld breit">
                  <label htmlFor={`${id}-nachricht`}>{K.form.nachricht}</label>
                  <textarea id={`${id}-nachricht`} value={form.nachricht} onChange={feld("nachricht")} rows={2} maxLength={1200} placeholder={K.form.nachrichtPlatz} enterKeyHint="enter" />
                </div>
                {/* Honigtopf: kein Mensch sieht dieses Feld. */}
                <input className="vk-falle" tabIndex={-1} autoComplete="off" aria-hidden="true" name="firma_website" value={form.falle} onChange={feld("falle")} />
              </div>
              {fehler && <p className="vk-fehler" role="alert">{W(fehler)}</p>}
              {K.form.vertragssprache && abschluss && <p className="vk-fein">{W(K.form.vertragssprache)}</p>}
              <div className="vk-knoepfe">
                <button type="submit" className="vk-knopf" disabled={laeuft} aria-busy={laeuft}>{laeuft ? (sofort ? K.form.laeuft : K.persoenlich.laeuft) : sofort ? K.form.absenden : abschluss ? K.persoenlich.absenden : K.form.absendenWeg}</button>
                <button type="button" className="vk-knopf leise" onClick={() => { setFehler(null); weiterZu("wahl", false); }} disabled={laeuft}>{K.zurueck}</button>
              </div>
              <p className="vk-fein vk-register">{W(K.form.register)}</p>
              <p className="vk-fein">{K.form.datenschutz} <a href={en ? "/en/privacy" : "/datenschutz"}>{K.form.datenschutzLink}</a></p>
            </form>
          )}

          {schritt === "fertig" && ergebnis && (
            <div className="vk-fertig" role="status">
              <span className="vk-fertig-zeichen" aria-hidden="true"><svg viewBox="0 0 48 48" width="48" height="48"><circle cx="24" cy="24" r="22" pathLength={1} /><path d="M14 24.6l7 7L34.5 17" pathLength={1} /></svg></span>
              <H id={`${id}-fertig`} tabIndex={-1}>{ergebnis.titel ?? (ergebnis.art === "anfrage" ? (hinweisWeg?.titel ?? K.wege.vorhaben.titel) : K.fertig.titel)}</H>
              <p>{W(ergebnis.text)}</p>
              {ergebnis.art === "angebot" && ergebnis.url && <a className="vk-knopf" href={ergebnis.url}>{ergebnis.knopf ?? K.fertig.knopf}<Pfeil /></a>}
            </div>
          )}
        </div>

        {/* ── Rechts: das Honorarblatt — drei Lagen im selben Feld, sichtbar ist die, die gerade gilt ────────────── */}
        <aside className="vk-blatt" aria-labelledby={`${id}-blatt`} data-lage={lage}>
          <H className="vk-blatt-auge" id={`${id}-blatt`}>{K.blatt.titel}</H>
          <p className="vk-blatt-name">{W(T.produkt.kurz)}</p>
          <div className="vk-stapel">
            <div className="vk-lage" data-an={lage === "preis" ? "1" : "0"} aria-hidden={lage !== "preis"}>
              <dl className="vk-zeilen">
                {zeileHeute}
                <div><dt>{K.blatt.eintragung}<small>{K.blatt.eintragungText}</small></dt><dd>{betrag(preis.erfolgCents)}</dd></div>
                <div className="summe"><dt>{K.blatt.jahr1}</dt><dd>{betrag(preis.erstesJahrCents)}</dd></div>
                {zeileJahr2}
              </dl>
              {/* Leitfaden 7.7: Endpreise · Geld-zurück-Garantie in der Kurz-Form mit Namen · S5-C · Fast-Track · Kurs. */}
              <ul className="vk-blatt-liste">
                <li>{W(K.blatt.endpreise)}</li>
                <li>{W(K.blatt.garantie)}</li>
                <li>{W(K.blatt.finanzierung)}</li>
                <li>{W(K.blatt.fastTrack(verkaufEur(VERKAUF_PREISE.fastTrackCents, sprache)))}</li>
                <li>{W(K.blatt.kurs(verkaufKurs(sicht.kursUsdJeEur, en), verkaufTag(sicht.kursDatum, en)))}</li>
              </ul>
            </div>
            <div className="vk-lage vk-lage-miami" data-an={lage === "miami" ? "1" : "0"} aria-hidden={lage !== "miami"}>
              <Boegen />
              <div className="vk-weg"><Hu>{K.wege.miami.titel}</Hu><p>{W(K.wege.miami.text)}</p></div>
            </div>
            <div className="vk-lage vk-lage-ohne" data-an={lage === "ohne" ? "1" : "0"} aria-hidden={lage !== "ohne"}>
              <div>
                <dl className="vk-zeilen">{zeileHeute}{zeileJahr2}</dl>
                <p className="vk-blatt-fein">{W(K.ohneKapitalBlatt)}</p>
                {/* Ohne Finanzierung gibt es kein Erfolgshonorar — hier steht nur der erste Satz („Alle Beträge sind Endpreise.“). */}
                <ul className="vk-blatt-liste"><li>{K.blatt.endpreise.split(/(?<=\.)\s+/)[0]}</li></ul>
              </div>
              <Boegen />
            </div>
          </div>
          {/* Für Screenreader: das Honorar als ein Satz, sobald der Regler ruht. */}
          <p className="vk-nur-sr" aria-live="polite" aria-atomic="true">{ansage}</p>
          {schritt === "wahl" && (
            <button type="button" className="vk-knopf voll" ref={knopf} onClick={zuKontakt}>{knopfText}<Pfeil /></button>
          )}
          {/* Der Fuß hält seinen Platz auch ohne die Frage (ohne Kapital) — so steht der Knopf in jeder Lage an derselben Stelle. */}
          <div className="vk-blatt-fuss">
            {mitKapital && (
              <details className="vk-blatt-frage">
                <summary>{K.angebotFrage.frage}</summary>
                <p>{W(K.angebotFrage.antwort)}</p>
              </details>
            )}
          </div>
        </aside>
      </div>

      {/* ── Die Leiste am Handy: das Honorar läuft mit, ein Tipp führt zu den Angaben ── */}
      <div className={`vk-mobil${leisteDa ? " da" : ""}`} aria-hidden={!leisteDa}>
        <div className={`vk-mobil-text${lage === "miami" ? " allein" : ""}`}>
          <span>{lage === "preis" ? K.blatt.jahr1 : lage === "miami" ? K.wege.miami.titel : K.blatt.heute}</span>
          {lage === "preis" && <b>{betrag(preis.erstesJahrCents)}</b>}
          {lage === "ohne" && <b>{verkaufEur(VERKAUF_PREISE.gruendungCents, sprache)}</b>}
        </div>
        <button type="button" className="vk-knopf" onClick={zuKontakt} tabIndex={leisteDa ? 0 : -1}>{knopfText}<Pfeil /></button>
      </div>
    </div>
  );
}
