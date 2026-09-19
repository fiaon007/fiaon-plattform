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
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useWoerter, useSprache } from "@/i18n/sprache";
import { GLOBAL_GESPRAECH_WOERTER } from "@/i18n/global";
import { globalPaket } from "@shared/fiaon-global";
import { FIAON_FIRMA } from "@shared/fiaon-firma";
import { kampagne, werbeKonversion } from "@/lib/werbung";

type FreierTag = { tag: string; zeiten: string[] };
type Frei = { ok: boolean; tage?: FreierTag[]; ansprechpartner?: { vorname?: string } | null; rueckfall?: boolean };

const leer = { name: "", firma: "", email: "", telefon: "", thema: "", wunschzeit: "", falle: "" };

export default function GlobalGespraech({ paket }: { paket?: string | null }) {
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

  const absenden = async (e: FormEvent) => {
    e.preventDefault();
    setFehler("");
    // 19.09.2026: Die Firma ist freiwillig — auch Privatpersonen buchen FIAON Global.
    if (!f.name.trim() || !f.email.trim() || !f.telefon.trim()) { setFehler(t.pflicht); return; }
    setSendet(true);
    try {
      const gemeinsam = { name: f.name.trim(), firma: f.firma.trim(), email: f.email.trim(), telefon: f.telefon.trim(), paket: paket || undefined, sprache, falle: f.falle, kampagne: kampagne() };
      if (formularRueckruf) {
        const r = await fetch("/api/fiaon/global/anfrage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...gemeinsam, wunschzeit: f.wunschzeit.trim() || undefined, text: f.thema.trim() || undefined }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) { setFehler(j.error || t.fehler); return; }
        setFertig({ art: "anfrage" });
        void werbeKonversion("gespraech", { paket: paket || undefined });
        return;
      }
      if (!tag || !zeit) return;
      const r = await fetch("/api/fiaon/global/termine", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...gemeinsam, tag, zeit, thema: f.thema.trim() || undefined }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 409) { setFehler(t.vergeben); setZeit(null); await laden(); return; }
      if (!r.ok || !j.ok) { setFehler(j.error || t.fehler); return; }
      setFertig({ art: "termin", wann: `${tagText(tag, true)}, ${zeit}`, wer: j.ansprechpartner?.vorname || frei?.ansprechpartner?.vorname || "" });
      void werbeKonversion("gespraech", { paket: paket || undefined });
    } catch {
      setFehler(t.fehler);
    } finally {
      setSendet(false);
    }
  };

  const feld = (k: keyof typeof leer, label: string, typ = "text", auto?: string) => (
    <label>
      <span className="fg-label">{label}</span>
      <input className="fg-feld" type={typ} autoComplete={auto} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </label>
  );

  return (
    <div className="fg-gespraech">
      <ul className="fg-punkte">
        {t.punkte.map((p) => <li key={p}><svg className="fg-haken" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="7.25" stroke="currentColor" strokeOpacity=".28" /><path d="M4.8 8.2l2.1 2.1 4.3-4.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>{p}</li>)}
      </ul>

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
              </>
            ) : (
              <>
                {person && (
                  <div className="fg-kal-person">
                    <span aria-hidden="true">{person.vorname!.charAt(0)}</span>
                    <p><b>{t.mitWem(person.vorname!)}</b>{t.mitWemZusatz}</p>
                  </div>
                )}
                <h3>{t.tagWaehlen}</h3>
                <div className="fg-tage" role="group" aria-label={t.tagWaehlen}>
                  {tage.map((x) => {
                    const k = tagText(x.tag) as { kurz: string; datum: string };
                    return (
                      <button key={x.tag} type="button" className="fg-tag" aria-pressed={tag === x.tag} onClick={() => { setTag(x.tag); setZeit(null); }}>
                        <small>{k.kurz}</small><b>{k.datum}</b>
                      </button>
                    );
                  })}
                </div>
                <h3 style={{ marginTop: 26 }}>{t.zeitWaehlen}</h3>
                <div className="fg-zeiten" role="group" aria-label={t.zeitWaehlen}>
                  {zeiten.map((z) => <button key={z} type="button" className="fg-zeit" aria-pressed={zeit === z} onClick={() => setZeit(z)}>{z}</button>)}
                </div>
                <p className="hinweis">{t.zeitzone}</p>
                {tag && zeit && <p className="fg-gewaehlt"><b>{t.gewaehlt(tagText(tag, true) as string, zeit)}</b></p>}
              </>
            )}

            {(formularRueckruf || (tag && zeit)) && (
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
            )}

            {!ohneKalender && (
              <button type="button" className="hinweis" style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }} onClick={() => { setRueckruf(!rueckruf); setFehler(""); }}>
                {rueckruf ? t.zurueckKalender : t.lieberRueckruf}
              </button>
            )}
          </form>
        )}
        {!fertig && <p className="fg-kal-direkt">{t.direkt} <a href={`tel:${FIAON_FIRMA.telefonTel}`}>{FIAON_FIRMA.telefon}</a></p>}
      </div>
    </div>
  );
}
