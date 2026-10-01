// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-264: „HAB NIX BEANTRAGT" UND DIE REGEL „ANTRAG ABGESCHICKT"
// (29.09.2026)
//
// Der Fall: Abbrecher-Vorlage → „Hab nix beantragt 🤢🤮😡😤😠" → Mara nach 22 s:
// „Sehr gern — nach der Zahlung ist Ihr Account aktiv … Ihre Zahlungsseite …".
// Sein Antrag: approved, Schritt 5, pending_payment, nie abgeschickt.
//
// Geprüft (ohne Datenbank, ohne Netz, ohne KI):
//   1. EINE Regel „Antrag abgeschickt" (shared/fiaon-antrag-stand.ts):
//      approved/Schritt 5 → antrag_offen; Schritt 8 → zahlung_offen;
//      submitted_at → zahlung_offen; JS-Regel und SQL-Regel sagen dasselbe
//      (mit --db zusätzlich gegen die lokale Test-DB gerechnet).
//   2. Abstreiten erkennen — echte Formulierungen mit Emojis, Tippfehlern,
//      „nix", „hab ich nie", „kenn ich nicht", „falsche nummer", „woher meine
//      nummer", „betrug", „spam", „lassen sie mich in ruhe" — und die
//      Gegenproben, die KEIN Abstreiten sind („noch nichts bestellt, wie geht das?").
//   3. Die Antworten (WhatsApp und Mail) bestehen Wortwand, Ton- und Linkprüfung,
//      tragen keinen Link, keinen Verkauf, keinen Zahlungssatz.
//   4. Harte Prüfung: Zahlungsseite oder Zahlungssatz an jemanden ohne
//      abgeschickten Antrag ist ein harter Mangel (linkPruefung „ohne_antrag").
//   5. Der Rückfall (sichererSatz) liest „beantragt" nie als Link-Frage.
//   NACHBESSERUNG E-264 (29.09.2026, Gegenlesen):
//   6. Fehlalarme (Technik, Datenkorrektur, „nicht belästigen", Spam-Ordner,
//      „Link geht nicht 😡") sind KEIN Abstreiten; übersehene Formen („das war
//      nicht ich", „mein Sohn …", „keine Ahnung, was das soll", „keinen Kontakt
//      mehr", „für was zahlen, ich weiß nix") werden erkannt.
//   7. Folgen je Art (abstreitenFolgen): keine Sperre bei falscher Nummer, Wut,
//      Rückfrage und bei Stufe B; die Herkunft ist die FRÜHESTE belegte Quelle.
//   8. Die Zahlungswand sperrt Aufforderungen, nicht Erklärungen — gegen die
//      echten Mara-Antworten der Woche (2 von 134, genau die zwei Fehler).
//   9. „Wer sind Sie?" bekommt keinen festen Satz (Hinweis ans Modell), kein Löschangebot.
//
//   env -i PATH="$PATH" HOME="$HOME" DOTENV_CONFIG_PATH=/dev/null npx tsx scripts/pruef-mara-abstreiten.ts
//   mit --db: DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand…?sslmode=require' davor
// ═══════════════════════════════════════════════════════════════════════════
const MIT_DB = process.argv.includes("--db");
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "META_SYSTEM_TOKEN", "OPENAI_API_KEY", "RESEND_API_KEY", "TWILIO_AUTH_TOKEN"]) {
  if (process.env[k]) { console.error(`${k} ist gesetzt — Abbruch, der Prüfstand darf nichts versenden.`); process.exit(3); }
}
if (MIT_DB && !/127\.0\.0\.1:54329\/fiaon_pruefstand/.test(String(process.env.DATABASE_URL))) { console.error("--db NUR gegen die lokale Test-DB!"); process.exit(3); }
if (!MIT_DB) process.env.DATABASE_URL = "postgresql://nobody@127.0.0.1:1/none";
process.env.CRONS = "aus";
process.env.SESSION_SECRET ||= "pruefstand-nur-lokal";

const stand = await import("../shared/fiaon-antrag-stand");
const ton = await import("../shared/fiaon-mara-ton");
const { wandPruefen } = await import("../shared/fiaon-wortverbote");
const { sendePruefung } = await import("../server/lib/fiaon-whatsapp");
const wa = await import("../server/lib/fiaon-whatsapp-mara");

let geprueft = 0, fehler = 0;
function ok(bed: unknown, text: string) {
  geprueft++;
  if (bed) console.log(`  ✓ ${text}`); else { fehler++; console.log(`  ✗ ${text}`); }
}
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);

