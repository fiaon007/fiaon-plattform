// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-401 (1/6), OFFLINE: Eine Mail — eine Einordnung, ein Aktenvermerk (19.10.2026)
//
// Geprüft wird das Reine: der Merker an der Postmeister-Zeile (shared/fiaon-postmeister-merker.ts), der
// Fingerabdruck der Einordnungs-Anfrage und dass die gemerkte Einordnung dasselbe ergibt wie die frische
// (der Riegel läuft neu). Der Datenbank-Teil mit ganzen Takten steht in pruef-postmeister-einmal-db.ts.
//   env -i HOME=$HOME PATH=$PATH TZ=Europe/Berlin DATABASE_URL=postgresql://pruef@127.0.0.1:9/keine \
//     node_modules/.bin/tsx scripts/pruef-postmeister-einmal.ts
// Kein Netz, keine Datenbank, keine Schlüssel.
// ═══════════════════════════════════════════════════════════════════════════
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_SA_KEY", "GMAIL_CLIENT_SECRET", "TWILIO_AUTH_TOKEN"]) delete process.env[k];
process.env.DATABASE_URL = "postgresql://pruef@127.0.0.1:9/keine";
process.env.CRONS = "aus";

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra: unknown = "") {
  if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}${extra ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra)}` : ""}`); }
}

