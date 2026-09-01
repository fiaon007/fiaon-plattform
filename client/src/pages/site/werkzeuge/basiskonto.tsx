// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/basiskonto — Basiskonto-Helfer: Frist, Ablehnung, BaFin-Antrag
// (02.09.2026, E-080)
//
// Jede kontoführende Bank in Deutschland muss Verbrauchern auf Antrag ein
// Basiskonto eröffnen (§ 31 ZKG) – unabhängig von Einträgen bei Auskunfteien.
// Sie hat dafür zehn Geschäftstage ab vollständigem Antrag (§ 33 Abs. 3 ZKG);
// eine Ablehnung muss schriftlich begründet werden (§ 34 ZKG). Wird abgelehnt
// oder verschleppt, gibt es das kostenlose Verwaltungsverfahren bei der BaFin
// (§ 48 ZKG): Sie prüft und ordnet die Eröffnung an, wenn die Ablehnung
// unrechtmäßig war.
//
// Das Werkzeug rechnet die Zehn-Tage-Frist ab Antragsdatum, erklärt die
// zulässigen Ablehnungsgründe (§§ 35, 36 ZKG) und erzeugt die Erinnerung an
// die Bank sowie die Checkliste für den BaFin-Antrag.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import "@/styles/ratgeber.css";

const fmt = (d: Date) => d.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
const parse = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T12:00:00") : null);
const heuteText = () => new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });

/** Zehn Geschäftstage (Montag–Freitag, bundesweite Feiertage ausgenommen) nach dem Antragstag. */
function geschaeftstage(start: Date, n: number): Date {
  const d = new Date(start); let z = 0;
  const fest = (x: Date) => { const j = x.getFullYear(); const iso = x.toISOString().slice(0, 10); return [`${j}-01-01`, `${j}-05-01`, `${j}-10-03`, `${j}-12-25`, `${j}-12-26`].includes(iso); };
  while (z < n) { d.setDate(d.getDate() + 1); const wt = d.getDay(); if (wt !== 0 && wt !== 6 && !fest(d)) z++; }
  return d;
}

type Lage = "warte" | "abgelehnt" | "";
const FRAGEN = [
  { f: "Wer hat Anspruch auf ein Basiskonto?", a: "Jeder Verbraucher mit rechtmäßigem Aufenthalt in der EU – auch ohne festen Wohnsitz, auch mit negativen Einträgen bei SCHUFA oder anderen Auskunfteien, auch in der Insolvenz (§ 31 ZKG). Die Bonität ist kein Ablehnungsgrund. Das Konto wird auf Guthabenbasis geführt; ein Dispo gehört nicht dazu." },
  { f: "Welche Bank muss das Konto eröffnen?", a: "Jede Bank, die Zahlungskonten für Verbraucher anbietet – Sparkassen, Volksbanken, Privatbanken, Direktbanken. Sie dürfen sich das Basiskonto nicht gegenseitig zuschieben. Sie können sich die Bank aussuchen; sinnvoll ist eine, bei der Sie später auch Karte und Überweisungen bequem nutzen." },
  { f: "Was darf die Bank verlangen und was kosten darf es?", a: "Ausweis oder Pass, bei fehlender Meldeadresse eine Erreichbarkeitsanschrift. Das Entgelt muss angemessen sein und sich an marktüblichen Kontoführungsentgelten orientieren (§ 41 ZKG); der BGH hat überhöhte Basiskonto-Gebühren mehrfach gekippt (u. a. XI ZR 119/19 vom 30.06.2020). Vergleichen Sie – die Gebühren unterscheiden sich erheblich." },
  { f: "Aus welchen Gründen darf die Bank ablehnen?", a: "Nur aus den im Gesetz genannten: Sie führen bereits ein Zahlungskonto in Deutschland, das Sie nutzen können; Sie wurden in den letzten drei Jahren wegen einer vorsätzlichen Straftat gegen die Bank verurteilt; Sie haben ein früheres Konto bei dieser Bank durch schwere Vertragsverletzung verloren; oder es liegen Verstöße gegen das Geldwäschegesetz vor (§§ 35, 36 ZKG). Ein SCHUFA-Eintrag steht nicht in dieser Liste." },
  { f: "Was macht die BaFin im Verwaltungsverfahren?", a: "Sie prüft, ob die Ablehnung oder die Verzögerung rechtmäßig war, und ordnet gegenüber der Bank die Eröffnung des Kontos an, wenn nicht (§ 48 ZKG). Das Verfahren ist kostenlos, der Antrag geht per Formular oder online an die BaFin in Bonn. Beizulegen sind Ihr Antrag bei der Bank und – falls vorhanden – die schriftliche Ablehnung." },
];

