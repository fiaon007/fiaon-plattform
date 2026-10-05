// ═══════════════════════════════════════════════════════════════════════════
// DER KOPF JEDER ARCHIVFASSUNG DER AGB (05.10.2026, E-283)
//
// Wer fiaon.com/agb/2026-09-26 aus seinem Vertrag oder seiner Bestätigungsmail
// öffnet, muss auf den ersten Blick sehen: Das ist nicht die aktuelle Fassung,
// sondern die, die für SEINEN Vertrag gilt — und wo die aktuelle steht. Ohne
// diesen Kopf sähe die Archivseite aus wie die aktuelle AGB, nur mit älterem
// Text, und niemand wüsste, welche gilt.
//
// Verträge über den bisherigen Antrag (/antrag) nennen KEINE Fassung — vor
// dem 03.09.2026 nicht (agb_stand ist dort leer) und auch danach nicht:
// agb_stand hält zwar die Fassung fest, die beim Vertragsschluss galt (die des
// Servers in diesem Moment), steht aber nur intern, in keinem Vertrag und
// keiner Mail. Für diese Verträge nennt der Kopf die Zeit, in der die Fassung
// auf fiaon.com stand — aus der Git-Historie von client/src/pages/agb.tsx
// (a451c326 vom 12.04., 99756b7e vom 04.07., d308164e Jahresvertrag ab
// 03.09., 4cc84b6e vom 26.09.2026). Die Grenzen 26.09. und 05.10. hängen am
// Deploy, deshalb „bis zum Erscheinen der Fassung vom …" statt eines Tages.
// Die späteren Fassungen regeln dasselbe in § 6 Abs. 8: Für ältere Verträge
// gelten die Bedingungen vom Tag des Vertragsschlusses fort.
// ═══════════════════════════════════════════════════════════════════════════
import { Link } from "wouter";
import { agbDatumLang } from "@shared/fiaon-antrag-neu";
import { AGB_FRUEHERE_FASSUNGEN } from "@shared/fiaon-vertrag-paket";

/** Für wen eine Fassung gilt, wenn sein Vertrag keine Fassung nennt (05.10.2026, E-283: auch 03.09. und 26.09.). */
const GELTUNG_OHNE_NENNUNG: Record<string, string> = {
  "2026-09-26": "Nennt Ihr Vertrag keine Fassung – so ist es bei Verträgen über den bisherigen Antrag –, gilt die Fassung, die beim Vertragsschluss auf fiaon.com stand: diese hier für Verträge ab dem Erscheinen dieser Fassung bis zum Erscheinen der Fassung vom 5. Oktober 2026.",
  "2026-09-03": "Nennt Ihr Vertrag keine Fassung – so ist es bei Verträgen über den bisherigen Antrag –, gilt die Fassung, die beim Vertragsschluss auf fiaon.com stand: diese hier für Verträge vom 3. September 2026 bis zum Erscheinen der Fassung vom 26. September 2026.",
  "2026-07-04": "Verträge über den bisherigen Antrag nennen keine Fassung. Für sie gilt die Fassung, die beim Vertragsschluss auf fiaon.com stand – diese hier für Verträge vom 4. Juli bis zum 2. September 2026.",
  "2026-04-12": "Verträge über den bisherigen Antrag nennen keine Fassung. Für sie gilt die Fassung, die beim Vertragsschluss auf fiaon.com stand – diese hier für Verträge vom 12. April bis zum 3. Juli 2026.",
};

/** Fassungen aus der Zeit, bevor überhaupt ein Vertrag seine Fassung nannte — dort fehlt der Satz „gilt für Verträge, die diese Fassung nennen". */
const NIE_GENANNT = new Set(["2026-07-04", "2026-04-12"]);

/**
 * Nicht in der Liste, aber unter ihrer Adresse abrufbar: die Fassung der SCP Real Estate KG
 * (anderer Anbieter, Zahlung über Stripe, Platzhalter-Telefonnummer). Wer sie braucht, bekommt
 * den Link; auf jeder AGB-Seite verwirrt sie nur (Entscheidung 05.10.2026).
 */
const NICHT_IN_DER_LISTE = new Set(["2026-04-12"]);

/** Die Liste aller früheren Fassungen als Links — die gezeigte ohne Link. */
export function FassungenListe({ ausser }: { ausser?: string }) {
  const liste = AGB_FRUEHERE_FASSUNGEN.filter((f) => f === ausser || !NICHT_IN_DER_LISTE.has(f));
  return (
    <>
      {liste.map((f, i) => (
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
  const genannt = !NIE_GENANNT.has(fassung);
  return (
    <div className="mb-10 rounded-2xl border-2 border-amber-300 bg-amber-50 p-6 text-sm leading-relaxed text-gray-800" role="note" data-agb-archiv={fassung}>
      {/* Erst die Verträge, die diese Fassung nennen; darunter, für wen sie gilt, wenn der Vertrag keine nennt. */}
      <p className="font-semibold text-gray-900 mb-2">
        Archivfassung vom {agbDatumLang(fassung)}{genannt ? " – gilt für Verträge, die diese Fassung nennen." : "."}
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