// ═══ 1. DIE REGEL ═════════════════════════════════════════════════════════
abschnitt("1 · Antrag abgeschickt — eine Regel (JS und SQL)");
type A = { status: string | null; payment_status: string; current_step: number | null; submitted_at?: string | null };
const FAELLE: [string, A, boolean, string][] = [
  ["Fall 29.09.: approved, Schritt 5, pending_payment", { status: "approved", payment_status: "pending_payment", current_step: 5 }, false, "antrag_offen"],
  ["approved, Schritt 5, pending", { status: "approved", payment_status: "pending", current_step: 5 }, false, "antrag_offen"],
  ["finances, Schritt 2, pending_payment", { status: "finances", payment_status: "pending_payment", current_step: 2 }, false, "antrag_offen"],
  ["verifying, Schritt 4, pending_payment", { status: "verifying", payment_status: "pending_payment", current_step: 4 }, false, "antrag_offen"],
  ["processing, Schritt 7, pending_payment", { status: "processing", payment_status: "pending_payment", current_step: 7 }, false, "antrag_offen"],
  ["finances, Schritt 3, expired", { status: "finances", payment_status: "expired", current_step: 3 }, false, "antrag_offen"],
  ["contract, Schritt 6, pending", { status: "contract", payment_status: "pending", current_step: 6 }, false, "antrag_offen"],
  ["approved, Schritt 8, pending_payment (Schritt 8 zählt)", { status: "approved", payment_status: "pending_payment", current_step: 8 }, true, "zahlung_offen"],
  ["approved, Schritt 5, submitted_at gesetzt", { status: "approved", payment_status: "pending_payment", current_step: 5, submitted_at: "2026-09-29T09:00:00Z" }, true, "zahlung_offen"],
  ["pending_payment, Schritt 8", { status: "pending_payment", payment_status: "pending_payment", current_step: 8 }, true, "zahlung_offen"],
  ["payment_pending, Schritt 5 (Status außerhalb des Antragswegs)", { status: "payment_pending", payment_status: "pending_payment", current_step: 5 }, true, "zahlung_offen"],
  ["submitted, Schritt 0, pending_payment", { status: "submitted", payment_status: "pending_payment", current_step: 0 }, true, "zahlung_offen"],
  ["completed, Schritt 9, expired", { status: "completed", payment_status: "expired", current_step: 9 }, true, "zahlung_offen"],
  ["approved, Schritt 5, claimed_paid (A bleibt A)", { status: "approved", payment_status: "claimed_paid", current_step: 5 }, false, "zahlung_gemeldet"],
  ["documents_submitted, paid", { status: "documents_submitted", payment_status: "paid", current_step: 9 }, true, "kunde"],
  ["approved, cancelled", { status: "approved", payment_status: "cancelled", current_step: 5 }, false, "beendet"],
];
for (const [name, a, abgeschickt, stufe] of FAELLE) {
  ok(stand.antragAbgeschickt(a) === abgeschickt, `antragAbgeschickt: ${name} → ${abgeschickt}`);
  ok(ton.stufeAusAntrag(a) === stufe, `stufeAusAntrag: ${name} → ${stufe} (ist ${ton.stufeAusAntrag(a)})`);
}
ok(stand.antragAbgeschickt(null) === false && ton.stufeAusAntrag(null) === "lead", "Ohne Antrag: nicht abgeschickt, Stufe lead");
ok(stand.abgeschicktSql("a") === "(COALESCE(a.current_step, 0) >= 8 OR a.submitted_at IS NOT NULL OR COALESCE(a.status, '') NOT IN ('started', 'personal_data', 'finances', 'config', 'verifying', 'approved', 'contract', 'processing'))", "abgeschicktSql(a) — die Hausregel wörtlich (plus submitted_at)");
ok(!/\bundefined\b|\.\./.test(stand.abgeschicktSql("")) && stand.abgeschicktSql("").startsWith("(COALESCE(current_step"), "abgeschicktSql() ohne Alias");
// Die Link-Wahl: unfertig → Wiedereinstieg, nie Zahlungsseite — auch wenn eine payment_reference daneben steht.
const wahl = ton.persoenlicherLink({ stufe: ton.stufeAusAntrag(FAELLE[0][1]), weiterLink: "https://fiaon.com/antrag?weiter=FIAON-X.1.s", zahlungsReferenz: null }, "whatsapp");
ok(wahl.zweck === "antrag" && wahl.url === "https://fiaon.com/antrag?weiter=FIAON-X.1.s", `Fall 29.09.: persoenlicherLink = Wiedereinstieg (${wahl.url})`);

if (MIT_DB) {
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  try {
    let gleich = 0;
    for (const [name, a, abgeschickt] of FAELLE) {
      const [r] = (await sql.unsafe(`SELECT ${stand.abgeschicktSql("x")} AS ab FROM (SELECT $1::text AS status, $2::int AS current_step, $3::timestamptz AS submitted_at) x`,
        [a.status, a.current_step, a.submitted_at ?? null] as any)) as any[];
      if (r?.ab === abgeschickt) gleich++; else console.log(`    SQL ≠ JS: ${name} (SQL ${r?.ab})`);
    }
    ok(gleich === FAELLE.length, `SQL-Regel = JS-Regel in allen ${FAELLE.length} Fällen (lokale Test-DB)`);
  } finally { await sql.end({ timeout: 2 }).catch(() => {}); }
}

