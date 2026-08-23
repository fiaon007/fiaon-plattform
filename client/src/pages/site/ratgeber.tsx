// ═══════════════════════════════════════════════════════════════════════════
// /ratgeber — der Hub (23.08.2026): Hero auf der dunklen Bühne, darunter der
// helle Leseraum mit Filtern nach Kategorie und den Artikelkarten. Die Daten
// kommen aus /api/fiaon/ratgeber (nur Veröffentlichtes). Hell, schnell, wenig
// 3D — die Ratgeber sind die Arbeitsseiten, nicht die Bühne.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { Dunkel, Hero, Block, Licht, Knopf, Auf, Zwischenruf } from "@/components/site/DunkleBuehne";
import { KATEGORIEN, AUTORIN, type Kategorie } from "@shared/fiaon-ratgeber";
import "@/styles/ratgeber.css";

interface Karte { slug: string; titel: string; teaser: string; kategorie: Kategorie; land: string; lesezeit: number; veroeffentlichtAm: string | null }

const LANDKURZ: Record<string, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz", DACH: "DACH" };
const datum = (s: string | null) => s ? new Date(s).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" }) : "";

export default function Ratgeber() {
  const [liste, setListe] = useState<Karte[] | null>(null);
  const [kat, setKat] = useState<string>(() => new URLSearchParams(window.location.search).get("kategorie") || "");
  useEffect(() => {
    fetch("/api/fiaon/ratgeber").then((r) => r.json()).then((j) => setListe(j?.artikel || [])).catch(() => setListe([]));
  }, []);
  useEffect(() => { document.title = "Ratgeber · Bonität verstehen · FIAON"; }, []);
  const gefiltert = useMemo(() => (liste || []).filter((a) => !kat || a.kategorie === kat), [liste, kat]);
  const vorhandene = useMemo(() => new Set((liste || []).map((a) => a.kategorie)), [liste]);

  return (
    <Dunkel seite="ratgeber" titel="Ratgeber" beschreibung="Bonität verstehen: SCHUFA-Einträge löschen, Auskunft kostenlos anfordern, Kreditkarte trotz Eintrag, KSV und CRIF – geprüft, ehrlich, ohne Versprechen.">
      <Hero
        bild="/kino/akten.jpg"
        pille="Ratgeber · Bonität verstehen"
        titel={<>Wissen, das <span className="dk-verlauf">Einträge bewegt.</span></>}
        lead="Welche Einträge angreifbar sind, wie die kostenlose Auskunft funktioniert, was trotz Eintrag realistisch ist – für Deutschland, Österreich und die Schweiz. Jeder Text wird gegen Gesetz, Verhaltensregeln der Auskunfteien und die Praxis aus FIAON-Akten geprüft."
        knoepfe={<><Knopf href="#artikel">Artikel lesen</Knopf><Knopf href="/antrag" still>Auskunft beschaffen lassen</Knopf></>}
      />

      <Licht>
        <Block id="artikel" pille="Alle Themen" titel={<>Ehrlich erklärt. <span className="dk-verlauf">Nichts versprochen.</span></>}
               lead="Wählen Sie ein Thema – oder lesen Sie von oben. Neue Texte erscheinen laufend." mitte>
          <div className="rg-filter" role="tablist">
            <button type="button" data-an={kat === "" ? "1" : undefined} onClick={() => setKat("")}>Alle</button>
            {(Object.keys(KATEGORIEN) as Kategorie[]).filter((k) => vorhandene.has(k)).map((k) => (
              <button key={k} type="button" data-an={kat === k ? "1" : undefined} onClick={() => setKat(k)}>{KATEGORIEN[k].label}</button>
            ))}
          </div>
          <div className="rg-liste" style={{ textAlign: "left" }}>
            {liste === null && <p className="rg-leer">Ratgeber werden geladen …</p>}
            {liste !== null && gefiltert.length === 0 && <p className="rg-leer">In dieser Kategorie ist noch kein Text erschienen – bald.</p>}
            {gefiltert.map((a, i) => (
              <Auf key={a.slug} verzoegerung={Math.min(i, 6) * 60}>
                <a href={`/ratgeber/${a.slug}`} className={`rg-karte${i === 0 && !kat ? " gross" : ""}`}>
                  <div className="rg-karte-text" style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
                    <div className="rg-kopfzeile"><span>{KATEGORIEN[a.kategorie]?.label || a.kategorie}</span><span className="land">{LANDKURZ[a.land] || a.land}</span></div>
                    <h3>{a.titel}</h3>
                    <p>{a.teaser}</p>
                    <div className="rg-karte-fuss"><span>{datum(a.veroeffentlichtAm)} · {a.lesezeit} Min. Lesezeit</span><b>Lesen →</b></div>
                  </div>
                </a>
              </Auf>
            ))}
          </div>
        </Block>

        <Block pille="Wer schreibt" mitte>
          <div className="rg-autorin" style={{ maxWidth: 760, margin: "0 auto", textAlign: "left" }}>
            <img src={AUTORIN.bild} alt={AUTORIN.name} />
            <div><small>{AUTORIN.rolle}</small><b>{AUTORIN.name}</b><p>{AUTORIN.lang}</p></div>
          </div>
        </Block>
      </Licht>

      <Zwischenruf text="Lesen hilft. Handeln hilft mehr: FIAON beschafft Ihre Auskunft, erklärt jeden Eintrag und bereitet die Schreiben vor." knopf="Konto eröffnen" href="/antrag" still={{ knopf: "Was ist FIAON", href: "/was-ist-fiaon" }} />
    </Dunkel>
  );
}
