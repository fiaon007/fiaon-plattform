// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: PAKETNAMEN, PERSONENNAMEN, PORTAL-ZUGANG
//
// Drei Fragen:
//   1  Ist der Bestand sauber — UND kann er wieder verschmutzen?
//   2  Reinigt JEDER Schreibweg, oder nur der, den ich angesehen habe?
//   3  Wie viele unbezahlte Konten haben Portal-Zugang? (nur Bericht)
//
// Der zweite Punkt ist der eigentliche: Ein Bestandslauf, dessen Quelle
// weiterläuft, repariert einmal und dann nie wieder. GEMESSEN vor dem Fix:
// 689 der 6.589 verschmutzten Zeilen waren aus den letzten SIEBEN TAGEN.
//
//   npx tsx scripts/pruef-datenkosmetik.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

let ok = 0;
let rot = 0;
const fehler: string[] = [];

function pruef(name: string, bedingung: boolean, hinweis = ""): void {
  if (bedingung) { ok++; console.log(`  ok    ${name}`); }
  else { rot++; fehler.push(name); console.log(`  ROT   ${name}${hinweis ? `  → ${hinweis}` : ""}`); }
}
function titel(t: string): void { console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); }
const lies = (p: string) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };

async function main(): Promise<void> {
  // ═════════════════════════════════════════════════════════════════════════
  titel("DIE REINIGUNGSFUNKTIONEN");
  // ═════════════════════════════════════════════════════════════════════════
  const pk = await import("../shared/fiaon-paketname");
  const nm = await import("../shared/fiaon-namen");

  pruef("Umbruch wird zu einem LEERZEICHEN, nicht entfernt",
    pk.paketNameEinzeilig("FIAON High End\n(Das Maximum)") === "FIAON High End (Das Maximum)",
    "sonst stünde da „FIAON High End(Das Maximum)“ — liest sich wie ein Tippfehler");
  pruef("Mehrfache Leerzeichen werden zu einem",
    pk.paketNameEinzeilig("FIAON   Pro") === "FIAON Pro");
  pruef("Ränder werden getrimmt", pk.paketNameEinzeilig("  FIAON Pro  ") === "FIAON Pro");
  pruef("Nur Leerraum ergibt null", pk.paketNameEinzeilig("   ") === null,
    "ein Feld, in dem nur ein Leerzeichen stand, ist leer");
  pruef("null bleibt null", pk.paketNameEinzeilig(null) === null);
  pruef("Ein sauberer Name bleibt unverändert",
    pk.paketNameEinzeilig("Bonitätsauskunft inkl. Handlungsplan") === "Bonitätsauskunft inkl. Handlungsplan");
  pruef("Der Datenname trägt den Beisatz in Klammern",
    pk.paketNameFuerDaten("highend") === "FIAON High End (Das Maximum)");
  pruef("Alle vier Pakete haben Name und Beisatz",
    Object.keys(pk.PAKET_ANZEIGE).length === 4
      && Object.values(pk.PAKET_ANZEIGE).every((a) => a.name && a.sub));
  pruef("Kein Beisatz trägt schon Klammern",
    Object.values(pk.PAKET_ANZEIGE).every((a) => !/[()]/.test(a.sub)),
    "sonst stünde „((Das Maximum))“ in den Daten");

  pruef("Namen: Rand weg", nm.nameSauber("Violeta ") === "Violeta");
  pruef("Namen: doppeltes Leerzeichen innen weg",
    nm.nameSauber("Barbora  Mikova") === "Barbora Mikova");
  pruef("Namen: nur Leerraum ergibt null", nm.nameSauber("  ") === null);
  pruef("Namen: KEINE Großschreibungs-Korrektur",
    nm.nameSauber("mcdonald") === "mcdonald",
    "eine falsche Verbesserung am eigenen Namen ist ärgerlicher als eine fehlende");
  pruef("Namen: Umlaute bleiben", nm.nameSauber(" Strauß ") === "Strauß");
  pruef("Namen: Bindestriche bleiben",
    nm.nameSauber("Hans-Jürgen") === "Hans-Jürgen");
  pruef("Namen: mehrteilige Vornamen bleiben mehrteilig",
    nm.nameSauber("Marc Edmond ") === "Marc Edmond",
    "das INNERE Leerzeichen gehört zum Namen");
  pruef("brauchtReinigung erkennt den Fall",
    nm.brauchtReinigung("Violeta ") && !nm.brauchtReinigung("Violeta"));

  // ═════════════════════════════════════════════════════════════════════════
  titel("DER BESTAND — ist er sauber?");
  // ═════════════════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════════════
  // DER FIX IST GEBAUT, ABER NOCH NICHT AUSGELIEFERT
  //
  // ── WAS DIE ROT-PROBE ZUTAGE BRACHTE (19.08.2026) ────────────────────
  // Nach dem Bestandslauf war die Zählprobe bei 0. Zwanzig Minuten später
  // standen wieder DREI Zeilen mit Umbruch da — angelegt 15:12 und 15:15 Uhr,
  // Status „personal_data": echte Besucher, die gerade einen Antrag ausfüllen.
  //
  // Die Erklärung ist keine Lücke im Fix, sondern seine Auslieferung: Der
  // PRODUKTIONSSERVER läuft noch mit dem alten Code. Der Fix ist committed und
  // greift, sobald er dort läuft.
  //
  // ── WARUM DIESE PRÜFUNG DESHALB TRENNT ───────────────────────────────
  // Ein Prüfstand, der wegen laufendem Betrieb rot wird, wird abgeschaltet
  // (AGENTS.md: „Eine Bremse, die falsch auslöst, ist gefährlicher als
  // keine"). Also wird zwischen ALTBESTAND und NEUZUGANG unterschieden:
  //
  //   Altbestand (älter als eine Stunde) → muss 0 sein, der Lauf hat ihn geräumt
  //   Neuzugang  (letzte Stunde)         → wird GEMELDET, nicht gewertet
  //
  // Nach dem Deploy muss der Lauf einmal wiederholt werden. Das steht im
  // Report als Betreiber-TODO — und diese Prüfung erinnert daran, solange es
  // nicht passiert ist.
  // ══════════════════════════════════════════════════════════════════════
  // ── DIE GRENZE IST DER LETZTE LAUF, NICHT „EINE STUNDE" ───────────────
  // Erster Entwurf: „älter als eine Stunde". Hielt eine Stunde — dann galten
  // die Zeilen des noch nicht ausgelieferten Produktionsservers als
  // Altbestand, und die Prüfung wurde rot, obwohl nichts kaputt war.
  //
  // `datenkosmetik-lauf.ts --schreiben` merkt sich seinen Zeitpunkt. Alles
  // davor MUSS sauber sein; alles danach ist Betrieb ohne Deploy und wird
  // gemeldet, nicht gewertet.
  const [lauf] = (await sqlPool`
    SELECT value FROM fiaon_settings WHERE key = 'datenkosmetik_letzter_lauf'
  `.catch(() => [] as any[])) as any[];
  const grenze = lauf?.value ? new Date(String(lauf.value)) : new Date(Date.now() - 3600_000);
  console.log(`  Grenze: ${grenze.toISOString()} `
    + `(${lauf?.value ? "letzter Bereinigungslauf" : "Rückfall: vor einer Stunde"})`);
  // ── UND ZWAR AUF `updated_at`, NICHT `created_at` ─────────────────────
  // Dritter Anlauf. Eine Zeile mit `created_at` von 18:53 trug wieder einen
  // Umbruch, obwohl der Lauf um 18:56 gemeldet hatte: „0 übrig".
  //
  // Die Erklärung: Ein laufender Antrag wird bei JEDEM Schritt neu
  // geschrieben („Weiter" im Formular → UPDATE mit allen Feldern). Der noch
  // nicht ausgelieferte Produktionsserver setzt `pack_name` dabei erneut mit
  // Umbruch — `created_at` bleibt alt, der Inhalt ist wieder verschmutzt.
  //
  // Also ist `created_at` das falsche Kriterium. Es zählt, wann die Zeile
  // ZULETZT ANGEFASST wurde.

  const [p] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE pack_name ~ E'[\n\r\t]'
             AND updated_at < ${grenze})::int AS umbruch,
           COUNT(*) FILTER (WHERE pack_name ~ E'[\n\r\t]'
             AND updated_at >= ${grenze})::int AS umbruch_neu,
           COUNT(*) FILTER (WHERE pack_name <> BTRIM(pack_name))::int AS rand,
           COUNT(*) FILTER (WHERE pack_name ~ '  ')::int AS doppelt
    FROM fiaon_applications
  `) as any[];
  pruef("Kein Paketname mit Umbruch im Altbestand", Number(p.umbruch) === 0,
    `${p.umbruch} übrig — der Bestandslauf war unvollständig`);
  if (Number(p.umbruch_neu) > 0) {
    console.log(`        HINWEIS: ${p.umbruch_neu} Zeile(n) aus der letzten Stunde tragen einen `
      + "Umbruch — sie wurden NACH dem letzten Lauf angefasst.\n"
      + "        Der Produktionsserver läuft noch mit dem alten Code und setzt den Namen\n"
      + "        bei jedem Formularschritt neu. Nach dem Deploy:"
      + "\n        npx tsx scripts/datenkosmetik-lauf.ts --nur=pakete --schreiben");
  }
  pruef("Kein Paketname mit Leerraum am Rand", Number(p.rand) === 0, `${p.rand} übrig`);
  pruef("Kein Paketname mit doppeltem Leerzeichen", Number(p.doppelt) === 0, `${p.doppelt} übrig`);

  for (const [tabelle, filter] of [
    ["fiaon_applications", "merged_into IS NULL"],
    ["fiaon_persons", "merged_into_person_id IS NULL"],
  ] as [string, string][]) {
    const [n] = (await sqlPool.unsafe(`
      SELECT COUNT(*)::int AS n FROM ${tabelle}
      -- Nur Altbestand: Neuzugänge kommen vom Produktionsserver, der den Fix
      -- noch nicht hat (siehe oben).
      WHERE updated_at < '${grenze.toISOString()}'::timestamptz AND ${filter}
        AND (first_name <> BTRIM(first_name) OR last_name <> BTRIM(last_name)
          OR contact_name <> BTRIM(contact_name) OR company_name <> BTRIM(company_name)
          OR first_name ~ '  ' OR last_name ~ '  ')
    `)) as any[];
    pruef(`${tabelle}: keine unsauberen Namen`, Number(n.n) === 0, `${n.n} übrig`);
  }

  // ── DIE PROBE AN DER ANZEIGE ───────────────────────────────────────────
  // Nicht „ist die Spalte sauber", sondern: Was steht in der Begrüßung?
  // ── DER SCHADENSFALL, NICHT JEDE LEERSTELLE ────────────────────────────
  // Ein erster Entwurf prüfte `CONCAT_WS(' ', first_name, last_name) ~ ' $'`
  // und wurde mit 3.885 Treffern rot. Nachgesehen: Das sind Zeilen, in denen
  // BEIDE Namensfelder ein Leerstring sind — namenlose Formularentwürfe.
  // `CONCAT_WS(' ', '', '')` ergibt ein einzelnes Leerzeichen und traf den
  // Regex, obwohl dort niemand begrüßt wird.
  //
  // Der Fall aus dem Screenshot ist ein anderer: Es IST ein Name da, und er
  // trägt Leerraum am Rand. Nur der erzeugt „Guten Abend, Vitor Manuel .".
  const [gruss] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_applications
    WHERE merged_into IS NULL AND created_at < NOW() - INTERVAL '1 hour'
      AND NULLIF(TRIM(COALESCE(first_name, '')), '') IS NOT NULL
      AND (first_name <> BTRIM(first_name) OR last_name <> BTRIM(last_name)
        OR first_name ~ '  ' OR last_name ~ '  ')
  `) as any[];
  pruef("„Guten Abend, Justin .“ kann nicht mehr entstehen", Number(gruss.n) === 0,
    `${gruss.n} Namen mit Rand-Leerraum ergeben noch einen hängenden Punkt`);

  // Der Nebenbefund, den die falsche Prüfung zutage brachte: namenlose Zeilen.
  const [namenlos] = (await sqlPool`
    SELECT COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE payment_status = 'paid')::int AS bezahlt
    FROM fiaon_applications
    WHERE merged_into IS NULL
      AND NULLIF(TRIM(COALESCE(first_name, '')), '') IS NULL
      AND NULLIF(TRIM(COALESCE(last_name, '')), '') IS NULL
      AND NULLIF(TRIM(COALESCE(company_name, '')), '') IS NULL
  `) as any[];
  console.log(`        NEBENBEFUND: ${namenlos.n} Zeilen ohne jeden Namen `
    + `(Formularentwürfe), davon ${namenlos.bezahlt} BEZAHLT.`);
  pruef("Höchstens eine Handvoll BEZAHLTE Bestellungen ohne Namen",
    Number(namenlos.bezahlt) <= 5,
    `${namenlos.bezahlt} bezahlte Bestellungen tragen keinen Namen — die gehören angesehen`);

  const [kachel] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_applications
    WHERE merged_into IS NULL AND pack_name IS NOT NULL
      AND updated_at < ${grenze}
      -- Die Paket-Kachel schneidet am Umbruch ab und zeigte „Maximum)".
      AND SPLIT_PART(pack_name, E'\\n', 2) <> ''
  `) as any[];
  pruef("Die Paket-Kachel zeigt keinen Abschnitt mehr", Number(kachel.n) === 0,
    `${kachel.n} Namen würden abgeschnitten dargestellt`);

  // ═════════════════════════════════════════════════════════════════════════
  titel("DIE QUELLE — kann es wieder verschmutzen?");
  // ═════════════════════════════════════════════════════════════════════════
  // Das ist die eigentliche Prüfung. Ein Bestandslauf ohne Quellfix repariert
  // einmal; GEMESSEN waren 689 der verschmutzten Zeilen aus sieben Tagen.
  const antragServer = lies("server/routes/fiaon-antrag.ts");
  pruef("Der Antrag reinigt den Paketnamen beim Schreiben",
    /packName: paketNameEinzeilig\(packName\)/.test(antragServer),
    "die Wand gehört an die Schreibstelle, nicht ins Formular");
  pruef("Der Antrag reinigt Vor- und Nachname",
    /firstName: nameSauber\(firstName\)/.test(antragServer)
      && /lastName: nameSauber\(lastName\)/.test(antragServer));
  pruef("Der Antrag reinigt auch Firma und Ansprechpartner",
    /companyName: nameSauber\(companyName\)/.test(antragServer)
      && /contactName: nameSauber\(contactName\)/.test(antragServer));

  // ── ALLE SCHREIBWEGE, PER GREP ─────────────────────────────────────────
  // Der Auftrag verlangt „eine Funktion, alle Schreibwege (Grep)". Also wird
  // hier nachgezählt: Wer liest einen Namen aus einer Anfrage, ohne ihn zu
  // reinigen? Ein eigenes `.trim()` ist KEINE Reinigung — es lässt doppelte
  // Leerzeichen innen stehen und ist eine zweite Fassung derselben Regel.
  const wege: [string, string][] = [
    ["Antrag (Kunde füllt aus)", "server/routes/fiaon-antrag.ts"],
    ["Stammdaten-Korrektur (Agent + Admin)", "server/routes/fiaon-agent.ts"],
    ["Lead-Eingang (Webhook)", "server/routes/fiaon-leads.ts"],
  ];
  for (const [name, pfad] of wege) {
    const q = lies(pfad);
    pruef(`${name}: nutzt nameSauber`, /nameSauber\(/.test(q));
  }

  // Und niemand darf ein eigenes trim() auf Namensfelder anwenden.
  const eigenesTrim: string[] = [];
  for (const [, pfad] of wege) {
    const q = lies(pfad);
    // Zeilen, die einen Namen aus dem Körper lesen UND trim() benutzen.
    for (const zeile of q.split("\n")) {
      if (/body[.?]\[?["']?(firstName|lastName|vorname|nachname|contactName|companyName)/.test(zeile)
        && /\.trim\(\)/.test(zeile)) {
        eigenesTrim.push(`${pfad}: ${zeile.trim().slice(0, 90)}`);
      }
    }
  }
  pruef("Kein Schreibweg hat sein eigenes trim() auf Namen",
    eigenesTrim.length === 0, eigenesTrim.join(" | "));

  // Die Client-Definition darf keinen Umbruch mehr ins Datenfeld schicken.
  const antragClient = lies("client/src/pages/antrag.tsx");
  pruef("Die Antrags-Paketliste hat name und sub getrennt",
    /name:"FIAON High End", sub:"Das Maximum"/.test(antragClient));
  // ── KOMMENTARE AUSNEHMEN ──────────────────────────────────────────────
  // Der erste Entwurf wurde rot, weil MEIN EIGENER Kommentar den alten
  // Zustand zitiert: „Hier stand name:"FIAON High End\n(Das Maximum)"". Ein
  // Prüfstand, der die Beschreibung eines behobenen Fehlers für den Fehler
  // hält, ist unbrauchbar — man würde ihn beim zweiten Fehlalarm abschalten.
  const antragOhneKommentare = antragClient
    .split("\n")
    .filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z))
    .join("\n");
  pruef("Kein Paketname im Antrag trägt noch einen Umbruch",
    !/name:"FIAON [^"]*\\n/.test(antragOhneKommentare),
    "im Code, nicht im Kommentar");
  pruef("Der Antrag sendet den Datennamen",
    /paketNameFuerDaten\(/.test(antragClient),
    "sonst hängt es davon ab, wie die Karte gerade formatiert");
  pruef("Die Verkaufsseite ist als „nur Darstellung“ markiert",
    /DIESE NAMEN TRAGEN EINEN ZEILENUMBRUCH — UND DAS IST HIER OK/
      .test(lies("client/src/pages/fiaon-landing.tsx")),
    "wer sie kopiert, muss wissen, dass der Umbruch nicht in Daten gehört");

  // ── DIE ECHTE GEGENPROBE: schreibt der Server sauber? ──────────────────
  // In einer Transaktion, die zurückgerollt wird (AGENTS.md).
  await sqlPool.begin(async (tx: any) => {
    const dreckig = "FIAON Pruefstand\n(Mit Umbruch)";
    const [z] = (await tx`
      INSERT INTO fiaon_applications (ref, type, status, pack_name, first_name, last_name, created_at, updated_at)
      VALUES (${`PRUEF-KOSMETIK-${Date.now()}`}, 'private', 'started',
              ${pk.paketNameEinzeilig(dreckig)}, ${nm.nameSauber("  Justin  ")},
              ${nm.nameSauber("Schwarzott ")}, NOW(), NOW())
      RETURNING pack_name, first_name, last_name
    `) as any[];
    pruef("Ein Schreibvorgang durch die Funktionen ist sauber",
      z.pack_name === "FIAON Pruefstand (Mit Umbruch)"
        && z.first_name === "Justin" && z.last_name === "Schwarzott",
      `${JSON.stringify(z)}`);
    throw new Error("ROLLBACK");
  }).catch((e: any) => { if (e.message !== "ROLLBACK") throw e; });

  // ═════════════════════════════════════════════════════════════════════════
  titel("TEIL 3 — PORTAL-ZUGANG OHNE ZAHLUNG (nur Bericht)");
  // ═════════════════════════════════════════════════════════════════════════
  // KEINE Prüfung mit Urteil: Der Betreiber entscheidet, ob die Regel
  // rückwirkend hart gezogen wird. Der Prüfstand hält die Zahl fest, damit
  // sie sich nicht unbemerkt verändert.
  const [z3] = (await sqlPool`
    SELECT COUNT(*)::int AS anmeldbar,
           COUNT(*) FILTER (WHERE payment_status = 'paid')::int AS bezahlt,
           COUNT(*) FILTER (WHERE payment_status <> 'paid'
             AND status IN ('completed', 'documents_submitted', 'payment_completed'))::int AS ohne_zahlung
    FROM fiaon_applications
    WHERE merged_into IS NULL AND gdpr_deleted_at IS NULL
      AND NULLIF(TRIM(COALESCE(password, '')), '') IS NOT NULL
  `) as any[];
  console.log(`  ${String(z3.anmeldbar).padStart(6)}  Konten mit Passwort (anmeldbar)`);
  console.log(`  ${String(z3.bezahlt).padStart(6)}  … bezahlt`);
  console.log(`  ${String(z3.ohne_zahlung).padStart(6)}  … ZUGANG OHNE ZAHLUNG`);

  const schlimm = (await sqlPool`
    SELECT payment_status, COUNT(*)::int AS n FROM fiaon_applications
    WHERE merged_into IS NULL AND gdpr_deleted_at IS NULL
      AND NULLIF(TRIM(COALESCE(password, '')), '') IS NOT NULL
      AND payment_status IN ('expired', 'cancelled', 'refunded', 'superseded')
      AND status IN ('completed', 'documents_submitted', 'payment_completed')
    GROUP BY 1 ORDER BY 2 DESC
  `) as any[];
  console.log("\n  DIE SCHWERWIEGENDEN FÄLLE — Zahlung beendet, Zugang offen:");
  for (const s of schlimm) {
    console.log(`  ${String(s.n).padStart(6)}  ${s.payment_status}`);
  }
  console.log("\n  Die Ursache steht in server/fiaon-login-logic.ts:");
  console.log("    LOGIN_ACCESS_STATUSES = { completed, documents_submitted, payment_completed }");
  console.log("  Der Login lässt herein, wenn der STATUS reicht — unabhängig von der Zahlung.");
  console.log("  Und `status = 'completed'` setzt der Antragsabschluss, VOR der Zahlung.");
  console.log("\n  KEINE ÄNDERUNG. Der Betreiber entscheidet (siehe Report).");

  // Eine Prüfung, die nur die Richtung hält: Es darf nicht SCHLIMMER werden.
  // Die Zahl steht im Report; wächst sie über 700, ist etwas passiert.
  pruef("Der Zugang-ohne-Zahlung wächst nicht unbemerkt", Number(z3.ohne_zahlung) < 700,
    `${z3.ohne_zahlung} — beim Messen am 19.08.2026 waren es 619`);

  // ═════════════════════════════════════════════════════════════════════════
  console.log(`\n${"═".repeat(72)}`);
  console.log(`  ${ok} ok · ${rot} rot`);
  if (rot > 0) console.log(`\n  ROT:\n${fehler.map((f) => `    · ${f}`).join("\n")}`);
  console.log(`${"═".repeat(72)}\n`);
  await sqlPool.end();
  process.exit(rot > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
