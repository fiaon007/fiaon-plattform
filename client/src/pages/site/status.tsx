// ═══════════════════════════════════════════════════════════════════════════
// /status · /en/status — Verfügbarkeit und Sicherheit, live (02.09.2026,
// E-083; zweisprachig 02.09.2026, Texte: client/src/i18n/status.ts)
//
// Was die Seite zeigt: ob die Plattform gerade antwortet (GET /healthz, derselbe
// Pfad, den Render für das unterbrechungsfreie Umschalten nutzt), wo die
// Daten liegen, wie sie geschützt sind, und die Regeln für Wartung. Keine
// Marketingzahlen — nur, was sich prüfen lässt. Bekannte Störungen trägt der
// Betreiber im Wörterbuch (stoerungen, beide Sprachen) ein; leer heißt: keine bekannt.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { Dunkel, Hero, Block, Licht, Knopf, Glas, Kennzahlen, Zeilen, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache, inSprache } from "@/i18n/sprache";
import { STATUS_WOERTER } from "@/i18n/status";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

export default function Status() {
  const t = useWoerter(STATUS_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const zu = (p: string) => inSprache(p, sprache);
  const pfad = en ? "/en/status" : "/status";
  const [zustand, setZustand] = useState<"prueft" | "ok" | "gestoert">("prueft");
  const [ms, setMs] = useState<number | null>(null);
  const [zeit, setZeit] = useState<string>("");
  useEffect(() => {
    const t0 = performance.now();
    fetch("/healthz", { cache: "no-store" }).then((r) => { setMs(Math.round(performance.now() - t0)); setZustand(r.ok ? "ok" : "gestoert"); }).catch(() => setZustand("gestoert"));
    setZeit(new Date().toLocaleString(en ? "en-GB" : "de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }));
  }, [en]);

  return (
    <Dunkel seite="ratgeber" titel={t.metaTitel} beschreibung={t.metaBeschreibung}>
      <SeoDaten pfad={pfad} titel={t.seoTitel} beschreibung={t.seoBeschreibung} fragen={t.fragen} krumen={[{ name: t.krume, pfad }]} />
      <Hero
        bild="/kino/datenraum.jpg"
        pille={t.pille}
        titel={<>{t.h1a}<span className="dk-verlauf">{t.h1b}</span></>}
        lead={t.lead}
        knoepfe={<><Knopf href="#sicherheit">{t.datenstandort}</Knopf><Knopf href={zu("/sicherheit")} still>{t.sicherheitDetail}</Knopf></>}
      />

      <Block eng>
        <Glas ruhig>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 999, background: zustand === "ok" ? "#22c55e" : zustand === "gestoert" ? "#ef4444" : "#94a3b8", boxShadow: zustand === "ok" ? "0 0 18px rgba(34,197,94,.6)" : "none" }} />
            <h3 className="dk-h3" style={{ margin: 0 }}>{zustand === "prueft" ? t.prueft : zustand === "ok" ? t.ok : t.gestoert}</h3>
          </div>
          <p className="dk-leise" style={{ marginTop: 8 }}>{zustand === "ok" && ms !== null ? t.antwortIn(ms, zeit) : zustand === "gestoert" ? t.geprueftGestoert(zeit) : t.fragtAb}</p>
        </Glas>
      </Block>

      <Licht>
        <Block id="sicherheit" schmal titel={<>{t.schutzA}<span className="dk-verlauf">{t.schutzB}</span></>} lead={t.schutzLead}>
          <Zeilen items={t.zeilen} />
        </Block>

        <Block schmal titel={<>{t.stoerungenA}<span className="dk-verlauf">{t.stoerungenB}</span></>} lead={t.stoerungenLead}>
          {t.stoerungen.length === 0 ? <p className="dk-text">{t.keine}</p> : (
            <div className="sx-zeitleiste">
              {t.stoerungen.map((s, i) => (
                <div key={s.datum + i} className="sx-etappe">
                  <div className="spur"><span className="punkt">!</span>{i < t.stoerungen.length - 1 && <span className="faden" />}</div>
                  <div className="inhalt"><span className="dauer">{s.datum} · {s.dauer}</span><h3>{s.titel}</h3><p>{s.text}</p></div>
                </div>
              ))}
            </div>
          )}
        </Block>

        <Block eng>
          <Kennzahlen items={t.kennzahlen} />
        </Block>

        <Block schmal titel={t.fragenTitel}><Fragen items={t.fragen} /></Block>
      </Licht>
    </Dunkel>
  );
}