// ═══ 2. ABSTREITEN ERKENNEN ═══════════════════════════════════════════════
abschnitt("2 · Abstreiten erkennen — echte Formulierungen");
// [Text, Art, stopp, fest]
const JA: [string, string, boolean, boolean][] = [
  ["Hab nix beantragt 🤢🤮😡😤😠", "bestreitet", true, true],
  ["hab nix beantragt", "bestreitet", true, true],
  ["HAB NIX BEANTRAGT!!!", "bestreitet", true, true],
  ["Ich habe nichts beantragt!", "bestreitet", true, true],
  ["hab nix bentragt", "bestreitet", true, true],
  ["Habe nie was beantagt", "bestreitet", true, true],
  ["nichts bestelt!!", "bestreitet", true, true],
  ["hab ich nie beantragt", "bestreitet", true, true],
  ["Hab ich nie", "bestreitet", true, true],
  ["Das hab ich nie gemacht", "bestreitet", true, true],
  ["Ich hab mich nie angemeldet", "bestreitet", true, true],
  ["Ich habe nie etwas bei Ihnen bestellt", "bestreitet", true, true],
  ["Ich habe keinen Antrag gestellt", "bestreitet", true, true],
  ["hab nix ausgefüllt", "bestreitet", true, true],
  ["Kenn ich nicht", "bestreitet", true, true],
  ["Ich kenne Sie nicht", "bestreitet", true, true],
  ["Wer ist Fiaon? Kenne euch gar nicht", "bestreitet", true, true],
  ["Noch nie von Ihnen gehört", "bestreitet", true, true],
  ["Das war ich nicht", "bestreitet", true, true],
  ["Hab nichts beantragt woher haben sie meine nummer", "bestreitet", true, true],
  ["nie bei ihnen was bestellt was soll das 😡", "bestreitet", true, true],
  ["Betrug! Ich habe nie etwas bestellt 😡", "bestreitet", true, true],
  // Nachbesserung E-264 (Gegenlesen): bisher übersehen
  ["Ich habe das nicht ausgefüllt, das war nicht ich", "bestreitet", true, true],
  ["Ich weiß nicht wovon Sie reden", "bestreitet", true, true],
  ["Keine Ahnung was das soll 😡", "bestreitet", true, true],
  ["Mein Sohn hat das wohl gemacht, ich will das nicht", "bestreitet", true, true],
  ["Ich habe keine Kredit gemacht keine Übergang nix", "bestreitet", true, true],
  ["falsche nummer", "falsche_nummer", true, true],
  ["Sie haben die falsche Nummer", "falsche_nummer", true, true],
  ["Falsch verbunden", "falsche_nummer", true, true],
  ["Sie verwechseln mich", "falsche_nummer", true, true],
  ["Lassen Sie mich in Ruhe", "in_ruhe", true, true],
  ["lasst mich in ruhe!!", "in_ruhe", true, true],
  ["lassen sie mich bitte in ruhe", "in_ruhe", true, true],
  ["Hören Sie auf!", "in_ruhe", true, true],
  ["Ich will nichts von Ihnen", "in_ruhe", true, true],
  ["Bitte keinen Kontakt mehr, ich habe mich dagegen entschieden", "in_ruhe", true, true],
  ["Belästigen Sie mich nicht", "in_ruhe", true, true],
  ["Für was muss zahlen bitte ich weiß nix", "rueckfrage", false, true],
  ["😡😡😡", "wut", false, true],
  ["🤮", "wut", false, true],
  ["Betrug!!", "betrug", false, false],
  ["Das ist Spam", "betrug", false, false],
  ["Abzocke 😡", "betrug", false, false],
  ["Betrüger", "betrug", false, false],
  ["woher haben sie meine nummer", "datenfrage", false, false],
  ["Woher habt ihr meine Handynummer??", "datenfrage", false, false],
  ["woher meine nummer?", "datenfrage", false, false],
  ["Wie kommen Sie an meine Daten?", "datenfrage", false, false],
  ["Woher kennen Sie mich?", "datenfrage", false, false],
  ["wer sind sie", "wer", false, false],
  ["Wer ist das?", "wer", false, false],
  ["Wer bist du", "wer", false, false],
];
for (const [t, art, stopp, fest] of JA) {
  const b = ton.abstreitenArt(t);
  ok(b?.art === art && b?.stopp === stopp && b?.fest === fest, `„${t}“ → ${art}${stopp ? " (Stopp)" : ""}${fest ? " (fester Satz)" : " (Modell)"} (ist ${b ? `${b.art}${b.stopp ? ", Stopp" : ""}${b.fest ? ", fest" : ", Modell"}` : "nichts"})`);
}
const NEIN = [
  "Ich habe noch nichts bestellt, wie geht das?",
  "Ich habe noch keinen Antrag gestellt",
  "Ich möchte die Karte bestellen",
  "Wie kann ich bezahlen?",
  "Ist das Betrug?",
  "Ist das seriös oder Abzocke?",
  "Das Wort Rahmen kenne ich nicht, was heißt das?",
  "Ich kenne mich damit nicht aus",
  "Ich habe nicht verstanden",
  "Hab ich noch nicht gemacht",
  "Ich habe den Antrag nie abgeschlossen, weil die Seite hing",
  "Ich habe das Formular nie ganz ausgefüllt",
  "Ich warte seit 3 Tagen auf meine Karte 😡",
  "Kein Interesse",
  "Stopp",
  "Ich habe schon bezahlt",
  "Warum soll ich vorher zahlen?",
  "Wer ruft mich an?",
  "Ok 👍",
  "Hallo, wie kann ich das bezahlen?",
  "Ich hatte keinen Kredit beantragt sondern eine Karte",
  "Ich habe noch nie eine Kreditkarte gehabt, geht das trotzdem?",
  // Reine Stopp-Wünsche sind kein Abstreiten — dafür gibt es den bestehenden Stopp-Weg.
  "Bitte schreiben Sie mir nicht mehr",
  "Ich will keine Nachrichten mehr von euch",
  "Stopp. Bitte keine Werbung mehr.",
  // Nachbesserung E-264 (Gegenlesen): Fehlalarme der ersten Fassung — Technik, Datenkorrektur, Höflichkeit, Spam-Ordner
  "Ich konnte nichts beantragen, die Seite lädt nicht",
  "Ich habe eine falsche E-Mail-Adresse angegeben, können Sie das ändern?",
  "Link geht nicht 😡",
  "Immer noch nichts 😡",
  "Los gehts 😤💪",
  "Ihre Mail landete im Spam. Ich möchte weitermachen.",
  "Ich dachte erst das ist Fake, aber jetzt will ich doch weitermachen",
  "Ich habe Angst dass das Betrug ist. Wie funktioniert das genau?",
  "Ich will Sie nicht belästigen, aber wann kommt meine Karte?",
  "Ich habe Tag und Monat verwechselt, kann man das ändern?",
  "Sie haben eine falsche Adresse von mir, ich bin umgezogen",
  "Habe nie einen Kredit beantragt, nur die Karte",
  "Ich habe nichts beantragt, würde aber gerne eine Karte haben",
  "Ich konnte mich nie registrieren, Fehlermeldung",
  "Ich habe nichts eingetragen, der Link geht nicht",
  "Ihre Mail war im Spam Ordner",
  "Ich hatte schon so viele Betrüger am Telefon deshalb frage ich lieber nach.",
  "Ich habe bei dem Antrag eine falsche Adresse eingetragen",
  "Sorry hab den Termin verwechselt",
  "Hab ich nicht gemacht, mache ich heute Abend",
  "Die Überweisung hab ich nicht gemacht weil der Link nicht ging",
  "Ich habe nichts eingetragen weil die Seite nicht lädt",
  "Doch, das war meine Frau, wir machen weiter",
  "Wofür zahle ich die 59,99 €?",
];
for (const t of NEIN) { const b = ton.abstreitenArt(t); ok(!b, `kein Abstreiten: „${t}“${b ? ` (erkannt als ${b.art}: „${b.treffer}“)` : ""}`); }
for (const t of ["Bitte schreiben Sie mir nicht mehr", "Ich will keine Nachrichten mehr von euch", "Stopp. Bitte keine Werbung mehr.", "Stopp", "nicht mehr anschreiben bitte", "Bitte keinen Kontakt mehr"]) ok(ton.stoppWunsch(t), `Stopp-Wunsch (bestehender Stopp-Weg): „${t}“`);
for (const t of ["Ich habe keine Nachrichten von der Bank bekommen", "Wie kann ich bezahlen?", "Löschen"]) ok(!ton.stoppWunsch(t), `kein Stopp-Wunsch: „${t}“`);
const cFall = ton.bausteinAbstreiten({ kanal: "whatsapp", art: "bestreitet", herkunft: null });
ok(ton.nachAbstreiten(cFall) && ton.nachAbstreiten(ton.bausteinAbstreiten({ kanal: "whatsapp", art: "bestreitet", herkunft: null, abgeschickt: true }))
  && ton.nachAbstreiten(ton.bausteinAbstreiten({ kanal: "whatsapp", art: "falsche_nummer", herkunft: null }))
  && ton.nachAbstreiten(ton.bausteinAbstreiten({ kanal: "whatsapp", art: "wut", herkunft: null }))
  && ton.nachAbstreiten(ton.bausteinAbstreiten({ kanal: "whatsapp", art: "rueckfrage", herkunft: null }))
  && !ton.nachAbstreiten("Sehr gern!"), "nachAbstreiten erkennt jede feste Antwort (C, B, falsche Nummer, Wut, Rückfrage)");
