// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/eintrag-pruefen · /en/tools/check-my-entry — „Ist mein Eintrag
// angreifbar?" (23.08.2026, zweisprachig 02.09.2026)
//
// Fünf Fragen, eine ehrliche Einschätzung: hoch / mittel / gering / keine
// Aussicht — mit Begründung nach § 31 BDSG, den Löschfristen und dem BGH-
// Urteil zur Restschuldbefreiung. Die Logik wählt einen Ergebnis-Schlüssel,
// die Texte liegen in client/src/i18n/wz-eintrag-pruefen.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Hero, Block, Licht, Knopf, Zwischenruf } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { WZ_EINTRAG_PRUEFEN_WOERTER } from "@/i18n/wz-eintrag-pruefen";
import "@/styles/ratgeber.css";

type Land = "DE" | "AT" | "CH";
const AUSKUNFTEI: Record<Land, string> = { DE: "SCHUFA", AT: "KSV1870 / CRIF", CH: "CRIF / Intrum" };
type Stufe = "hoch" | "mittel" | "gering" | "keine";
const WENN: Record<string, (a: Record<string, string>) => boolean> = {
  mahnung: (a) => a.art === "offen" || a.art === "bezahlt",
  bestritten: (a) => a.art === "offen" || a.art === "bezahlt",
  tituliert: (a) => a.art === "offen" || a.art === "bezahlt",
  wann: (a) => a.art === "bezahlt",
  seit: (a) => a.art === "insolvenz",
};

function einschaetzung(a: Record<string, string>): { stufe: Stufe; key: string; artikel: string } {
  const loeschen = "/schufa-eintrag-loeschen", karte = "/kreditkarte";
  if (a.art === "falsch") return { stufe: "hoch", key: "falsch", artikel: loeschen };
  if (a.art === "insolvenz") return a.seit === "ueber6" ? { stufe: "hoch", key: "insolvenzUeber6", artikel: loeschen } : { stufe: "gering", key: "insolvenzUnter6", artikel: loeschen };
  if (a.tituliert === "ja") {
    if (a.art === "bezahlt" && a.wann === "ueber3") return { stufe: "hoch", key: "titBezahltAlt", artikel: loeschen };
    return a.art === "bezahlt" ? { stufe: "gering", key: "titBezahlt", artikel: karte } : { stufe: "keine", key: "titOffen", artikel: karte };
  }
  if (a.bestritten === "ja") return { stufe: "hoch", key: "bestritten", artikel: loeschen };
  if (a.mahnung === "keine" || a.mahnung === "eine") return { stufe: "hoch", key: "keineMahnung", artikel: loeschen };
  if (a.art === "bezahlt") {
    if (a.wann === "ueber3") return { stufe: "hoch", key: "bezahltAlt", artikel: loeschen };
    if (a.wann === "schnell") return { stufe: "mittel", key: "bezahltSchnell", artikel: loeschen };
    if (a.mahnung === "unklar") return { stufe: "mittel", key: "bezahltUnklar", artikel: loeschen };
    return { stufe: "gering", key: "bezahltRegulaer", artikel: karte };
  }
  return a.mahnung === "unklar" ? { stufe: "mittel", key: "offenUnklar", artikel: loeschen } : { stufe: "keine", key: "offenBerechtigt", artikel: karte };
}

const FARBE: Record<Stufe, string> = { hoch: "#059669", mittel: "#2563eb", gering: "#d97706", keine: "#64748b" };

export default function EintragPruefen() {
  const t = useWoerter(WZ_EINTRAG_PRUEFEN_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/tools/check-my-entry" : "/werkzeuge/eintrag-pruefen";

  const [land, setLand] = useState<Land>(() => (sessionStorage.getItem("fiaon_land") as Land) || "DE");
  const [a, setA] = useState<Record<string, string>>({});
  const fragen = useMemo(() => t.fragen.filter((f) => !WENN[f.key] || WENN[f.key](a)), [a, t]);
  const fertig = fragen.every((f) => a[f.key]);
  const ergebnis = useMemo(() => (fertig ? einschaetzung(a) : null), [a, fertig]);
  const text = ergebnis ? t.ergebnisse[ergebnis.key] : null;
  const setzen = (k: string, v: string) => setA((x) => { const n = { ...x, [k]: v }; if (k === "art") return { art: v }; return n; });

  return (
    <Dunkel seite="ratgeber" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten pfad={pfad} titel={t.metaTitel} beschreibung={t.metaBeschreibung} />
      <Hero bild="/kino/akten.jpg" pille={t.pille} titel={<>{t.h1a}<span className="dk-verlauf">{t.h1b}</span></>}
            lead={t.lead}
            knoepfe={<><Knopf href="#pruefer">{t.starten}</Knopf><Knopf href={zu("/ratgeber")} still>{t.zumRatgeber}</Knopf></>} />
      <Licht>
        <Block id="pruefer" pille={t.blockPille} titel={<>{t.blockA}<span className="dk-verlauf">{t.blockB}</span></>} mitte>
          <div className="rg-filter" style={{ marginTop: 30 }}>
            {(["DE", "AT", "CH"] as Land[]).map((l) => <button key={l} type="button" data-an={land === l ? "1" : undefined} onClick={() => setLand(l)}>{t.laender[l]}</button>)}
          </div>
          <div className="wz-fragen">
            {fragen.map((f, i) => (
              <div key={f.key} className="wz-frage">
                <p className="wz-nr">{t.frageVon(i + 1, fragen.length)}</p>
                <h3>{f.frage}</h3>
                {f.hinweis && <p className="wz-hinweis">{f.hinweis}</p>}
                <div className="wz-optionen">
                  {f.optionen.map((o) => (
                    <button key={o.wert} type="button" className={`wz-option${a[f.key] === o.wert ? " an" : ""}`} onClick={() => setzen(f.key, o.wert)}>
                      <b>{o.label}</b>{o.text && <span>{o.text}</span>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {ergebnis && text && (
            <div className="wz-ergebnis" style={{ borderColor: FARBE[ergebnis.stufe] }}>
              <span className="wz-stufe" style={{ background: FARBE[ergebnis.stufe] }}>{t.stufen[ergebnis.stufe]}</span>
              <h3>{text.titel}</h3>
              <p>{text.text}</p>
              <div className="wz-schritt"><small>{t.naechsterSchritt}</small><p>{text.schritt(AUSKUNFTEI[land])}</p></div>
              <div className="dk-knoepfe" style={{ justifyContent: "flex-start", marginTop: 18 }}>
                <Knopf href="/antrag">{t.fiaonUebernimmt}</Knopf>
                <Knopf href={zu(ergebnis.artikel)} still>{t.nachlesen}</Knopf>
              </div>
              <p className="rg-hinweis">{t.hinweis}</p>
            </div>
          )}
        </Block>
      </Licht>
      <Zwischenruf text={t.zwischenruf} knopf={t.kontoEroeffnen} href="/antrag" still={{ knopf: t.generator, href: zu("/werkzeuge/selbstauskunft") }} />
    </Dunkel>
  );
}
