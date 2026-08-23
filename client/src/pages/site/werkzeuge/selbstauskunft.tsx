// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/selbstauskunft — der Generator für die kostenlose Datenkopie
// (Art. 15 DSGVO; Schweiz: Art. 25 DSG) (23.08.2026)
//
// Der Leser füllt vier Felder aus, bekommt den fertigen Brief an die gewählte
// Auskunftei – kopieren oder drucken – und den Hinweis zur Ausweiskopie.
// Nichts wird gespeichert oder gesendet; der Brief entsteht im Browser.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Hero, Block, Licht, Knopf, Zwischenruf } from "@/components/site/DunkleBuehne";
import "@/styles/ratgeber.css";

const AUSKUNFTEIEN = [
  { key: "schufa", land: "DE", name: "SCHUFA Holding AG", adresse: ["Kormoranweg 5", "65201 Wiesbaden"], recht: "Art. 15 DSGVO" },
  { key: "ksv", land: "AT", name: "KSV1870 Information GmbH", adresse: ["Wagenseilgasse 7", "1120 Wien"], recht: "Art. 15 DSGVO" },
  { key: "crif-at", land: "AT", name: "CRIF GmbH", adresse: ["Rothschildplatz 3", "1020 Wien"], recht: "Art. 15 DSGVO" },
  { key: "crif-ch", land: "CH", name: "CRIF AG", adresse: ["Hagenholzstrasse 81", "8050 Zürich"], recht: "Art. 25 DSG" },
  { key: "intrum-ch", land: "CH", name: "Intrum AG", adresse: ["Eschenstrasse 12", "8603 Schwerzenbach"], recht: "Art. 25 DSG" },
] as const;

