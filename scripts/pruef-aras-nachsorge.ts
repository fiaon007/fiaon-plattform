// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-408 Scheibe 3 (Koordination 22.10.2026): Kunden mit Vertrag nach ARAS-Anrufen
//   1. Mailbox → Raten-Erinnerung (WhatsApp, sonst Mail) mit allen Bremsen
//   2. Zahltag-Erinnerung am Morgen (09:00–10:00 Berlin), je Zusage einmal
//   3. Zusage nachfassen am ersten Tag nach der Überweisungszeit — und ARAS sagt genau das
//   4. Beste Uhrzeit je Kunde (Tagesabschnitt, in dem er früher abgenommen hat)
//   5. Aufnahmen und Abschriften von ARAS-Gesprächen nach 90 Tagen löschen (Twilio-Attrappe)
// Teil A rein (ohne DB), Teil B gegen die LOKALE Prüf-DB — nie gegen die Produktion. Nichts geht raus: Der Versand ist eine
// Attrappe (statt werkzeugAusfuehren), Twilio ist eine Attrappe (twilioClientSetzen). Prüfkunden 800–849, erfundene Nummern.
//
//   export PGSSLMODE=require; createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand_e408_basis fiaon_pruefstand_kunden
//   U="postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_kunden?sslmode=require"
//   env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin CRONS=aus DATABASE_URL="$U" DATABASE_URL_EXTERN="$U" node scripts/run-migrations.mjs
//   env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin CRONS=aus DATABASE_URL="$U" DATABASE_URL_EXTERN="$U" node_modules/.bin/tsx scripts/pruef-aras-nachsorge.ts
//   dropdb -h 127.0.0.1 -p 54329 -U fiaon fiaon_pruefstand_kunden
// Ohne lokale DB (DATABASE_URL zeigt woanders hin) läuft nur Teil A.
// ═══════════════════════════════════════════════════════════════════════════
delete process.env.OPENAI_API_KEY; delete process.env.BREVO_API_KEY; delete process.env.TWILIO_ACCOUNT_SID; delete process.env.TWILIO_AUTH_TOKEN;
delete process.env.WHATSAPP_TOKEN; delete process.env.META_WA_TOKEN;
if (process.env.NODE_ENV === "production") throw new Error("Nie in Produktion.");

let gut = 0, schlecht = 0;
const ok = (was: string, b: unknown, fund = "") => { if (b) { gut++; console.log(`  ok    ${was}`); } else { schlecht++; console.log(`  ROT   ${was}${fund ? `  →  ${fund}` : ""}`); } };
const titel = (t: string) => console.log(`\n${"─".repeat(74)}\n${t}\n${"─".repeat(74)}`);
/** Berliner Wandzeit („2026-10-22 10:30“) als Date — MESZ (+02:00) bis 25.10.2026, danach MEZ (+01:00). */
const berlin = (s: string, offset = "+02:00") => new Date(`${s.replace(" ", "T")}:00${offset}`);

