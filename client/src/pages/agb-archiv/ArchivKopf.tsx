// ═══════════════════════════════════════════════════════════════════════════
// DER KOPF JEDER ARCHIVFASSUNG DER AGB (05.10.2026, E-283)
//
// Wer fiaon.com/agb/2026-09-26 aus seinem Vertrag oder seiner Bestätigungsmail
// öffnet, muss auf den ersten Blick sehen: Das ist nicht die aktuelle Fassung,
// sondern die, die für SEINEN Vertrag gilt — und wo die aktuelle steht. Ohne
// diesen Kopf sähe die Archivseite aus wie die aktuelle AGB, nur mit älterem
// Text, und niemand wüsste, welche gilt.
//
// Für die Fassungen vor dem 03.09.2026 steht in keinem Vertrag eine Fassung
// (agb_stand ist dort leer). Für sie nennt der Kopf die Zeit, in der sie auf
// fiaon.com stand — aus der Git-Historie von client/src/pages/agb.tsx
// (a451c326 vom 12.04., 99756b7e vom 04.07., Jahresvertrag ab 03.09.2026).
// Die späteren Fassungen regeln dasselbe in § 6 Abs. 8: Für ältere Verträge
// gelten die Bedingungen vom Tag des Vertragsschlusses fort.
// ═══════════════════════════════════════════════════════════════════════════
import { Link } from "wouter";
import { agbDatumLang } from "@shared/fiaon-antrag-neu";
import { AGB_FRUEHERE_FASSUNGEN } from "@shared/fiaon-vertrag-paket";

/** Nur für Fassungen aus der Zeit, bevor Verträge ihre Fassung nannten. */
const GELTUNG_OHNE_NENNUNG: Record<string, string> = {
  "2026-07-04": "Verträge, die vor dem 3. September 2026 geschlossen wurden, nennen keine Fassung. Für sie gilt die Fassung, die beim Vertragsschluss auf fiaon.com stand – diese hier für Verträge vom 4. Juli bis zum 2. September 2026.",
  "2026-04-12": "Verträge, die vor dem 3. September 2026 geschlossen wurden, nennen keine Fassung. Für sie gilt die Fassung, die beim Vertragsschluss auf fiaon.com stand – diese hier für Verträge vom 12. April bis zum 3. Juli 2026.",
};

/** Die Liste aller früheren Fassungen als Links — die gezeigte ohne Link. */
export function FassungenListe({ ausser }: { ausser?: string }) {
  return (
    <>
      {AGB_FRUEHERE_FASSUNGEN.map((f, i) => (
        <span key={f}>
          {i > 0 ? " · " : ""}
          {f === ausser
            ? <span>{agbDatumLang(f)}</span>
            : <Link href={`/agb/${f}`} className="text-blue-600 hover:text-blue-700 underline">{agbDatumLang(f)}</Link>}
        </span>
      ))}
    </>
  );
}

export function ArchivKopf({ fassung }: { fassung: string }) {
  const geltung = GELTUNG_OHNE_NENNUNG[fassung];
  return (
    <div className="mb-10 rounded-2xl border-2 border-amber-300 bg-amber-50 p-6 text-sm leading-relaxed text-gray-800" role="note" data-agb-archiv={fassung}>
      {/* Vor dem 03.09.2026 nennt kein Vertrag eine Fassung — dort sagt der zweite Satz, für wen sie gilt. */}
      <p className="font-semibold text-gray-900 mb-2">
        Archivfassung vom {agbDatumLang(fassung)}{geltung ? "." : " – gilt für Verträge, die diese Fassung nennen."}
      </p>
      {geltung ? <p className="mb-2">{geltung}</p> : null}
      <p className="mb-2">
        Aktuelle Fassung: <Link href="/agb" className="text-blue-600 hover:text-blue-700 underline font-semibold">fiaon.com/agb</Link>
      </p>
      <p className="text-gray-600">
        Alle früheren Fassungen: <FassungenListe ausser={fassung} />
      </p>
    </div>
  );
}
