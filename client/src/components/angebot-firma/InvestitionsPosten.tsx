// ═══════════════════════════════════════════════════════════════════════════
// „UNSERE VEREINBARUNG“ (E-301; bis Runde 2 „Ihre Investition“)
//
// Runde 3 (Justin 08.10.2026): „wichtig, aber kompakter, da zusätzlich noch der
// Vertrag gelesen werden muss“ und „Mach das Kapital präsenter, die Kosten für die
// LLC nicht so hervorstehend“. Darum:
//   1. Zuerst „Was Sie bekommen“ — 250.000 USD, die US-Gesellschaft, das Team
//      (investition.bekommen), die erste Zahl in Gold.
//   2. Dann „Die Konditionen“ als ruhige Zeilen: Titel · Betrag · ein Satz. Was /
//      Wann / Warum / Wie klappen je Zeile auf; beim Wachstumsbudget dazu die
//      Aufstellung, bei der Umsatzbeteiligung der Rechner.
//   3. Die Gründungskosten als EINE leise Zeile am Ende (posten.satz), ihre
//      Bestandteile nur aufklappbar — keine große Karte mehr.
// Alle Texte kommen aus den Daten; hart stehen nur Bedienbeschriftungen (WORTE).
// Zugeklappte Teile sind „inert“ (nicht per Tastatur erreichbar).
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import type { FirmaSeite } from "@shared/fiaon-global-angebot-firma-typen";
import { Auf, Mehr } from "./gemeinsam";
import BudgetAufstellung from "./BudgetAufstellung";
import UmsatzRechner from "./UmsatzRechner";

const FRAGEN: { k: "was" | "wann" | "warum" | "wie"; wort: string }[] = [
  { k: "was", wort: "Was" }, { k: "wann", wort: "Wann" }, { k: "warum", wort: "Warum" }, { k: "wie", wort: "Wie" },
];
const WORTE = { details: "Was · Wann · Warum · Wie", zu: "Schließen", bestandteile: "Woraus sie bestehen", weniger: "Weniger" };

export default function InvestitionsPosten({ inv }: { inv: FirmaSeite["investition"] }) {
  const [offen, setOffen] = useState<Record<string, boolean>>({});
  const zeilen = inv.posten.filter((p) => p.schluessel !== "gruendung");
  const gruendung = inv.posten.find((p) => p.schluessel === "gruendung");
  return (
    <>
      <Auf className="gaf-bekommen" >
        <p className="gaf-auge gaf-auge-gold">{inv.bekommen.titel}</p>
        <ul className="gaf-bekommen-liste" data-fiaon="firma-bekommen">
          {inv.bekommen.punkte.map((b, i) => (
            <li key={b.wert} className={i === 0 ? "erste" : undefined}>
              <span className="gaf-bekommen-wert">{b.wert}</span>
              <span className="gaf-bekommen-text">{b.text}</span>
            </li>
          ))}
        </ul>
      </Auf>

      <p className="gaf-auge gaf-konditionen-titel">{inv.konditionenTitel}</p>
      <ul className="gaf-zeilen" data-fiaon="firma-posten">
        {zeilen.map((p, i) => {
          const auf = !!offen[p.schluessel];
          return (
            <Auf als="li" key={p.schluessel} verz={i * 70} className={`gaf-zeile gaf-zeile-${p.schluessel}${auf ? " auf" : ""}`}>
              <div className="gaf-zeile-kopf">
                <div className="gaf-zeile-titel">
                  <p className="gaf-zeile-name">{p.titel}</p>
                  <p className="gaf-zeile-einheit">{p.einheit}</p>
                </div>
                <p className="gaf-zeile-betrag">{p.betrag}</p>
                <p className="gaf-zeile-satz">{p.satz}</p>
                <button type="button" className="gaf-zeile-knopf" aria-expanded={auf} aria-controls={`gaf-zeile-${p.schluessel}`}
                  onClick={() => setOffen((o) => ({ ...o, [p.schluessel]: !o[p.schluessel] }))}>
                  <span>{auf ? WORTE.zu : WORTE.details}</span><span className="gaf-plus" aria-hidden="true" />
                </button>
              </div>
              <div className="gaf-klapp gaf-zeile-klapp" id={`gaf-zeile-${p.schluessel}`} {...(auf ? {} : { inert: "" })}>
                <div>
                  <dl className="gaf-posten-fragen">
                    {FRAGEN.map((f) => <div key={f.k}><dt>{f.wort}</dt><dd>{p[f.k]}</dd></div>)}
                  </dl>
                  {p.schluessel === "monat" && <BudgetAufstellung b={inv.budget} />}
                  {p.schluessel === "umsatz" && <UmsatzRechner r={inv.rechner} />}
                </div>
              </div>
            </Auf>
          );
        })}
      </ul>

      {gruendung && (
        <Auf className="gaf-gruendung-zeile" >
          <p className="gaf-gruendung-text" data-fiaon="firma-gruendung-satz">{gruendung.satz}</p>
          <Mehr id="gaf-gruendung-mehr" knopf={WORTE.bestandteile} knopfZu={WORTE.weniger} className="gaf-mehr-klein">
            {gruendung.bestandteile && gruendung.bestandteile.length > 0 && (
              <ul className="gaf-gruendung-teile" aria-label={gruendung.titel}>
                {gruendung.bestandteile.map((b) => <li key={b}><span className="gaf-gruendung-punkt" aria-hidden="true" />{b}</li>)}
              </ul>
            )}
            <dl className="gaf-posten-fragen">
              {FRAGEN.map((f) => <div key={f.k}><dt>{f.wort}</dt><dd>{gruendung[f.k]}</dd></div>)}
            </dl>
          </Mehr>
        </Auf>
      )}
    </>
  );
}