async function main(): Promise<void> {
  const S = await import("../shared/fiaon-aras");
  const E = await import("../server/lib/fiaon-aras-erinnerung");
  const A = await import("../server/lib/fiaon-aras-aufbewahrung");
  const F = S.FENSTER_VORGABE;

  // ══ TEIL A — rein ══════════════════════════════════════════════════════
  titel("A1. ZUSAGE NACHFASSEN: am ersten Tag nach der Überweisungszeit (zugesagter Tag + 2 Bank-Werktage), mit Raten-Fenster");
  ok("Zusage Mi 21.10. → Pause bis Fr 23.10. → Nachfassen Sa 24.10. (Fenster Mo–Sa)", S.zusageNachfassTag("2026-10-21", { fenster: F }) === "2026-10-24", S.zusageNachfassTag("2026-10-21", { fenster: F }));
  ok("Zusage Do 22.10. → Pause bis Mo 26.10. → Nachfassen Di 27.10.", S.zusageNachfassTag("2026-10-22", { fenster: F }) === "2026-10-27", S.zusageNachfassTag("2026-10-22", { fenster: F }));
  ok("Zusage Fr 23.10. → Pause bis Di 27.10. → Nachfassen Mi 28.10.", S.zusageNachfassTag("2026-10-23", { fenster: F }) === "2026-10-28");
  ok("Fenster nur Mo–Fr: Zusage Mi 21.10. → Sa fällt weg → Mo 26.10.", S.zusageNachfassTag("2026-10-21", { fenster: { verkauf: { "1-5": ["09:30", "21:00"] }, rate: { "1-5": ["09:30", "21:00"] } } }) === "2026-10-26");
  ok("Feiertag: Zusage Di 28.04.2026 → wiederAb Fr 01.05. (Tag der Arbeit) → Nachfassen Sa 02.05.", S.zusagePause("2026-04-28").wiederAb === "2026-05-01" && S.zusageNachfassTag("2026-04-28", { fenster: F }) === "2026-05-02", `${S.zusagePause("2026-04-28").wiederAb} → ${S.zusageNachfassTag("2026-04-28", { fenster: F })}`);
  ok("Weihnachten: Zusage Mi 23.12. → Pause bis Mo 28.12. → Nachfassen Di 29.12.", S.zusageNachfassTag("2026-12-23", { fenster: F }) === "2026-12-29", S.zusageNachfassTag("2026-12-23", { fenster: F }));
  ok("ROT-PROBE (die alte Regel): nie „am Tag danach“ — Zusage 21.10. wird NICHT am 22.10. nachgefasst", S.zusageNachfassTag("2026-10-21", { fenster: F }) !== "2026-10-22");
  ok("Raten-Fenster je Tag: So nie (ohne „7“), Feiertag nie, Mo–Sa ja", !S.rateFensterTag("2026-10-25", { fenster: F }) && !S.rateFensterTag("2026-12-25", { fenster: F }) && S.rateFensterTag("2026-10-24", { fenster: F }) && S.rateFensterTag("2026-10-26", { fenster: F }));
  ok("Feiertag im Land: 26.10. ist in AT frei (Nationalfeiertag), in DE nicht", !S.rateFensterTag("2026-10-26", { land: "AT", fenster: F }) && S.rateFensterTag("2026-10-26", { land: "DE", fenster: F }));

  titel("A2. ARAS SAGT DIE WAHRHEIT (zahlungszusage_merken)");
  const satz = S.zusageNotiertSatz("2026-10-23");
  ok("„Notiert: Sie überweisen am 23.10. Falls bis 28.10. nichts angekommen ist, melde ich mich kurz.“ (28.10. = wiederAb)", satz === "Notiert: Sie überweisen am 23.10. Falls bis 28.10. nichts angekommen ist, melde ich mich kurz.", satz);
  ok("Das Datum im zweiten Satz ist wiederAb (zusagePause)", satz.includes(`bis ${S.zusagePause("2026-10-23").wiederAb.split("-").reverse().slice(0, 2).join(".")}. `));
  ok("ROT-PROBE: kein „Am Tag danach melde ich mich“ mehr", !/Tag danach/i.test(satz) && !/Tag danach/i.test(S.zusageNotiertSatz("2026-10-21")));
  const { druckFinden } = await import("../shared/fiaon-aras");
  const { wandPruefen } = await import("../shared/fiaon-wortverbote");
  ok("Satz: kein Druck, Wortwand ohne harten Treffer", druckFinden(satz) === null && wandPruefen(satz).filter((f) => f.art === "verboten" || f.art === "zusage").length === 0);

  titel("A3. BESTE UHRZEIT JE KUNDE (abschnittWahlBeste) — verschiebt nur, nie gegen Fenster, Grenzen oder Vorrang");
  const wahl = (o: { spielart?: S.Spielart; erreicht?: string | null; letzter?: string | null; fehl?: number; jetzt: string; fenster?: typeof F }) =>
    S.abschnittWahlBeste({ spielart: o.spielart ?? "rate", fehlFolge: o.fehl ?? 0, letzterVersuchAm: o.letzter ? berlin(o.letzter) : (o.erreicht ? berlin(o.erreicht) : null),
      erreichtAm: o.erreicht ? berlin(o.erreicht) : null, jetzt: berlin(o.jetzt), fenster: o.fenster ?? F });
  const w1 = wahl({ erreicht: "2026-10-20 10:15", jetzt: "2026-10-22 10:40" });
  ok("Vormittags abgenommen, jetzt Vormittag → jetzt (beste_zeit)", w1.wahl === "jetzt" && w1.grund === "beste_zeit", JSON.stringify(w1));
  const w2 = wahl({ erreicht: "2026-10-20 18:30", jetzt: "2026-10-22 10:40" });
  ok("Abends abgenommen, jetzt Vormittag → später (der Abend kommt heute im Fenster noch)", w2.wahl === "spaeter" && w2.grund === "beste_zeit", JSON.stringify(w2));
  const w3 = wahl({ erreicht: "2026-10-20 10:15", jetzt: "2026-10-22 13:10" });
  ok("Vormittags abgenommen, jetzt Mittag → notfalls (sein Abschnitt ist heute vorbei)", w3.wahl === "notfalls" && w3.grund === "beste_zeit", JSON.stringify(w3));
  const samstagKurz = { verkauf: { "6": ["09:30", "14:00"] }, rate: { "6": ["09:30", "14:00"] } } as typeof F;
  const w4 = wahl({ erreicht: "2026-10-20 18:30", jetzt: "2026-10-24 10:00", fenster: samstagKurz });
  ok("ROT-PROBE Fenster: Abends abgenommen, Samstag nur bis 14:00 → notfalls, nie „warten auf den Abend“ außerhalb des Fensters", w4.wahl === "notfalls", JSON.stringify(w4));
  ok("ROT-PROBE Vorrang: Zusage-Nachfassen und gebuchter Rückruf gehen sofort — auch mit Vorliebe Abend", wahl({ spielart: "zusage", erreicht: "2026-10-20 18:30", jetzt: "2026-10-22 10:40" }).wahl === "jetzt" && wahl({ spielart: "termin", erreicht: "2026-10-20 18:30", jetzt: "2026-10-22 10:40" }).wahl === "jetzt");
  const w6 = wahl({ spielart: "stufe_a", erreicht: "2026-10-20 18:30", jetzt: "2026-10-22 10:40" });
  ok("Nur Rate-Anrufe: Stufe A mit Vorliebe Abend bleibt bei der alten Regel (jetzt, Grund abschnitt)", w6.wahl === "jetzt" && w6.grund === "abschnitt", JSON.stringify(w6));
  const w7 = wahl({ erreicht: "2026-10-19 10:00", letzter: "2026-10-20 10:05", fehl: 1, jetzt: "2026-10-22 10:40" });
  ok("Fehlversuch NACH dem Abnehmen im selben Abschnitt → die Vorliebe ruht, ein anderer Abschnitt (abschnitt:spaeter)", w7.wahl === "spaeter" && w7.grund === "abschnitt", JSON.stringify(w7));
  const w8 = wahl({ erreicht: "2026-10-19 10:00", letzter: "2026-10-20 13:30", fehl: 1, jetzt: "2026-10-22 10:40" });
  ok("Fehlversuch danach in einem ANDEREN Abschnitt → wieder sein Abschnitt (jetzt)", w8.wahl === "jetzt" && w8.grund === "beste_zeit", JSON.stringify(w8));
  const w9 = S.abschnittWahlBeste({ spielart: "rate", fehlFolge: 1, letzterVersuchAm: berlin("2026-10-21 10:05"), erreichtAm: null, jetzt: berlin("2026-10-22 10:40"), fenster: F });
  ok("Nie abgenommen → genau die bisherige Regel (abschnittWahl)", w9.grund === "abschnitt" && w9.wahl === S.abschnittWahl({ spielart: "rate", fehlFolge: 1, letzterVersuchAm: berlin("2026-10-21 10:05"), jetzt: berlin("2026-10-22 10:40"), fenster: F }));

  titel("A4. DIE BREMSEN DER ERINNERUNG (rein)");
  const frei: import("../server/lib/fiaon-aras-erinnerung").ErinnerungFakten = {
    notaus: false, rateOffen: true, rateFaellig: true, erinnerbar: true, test: false, global: false, telefonsperre: false, werbesperre: false,
    kuendigungUngebucht: false, arasAus: false, streitOffen: false, rateWaKuerzlich: false, arasErinnerungKuerzlich: false, rateWaHeute: false, arasErinnerungHeute: false,
  };
  const mb = (x: Partial<typeof frei> & { spielart?: string; ergebnis?: string | null; endeGrund?: string | null; probe?: boolean } = {}) => E.mailboxUrteil({ ...frei, spielart: "rate", ergebnis: "mailbox", endeGrund: "mailbox", ...x });
  ok("Mailbox nach Rate-Anruf, alles frei → senden", mb().senden === true);
  ok("„nicht erreicht“ (Twilio no-answer) → senden", mb({ ergebnis: "nicht_erreicht", endeGrund: "nicht_erreicht" }).senden === true);
  const bremsen: [Partial<typeof frei> & { spielart?: string; ergebnis?: string; endeGrund?: string; probe?: boolean }, RegExp][] = [
    [{ ergebnis: "erreicht_sonstiges" }, /erreicht/], [{ spielart: "willkommen" }, /kein Rate-Anruf/], [{ probe: true }, /Probe/],
    [{ endeGrund: "notaus" }, /Ende durch uns/], [{ endeGrund: "deploy" }, /Ende durch uns/], [{ endeGrund: "fehlgeschlagen" }, /Ende durch uns/],
    [{ notaus: true }, /Not-Aus/], [{ rateOffen: false }, /bezahlt oder storniert/], [{ rateFaellig: false }, /nicht fällig/], [{ erinnerbar: false }, /nicht erinnerbar/],
    [{ test: true }, /Testperson/], [{ global: true }, /Global/], [{ telefonsperre: true }, /Telefonsperre/], [{ werbesperre: true }, /Werbesperre/],
    [{ streitOffen: true }, /Streitfall oder Beschwerde/], [{ arasAus: true }, /ARAS für ihn aus/],
    [{ arasErinnerungKuerzlich: true }, /schon erinnert/], [{ rateWaKuerzlich: true }, /Raten-WhatsApp/], [{ kuendigungUngebucht: true }, /Kündigung eingegangen, noch nicht gebucht/],
  ];
  const durch = bremsen.filter(([x, re]) => { const u = mb(x); return u.senden || !re.test(u.grund); });
  ok(`ROT-PROBEN: jede der ${bremsen.length} Bremsen hält einzeln (mit ihrem Grund)`, durch.length === 0, durch.map(([x]) => JSON.stringify(x)).join(" | "));
  const zt = (x: Partial<typeof frei> & { zusageGilt?: boolean; seitherBezahlt?: boolean; fensterTag?: boolean } = {}) => E.zahltagUrteil({ ...frei, zusageGilt: true, seitherBezahlt: false, fensterTag: true, ...x });
  ok("Zahltag, alles frei → senden", zt().senden === true);
  ok("ROT-PROBEN Zahltag: zurückgenommen/neuer Tag, seither bezahlt, Sonntag/Feiertag, Kündigung ungebucht → nicht senden",
    !zt({ zusageGilt: false }).senden && /zurückgenommen/.test(zt({ zusageGilt: false }).grund) && !zt({ seitherBezahlt: true }).senden && !zt({ fensterTag: false }).senden && !zt({ kuendigungUngebucht: true }).senden);
  ok("Zahltag-Bremse NUR „heute“: heute schon eine Raten-WhatsApp oder heute schon von ARAS erinnert → nicht senden",
    /heute schon eine Raten-WhatsApp/.test(zt({ rateWaHeute: true, rateWaKuerzlich: true }).grund) && !zt({ rateWaHeute: true, rateWaKuerzlich: true }).senden && /heute schon erinnert/.test(zt({ arasErinnerungHeute: true }).grund));
  ok("ROT-PROBE Zahltag: der Link kam 1–2 Tage vorher (Raten-WhatsApp in 3 Tagen, ARAS-Erinnerung zur Rate in 3 Tagen) → trotzdem senden — die Erinnerung am Zahltag ist der Sinn",
    zt({ rateWaKuerzlich: true }).senden && zt({ arasErinnerungKuerzlich: true }).senden);
  ok("ROT-PROBE Mailbox: die automatischen Raten-Mails sind KEINE Bremse mehr (es gibt keine Mail-Tatsache); nur WhatsApp und ARAS' eigene zählen",
    !("rateMailKuerzlich" in frei) && mb().senden && !mb({ rateWaKuerzlich: true }).senden);
  ok("Zahltag-Fenster 09:00–10:00 Berlin: 08:59 nein, 09:00 ja, 09:59 ja, 10:00 nein",
    !E.imZahltagFenster(berlin("2026-10-23 08:59")) && E.imZahltagFenster(berlin("2026-10-23 09:00")) && E.imZahltagFenster(berlin("2026-10-23 09:59")) && !E.imZahltagFenster(berlin("2026-10-23 10:00")));
  ok("Ein Streitfall-Ausdruck für Erinnerung UND Aufbewahrung (streitOffenSql): Streitfall-Aufgabe, Beschwerde, ARAS aus wegen Betrug/Anzeige",
    /aras:justin:streitfall:%/.test(E.streitOffenSql("p.id")) && /beschwerde/.test(E.streitOffenSql("p.id")) && /betrug\|anzeige/.test(E.streitOffenSql("p.id")));

  titel("A5. AUFBEWAHRUNG (rein)");
  ok("Frist = TRANSKRIPT_FRIST_TAGE = 90", A.ARAS_AUFBEWAHRUNG_TAGE === 90 && S.TRANSKRIPT_FRIST_TAGE === 90);
  const re = `RE${"a1".repeat(16)}`;
  ok("Twilio-Kennung: recording_sid, sonst aus der URL (…/Recordings/RE…)", A.aufnahmeKennung(re, null) === re && A.aufnahmeKennung(null, `https://api.twilio.com/2010-04-01/Accounts/AC1/Recordings/${re}`) === re && A.aufnahmeKennung(null, "https://x/y") === null);
  ok("404 / 20404 bei Twilio = die Aufnahme ist weg; 500 nicht", A.twilioNichtDa({ status: 404 }) && A.twilioNichtDa({ code: 20404 }) && !A.twilioNichtDa({ status: 500 }) && !A.twilioNichtDa(new Error("x")));

  if (!/(?:127\.0\.0\.1|localhost):54329\//.test(String(process.env.DATABASE_URL))) {
    console.log("\n(Teil B übersprungen: keine lokale Prüf-DB)");
    return;
  }

  // ══ TEIL B — lokale Prüf-DB ═══════════════════════════════════════════════
  const { sqlPool } = await import("../server/lib/db-pool");
  const { arasSchema, arasSchemaZuruecksetzen, arasAusweisId } = await import("../server/lib/fiaon-aras-schema");
  const P = await import("../server/lib/fiaon-aras-plan");
  const { werkzeugAusfuehren } = await import("../server/lib/fiaon-aras-werkzeuge");
  const { twilioClientSetzen } = await import("../server/lib/fiaon-aras-twilio-client");
  const { berlinZeitpunkt, berlinToday } = await import("../server/lib/fiaon-time");
  arasSchemaZuruecksetzen();
  await arasSchema();
  const ausweis = await arasAusweisId();
  const setze = async (k: string, v: string) => { await P.einstellungSetzen(k, v, "pruefstand"); P.arasEinstellungenVergessen(); };
  await setze("aras_an", "an"); await setze("aras_notaus", "aus"); await setze("aras_stufe", "3"); await setze("aras_adapter", "attrappe");
  await setze("aras_spielarten", JSON.stringify({ termin: "an", willkommen: "an", rate: "an", zusage: "an", stufe_a: "an", auftrag: "an", probe: "an" }));
  await setze("aras_fenster", JSON.stringify({ verkauf: { "1-7": ["08:00", "21:00"] }, rate: { "1-7": ["08:00", "21:00"] } }));
  const { ensureTodoTabelle } = await import("../server/routes/fiaon-betreiber-todo").catch(() => ({ ensureTodoTabelle: null as any }));
  if (ensureTodoTabelle) await ensureTodoTabelle().catch(() => null);

  const yyyy = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  const heute = berlinToday();
  const plusTage = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const nummerVon = (n: number) => `+4917000000${n}`;
  async function person(n: number, x: { werbesperre?: boolean; werbesperreQuelle?: string; test?: boolean } = {}): Promise<number> {
    const nummer = nummerVon(n);
    const [p] = (await sqlPool`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_phone, phone_key9, country, is_blocked, anrede, werbung_gesperrt_am, werbesperre_quelle, ist_test_am, primary_email)
      VALUES (${`PRUEF-E408-${n}`}, 'Test', ${`Prüfkunde${n}`}, ${nummer}, ${nummer.replace(/\D/g, "").slice(-9)}, 'DE', FALSE, 'herr', ${x.werbesperre ? new Date() : null}, ${x.werbesperreQuelle ?? null},
              ${x.test ? new Date() : null}, ${`pruef-e408-${n}@example.invalid`}) RETURNING id`) as any[];
    return Number(p.id);
  }
  async function vertrag(pid: number, n: number, x: { faellig?: string; bezahlt?: boolean; aboStopp?: boolean } = {}): Promise<{ ref: string; rateId: number }> {
    const ref = `PRUEF-E408-A${n}`;
    await sqlPool`INSERT INTO fiaon_applications (ref, payment_reference, person_id, payment_status, status, current_step, submitted_at, pack_key, pack_name, type, ist_entwurf, created_at, abo_gestoppt_am)
      VALUES (${ref}, ${`${ref}-Z`}, ${pid}, 'paid', 'approved', 9, NOW() - INTERVAL '60 days', 'plus', 'Plus', 'privat', FALSE, NOW() - INTERVAL '60 days', ${x.aboStopp ? new Date() : null})`;
    const [r] = (await sqlPool`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am)
      VALUES (${ref}, 2, ${`${ref}-2`}, 5999, ${x.faellig ?? plusTage(heute, -3)}::date, ${x.bezahlt ? "bezahlt" : "offen"}, ${x.bezahlt ? new Date() : null}) RETURNING id`) as any[];
    return { ref, rateId: Number(r.id) };
  }
  async function arasAnruf(pid: number | null, n: number, ref: string | null, rateId: number | null, x: { spielart?: string; ergebnis?: string | null; ende?: string | null; am?: Date; nachbereitet?: boolean } = {}) {
    const am = x.am ?? new Date();
    const spielart = x.spielart ?? "rate";
    const [pl] = (await sqlPool`INSERT INTO fiaon_aras_plan (person_id, ref, nummer, land, spielart, prioritaet, grund, rechtsgrund, rate_id, frueh_ab, spaet_bis, status, erzeugt_von, created_at)
      VALUES (${pid}, ${ref}, ${nummerVon(n)}, 'DE', ${spielart}, 3, 'Prüfstand', 'vertrag', ${rateId}, ${am}, ${am}, 'fertig', 'takt', ${am}) RETURNING id`) as any[];
    const [c] = (await sqlPool`INSERT INTO fiaon_calls (person_id, ref, agent_id, nummer, richtung, status, beginn, twilio_sid, gefuehrt_von, created_at)
      VALUES (${pid}, ${ref}, ${ausweis}, ${nummerVon(n)}, 'raus', 'niemand_erreicht', ${am}, ${`CA-pruef-nachsorge-${n}-${am.getTime()}`}, 'aras', ${am}) RETURNING id`) as any[];
    const [a] = (await sqlPool`INSERT INTO fiaon_aras_anruf (call_id, plan_id, spielart, briefing, adapter, stimme, prompt_version, ergebnis, ende_grund, created_at, nachbereitet_am)
      VALUES (${c.id}, ${pl.id}, ${spielart}, '{}'::jsonb, 'attrappe', 'juni', 'pruefstand', ${x.ergebnis ?? null}, ${x.ende ?? null}, ${am}, ${x.nachbereitet === false ? null : am}) RETURNING id`) as any[];
    return { callId: Number(c.id), arasAnrufId: Number(a.id), planId: Number(pl.id) };
  }

  // Die Versand-Attrappe statt werkzeugAusfuehren: schreibt, was das echte Werkzeug schreiben würde (Zeile am Gespräch, WhatsApp/Mail im Log).
  const spur: { aufruf: string; name: string; eingabe: any; rateNr: number | null; personId: number | null; arasAnrufId: number }[] = [];
  let modus: "ok" | "wa_fehler" | "rot" = "ok";
  const attrappe = (async (ctx: any, name: any, eingabe: any, aufruf: string) => {
    spur.push({ aufruf, name: String(name), eingabe, rateNr: ctx.briefing?.offeneRate?.nr ?? null, personId: ctx.personId, arasAnrufId: ctx.arasAnrufId });
    const weg = eingabe?.weg === "mail" ? "mail" : "whatsapp";
    const erg = modus === "rot" ? { ok: false, vorlesen: "Das klärt ein Kollege — ich notiere es.", fehler: "ampel_rot" }
      : modus === "wa_fehler" && weg === "whatsapp" ? { ok: false, vorlesen: "WhatsApp ging gerade nicht raus.", fehler: "wa_kaputt" }
      : { ok: true, vorlesen: weg === "whatsapp" ? "Der Link ist raus — per WhatsApp, Sie sollten ihn gleich sehen." : "Die E-Mail mit Ihrem Link ist raus." };
    await sqlPool`INSERT INTO fiaon_aras_werkzeug (aras_anruf_id, werkzeug, aufruf_id, eingabe, ergebnis, ok, dauer_ms) VALUES (${ctx.arasAnrufId}, ${String(name)}, ${aufruf}, ${sqlPool.json(eingabe)}, ${sqlPool.json(erg as any)}, ${erg.ok}, 1)`;
    if (erg.ok && weg === "whatsapp") await sqlPool`INSERT INTO fiaon_whatsapp (richtung, nummer, person_id, vorlage, status, von) VALUES ('raus', ${ctx.nummer}, ${ctx.personId}, 'fiaon_kk_rate', 'gesendet', 'aras')`;
    if (erg.ok && weg === "mail") await sqlPool`INSERT INTO fiaon_mail_log (event, person_id, status, art) VALUES ('abo_payment_reminder', ${ctx.personId}, 'versandt', 'echt')`;
    return erg;
  }) as any;
  const zeile = async (schluessel: string) => ((await sqlPool`SELECT * FROM fiaon_aras_erinnerung WHERE schluessel = ${schluessel}`) as any[])[0] ?? null;

  titel("B1. MAILBOX → RATEN-ERINNERUNG (Versand-Attrappe, nichts geht raus)");
  const mailbox = async (n: number, vor: (pid: number, v: { ref: string; rateId: number }) => Promise<void> = async () => {}, x: { personX?: { werbesperre?: boolean; test?: boolean }; vertragX?: Parameters<typeof vertrag>[2]; ergebnis?: string; ende?: string } = {}) => {
    const pid = await person(n, x.personX); const v = await vertrag(pid, n, x.vertragX); await vor(pid, v);
    const a = await arasAnruf(pid, n, v.ref, v.rateId, { ergebnis: x.ergebnis ?? "mailbox", ende: x.ende ?? "mailbox" });
    const vorher = spur.length;
    const r = await E.nachMailboxErinnern({ arasAnrufId: a.arasAnrufId, ergebnis: x.ergebnis ?? "mailbox", endeGrund: x.ende ?? "mailbox" }, sqlPool, attrappe);
    return { pid, ...v, ...a, r, neu: spur.slice(vorher) };
  };
  const m0 = await mailbox(800);
  ok("Mailbox, alles frei → Raten-Erinnerung per WhatsApp (zahlungslink_senden, zweck rate, Anlass mailbox)", m0.r.status === "gesendet" && m0.r.weg === "whatsapp" && m0.neu.length === 1 && m0.neu[0].name === "zahlungslink_senden"
    && m0.neu[0].eingabe?.weg === "whatsapp" && m0.neu[0].eingabe?.zweck === "rate" && m0.neu[0].eingabe?.anlass === "mailbox", JSON.stringify(m0.r));
  ok("… mit der Rate des Anrufs im Briefing (Rate 2) und am Gespräch (aufruf mailbox-<Anruf>)", m0.neu[0]?.rateNr === 2 && m0.neu[0]?.aufruf === `mailbox-${m0.arasAnrufId}` && m0.neu[0]?.arasAnrufId === m0.arasAnrufId);
  const z0 = await zeile(`mailbox:${m0.arasAnrufId}`);
  ok("EINE Zeile je Anlass: gesendet, Weg WhatsApp, Rate und Gespräch vermerkt", z0?.status === "gesendet" && z0?.weg === "whatsapp" && Number(z0?.rate_id) === m0.rateId && Number(z0?.call_id) === m0.callId, JSON.stringify(z0));
  const [pr0] = (await sqlPool`SELECT text FROM fiaon_mara_protokoll WHERE kanal = 'telefon' AND daten->>'erinnerung' = 'mailbox' AND (daten->>'callId')::int = ${m0.callId}`) as any[];
  ok("Protokoll am Gespräch (Kanal telefon): „Nach der Mailbox: Raten-Erinnerung per WhatsApp“", /Nach der Mailbox: Raten-Erinnerung per WhatsApp/.test(String(pr0?.text ?? "")), pr0?.text);
  const [wzCockpit] = (await sqlPool`SELECT werkzeug, ok FROM fiaon_aras_werkzeug WHERE aras_anruf_id = ${m0.arasAnrufId}`) as any[];
  ok("Sichtbar im Cockpit: die Werkzeug-Zeile „Zahlungslink geschickt“ hängt am Mailbox-Gespräch", wzCockpit?.werkzeug === "zahlungslink_senden" && wzCockpit?.ok === true);
  const nochmal = await E.nachMailboxErinnern({ arasAnrufId: m0.arasAnrufId, ergebnis: "mailbox", endeGrund: "mailbox" }, sqlPool, attrappe);
  ok("ROT-PROBE doppelte Nachbereitung desselben Anrufs → „schon“, kein zweiter Versand", nochmal.status === "schon" && spur.length === 1, JSON.stringify(nochmal));
  const a2 = await arasAnruf(m0.pid, 800, m0.ref, m0.rateId, { ergebnis: "mailbox", ende: "mailbox" });
  const r2 = await E.nachMailboxErinnern({ arasAnrufId: a2.arasAnrufId, ergebnis: "mailbox", endeGrund: "mailbox" }, sqlPool, attrappe);
  ok("ROT-PROBE höchstens einmal je Rate in 3 Tagen: der nächste Mailbox-Anruf zur selben Rate → ausgelassen", r2.status === "ausgelassen" && /schon erinnert/.test(r2.grund) && spur.length === 1, JSON.stringify(r2));
  const [pr2] = (await sqlPool`SELECT text FROM fiaon_mara_protokoll WHERE daten->>'erinnerung' = 'mailbox' AND (daten->>'callId')::int = ${a2.callId}`) as any[];
  ok("… und das Protokoll am Gespräch sagt, warum nicht", /keine Raten-Erinnerung — ARAS hat zu dieser Rate/.test(String(pr2?.text ?? "")), pr2?.text);

  const waVor = (tage: number, von = "Mara", vorlage = "fiaon_kkb_rate") => async (pid: number) => { await sqlPool`INSERT INTO fiaon_whatsapp (richtung, nummer, person_id, vorlage, status, von, created_at) VALUES ('raus', '+491700000000', ${pid}, ${vorlage}, 'read', ${von}, NOW() - make_interval(days => ${tage}))`; };
  const mailVor = (tage: number, status = "versandt", event = "abo_payment_reminder") => async (pid: number) => { await sqlPool`INSERT INTO fiaon_mail_log (event, person_id, status, art, created_at) VALUES (${event}, ${pid}, ${status}, 'echt', NOW() - make_interval(days => ${tage}))`; };
  const m801 = await mailbox(801, waVor(2));
  ok("Raten-WhatsApp der WhatsApp-Zentrale vor 2 Tagen (fiaon_kkb_rate, von Mara) → ausgelassen", m801.r.status === "ausgelassen" && /Raten-WhatsApp/.test(m801.r.grund) && m801.neu.length === 0, JSON.stringify(m801.r));
  const m802 = await mailbox(802, waVor(4));
  ok("ROT-PROBE: … vor 4 Tagen → außerhalb der 3 Tage → gesendet", m802.r.status === "gesendet", JSON.stringify(m802.r));
  const m803 = await mailbox(803, mailVor(1));
  ok("ROT-PROBE (Nachtrag 22.10.): die automatische Raten-Mail von gestern (abo_payment_reminder) bremst NICHT mehr → gesendet", m803.r.status === "gesendet", JSON.stringify(m803.r));
  const m803b = await mailbox(830, mailVor(1, "versandt", "mara_rate_erinnerung"));
  ok("… auch Maras Raten-Mail von gestern nicht → gesendet", m803b.r.status === "gesendet", JSON.stringify(m803b.r));
  const m804 = await mailbox(804, waVor(1, "aras", "fiaon_kk_rate"));
  ok("Raten-WhatsApp von ARAS selbst gestern (aus einem Gespräch) → ausgelassen (jeder Absender zählt)", m804.r.status === "ausgelassen" && /Raten-WhatsApp/.test(m804.r.grund), JSON.stringify(m804.r));
  const m804b = await mailbox(833, async (pid) => { await sqlPool`INSERT INTO fiaon_whatsapp (richtung, nummer, person_id, vorlage, status, von, created_at) VALUES ('raus', '+491700000000', ${pid}, 'fiaon_kkb_rate', 'fehler', 'Mara', NOW() - INTERVAL '1 day')`; });
  ok("ROT-PROBE: eine GESCHEITERTE Raten-WhatsApp (Status fehler) bremst nicht → gesendet", m804b.r.status === "gesendet", JSON.stringify(m804b.r));
  const m805 = await mailbox(805, async (pid) => { await sqlPool`INSERT INTO fiaon_aras_person (person_id, aus_am, aus_grund, aus_von) VALUES (${pid}, NOW(), 'Streitfall am Telefon: Betrug, Anzeige', 'ARAS (Streitfall)')`; });
  ok("Streitfall (ARAS aus nach Betrug/Anzeige) → ausgelassen", m805.r.status === "ausgelassen" && /Streitfall oder Beschwerde/.test(m805.r.grund), JSON.stringify(m805.r));
  const m806 = await mailbox(806, async (pid) => { await sqlPool`INSERT INTO fiaon_aras_person (person_id, aus_am, aus_grund, aus_von) VALUES (${pid}, NOW(), 'Kunde möchte nur Post', 'Betreuer')`; });
  ok("ARAS für ihn aus (anderer Grund) → ausgelassen", m806.r.status === "ausgelassen" && /ARAS für ihn aus/.test(m806.r.grund), JSON.stringify(m806.r));
  const m807 = await mailbox(807, async (pid) => { await sqlPool`INSERT INTO fiaon_betreiber_todos (schluessel, titel, status, person_id, art, quelle) VALUES (${`pruef-beschwerde-${pid}`}, 'Beschwerde über Anrufe', 'offen', ${pid}, 'beschwerde', 'hand')`; });
  ok("Offene Beschwerde (Aufgabe der Art beschwerde) → ausgelassen", m807.r.status === "ausgelassen" && /Streitfall oder Beschwerde/.test(m807.r.grund), JSON.stringify(m807.r));
  const m808 = await mailbox(808, async (pid) => { await sqlPool`INSERT INTO fiaon_betreiber_todos (schluessel, titel, status, erledigt_am, person_id, art, quelle) VALUES (${`pruef-beschwerde-${pid}`}, 'Beschwerde über Anrufe', 'erledigt', NOW(), ${pid}, 'beschwerde', 'hand')`; });
  ok("ROT-PROBE: Beschwerde ERLEDIGT → gesendet", m808.r.status === "gesendet", JSON.stringify(m808.r));
  const m809 = await mailbox(809, async (pid) => { await sqlPool`INSERT INTO fiaon_telefon_sperre (nummer_kern, person_id, quelle, grund) VALUES (${nummerVon(809).replace(/\D/g, "").slice(-9)}, ${pid}, 'pruefstand', 'nicht mehr anrufen')`; });
  ok("Telefonsperre → ausgelassen", m809.r.status === "ausgelassen" && /Telefonsperre/.test(m809.r.grund), JSON.stringify(m809.r));
  const m810 = await mailbox(810, undefined, { personX: { werbesperre: true, werbesperreQuelle: "mensch" } });
  ok("„Echte“ Werbesperre (ein Mensch wollte keine Werbung) → ausgelassen — wie die WhatsApp-Zentrale", m810.r.status === "ausgelassen" && /Werbesperre/.test(m810.r.grund), JSON.stringify(m810.r));
  const m810b = await mailbox(831, undefined, { personX: { werbesperre: true, werbesperreQuelle: "zahlungspost_freigabe" } });
  ok("ROT-PROBE: Werbesperre aus der Zahlungspost-Freigabe → die Monatsrate geht trotzdem (Vertragspost, wie die Zentrale) → gesendet", m810b.r.status === "gesendet", JSON.stringify(m810b.r));
  const kuendigung = (status: string) => async (pid: number, v: { ref: string }) => { await sqlPool`INSERT INTO cancellation_requests (ref, first_name, last_name, email, status, reason) VALUES (${v.ref}, 'Test', ${`Prüfkunde${pid}`}, ${`pruef-e408-k${pid}@example.invalid`}, ${status}, 'Prüfstand')`; };
  const m832 = await mailbox(832, kuendigung("pending"));
  ok("Kündigung eingegangen, noch nicht gebucht (E-391, KUENDIGUNG_UNGEBUCHT_SQL) → ausgelassen", m832.r.status === "ausgelassen" && /Kündigung eingegangen, noch nicht gebucht/.test(m832.r.grund), JSON.stringify(m832.r));
  const m834 = await mailbox(834, kuendigung("rejected"));
  ok("ROT-PROBE: Kündigungsantrag abgelehnt (nicht offen) → gesendet", m834.r.status === "gesendet", JSON.stringify(m834.r));
  const m811 = await mailbox(811, undefined, { personX: { test: true } });
  ok("Testperson → ausgelassen", m811.r.status === "ausgelassen" && /Testperson/.test(m811.r.grund), JSON.stringify(m811.r));
  const m812 = await mailbox(812, undefined, { vertragX: { bezahlt: true } });
  ok("Rate inzwischen bezahlt → ausgelassen", m812.r.status === "ausgelassen" && /bezahlt oder storniert/.test(m812.r.grund), JSON.stringify(m812.r));
  const m813 = await mailbox(813, undefined, { vertragX: { faellig: plusTage(heute, 1) } });
  ok("Rate erst morgen fällig → ausgelassen („war am … fällig“ wäre falsch)", m813.r.status === "ausgelassen" && /nicht fällig/.test(m813.r.grund), JSON.stringify(m813.r));
  const m814 = await mailbox(814, undefined, { vertragX: { aboStopp: true } });
  ok("Abo-Stopp → ausgelassen (Vertrag nicht erinnerbar)", m814.r.status === "ausgelassen" && /nicht erinnerbar/.test(m814.r.grund), JSON.stringify(m814.r));
  const m815 = await mailbox(815, undefined, { ergebnis: "nicht_erreicht", ende: "notaus" });
  ok("ROT-PROBE: Abbruch durch Not-Aus (nicht erreicht) → keine Erinnerung", m815.r.status === "ausgelassen" && /Ende durch uns/.test(m815.r.grund), JSON.stringify(m815.r));
  modus = "wa_fehler";
  const m816 = await mailbox(816);
  ok("WhatsApp scheitert → einmal die Raten-Mail (derselbe Weg) → gesendet per Mail", m816.r.status === "gesendet" && m816.r.weg === "mail" && m816.neu.length === 2 && m816.neu[1].eingabe?.weg === "mail" && m816.neu[1].aufruf === `mailbox-${m816.arasAnrufId}-mail`, JSON.stringify(m816.r));
  modus = "rot";
  const m817 = await mailbox(817);
  ok("ROT-PROBE Ampel: zahlungslink_senden auf Rot → nichts, auch keine Mail", m817.r.status === "fehlgeschlagen" && m817.neu.length === 1, JSON.stringify(m817.r));
  modus = "ok";
  await setze("aras_notaus", "an");
  const m818 = await mailbox(818);
  await setze("aras_notaus", "aus");
  ok("ROT-PROBE Not-Aus an → keine Erinnerung", m818.r.status === "ausgelassen" && /Not-Aus/.test(m818.r.grund) && m818.neu.length === 0, JSON.stringify(m818.r));

  // Die Nachbereitung ruft den Baustein selbst (ohne Versand: Werbesperre → nur die Entscheidung „ausgelassen“).
  const { nachbereiten } = await import("../server/lib/fiaon-aras-nachbereitung");
  const lage = (ergebnis: any, endeGrund: string) => ({ zeilen: [], ausgefuehrt: [], endeGrund, sekunden: 0, aufnahmeJa: false, ergebnis, ergebnisNotiz: null, ergebnisGesetzt: false, kundeHatGesprochen: false });
  const p819 = await person(819, { werbesperre: true }); const v819 = await vertrag(p819, 819);
  const a819 = await arasAnruf(p819, 819, v819.ref, v819.rateId, { nachbereitet: false });
  await nachbereiten(a819.arasAnrufId, lage("mailbox", "mailbox"));
  const z819 = await zeile(`mailbox:${a819.arasAnrufId}`);
  ok("nachbereiten() ruft die Erinnerung nach der Mailbox selbst (hier: Werbesperre → ausgelassen, mit Grund)", z819?.status === "ausgelassen" && /Werbesperre/.test(String(z819?.grund)), JSON.stringify(z819));
  const a819b = await arasAnruf(p819, 819, v819.ref, v819.rateId, { nachbereitet: false, spielart: "willkommen" });
  await nachbereiten(a819b.arasAnrufId, lage("mailbox", "mailbox"));
  const a819c = await arasAnruf(p819, 819, v819.ref, v819.rateId, { nachbereitet: false });
  await nachbereiten(a819c.arasAnrufId, { ...lage("erreicht_sonstiges", "kunde_aufgelegt"), kundeHatGesprochen: true });
  ok("ROT-PROBE: Willkommen-Mailbox und ein erreichter Rate-Anruf → gar keine Entscheidung (nur Rate ohne Gespräch)", !(await zeile(`mailbox:${a819b.arasAnrufId}`)) && !(await zeile(`mailbox:${a819c.arasAnrufId}`)));

  titel("B2. ZAHLTAG-ERINNERUNG AM MORGEN (Mi 04.11.2026, 09:00–10:00 Berlin)");
  const ZT = "2026-11-04";
  const um = (hhmm: string, tag = ZT) => berlinZeitpunkt(tag, Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)));
  /** Eine Zusage an ARAS: Werkzeug im Gespräch + Eintrag in der Akte (an der Bestellung, ohne person_id — wie in der Produktion). */
  async function zusageAnAras(n: number, x: { tag?: string; am?: Date; voided?: boolean; faellig?: string } = {}) {
    const pid = await person(n); const v = await vertrag(pid, n, { faellig: x.faellig ?? "2026-10-30" });
    const am = x.am ?? um("15:00", "2026-11-03");
    const a = await arasAnruf(pid, n, v.ref, v.rateId, { ergebnis: "erreicht_zahlt_am", ende: "aras_beendet", am });
    const tag = x.tag ?? ZT;
    await sqlPool`INSERT INTO fiaon_aras_werkzeug (aras_anruf_id, werkzeug, aufruf_id, eingabe, ergebnis, ok, dauer_ms, created_at) VALUES (${a.arasAnrufId}, 'zahlungszusage_merken', 'pruef', ${sqlPool.json({ datum: tag })}, ${sqlPool.json({ ok: true, trocken: false })}, TRUE, 5, ${am})`;
    await sqlPool`INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note, promised_date, created_at, voided_at)
      VALUES (${v.ref}, ${ausweis}, 'Aras', 'result', 'erreicht_zahlt_am', 'Prüfstand: zahlt am', (${tag}::date)::timestamp AT TIME ZONE 'Europe/Berlin', ${am}, ${x.voided ? new Date() : null})`;
    return { pid, ...v, ...a };
  }
  const k820 = await zusageAnAras(820);
  const k821 = await zusageAnAras(821, { am: um("08:30") });                      // heute früh gegeben → keine Erinnerung
  const k822 = await zusageAnAras(822, { voided: true });
  const k823 = await zusageAnAras(823);
  await sqlPool`INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note, promised_date, created_at) VALUES (${k823.ref}, NULL, 'Team', 'result', 'erreicht_zahlt_am', 'neuer Tag', ('2026-11-06'::date)::timestamp AT TIME ZONE 'Europe/Berlin', ${um("18:00", "2026-11-03")})`;
  const k824 = await zusageAnAras(824);
  await sqlPool`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am) VALUES (${k824.ref}, 1, ${`${k824.ref}-1`}, 5999, '2026-09-30', 'bezahlt', ${um("20:00", "2026-11-03")})`;
  const k825 = await zusageAnAras(825);
  await sqlPool`INSERT INTO fiaon_whatsapp (richtung, nummer, person_id, vorlage, status, von, created_at) VALUES ('raus', '+491700000000', ${k825.pid}, 'fiaon_kkb_rate', 'read', 'Mara', ${um("08:05")})`;
  const k829 = await zusageAnAras(829);   // der Link kam gestern im Zusage-Gespräch — heute trotzdem erinnern
  await sqlPool`INSERT INTO fiaon_whatsapp (richtung, nummer, person_id, vorlage, status, von, created_at) VALUES ('raus', '+491700000000', ${k829.pid}, 'fiaon_kk_rate', 'read', 'aras', ${um("15:02", "2026-11-03")})`;
  const k826 = await zusageAnAras(826);
  await sqlPool`INSERT INTO fiaon_telefon_sperre (nummer_kern, person_id, quelle, grund) VALUES (${nummerVon(826).replace(/\D/g, "").slice(-9)}, ${k826.pid}, 'pruefstand', 'nicht mehr anrufen')`;

  ok("08:59 → läuft nicht", (await E.zahltagErinnern(sqlPool, um("08:59"), attrappe)) === false && !(await zeile(`zahltag:${k820.pid}:${ZT}`)));
  const vorZ = spur.length;
  const lief = await E.zahltagErinnern(sqlPool, um("09:15"), attrappe);
  const neuZ = spur.slice(vorZ);
  const z820 = await zeile(`zahltag:${k820.pid}:${ZT}`);
  ok("09:15: Zusage für heute (gestern an ARAS gegeben), Rate offen → Raten-Erinnerung per WhatsApp, am Gespräch der Zusage", lief === true && z820?.status === "gesendet" && neuZ.some((s) => s.personId === k820.pid && s.aufruf === `zahltag-${k820.pid}-${ZT}` && s.arasAnrufId === k820.arasAnrufId && s.eingabe?.anlass === "zahltag"), JSON.stringify(z820));
  ok("Genau ZWEI Versände an diesem Morgen (820 und 829 — der Link von gestern hält die Erinnerung nicht auf), alle anderen Fälle halten",
    neuZ.length === 2 && neuZ.some((s) => s.personId === k820.pid) && neuZ.some((s) => s.personId === k829.pid), neuZ.map((s) => s.personId).join(","));
  ok("ROT-PROBE (Nachtrag 22.10.): Raten-WhatsApp gestern im Zusage-Gespräch → am Zahltag TROTZDEM die Erinnerung (Bremse nur „heute“)", (await zeile(`zahltag:${k829.pid}:${ZT}`))?.status === "gesendet", JSON.stringify(await zeile(`zahltag:${k829.pid}:${ZT}`)));
  ok("ROT-PROBE: Zusage erst heute früh gegeben → keine Erinnerung (gar keine Zeile)", !(await zeile(`zahltag:${k821.pid}:${ZT}`)));
  const g = async (k: { pid: number }) => String((await zeile(`zahltag:${k.pid}:${ZT}`))?.grund ?? "—");
  ok("Zusage in der Akte zurückgenommen → ausgelassen", /zurückgenommen/.test(await g(k822)), await g(k822));
  ok("Danach ein neuer Tag mit dem Team vereinbart → ausgelassen", /zurückgenommen oder neuer Tag/.test(await g(k823)), await g(k823));
  ok("Seit der Zusage eine Rate bezahlt → ausgelassen", /seit der Zusage bezahlt/.test(await g(k824)), await g(k824));
  ok("HEUTE früh schon eine Raten-WhatsApp (Zentrale) → ausgelassen", /heute schon eine Raten-WhatsApp/.test(await g(k825)), await g(k825));
  ok("Telefonsperre → ausgelassen (gleiche Bremse)", /Telefonsperre/.test(await g(k826)), await g(k826));
  const nachZ = spur.length;
  ok("09:20, zweiter Takt → nichts Neues (je Zusage genau einmal)", (await E.zahltagErinnern(sqlPool, um("09:20"), attrappe)) === false && spur.length === nachZ);
  ok("10:00 → läuft nicht", (await E.zahltagErinnern(sqlPool, um("10:00"), attrappe)) === false);
  // Sonntag (Fenster Mo–Sa): keine Erinnerung — ARAS hält Sonntagsruhe.
  await setze("aras_fenster", JSON.stringify(S.FENSTER_VORGABE));
  const k827 = await zusageAnAras(827, { tag: "2026-11-08", am: um("15:00", "2026-11-06") });
  await E.zahltagErinnern(sqlPool, um("09:10", "2026-11-08"), attrappe);
  ok("Zahltag an einem Sonntag (Fenster Mo–Sa) → ausgelassen", /Sonntag oder Feiertag/.test(String((await zeile(`zahltag:${k827.pid}:2026-11-08`))?.grund)), String((await zeile(`zahltag:${k827.pid}:2026-11-08`))?.grund));
  await setze("aras_fenster", JSON.stringify({ verkauf: { "1-7": ["08:00", "21:00"] }, rate: { "1-7": ["08:00", "21:00"] } }));
  await setze("aras_an", "aus");
  const k828 = await zusageAnAras(828, { tag: "2026-11-05", am: um("15:00", "2026-11-04") });
  ok("ROT-PROBE: ARAS aus → keine Erinnerung, keine Zeile", (await E.zahltagErinnern(sqlPool, um("09:10", "2026-11-05"), attrappe)) === false && !(await zeile(`zahltag:${k828.pid}:2026-11-05`)));
  await setze("aras_an", "an");

  titel("B3. ZUSAGE NACHFASSEN ZUR RICHTIGEN ZEIT (Planer Abschnitt 5 + Wähler) — und ARAS sagt die Wahrheit");
  const einst = await P.arasEinstellungenLesen(true);
  let dN: string | null = null;
  for (let n = 1; n <= 20 && !dN; n++) { const d = plusTage(heute, -n); if (S.zusageNachfassTag(d, { land: "DE", fenster: einst.fenster }) === heute) dN = d; }
  async function zusageAkte(n: number, tag: string, x: { voided?: boolean; amVor?: string } = {}) {
    const pid = await person(n); const v = await vertrag(pid, n, { faellig: plusTage(heute, -12) });
    await sqlPool`INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note, promised_date, created_at, voided_at)
      VALUES (${v.ref}, ${ausweis}, 'Aras', 'result', 'erreicht_zahlt_am', 'Prüfstand: zahlt am', (${tag}::date)::timestamp AT TIME ZONE 'Europe/Berlin', ${`${tag}T08:00:00Z`}::timestamptz - INTERVAL '1 day', ${x.voided ? new Date() : null})`;
    return { pid, ...v };
  }
  const zusageEintrag = async (pid: number) => ((await sqlPool`SELECT id, status, frueh_ab, spaet_bis, anlass_am, grund, erzeugt_von, nummer FROM fiaon_aras_plan WHERE person_id = ${pid} AND spielart = 'zusage' ORDER BY id DESC LIMIT 1`) as any[])[0] ?? null;
  const k836 = await zusageAkte(836, plusTage(heute, -1));
  let k835: Awaited<ReturnType<typeof zusageAkte>> | null = null, k837: any = null, k838: any = null, k839: any = null, k840: any = null;
  if (dN) {
    k835 = await zusageAkte(835, dN);
    k837 = await zusageAkte(837, dN);
    await sqlPool`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am) VALUES (${k837.ref}, 1, ${`${k837.ref}-1`}, 5999, ${plusTage(heute, -40)}::date, 'bezahlt', NOW() - INTERVAL '1 hour')`;
    k838 = await zusageAkte(838, dN, { voided: true });
    k839 = await zusageAkte(839, dN);
    await sqlPool`INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note, promised_date, created_at) VALUES (${k839.ref}, NULL, 'Team', 'result', 'erreicht_zahlt_am', 'neuer Tag', (${plusTage(heute, 1)}::date)::timestamp AT TIME ZONE 'Europe/Berlin', NOW() - INTERVAL '2 hours')`;
    k840 = await zusageAkte(840, dN);
  }
  const fz = await P.planFuellen();
  // Der Prüfstand läuft auch abends: das Fenster der frischen Einträge strecken (der nächste Füller-Lauf würde sie sonst verfallen lassen).
  await sqlPool`UPDATE fiaon_aras_plan SET spaet_bis = GREATEST(spaet_bis, NOW() + INTERVAL '2 hours') WHERE status = 'wartet' AND spielart = 'zusage'`;
  ok("ROT-PROBE (die alte Regel): Zusage für gestern → HEUTE kein Nachfassen (die Überweisung läuft noch)", !(await zusageEintrag(k836.pid)), JSON.stringify(await zusageEintrag(k836.pid)));
  if (!dN) console.log(`  (heute ${heute}: kein Tag, dessen Nachfassen auf heute fällt — Mo/So; die Fälle 835–840 laufen an anderen Tagen)`);
  if (dN && k835) {
    const e835 = await zusageEintrag(k835.pid);
    const fenster = S.fensterAmWochentag(einst.fenster, S.berlinTeile(new Date()).wochentag);
    const fensterHeuteVorbei = !!fenster && S.berlinTeile(new Date()).hhmm >= fenster.bis;
    if (fensterHeuteVorbei) ok("Nach Fensterende wird nichts mehr eingereiht (sonst „Rückruf verpasst“)", !e835 && Object.keys(fz.uebersprungen).some((x) => /Fenster heute vorbei/.test(x)), JSON.stringify(fz.uebersprungen));
    else {
      ok(`Zusage für den ${dN} → Nachfassen HEUTE (${heute} = erster Tag nach der Überweisungszeit), Eintrag vom Planer`, e835?.status === "wartet" && e835?.erzeugt_von === "takt" && /Zusage für den/.test(String(e835?.grund)), JSON.stringify(e835));
      ok("… im Raten-Fenster von heute (ab Fensterbeginn), Anlass = der zugesagte Tag (für „Er wollte am … überweisen“)",
        S.berlinTeile(new Date(e835.frueh_ab)).datum === heute && S.berlinTeile(new Date(e835.frueh_ab)).hhmm === "08:00" && yyyy(new Date(e835.anlass_am)) === dN, `${new Date(e835?.frueh_ab).toISOString()} / ${e835?.anlass_am}`);
      ok("Seit der Zusage bezahlt → kein Nachfassen", !(await zusageEintrag(k837.pid)));
      ok("Zusage zurückgenommen → kein Nachfassen", !(await zusageEintrag(k838.pid)));
      ok("Neue Zusage für morgen → kein Nachfassen der alten", !(await zusageEintrag(k839.pid)));
      ok("Ein zweiter Füller-Lauf reiht nichts doppelt ein", (await P.planFuellen()).eingereiht.zusage == null && Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_aras_plan WHERE person_id = ${k835.pid} AND spielart = 'zusage'`) as any[])[0].n) === 1);
      // Wähler: vor dem Wählen noch einmal (zusageEntfaellt)
      ok("Wähler-Prüfung: nichts geändert → anrufen (null)", (await P.zusageEntfaellt({ id: Number(e835.id), person_id: k835.pid, nummer: e835.nummer, erzeugt_von: "takt", auftrag_von: null }, einst)) === null);
      await sqlPool`UPDATE fiaon_abo_raten SET status = 'bezahlt', bezahlt_am = NOW() WHERE id = ${k835.rateId}`;
      const w835 = await P.zusageEntfaellt({ id: Number(e835.id), person_id: k835.pid, nummer: e835.nummer, erzeugt_von: "takt", auftrag_von: null }, einst);
      ok("Wähler-Prüfung: inzwischen bezahlt → verfallen („Zusage erledigt“)", w835?.status === "verfallen" && /Zusage erledigt/.test(w835.grund) && (await zusageEintrag(k835.pid))?.status === "verfallen", JSON.stringify(w835));
      const e840 = await zusageEintrag(k840.pid);
      await sqlPool`INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note, promised_date, created_at) VALUES (${k840.ref}, ${ausweis}, 'Aras', 'result', 'erreicht_zahlt_am', 'neuer Tag', (${plusTage(heute, 2)}::date)::timestamp AT TIME ZONE 'Europe/Berlin', NOW())`;
      const w840 = e840 ? await P.zusageEntfaellt({ id: Number(e840.id), person_id: k840.pid, nummer: e840.nummer, erzeugt_von: "takt", auftrag_von: null }, einst) : null;
      ok("Wähler-Prüfung: inzwischen ein neuer Zahltag → verfallen (der Planer fasst zum neuen Tag nach)", w840?.status === "verfallen" && /neue Zusage/.test(w840.grund), JSON.stringify(w840));
    }
  }
  const p841 = await person(841); await vertrag(p841, 841);
  const hand = await P.planEinreihen({ personId: p841, nummer: nummerVon(841), spielart: "zusage", grund: "Prüfstand von Hand", erzeugtVon: "chef", auftragVon: "Chef #928" });
  ok("ROT-PROBE: von Hand eingereiht (ohne Zusage in der Akte) → der Wähler ruft wie gewünscht an", hand.ok && (await P.zusageEntfaellt({ id: Number(hand.id), person_id: p841, nummer: nummerVon(841), erzeugt_von: "chef", auftrag_von: "Chef #928" }, einst)) === null, hand.grund);

  // Das Werkzeug selbst (echt, ohne Versand): der ehrliche Satz, die Akte, KEIN Eintrag „am Tag danach“.
  const p842 = await person(842); const v842 = await vertrag(p842, 842);
  const a842 = await arasAnruf(p842, 842, null, v842.rateId, { ergebnis: null });
  const datum = plusTage(heute, 2);
  const ctx = (pid: number, a: { callId: number; arasAnrufId: number }, n: number, ref: string | null, einstellungen = einst) => ({
    callId: a.callId, arasAnrufId: a.arasAnrufId, personId: pid, ref, nummer: nummerVon(n), land: "DE" as const, spielart: "termin" as const,
    briefing: { offeneRate: null } as any, einstellungen, ergebnisGesetzt: false, ausgefuehrt: [] as any[],
    letzteKundenZeile: () => null, aufnahmeStarten: async () => ({ ok: false }), uebergabe: async () => ({ ok: false }), beenden: async () => {},
  });
  const c842 = ctx(p842, a842, 842, null);
  const r842 = await werkzeugAusfuehren(c842 as any, "zahlungszusage_merken", { datum }, "pruef-842");
  ok("zahlungszusage_merken sagt die Wahrheit: „Notiert: Sie überweisen am TT.MM. Falls bis <wiederAb> nichts angekommen ist, melde ich mich kurz.“",
    r842.ok && r842.vorlesen === S.zusageNotiertSatz(datum), r842.vorlesen);
  const [cl842] = (await sqlPool`SELECT ref, outcome, (promised_date AT TIME ZONE 'Europe/Berlin')::date::text AS tag FROM fiaon_contact_log WHERE ref = ${v842.ref} ORDER BY id DESC LIMIT 1`) as any[];
  ok("… die Zusage steht in der Akte — auch ohne Kennung im Plan (gebuchter Rückruf): an der aktuellen Bestellung", cl842?.outcome === "erreicht_zahlt_am" && cl842?.tag === datum && c842.ergebnisGesetzt === true, JSON.stringify(cl842));
  ok("… und KEIN Zusage-Eintrag „am Tag danach“ mehr (das Nachfassen reiht der Planer am Tag nach der Pause ein)", !(await zusageEintrag(p842)));
  ok("… die Rate-Pause greift sofort (zusagePauseFuer: bis = zugesagter Tag + 2 Bank-Werktage)", (await P.zusagePauseFuer(p842))?.wiederAb === S.zusagePause(datum).wiederAb, JSON.stringify(await P.zusagePauseFuer(p842)));
  const p843 = await person(843);
  const a843 = await arasAnruf(p843, 843, null, null, { ergebnis: null });
  const r843 = await werkzeugAusfuehren(ctx(p843, a843, 843, null) as any, "zahlungszusage_merken", { datum }, "pruef-843");
  ok("ROT-PROBE: ohne Vertrag (keine Akte, niemand fasst nach) verspricht ARAS auch kein Melden", r843.ok && !/melde ich mich/.test(r843.vorlesen) && /^Notiert: Sie überweisen am \d{2}\.\d{2}\.$/.test(r843.vorlesen), r843.vorlesen);
  const tr = await werkzeugAusfuehren({ ...ctx(p843, a843, 843, null), trocken: true } as any, "zahlungszusage_merken", { datum }, "pruef-843-probe");
  ok("Probeanruf (trocken): derselbe ehrliche Satz, nichts eingetragen", tr.vorlesen === S.zusageNotiertSatz(datum));

  titel("B3b. SPIELART „ZUSAGE“ AUS (wie in der Produktion): nach der Pause rufen die normalen Rate-Anrufe wieder an — so stimmt ARAS' Satz");
  await setze("aras_spielarten", JSON.stringify({ termin: "an", willkommen: "an", rate: "an", zusage: "aus", stufe_a: "an", auftrag: "an", probe: "an" }));
  const einstAus = await P.arasEinstellungenLesen(true);
  // Die Zusage, deren Pause genau gestern endete (wiederAb = heute); gibt es heute keine (So/Mo), die jüngste schon beendete.
  let dEnde: string | null = null;
  for (let n = 1; n <= 20 && !dEnde; n++) { const d = plusTage(heute, -n); if (S.zusagePause(d).wiederAb === heute) dEnde = d; }
  const genauHeute = !!dEnde;
  for (let n = 1; n <= 30 && !dEnde; n++) { const d = plusTage(heute, -n); if (S.zusagePause(d).wiederAb <= heute) dEnde = d; }
  const kEnde = await zusageAkte(848, dEnde!);
  const fAus = await P.planFuellen();
  await sqlPool`UPDATE fiaon_aras_plan SET spaet_bis = GREATEST(spaet_bis, NOW() + INTERVAL '2 hours') WHERE status = 'wartet'`;
  const rateWartet = async (pid: number) => ((await sqlPool`SELECT id, erzeugt_von, rate_id FROM fiaon_aras_plan WHERE person_id = ${pid} AND spielart = 'rate' AND status = 'wartet' ORDER BY id DESC LIMIT 1`) as any[])[0] ?? null;
  const eEnde = await rateWartet(kEnde.pid);
  ok(`Zusage für den ${dEnde}: Pause bis ${S.zusagePause(dEnde!).bis}, ${genauHeute ? "wiederAb = HEUTE" : "schon vorbei (heute So/Mo)"} → heute wieder ein Rate-Anruf in der Reihe (Planer, Spielart „Zusage“ aus)`,
    !!eEnde && eEnde.erzeugt_von === "takt" && Number(eEnde.rate_id) === kEnde.rateId, JSON.stringify(fAus.eingereiht));
  ok("… und der Wähler lässt ihn durch (rateEntfaellt: keine Zusage-Pause mehr)",
    !!eEnde && (await P.rateEntfaellt({ id: Number(eEnde.id), person_id: kEnde.pid, rate_id: Number(eEnde.rate_id), erzeugt_von: "takt", auftrag_von: null }, einstAus)) === null);
  ok("Spielart „Zusage“ aus → kein Nachfass-Eintrag, die Rate-Anrufe übernehmen", !(await zusageEintrag(kEnde.pid)));
  ok("ROT-PROBE: Zusage für gestern (die Pause läuft noch) → KEIN Rate-Anruf", !(await rateWartet(k836.pid)) && Object.keys(fAus.uebersprungen).some((x) => x.startsWith("rate:Zahlungszusage")), JSON.stringify(fAus.uebersprungen));
  const e836 = await P.planEinreihen({ personId: k836.pid, ref: k836.ref, nummer: nummerVon(836), spielart: "rate", grund: "Prüfstand: schon eingereiht", erzeugtVon: "takt", rateId: k836.rateId });
  const w836 = e836.id ? await P.rateEntfaellt({ id: Number(e836.id), person_id: k836.pid, rate_id: k836.rateId, erzeugt_von: "takt", auftrag_von: null }, einstAus) : null;
  const s836 = ((await sqlPool`SELECT status, frueh_ab FROM fiaon_aras_plan WHERE id = ${Number(e836.id ?? 0)}`) as any[])[0];
  ok("ROT-PROBE Wähler: ein schon eingereihter Rate-Eintrag während der Pause → verschoben, zurück erst am ersten Tag danach (wiederAb)",
    w836?.status === "verschoben" && s836?.status === "verschoben" && S.berlinTeile(new Date(s836.frueh_ab)).datum === S.zusagePause(plusTage(heute, -1)).wiederAb, JSON.stringify(s836));
  // Der Satz: „… melde ich mich kurz“ nur, wenn danach wirklich ein Anruf kommt.
  const datumAus = plusTage(heute, 2);
  const a842b = await arasAnruf(p842, 842, null, v842.rateId, { ergebnis: null });
  const r842b = await werkzeugAusfuehren(ctx(p842, a842b, 842, null, einstAus) as any, "zahlungszusage_merken", { datum: datumAus }, "pruef-842b");
  ok("Zusage aus, offene Rate → „Falls bis <wiederAb> nichts angekommen ist, melde ich mich kurz.“ (die Rate-Anrufe kommen ab wiederAb)", r842b.vorlesen === S.zusageNotiertSatz(datumAus), r842b.vorlesen);
  const p849 = await person(849);
  const ref849 = "PRUEF-E408-A849";
  await sqlPool`INSERT INTO fiaon_applications (ref, payment_reference, person_id, payment_status, status, current_step, submitted_at, pack_key, pack_name, type, ist_entwurf, created_at)
    VALUES (${ref849}, ${`${ref849}-Z`}, ${p849}, 'pending_payment', 'approved', 9, NOW() - INTERVAL '1 hour', 'plus', 'Plus', 'privat', FALSE, NOW() - INTERVAL '1 hour')`;
  const a849 = await arasAnruf(p849, 849, ref849, null, { spielart: "willkommen", ergebnis: null });
  const r849 = await werkzeugAusfuehren(ctx(p849, a849, 849, ref849, einstAus) as any, "zahlungszusage_merken", { datum: datumAus }, "pruef-849");
  ok("ROT-PROBE: Zusage zur ERSTEN Zahlung (Willkommen, noch keine Rate), Spielart „Zusage“ aus → KEIN „melde ich mich“ — danach ruft ARAS nicht an",
    r849.ok && /^Notiert: Sie überweisen am \d{2}\.\d{2}\.$/.test(r849.vorlesen), r849.vorlesen);
  await setze("aras_spielarten", JSON.stringify({ termin: "an", willkommen: "an", rate: "an", zusage: "an", stufe_a: "an", auftrag: "an", probe: "an" }));
  const einstAn = await P.arasEinstellungenLesen(true);
  const a849b = await arasAnruf(p849, 849, ref849, null, { spielart: "willkommen", ergebnis: null });
  const r849b = await werkzeugAusfuehren(ctx(p849, a849b, 849, ref849, einstAn) as any, "zahlungszusage_merken", { datum: datumAus }, "pruef-849b");
  ok("… mit Spielart „Zusage“ an (der Nachfass-Anruf folgt) → der Satz mit „melde ich mich kurz“", r849b.vorlesen === S.zusageNotiertSatz(datumAus), r849b.vorlesen);

  titel("B4. BESTE UHRZEIT: wann er zuletzt abgenommen hat (versucheHeute.erreichtAm)");
  const p844 = await person(844);
  const abends = berlinZeitpunkt(plusTage(heute, -2), 18 * 60 + 30);
  await sqlPool`INSERT INTO fiaon_calls (person_id, agent_id, nummer, richtung, status, beginn, dauer_sek, ergebnis, gefuehrt_von) VALUES (${p844}, ${ausweis}, ${nummerVon(844)}, 'raus', 'beendet', ${abends}, 120, 'erreicht_sonstiges', 'mensch')`;
  await sqlPool`INSERT INTO fiaon_calls (person_id, agent_id, nummer, richtung, status, beginn, dauer_sek, ergebnis, gefuehrt_von) VALUES (${p844}, ${ausweis}, ${nummerVon(844)}, 'raus', 'niemand_erreicht', ${berlinZeitpunkt(plusTage(heute, -1), 10 * 60)}, 0, 'mailbox', 'aras')`;
  const v844 = await P.versucheHeute(p844);
  ok("Abgenommen vorgestern 18:30 (Team) → erreichtAm = dieser Anruf, Abschnitt Abend; der Mailbox-Versuch danach zählt nicht", v844.erreichtAm?.getTime() === abends.getTime() && S.tagesabschnitt(v844.erreichtAm!) === "abend" && v844.fehlFolge === 1, JSON.stringify(v844));
  const p845 = await person(845);
  await sqlPool`INSERT INTO fiaon_calls (person_id, agent_id, nummer, richtung, status, beginn, dauer_sek, ergebnis, gefuehrt_von) VALUES (${p845}, ${ausweis}, ${nummerVon(845)}, 'raus', 'beendet', ${berlinZeitpunkt(plusTage(heute, -2), 11 * 60)}, 45, 'mailbox', 'mensch')`;
  ok("ROT-PROBE: eine 45-Sekunden-Mailbox-Nachricht ist kein Abnehmen (erreichtAm leer)", (await P.versucheHeute(p845)).erreichtAm === null);

  titel("B5. AUFNAHMEN UND ABSCHRIFTEN NACH 90 TAGEN (Twilio-Attrappe)");
  const geloescht: string[] = [];
  const { aufnahmenAufraeumen } = await import("../server/lib/fiaon-softphone");
  const teamVorher = (await aufnahmenAufraeumen(true)).faellig;
  let sidNr = 0;
  async function altesGespraech(pid: number | null, n: number, x: { tage?: number; aufnahme?: boolean; team?: boolean; probe?: boolean } = {}) {
    const am = new Date(Date.now() - (x.tage ?? 100) * 86_400_000);
    const sid = `RE${String(++sidNr).padStart(32, "0")}`;
    const [c] = (await sqlPool`INSERT INTO fiaon_calls (person_id, agent_id, nummer, richtung, status, beginn, twilio_sid, gefuehrt_von, recording_sid, recording_url, transkript, transkript_status, zusammenfassung, created_at)
      VALUES (${pid}, ${ausweis}, ${nummerVon(n)}, 'raus', 'beendet', ${am}, ${`CA-pruef-alt-${n}-${sidNr}`}, ${x.team ? "mensch" : "aras"}, ${x.aufnahme === false ? null : sid},
              ${x.aufnahme === false ? null : `https://api.twilio.com/2010-04-01/Accounts/AC0/Recordings/${sid}`}, ${x.aufnahme === false ? null : "Kunde: Hallo …"}, 'fertig', 'Zusammenfassung bleibt', ${am}) RETURNING id`) as any[];
    if (!x.team) await sqlPool`INSERT INTO fiaon_aras_anruf (call_id, spielart, briefing, adapter, stimme, prompt_version, transkript, transkript_grund, aufnahme_ja_text, zusammenfassung, created_at, nachbereitet_am)
      VALUES (${c.id}, ${x.probe ? "probe" : "rate"}, '{}'::jsonb, 'attrappe', 'juni', 'pruefstand', ${sqlPool.json([{ t: 0, wer: "kunde", text: "Hallo" }])}, ${x.probe ? "probe" : "aufnahme_ja"}, 'Ja, gerne.', 'Zusammenfassung bleibt', ${am}, ${am})`;
    return { callId: Number(c.id), sid };
  }
  const zustand = async (callId: number) => ((await sqlPool`SELECT c.recording_url, c.recording_sid, c.transkript, c.aufnahme_geloescht_am, c.zusammenfassung, aa.transkript AS aa_transkript, aa.aufnahme_ja_text, aa.zusammenfassung AS aa_zus
      FROM fiaon_calls c LEFT JOIN fiaon_aras_anruf aa ON aa.call_id = c.id WHERE c.id = ${callId}`) as any[])[0];
  const p846 = await person(846), p847 = await person(847);
  await sqlPool`INSERT INTO fiaon_aras_person (person_id, aus_am, aus_grund, aus_von) VALUES (${p847}, NOW(), 'Streitfall am Telefon: Anwalt', 'ARAS (Streitfall)')`;
  const g846 = await altesGespraech(p846, 846);
  const g847 = await altesGespraech(p847, 847);
  const g848 = await altesGespraech(p846, 846);   // eigene Gespräche desselben Kunden: Twilio antwortet je Aufnahme anders
  const g849 = await altesGespraech(p846, 846);
  const gTeam = await altesGespraech(p846, 846, { team: true });
  const gJung = await altesGespraech(p846, 846, { tage: 80 });
  const gProbe = await altesGespraech(null, 899, { aufnahme: false, probe: true });
  const teamNachher = (await aufnahmenAufraeumen(true)).faellig;
  ok("Der Team-Lauf (aufnahmenAufraeumen) zählt das alte Team-Gespräch, NIE die ARAS-Gespräche (die löscht ihr eigener Lauf)", teamNachher - teamVorher === 1, `${teamVorher} → ${teamNachher}`);
  // Die Twilio-Attrappe: 848 antwortet mit 503 (Twilio gestört), 849 mit 404 (Aufnahme schon weg), alle anderen löschen.
  twilioClientSetzen({ recordings: (sid: string) => ({ remove: async () => {
    if (sid === g848.sid) throw Object.assign(new Error("Twilio 503"), { status: 503 });
    if (sid === g849.sid) throw Object.assign(new Error("not found"), { status: 404, code: 20404 });
    geloescht.push(sid); return true;
  } }) });
  const l1 = await A.arasAufbewahrung(sqlPool);
  const s846 = await zustand(g846.callId), s847 = await zustand(g847.callId), s848 = await zustand(g848.callId), s849 = await zustand(g849.callId);
  ok("ARAS-Gespräch, 100 Tage alt: Aufnahme bei Twilio gelöscht, dann URL und beide Abschriften leer, aufnahme_geloescht_am gesetzt",
    geloescht.includes(g846.sid) && s846.recording_url === null && s846.transkript === null && s846.aa_transkript === null && !!s846.aufnahme_geloescht_am, JSON.stringify(s846));
  ok("… die Zusammenfassung und der Ja-Satz zur Aufnahme bleiben (Arbeitsergebnis, Nachweis)", s846.zusammenfassung === "Zusammenfassung bleibt" && s846.aa_zus === "Zusammenfassung bleibt" && s846.aufnahme_ja_text === "Ja, gerne.");
  ok("Streitfall offen → NICHT gelöscht (Aufnahme, Abschriften bleiben; kein Twilio-Aufruf)", !geloescht.includes(g847.sid) && !!s847.recording_url && !!s847.transkript && !!s847.aa_transkript && !s847.aufnahme_geloescht_am && l1.behaltenAnrufe.includes(g847.callId), JSON.stringify(l1));
  const [prA] = (await sqlPool`SELECT text FROM fiaon_mara_protokoll WHERE kanal = 'telefon' AND daten->>'aufbewahrung' = 'true' ORDER BY id DESC LIMIT 1`) as any[];
  ok("… und im Protokoll vermerkt (mit der Anruf-Kennung)", new RegExp(`Streitfall oder Beschwerde offen \\(Anruf [^)]*${g847.callId}`).test(String(prA?.text ?? "")), prA?.text);
  ok("ROT-PROBE Twilio-Fehler (503) → die Zeile bleibt unverändert (URL, Abschriften), nächster Lauf erneut", !!s848.recording_url && !!s848.transkript && !!s848.aa_transkript && !s848.aufnahme_geloescht_am && l1.twilioFehler === 1, JSON.stringify(s848));
  ok("Twilio kennt die Aufnahme nicht mehr (404) → gilt als gelöscht, Zeile geleert", s849.recording_url === null && s849.transkript === null && !!s849.aufnahme_geloescht_am);
  const st = await zustand(gTeam.callId), sj = await zustand(gJung.callId), sp = await zustand(gProbe.callId);
  ok("ROT-PROBE: das Team-Gespräch bleibt unberührt (nie Team-Gespräche)", !!st.recording_url && !!st.transkript && !st.aufnahme_geloescht_am && !geloescht.includes(gTeam.sid));
  ok("ROT-PROBE: ein ARAS-Gespräch von vor 80 Tagen bleibt", !!sj.recording_url && !!sj.aa_transkript && !geloescht.includes(gJung.sid));
  ok("Probeanruf ohne Aufnahme, nur Abschrift: geleert, ohne Twilio", sp.aa_transkript === null && !!sp.aufnahme_geloescht_am);
  twilioClientSetzen({ recordings: (sid: string) => ({ remove: async () => { geloescht.push(sid); return true; } }) });
  const l2 = await A.arasAufbewahrung(sqlPool);
  const s848b = await zustand(g848.callId);
  ok("Am nächsten Tag geht Twilio wieder → 848 gelöscht; die schon gelöschten fasst der Lauf nicht mehr an", s848b.recording_url === null && s848b.aa_transkript === null && geloescht.filter((s) => s === g846.sid).length === 1 && geloescht.filter((s) => s === g848.sid).length === 1, JSON.stringify(l2));
  const { anrufDetail } = await import("../server/lib/fiaon-aras-nachbereitung");
  const [aa846] = (await sqlPool`SELECT id FROM fiaon_aras_anruf WHERE call_id = ${g846.callId}`) as any[];
  ok("Cockpit: nach dem Löschen kein Abspieler mehr (aufnahmeUrl leer)", (await anrufDetail(Number(aa846.id)))?.aufnahmeUrl === null);
  twilioClientSetzen(null);
}

main().then(() => {
  console.log(`\n${schlecht === 0 ? "GRÜN" : "ROT"}: ${gut} ok, ${schlecht} rot`);
  process.exit(schlecht === 0 ? 0 : 1);
}).catch((e) => { console.error("ABBRUCH:", e); process.exit(2); });
