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
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useWoerter, useSprache } from "@/i18n/sprache";
import { GLOBAL_GESPRAECH_WOERTER } from "@/i18n/global";
import { globalPaket } from "@shared/fiaon-global";
import { FIAON_FIRMA } from "@shared/fiaon-firma";
import { kampagne, messungsDaten, werbeKonversion } from "@/lib/werbung";
import { visitenkarte, telefonLink } from "@shared/fiaon-visitenkarte";
import { portraitAlt, portraitMitKi, portraitUrl, KI_PORTRAIT_HINWEIS } from "@shared/fiaon-portraits";

type FreierTag = { tag: string; zeiten: string[] };
type Frei = { ok: boolean; tage?: FreierTag[]; ansprechpartner?: { vorname?: string; kuerzel?: string | null } | null; rueckfall?: boolean };

const leer = { name: "", firma: "", email: "", telefon: "", thema: "", wunschzeit: "", falle: "" };

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
  const [fertig, setFertig] = useState<null | { art: "termin" | "anfrage"; wann?: string; wer?: string }>(null);

  const laden = async () => {
    try {
      const r = await fetch("/api/fiaon/global/termine/frei?tage=14");
      const j: Frei = await r.json();
      const tage = (j.tage || []).filter((x) => x.zeiten?.length);
      setFrei({ ...j, tage });
      setTag((alt) => (alt && tage.some((x) => x.tag === alt) ? alt : tage[0]?.tag ?? null));
    } catch {
      setFrei({ ok: false, tage: [], rueckfall: true });
    }
  };
  useEffect(() => { laden(); }, []);
  // Der Knopf „Persönliches Angebot besprechen" füllt das Thema vor (überschreibt nichts, was schon getippt ist).
  useEffect(() => { if (thema) setF((alt) => (alt.thema.trim() ? alt : { ...alt, thema })); }, [thema]);
  // Schritt 2 gleitet herein — der Fokus springt ins erste Feld.
  const erstesFeld = useRef<HTMLInputElement>(null);
  useEffect(() => { if (zeit && !rueckruf) requestAnimationFrame(() => erstesFeld.current?.focus({ preventScroll: true })); }, [zeit, rueckruf]);

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

  const absenden = async (e: FormEvent) => {
    e.preventDefault();
    setFehler("");
    // 19.09.2026: Die Firma ist freiwillig — auch Privatpersonen buchen FIAON Global.
    if (!f.name.trim() || !f.email.trim() || !f.telefon.trim()) { setFehler(t.pflicht); return; }
    setSendet(true);
    try {
      // messung (E-231): fbp/fbc und die Einwilligung — der Server meldet das Gespräch damit selbst an Meta,
      // unter der Kennung, die er als `messRef` zurückgibt. Dieselbe Kennung nimmt der Pixel unten.
      const gemeinsam = { name: f.name.trim(), firma: f.firma.trim(), email: f.email.trim(), telefon: f.telefon.trim(), paket: paket || undefined, sprache, falle: f.falle, kampagne: kampagne(), messung: messungsDaten() };
      if (formularRueckruf) {
        const r = await fetch("/api/fiaon/global/anfrage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...gemeinsam, wunschzeit: f.wunschzeit.trim() || undefined, text: f.thema.trim() || undefined }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) { setFehler(j.error || t.fehler); return; }
        setFertig({ art: "anfrage" });
        void werbeKonversion("gespraech", { paket: paket || undefined, id: j.messRef || undefined });
        return;
      }
      if (!tag || !zeit) return;
      const r = await fetch("/api/fiaon/global/termine", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...gemeinsam, tag, zeit, thema: f.thema.trim() || undefined }) });
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

  const feld = (k: keyof typeof leer, label: string, typ = "text", auto?: string) => (
    <label>
      <span className="fg-label">{label}</span>
      <input ref={k === "name" ? erstesFeld : undefined} className="fg-feld" type={typ} autoComplete={auto} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </label>
  );
  const formular = (
    <div className="fg-form">
      {paketName && <p className="hinweis" style={{ margin: 0 }}>{t.paketGewaehlt(paketName)}</p>}
      <div className="zwei">{feld("name", t.name, "text", "name")}{feld("firma", t.firma, "text", "organization")}</div>
      <div className="zwei">{feld("email", t.email, "email", "email")}{feld("telefon", t.telefon, "tel", "tel")}</div>
      {formularRueckruf && feld("wunschzeit", t.wunschzeit)}
      {feld("thema", t.thema)}
      <input className="fg-falle" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.falle} onChange={(e) => setF({ ...f, falle: e.target.value })} />
      {fehler && <p className="fehler" role="alert">{fehler}</p>}
      <button type="submit" className="fg-knopf voll" disabled={sendet}>{sendet ? t.sendet : formularRueckruf ? t.anfragen : tag && zeit ? t.buchen(wannKurz(tag, zeit)) : t.anfragen}</button>
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
      </div>

      <div className="fg-kal" aria-live="polite">
        {fertig ? (
          <div className="fg-fertig">
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
                {ohneKalender && <p className="hinweis" style={{ marginTop: 0 }}>{t.rueckfallText}</p>}
                {formular}
              </>
            ) : zeit && tag ? (
              // ── Schritt 2: die Angaben — erst nach der Wahl einer Uhrzeit ──
              <div className="fg-schritt zwei">
                <div className="fg-gewaehlt">
                  <b>{t.gewaehlt(tagText(tag, true) as string, zeit)}</b>
                  <button type="button" className="fg-textknopf" onClick={() => { setZeit(null); setFehler(""); }}>{t.zurueck}</button>
                </div>
                {formular}
              </div>
            ) : (
              // ── Schritt 1: Tag und Uhrzeit ──
              <div className="fg-schritt eins">
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
                <h3 style={{ marginTop: 22 }}>{t.zeitWaehlen}</h3>
                <div className="fg-zeiten" role="group" aria-label={t.zeitWaehlen}>
                  {zeiten.map((z) => <button key={z} type="button" className="fg-zeit" aria-pressed={zeit === z} onClick={() => setZeit(z)}>{z}</button>)}
                </div>
                <p className="hinweis">{t.zeitzone}</p>
              </div>
            )}

            {!ohneKalender && !(zeit && tag && !rueckruf) && (
              <button type="button" className="fg-rueckruf-schalter" onClick={() => { setRueckruf(!rueckruf); setFehler(""); }}>
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