for (const t of ["Doch, das war meine Frau, wir machen weiter", "Ich will doch weitermachen", "Ich möchte doch den Antrag fertig machen"]) ok(ton.willWeitermachen(t), `will weitermachen: „${t}“`);
for (const t of ["Ich will das nicht", "Schreiben Sie mir nicht mehr", "Wer sind Sie?"]) ok(!ton.willWeitermachen(t), `will NICHT weitermachen: „${t}“`);
// Wut-Emojis sind keine Bestätigung (sonst schwiege Mara), 👍 bleibt eine.
ok(!ton.istReineBestaetigung("😡😡") && !ton.istReineBestaetigung("🤮") && ton.istReineBestaetigung("👍") && ton.istReineBestaetigung("Ok danke"), "„😡😡“/„🤮“ sind keine Bestätigung, „👍“/„Ok danke“ schon");
ok(!ton.istAutoantwort("Hab nix beantragt 🤢🤮😡😤😠", { sekundenNachUnserer: 13 }), "„Hab nix beantragt“ ist keine Autoantwort");
// Löschwunsch
for (const t of ["Löschen Sie meine Daten", "Bitte löschen sie sofort alle meine Daten!", "Meine Daten bitte löschen", "Ich verlange die Löschung meiner Daten nach DSGVO", "daten löschen",
  "Ich habe alles gelesen, bitte alles löschen weil diese Gebühren zu hoch sind", "Ja bitte die Anfrage an alles dazu Löschen, danke", "Löschen Sie mich bitte", "Können Sie bitte meine Daten löschen?"]) ok(ton.istLoeschwunsch(t), `Löschwunsch: „${t}“`);
ok(ton.istLoeschwunsch("Löschen", { angeboten: true }) && ton.istLoeschwunsch("Ja bitte löschen", { angeboten: true }), "„Löschen“ / „Ja bitte löschen“ nach unserem Angebot → Löschwunsch");
ok(!ton.istLoeschwunsch("Löschen") && !ton.istLoeschwunsch("Soll ich den Antrag löschen?") && !ton.istLoeschwunsch("Ja"), "„Löschen“ ohne Angebot, eine Frage, ein „Ja“ → kein Löschwunsch");
ok(!ton.istLoeschwunsch("Wie kann ich im Antrag falsche Daten löschen und neu eingeben"), "„Wie kann ich im Antrag falsche Daten löschen …“ → kein Löschwunsch (Gegenlesen E-264)");
ok(ton.loeschenAngeboten(cFall) && !ton.loeschenAngeboten(ton.bausteinAbstreiten({ kanal: "whatsapp", art: "bestreitet", herkunft: null, abgeschickt: true })), "Löschen angeboten nur bei Stufe C, nie bei B");

