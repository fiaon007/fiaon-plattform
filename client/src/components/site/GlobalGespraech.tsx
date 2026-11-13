// ═══════════════════════════════════════════════════════════════════════════
// DAS GESPRÄCH — Kalender für FIAON Global (17.09.2026, E-188)
//
// Justin: „… oder eben gerne auch eine Beratung zuvor buchen." Auf der Seite
// heißt es „Gespräch vereinbaren": dreißig Minuten mit der zuständigen Person,
// echte freie Zeiten aus ihrem Kalender, ohne Login.
//
//   GET  /api/fiaon/global/termine/frei?tage=14  → freie Tage und Uhrzeiten
//   POST /api/fiaon/global/termine               → bucht eine Zeit
//   POST /api/fiaon/global/anfrage               → Rückruf, wenn keine Zeit passt
//
// Sind keine Zeiten gepflegt (Termin-Regel 04.09.: keine Zeiten = keine
// Termine) oder antwortet der Kalender nicht, zeigt die Fläche von selbst das
// Rückruf-Formular — der Besucher steht nie vor einer leeren Wand.
// Der Paketwunsch kommt von der Paket-Tafel („Erst sprechen") und reist mit.
//
// 06.10.2026 (E-293, Bauplan /business 2.7): links eine Visitenkarte statt der
// Punkteliste (Monogramm aus dem Vornamen in einem Navy-Kreis — kein Foto, bis
// Justin ein echtes mit Einwilligung freigibt, nie ein KI-Porträt). Der Kalender
// in zwei Schritten: Schritt 1 zeigt nur Tage und Uhrzeiten (und „Rückruf statt
// Termin“), Schritt 2 gleitet erst nach der Wahl einer Uhrzeit herein — mit
// „Zurück“. Neue Prop `thema` füllt das Thema vor („Persönliches Angebot“).
// Die vier Punkte stehen nur noch auf Unterseiten und Landingpages (`punkte`).
//
// 08.10.2026 (E-309, Justin): „Daniel Stripling, E-Mail, Nummer, Bild — einladend, verdammt hochwertig.“ Steht die
// zuständige Person auf /team, zeigt die Karte ihr echtes Website-Porträt (dasselbe wie auf /team), Rolle, Mail und
// Nummer aus shared/fiaon-visitenkarte.ts; ruhig animiert (Einschweben, Ring, Atmen), prefers-reduced-motion beachtet.
//
// E-476 Scheibe 3 (05.11.2026, Entscheidung 1A): Die Zeiten sind die der Person aus „Gespräche führt“ (Vorgabe Justin) —
// die Karte zeigt sie (Porträt aus /team). Kam der Besucher über seinen persönlichen Link (fiaon.com/g/<code>) oder den
// Danke-Knopf des Meta-Formulars, liefert der Server Name, Firma, Mail und Telefon mit (aus einem HttpOnly-Cookie — der
// Code steht nie in dieser Adresse); die Felder sind dann schon ausgefüllt. Beim Danke-Knopf ist die Anfrage oft noch
// unterwegs („vorlageFolgt“) — dann fragt die Fläche ein paar Sekunden lang nach. Der ARAS-Hinweis ist weg: kein ARAS
// für Leads (Logbuch 03.11.); die Erinnerungen kommen per Mail.
//
// E-510 (13.11.2026): Fehler stehen AM FELD (UX-Prüfung 3.13). Geprüft wird beim Verlassen eines Felds und beim Absenden,
// nie bei jedem Tastendruck. Zwei Zustände: „fehlt noch“ (blaue Linie links, der Satz in Tinte) und „falsch“ (Rot). Beim
// Absenden springt der Fokus ins erste Feld mit Fehler; darüber steht eine kurze Zusammenfassung (role="alert"). Jede
// Meldung sagt, was zu tun ist. Beschriftung und Feld gehören per id zusammen; die Meldung hängt per aria-describedby am
// Feld. Senden zeigt den Zustand am Knopf (aria-busy), der Erfolg ist eine Statusmeldung mit einem Haken, der sich zeichnet.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { useWoerter, useSprache } from "@/i18n/sprache";
import { GLOBAL_GESPRAECH_WOERTER } from "@/i18n/global";
import { globalPaket } from "@shared/fiaon-global";
import { FIAON_FIRMA } from "@shared/fiaon-firma";
import { kampagne, messungsDaten, werbeKonversion } from "@/lib/werbung";
import { visitenkarte, telefonLink } from "@shared/fiaon-visitenkarte";
import { portraitAlt, portraitMitKi, portraitUrl, KI_PORTRAIT_HINWEIS } from "@shared/fiaon-portraits";

