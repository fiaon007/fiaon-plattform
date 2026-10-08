// ═══════════════════════════════════════════════════════════════════════════
// GEMEINSAMES WACHSTUMSBUDGET — DIE AUFSTELLUNG (E-301, Runde 2, Punkt 8)
//
// Justin (08.10.2026): Die Kundin zahlt nicht für Personal, sondern die Hälfte
// eines gemeinsamen Monatsbudgets — FIAON trägt die andere Hälfte. Oben das
// Budget groß und eine geteilte Linie (Ihr Anteil Navy, FIAON Gold), darunter die
// Posten mit feinen Balken nach ihrem Anteil. Dieselbe Aufstellung steht in
// Ziffer 10 Absatz 3 des Vertrags (eine Quelle: firmaBudget in shared/).
// Die Balken wachsen einmal beim Hineinscrollen; „weniger Bewegung“: sofort voll.
// ═══════════════════════════════════════════════════════════════════════════
import type { FirmaBudget } from "@shared/fiaon-global-angebot-firma-typen";
import { Auf } from "./gemeinsam";

export default function BudgetAufstellung({ b }: { b: FirmaBudget }) {
  const summe = b.zeilen.reduce((a, z) => a + z.cents, 0) || 1;
  return (
    <Auf className="gaf-budget" >
      <div className="gaf-budget-kopf" data-fiaon="firma-budget">
        <div>
          <p className="gaf-auge">{b.titel}</p>
          <p className="gaf-budget-zahl">{b.gesamt}</p>
          <p className="gaf-budget-einheit">{b.gesamtText}</p>
        </div>
        <p className="gaf-budget-sub">{b.sub}</p>
      </div>
      <div className="gaf-budget-teilung" role="img" aria-label={`${b.ihrAnteilText} ${b.ihrAnteil}, ${b.fiaonAnteilText} ${b.fiaonAnteil}`}>
        <div className="gaf-budget-haelfte ihr"><span className="gaf-budget-strich" /><b>{b.ihrAnteil}</b><span>{b.ihrAnteilText}</span></div>
        <div className="gaf-budget-haelfte fiaon"><span className="gaf-budget-strich" /><b>{b.fiaonAnteil}</b><span>{b.fiaonAnteilText}</span></div>
      </div>
      <p className="gaf-budget-start">{b.start}</p>
      <ol className="gaf-budget-zeilen">
        {b.zeilen.map((z) => (
          <li key={z.schluessel}>
            <div className="gaf-budget-zeile-text"><b>{z.titel}</b>{z.text && <span>{z.text}</span>}</div>
            <span className="gaf-budget-betrag">{z.betrag}</span>
            <span className="gaf-budget-balken" aria-hidden="true"><i style={{ width: `${Math.round((z.cents / summe) * 1000) / 10}%` }} /></span>
          </li>
        ))}
        <li className="gaf-budget-summe"><div className="gaf-budget-zeile-text"><b>{b.summeText}</b></div><span className="gaf-budget-betrag">{b.gesamt}</span></li>
      </ol>
      <div className="gaf-budget-fein">{b.fein.map((f) => <p key={f}>{f}</p>)}</div>
    </Auf>
  );
}