// ═══ 3. DIE ANTWORTEN ═════════════════════════════════════════════════════
abschnitt("3 · Die Antworten — ehrlich, ohne Link, ohne Verkauf, durch alle Wände");
const JETZT = new Date("2026-09-29T09:32:00Z");
const H_ANTRAG = { art: "antrag" as const, am: "2026-07-29T08:14:00Z" };
const H_META = { art: "anfrage_meta" as const, am: "2026-09-12T16:40:00Z" };
const faelle: { name: string; text: string; kanal: "whatsapp" | "mail" }[] = [];
for (const kanal of ["whatsapp", "mail"] as const) {
  for (const art of ["bestreitet", "falsche_nummer", "in_ruhe", "wut", "rueckfrage"] as const) {
    for (const [hn, h] of [["Antrag", H_ANTRAG], ["Meta", H_META], ["unbekannt", null]] as const) {
      for (const abgeschickt of [false, true]) {
        faelle.push({ name: `${kanal}/${art}/${hn}${abgeschickt ? "/B" : ""}`, kanal, text: ton.bausteinAbstreiten({ kanal, art, herkunft: h, abgeschickt, betreuer: abgeschickt ? "Florentine" : null, jetzt: JETZT }) });
      }
    }
  }
  faelle.push({ name: `${kanal}/löschen`, kanal, text: ton.loeschAntwort(kanal) });
}
let sauber = 0;
for (const f of faelle) {
  const maengel = [
    ...(f.kanal === "whatsapp" ? sendePruefung(`Hier ist Mara, die digitale Assistentin von FIAON. ${f.text}`) : []),
    ...wandPruefen(f.text).filter((w) => w.art !== "zusage").map((w) => `Wand: ${w.treffer}`),
    ...ton.tonPruefung(f.text, { kanal: f.kanal }).map((b) => `Ton ${b.id}: ${b.treffer}`),
    ...ton.linkPruefung(f.text, { stufe: "antrag_offen", leadCode: "Ab3dEf7hJk" }).map((b) => `Link ${b.art}: ${b.link}`),
    ...(/https?:\/\/|fiaon\.com/i.test(f.text) ? ["enthält einen Link"] : []),
    ...(ton.zahlungOhneAntrag(f.text, { stufe: "antrag_offen" }) ? ["Zahlungssatz"] : []),
    ...(/\b(?:karte\s+bestellen|jetzt\s+starten|angebot|paket|monatsrate|€)\b/i.test(f.text) ? ["Verkauf"] : []),
    ...(/\/B$/.test(f.name) && /löschen wir/.test(f.text) ? ["Löschangebot bei B"] : []),
  ];
  if (maengel.length) console.log(`    ${f.name}: ${maengel.join(" · ")}`); else sauber++;
}
ok(sauber === faelle.length, `${faelle.length} Antworten (WhatsApp/Mail × 5 feste Arten × Herkunft × B/C, dazu Löschen) ohne Mangel (${sauber} sauber)`);
const fall = ton.bausteinAbstreiten({ kanal: "whatsapp", art: "bestreitet", herkunft: H_ANTRAG, jetzt: JETZT });
console.log(`    WhatsApp (Fall 29.09.): „${fall}“`);
ok(/Entschuldigen Sie bitte/.test(fall) && /am 29\. Juli bei einem Antrag auf unserer Internetseite eingetragen/.test(fall), "Fall 29.09.: Entschuldigung + ehrliche Herkunft mit dem Tag aus dem Antrag (29. Juli)");
ok(/Wir schreiben Ihnen ab jetzt nicht mehr/.test(fall) && /auf Wunsch löschen wir Ihre Daten/.test(fall), "… „Wir schreiben Ihnen nicht mehr“ und „auf Wunsch löschen wir Ihre Daten“");
ok(!/Zahlung|Account|Antrag fortsetzen|Karte/i.test(fall), "… kein Wort von Zahlung, Account oder Karte");
ok(fall.length + 52 <= 500, `… kurz genug für WhatsApp (${fall.length + 52} Zeichen mit KI-Hinweis)`);
const b = ton.bausteinAbstreiten({ kanal: "whatsapp", art: "bestreitet", herkunft: H_ANTRAG, abgeschickt: true, jetzt: JETZT });
ok(/Unsere Leitung sieht sich heute an, wie es zu dem Antrag kam/.test(b) && !/löschen wir|nicht mehr/.test(b), "Stufe B (abgeschickt): die Leitung klärt und meldet sich — keine Zusage „nie mehr“, kein Löschangebot");
ok(/Woher genau, prüft unsere Leitung/.test(ton.bausteinAbstreiten({ kanal: "whatsapp", art: "bestreitet", herkunft: null, jetzt: JETZT })), "Ohne Beleg: keine erfundene Herkunft — „Woher genau, prüft unsere Leitung.“");
ok(/Facebook oder Instagram/.test(ton.bausteinAbstreiten({ kanal: "whatsapp", art: "bestreitet", herkunft: H_META, jetzt: JETZT })), "Meta-Lead: „in einem Anfrageformular von FIAON bei Facebook oder Instagram“");
ok(/29\. Juli 2025/.test(ton.herkunftSatz({ art: "antrag", am: "2025-07-29T10:00:00Z" }, "whatsapp", JETZT).satz), "Anderes Jahr: mit Jahreszahl");
const mail = ton.bausteinAbstreiten({ kanal: "mail", art: "bestreitet", herkunft: H_ANTRAG, jetzt: JETZT });
ok(/Ihre E-Mail-Adresse wurde am 29\. Juli/.test(mail) && /\n\n/.test(mail) && /„Löschen“ genügt/.test(mail), "Mail: „Ihre E-Mail-Adresse …“, zwei Absätze, Löschen per kurzer Antwort");
const fn = ton.bausteinAbstreiten({ kanal: "whatsapp", art: "falsche_nummer", herkunft: H_ANTRAG, jetzt: JETZT });
ok(/versehentlich hinterlegt/.test(fn) && !/Juli|Antrag|Internetseite/.test(fn), "Falsche Nummer: keine Daten des eigentlichen Kunden (kein Tag, kein Antrag)");
// E-265 (29.09.2026, Justin „zum letzten Mal!!"): Der Betreuer kommt als Nennform („Frau Lombardi") und wird nie
// auf den Vornamen gekürzt — vorher erwartete dieser Fall „Florentine meldet sich" (split auf das erste Wort).
const rf = ton.bausteinAbstreiten({ kanal: "whatsapp", art: "rueckfrage", herkunft: null, betreuer: "Frau Lombardi", abgeschickt: true, jetzt: JETZT });
ok(/Das kläre ich gern für Sie/.test(rf) && /Frau Lombardi meldet sich/.test(rf) && !/Florentine/.test(rf) && !/Zahlung|€/.test(rf), `Rückfrage: kein Betrag, keine Zahlung, der Betreuer meldet sich mit Nennform („${rf.slice(0, 80)}…“)`);
const rfOhne = ton.bausteinAbstreiten({ kanal: "whatsapp", art: "rueckfrage", herkunft: null, betreuer: "Nikita Boychenko", abgeschickt: true, jetzt: JETZT });
ok(/Nikita Boychenko meldet sich/.test(rfOhne), "Rückfrage: ohne gepflegte Anrede der volle Name, nie der Vorname allein");
const wt = ton.bausteinAbstreiten({ kanal: "whatsapp", art: "wut", herkunft: H_META, jetzt: JETZT });
ok(/„Stopp“/.test(wt) && !/nicht mehr,|löschen wir/.test(wt), "Nur Wut: „Stopp“ genügt — keine Zusage, kein Löschangebot");
// „Wer sind Sie?" / „Woher meine Nummer?": kein fester Satz, ein Hinweis ans Modell
const hw = ton.abstreitenHinweis({ art: "wer", kanal: "whatsapp", herkunft: { art: "antrag", am: "2026-09-28T09:00:00Z" }, betreuer: "Florentine", jetzt: JETZT });
ok(/ER FRAGT, WER WIR SIND/.test(hw) && /am 28\. September bei einem Antrag auf unserer Internetseite eingetragen/.test(hw) && /DEIN LINK/.test(hw) && /Kein Löschangebot/.test(hw) && /Florentine/.test(hw), "„Wer bist du“ (Nachricht 810): Vorstellung, Herkunft, nächster Schritt, kein Löschangebot");
ok(/Erfinde keine Herkunft/.test(ton.abstreitenHinweis({ art: "datenfrage", kanal: "mail", herkunft: null, jetzt: JETZT })), "„Woher meine Adresse?“ ohne Beleg: keine erfundene Herkunft");
ok(ton.personaText("whatsapp").includes("WENN ER BESTREITET") && ton.personaText("mail").includes("WENN ER BESTREITET"), "Das Modell hat eine Regel für übersehenes Abstreiten (WhatsApp und Mail)");
// E-265 Nachbesserung (29.09.2026, Regression r6.mts): „Was ist FIAON?" löscht den Herkunftshinweis nur bei „wer" —
// nie, wenn im selben Satz nach der Nummer oder den Daten gefragt wird (Datenfrage, Art. 15 DSGVO).
for (const t of ["Was ist FIAON und woher haben Sie meine Nummer?", "Wer ist Fiaon? Woher haben Sie meine Daten"]) {
  const art = ton.abstreitenArt(t)?.art ?? null;
  ok(art === "datenfrage" && !wa.herkunftHinweisStreichen(art, ton.fragtWasIstFiaon(t), "kunde"), `„${t}“ (${art}): der belegte Herkunftshinweis bleibt`);
}
ok(wa.herkunftHinweisStreichen("wer", true, "kunde") && !wa.herkunftHinweisStreichen("wer", true, "lead"), "„Wer sind Sie?“ + „Was ist FIAON?“ beim Kunden: kein Herkunftshinweis nötig (beim Lead bleibt er)");