type FreierTag = { tag: string; zeiten: string[] };
type Vorlage = { name?: string; firma?: string; email?: string; telefon?: string };
type Frei = {
  ok: boolean; tage?: FreierTag[]; ansprechpartner?: { vorname?: string; kuerzel?: string | null } | null; rueckfall?: boolean;
  /** E-476 Scheibe 3: der persönliche Link — die Angaben des Leads. */
  vorlage?: Vorlage | null; persoenlich?: boolean; vorlageFolgt?: boolean;
  /** E-481 (Mara Business): der WhatsApp-Link zu Mara (mit Anfrage-Kennung, wenn der persönliche Link mitkam). */
  waLink?: string | null;
};

const leer = { name: "", firma: "", email: "", telefon: "", thema: "", wunschzeit: "", falle: "" };

/** Die drei Pflichtfelder und ihre zwei Fehlerarten: „fehlt“ (leer) und „falsch“ (unvollständig). */
type Pflichtfeld = "name" | "email" | "telefon";
type Feldfehler = "fehlt" | "falsch";
const PFLICHT: readonly Pflichtfeld[] = ["name", "email", "telefon"];
/** Meldungen am Feld — jede sagt, was zu tun ist (deutsch und englisch). */
const FELD_WORT = {
  de: {
    fehlt: { name: "Bitte tragen Sie Ihren Namen ein.", email: "Bitte tragen Sie Ihre E-Mail-Adresse ein.", telefon: "Bitte tragen Sie Ihre Telefonnummer ein." },
    falsch: { name: "", email: "Diese E-Mail-Adresse ist nicht vollständig.", telefon: "Diese Telefonnummer ist nicht vollständig." },
    zusammen: (zahl: number) => (zahl === 1 ? "Bitte ergänzen Sie das markierte Feld." : "Bitte ergänzen Sie die markierten Felder."),
  },
  en: {
    fehlt: { name: "Please enter your name.", email: "Please enter your email address.", telefon: "Please enter your telephone number." },
    falsch: { name: "", email: "This email address is incomplete.", telefon: "This telephone number is incomplete." },
    zusammen: (zahl: number) => (zahl === 1 ? "Please complete the marked field." : "Please complete the marked fields."),
  },
} as const;
/** Prüft ein Pflichtfeld: leer → „fehlt“, unvollständig → „falsch“, sonst null. */
function pruefeFeld(k: Pflichtfeld, wert: string): Feldfehler | null {
  const v = wert.trim();
  if (!v) return "fehlt";
  if (k === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return "falsch";
  if (k === "telefon" && v.replace(/\D/g, "").length < 6) return "falsch";
  return null;
}

export default function GlobalGespraech({ paket, thema, punkte = true }: { paket?: string | null; thema?: string | null; punkte?: boolean }) {
  const t = useWoerter(GLOBAL_GESPRAECH_WOERTER);
  const sprache = useSprache();
  const [frei, setFrei] = useState<Frei | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [zeit, setZeit] = useState<string | null>(null);
  const [rueckruf, setRueckruf] = useState(false);
  const [f, setF] = useState(leer);
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState("");
  // Fehler am Feld (E-510) — gesetzt beim Verlassen eines Felds und beim Absenden.
  const [feldFehler, setFeldFehler] = useState<Partial<Record<Pflichtfeld, Feldfehler>>>({});
  // Die Zusammenfassung über den Feldern erscheint erst nach einem Absende-Versuch.
  const [versucht, setVersucht] = useState(false);
  const kennung = useId();
  const felder = useRef<Partial<Record<keyof typeof leer, HTMLInputElement | null>>>({});
  const [fertig, setFertig] = useState<null | { art: "termin" | "anfrage"; wann?: string; wer?: string }>(null);
  const [persoenlich, setPersoenlich] = useState(false);
  const [vorlageFolgt, setVorlageFolgt] = useState(false);
  // E-481: „Lieber schriftlich?“ — die Bestätigung nach „Per E-Mail“.
  const [wegMail, setWegMail] = useState<string | null>(null);

  // E-476 Scheibe 3: Angaben aus dem persönlichen Link übernehmen — nur in leere Felder, nie über Getipptes.
  const vorlageUebernehmen = (v: Vorlage | null | undefined) => {
    if (!v) return;
    setF((alt) => ({
      ...alt,
      name: alt.name.trim() ? alt.name : String(v.name ?? ""),
      firma: alt.firma.trim() ? alt.firma : String(v.firma ?? ""),
      email: alt.email.trim() ? alt.email : String(v.email ?? ""),
      telefon: alt.telefon.trim() ? alt.telefon : String(v.telefon ?? ""),
    }));
    setPersoenlich(true);
  };

  const laden = async () => {
    try {
      const r = await fetch(`/api/fiaon/global/termine/frei?tage=14${sprache === "en" ? "&sprache=en" : ""}`, { credentials: "same-origin" });
      const j: Frei = await r.json();
      const tage = (j.tage || []).filter((x) => x.zeiten?.length);
      setFrei({ ...j, tage });
      setTag((alt) => (alt && tage.some((x) => x.tag === alt) ? alt : tage[0]?.tag ?? null));
      vorlageUebernehmen(j.vorlage);
      setVorlageFolgt(!!j.vorlageFolgt && !j.vorlage);
      return j;
    } catch {
      setFrei({ ok: false, tage: [], rueckfall: true });
      return null;
    }
  };
  useEffect(() => { laden(); }, []);
  // Danke-Knopf des Meta-Formulars: die Anfrage ist noch unterwegs — ein paar Mal nachfragen (höchstens ~15 Sekunden).
  const nachgefragt = useRef(0);
  useEffect(() => {
    if (!vorlageFolgt) return;
    // Nach sechs Versuchen aufgeben: die normale Fläche, ohne „wird geladen“ — die Buchung hängt sich dann per Mail an die Anfrage.
    if (nachgefragt.current >= 6) { setVorlageFolgt(false); return; }
    const t = setTimeout(() => { nachgefragt.current += 1; void laden(); }, 2500);
    return () => clearTimeout(t);
  }, [vorlageFolgt, frei]); // eslint-disable-line react-hooks/exhaustive-deps
  // Der Knopf „Persönliches Angebot besprechen" füllt das Thema vor (überschreibt nichts, was schon getippt ist).
  useEffect(() => { if (thema) setF((alt) => (alt.thema.trim() ? alt : { ...alt, thema })); }, [thema]);
  // Schritt 2 gleitet herein — der Fokus springt ins erste Feld. E-476 Nachbesserung (Gutachten Lead-Sicht, Mangel 12): Über den
  // persönlichen Link ist schon alles ausgefüllt — dann KEIN Fokus (am Handy öffnete er die Tastatur über dem Knopf), sondern
  // der Absende-Knopf rollt in den Blick: Uhrzeit tippen, „vereinbaren“ tippen, fertig.
  const absendeKnopf = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!zeit || rueckruf) return;
    requestAnimationFrame(() => {
      if (persoenlich) absendeKnopf.current?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      else felder.current.name?.focus({ preventScroll: true });
    });
  }, [zeit, rueckruf, persoenlich]);

  const tage = frei?.tage || [];
  const ohneKalender = !!frei && (frei.rueckfall || !frei.ok || tage.length === 0);
  const formularRueckruf = rueckruf || ohneKalender;
  const zeiten = useMemo(() => tage.find((x) => x.tag === tag)?.zeiten || [], [tage, tag]);
  const paketName = paket ? globalPaket(paket)?.[sprache === "en" ? "en" : "de"].name : null;

  const tagText = (iso: string, lang = false) => {
    const d = new Date(iso + "T12:00:00");
    const loc = sprache === "en" ? "en-GB" : "de-DE";
    return lang
      ? d.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" })
      : { kurz: d.toLocaleDateString(loc, { weekday: "short" }).replace(".", ""), datum: d.toLocaleDateString(loc, { day: "2-digit", month: "2-digit" }) };
  };

  const wannKurz = (iso: string, z: string) => {
    const k = tagText(iso) as { kurz: string; datum: string };
    return sprache === "en" ? `${k.kurz} ${k.datum} at ${z}` : `${k.kurz} ${k.datum} um ${z}`;
  };
  const person = frei?.ansprechpartner?.vorname ? frei.ansprechpartner : null;
  // E-309: Steht die zuständige Person auf /team, zeigt die Karte ihr Porträt und ihre Kontakte (shared/fiaon-visitenkarte.ts).
  const karte = visitenkarte(person?.kuerzel);
  const [bildFehlt, setBildFehlt] = useState(false);
  const sp = sprache === "en" ? "en" : "de";

  // E-481 (Mara Business): Er wählt selbst, wie er das Gespräch führt. E-Mail → Justin schreibt ihm (nur mit persönlichem Link,
  // sonst weiß niemand, wer er ist); WhatsApp → der Link öffnet den Chat mit Mara, die Kennung reist im fertigen Satz mit.
  const wegMelden = (weg: "mail" | "whatsapp") => fetch("/api/fiaon/global/gespraechsweg", {
    method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ weg }),
  }).then((r) => r.json()).catch(() => null);
  const mailWaehlen = async () => {
    const j = await wegMelden("mail");
    setWegMail(j?.ok ? t.wegMailFertig(String(j.email || f.email || "")) : t.wegMailOhne);
  };

  const absenden = async (e: FormEvent) => {
    e.preventDefault();
    setFehler("");
    // 19.09.2026: Die Firma ist freiwillig — auch Privatpersonen buchen FIAON Global.
    // E-510: Jedes Pflichtfeld wird geprüft; der Fokus springt ins erste Feld mit Fehler, die Meldung steht am Feld.
    const gefunden: Partial<Record<Pflichtfeld, Feldfehler>> = {};
    for (const k of PFLICHT) { const x = pruefeFeld(k, f[k]); if (x) gefunden[k] = x; }
    setFeldFehler(gefunden);
    const erstes = PFLICHT.find((k) => gefunden[k]);
    if (erstes) { setVersucht(true); felder.current[erstes]?.focus(); return; }
    setVersucht(false);
    setSendet(true);
    try {
      // messung (E-231): fbp/fbc und die Einwilligung — der Server meldet das Gespräch damit selbst an Meta,
      // unter der Kennung, die er als `messRef` zurückgibt. Dieselbe Kennung nimmt der Pixel unten.
      const gemeinsam = { name: f.name.trim(), firma: f.firma.trim(), email: f.email.trim(), telefon: f.telefon.trim(), paket: paket || undefined, sprache, falle: f.falle, kampagne: kampagne(), messung: messungsDaten(), waHinweis: t.waHinweis };
      if (formularRueckruf) {
        const r = await fetch("/api/fiaon/global/anfrage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...gemeinsam, wunschzeit: f.wunschzeit.trim() || undefined, text: f.thema.trim() || undefined }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) { setFehler(j.error || t.fehler); return; }
        setFertig({ art: "anfrage" });
        void werbeKonversion("gespraech", { paket: paket || undefined, id: j.messRef || undefined });
        return;
      }
      if (!tag || !zeit) return;
      // E-476 Scheibe 3: kein ARAS-Hinweis mehr (kein ARAS für Leads). Der persönliche Link reist im Cookie mit (same-origin).
      const r = await fetch("/api/fiaon/global/termine", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...gemeinsam, tag, zeit, thema: f.thema.trim() || undefined }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 409) { setFehler(t.vergeben); setZeit(null); await laden(); return; }
      if (!r.ok || !j.ok) { setFehler(j.error || t.fehler); return; }
      setFertig({ art: "termin", wann: `${tagText(tag, true)}, ${zeit}`, wer: j.ansprechpartner?.vorname || frei?.ansprechpartner?.vorname || "" });
      void werbeKonversion("gespraech", { paket: paket || undefined, id: j.messRef || undefined });
    } catch {
      setFehler(t.fehler);
    } finally {
      setSendet(false);
    }
  };

  const fw = FELD_WORT[sp];
  const fehlerZahl = PFLICHT.filter((k) => feldFehler[k]).length;
  const feld = (k: keyof typeof leer, label: string, typ = "text", auto?: string, letztes = false) => {
    const id = `${kennung}-${k}`;
    // Ist es eines der drei Pflichtfelder? Dann trägt es Prüfung und Meldung.
    const pk: Pflichtfeld | null = k === "name" || k === "email" || k === "telefon" ? k : null;
    const art: Feldfehler | undefined = pk ? feldFehler[pk] : undefined;
    return (
      <div className={`fg-feldgruppe${art ? ` ${art}` : ""}`}>
        <label className="fg-label" htmlFor={id}>{label}</label>
        <input ref={(el) => { felder.current[k] = el; }} id={id} className="fg-feld" type={typ} autoComplete={auto} value={f[k]}
          inputMode={typ === "email" ? "email" : typ === "tel" ? "tel" : undefined} enterKeyHint={letztes ? "send" : "next"}
          autoCapitalize={typ === "email" ? "none" : undefined} spellCheck={typ === "email" || typ === "tel" ? false : undefined}
          aria-required={pk ? true : undefined} aria-invalid={art ? true : undefined} aria-describedby={art ? `${id}-f` : undefined}
          onChange={(e) => {
            const wert = e.target.value;
            setF({ ...f, [k]: wert });
            // Beim Tippen wird nicht geprüft — eine Meldung verschwindet aber, sobald das Feld stimmt.
            if (pk && art && !pruefeFeld(pk, wert)) setFeldFehler((alt) => ({ ...alt, [pk]: undefined }));
          }}
          onBlur={(e) => {
            // Beim Verlassen: Unvollständiges wird gemeldet. Ein leeres Feld erst nach dem Absenden — wer nur durchgeht, wird nicht ermahnt.
            if (!pk) return;
            const x = pruefeFeld(pk, e.target.value);
            setFeldFehler((alt) => ({ ...alt, [pk]: x === "fehlt" ? (alt[pk] ? "fehlt" : undefined) : x ?? undefined }));
          }} />
        {art && pk && <p className="fg-feld-fehler" id={`${id}-f`}>{fw[art][pk]}</p>}
      </div>
    );
  };
  const formular = (
    <div className="fg-form" aria-busy={sendet || undefined}>
      {paketName && <p className="hinweis fg-form-vorab">{t.paketGewaehlt(paketName)}</p>}
      {persoenlich && <p className="hinweis fg-form-vorab">{t.persoenlichPruefen}</p>}
      {/* Zusammenfassung über den Feldern: nur, wenn nach dem Absenden etwas fehlt — oder der Server etwas meldet. */}
      {((versucht && fehlerZahl > 0) || fehler) && <p className="fehler fg-form-meldung" role="alert">{versucht && fehlerZahl > 0 ? fw.zusammen(fehlerZahl) : fehler}</p>}
      <div className="zwei">{feld("name", t.name, "text", "name")}{feld("firma", t.firma, "text", "organization")}</div>
      <div className="zwei">{feld("email", t.email, "email", "email")}{feld("telefon", t.telefon, "tel", "tel")}</div>
      {formularRueckruf && feld("wunschzeit", t.wunschzeit)}
      {feld("thema", t.thema, "text", undefined, true)}
      <input className="fg-falle" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.falle} onChange={(e) => setF({ ...f, falle: e.target.value })} />
      <button ref={absendeKnopf} type="submit" className="fg-knopf voll" disabled={sendet} aria-busy={sendet || undefined}>{sendet ? t.sendet : formularRueckruf ? t.anfragen : tag && zeit ? t.buchen(wannKurz(tag, zeit)) : t.anfragen}</button>
      <p className="hinweis">{t.waHinweis}</p>
      <p className="hinweis">{t.datenschutz}</p>
    </div>
  );

  return (
    <div className="fg-gespraech">
      <div className="fg-gespraech-seite">
        {/* Die Visitenkarte: wer anruft. Mit Porträt, Rolle, Mail und Nummer, wenn die Person auf /team steht (E-309);
            sonst Monogramm und Vorname wie bisher. */}
        {karte ? (
          <div className="fg-visitenkarte mit-bild">
            <span className="fg-visitenkarte-titel">{t.karteTitel}</span>
            <div className="fg-visitenkarte-wer">
              <span className="fg-visitenkarte-bild">
                <span className="innen">
                  {bildFehlt
                    ? <span className="monogramm" aria-hidden="true">{karte.vorname.charAt(0)}</span>
                    : <img src={portraitUrl(karte.kuerzel)} alt={portraitAlt(karte.kuerzel, karte.name, sp)} width={84} height={84} decoding="async" onError={() => setBildFehlt(true)} />}
                </span>
              </span>
              <span className="fg-visitenkarte-name">
                <b>{karte.name}</b>
                <small>{karte.rolle[sp]}</small>
              </span>
            </div>
            {portraitMitKi(karte.kuerzel) && !bildFehlt && <small className="fg-visitenkarte-ki">{KI_PORTRAIT_HINWEIS[sp]}</small>}
            <p>{t.mitPerson(karte.vorname)}</p>
            <div className="fg-visitenkarte-kontakt">
              <a href={`mailto:${karte.email}`} aria-label={t.mailAn(karte.name)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" /></svg>
                <span>{karte.email}</span>
              </a>
              <a href={telefonLink(karte.telefon)} aria-label={t.anrufen(karte.name)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6.6 3.8h2.6l1.4 4-2 1.4a12 12 0 0 0 6.2 6.2l1.4-2 4 1.4v2.6a2 2 0 0 1-2.2 2A16.6 16.6 0 0 1 4.6 6a2 2 0 0 1 2-2.2z" /></svg>
                <span>{karte.telefon}</span>
              </a>
            </div>
          </div>
        ) : (
          <div className="fg-visitenkarte">
            <span className="fg-visitenkarte-titel">{t.karteTitel}</span>
            <div className="fg-visitenkarte-wer">
              <span className="monogramm" aria-hidden="true">{person?.vorname ? person.vorname.charAt(0) : "F"}</span>
              {person?.vorname && <b>{person.vorname}</b>}
            </div>
            <p>{t.mitWemZusatz}</p>
          </div>
        )}
        {punkte && (
          <ul className="fg-punkte">
            {t.punkte.map((p) => <li key={p}><svg className="fg-haken" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="7.25" stroke="currentColor" strokeOpacity=".28" /><path d="M4.8 8.2l2.1 2.1 4.3-4.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>{p}</li>)}
          </ul>
        )}
        {/* E-481 (Mara Business): Telefon ist der Kalender rechts — wer lieber schreibt, wählt E-Mail oder WhatsApp mit Mara. */}
        {frei?.waLink && !fertig && (
          <div className="fg-wege">
            <span>{t.wegeTitel}</span>
            {wegMail ? (
              <p role="status">{wegMail}</p>
            ) : (
              <p>
                {persoenlich && <><button type="button" className="fg-textknopf" onClick={mailWaehlen}>{t.wegMail}</button>{" · "}</>}
                <a className="fg-textknopf" href={frei.waLink} target="_blank" rel="noopener noreferrer" onClick={() => { if (persoenlich) void wegMelden("whatsapp"); }}>{t.wegWhatsapp}</a>
              </p>
            )}
          </div>
        )}
      </div>

      <div className="fg-kal" aria-live="polite">
        {fertig ? (
          <div className="fg-fertig" role="status">
            <svg className="fg-fertig-haken" width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true" focusable="false">
              <circle cx="22" cy="22" r="20.5" pathLength={1} /><path d="M13.5 22.5l5.8 5.8 11.4-12.1" pathLength={1} />
            </svg>
            <h3>{fertig.art === "termin" ? t.fertigTitel : t.anfrageTitel}</h3>
            <p>{fertig.art === "termin" ? t.fertigText(fertig.wann || "", fertig.wer || "") : t.anfrageText}</p>
          </div>
        ) : !frei ? (
          <p className="hinweis">{t.laedt}</p>
        ) : (
          <form onSubmit={absenden} noValidate>
            {formularRueckruf ? (
              <>
                <h3>{t.rueckfallTitel}</h3>
                {ohneKalender && <p className="hinweis oben">{t.rueckfallText}</p>}
                {formular}
              </>
            ) : zeit && tag ? (
              // ── Schritt 2: die Angaben — erst nach der Wahl einer Uhrzeit ──
              <div className="fg-schritt zwei">
                <div className="fg-gewaehlt">
                  <b>{t.gewaehlt(tagText(tag, true) as string, zeit)}</b>
                  <button type="button" className="fg-textknopf" onClick={() => { setZeit(null); setFehler(""); setFeldFehler({}); }}>{t.zurueck}</button>
                </div>
                {formular}
              </div>
            ) : (
              // ── Schritt 1: Tag und Uhrzeit ──
              <div className="fg-schritt eins">
                {(persoenlich || vorlageFolgt) && <p className="hinweis oben">{persoenlich ? t.persoenlich : t.persoenlichLaedt}</p>}
                <h3>{t.tagWaehlen}</h3>
                <div className="fg-tage" role="group" aria-label={t.tagWaehlen}>
                  {tage.map((x) => {
                    const k = tagText(x.tag) as { kurz: string; datum: string };
                    return (
                      <button key={x.tag} type="button" className="fg-tag" aria-pressed={tag === x.tag} onClick={() => { setTag(x.tag); setZeit(null); }}>
                        <small>{k.kurz}</small><b>{k.datum.slice(0, 2)}</b><small className="monat">{k.datum.slice(3, 5)}</small>
                      </button>
                    );
                  })}
                </div>
                <h3 className="zweite">{t.zeitWaehlen}</h3>
                <div className="fg-zeiten" role="group" aria-label={t.zeitWaehlen}>
                  {zeiten.map((z) => <button key={z} type="button" className="fg-zeit" aria-pressed={zeit === z} onClick={() => setZeit(z)}>{z}</button>)}
                </div>
                <p className="hinweis">{t.zeitzone}</p>
              </div>
            )}

            {!ohneKalender && !(zeit && tag && !rueckruf) && (
              <button type="button" className="fg-rueckruf-schalter" onClick={() => { setRueckruf(!rueckruf); setFehler(""); setFeldFehler({}); }}>
                {rueckruf ? t.zurueckKalender : t.rueckrufStatt}
              </button>
            )}
          </form>
        )}
        {!fertig && <p className="fg-kal-direkt">{t.direkt} <a href={`tel:${FIAON_FIRMA.telefonTel}`}>{FIAON_FIRMA.telefon}</a></p>}
      </div>
    </div>
  );
}