export default function Basiskonto() {
  const [lage, setLage] = useState<Lage>("");
  const [antrag, setAntrag] = useState("");
  const [bank, setBank] = useState("");
  const [name, setName] = useState("");
  const [kopiert, setKopiert] = useState(false);
  const a = parse(antrag);
  const heute = useMemo(() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; }, []);
  const frist = useMemo(() => (a ? geschaeftstage(a, 10) : null), [a]);
  const ueberfaellig = frist ? frist < heute : false;

  const erinnerung = useMemo(() => `${name || "[Vor- und Nachname]"}
[Anschrift]

${bank || "[Bank]"}
[Anschrift der Filiale]

${heuteText()}

Antrag auf Abschluss eines Basiskontovertrags vom ${a ? a.toLocaleDateString("de-DE") : "[Datum]"} – Erinnerung

Sehr geehrte Damen und Herren,

am ${a ? a.toLocaleDateString("de-DE") : "[Datum]"} habe ich bei Ihnen einen Antrag auf Abschluss eines Basiskontovertrags nach § 31 ZKG gestellt. Nach § 33 Abs. 3 ZKG sind Sie verpflichtet, mir innerhalb von zehn Geschäftstagen nach Eingang des vollständigen Antrags den Abschluss anzubieten oder den Antrag schriftlich und begründet abzulehnen (§ 34 ZKG). Diese Frist ist am ${frist ? frist.toLocaleDateString("de-DE") : "[Datum]"} abgelaufen; eine Antwort habe ich nicht erhalten.

Ich fordere Sie auf, mir bis zum ${(() => { const d = new Date(heute); d.setDate(d.getDate() + 5); return d.toLocaleDateString("de-DE"); })()} den Basiskontovertrag anzubieten. Andernfalls werde ich bei der Bundesanstalt für Finanzdienstleistungsaufsicht ein Verwaltungsverfahren nach § 48 ZKG beantragen.

Mit freundlichen Grüßen

${name || "[Vor- und Nachname]"}`, [name, bank, a, frist, heute]);

  const kopieren = async () => { try { await navigator.clipboard.writeText(erinnerung); setKopiert(true); setTimeout(() => setKopiert(false), 2500); } catch { /* egal */ } };

  return (
    <Dunkel seite="ratgeber" titel="Basiskonto-Helfer · Frist, Ablehnung, BaFin-Antrag" beschreibung="Basiskonto beantragt und keine Antwort – oder abgelehnt? Der Helfer rechnet die Zehn-Tage-Frist, nennt die zulässigen Ablehnungsgründe und erzeugt Erinnerung und BaFin-Checkliste. Kostenlos.">
      <SeoDaten pfad="/werkzeuge/basiskonto" titel="Basiskonto abgelehnt oder keine Antwort? Der Helfer" beschreibung="Basiskonto beantragt? Der Helfer rechnet die Zehn-Geschäftstage-Frist (§ 33 ZKG), nennt die zulässigen Ablehnungsgründe und erzeugt Erinnerung und BaFin-Checkliste (§ 48 ZKG)." fragen={FRAGEN} werkzeug={{ name: "Basiskonto-Helfer" }} krumen={[{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Basiskonto-Helfer", pfad: "/werkzeuge/basiskonto" }]} />
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/hero.jpg" alt="" decoding="async" /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Werkzeug · kostenlos, ohne Anmeldung</span>
          <h1 className="dk-h1">Das Konto, das Ihnen <span className="dk-verlauf">zusteht.</span></h1>
          <p className="dk-lead">Zehn Geschäftstage hat die Bank. Ein SCHUFA-Eintrag ist kein Ablehnungsgrund. Der Helfer rechnet die Frist, prüft die Begründung der Bank und bereitet die Erinnerung und den Antrag bei der BaFin vor.</p>
        </div>
      </section>
      <Licht>
        <Block schmal>
          <div className="wz-fragen">
            <div className="wz-frage">
              <p className="wz-nr">Schritt 1</p><h3>Wo stehen Sie?</h3>
              <div className="wz-optionen zwei">
                <button type="button" className={`wz-option${lage === "warte" ? " an" : ""}`} onClick={() => setLage("warte")}><b>Antrag gestellt, keine Antwort</b><small>Die Bank meldet sich nicht oder vertröstet.</small></button>
                <button type="button" className={`wz-option${lage === "abgelehnt" ? " an" : ""}`} onClick={() => setLage("abgelehnt")}><b>Antrag abgelehnt</b><small>Mündlich, per Brief oder „wegen der SCHUFA“.</small></button>
              </div>
            </div>
            {lage === "warte" && (
              <div className="wz-frage">
                <p className="wz-nr">Schritt 2</p><h3>Wann haben Sie den Antrag gestellt?</h3>
                <p className="wz-hinweis">Der Tag, an dem Ihr Antrag vollständig bei der Bank war – mit Ausweis. Lassen Sie sich den Eingang immer quittieren oder stellen Sie den Antrag schriftlich.</p>
                <div className="wz-felder drei">
                  <label><span>Antrag gestellt am</span><input type="date" value={antrag} onChange={(ev) => setAntrag(ev.target.value)} /></label>
                  <label><span>Bank</span><input value={bank} onChange={(ev) => setBank(ev.target.value)} placeholder="z. B. Sparkasse Musterstadt" /></label>
                  <label><span>Ihr Name</span><input value={name} onChange={(ev) => setName(ev.target.value)} /></label>
                </div>
              </div>
            )}
          </div>
          {lage === "warte" && frist && (
            <div className={`wz-ergebnis${ueberfaellig ? " alarm" : " gut"}`}>
              <span className="wz-stufe" style={{ background: ueberfaellig ? "#b91c1c" : "#047857" }}>{ueberfaellig ? "Frist abgelaufen" : "Frist läuft"}</span>
              <h3>Die Bank muss bis {fmt(frist)} antworten.</h3>
              <p>Zehn Geschäftstage ab vollständigem Antrag (§ 33 Abs. 3 ZKG) – Wochenenden und bundesweite Feiertage nicht mitgerechnet. Bis dahin muss sie Ihnen den Vertrag anbieten oder schriftlich und mit Begründung ablehnen (§ 34 ZKG). {ueberfaellig ? "Die Frist ist verstrichen: Erinnern Sie schriftlich mit kurzer Nachfrist – und kündigen Sie das BaFin-Verfahren an. Das Schreiben steht unten." : "Warten Sie die Frist ab; heben Sie den Nachweis über den Antragstag auf."}</p>
              {ueberfaellig && (
                <div className="wz-brief-wrap" style={{ marginTop: 22 }}><div className="wz-brief">{erinnerung}</div>
                  <div className="wz-knoepfe">
                    <button type="button" className="dk-knopf" onClick={kopieren}>{kopiert ? "Kopiert" : "Erinnerung kopieren"}</button>
                    <Knopf href="https://www.bafin.de/DE/verbraucherinnen-verbraucher/themen-finanzprodukte/konten-zahlungen/konten/basiskonto/basiskonto_node.html" still>BaFin: Verwaltungsverfahren</Knopf>
                  </div>
                </div>
              )}
            </div>
          )}
          {lage === "abgelehnt" && (
            <div className="wz-ergebnis">
              <span className="wz-stufe" style={{ background: "#1d4ed8" }}>Prüfen Sie die Begründung</span>
              <h3>Nur vier Gründe erlauben eine Ablehnung – ein Eintrag bei einer Auskunftei gehört nicht dazu.</h3>
              <p>Zulässig sind allein (§§ 35, 36 ZKG): Sie nutzen bereits ein Zahlungskonto in Deutschland; eine Verurteilung wegen einer vorsätzlichen Straftat gegen die Bank in den letzten drei Jahren; ein früheres Konto bei dieser Bank wurde wegen schwerer Vertragsverletzung gekündigt; Verstöße gegen Geldwäscheregeln. Alles andere – „SCHUFA“, „Bonität“, „wir eröffnen keine Basiskonten“, „nur für Bestandskunden“ – ist unzulässig.</p>
              <div className="wz-schritt"><small>1 · Schriftliche Ablehnung verlangen</small><p>Die Bank muss die Ablehnung schriftlich begründen und auf das Verwaltungsverfahren hinweisen (§ 34 ZKG). Eine mündliche Absage am Schalter ist keine Ablehnung – bitten Sie um das Schreiben.</p></div>
              <div className="wz-schritt"><small>2 · Antrag bei der BaFin (§ 48 ZKG)</small><p>Formular „Antrag auf Durchführung eines Verwaltungsverfahrens“ – online oder per Post an die Bundesanstalt für Finanzdienstleistungsaufsicht, Referat VBS 12, Graurheindorfer Straße 108, 53117 Bonn. Beilegen: Kopie Ihres Antrags bei der Bank, Kopie der Ablehnung (falls vorhanden), Ausweiskopie. Kostenlos. Die BaFin prüft und ordnet die Eröffnung an, wenn die Ablehnung unrechtmäßig war.</p></div>
              <div className="wz-schritt"><small>3 · Parallel eine zweite Bank</small><p>Sie müssen nicht warten: Stellen Sie den Antrag bei einer weiteren Bank – schriftlich, mit Eingangsquittung. Oft ist das schneller als das Verfahren. Achten Sie auf die Kontoführungsgebühr; sie muss angemessen sein (§ 41 ZKG).</p></div>
              <div className="wz-knoepfe">
                <Knopf href="https://www.bafin.de/DE/verbraucherinnen-verbraucher/themen-finanzprodukte/konten-zahlungen/konten/basiskonto/basiskonto_node.html" still>Zum BaFin-Formular</Knopf>
                <Knopf href="/girokonto-trotz-negativer-bonitaet" still>Basiskonto oder FIAON-Weg?</Knopf>
              </div>
            </div>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>Grundlage: §§ 31, 33, 34, 35, 36, 41, 48 ZKG (Zahlungskontengesetz); BGH XI ZR 119/19. Geschäftstage ohne Landesfeiertage gerechnet. Das Werkzeug ersetzt keine Rechtsberatung. Nichts wird gespeichert.</p>
        </Block>
      </Licht>
      <Block schmal titel="Häufige Fragen"><Fragen items={FRAGEN} /></Block>
      <Zwischenruf text={<><b>Das Basiskonto ist der Anfang, nicht das Ziel.</b> FIAON bereitet mit Ihnen das Konto vor, das später Karte und Finanzierung trägt – und bringt die Auskunft in Ordnung, die die Bank sieht.</>} knopf="Den FIAON-Weg ansehen" href="/girokonto-trotz-negativer-bonitaet" still={{ knopf: "Antrag stellen", href: "/antrag" }} />
    </Dunkel>
  );
}