// ═══ 4. HARTE PRÜFUNG ═════════════════════════════════════════════════════
abschnitt("4 · Harte Prüfung: keine Zahlungsaufforderung ohne abgeschickten Antrag — Erklärungen erlaubt");
const ALT = "Hier ist Mara, die digitale Assistentin von FIAON. Sehr gern — nach der Zahlung ist Ihr Account aktiv, und Florentine begleitet Sie Schritt für Schritt weiter. Ihre Zahlungsseite mit Betrag, Verwendungszweck und QR-Code ist hier: https://fiaon.com/zahlung/FIAON-BSP4KX";
const antragOffen = { stufe: "antrag_offen" as const, leadCode: "Ab3dEf7hJk" };
const tl = wa.tonUndLink(ALT, { linkLage: antragOffen });
ok(tl.hart.some((h) => /nie abgeschickt/.test(h)), `Die Antwort vom 29.09. ist ein HARTER Mangel (${tl.hart.length} hart)`);
ok(ton.linkPruefung("https://fiaon.com/zahlung/FIAON-BSP4KX", antragOffen).some((f) => f.art === "ohne_antrag" && f.schwere === "hart"), "Zahlungslink an antrag_offen → hart (ohne_antrag)");
ok(ton.linkPruefung("https://fiaon.com/zahlung/FIAON-BSP4KX", { stufe: "lead", leadCode: "Ab3dEf7hJk" }).some((f) => f.art === "ohne_antrag"), "… an einen Lead → hart");
ok(!!ton.zahlungOhneAntrag("Ihre Zahlungsseite mit Betrag, Verwendungszweck und QR-Code ist hier:", antragOffen), "„Ihre Zahlungsseite … ist hier“ an antrag_offen → Zahlungsaufforderung");
ok(!!ton.zahlungOhneAntrag("Offen ist Ihre erste Rechnung über 59,99 €.", antragOffen), "„Offen ist Ihre erste Rechnung“ → Zahlungsaufforderung");
// Nachbesserung E-264 (Gegenlesen): Lücken der ersten Fassung („\büberweisen" traf nie, Beträge gingen durch)
for (const t of ["Bitte überweisen Sie die 59,99 € bis Freitag.", "Überweisen Sie einfach", "Ihre Rechnung über 59,99 € ist noch offen.", "Die Zahlung von 59,99 € steht noch aus.",
  "Zahlen Sie die 59,99 € einfach per Überweisung.", "Die Zahlungsseite für die 79,99 € bleibt offen, dort stehen Betrag und QR-Code.", "Verwendungszweck: FIAON-BSP4KX", "Sehr gern — überweisen Sie einfach die erste Rate."]) {
  ok(!!ton.zahlungOhneAntrag(t, antragOffen), `gesperrt (C): „${t}“`);
}
for (const t of ["Nach dem Antrag wählen Sie ein Paket und zahlen die erste Monatsrate selbst per Überweisung.", "Für die erste Zahlung brauchen Sie kein Online-Banking.",
  "Nach der ersten Zahlung ist Ihr Account aktiv; nach der Zusage der Bank ist die Karte in der Regel in 2–5 Werktagen bei Ihnen.", "Die erste Rate ist mit dem Vertrag fällig.",
  "Nach dem Abschluss sehen Sie Betrag, Verwendungszweck und QR-Code direkt auf Ihrer Zahlungsseite.", "Sie müssen jetzt noch nichts zahlen.",
  ton.bausteinVorabZahlen({ paketKey: "pro", betreuer: "Florentine", link: "https://fiaon.com/a/Ab3dEf7hJk/w" }), ton.bausteinZuTeuer()]) {
  ok(!ton.zahlungOhneAntrag(t, antragOffen), `erlaubt (C, Erklärung): „${t.slice(0, 90)}“`);
}
ok(!ton.zahlungOhneAntrag("Nach der Zahlung ist Ihr Account aktiv.", { stufe: "zahlung_offen", zahlungsReferenz: "FIAON-BSP4KX" }), "Bei abgeschicktem Antrag (zahlung_offen) bleibt der Satz erlaubt");
ok(ton.linkPruefung("https://fiaon.com/zahlung/FIAON-BSP4KX", { stufe: "zahlung_offen", zahlungsReferenz: "FIAON-BSP4KX" }).length === 0, "… und seine Zahlungsseite auch");
const mitAuskunft = { ...antragOffen, auskunftLink: "https://fiaon.com/zahlung/FIAON-SCHUFA-AB12CD" };
ok(!ton.linkPruefung("Ihre Zahlungsseite für die Bonitätsauskunft: https://fiaon.com/zahlung/FIAON-SCHUFA-AB12CD", mitAuskunft).some((f) => f.schwere === "hart"), "Ausnahme: die Zahlungsseite der bestellten Bonitätsauskunft (E-241)");
ok(ton.linkPruefung("Hier geht es weiter: https://fiaon.com/a/Ab3dEf7hJk/w", antragOffen).length === 0, "Sein Antragslink an antrag_offen → kein Mangel");
ok(!ton.zahlungOhneAntrag("FIAON Start gibt es schon ab 7,99 € im Monat, in zwölf Monatsraten.", { stufe: "lead" }), "Preisauskunft an einen Lead („zwölf Monatsraten“) ist kein Zahlungssatz");

