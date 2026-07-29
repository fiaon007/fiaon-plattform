/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TESTS DER ZAHLUNGS-ZUORDNUNG — ohne Wise, ohne Datenbank
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Die Zuordnung entscheidet über Geld. Sie muss beweisbar sein, bevor sie auf
 * echte Kontoeingänge losgelassen wird. Jeder Fall hier ist ein Fall, der in
 * der Praxis vorkommt: Umlaute, Tippfehler, Mädchenname, zahlende Ehepartner,
 * Teilzahlungen, zwei Kunden mit demselben Namen.
 *
 * Ausführen:  npx tsx scripts/zuordnung-test.ts
 */

import {
  namensAehnlichkeit, nameTokens, normIban, normName, ordneZu,
  type Kandidat, type Eingang,
} from "../server/lib/zahlungs-zuordnung";

let bestanden = 0, fehlgeschlagen = 0;

function ok(name: string, bedingung: boolean, detail = ""): void {
  if (bedingung) { bestanden++; console.log(`  ✓ ${name}`); }
  else { fehlgeschlagen++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}
function gruppe(titel: string): void {
  console.log(`\n── ${titel} ${"─".repeat(Math.max(0, 62 - titel.length))}`);
}

const k = (over: Partial<Kandidat>): Kandidat => ({
  ref: "FIAON-TEST-0001",
  paymentReference: "FIAON-ABC123",
  sollCents: 7400,
  paymentStatus: "pending_payment",
  name: "Anna Müller",
  email: "anna@example.com",
  iban: null,
  personId: null,
  createdAt: new Date("2026-01-01"),
  ...over,
});

const e = (over: Partial<Eingang>): Eingang => ({
  amountCents: 7400,
  payerName: "ANNA MUELLER",
  senderAccount: null,
  referenceRaw: null,
  ...over,
});

/**
 * Referenzsuche ohne Datenbank.
 *
 * Bildet bewusst die Toleranz von `findApp` nach: `extractRef` nimmt bis zu 12
 * Zeichen hinter „FIAON" mit und schleppt dadurch angehängten Text mit
 * („FIAON-ABC123 Danke" → „FIAON-ABC123DANKE"). Erst die Suche prüft die
 * 6- und 12-stellige Variante. Ein Stub ohne diese Toleranz würde einen Fehler
 * melden, den es in Wirklichkeit nicht gibt.
 */
const suche = (treffer: Record<string, string>) => async (ref: string) => {
  const norm = ref.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = norm.startsWith("FIAON") ? norm.slice(5) : norm;
  for (const kandidat of [`FIAON-${body}`, `FIAON-${body.slice(0, 6)}`, `FIAON-${body.slice(0, 12)}`]) {
    if (treffer[kandidat]) return { ref: treffer[kandidat], personId: null };
  }
  return null;
};

async function main(): Promise<void> {
  console.log("\nZAHLUNGS-ZUORDNUNG — TESTS");
  console.log("═".repeat(70));

  gruppe("Normalisierung");
  ok("Umlaute werden aufgelöst", normName("Müller") === "mueller", normName("Müller"));
  ok("Eszett wird aufgelöst", normName("Straßer") === "strasser", normName("Straßer"));
  ok("Akzente werden aufgelöst", normName("Ćosić") === "cosic", normName("Ćosić"));
  ok("Kurze Partikel fallen weg", !nameTokens("Anna de Vries").includes("de"));
  ok("IBAN ohne Leerzeichen", normIban("BE09 9058 9276 3957") === "BE09905892763957");
  ok("Zu kurze IBAN wird verworfen", normIban("BE09 90") === null);

  gruppe("Namensähnlichkeit");
  ok("Umlaut-Schreibweise gilt als gleich", namensAehnlichkeit("ANNA MUELLER", "Anna Müller") > 0.95);
  ok("Reihenfolge egal", namensAehnlichkeit("MUELLER ANNA", "Anna Müller") > 0.95);
  ok("Ein Tippfehler bleibt erkennbar", namensAehnlichkeit("Anna Müler", "Anna Müller") > 0.85);
  ok("Fremder Name fällt durch", namensAehnlichkeit("Peter Schmidt", "Anna Müller") < 0.5);
  ok("Zusatz-Vorname stört nicht", namensAehnlichkeit("Anna Maria Mueller", "Anna Müller") > 0.9);

  gruppe("Stufe 1 · Referenz im Verwendungszweck");
  {
    const z = await ordneZu(
      e({ referenceRaw: "Ueberweisung FIAON-ABC123 Danke", payerName: "IRGENDWER GMBH" }),
      [k({})],
      suche({ "FIAON-ABC123": "FIAON-TEST-0001" }),
    );
    ok("Referenz trifft sicher", z.methode === "referenz" && z.konfidenz === "sicher");
    ok("Wird automatisch verbucht", z.automatisch === true);
    ok("Fremder Einzahlername blockiert NICHT", z.ref === "FIAON-TEST-0001");
    ok("Betragsprüfung ist gesetzt", z.betragPasst === true);
  }
  {
    // Ehepartner zahlt, Betrag weicht ab: Referenz gilt trotzdem, aber die
    // Abweichung wird sichtbar gemacht statt stillschweigend übernommen.
    const z = await ordneZu(
      e({ referenceRaw: "FIAON-ABC123", amountCents: 7000, payerName: "THOMAS MUELLER" }),
      [k({})],
      suche({ "FIAON-ABC123": "FIAON-TEST-0001" }),
    );
    ok("Abweichender Betrag wird gemeldet", z.betragPasst === false);
  }

  gruppe("Stufe 2 · Absender-IBAN");
  {
    const z = await ordneZu(
      e({ senderAccount: "BE09 9058 9276 3957", payerName: "UNLESERLICH", amountCents: 7400 }),
      [k({ iban: "BE09905892763957" })],
      suche({}),
    );
    ok("IBAN trifft sicher", z.methode === "iban" && z.automatisch);
  }
  {
    const z = await ordneZu(
      e({ senderAccount: "BE09905892763957", amountCents: 7400, payerName: "X" }),
      [k({ ref: "A", iban: "BE09905892763957", paymentStatus: "paid" })],
      suche({}),
    );
    ok("Bereits bezahlte Bestellung wird nicht erneut belegt", z.methode !== "iban");
  }

  gruppe("Stufe 3 · Betrag exakt + Name eindeutig");
  {
    const z = await ordneZu(e({}), [k({}), k({ ref: "FREMD", name: "Peter Schmidt" })], suche({}));
    ok("Eindeutiger Namenstreffer wird automatisch", z.methode === "name_betrag" && z.automatisch);
    ok("Trifft die richtige Bestellung", z.ref === "FIAON-TEST-0001");
  }
  {
    const z = await ordneZu(e({ payerName: "Anna Müler" }), [k({})], suche({}));
    ok("Ein Tippfehler verhindert die Zuordnung nicht", z.automatisch === true, z.begruendung);
  }
  {
    // Zwei Kunden gleichen Namens, gleicher Betrag → NIEMALS raten.
    const z = await ordneZu(e({}), [k({ ref: "A" }), k({ ref: "B" })], suche({}));
    ok("Mehrdeutigkeit wird NICHT automatisch entschieden", z.automatisch === false);
    ok("Beide erscheinen als Vorschlag", z.vorschlaege.length >= 2);
  }

  gruppe("Stufe 4 · Prüfliste mit Vorschlägen");
  {
    // Mädchenname/Teilzahlung: Name passt, Betrag nicht → Vorschlag, keine Buchung.
    const z = await ordneZu(e({ amountCents: 5000 }), [k({})], suche({}));
    ok("Abweichender Betrag → nur Vorschlag", z.automatisch === false && z.methode === "vorschlag");
    ok("Vorschlag nennt die Abweichung", /weicht ab/.test(z.vorschlaege[0]?.begruendung || ""));
  }
  {
    const z = await ordneZu(
      e({ payerName: "ACME HANDELS GMBH", amountCents: 9900 }),
      [k({ name: "Anna Müller" })],
      suche({}),
    );
    ok("Völlig fremder Zahler bleibt offen", z.ref === null);
    ok("Ohne Kandidat ist die Liste leer", z.vorschlaege.length === 0);
  }
  {
    const z = await ordneZu(e({ payerName: null, referenceRaw: null }), [k({})], suche({}));
    ok("Fehlender Einzahlername führt nicht zu einer Buchung", z.automatisch === false);
  }

  console.log("\n" + "═".repeat(70));
  console.log(`ERGEBNIS: ${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen`);
  if (fehlgeschlagen > 0) {
    console.log("Die Zuordnung darf so NICHT auf echte Kontoeingänge angewendet werden.");
    process.exit(1);
  }
  console.log("Zuordnung ist beweisbar sicher — Automatik nur bei Referenz, IBAN oder eindeutigem Namen.");
}

main();
