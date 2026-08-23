// ═══════════════════════════════════════════════════════════════════════════
// /agent/tools/paketfinder — Paketfinder (23.08.2026, Plan §4/§11)
//
// Im Gespräch: Situation des Kunden (Ziel, Negativeinträge, Dringlichkeit,
// Budget) → passendes Paket aus dem Katalog (shared/fiaon-pakete.ts, nie Preise
// von Hand), Rate, Laufzeit, meine Provision (Satz aus GET /agent/provision-satz,
// Vorgabe 25 % je bankbestätigter Rate) und drei Sätze fürs Gespräch (Sie-Form).
// Wortregeln: FIAON berät nicht und garantiert nichts – hier steht „passt“,
// „zeigt“, „bereitet vor“.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { AgentShell, api } from "../shared";
import { useOffice } from "../OfficeShell";
import { PAKETE, type Paket } from "@shared/fiaon-pakete";
import "@/styles/office-tools.css";

type Art = "privat" | "business";
type Ziel = "kreditkarte" | "kredit" | "wohnung" | "unternehmen";
type Negativ = "ja" | "nein" | "unklar";
type Dringlich = "ruhig" | "bald" | "sofort";

const euro = (c: number) => (c / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const euro0 = (c: number) => (c / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** Was in den Paketen steckt (Leistungen, keine Preise — die kommen aus dem Katalog). */
const LEISTUNG: Record<string, { kurz: string; punkte: string[] }> = {
  start: { kurz: "Auskunft beschafft und erklärt, Finanzauswertung, Schreiben zum Selbstversand", punkte: ["Bonitätsauskunft beschafft und jeder Eintrag erklärt", "Löschfristen und 100-Tage-Regel je Eintrag", "Finanzauswertung aus dem Kontoauszug", "Schreiben an Gläubiger und Auskunfteien – zum Selbstversand", "Fester Ansprechpartner"] },
  pro: { kurz: "FIAON versendet und verfolgt die Schreiben, Girokonto vorbereitet, Karte ab Schwelle", punkte: ["Alles aus Start", "FIAON versendet die Schreiben und verfolgt Fristen und Antworten", "Girokonto vorbereitet", "Kreditkarte vorbereitet, sobald die Schwelle des Kartenpartners erreicht ist"] },
  ultra: { kurz: "Kreditkarte vorbereitet, Vorrang bei Fristen und Rückfragen", punkte: ["Alles aus Pro", "Kreditkarte vorbereitet", "Vorrang bei Fristen und Rückfragen"] },
  highend: { kurz: "alles aus einer Hand mit direkter Durchwahl", punkte: ["Alles aus Ultra", "Direkte Durchwahl, alles aus einer Hand", "Das Maximum an Begleitung"] },
  business_starter: { kurz: "Auskunft für Unternehmen und Inhaber, Firmenkarte bis 5.000 € Zielrahmen vorbereitet", punkte: ["Bonitätsauskunft für Unternehmen und Inhaber", "Erklärung jedes Eintrags, Löschfristen", "Vorbereitung einer Firmenkarte bis 5.000 € Zielrahmen", "Fester Ansprechpartner"] },
  business_pro: { kurz: "Schreiben versendet und verfolgt, Trennung privat/geschäftlich, Karte bis 25.000 € Zielrahmen", punkte: ["Alles aus Starter", "Schreiben an Gläubiger und Auskunfteien, versendet und verfolgt", "Trennung privat/geschäftlich in der Auskunft", "Kartenvorbereitung bis 25.000 € Zielrahmen"] },
  business_ultra: { kurz: "Mehrkarten-Struktur, Vorrang, Karte bis 75.000 € Zielrahmen", punkte: ["Alles aus Pro", "Mehrkarten-Struktur für Geschäftsführung und Mitarbeiter", "Vorrang bei Fristen und Schreiben", "Kartenvorbereitung bis 75.000 € Zielrahmen"] },
  business_enterprise: { kurz: "eigener Ansprechpartner mit Durchwahl, Strukturen bis 250.000 € Zielrahmen", punkte: ["Alles aus Ultra", "Eigener Ansprechpartner mit direkter Durchwahl", "Reise-, Spesen- und Mitarbeiterkarten", "Strukturen bis 250.000 € Zielrahmen"] },
};
const PRIVAT_STUFEN = ["start", "pro", "ultra", "highend"];
const BUSINESS_STUFEN = ["business_starter", "business_pro", "business_ultra", "business_enterprise"];

interface Vorschlag { paket: Paket; gruende: string[]; budgetHinweis: string | null; alternative: Paket | null; alternativeText: string | null }

function finden(art: Art, ziel: Ziel, negativ: Negativ, dringlich: Dringlich, budgetEuro: number): Vorschlag {
  const stufen = art === "business" ? BUSINESS_STUFEN : PRIVAT_STUFEN;
  const pakete = stufen.map((k) => PAKETE.find((p) => p.key === k)!).filter(Boolean);
  const gruende: string[] = [];
  let stufe = 0;
  if (art === "business") {
    gruende.push("Geschäftskunde – die Business-Pakete enthalten die Auskunft für Unternehmen und Inhaber.");
    if (negativ === "ja") { stufe = Math.max(stufe, 1); gruende.push("Negativeinträge vorhanden – ab Business Pro versendet und verfolgt FIAON die Schreiben."); }
    if (dringlich === "sofort") { stufe = Math.max(stufe, 2); gruende.push("Es eilt – ab Business Ultra hat der Kunde Vorrang bei Fristen und Schreiben."); }
  } else {
    if (ziel === "kreditkarte") { stufe = negativ === "nein" ? 1 : 2; gruende.push(negativ === "nein" ? "Ziel Kreditkarte ohne Negativeinträge – Pro bereitet die Karte vor, sobald die Schwelle erreicht ist." : "Ziel Kreditkarte – ab Ultra ist die Kreditkarte fest Teil des Pakets."); }
    if (ziel === "kredit") { stufe = 2; gruende.push("Ziel Kredit – dafür zählt eine saubere Auskunft und Vorrang bei Fristen (Ultra)."); }
    if (ziel === "wohnung") { stufe = 0; gruende.push("Ziel Wohnung – der Vermieter will die Auskunft sehen; Start beschafft und erklärt sie."); }
    if (ziel === "unternehmen") { stufe = 1; gruende.push("Ziel Selbstständigkeit – Pro mit Girokonto und verfolgten Schreiben; bei einer Firma passt eher Business."); }
    if (negativ === "ja" && stufe < 1) { stufe = 1; gruende.push("Negativeinträge vorhanden – ab Pro versendet und verfolgt FIAON die Schreiben selbst."); }
    if (negativ === "ja" && dringlich === "sofort") { stufe = 3; gruende.push("Negativeinträge und es eilt – High-End: alles aus einer Hand, direkte Durchwahl."); }
    else if (dringlich === "sofort" && stufe < 2) { stufe = 2; gruende.push("Es eilt – ab Ultra hat der Kunde Vorrang bei Fristen und Rückfragen."); }
  }
  const gewollt = pakete[stufe];
  const budgetCents = Math.round(budgetEuro * 100);
  let paket = gewollt; let budgetHinweis: string | null = null; let alternative: Paket | null = null; let alternativeText: string | null = null;
  if (gewollt.preisCents > budgetCents) {
    const leistbar = pakete.filter((p) => p.preisCents <= budgetCents);
    if (leistbar.length > 0) {
      paket = leistbar[leistbar.length - 1];
      budgetHinweis = `${gewollt.label} (${euro(gewollt.preisCents)}) liegt über dem Budget von ${euro0(budgetCents)} – ${paket.label} passt ins Budget.`;
      alternative = gewollt; alternativeText = "Wenn das Budget es doch zulässt";
    } else {
      paket = pakete[0];
      budgetHinweis = `Kein Paket liegt unter ${euro0(budgetCents)} im Monat. ${paket.label} ist der kleinste Einstieg – oder nur die Bonitätsauskunft einmalig.`;
      alternative = PAKETE.find((p) => p.key === "schufa") ?? null; alternativeText = "Ohne Abo";
    }
  } else if (stufe > 0) {
    alternative = pakete[stufe - 1]; alternativeText = "Schmalere Stufe";
  } else if (pakete[1]) {
    alternative = pakete[1]; alternativeText = "Eine Stufe mehr";
  }
  return { paket, gruende, budgetHinweis, alternative, alternativeText };
}

const ZIEL_SATZ: Record<Ziel, string> = {
  kreditkarte: "Ihr Ziel ist die Kreditkarte. FIAON beschafft zuerst Ihre Bonitätsauskunft, erklärt jeden Eintrag und bereitet den Kartenantrag vor, sobald Ihre Bonität die Schwelle des Kartenpartners erreicht. Über die Karte entscheidet am Ende die Bank – FIAON sorgt dafür, dass Ihre Unterlagen stimmen.",
  kredit: "Ihr Ziel ist ein Kredit. Banken schauen zuerst in die Auskunft – FIAON beschafft sie, zeigt, welche Einträge angreifbar sind, und versendet die Schreiben in Ihrem Namen. Je sauberer die Auskunft, desto besser Ihre Ausgangslage beim Gespräch mit der Bank.",
  wohnung: "Ihr Ziel ist die Wohnung. Der Vermieter will Ihre Auskunft sehen – FIAON beschafft sie, erklärt jeden Eintrag und zeigt, was sich vor der Bewerbung noch klären lässt.",
  unternehmen: "Ihr Ziel ist Ihr Unternehmen. FIAON beschafft die Auskunft für Sie als Inhaber und für die Firma, trennt privat und geschäftlich und bereitet die Firmenkarte vor – über Karte und Rahmen entscheidet die Bank.",
};

export default function AgentPaketfinderPage() { return <AgentShell><PaketfinderInnen /></AgentShell>; }

function PaketfinderInnen() {
  const { dunkel, titel } = useOffice();
  useEffect(() => { dunkel(true); titel("Tools · Paketfinder"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [satz, setSatz] = useState(0.25);
  useEffect(() => { api("/agent/provision-satz").then((r) => { if (r.ok && r.json?.satz) setSatz(Number(r.json.satz)); }).catch(() => {}); }, []);
  const [art, setArt] = useState<Art>("privat");
  const [ziel, setZiel] = useState<Ziel | "">("");
  const [negativ, setNegativ] = useState<Negativ | "">("");
  const [dringlich, setDringlich] = useState<Dringlich | "">("");
  const [budget, setBudget] = useState(80);
  const [kopiert, setKopiert] = useState<number | null>(null);

  const fertig = !!(art === "business" ? true : ziel) && !!negativ && !!dringlich;
  const e = useMemo(() => (fertig ? finden(art, art === "business" ? "unternehmen" : (ziel as Ziel), negativ as Negativ, dringlich as Dringlich, budget) : null), [art, ziel, negativ, dringlich, budget, fertig]);
  const provisionRate = e ? Math.round(e.paket.preisCents * satz) : 0;
  const laufzeit = e?.paket.abo ? 12 : 1;
  const saetze = e ? [
    { t: "Einstieg", s: `Nach dem, was Sie mir schildern, passt FIAON ${e.paket.label.replace("FIAON ", "").replace(" (Standard)", "")} zu Ihnen: ${LEISTUNG[e.paket.key]?.kurz ?? ""}. ${e.paket.abo ? `Das sind ${euro(e.paket.preisCents)} im Monat, zwölf Raten – danach entscheiden Sie, ob Sie bleiben.` : `Das sind einmalig ${euro(e.paket.preisCents)}, kein Abo.`}` },
    { t: "Nutzen", s: ZIEL_SATZ[art === "business" ? "unternehmen" : (ziel as Ziel)] },
    { t: "Abschluss", s: e.paket.abo ? "Wenn das für Sie passt, schicke ich Ihnen jetzt die Zahlungsdaten. Mit der ersten Rate ist Ihr Bereich aktiv, und wir buchen direkt Ihr Startgespräch – fünfzehn Minuten, dann weiß Ihre Ansprechpartnerin genau, worum es bei Ihnen geht." : "Wenn das für Sie passt, schicke ich Ihnen jetzt die Zahlungsdaten. Nach dem Eingang beschafft FIAON Ihre Auskunft, und Sie sehen jeden Eintrag erklärt in Ihrem Bereich." },
  ] : [];
  const kopieren = async (i: number, text: string) => { try { await navigator.clipboard.writeText(text); setKopiert(i); setTimeout(() => setKopiert(null), 1800); } catch { /* egal */ } };
  const Opt = <T extends string>({ wert, an, setzen, b, s }: { wert: T; an: T | ""; setzen: (v: T) => void; b: string; s?: string }) => (
    <button type="button" className={`to-option${an === wert ? " an" : ""}`} onClick={() => setzen(wert)}><b>{b}</b>{s && <small>{s}</small>}</button>
  );

  return (
    <div className="to">
      <section className="to-kopf">
        <div>
          <span className="to-pille">Tools · Paketfinder</span>
          <h1>Welches Paket <span className="to-verlauf">passt?</span></h1>
          <p>Vier Fragen aus dem Gespräch – das Werkzeug zeigt das Paket aus dem Katalog, die Rate, deine Provision und drei Sätze, die du dem Kunden sagen kannst.</p>
        </div>
        <Link href="/agent/tools" className="to-zurueck"><ArrowLeft size={15} strokeWidth={1.75} /> Alle Tools</Link>
      </section>

      <div className="to-spalten breit">
        <section className="to-block">
          <div className="to-frage"><b>Wer ist der Kunde?</b>
            <div className="to-optionen zwei">
              <Opt wert="privat" an={art} setzen={setArt} b="Privatkunde" s="Start · Pro · Ultra · High-End" />
              <Opt wert="business" an={art} setzen={setArt} b="Geschäftskunde" s="Business Starter bis Enterprise" />
            </div>
          </div>
          {art === "privat" && (
            <div className="to-frage"><b>Was will der Kunde erreichen?</b>
              <div className="to-optionen">
                <Opt wert="kreditkarte" an={ziel} setzen={setZiel} b="Kreditkarte" s="Karte trotz Vergangenheit" />
                <Opt wert="kredit" an={ziel} setzen={setZiel} b="Kredit" s="Finanzierung, Auto, Umschuldung" />
                <Opt wert="wohnung" an={ziel} setzen={setZiel} b="Wohnung" s="Auskunft für den Vermieter" />
                <Opt wert="unternehmen" an={ziel} setzen={setZiel} b="Selbstständigkeit" s="Gründung, Konto, erste Karte" />
              </div>
            </div>
          )}
          <div className="to-frage"><b>Gibt es Negativeinträge?</b>
            <div className="to-optionen">
              <Opt wert="ja" an={negativ} setzen={setNegativ} b="Ja" s="Mahnung, Inkasso, Titel, Insolvenz" />
              <Opt wert="nein" an={negativ} setzen={setNegativ} b="Nein" s="Nur Score oder Anfragen" />
              <Opt wert="unklar" an={negativ} setzen={setNegativ} b="Weiß er nicht" s="Die Auskunft zeigt es" />
            </div>
          </div>
          <div className="to-frage"><b>Wie dringend ist es?</b>
            <div className="to-optionen">
              <Opt wert="ruhig" an={dringlich} setzen={setDringlich} b="Entspannt" s="Kein Termin im Nacken" />
              <Opt wert="bald" an={dringlich} setzen={setDringlich} b="In den nächsten Wochen" s="Antrag oder Bewerbung geplant" />
              <Opt wert="sofort" an={dringlich} setzen={setDringlich} b="Sofort" s="Frist läuft, Brief liegt da" />
            </div>
          </div>
          <div className="to-frage"><b>Budget im Monat</b>
            <div className="to-regler">
              <div className="to-regler-kopf"><span>Was der Kunde monatlich tragen kann</span><b>{budget} €</b></div>
              <input type="range" min={0} max={260} step={5} value={budget} onChange={(ev) => setBudget(Number(ev.target.value))} aria-label="Budget im Monat" />
            </div>
          </div>
        </section>

        <section className={`to-block${e ? " hervor" : ""}`}>
          {!e ? (
            <>
              <div className="to-block-kopf"><b>Dein Vorschlag</b></div>
              <p className="leise">Beantworte die Fragen links – der Vorschlag erscheint hier, sobald alles gesetzt ist.</p>
            </>
          ) : (
            <div className="to-ergebnis">
              <span className="to-stufe" style={{ background: "#1d4ed8" }}>{e.paket.abo ? "Abo · 12 Raten" : "Einmalig"}</span>
              <h3>{e.paket.label}</h3>
              <p>{LEISTUNG[e.paket.key]?.kurz ? `${LEISTUNG[e.paket.key].kurz}.` : "Bonitätsauskunft beschafft und erklärt, ohne Abo."}</p>
              <div className="to-zahlen">
                <div className="to-zahl"><small>Rate</small><b>{euro(e.paket.preisCents)}</b><span>{e.paket.abo ? "im Monat" : "einmalig"}</span></div>
                <div className="to-zahl"><small>Laufzeit</small><b>{laufzeit}</b><span>{e.paket.abo ? "Raten, dann entscheidet der Kunde" : "Zahlung, kein Abo"}</span></div>
                <div className="to-zahl hervor"><small>Meine Provision</small><b>{euro(provisionRate)}</b><span>je bankbestätigter Rate ({Math.round(satz * 100)} %){e.paket.abo ? ` · ${euro(provisionRate * 12)} über 12 Raten` : ""}</span></div>
              </div>
              {e.budgetHinweis && <p className="leise" style={{ color: "#fde68a" }}>{e.budgetHinweis}</p>}
              <ul className="to-liste">{e.gruende.map((g) => <li key={g}>{g}</li>)}</ul>
              {LEISTUNG[e.paket.key] && (
                <div className="to-frage"><b>Was drin ist</b><ul className="to-liste">{LEISTUNG[e.paket.key].punkte.map((p) => <li key={p}>{p}</li>)}</ul></div>
              )}
              {e.alternative && (
                <p className="leise">{e.alternativeText}: <b style={{ color: "#fff", fontWeight: 500 }}>{e.alternative.label}</b> – {euro(e.alternative.preisCents)}{e.alternative.abo ? " im Monat" : " einmalig"}, deine Provision {euro(Math.round(e.alternative.preisCents * satz))} je Rate.</p>
              )}
            </div>
          )}
        </section>
      </div>

      {e && (
        <section className="to-block leicht">
          <div className="to-block-kopf"><b>Drei Sätze fürs Gespräch</b><small>Kunde wird gesiezt · zum Vorlesen oder Kopieren</small></div>
          {saetze.map((x, i) => (
            <div key={x.t} className="to-satz">
              <small>{x.t}</small>
              <p>{x.s}</p>
              <div className="fuss"><button type="button" className="to-knopf still klein" onClick={() => void kopieren(i, x.s)}>{kopiert === i ? <><Check size={13} /> Kopiert</> : <><Copy size={13} strokeWidth={1.75} /> Kopieren</>}</button></div>
            </div>
          ))}
          <p className="to-fussnote">Preise kommen aus dem Katalog (shared/fiaon-pakete.ts), der Provisionssatz aus den Einstellungen. Über Konto, Karte und Rahmen entscheidet immer die Bank – das sagst du dem Kunden auch so.</p>
        </section>
      )}
    </div>
  );
}