// ═══ 5. DER RÜCKFALL ══════════════════════════════════════════════════════
abschnitt("5 · Rückfall: „beantragt“ ist keine Link-Frage, Verneinung löst nie eine Seite aus");
const zl = "https://fiaon.com/zahlung/FIAON-BSP4KX";
const al = "https://fiaon.com/a/Ab3dEf7hJk/w";
for (const k of ["Hab nix beantragt 🤢🤮😡😤😠", "nie beantragt", "Ich habe nichts bestellt", "hab mich nie angemeldet", "Kein Antrag von mir!", "Ich will keinen Link", "Warum bekomme ich das? Betrug", "Lassen Sie mich in Ruhe mit Ihrem Antrag", "Für was muss zahlen bitte ich weiß nix"]) {
  for (const [stufe, link] of [["zahlung_offen", zl], ["antrag_offen", al], ["lead", al]] as const) {
    ok(wa.sichererSatz({ kunde: k, aktionen: [], link, stufe }) === null, `sichererSatz(${stufe}) auf „${k}“ → kein fester Satz`);
  }
}
ok(/zahlung\/FIAON-BSP4KX/.test(String(wa.sichererSatz({ kunde: "Wie kann ich bezahlen?", aktionen: [], link: zl, stufe: "zahlung_offen" }))), "Gegenprobe: „Wie kann ich bezahlen?“ (abgeschickt) → Zahlungsseite");
ok(/Ihrem Antrag/.test(String(wa.sichererSatz({ kunde: "Wie kann ich bezahlen?", aktionen: [], link: al, stufe: "antrag_offen" }))), "Gegenprobe: „Wie kann ich bezahlen?“ (nicht abgeschickt) → sein Antrag, nie die Zahlungsseite");
ok(/Ihrem Antrag/.test(String(wa.sichererSatz({ kunde: "Wo ist der Link zum Antrag?", aktionen: [], link: al, stufe: "antrag_offen" }))), "Gegenprobe: „Wo ist der Link zum Antrag?“ → sein Antrag");
ok(/zahlung\/FIAON-BSP4KX/.test(String(wa.sichererSatz({ kunde: "Schicken Sie mir bitte den Zahlungslink", aktionen: [], link: zl, stufe: "zahlung_offen" }))), "Gegenprobe: „Schicken Sie mir bitte den Zahlungslink“ (abgeschickt) → Zahlungsseite (Wortgrenzen brechen nichts)");
ok(/Ihrem Antrag/.test(String(wa.sichererSatz({ kunde: "Wie komme ich zur Anmeldung?", aktionen: [], link: al, stufe: "lead" }))), "Gegenprobe: „Wie komme ich zur Anmeldung?“ → sein Antrag");
ok(wa.heikelAnliegen("Hab nix beantragt") && wa.heikelAnliegen("falsche Nummer") && wa.heikelAnliegen("Für was muss zahlen bitte ich weiß nix") && !wa.heikelAnliegen("Wer sind Sie?"), "Abstreiten und Rückfrage sind heikel (keine Reaktivierung, kein Zahlungssatz), „Wer sind Sie?“ nicht");

