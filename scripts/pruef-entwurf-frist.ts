// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-401 (6/6, 19.10.2026), OFFLINE: Entwürfe bleiben nicht liegen — die REGEL (rein)
//
// shared/fiaon-entwurf-frist.ts: nichtMehrNoetig, fristUrteil (Reihenfolge, 24-Stunden-Grenze, Versandfenster
// sommer- und winterzeitfest, Altbestand, Widerruf/Recht, Global, Sperren), Schalter (Vorgabe AUS) — und die
// Entscheidungskarte „alte Entwürfe ablegen?“ (altbestandKarte, rein). Ohne Datenbank, ohne Netz.
//   env -i HOME=$HOME PATH=$PATH TZ=Europe/Berlin DATABASE_URL=postgresql://pruef@127.0.0.1:9/keine \
//     node_modules/.bin/tsx scripts/pruef-entwurf-frist.ts
// Der Datenbank-Teil (Ablegen, Neuschreiben über mailBearbeiten, Senden, E-393, Altbestand): pruef-entwurf-frist-db.ts.
// ═══════════════════════════════════════════════════════════════════════════
process.env.DATABASE_URL ||= "postgresql://pruef@127.0.0.1:9/keine";
for (const k of ["BREVO_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_SA_KEY", "MAKE_WEBHOOK_URL", "WHATSAPP_TOKEN"]) delete process.env[k];

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra: unknown = "") {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; console.log(`  ✗ ${was}${extra !== "" ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra)}` : ""}`); }
}

async function main() {
  const R = await import("../shared/fiaon-entwurf-frist");
  const PE = await import("../server/lib/fiaon-postmeister-entscheidungen");
  const H = 3_600_000;
  // Fester Prüfzeitpunkt: Mo 19.10.2026 14:00 Berlin (Sommerzeit, UTC+2) — im Versandfenster.
  const JETZT = new Date("2026-10-19T12:00:00Z");
  const vor = (std: number) => new Date(JETZT.getTime() - std * H).toISOString();
  type Fakten = Parameters<typeof R.fristUrteil>[0];
  const basis = (x: Partial<Fakten> = {}): Fakten => ({
    id: 1, neu: true, entwurfAm: vor(26), mailAm: vor(26.5), neuGeschriebenAm: null, begruendung: "sauber, aber Entwurf (Lage oder Flag)",
    kategorien: ["status_frage"], flags: {}, global: false, spaetereMail: null, stornoAm: null, kuendigungAm: null, gespraechAm: null, zahlungAm: null, ...x,
  });
  const UMFELD = { modus: "auto" as const, kiPausiert: false, altbestandAblegen: false, sperre: null };
  const u = (f: Partial<Fakten>, um: Partial<typeof UMFELD> = {}, jetzt = JETZT) => R.fristUrteil(basis(f), { ...UMFELD, ...um }, jetzt);

  console.log("── 1 · Der Schalter für den Altbestand: Vorgabe AUS");
  ok(!R.altbestandSchalterAn(undefined) && !R.altbestandSchalterAn(null) && !R.altbestandSchalterAn(""), "fehlt / leer → aus");
  ok(!R.altbestandSchalterAn("aus") && !R.altbestandSchalterAn("1") && !R.altbestandSchalterAn("ja"), "„aus“, „1“, „ja“ → aus (nur „an“ schaltet ein)");
  ok(R.altbestandSchalterAn("an") && R.altbestandSchalterAn(" AN "), "„an“ → an");
  ok(R.FRIST_GRUENDE.every((g) => R.GRUND_TEXT[g] && R.GRUND_KURZ[g]), "jeder Grund hat Text und Kurzform");

  console.log("── 2 · Heikel, Global, Zahlungsthema (rein)");
  ok(R.heikelFall("Übergabe an den Betreuer: Widerruf", {}) === "widerruf" && R.heikelFall("", { widerruf: true }) === "widerruf", "Widerruf aus Grund oder Lampe");
  ok(R.heikelFall("Übergabe an den Betreuer: rechtliches Anliegen", {}) === "rechtlich" && R.heikelFall("", { droht_anwalt: true }) === "rechtlich"
    && R.heikelFall("Behörde", {}) === "rechtlich", "Anwalt/Recht/Behörde");
  ok(R.heikelFall("sauber, aber Entwurf", { kuendigung: true, beschwerde: true }) === null, "Kündigung/Beschwerde allein ist nicht heikel (Mara antwortet selbst, E-369)");
  ok(R.globalFall({ global: false, begruendung: "Übergabe an den Betreuer: Kunde von FIAON Global" }) && R.globalFall({ global: true, begruendung: null }), "Global aus Zeile oder Begründung");
  ok(R.zahlungsThema(["zahlung"], {}) && R.zahlungsThema(["status_frage"], { zahlung_behauptet: true }), "Zahlung: Kategorie oder „habe bezahlt“");
  ok(!R.zahlungsThema(["zahlung"], { bestreitet: true }) && !R.zahlungsThema(["zahlung"], { zahlungsunfaehig: true }) && !R.zahlungsThema(["zahlung", "beschwerde"], {}),
    "nicht bei Bestreiten, „kann nicht zahlen“, Beschwerde");
  ok(!R.zahlungsThema(["status_frage"], {}), "Kartenfrage ist kein Zahlungsthema");

  console.log("── 3 · Nicht mehr nötig — nur, was NACH der Kundenmail geschah");
  const n = (f: Partial<Fakten>) => R.nichtMehrNoetig(basis(f));
  ok(n({})  === null, "nichts geschehen → nötig");
  ok(n({ spaetereMail: { id: 77, am: vor(20) } })?.wegen === "kunde_schrieb" && /Mail #77/.test(n({ spaetereMail: { id: 77, am: vor(20) } })!.grund), "spätere Mail → kunde_schrieb (mit Nummer)");
  ok(n({ spaetereMail: { id: 77, am: vor(30) } }) === null, "„spätere“ Mail VOR der Kundenmail zählt nicht");
  ok(n({ stornoAm: vor(3) })?.wegen === "storno" && n({ kuendigungAm: vor(3) })?.wegen === "kuendigung", "Storno / Kündigung danach");
  ok(n({ kuendigungAm: vor(40) }) === null, "Kündigung VOR der Mail zählt nicht");
  ok(n({ gespraechAm: vor(2) })?.wegen === "gespraech", "Gespräch danach");
  ok(n({ zahlungAm: vor(2), kategorien: ["zahlung"] })?.wegen === "zahlung", "Zahlung danach + Zahlungsthema");
  ok(n({ zahlungAm: vor(2) }) === null, "Zahlung danach, aber Kartenfrage → nötig");
  const W = { begruendung: "Übergabe an den Betreuer: Widerruf", flags: { widerruf: true } };
  ok(n({ ...W, kuendigungAm: vor(2), gespraechAm: vor(2), zahlungAm: vor(2), kategorien: ["zahlung"] }) === null, "Widerruf: Kündigung, Gespräch, Zahlung erledigen ihn nicht");
  ok(n({ ...W, stornoAm: vor(2) })?.wegen === "storno" && n({ ...W, spaetereMail: { id: 5, am: vor(1) } })?.wegen === "kunde_schrieb", "Widerruf: Storno oder neuere Mail erledigen ihn");
  const RE = { begruendung: "Übergabe an den Betreuer: rechtliches Anliegen" };
  ok(n({ ...RE, stornoAm: vor(2), kuendigungAm: vor(2), gespraechAm: vor(2) }) === null && n({ ...RE, spaetereMail: { id: 5, am: vor(1) } })?.wegen === "kunde_schrieb",
    "Anwalt/Behörde: nur die neuere Mail (sie trägt den Fall weiter)");
  ok(n({ spaetereMail: { id: 9, am: vor(1) }, kuendigungAm: vor(2) })?.wegen === "kunde_schrieb", "Reihenfolge: die neuere Mail zuerst");

  console.log("── 4 · Das Urteil — Reihenfolge");
  ok(u({ global: true, spaetereMail: { id: 2, am: vor(1) } }).art === "auslassen", "Global → auslassen (auch wenn nicht mehr nötig)");
  ok(u({}, { modus: "aus" }).art === "warten", "Postfach aus (Not-Aus) → warten, auch kein Ablegen");
  ok(u({ entwurfAm: vor(23.9), spaetereMail: { id: 2, am: vor(1) } }).art === "warten", "Entwurf jünger als 24 h → warten (auch wenn nicht mehr nötig)");
  ok(u({ entwurfAm: vor(24) }).art === "neu_schreiben", "genau 24 h → neu schreiben");
  const ab = u({ spaetereMail: { id: 2, am: vor(1) } });
  ok(ab.art === "ablegen" && (ab as any).wegen === "kunde_schrieb", "neu + nicht mehr nötig → ablegen");
  ok(u({ neu: false, spaetereMail: { id: 2, am: vor(1) } }).art === "ablegen_probe", "Altbestand + nicht mehr nötig, Schalter aus → nur Probe");
  ok(u({ neu: false, spaetereMail: { id: 2, am: vor(1) } }, { altbestandAblegen: true }).art === "ablegen", "Altbestand + nicht mehr nötig, Schalter an → ablegen");
  ok(u({ neu: false }, { altbestandAblegen: true }).art === "bleibt" && /Altbestand/.test(u({ neu: false }).grund), "Altbestand, nötig → bleibt (nie neu schreiben, nie senden)");
  ok(u({ neuGeschriebenAm: vor(25) }).art === "bleibt", "schon einmal neu geschrieben → bleibt (genau ein Entwurf)");
  ok(u({ neuGeschriebenAm: vor(25), spaetereMail: { id: 2, am: vor(1) } }).art === "ablegen", "… wird aber noch abgelegt, wenn nicht mehr nötig");
  ok(u(W).art === "bleibt" && /Widerruf/.test(u(W).grund), "Widerruf → bleibt (Justin entscheidet)");
  ok(u(RE).art === "bleibt", "Anwalt/Recht → bleibt");
  ok(u({}, { sperre: "Testkonto" }).art === "bleibt" && u({}, { sperre: "Vertriebssperre" }).art === "bleibt", "Testkonto / Vertriebssperre → bleibt");
  ok(u({ mailAm: vor(7 * 24 + 1) }).art === "bleibt" && u({ mailAm: vor(7 * 24 - 1) }).art === "neu_schreiben", "Kundenmail älter als 7 Tage → bleibt; knapp darunter → neu");
  ok(u({}, { kiPausiert: true }).art === "warten", "KI-Pause → warten");
  ok(u({ entwurfAm: null, mailAm: null }).art === "neu_schreiben", "fehlende Zeiten → wie alt (kein Absturz)");

  console.log("── 5 · Versandfenster 08:00–20:00 Berlin (Sommer- und Winterzeit)");
  const um = (iso: string) => u({ entwurfAm: "2026-01-01T00:00:00Z", mailAm: new Date(Date.parse(iso) - 30 * H).toISOString() }, {}, new Date(iso)).art;
  ok(um("2026-10-19T05:59:00Z") === "warten" && um("2026-10-19T06:00:00Z") === "neu_schreiben", "Sommerzeit: 07:59 wartet, 08:00 schreibt");
  ok(um("2026-10-19T17:59:00Z") === "neu_schreiben" && um("2026-10-19T18:00:00Z") === "warten", "Sommerzeit: 19:59 schreibt, 20:00 wartet");
  ok(um("2026-11-02T06:59:00Z") === "warten" && um("2026-11-02T07:00:00Z") === "neu_schreiben", "Winterzeit: 07:59 wartet, 08:00 schreibt");
  ok(um("2026-11-02T18:59:00Z") === "neu_schreiben" && um("2026-11-02T19:00:00Z") === "warten", "Winterzeit: 19:59 schreibt, 20:00 wartet");
  ok(u({ spaetereMail: { id: 2, am: vor(1) } }, {}, new Date("2026-10-19T21:00:00Z")).art === "ablegen", "Ablegen auch nachts (es geht keine Mail hinaus)");

  console.log("── 6 · Begründung und Entscheidungskarte (rein)");
  const b = R.ablageBegruendung("x".repeat(600));
  ok(b.startsWith(R.ABLAGE_KOPF) && b.length <= 400, "Begründung beginnt mit dem Kopf, höchstens 400 Zeichen");
  const st = (x: { an?: boolean; n?: number; offen?: number } = {}) => ({
    altbestandAblegen: !!x.an,
    altbestand: { gesamt: 220, nichtMehrNoetig: x.n ?? 112, jeGrund: { kunde_schrieb: 100, storno: 0, kuendigung: 3, gespraech: 6, zahlung: 3 }, offen: x.offen ?? 101, aeltester: "2026-09-08T09:31:15Z" },
  });
  const k = PE.altbestandKarte(st(), R.GRUND_KURZ);
  ok(k && k.schluessel === PE.ALTBESTAND_KARTE && k.art === "postmeister_altbestand", "Karte mit festem Schlüssel");
  ok(k?.titel === "112 alte Entwürfe sind nicht mehr nötig — ablegen?", "Titel nennt die Zahl", k?.titel);
  ok(k?.empfehlung === "ablegen" && k.optionen.map((o) => `${o.key}:${o.werkzeug}`).join() === "ablegen:postmeister_altbestand_ablegen,lassen:nichts", "Knöpfe: ablegen (Empfehlung) / so lassen");
  ok(/KEINE Mail an Kunden/.test(String(k?.text)) && /101 brauchen noch eine Antwort/.test(String(k?.text)), "Text: keine Mail an Kunden; was offen bleibt");
  ok((k?.belege ?? []).map((x) => x.text).join(" | ") === "Kunde schrieb danach: 100 | Gespräch geführt: 6 | Kündigung gebucht: 3 | Zahlung gebucht: 3 | 101 bleiben | älteste 08.09.",
    "Belege: Gründe nach Häufigkeit (ohne Nullen), was bleibt, älteste", (k?.belege ?? []).map((x) => x.text));
  ok(PE.altbestandKarte(st({ an: true }), R.GRUND_KURZ) === null && PE.altbestandKarte(st({ n: 0 }), R.GRUND_KURZ) === null, "keine Karte bei Schalter an oder nichts abzulegen");
  ok(!/\b(?:Herr|Frau)\s/.test(JSON.stringify(k)), "die Karte nennt keinen Menschen (nur Zahlen und Gründe)");

  console.log(`\n${gut} gut, ${schlecht} schlecht`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