export default function Selbstauskunft() {
  const [ask, setAsk] = useState<string>(() => { const l = sessionStorage.getItem("fiaon_land"); return l === "AT" ? "ksv" : l === "CH" ? "crif-ch" : "schufa"; });
  const [f, setF] = useState({ name: "", geburt: "", strasse: "", plzOrt: "", frueher: "" });
  const [kopiert, setKopiert] = useState(false);
  const a = AUSKUNFTEIEN.find((x) => x.key === ask) || AUSKUNFTEIEN[0];
  const heute = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
  const ch = a.land === "CH";

  const brief = useMemo(() => `${f.name || "[Vor- und Nachname]"}
${f.strasse || "[Straße und Hausnummer]"}
${f.plzOrt || "[PLZ Ort]"}

${a.name}
${a.adresse.join("\n")}

${f.plzOrt ? f.plzOrt.replace(/^\d+\s*/, "") : "[Ort]"}, ${heute}

Antrag auf Auskunft und Datenkopie nach ${a.recht}

Sehr geehrte Damen und Herren,

hiermit beantrage ich gemäß ${ch ? "Art. 25 des Schweizer Datenschutzgesetzes (DSG)" : "Art. 15 DSGVO"} Auskunft über alle zu meiner Person gespeicherten Daten sowie eine vollständige Kopie dieser Daten. Bitte teilen Sie mir insbesondere mit:

1. welche personenbezogenen Daten Sie zu mir speichern (einschließlich aller Einträge, Vertragsdaten, Anfragen und Erledigungsvermerke mit Datum und meldender Stelle),
2. ${ch ? "zu welchem Zweck die Daten bearbeitet werden und wie lange sie aufbewahrt werden" : "die Verarbeitungszwecke und die geplante Speicherdauer"},
3. die Empfänger bzw. Kategorien von Empfängern, an die meine Daten übermittelt wurden,
4. die Herkunft der Daten,
5. ${ch ? "die Logik einer allfälligen automatisierten Entscheidung, sofern eine solche erfolgt ist" : "alle Score-Werte der letzten zwölf Monate, die zu mir berechnet oder an Dritte übermittelt wurden, jeweils mit Datum und Empfänger, sowie aussagekräftige Informationen über die dabei verwendete Logik"}.

Zur Identifikation:
Name: ${f.name || "[Name]"}
Geburtsdatum: ${f.geburt || "[TT.MM.JJJJ]"}
Aktuelle Anschrift: ${[f.strasse, f.plzOrt].filter(Boolean).join(", ") || "[Anschrift]"}${f.frueher ? `\nFrühere Anschrift: ${f.frueher}` : ""}

Eine Kopie meines Ausweises liegt bei; nicht erforderliche Angaben habe ich geschwärzt.

Ich bitte um Zusendung der Datenkopie an die oben genannte Anschrift innerhalb der gesetzlichen Frist von ${ch ? "30 Tagen" : "einem Monat"}. Der Antrag ist kostenlos; einer Gebühr widerspreche ich.

Mit freundlichen Grüßen

${f.name || "[Name]"}`, [f, a, heute, ch]);

  const kopieren = async () => { try { await navigator.clipboard.writeText(brief); setKopiert(true); setTimeout(() => setKopiert(false), 2500); } catch { /* egal */ } };
  const drucken = () => {
    const w = window.open("", "_blank", "width=800,height=900"); if (!w) return;
    w.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Antrag auf Datenkopie</title><style>body{font:13.5pt/1.55 Georgia,serif;color:#111;margin:30mm 25mm;white-space:pre-wrap}</style></head><body>${brief.replace(/</g, "&lt;")}</body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  };

  return (
    <Dunkel seite="ratgeber" titel="Selbstauskunft-Generator · kostenlose Datenkopie" beschreibung="Erzeugen Sie in einer Minute den fertigen Brief für Ihre kostenlose Datenkopie nach Art. 15 DSGVO – an SCHUFA, KSV1870, CRIF oder Intrum. Kopieren, drucken, absenden.">
      <Hero bild="/kino/akten.jpg" pille="Werkzeug · kostenlos, ohne Anmeldung" titel={<>Ihre Datenkopie – <span className="dk-verlauf">der fertige Brief.</span></>}
            lead="Vier Angaben, und der Antrag auf die kostenlose Datenkopie steht – mit den Punkten, die Auskunfteien oft weglassen: Score-Werte, Empfänger, Herkunft. Nichts wird gespeichert; der Brief entsteht in Ihrem Browser."
            knoepfe={<><Knopf href="#generator">Brief erstellen</Knopf><Knopf href="/ratgeber/schufa-auskunft-kostenlos-datenkopie" still>So funktioniert die Datenkopie</Knopf></>} />
      <Licht>
        <Block id="generator" pille="Der Generator" titel={<>Ausfüllen, kopieren, <span className="dk-verlauf">absenden.</span></>} mitte>
          <div className="wz-generator">
            <div className="wz-formular">
              <label><span>Auskunftei</span>
                <select value={ask} onChange={(e) => setAsk(e.target.value)}>
                  {AUSKUNFTEIEN.map((x) => <option key={x.key} value={x.key}>{x.name} · {x.land === "DE" ? "Deutschland" : x.land === "AT" ? "Österreich" : "Schweiz"}</option>)}
                </select>
              </label>
              <label><span>Vor- und Nachname</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Max Mustermann" autoComplete="name" /></label>
              <label><span>Geburtsdatum</span><input value={f.geburt} onChange={(e) => setF({ ...f, geburt: e.target.value })} placeholder="14.05.1988" inputMode="numeric" autoComplete="bday" /></label>
              <label><span>Straße und Hausnummer</span><input value={f.strasse} onChange={(e) => setF({ ...f, strasse: e.target.value })} placeholder="Musterstraße 12" autoComplete="street-address" /></label>
              <label><span>PLZ und Ort</span><input value={f.plzOrt} onChange={(e) => setF({ ...f, plzOrt: e.target.value })} placeholder="10115 Berlin" /></label>
              <label><span>Frühere Anschrift (optional, hilft bei der Zuordnung)</span><input value={f.frueher} onChange={(e) => setF({ ...f, frueher: e.target.value })} placeholder="Alte Straße 3, 80331 München" /></label>
              <p className="wz-hinweis">Legen Sie eine Kopie Ihres Ausweises bei (Vorder- und Rückseite). Nicht benötigte Angaben – Augenfarbe, Größe, Zugangsnummer – dürfen Sie schwärzen; Name, Geburtsdatum, Anschrift und Gültigkeit müssen lesbar bleiben.</p>
            </div>
            <div className="wz-brief-wrap">
              <div className="wz-brief">{brief}</div>
              <div className="dk-knoepfe" style={{ justifyContent: "flex-start", marginTop: 16 }}>
                <button type="button" className="dk-knopf" onClick={kopieren}>{kopiert ? "Kopiert" : "Brief kopieren"}</button>
                <button type="button" className="dk-knopf still" onClick={drucken}>Drucken</button>
              </div>
            </div>
          </div>
        </Block>
      </Licht>
      <Zwischenruf text="Sie möchten die Auskunft nicht selbst beantragen und lesen? FIAON beschafft sie, erklärt jeden Eintrag und bereitet die Schreiben vor." knopf="Konto eröffnen" href="/antrag" still={{ knopf: "Ist mein Eintrag angreifbar?", href: "/werkzeuge/eintrag-pruefen" }} />
    </Dunkel>
  );
}