// ═══ 6. FOLGEN JE ART ══════════════════════════════════════════════════════
abschnitt("6 · Folgen je Art (abstreitenFolgen) — wer wird gesperrt, wer bekommt die Aufgabe");
const ab = await import("../server/lib/fiaon-mara-abstreiten");
const F = ab.abstreitenFolgen;
ok(F("bestreitet", false).werbesperre && !F("bestreitet", true).werbesperre, "bestreitet: Werbesperre bei C, bei B entscheidet die Leitung (keine automatische Sperre)");
ok(!F("falsche_nummer", false).werbesperre && F("falsche_nummer", false).an === "leitung", "falsche Nummer: KEINE Werbesperre an der Person (der eigentliche Kunde), die Leitung korrigiert");
ok(F("in_ruhe", true).werbesperre, "„Lassen Sie mich in Ruhe“: Werbesperre — er hat darum gebeten");
ok(!F("wut", false).werbesperre && !F("rueckfrage", true).werbesperre && F("rueckfrage", true).an === "betreuer", "Wut und Rückfrage: keine Sperre; die Rückfrage geht an den Betreuer");
ok(F("loeschen", true).werbesperre && F("loeschen", true).dringend, "Löschwunsch: Werbesperre, dringend, Leitung");

// ═══ 7. DIE HERKUNFT ══════════════════════════════════════════════════════
abschnitt("7 · Herkunft: die früheste BELEGTE Quelle — nie die Betreuer-Anlage, nie der jüngste Antrag");
const H = ab.fruehesteHerkunft;
const h5149 = H("2026-08-21T10:00:00Z", []);
ok(h5149?.art === "antrag" && new Date(h5149.am as any).toISOString().startsWith("2026-08-21"), "Person 5149: Web-Antrag am 21.08. — nicht die Betreuer-Anlage vom 23.09.");
const hMeta = H("2026-09-20T10:00:00Z", [{ erstellt_am: "2026-09-12T16:40:00Z", quelle: "facebook_lead_ads" }, { erstellt_am: "2026-07-01T00:00:00Z", quelle: "import" }]);
ok(hMeta?.art === "anfrage_meta" && new Date(hMeta.am as any).toISOString().startsWith("2026-09-12"), "Meta-Anfrage vor dem Antrag → die Anfrage zählt; „import“ sagt nicht, woher");
ok(H(null, [{ erstellt_am: "2026-07-01T00:00:00Z", quelle: "import" }]) === null, "Nur ein Import, kein Web-Antrag (Betreuer-Anlage, Akte-Anker) → unbekannt („prüft unsere Leitung“)");
ok(H(null, [{ erstellt_am: "2026-09-01T00:00:00Z", quelle: "whatsapp_eingang" }])?.art === "whatsapp", "Erste WhatsApp als Quelle");

console.log(`\n${fehler ? "✗" : "✓"} ${geprueft - fehler}/${geprueft} Prüfungen bestanden${MIT_DB ? " (mit DB)" : " (offline)"}`);
process.exit(fehler ? 1 : 0);