async function main() {
  const M = await import("../shared/fiaon-postmeister-merker");
  const agent = await import("../server/lib/fiaon-postmeister-agent");

  console.log("── 1 · Kopf des Aktenvermerks bleibt wortgleich (alte Vermerke werden wiedergefunden)");
  const lang = "Re: " + "x".repeat(120);
  ok(M.akteVermerkKopf("welcome@fiaon.com", "Re: Kurz zu Ihrer Überweisung") === "E-Mail an welcome@fiaon.com: „Re: Kurz zu Ihrer Überweisung\" — ", "Kopf wie seit E-094");
  ok(M.akteVermerkKopf("support@fiaon.com", lang).length === `E-Mail an support@fiaon.com: „" — `.length + 90, "Betreff auf 90 Zeichen gekürzt");
  ok(M.akteVermerkText("support@fiaon.com", "Frage", "z".repeat(600)).endsWith("z".repeat(400)) && !M.akteVermerkText("support@fiaon.com", "Frage", "z".repeat(600)).includes("z".repeat(401)), "Zusammenfassung auf 400 Zeichen");

  console.log("── 2 · Rohe Einordnung säubern — dieselben Grenzen wie einordnen() seit E-094");
  const s1 = M.einordnungRohSaeubern({ kategorien: [], flags: { kuendigung: true, kaputt: "ja" }, dringend: 1, sprache: "deutsch", fragen: Array(12).fill("F?"), zusammenfassung: "y".repeat(700) });
  ok(Array.isArray(s1?.kategorien) && s1!.kategorien.length === 0, "leere Kategorienliste bleibt leer (wie vorher — der Lauf nimmt dann „sonstiges“)", s1?.kategorien);
  ok(s1?.flags.kuendigung === true && !("kaputt" in (s1?.flags ?? {})), "Merker nur mit Wahr/Falsch-Werten", s1?.flags);
  ok(s1?.dringend === true && s1?.sprache === "deuts" && s1?.fragen.length === 8 && s1?.zusammenfassung.length === 500, "dringend, Sprache 5 Zeichen, 8 Fragen, 500 Zeichen");
  ok(JSON.stringify(M.einordnungRohSaeubern({ kategorien: "zahlung" })?.kategorien) === '["sonstiges"]', "Kategorien keine Liste → „sonstiges“ (wie vorher)");
  ok(M.einordnungRohSaeubern(null) === null && M.einordnungRohSaeubern("kaputt{") === null && M.einordnungRohSaeubern([1, 2]) === null, "kein Objekt → null");
  const s2 = M.einordnungRohSaeubern(s1);
  ok(JSON.stringify(s2) === JSON.stringify(s1), "Säubern zweimal = einmal (der Merker trägt dasselbe wie der erste Lauf)");

  console.log("── 3 · Merker lesen: nur zur SELBEN Anfrage, nur brauchbar");
  const roh = { kategorien: ["zahlung"], flags: { zahlung_behauptet: true }, dringend: false, sprache: "de", fragen: ["Ist meine Zahlung da?"], zusammenfassung: "Kunde meldet Zahlung." };
  const m = M.einordnungMerkerBauen("fp-a", roh, true, new Date("2026-10-19T07:39:21Z"));
  ok(m.v === 1 && m.fp === "fp-a" && m.auskunft === true && m.am === "2026-10-19T07:39:21.000Z", "Merker gebaut (Fassung, Fingerabdruck, Auskunft-Stand, Zeit)");
  ok(M.einordnungMerkerLesen(m, "fp-a")?.roh.zusammenfassung === "Kunde meldet Zahlung.", "gleicher Fingerabdruck → gilt");
  ok(M.einordnungMerkerLesen(m, "fp-b") === null, "anderer Fingerabdruck (Mail oder Auftrag geändert) → gilt nicht");
  ok(M.einordnungMerkerLesen(JSON.stringify(m), "fp-a") !== null, "als Text (jsonb-Text-Altform) → gilt");
  ok(M.einordnungMerkerLesen(JSON.stringify(JSON.stringify(m)), "fp-a") !== null, "doppelt als Text verpackt → gilt");
  ok(M.einordnungMerkerLesen({ ...m, v: 2 }, "fp-a") === null, "andere Fassung → gilt nicht");
  ok(M.einordnungMerkerLesen({ ...m, roh: { ...m.roh, flags: null } }, "fp-a") === null, "ohne Merkmale → gilt nicht");
  ok(M.einordnungMerkerLesen({ ...m, roh: { ...m.roh, kategorien: "zahlung" } }, "fp-a") === null, "Kategorien keine Liste → gilt nicht");
  ok(M.einordnungMerkerLesen({ ...m, roh: { ...m.roh, zusammenfassung: 5 } }, "fp-a") === null, "Zusammenfassung kein Text → gilt nicht");
  ok(M.einordnungMerkerLesen(null, "fp-a") === null && M.einordnungMerkerLesen("{kaputt", "fp-a") === null && M.einordnungMerkerLesen(m, "") === null, "leer, kaputt, ohne Fingerabdruck → gilt nicht");

  console.log("── 4 · Wann nach einem alten Vermerk suchen? Nur beim Altbestand");
  ok(M.altenVermerkSuchen({ neuAngelegt: false, vermerkMerker: null, einordnungMerker: null }), "Zeile von früher, kein Merker → alten Vermerk suchen (Altbestand, KI-Pause E-246)");
  ok(!M.altenVermerkSuchen({ neuAngelegt: true, vermerkMerker: null, einordnungMerker: null }), "in diesem Lauf angelegt → nicht suchen, schreiben");
  ok(!M.altenVermerkSuchen({ neuAngelegt: false, vermerkMerker: new Date(), einordnungMerker: null }), "Vermerk-Merker gesetzt → nichts suchen (schon da)");
  ok(!M.altenVermerkSuchen({ neuAngelegt: false, vermerkMerker: null, einordnungMerker: m }), "schon mit Merker eingeordnet (neuer Code) → nicht suchen: der Merker entscheidet");

  console.log("── 5 · Fingerabdruck der Anfrage");
  const a = { betreff: "Re: Kurz zu Ihrer Überweisung", text: "Ich habe gestern überwiesen.", von: "Sam Probe <sam.probe@kunde.invalid>" };
  const fa = agent.einordnungFingerabdruck(a);
  ok(/^[0-9a-f]{32}$/.test(fa), "32 Hex-Zeichen", fa);
  ok(agent.einordnungFingerabdruck({ ...a }) === fa, "dieselbe Mail → derselbe Fingerabdruck (auch einen Tag später: das Alter zählt nicht)");
  ok(agent.einordnungFingerabdruck({ ...a, text: a.text + " Beleg anbei." }) !== fa, "anderer Text → anderer Fingerabdruck");
  ok(agent.einordnungFingerabdruck({ ...a, betreff: "Überweisung" }) !== fa, "anderer Betreff → anderer Fingerabdruck");
  ok(agent.einordnungFingerabdruck({ ...a, von: "sam.probe@kunde.invalid" }) !== fa, "anderer Absender → anderer Fingerabdruck");

  console.log("── 6 · Gemerkte Einordnung = frische Einordnung, der Riegel läuft neu");
  const mail = { betreff: "Re: Ihr Antrag", text: "Ich habe nie etwas bei Ihnen beantragt! Löschen Sie bitte sofort meine Daten." };
  const rohModell = M.einordnungRohSaeubern({ kategorien: ["sonstiges"], flags: { bestreitet: false, stopp: false }, dringend: false, sprache: "de", fragen: [], zusammenfassung: "Kunde ist verärgert." })!;
  const e1 = agent.einordnungAusRoh(mail, rohModell, false);
  ok(e1.flags.bestreitet && e1.flags.stopp && e1.flags.rechtlich && e1.dringend, "Riegel: Bestreiten + Löschwunsch (Stopp, rechtlich, dringend) — obwohl das Modell es nicht meldete", e1.flags);
  const gemerkt = M.einordnungMerkerLesen(JSON.parse(JSON.stringify(M.einordnungMerkerBauen("fp", rohModell, false, new Date()))), "fp")!;
  const e2 = agent.einordnungAusRoh(mail, gemerkt.roh, gemerkt.auskunft);
  ok(JSON.stringify(e2) === JSON.stringify(e1), "aus dem Merker (nach JSON hin und zurück) GENAU dieselbe Einordnung");
  const mitAuskunft = agent.einordnungAusRoh({ betreff: "Re: Ihre Unterlagen", text: "Ich hab keine." }, M.einordnungRohSaeubern({ kategorien: ["sonstiges"], flags: {}, dringend: false, sprache: "de", fragen: [], zusammenfassung: "Kurz." })!, true);
  const ohneAuskunft = agent.einordnungAusRoh({ betreff: "Re: Ihre Unterlagen", text: "Ich hab keine." }, M.einordnungRohSaeubern({ kategorien: ["sonstiges"], flags: {}, dringend: false, sprache: "de", fragen: [], zusammenfassung: "Kurz." })!, false);
  ok(mitAuskunft.flags.auskunft_fehlt && mitAuskunft.kategorien.includes("auskunft") && !ohneAuskunft.flags.auskunft_fehlt, "Auskunft-Stand des ersten Laufs reist im Merker mit (E-240: „Ich hab keine.“)");

  console.log("── 7 · Nachbesserung: von einem Menschen erledigt — alle Wege (menschErledigt)");
  for (const b of ["vom Menschen beantwortet (Gmail, 28.09. 14:08) — keine zweite Antwort", "Nicht beantwortet — Entscheidung Justin (E-371)",
    "Verworfen: ohne Angabe", "Vom Betreuer übernommen (Herr Probe): selbst beantwortet", "Nicht mehr nötig (24-Stunden-Regel): Gespräch geführt",
    "Dieselbe Mail liegt auch in welcome@fiaon.com", "Doppel von Mail #7 — derselbe Text noch einmal geschickt; nur eine Antwort (E-248)"]) {
    ok(M.menschErledigt("geordnet", b), `erledigt: „${b.slice(0, 50)}“`);
  }
  ok(!M.menschErledigt("geordnet", "Alt-Entwurf ohne Belege (erste Fassung, ungedeckt)") && !M.menschErledigt("geordnet", "KI pausiert — wartet")
    && !M.menschErledigt("entwurf", "Verworfen: x") && !M.menschErledigt("geordnet", null), "offen bleiben: Alt-Entwurf (neu beantworten), KI-Pause, andere Aktion, leer");
  const { ablageBegruendung } = await import("../shared/fiaon-entwurf-frist");
  ok(M.menschErledigt("geordnet", ablageBegruendung("Der Kunde hat danach geschrieben")), "die Ablage der 24-Stunden-Regel trägt genau den erkannten Kopf (ablageBegruendung)");

  console.log(`\n${gut} gut, ${schlecht} schlecht`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
