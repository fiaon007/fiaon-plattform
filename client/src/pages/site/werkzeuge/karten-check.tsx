// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/karten-check · /en/tools/card-check — Karten-Check
// (23.08.2026, zweisprachig 03.09.2026)
//
// Fünf Angaben → ehrliche Einschätzung, welcher Kartenweg heute realistisch
// ist. Keine Zusage, keine Bank-Entscheidung — eine Einordnung. Nichts wird
// gespeichert. Texte: client/src/i18n/wz-karten-check.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { WZ_KARTEN_CHECK_WOERTER } from "@/i18n/wz-karten-check";
import "@/styles/ratgeber.css";

const FARBE: Record<string, string> = { konto: "#b45309", prepaid: "#b45309", klein: "#1d4ed8", rahmen: "#047857" };

function einschaetzung(a: Record<string, string>, anzahl: number): string | null {
  if (Object.keys(a).length < anzahl) return null;
  let punkte = 0;
  punkte += { u1200: 0, "1200": 1, "2000": 2, "3500": 3 }[a.einkommen] ?? 0;
  punkte += { fest: 2, befristet: 1, selbst: 1, sonst: 0 }[a.art] ?? 0;
  punkte += { keine: 3, erledigt: 1, offen: -2, weiss: 0 }[a.eintraege] ?? 0;
  punkte += { sauber: 2, dispo: 0, rueck: -2, keins: -1 }[a.konto] ?? 0;
  punkte += { kredit: 1, debit: 0, prepaid: 0, gekuendigt: -1 }[a.karte] ?? 0;
  if (a.konto === "keins") return "konto";
  if (a.eintraege === "offen" || punkte <= 2) return "prepaid";
  if (punkte <= 6) return "klein";
  return "rahmen";
}

export default function KartenCheck() {
  const t = useWoerter(WZ_KARTEN_CHECK_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/tools/card-check" : "/werkzeuge/karten-check";
  const [a, setA] = useState<Record<string, string>>({});
  const key = useMemo(() => einschaetzung(a, t.fragen.length), [a, t]);
  const e = key ? t.ergebnisse[key] : null;
  return (
    <Dunkel seite="ratgeber" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten pfad={pfad} titel={t.metaTitel} beschreibung={t.metaBeschreibung} />
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/karte.jpg" alt="" decoding="async" /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">{t.pille}</span>
          <h1 className="dk-h1">{t.h1a}<span className="dk-verlauf">{t.h1b}</span></h1>
          <p className="dk-lead">{t.lead}</p>
        </div>
      </section>
      <Licht>
        <Block schmal>
          <div className="wz-fragen">
            {t.fragen.map((f, i) => (
              <div key={f.key} className="wz-frage">
                <p className="wz-nr">{t.frageVon(i + 1, t.fragen.length)}</p><h3>{f.frage}</h3>
                <div className="wz-optionen zwei">{f.optionen.map(([w, l]) => <button key={w} type="button" className={`wz-option${a[f.key] === w ? " an" : ""}`} onClick={() => setA({ ...a, [f.key]: w })}><b>{l}</b></button>)}</div>
              </div>
            ))}
          </div>
          {e && key && (
            <div className="wz-ergebnis" style={{ borderColor: FARBE[key] }}>
              <span className="wz-stufe" style={{ background: FARBE[key] }}>{e.stufe}</span>
              <h3>{e.titel}</h3><p>{e.text}</p>
              <div className="wz-schritt"><small>{t.naechsterSchritt}</small><p>{e.schritt}</p></div>
              <div className="wz-knoepfe"><Knopf href={zu(e.link)}>{e.linkText}</Knopf><Knopf href="/antrag" still>{t.fiaonUebernimmt}</Knopf></div>
            </div>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>{t.fuss}</p>
        </Block>
      </Licht>
      <Zwischenruf text={<><b>{t.zwischenrufFett}</b>{t.zwischenruf}</>} knopf={t.zwischenrufKnopf} href="/antrag" />
    </Dunkel>
  );
}
