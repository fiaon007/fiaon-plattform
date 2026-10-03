// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: MARA ERLEDIGT SELBST — KARTENLINK, KEIN PFLICHT-TERMIN (02.10.2026, E-275)
//
// Justin am 02.10.: „MARA verweist immer mehr auf die Mitarbeiter, Mara soll aber selbstständig arbeiten ohne jedes
// mal ein Termin zu vereinbaren (Whatsapp aber natürlich auch per mail!) Mara soll selbst verkaufen … (Mara soll sowas
// sagen wie: Hi, zahl die Aktivierung, die Karte geht zeitnahe in Produktion - also: Jetzt zahlen! ;D) - so in etwa nur
// seriös. Aber nicht immer sagen ‚Ich mache einen Termin mit XY‘ oder ‚Wir sind keine Bank und können nichts wissen‘
// Mara soll positiv, verkäuferisch und selbstständig agieren."
// Anlass: Postmeister-Fall 6120 (ULTRA am 02.08. bezahlt, „I have not your kaditkarte“) — Mara: „The card itself is
// issued and sent by the bank … I have asked Nikita Boychenko to check this today". Auf WhatsApp dasselbe Muster
// (#2413 „Nikita Boychenko schaut mit Ihnen nach“, #2003 „Justin schaut nach, warum nichts angekommen ist“).
//
// Zwei Teile:
//   A. REGELN OHNE DATENBANK — fragtNachKarte (echte Sätze), die Abschlüsse ohne Termin mit Justins Satz und der Bitte
//      ums Zahlen, „Karte nicht bekommen“ mit dem Satz aus dem Bereich Karte, die weiche Prüfung gegen ungefragte
//      Anrufe und „X meldet sich“, kein_einblick, der Auftrag, mailAbschlussPflicht, der sichere Satz.
//   B. GEGEN DIE LOKALE TEST-DB — maraAntwortet mit einer Attrappe für das Modell (fetch nachgebaut, kein Netz) und
//      einer Attrappe für den Kartenweg (KARTEN_WEG.einladung — der Prüfstand verschickt keine Mail):
//        k1 Fall 6120 auf WhatsApp: zahlend, Werbesperre, keine Einladung → der Server schickt den Link vorab, das Modell
//           sieht „SCHON ERLEDIGT“, das Werkzeug fällt weg, die Antwort sagt es, KEINE Übergabe, Protokoll „karte_link“.
//        k2 derselbe, der Kartenweg lehnt ab (Ausschluss) → Übergabe mit internem Grund, der Kunde liest keinen Grund.
//        k3 B (erste Zahlung offen) fragt nach der Karte → KEIN Kartenlink, der Abschluss bittet ums Zahlen (Justins Satz).
//        k4 zahlend, „Wie komme ich jetzt zur DKB?“ → das Modell ruft karte_link_schicken; fehlt der Satz in der
//           Antwort, setzt der Server ihn dazu.
//        k5 zahlend, „Bekomme ich Bescheid?“ (kein Anruf gewollt) → ein ungefragtes Terminangebot im ersten Entwurf
//           fällt weich durch (zweiter Entwurf), keine Übergabe.
//        k6 zahlend, keine E-Mail-Adresse → Mara fragt selbst danach, keine Übergabe (erst, wenn er sie schickt).
//
//   C. Mit --db --ki: dieselben Fälle k1–k5 mit dem ECHTEN Modell (OPENAI_API_KEY aus der Umgebung) — ohne Versand
//      (WhatsApp nicht eingerichtet, der Kartenweg ist die Attrappe, fetch außer OpenAI gesperrt), höchstens 30 Aufrufe.
//      Geprüft werden die harten Wände und Justins Punkte (kein Kollege, kein ungefragter Termin, kein Rückzug).
//
//   Offline:  env -i PATH="$PATH" HOME="$HOME" DOTENV_CONFIG_PATH=/dev/null npx tsx scripts/pruef-mara-karte-wa.ts
//   Mit DB:   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand…?sslmode=require' \
//               SESSION_SECRET=pruefstand-nur-lokal DOTENV_CONFIG_PATH=/dev/null npx tsx scripts/pruef-mara-karte-wa.ts --db
//   Eigene Datensätze (Personen PRUEF275-…, Nummern 4915900275xxx, Referenzen FIAON-P275…) werden am Ende entfernt;
//   die Einstellungen (mara_wa_an, ki_pause) zurückgesetzt. Verschickt nichts.
// ═══════════════════════════════════════════════════════════════════════════
const MIT_DB = process.argv.includes("--db");
const KI = MIT_DB && process.argv.includes("--ki");
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "META_SYSTEM_TOKEN", ...(KI ? [] : ["OPENAI_API_KEY"]),
  "GOOGLE_SA_KEY", "GMAIL_CLIENT_SECRET", "RESEND_API_KEY", "TWILIO_AUTH_TOKEN", "VAPID_PRIVATE_KEY"]) {
  if (process.env[k]) { console.error(`${k} ist gesetzt — Abbruch, der Prüfstand darf nichts versenden.`); process.exit(3); }
}
if (KI && !process.env.OPENAI_API_KEY) { console.error("--ki braucht OPENAI_API_KEY in der Umgebung."); process.exit(3); }
/** Höchstens so viele echte Modellaufrufe (Vorgabe E-275: 30 je Prüfer). */
const KI_DECKEL = 30;
if (MIT_DB && !/127\.0\.0\.1:54329\/fiaon_pruefstand/.test(String(process.env.DATABASE_URL))) { console.error("--db NUR gegen die lokale Test-DB!"); process.exit(3); }
if (!MIT_DB) process.env.DATABASE_URL = "postgresql://nobody@127.0.0.1:1/none";
process.env.CRONS = "aus";
process.env.SESSION_SECRET ||= "pruefstand-nur-lokal";
if (!KI) process.env.OPENAI_API_KEY = "sk-pruef-lokal-e275";

// ── Netz: nur lokal und die Attrappe für OpenAI ───────────────────────────
type Plan = { werkzeug?: { name: string; args: Record<string, unknown> }; antworten: string[] };
let plan: Plan | null = null;
const OPENAI: { system: string; zweiter: boolean; tools: string[]; antwort?: string }[] = [];
const FREMD: string[] = [];
const json = (status: number, j: unknown) => new Response(JSON.stringify(j), { status, headers: { "Content-Type": "application/json" } });
const aus = (system: string, re: RegExp) => system.match(re)?.[1]?.trim() ?? "";
const echtFetch = globalThis.fetch;
globalThis.fetch = (async (eingabe: any, init?: any) => {
  const u = String(typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe?.url ?? eingabe);
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) return echtFetch(eingabe, init);
  if (u.startsWith("https://api.openai.com/")) {
    let body: any = {};
    try { body = JSON.parse(typeof init?.body === "string" ? init.body : "{}"); } catch { /* leer */ }
    const input: any[] = Array.isArray(body.input) ? body.input : [];
    const system = String(input.find((i) => i?.role === "system")?.content ?? "");
    const nutzer = input.filter((i) => i?.role === "user").map((i) => String(i.content ?? ""));
    const werkzeugErgebnisse = input.filter((i) => i?.type === "function_call_output").map((i) => { try { return JSON.parse(String(i.output)); } catch { return {}; } });
    const zweiter = nutzer.some((t) => /darf so nicht raus|noch nicht gut genug/.test(t));
    const tools = (Array.isArray(body.tools) ? body.tools : []).map((t: any) => String(t?.name ?? t?.function?.name ?? ""));
    const eintrag = { system, zweiter, tools } as (typeof OPENAI)[number];
    OPENAI.push(eintrag);
    if (KI) {
      if (OPENAI.length > KI_DECKEL) throw new Error(`Prüfstand: mehr als ${KI_DECKEL} Modellaufrufe — Abbruch`);
      const r = await echtFetch(eingabe, init);
      try { const j = await r.clone().json(); const t = j?.output?.find((o: any) => o?.type === "message")?.content?.[0]?.text; if (t) eintrag.antwort = String(t); } catch { /* nur Protokoll */ }
      return r;
    }
    const p = plan ?? { antworten: ["Sehr gern!"] };
    if (p.werkzeug && tools.includes(p.werkzeug.name) && !werkzeugErgebnisse.length) {
      return json(200, { status: "completed", output: [{ type: "function_call", call_id: `pruef275-${OPENAI.length}`, name: p.werkzeug.name, arguments: JSON.stringify(p.werkzeug.args) }], usage: { input_tokens: 10, output_tokens: 10 } });
    }
    const so = [...werkzeugErgebnisse].reverse().find((w) => w?.so_schreiben)?.so_schreiben ?? "";
    const roh = zweiter ? (p.antworten[1] ?? p.antworten[0]) : p.antworten[0];
    const text = String(roh)
      .replace(/\{SO_SCHREIBEN\}/g, String(so))
      .replace(/\{KEINE_KARTE\}/g, aus(system, /═══ „KEINE KARTE BEKOMMEN[^\n]*\n[^\n]*?: „([\s\S]*?)"\n/))
      .replace(/\{ABSCHLUSS\}/g, aus(system, /So, eingesetzt für ihn \(in eigenen Worten, gleiche Fakten, keine andere Zahl\): „([\s\S]*?)"\n/))
      .replace(/\s+/g, " ").trim();
    eintrag.antwort = text;
    return json(200, { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ antwort: text, gemerkt: "", mensch: false, uebergabe: "" }) }] }], usage: { input_tokens: 10, output_tokens: 10 } });
  }
  FREMD.push(u);
  throw new Error(`Prüfstand: kein Netz (${u})`);
}) as typeof fetch;

let geprueft = 0, fehler = 0;
function ok(bed: unknown, text: string) {
  geprueft++;
  if (bed) console.log(`  ✓ ${text}`); else { fehler++; console.log(`  ✗ ${text}`); }
}
const kurz = (t: string, n = 120) => String(t ?? "").replace(/\s+/g, " ").slice(0, n);
const lesbar = (t: string) => String(t ?? "").replace(/https?:\/\/\S+/g, "").replace(/\s{2,}/g, " ").trim().length;

const kp = await import("../server/lib/fiaon-ki-pause");
kp.kiNetzAbsichern();
const wa = await import("../server/lib/fiaon-whatsapp-mara");
const ton = await import("../shared/fiaon-mara-ton");
const { sendePruefung } = await import("../server/lib/fiaon-whatsapp");
const { KARTE_LINK_SATZ, KARTE_ZEIT_SATZ } = await import("../shared/fiaon-karten-weg");

// ── Die Attrappe für den Kartenweg (Bereich Karte) — der Prüfstand verschickt keine Mail ──────────────
let kartenAntwort: "gesendet" | "gesperrt" | "ohne_mail" = "gesendet";
const KARTEN_AUFRUFE: { personId: number; akteur: any }[] = [];
const KARTEN_SATZ = `Ich habe Ihnen soeben den fertigen Link unserer Partnerbank, der DKB, für Ihren Kartenantrag per E-Mail an pr…@kunde.invalid geschickt. Darüber beantragen Sie in wenigen Minuten online Ihr Girokonto mit Visa-Karte — Sie brauchen nur Ihren Ausweis. ${KARTE_ZEIT_SATZ}`;
wa.KARTEN_WEG.einladung = async (personId: number, akteur: any) => {
  KARTEN_AUFRUFE.push({ personId, akteur });
  if (kartenAntwort === "ohne_mail") {
    return { ok: false, aktion: "gesperrt", satz: null, intern: "Kein Kartenlink: Keine E-Mail-Adresse hinterlegt.", stand: null, gesendet: false, grund: "Kein Kartenlink: Keine E-Mail-Adresse hinterlegt.", schonAm: null, betreff: null } as any;
  }
  if (kartenAntwort === "gesperrt") {
    return { ok: false, aktion: "gesperrt", satz: null, intern: "Kein Kartenlink: Vertriebssperre (is_blocked) — der Kunde wollte keinen Kontakt.", stand: null, gesendet: false, grund: "Kein Kartenlink: Vertriebssperre", schonAm: null, betreff: null } as any;
  }
  return { ok: true, aktion: "gesendet", satz: KARTEN_SATZ, intern: "Einladung der Partnerbank geschickt (Prüfstand).", stand: null, gesendet: true, grund: null, schonAm: null, betreff: null } as any;
};

// ═══════════════════════════════════════════════════════════════════════════
// A. REGELN OHNE DATENBANK
// ═══════════════════════════════════════════════════════════════════════════
console.log("── A1. fragtNachKarte — echte Sätze ─────────────────────────────────");
for (const t of ["I have not your kaditkarte", "Und das die karte endlich zugeschickt wird", "Ich will jetzt erst das Konto und dann die Karte . Dann zahle ich weitere Raten",
  "seit 26.06. nichts mit Karte und PIN", "Wann kommt meine Karte?", "Wo finde ich den Link der Bank?", "Ich habe ja keine Karte bekommen, wozu zahlen?"]) {
  ok(ton.fragtNachKarte(t), `Kartenfrage: „${t}“`);
}
for (const t of ["Kann ich die Karte im Ausland nutzen?", "Ich will keine Karte mehr", "Ich kündige, die Karte kam nie", "Ok danke", "Ich widerrufe, die Karte brauche ich nicht"]) {
  ok(!ton.fragtNachKarte(t), `keine Kartenfrage (Sachfrage oder Ausstieg): „${t}“`);
}

console.log("── A2. Die Abschlüsse: Justins Satz, die Bitte ums Zahlen, kein Termin ──");
const ZIEL = ton.kartenZiel({ wunschEuro: 25000, rahmenEuro: 25000, paketKey: "highend" });
const LINK = "https://fiaon.com/zahlung/FIAON-P275WA";
const ds = { nom: "Herr Stripling", dat: "Herrn Stripling" };
const B = ton.bausteinAbschluss({ kanal: "whatsapp", art: "b", ziel: ZIEL, betrag: "99,99 €", mit: ds, zeit: "heute um 15:30 Uhr", link: LINK });
// E-275 Ton (02.10.2026, Justin: „selbst TOP verkaufen, eher übermotiviert! … ‚Zahlen Sie die Aktivierung … Ihr Account ist
// sofort nach Eingang aktiv!‘“): statt „Bitte begleichen Sie … — sobald sie gebucht ist, schaltet das System Sie frei, …“ die
// klare Aufforderung mit Betrag und der Nutzen direkt dahinter — bewusst mitgezogen.
ok(B.includes(ton.ZAHL_FRAGE) && B.includes(`${ton.AKTIVIERUNG_AUFRUF}, Ihre erste Monatsrate über 99,99 € — ${ton.NACH_DEM_EINGANG}!`) && /2–5 Werktagen/.test(B) && B.endsWith(LINK)
  && !/schaltet das System|Bitte begleichen/.test(B), `B: „Zahlen Sie jetzt die Aktivierung“ mit Betrag, sofort aktiv, direkt der Link der Partnerbank, 2–5 Werktage, die Bitte, Link — „${kurz(B, 160)}“`);
ok(!/Termin|Anruf|Stripling|vereinbare/.test(B), "B: kein Termin, kein Anruf, kein Name (Justin: „nicht immer sagen ‚Ich mache einen Termin mit XY‘“)");
ok(!/produktion|garant|sicher\b|versend|verschick/i.test(B), "B: nie „in Produktion“, „garantiert“, „sicher“, „versendet“ — die Karte gibt die Partnerbank nach ihrer Zusage aus");
const A = ton.bausteinAbschluss({ kanal: "whatsapp", art: "a", ziel: ZIEL, betrag: "99,99 €", mit: ds });
ok(/Link unserer Partnerbank für Ihren Kartenantrag/.test(A) && !/begleichen|überweisen|zahlungsseite|Termin/i.test(A), "A: nach der Buchung direkt der Link, keine Zahlungsbitte, kein Termin");
const RATE = ton.bausteinAbschluss({ kanal: "whatsapp", art: "rate", ziel: ZIEL, betrag: "79,99 €", rateVom: "02.10.", mit: ds, link: LINK });
ok(RATE.includes(ton.ZAHL_FRAGE) && /Ihre Rate vom 02\.10\. über 79,99 €/.test(RATE) && !/Termin/.test(RATE), "Rate: die Rate, die Bitte ums Zahlen statt „Soll ich Ihnen dazu einen Termin … eintragen?“");
const AB = ton.bausteinAbschluss({ kanal: "whatsapp", art: "abbrecher", ziel: ZIEL, mit: ds, link: "https://fiaon.com/a/P275wa0000/w" });
ok(/Machen Sie heute noch weiter\?/.test(AB) && !/Termin|vereinbare/.test(AB) && !/\d+,\d{2}\s*€/.test(AB), "Abbrecher: sein Antrag, „Machen Sie heute noch weiter?“, kein Termin, kein Betrag (E-264)");
const C = ton.bausteinAbschluss({ kanal: "whatsapp", art: "c", mit: ds, link: "https://fiaon.com/a/P275wa0000/w" });
ok(/Wollen wir starten\?$/.test(C) && !/Anruf/.test(C), "C: „Wollen wir starten?“ statt „Lieber erst sprechen — passt Ihnen … für einen Anruf …?“");
const VK = ton.bausteinVorkasse({ betrag: "99,99 €", ziel: ZIEL, mit: ds, zeit: "heute um 15:30 Uhr", link: LINK, jahresvertrag: true });
ok(/Sie überweisen selbst, abgebucht wird nichts/.test(VK) && /Link unserer Partnerbank/.test(VK) && VK.includes(ton.ZAHL_FRAGE) && !/Anruf|bevor Sie etwas überweisen/.test(VK), "Vorkasse: die Fakten, Justins Satz, die Bitte — kein Anruf als Pflicht");
const VKK = ton.bausteinVorkasse({ betrag: "99,99 €", ziel: ZIEL, link: LINK, jahresvertrag: true, kreditFrage: true });
ok(!/tatsächlich keine Bank|wir sind keine bank/i.test(VKK) && /FIAON ist kein Kreditinstitut, sondern bringt Sie dorthin/.test(VKK), "„kein Kreditinstitut?“: positiv, was FIAON tut — nie „FIAON ist tatsächlich keine Bank“");
for (const [was, t] of [["B", B], ["A", A], ["Rate", RATE], ["Abbrecher", AB], ["C", C], ["Vorkasse", VK], ["Vorkasse Kredit", VKK]] as const) {
  const hart = ton.tonPruefung(t, { kanal: "whatsapp", land: "DE", kunde: "" }).filter((b) => b.schwere === "hart");
  ok(!hart.length && !sendePruefung(t).length && lesbar(t) <= 500, `${was}: Ton und Wand ohne harten Treffer, ${lesbar(t)} Zeichen ohne Link${hart.length ? ` — ${hart.map((b) => b.id).join(", ")}` : ""}`);
}
ok(KARTE_LINK_SATZ.includes("fertigen Link unserer Partnerbank für Ihren Kartenantrag") && B.includes("fertigen Link unserer Partnerbank für Ihren Kartenantrag"), "Justins Satz kommt aus EINER Quelle (shared/fiaon-karten-weg.ts)");
// E-275 Gegenprüfung (Wahrheit und Recht): Fehlt im Antrag noch etwas, kommt der Link NICHT direkt nach der Buchung.
for (const [was, t] of [["B", B], ["A", A], ["Vorkasse", VK]] as const) {
  const mitL = wa.mitAntragLuecke(t, ["Geburtsdatum"]);
  ok(!/direkt\s+(?:den\s+fertigen\s+|der\s+)Link/.test(mitL) && /es fehlt noch: Geburtsdatum/.test(mitL) && wa.mitAntragLuecke(t, []) === t
    && !ton.tonPruefung(mitL, { kanal: "whatsapp", land: "DE", kunde: "" }).some((b) => b.schwere === "hart") && !sendePruefung(mitL).length,
    `${was} mit unvollständigem Antrag: kein „direkt der Link“, sondern was fehlt — „${kurz(mitL.replace(/^[\s\S]*?(Sobald auch Ihr Antrag|Nach der Buchung und)/, "$1"), 110)}“`);
}
// E-275 Endkontrolle (02.10.2026, Wahrheit): Auch „keine Karte“ bei offener ERSTER Rate und die Antwort auf die Limit-Frage
// (B) tragen Justins Satz „… und Sie bekommen direkt den fertigen Link …“ — maraAntwortet reichte beide ohne Lücken-Fassung
// weiter, die Limit-Antwort schickt sichererSatz notfalls wörtlich. Jetzt: dieselbe Lücken-Fassung, im Quelltext belegt.
{
  const KKE = ton.bausteinKeineKarte({ kanal: "whatsapp", betrag: "99,99 €", erste: true, ziel: ZIEL, link: LINK });
  const LF = ton.bausteinLimitFrage({ kanal: "whatsapp", ziel: ZIEL, betrag: "99,99 €", link: LINK });
  for (const [was, t] of [["Keine Karte (erste Rate)", KKE], ["Limit-Frage (B)", LF]] as const) {
    const mitL = wa.mitAntragLuecke(t, ["Geburtsdatum"]);
    ok(/direkt den fertigen Link/.test(t) && !/direkt\s+(?:den\s+fertigen\s+|der\s+)Link/.test(mitL) && /es fehlt noch: Geburtsdatum/.test(mitL)
      && !ton.tonPruefung(mitL, { kanal: "whatsapp", land: "DE", kunde: "" }).some((b) => b.schwere === "hart") && !sendePruefung(mitL).length,
      `${was} mit unvollständigem Antrag: kein „direkt der Link“, sondern was fehlt`);
  }
  const { readFileSync } = await import("node:fs");
  const quelle = readFileSync(new URL("../server/lib/fiaon-whatsapp-mara.ts", import.meta.url), "utf8");
  ok(/const limitFrage = [^;]{0,400}?mitAntragLuecke\(bausteinLimitFrage\(/.test(quelle) && /const keineKarte = [^;]{0,400}?mitAntragLuecke\(bausteinKeineKarte\(/.test(quelle),
    "maraAntwortet: limitFrage und keineKarte laufen durch mitAntragLuecke (wie vorkasseMuster und abschlussFormel)");
}

console.log("── A3. „Karte nicht bekommen“ beim zahlenden Kunden: der Link selbst ──");
const KK = ton.bausteinKeineKarte({ kanal: "whatsapp", betrag: "79,99 €", rateVom: "02.10.", link: LINK, kartenSatz: KARTEN_SATZ });
ok(/^Für Ihre Visa-Kreditkarte: Ich habe Ihnen soeben den fertigen Link/.test(KK) && /Ihre Rate vom 02\.10\. über 79,99 € ist außerdem noch offen/.test(KK) && KK.includes(ton.ZAHL_FRAGE) && KK.includes(ton.KARTE_ZEIT_WA), `Link der Partnerbank vorn, dann die Rate und die Bitte — „${kurz(KK, 150)}“`);
ok(!/keine Bank|nicht von FIAON|verschickt keine Karte|Boychenko|meldet sich|Termin/i.test(KK) && lesbar(KK) <= 500 && !sendePruefung(KK).length, `kein Rückzug, kein Kollege, kein Termin, ${lesbar(KK)} Zeichen`);
ok(!/damit|deshalb|liegt daran/i.test(KK.slice(KK.indexOf("ist außerdem"))), "die Folgerate ist nie „der Grund“ für die Karte (E-265 Recht) — nur „außerdem noch offen“");
const KKlang = ton.bausteinKeineKarte({ kanal: "whatsapp", betrag: "79,99 €", rateVom: "02.10.", link: LINK, kartenSatz: `${KARTEN_SATZ} ${"x".repeat(200)}.` });
ok(!/ist außerdem noch offen/.test(KKlang), "zu lang für die Rate dazu: dann nur der Satz aus dem Bereich Karte (höchstens 500 lesbare Zeichen)");
ok(/Das liegt daran, dass bei Ihnen noch eine Zahlung offen ist/.test(ton.bausteinKeineKarte({ kanal: "whatsapp", betrag: "99,99 €", erste: true, link: LINK }))
  && /direkt den fertigen Link unserer Partnerbank/.test(ton.bausteinKeineKarte({ kanal: "whatsapp", betrag: "99,99 €", erste: true, link: LINK })), "erste Zahlung offen: „Das liegt daran …“ und was die Buchung auslöst (Justins Satz)");

console.log("── A4. Weiche Prüfung: kein ungefragter Anruf, kein „X meldet sich“ ──");
const vp = (a: string, kunde: string, anrufOk: boolean) => wa.verkaufsPruefung(a, { kunde, letzteDu: [], verkaufen: false, anrufOk });
ok(vp("Gern! Passt Ihnen heute um 15:30 Uhr ein Anruf mit Herrn Stripling?", "Bekomme ich da Bescheid, wenn mein Account aktiv ist?", false).some((h) => /nicht nach einem Anruf gefragt/.test(h)), "#2279: ungefragtes Anrufangebot fällt weich auf");
ok(vp("Danke, Justin Schwarzott schaut für Sie nach, warum nichts angekommen ist, und meldet sich persönlich.", "Ich haben nix bekommen", false).some((h) => /schiebst ab/.test(h)), "#2003: „… schaut nach … meldet sich persönlich“ fällt weich auf");
ok(vp("Ich gebe das direkt an Herrn Stripling weiter.", "Was kostet das?", false).some((h) => /schiebst ab/.test(h)), "„Ich gebe das … weiter“ fällt weich auf");
ok(!vp("Gern, Herr Stripling ruft Sie heute um 15:30 Uhr an.", "Bitte rufen Sie mich an", true).length, "er will telefonieren (anrufOk): das Angebot ist richtig");
ok(!vp("Ihr Widerruf ist heute bei uns eingegangen. Unsere Geschäftsführung prüft ihn, und Sie bekommen dazu eine schriftliche Nachricht.", "Ich widerrufe den Vertrag", false).some((h) => /schiebst ab|Anruf/.test(h)), "Widerruf (heikel): die Übergabe bleibt, kein Hinweis");
ok(!vp(B, "Ok, ich zahle heute. Wie geht es weiter?", false).some((h) => /Anruf|schiebst ab|Partnerbank/.test(h)), "Justins Formel besteht die Prüfung ohne Hinweis (auch in der Zahlungslage)");
ok(wa.verkaufsPruefung("Sobald die Zahlung gebucht ist, geht morgen der Link unserer Partnerbank raus.", { kunde: "Wann zahle ich?", letzteDu: [], verkaufen: true, zahlungslage: true }).some((h) => /Partnerbank/.test(h)), "ein Zeitpunkt für den Link der Partnerbank fällt weiter auf");

console.log("── A5. kein_einblick: der Rückzug fällt weich auf ─────────────────────");
for (const t of ["Darauf haben wir keinen Einfluss.", "FIAON verschickt selbst keine Karte und keine PIN.", "Die Visa-Kreditkarte kommt nicht von FIAON direkt, sondern über die Bank.", "Das können wir leider nicht wissen."]) {
  ok(ton.tonPruefung(t, { kanal: "whatsapp" }).some((b) => b.id === "kein_einblick" && b.schwere === "weich"), `weich: „${t}“`);
}
ok(!ton.tonPruefung("Die Karte schickt die Bank nach ihrer Zusage, und den Link für Ihren Kartenantrag habe ich Ihnen geschickt.", { kanal: "whatsapp" }).some((b) => b.id === "kein_einblick"), "… die Wahrheit, positiv gesagt, ist frei");

console.log("── A6. Der Auftrag an das Modell ─────────────────────────────────────");
const AUF = wa.maraAuftrag({
  name: "Prüf Kunde", wer: "Prüf Kunde", lage: "Kunde mit FIAON Ultra, erste Zahlung gebucht, Account aktiv.", ziel: "Service.", link: "https://fiaon.com/login", verkaufen: false,
  gedaechtnis: "", verlauf: "KUNDE (Do 15:30): I have not your kaditkarte", wissen: "", hausanweisung: "", werkzeuge: true, betreuer: { nom: "Nikita Boychenko", dat: "Nikita Boychenko" },
  jetzt: "Freitag, 02.10.2026, 15:31", stufe: "kunde", kartenWerkzeug: true,
});
ok(/karte_link_schicken/.test(AUF) && /Service heißt: Du erledigst es selbst/.test(AUF), "Auftrag (zahlender Kunde): das Werkzeug karte_link_schicken und „Service heißt: Du erledigst es selbst“");
ok(/DU SCHLIESST SELBST AB/.test(wa.maraAuftrag({ name: "Prüf Kunde", wer: "x", lage: "x", ziel: "x", link: LINK, verkaufen: true, gedaechtnis: "", verlauf: "", wissen: "", hausanweisung: "", werkzeuge: true, stufe: "zahlung_offen" })), "Auftrag (Verkauf): „9. DU SCHLIESST SELBST AB“ statt „biete ihm von dir aus einen kurzen Anruf an“");
ok(!/biete ihm von dir aus einen kurzen Anruf an/.test(AUF) && !/Ihre Nachricht gebe ich an unser Team weiter/.test(AUF) && !/sag, dass sein Betreuer nachsieht, und übergib/.test(AUF), "Auftrag: kein „von dir aus einen Anruf“, kein „gebe ich an unser Team weiter“ bei anderer Sprache, kein „Betreuer sieht nach“");
ok(/KEIN TERMIN ALS PFLICHT/.test(AUF) && AUF.includes(ton.ZAHL_FRAGE), "Auftrag: KEIN TERMIN ALS PFLICHT, die Bitte ums Zahlen");
ok(!/Du nennst Nikita Boychenko beim Namen, wenn es um Anruf, Unterlagen, Termin oder Karte geht/.test(AUF) && /Karte, Link, Zahlung und Unterlagen erledigst du selbst/.test(AUF), "Persona: den Betreuer nur für Anruf, Termin, echte Übergabe — Karte und Co. erledigt Mara selbst");
const AUF_B = wa.maraAuftrag({ name: "Prüf Kunde", wer: "Prüf Kunde", lage: "Antrag fertig", ziel: "Er zahlt.", link: LINK, verkaufen: true, gedaechtnis: "", verlauf: "", wissen: "", hausanweisung: "", werkzeuge: true, betreuer: ds, stufe: "zahlung_offen" });
ok(!/karte_link_schicken —/.test(AUF_B), "B: kein Kartenwerkzeug (der Link kommt erst nach der Buchung)");

console.log("── A7. Mail: keine Pflicht-Terminfrage mehr ─────────────────────────");
const MB = ton.bausteinAbschluss({ kanal: "mail", art: "b", ziel: ZIEL, betrag: "59,99 €", verwendungszweck: "FIAON-P275M", mit: ds });
ok(!ton.mailAbschlussPflicht(MB, { betrag: "59.99" }).length && /Knopf/.test(MB) && !/Termin/.test(MB), "Mail-B: Betrag, Freischaltung, Knopf — erfüllt die Pflicht ohne Termin");
ok(ton.mailAbschlussPflicht("Ihre erste Monatsrate beträgt 59,99 €; sobald sie gebucht ist, schaltet das System Sie frei.", { betrag: "59.99" }).some((h) => /Überweisung/.test(h)), "Mail ohne Schritt: der Hinweis verlangt die Bitte um die Überweisung, nicht den Termin");

console.log("── A8. Der sichere Satz ──────────────────────────────────────────────");
ok(wa.sichererSatz({ kunde: "I have not your kaditkarte", aktionen: [{ werkzeug: "karte_link_schicken", ok: true, zeiten: [], satz: KARTEN_SATZ } as any], stufe: "kunde" }) === KARTEN_SATZ, "fallen beide Entwürfe, ist der Satz aus dem Bereich Karte der sichere Satz");

// ── A9. Gegenprüfung Verkauf (02.10.2026): die echten Formen von „Anruf“ und „Abgabe“ ─────────────────────
// Maras echte Antworten 18.09.–02.10. (nur lesend, anonymisiert): Diese Sätze rutschten durch die erste Fassung der
// weichen Prüfung (WhatsApp 82 von 156, Mail 106 von 161). Jetzt fängt sie selbstErledigtTreffer (shared/fiaon-mara-ton.ts)
// — auf WhatsApp (verkaufsPruefung, anrufOk false) und im Postfach (verweisBefunde) dieselbe Regel.
console.log("── A9. Gegenprüfung Verkauf: echte Formen von Anruf und Abgabe ────────");
{
  const agent = await import("../server/lib/fiaon-postmeister-agent");
  const weichWa = (s: string) => wa.verkaufsPruefung(s, { kunde: "Wo bleibt meine Karte?", letzteDu: [], verkaufen: false, anrufOk: false })
    .filter((h: string) => /Er hat nicht nach einem Anruf|Du schiebst ab/.test(h));
  const MUSS_WA = [
    "Nikita Boychenko schaut mit Ihnen genau nach, wo es hängt — heute um 13:10 Uhr oder am Montag um 12:50 Uhr, was passt besser?",
    "Soll Nikita Boychenko Sie dazu kurz anrufen?",
    "Wenn Sie wieder einsteigen möchten, kann Nikita Sie morgen um 9:50 Uhr oder am Mittwoch um 9:30 Uhr anrufen — was passt Ihnen?",
    "Nikita Boychenko kann Ihre Frage zur Rate mit Ihnen durchgehen. Passt am Montag um 9:30 Uhr oder um 16:50 Uhr besser?",
    "Der Link ging am 21. September raus; wenn er nicht angekommen ist, prüft Nikita Boychenko das und gibt Ihnen hier Rückmeldung.",
    "Wenn Ihre Datenkopie hochgeladen ist, kann Nikita Boychenko den fehlenden Link der Partnerbank prüfen und Ihnen hier Rückmeldung geben.",
    "Sobald Ihre Zahlung gebucht ist, schaltet das System Sie frei; ich gebe das jetzt dringend zur Prüfung an Nikita Boychenko weiter.",
    "Ich gebe Ihre Nachricht direkt an Hans-Jürgen Gerhold weiter — Sie bekommen zeitnah eine Rückmeldung.",
    "Möchten Sie das kurz mit Herrn Stripling am Telefon besprechen?",
    "Herr Boychenko wird sich bei Ihnen melden.",
    "Frau Lombardi sieht sich das an.",
  ];
  for (const s of MUSS_WA) ok(weichWa(s).length > 0, `WhatsApp fängt (weich): „${s.slice(0, 70)}…“`);
  const FREI_WA = [
    "Danke! Die Zahlungsstelle gleicht jeden Eingang ab; sobald die Zahlung gebucht ist, schaltet das System Sie frei.",
    "Die Partnerbank prüft Ihren Antrag gerade — nach ihrer Zusage ist die Karte in der Regel in 2–5 Werktagen bei Ihnen.",
    "Ihre Bitte um eine Pause liegt jetzt bei Herrn Boychenko — Sie bekommen dazu Bescheid.",
    "Herr Stripling begleitet Sie Schritt für Schritt, Sie machen das nicht allein.",
    "Laden Sie Ihre Unterlagen in Ihrem Bereich hoch — Herr Stripling sieht sie dort sofort.",
    "Melden Sie sich gern, wenn etwas hakt. Sie können sich jederzeit bei mir melden.",
    "Verstehe ich: FIAON ist kein Kreditinstitut, sondern bringt Sie dorthin. Möchten Sie vorher kurz sprechen, sagen Sie es mir einfach.",
    KARTEN_SATZ,
    ton.bausteinAbschluss({ kanal: "whatsapp", art: "b", ziel: ZIEL, betrag: "59,99 €", link: LINK, mit: ds }),
  ];
  for (const s of FREI_WA) ok(weichWa(s).length === 0, `WhatsApp lässt frei: „${s.slice(0, 70)}…“`);
  // Postfach: Abgabe und Termin (nur, wo kein Mensch übernimmt und er keinen Termin will)
  const MUSS_MAIL = [
    "Justin prüft morgen, ob die Screenshots als Kontoauszüge reichen.",
    "Ihr Bild kann ich hier nicht öffnen, deshalb prüft Herr Stripling den Anhang morgen.",
    "Das PDF ist angekommen und wird von Herrn Stripling geprüft.",
    "Ich habe ihm Ihre neue Nachricht gerade weitergegeben, damit er den nächsten Schritt mit Ihnen klärt.",
    "Herr Stripling hat die Prüfung bekommen und meldet sich heute dazu.",
    "I have asked Nikita Boychenko to check this today and give you the current position.",
    "Nikita Boychenko will look into this and be in touch.",
  ];
  for (const s of MUSS_MAIL) ok(agent.verweisBefunde(s, {}).some((h: string) => /Verweis auf einen Menschen/.test(h)), `Mail fängt die Abgabe: „${s.slice(0, 70)}…“`);
  const TERMIN_MAIL = [
    "Soll ich Ihnen dazu einen Termin mit Herrn Stripling eintragen?",
    "Antworten Sie mir einfach mit einer Zeit, die Ihnen passt.",
    "Welche Zeit passt Ihnen für einen kurzen Anruf mit Nikita Boychenko?",
    "Would you like a short call with Nikita Boychenko?",
  ];
  for (const s of TERMIN_MAIL) {
    ok(agent.verweisBefunde(s, {}).some((h: string) => /nach keinem Termin gefragt/.test(h)), `Mail: ungefragter Termin fällt weich auf: „${s.slice(0, 60)}…“`);
    ok(!agent.verweisBefunde(s, { erlaubt: false, terminOk: true }).some((h: string) => /nach keinem Termin gefragt/.test(h)), `Mail: will er ein Gespräch (terminOk), ist derselbe Satz frei: „${s.slice(0, 40)}…“`);
  }
  const FREI_MAIL = [
    "Ich habe die Zahlungsstelle um Prüfung gebeten; bis zur Buchung kann noch eine Erinnerung kommen.",
    "Ihren Widerruf prüft unsere Geschäftsführung, und Sie bekommen dazu eine schriftliche Nachricht.",
    "Bei einem unterschriebenen Auftrag klärt die Leitung die Beendigung.",
    "Die Zahlungsstelle prüft den Eingang jetzt und ordnet ihn zu.",
    "Ihre Unterlagen sind angekommen und fließen jetzt in Ihre Bonitätsanalyse ein.",
  ];
  for (const s of FREI_MAIL) ok(!agent.verweisBefunde(s, {}).some((h: string) => /Verweis auf einen Menschen|nach keinem Termin/.test(h)), `Mail lässt frei: „${s.slice(0, 70)}…“`);
  // WhatsApp, Kündigung zurückgenommen + Zahltag: kein Termin mehr als Schluss (E-275, Block KÜNDIGUNG „zurueck“)
  const AUF_ZURUECK = wa.maraAuftrag({ name: "Prüf Kunde", wer: "Prüf Kunde", lage: "Kunde", ziel: "Service", link: LINK, verkaufen: false, gedaechtnis: "", verlauf: "", wissen: "", hausanweisung: "", werkzeuge: true, betreuer: ds, stufe: "kunde", kuendigung: "zurueck" } as any);
  ok(/Er verneint oder nimmt die Kündigung zurück/.test(AUF_ZURUECK) && !/EINER Frage \(Termin mit Nennform\)/.test(AUF_ZURUECK), "Kündigung zurückgenommen + Zahltag: kein „Termin mit Nennform“ als Schluss mehr");
}

// ── A10. E-275 TON (02.10.2026): BEGEISTERT VERKAUFEN, SERIÖS UND WAHR ───────────────────────────────────────
// Justin: „Mara schreibt ‚jeden‘ ‚ich leite es an XY weiter‘ aber das soll Mara nicht tun, sondern selbst arbeiten, selbst
// TOP verkaufen, eher übermotiviert! Also wirklich sowas wie: ‚Zahlen Sie die Aktivierung, wir kümmern uns darum das die
// Karte schnell versendet wird. Ihr Account ist sofort nach Eingang aktiv!‘“ — die wahre Fassung: Die Karte gibt die
// Partnerbank nach ihrer Zusage aus; FIAON versendet keine Karte.
console.log("── A10. E-275 Ton: Aufforderung, Nutzen, ein Ausrufezeichen, die Wahrheit ──");
{
  const agent = await import("../server/lib/fiaon-postmeister-agent");
  const KKE = ton.bausteinKeineKarte({ kanal: "whatsapp", betrag: "99,99 €", erste: true, ziel: ZIEL, link: LINK });
  const LF = ton.bausteinLimitFrage({ kanal: "whatsapp", ziel: ZIEL, betrag: "99,99 €", link: LINK });
  const MB2 = ton.bausteinAbschluss({ kanal: "mail", art: "b", ziel: ZIEL, betrag: "59,99 €", verwendungszweck: "FIAON-P275M", mit: ds });
  const AUFRUF = `${ton.AKTIVIERUNG_AUFRUF}`;
  for (const [was, x] of [["B", B], ["keine Karte (erste Rate)", KKE], ["Limit-Frage", LF], ["Mail-B", MB2]] as const) {
    // E-276 (02.10.2026): „mit Ihrem Verwendungszweck … ist Ihr Account sofort nach Eingang aktiv“ — die Bedingung im selben Satz.
    ok(x.includes(AUFRUF) && x.indexOf(AUFRUF) < x.indexOf("ist Ihr Account sofort nach Eingang aktiv") && /mit Ihrem Verwendungszweck (?:FIAON-\S+ )?ist Ihr Account sofort nach Eingang aktiv/.test(x) && ton.ausrufezeichen(x) === 1,
      `${was}: „Zahlen Sie jetzt die Aktivierung“, der Nutzen direkt dahinter, genau ein „!“`);
  }
  for (const [was, x] of [["A", A], ["Rate", RATE], ["Vorkasse", VK], ["Vorkasse Kredit", VKK], ["Abbrecher", AB], ["C", C]] as const) {
    ok(ton.ausrufezeichen(x) <= 1 && !x.includes(AUFRUF), `${was}: keine Aufforderung zur Aktivierung (nicht die erste Zahlung bzw. Einwand/kein Antrag), höchstens ein „!“`);
  }
  // E-276 (02.10.2026): A „sobald wir Ihre Zahlung … zugeordnet haben“ (statt „… bei uns eingeht“) — wahr auch mit verkürztem Zweck.
  ok(/Sobald wir Ihre Zahlung über 99,99 € zugeordnet haben, ist Ihr Account sofort aktiv, und Sie bekommen direkt den fertigen Link/.test(A), "A: „sobald wir Ihre Zahlung zugeordnet haben, ist Ihr Account sofort aktiv“ — keine Bitte");
  ok(/Mit dem Verwendungszweck ist Ihr Account sofort aktiv, und der Link unserer Partnerbank kommt direkt\./.test(VKK) && lesbar(VKK) <= 500, `Vorkasse Kredit: die kurze Fassung mit dem Verwendungszweck (E-276), ${lesbar(VKK)} Zeichen`);
  const VKKL = wa.mitAntragLuecke(VKK, ["Geburtsdatum"]);
  ok(!/kommt direkt/.test(VKKL) && /es fehlt noch: Geburtsdatum/.test(VKKL) && !ton.tonPruefung(VKKL, { kanal: "whatsapp", land: "DE", kunde: "" }).some((b) => b.schwere === "hart"),
    "Vorkasse Kredit mit unvollständigem Antrag: kein „direkt“, nennt was fehlt");
  // Nie die unwahre Fassung von Justins Satz: FIAON versendet keine Karte, „in Produktion“ gibt es vor der Zusage nicht.
  for (const x of [B, A, KKE, LF, MB2, VK, VKK, ton.KARTE_REGEL_TEXT, ton.personaText("whatsapp", {}), agent.MAIL_KARTE_REGEL]) {
    ok(!/(?:wir|fiaon)\s+(?:versende|verschicke|schicke)n?\s+(?:ihnen\s+)?(?:die|ihre)\s+karte|karte\s+(?:schnell\s+)?(?:versendet|verschickt)\s+wird|karte\s+(?:ist|geht)\s+(?:\S+\s+)?in\s+produktion/i.test(x.replace(/[„“"][^„“"]{0,120}[“"]/g, " ")),
      `nie „wir versenden die Karte“/„in Produktion“ (außer als Verbot in Anführungszeichen): „${kurz(x, 60)}“`);
  }
  // Die unwahre Fassung fällt auf (weiche Regel karte_versand — der zweite Entwurf); die Wortwand fängt nur den Infinitiv.
  for (const s of ["Zahlen Sie die Aktivierung, wir kümmern uns darum, dass die Karte schnell versendet wird.", "Hi, zahlen Sie die Aktivierung, die Karte geht zeitnah in Produktion.", "Wir schicken Ihnen die Karte gleich nach der Zahlung zu."]) {
    ok(ton.tonPruefung(s, { kanal: "whatsapp" }).some((b) => b.id === "karte_versand"), `karte_versand (weich): „${s}“`);
  }
  for (const s of [B, A, KKE, "Die Karte schickt Ihnen die Bank nach ihrer Zusage.", "Den Link für Ihren Kartenantrag habe ich Ihnen geschickt.", "Wir haben Ihnen den Link zur Karte geschickt."]) {
    ok(!ton.tonPruefung(s, { kanal: "whatsapp" }).some((b) => b.id === "karte_versand"), `karte_versand frei: „${kurz(s, 60)}“`);
  }
  // Höchstens EIN Ausrufezeichen — weich (zweiter Entwurf), beide Kanäle.
  ok(ton.tonPruefung("Super! Zahlen Sie jetzt die Aktivierung! Dann geht es los!", { kanal: "whatsapp" }).some((b) => b.id === "ausrufezeichen" && b.schwere === "weich"), "drei „!“ fallen weich auf (WhatsApp)");
  ok(ton.tonPruefung("Danke Ihnen! Ihr Account ist sofort aktiv!", { kanal: "mail" }).some((b) => b.id === "ausrufezeichen"), "zwei „!“ fallen weich auf (Mail)");
  ok(!ton.tonPruefung(B, { kanal: "whatsapp" }).some((b) => b.id === "ausrufezeichen") && !ton.tonPruefung("Schauen Sie hier: https://fiaon.com/a/x!y", { kanal: "whatsapp" }).some((b) => b.id === "ausrufezeichen"), "ein „!“ (oder eins im Link) ist frei");
  // Der Nutzen-Satz ist in der Zahlungslage kein „Zeitpunkt für den Link“ — ein „sofort“ ohne Zahlungseingang schon.
  const vz = (a: string) => wa.verkaufsPruefung(a, { kunde: "Wie geht es weiter?", letzteDu: [], verkaufen: true, zahlungslage: true }).filter((h: string) => /Link der Partnerbank gibt es erst/.test(h));
  ok(!vz(B).length && vz(`Ihr Account ist sofort aktiv, und Sie bekommen den Link unserer Partnerbank. ${ton.ZAHL_FRAGE}`).length > 0, "Zahlungslage: Justins Satz frei, „sofort … Link unserer Partnerbank“ ohne Zahlungseingang fällt auf");
  ok(!vz(`${ton.NACH_DEM_EINGANG_SATZ}. ${ton.ZAHL_FRAGE}`).length && vz(`Sie bekommen morgen den Link unserer Partnerbank. ${ton.ZAHL_FRAGE}`).length > 0, "Zahlungslage: „sofort nach Eingang“ (mit Verwendungszweck) frei, „morgen“ fällt weiter auf");
  // Ruhe (Widerruf, Kündigung): die neue Aufforderung ist eine Zahlungsbitte wie „Bitte begleichen Sie“.
  ok(!!agent.fordertZahlung(`${ton.AKTIVIERUNG_AUFRUF}, Ihre erste Monatsrate über 59,99 €.`) && !!agent.fordertZahlung("Überweisen Sie sie am besten gleich heute.") && !agent.fordertZahlung("Jede Rate überweisen Sie selbst, abgebucht wird nichts."),
    "Postfach: „Zahlen Sie jetzt die Aktivierung“ und „Überweisen Sie … gleich heute“ sind Zahlungsbitten, die Erklärung „überweisen Sie selbst“ nicht");
  // E-275 Endkontrolle (02.10.2026): „Überweisen Sie bitte nichts mehr.“ (Kündigung ohne offene Rate) ist das Gegenteil.
  ok(!agent.fordertZahlung("Überweisen Sie bitte nichts mehr.") && !agent.fordertZahlung("Ihre Kündigung ist gebucht. Überweisen Sie nichts mehr.")
    && !agent.fordertZahlung("Zahlen Sie bitte nichts mehr ein.") && !!agent.fordertZahlung("Überweisen Sie jetzt, damit keine Erinnerung mehr kommt."),
    "Postfach: „Überweisen/Zahlen Sie (bitte) nichts mehr“ ist keine Zahlungsbitte — „Überweisen Sie jetzt, damit keine …“ bleibt eine");
  ok(ton.abschlussPruefung(`${ton.AKTIVIERUNG_AUFRUF}, Ihre erste Monatsrate über 7,99 €.`, { art: "a", kunde: "habe bezahlt" }).length > 0, "A (Zahlung gemeldet): „Zahlen Sie jetzt …“ fällt auf");
  ok(ton.mailAbschlussPflicht(`Bei uns kommen Sie zu Ihrer Visa-Kreditkarte. ${ton.AKTIVIERUNG_AUFRUF}, Ihre erste Monatsrate über 59,99 € — ${ton.NACH_DEM_EINGANG}!`, { betrag: "59.99" }).length === 0,
    "Mail-Pflicht: „mit Ihrem Verwendungszweck ist Ihr Account sofort nach Eingang aktiv“ zählt als Freischaltung, „Zahlen Sie jetzt“ als Schritt");
  // Persona und Auftrag: übermotiviert, seriös, nie „ich leite das weiter“.
  const P = ton.personaText("whatsapp", {});
  ok(/VERKAUFST MIT BEGEISTERUNG/.test(P) && /höchstens EIN Ausrufezeichen/.test(P) && /ich leite das an … weiter/.test(P) && P.includes(ton.TEMPO_SATZ), "Persona: begeistert, seriös, ein „!“, nie „ich leite das an … weiter“, der Tempo-Satz");
  ok(AUF_B.includes(ton.AKTIVIERUNG_AUFRUF) && AUF_B.includes(ton.NACH_DEM_EINGANG), "WhatsApp-Auftrag (B): die Aufforderung und der Nutzen-Satz");
  ok(/ich leite das an X weiter/.test(agent.selbstBlock({})) && agent.selbstBlock({}).includes(ton.AKTIVIERUNG_AUFRUF), "Postfach „DU ERLEDIGST ES SELBST“: nie „ich leite das an X weiter“, die Aufforderung bei der ersten Zahlung");
}

// ── A11. E-276 (02.10.2026): „SOFORT“ NUR MIT SEINEM VERWENDUNGSZWECK ────────────────────────────────────────────
// Justin: „ALLE Mails dafür müssen noch heute raus gehen … ohne Ausnahme!“ — gemessen 02.10.: 37 Eingänge (2.328 €) lagen
// ungebucht im Bankbuch, meist mit verkürztem Verwendungszweck. Der Abgleich bucht nur mit genau dem Zweck selbst.
console.log("── A11. E-276: „sofort“ nur mit dem Verwendungszweck, Stufe A „zugeordnet“ ──");
{
  const agent = await import("../server/lib/fiaon-postmeister-agent");
  ok(ton.NACH_DEM_EINGANG.startsWith("mit Ihrem Verwendungszweck ist Ihr Account sofort nach Eingang aktiv, und Sie bekommen direkt den fertigen Link")
    && ton.NACH_DEM_EINGANG_SATZ.startsWith("Mit Ihrem Verwendungszweck") && ton.nachDemEingang({ ref: "FIAON-AB12CD" }).includes("mit Ihrem Verwendungszweck FIAON-AB12CD ist Ihr Account"),
    "Justins Satz trägt die Bedingung (klein nach dem Gedankenstrich, groß am Satzanfang, per Mail mit dem Zweck)");
  ok(agent.AKTIVIERUNG_SATZ === `${ton.NACH_DEM_EINGANG_SATZ}!` && agent.AKTIVIERUNG_SATZ_A.startsWith("sobald wir Ihre Zahlung zugeordnet haben, ist Ihr Account sofort aktiv"),
    "Postfach: AKTIVIERUNG_SATZ mit Verwendungszweck, Stufe A „sobald wir Ihre Zahlung zugeordnet haben“");
  const MB = ton.bausteinAbschluss({ kanal: "mail", art: "b", betrag: "59,99 €", verwendungszweck: "FIAON-P276M" });
  ok(MB.includes("— mit Ihrem Verwendungszweck FIAON-P276M ist Ihr Account sofort nach Eingang aktiv") && !/\(Verwendungszweck FIAON-P276M\)/.test(MB),
    "Mail-B: der Verwendungszweck steht IM Satz (nicht mehr in Klammern davor)");
  // Die weiche Prüfung „sofort_ohne_zweck“: „sofort nach (Zahlungs-)Eingang“ ohne Zweck im selben Satz.
  const w = (t: string) => ton.tonPruefung(t, { kanal: "whatsapp" }).filter((b) => b.id === "sofort_ohne_zweck");
  ok(w("Ihr Account ist sofort nach Zahlungseingang aktiv.").length === 1 && w("Mit dem Zahlungseingang ist Ihr Account sofort aktiv.").length === 1
    && w("Sobald Sie überweisen, ist alles sofort nach Ihrer Zahlung freigeschaltet.").length === 1 && w("Ihr Account ist sofort nach Zahlungseingang aktiv.")[0]?.schwere === "weich",
    "„sofort nach Zahlungseingang“ ohne Verwendungszweck fällt weich auf (drei Formen)");
  for (const t of [B, A, KKE_E276(), MB, ton.NACH_DEM_EINGANG_SATZ, agent.mailAbschlussFormel("b", null), agent.mailAbschlussFormel("a", null), "Danke Ihnen! Ihr Account ist sofort aktiv."]) {
    ok(!w(t).length, `sofort_ohne_zweck frei: „${kurz(t, 70)}“`);
  }
  // Ruhe (Widerruf, Kündigung): auch die neue Wortstellung ist eine Zahlungsbitte; Stufe A („zugeordnet“) bleibt frei.
  const { readFileSync } = await import("node:fs");
  const q = readFileSync(new URL("../server/lib/fiaon-whatsapp-mara.ts", import.meta.url), "utf8");
  ok(/\(\?<!zugeordnet\\s\+haben,\\s\+\)ist\\s\+ihr\\s\+account\\s\+sofort/.test(q), "WhatsApp-Ruhe: „… ist Ihr Account sofort nach Eingang aktiv“ zählt als Zahlungsbitte, „zugeordnet haben, ist Ihr Account …“ nicht");
  ok(wa.mitAntragLuecke === ton.mitAntragLuecke, "mitAntragLuecke: EINE Quelle (shared), WhatsApp exportiert sie weiter");
}
function KKE_E276(): string { return ton.bausteinKeineKarte({ kanal: "whatsapp", betrag: "99,99 €", erste: true, ziel: ZIEL, link: LINK }); }

// ═══════════════════════════════════════════════════════════════════════════
// B. GEGEN DIE LOKALE TEST-DB
// ═══════════════════════════════════════════════════════════════════════════
if (MIT_DB) {
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const EINSTELLUNGEN = ["ki_pause", "mara_wa_an", "mara_wa_tag_euro"];
  const einstellungVorher = (await sql`SELECT key, value FROM fiaon_settings WHERE key = ANY(${EINSTELLUNGEN})`.catch(() => [])) as any[];
  const PERSONEN: number[] = [];
  const REFS: string[] = [];
  const NUMMERN: string[] = [];
  const LEADS: number[] = [];
  const aufraeumen = async () => {
    for (const n of NUMMERN) {
      await sql`DELETE FROM fiaon_whatsapp WHERE nummer = ${n}`.catch(() => {});
      await sql`DELETE FROM fiaon_whatsapp_gespraech WHERE nummer = ${n}`.catch(() => {});
      await sql`DELETE FROM fiaon_mara_protokoll WHERE nummer = ${n}`.catch(() => {});
    }
    if (PERSONEN.length) {
      await sql`DELETE FROM fiaon_betreiber_todos WHERE schluessel ~ ${`^wa-(${PERSONEN.join("|")})-`}`.catch(() => {});
      await sql`DELETE FROM fiaon_mara_protokoll WHERE person_id = ANY(${PERSONEN})`.catch(() => {});
      await sql`DELETE FROM fiaon_contact_log WHERE person_id = ANY(${PERSONEN})`.catch(() => {});
      await sql`DELETE FROM fiaon_kurzlinks WHERE person_id = ANY(${PERSONEN})`.catch(() => {});
      await sql`DELETE FROM fiaon_abo_raten WHERE ref = ANY(${REFS.length ? REFS : ["-"]})`.catch(() => {});
      await sql`DELETE FROM fiaon_konto_karte WHERE person_id = ANY(${PERSONEN})`.catch(() => {});
      await sql`DELETE FROM fiaon_applications WHERE ref = ANY(${REFS.length ? REFS : ["-"]})`.catch(() => {});
      await sql`DELETE FROM fiaon_leads WHERE id = ANY(${LEADS.length ? LEADS : [0]})`.catch(() => {});
      await sql`DELETE FROM fiaon_mara_gedaechtnis WHERE person_id = ANY(${PERSONEN})`.catch(() => {});
      await sql`DELETE FROM fiaon_persons WHERE id = ANY(${PERSONEN})`.catch(() => {});
    }
  };
  /** Ein Kunde mit Antrag (bezahlt oder offen), optional Werbesperre und fälliger Rate. */
  const kunde = async (id: string, o: { bezahlt: boolean; werbesperre?: boolean; rateFaellig?: boolean }) => {
    await sql`DELETE FROM fiaon_persons WHERE person_ref = ${`PRUEF275-${id}`}`.catch(() => {});
    const [p] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email, country, assigned_agent_id)
      VALUES (${`PRUEF275-${id}`}, 'Prüf', 'Kunde', ${`pruef275-${id}@kunde.invalid`}, 'DE', 13) RETURNING id`) as any[];
    const personId = Number(p.id);
    PERSONEN.push(personId);
    if (o.werbesperre) await sql`UPDATE fiaon_persons SET werbung_gesperrt_am = NOW() - INTERVAL '23 days' WHERE id = ${personId}`;
    const [l] = (await sql`INSERT INTO fiaon_leads (person_id, quelle, link_code, vorname, nachname, erstellt_am) VALUES (${personId}, 'meta', ${`P275${id}`.padEnd(10, "x").slice(0, 10)}, 'Prüf', 'Kunde', NOW() - INTERVAL '70 days') RETURNING id`) as any[];
    LEADS.push(Number(l.id));
    const ref = `FIAON-P275${id.toUpperCase()}`;
    const zahlRef = `FIAON-${`P7${id.toUpperCase()}`.padEnd(6, "X").slice(0, 6)}`;
    REFS.push(ref);
    await sql`DELETE FROM fiaon_applications WHERE ref = ${ref}`.catch(() => {});
    await sql`INSERT INTO fiaon_applications (ref, payment_reference, person_id, status, payment_status, current_step, pack_key, ist_entwurf, agb_stand, created_at, user_agent,
                wanted_limit, paid_at, email, first_name, last_name, submitted_at)
      VALUES (${ref}, ${zahlRef}, ${personId}, 'approved', ${o.bezahlt ? "paid" : "pending_payment"}, 8, 'ultra', FALSE, '2026-07-04', NOW() - INTERVAL '61 days', 'Mozilla/5.0 (Prüfstand E-275)',
              15000, ${o.bezahlt ? new Date(Date.now() - 61 * 86_400_000) : null}, ${`pruef275-${id}@kunde.invalid`}, 'Prüf', 'Kunde', NOW() - INTERVAL '61 days')`;
    if (o.rateFaellig) {
      await sql`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am)
        VALUES (${ref}, 1, ${`${zahlRef}-1`}, 7999, ${new Date(Date.now() - 61 * 86_400_000)}, 'bezahlt', ${new Date(Date.now() - 61 * 86_400_000)})`;
      await sql`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status)
        VALUES (${ref}, 3, ${`${zahlRef}-3`}, 7999, (NOW() AT TIME ZONE 'Europe/Berlin')::date, 'offen')`;
    }
    return { personId, leadId: Number(l.id), ref, zahlRef };
  };
  /** Ein Gespräch: eine Vorlage von gestern und seine Nachricht vor 20 Sekunden. */
  const gespraech = async (nummer: string, personId: number, leadId: number, text: string) => {
    NUMMERN.push(nummer);
    await sql`DELETE FROM fiaon_whatsapp WHERE nummer = ${nummer}`;
    await sql`DELETE FROM fiaon_whatsapp_gespraech WHERE nummer = ${nummer}`.catch(() => {});
    const gestern = new Date(Date.now() - 20 * 3_600_000);
    await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, typ, text, status, vorlage, von, person_id, lead_id, gesendet_am, created_at)
      VALUES ('raus', ${nummer}, 'vorlage', 'Hallo, hier ist Mara, die digitale Assistentin von FIAON.', 'read', 'fiaon_kkb_test', 'Mara', ${personId}, ${leadId}, ${gestern}, ${gestern})`;
    const jetzt = new Date(Date.now() - 20_000);
    await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, typ, text, status, person_id, lead_id, empfangen_am, created_at)
      VALUES ('rein', ${nummer}, 'text', ${text}, 'empfangen', ${personId}, ${leadId}, ${jetzt}, ${jetzt})`;
  };
  const lauf = async (nummer: string, personId: number) => {
    const vorher = OPENAI.length;
    const karteVorher = KARTEN_AUFRUFE.length;
    const protVorher = new Date(Date.now() - 1000);
    const erg = await wa.maraAntwortet(nummer);
    const [g] = (await sql`SELECT antwort_text, antwort_handlung FROM fiaon_whatsapp_gespraech WHERE nummer = ${nummer}`.catch(() => [])) as any[];
    const prot = (await sql`SELECT art, text FROM fiaon_mara_protokoll WHERE (nummer = ${nummer} OR person_id = ${personId}) AND am >= ${protVorher} ORDER BY id`.catch(() => [])) as any[];
    const aufgaben = (await sql`SELECT schluessel, text FROM fiaon_betreiber_todos WHERE schluessel ~ ${`^wa-${personId}-`}`.catch(() => [])) as any[];
    return { erg, antwort: String(g?.antwort_text ?? ""), handlung: String(g?.antwort_handlung ?? ""), prot, aufgaben, aufrufe: OPENAI.slice(vorher), karte: KARTEN_AUFRUFE.slice(karteVorher) };
  };
  try {
    await sql`DELETE FROM fiaon_settings WHERE key = ANY(${EINSTELLUNGEN})`;
    await sql`INSERT INTO fiaon_settings (key, value) VALUES ('mara_wa_an', 'an')`;
    kp.kiPauseZwischenspeicherLeeren();

    console.log("\n── B. k1: Fall 6120 auf WhatsApp — zahlend, Werbesperre, keine Einladung ─");
    {
      kartenAntwort = "gesendet";
      const k = await kunde("k1", { bezahlt: true, werbesperre: true, rateFaellig: true });
      await gespraech("4915900275001", k.personId, k.leadId, "I have not your kaditkarte");
      plan = { antworten: ["{KEINE_KARTE}"] };
      const r = await lauf("4915900275001", k.personId);
      if (KI) console.log(`   KI-Aufrufe: ${r.aufrufe.length}${r.aufrufe.some((x) => x.zweiter) ? " (mit zweitem Entwurf)" : ""}`);
      console.log(`   NEU: „${kurz(r.antwort, 400)}“`);
      ok(r.karte.length === 1 && r.karte[0].personId === k.personId && r.karte[0].akteur?.quelle === "whatsapp", `der Server schickt den Link vorab über den Kartenweg (${r.karte.length}×, auch bei Werbesperre)`);
      ok(r.aufrufe.length >= 1 && r.aufrufe.every((x) => !x.tools.includes("karte_link_schicken")), "das Werkzeug fällt danach weg (kein zweiter Versand im Lauf)");
      ok(r.aufrufe.some((x) => /SCHON ERLEDIGT: Du hast ihm den Link unserer Partnerbank eben selbst geschickt/.test(x.system) && x.system.includes(KARTEN_SATZ)), "das Modell sieht „SCHON ERLEDIGT“ mit dem Satz aus dem Bereich Karte");
      if (KI) ok(/partnerbank|e-?mail|girokonto|\bdkb\b/i.test(r.antwort), "(echtes Modell) die Antwort sagt, dass der Link der Partnerbank raus ist");
      else ok(/Link unserer Partnerbank/.test(r.antwort) && /Rate vom/.test(r.antwort) && r.antwort.includes(ton.ZAHL_FRAGE), "die Antwort: der Link der Partnerbank, dann die fällige Rate und die Bitte ums Zahlen");
      const hartK1 = ton.tonPruefung(r.antwort, { kanal: "whatsapp", land: "DE", kunde: "I have not your kaditkarte" }).filter((b) => b.schwere === "hart");
      ok(!hartK1.length && !wa.istRueckfall(r.antwort), `ohne harten Ton-Treffer, kein Rückfallsatz${hartK1.length ? ` (${hartK1.map((b) => b.id).join(", ")})` : ""}`);
      ok(!/Boychenko|meldet sich|schaut nach|keine Bank|nicht von FIAON|Termin/i.test(r.antwort), "kein Kollege, kein Rückzug, kein Termin");
      ok(!r.aufgaben.length && !r.prot.some((x: any) => x.art === "uebergabe"), `KEINE Übergabe (Aufgaben: ${r.aufgaben.length})`);
      ok(r.prot.some((x: any) => x.art === "karte_link") && /Link der Partnerbank vorab \(gesendet\)/.test(r.handlung), "Protokoll „karte_link“ und Aktenvermerk-Handlung");
      ok(!sendePruefung(r.antwort).length, "die Antwort besteht die Wand");
      // Er fragt am selben Tag noch einmal — keine zweite Einladungsmail (erneut: false), der Satz „schon unterwegs“.
      const vor = new Date(Date.now() - 10_000);
      await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, typ, text, status, von, person_id, lead_id, gesendet_am, created_at)
        VALUES ('raus', '4915900275001', 'text', ${r.antwort || "Link geschickt."}, 'read', 'Mara Lindner', ${k.personId}, ${k.leadId}, ${vor}, ${vor})`;
      const neu = new Date(Date.now() - 5_000);
      await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, typ, text, status, person_id, lead_id, empfangen_am, created_at)
        VALUES ('rein', '4915900275001', 'text', 'Ich habe die Karte noch nicht, wo ist der Link?', 'empfangen', ${k.personId}, ${k.leadId}, ${neu}, ${neu})`;
      await sql`UPDATE fiaon_whatsapp_gespraech SET antwort_text = NULL, antwort_faellig_am = NULL WHERE nummer = '4915900275001'`.catch(() => {});
      const r2 = await lauf("4915900275001", k.personId);
      ok(r2.karte.length === 1 && r2.karte[0].akteur?.erneut === false, `zweite Frage am selben Tag: der Kartenweg mit erneut: false (keine zweite Mail) — ${JSON.stringify(r2.karte[0]?.akteur ?? null)}`);
    }

    console.log("\n── B. k2: derselbe, der Kartenweg lehnt ab (Ausschluss) ──────────────");
    {
      kartenAntwort = "gesperrt";
      const k = await kunde("k2", { bezahlt: true, rateFaellig: true });
      await gespraech("4915900275002", k.personId, k.leadId, "Wann kommt meine Karte?");
      plan = { antworten: ["Danke für Ihre Nachricht. Den Link schickt Ihnen Ihr Betreuer."] };
      const r = await lauf("4915900275002", k.personId);
      console.log(`   NEU: „${kurz(r.antwort, 300)}“`);
      ok(r.karte.length === 1, "der Kartenweg wurde gefragt");
      ok(r.aufgaben.length === 1 && /Kartenlink konnte Mara nicht schicken \(Kein Kartenlink: Vertriebssperre/.test(String(r.aufgaben[0]?.text ?? "")), "Übergabe mit dem internen Grund");
      ok(!/Vertriebssperre|is_blocked|Ausschluss/.test(r.antwort) && !r.aufrufe.some((x) => /Vertriebssperre/.test(x.system)), "der Kunde (und das Modell) liest keinen internen Grund");
    }

    console.log("\n── B. k3: B (erste Zahlung offen) fragt nach der Karte ──────────────");
    {
      kartenAntwort = "gesendet";
      const k = await kunde("k3", { bezahlt: false });
      await gespraech("4915900275003", k.personId, k.leadId, "Ich zahle heute noch. Wann bekomme ich dann meine Karte?");
      plan = { antworten: ["{ABSCHLUSS}"] };
      const r = await lauf("4915900275003", k.personId);
      console.log(`   NEU: „${kurz(r.antwort, 400)}“`);
      ok(r.karte.length === 0 && r.aufrufe.every((x) => !x.tools.includes("karte_link_schicken")), "KEIN Kartenlink vor der ersten Zahlung (kein Aufruf, kein Werkzeug)");
      if (KI) ok(r.antwort.includes(`/zahlung/${k.zahlRef}`) || /überweis|begleichen/i.test(r.antwort), "(echtes Modell) die Bitte ums Zahlen bzw. seine Zahlungsseite");
      else ok(/Link unserer Partnerbank für Ihren Kartenantrag/.test(r.antwort) && r.antwort.includes(ton.ZAHL_FRAGE) && r.antwort.includes(`/zahlung/${k.zahlRef}`), "Justins Satz, die Bitte ums Zahlen, seine Zahlungsseite");
      ok(!ton.tonPruefung(r.antwort, { kanal: "whatsapp", land: "DE", kunde: "Ich zahle heute noch. Wann bekomme ich dann meine Karte?" }).some((b) => b.schwere === "hart") && !sendePruefung(r.antwort).length && !/produktion|garantiert/i.test(r.antwort), "ohne harten Treffer, nie „in Produktion“ oder „garantiert“");
      ok(!/Termin|vereinbare|Anruf/.test(r.antwort) && !r.aufgaben.length, "kein Termin, keine Übergabe");
      ok(r.aufrufe.some((x) => /DEIN ABSCHLUSS \(Justin 29\.09\.2026, E-275 02\.10\.2026\)/.test(x.system) && !/ich vereinbare Ihren Termin mit/.test(aus(x.system, /So, eingesetzt für ihn \(in eigenen Worten, gleiche Fakten, keine andere Zahl\): „([\s\S]*?)"\n/))), "der Abschluss im Auftrag ohne „ich vereinbare Ihren Termin mit …“");
    }

    console.log("\n── B. k4: zahlend, „Wie komme ich jetzt zur DKB?“ — das Modell ruft das Werkzeug ─");
    {
      kartenAntwort = "gesendet";
      const k = await kunde("k4", { bezahlt: true });
      await gespraech("4915900275004", k.personId, k.leadId, "Wie komme ich jetzt zur DKB?");
      plan = { werkzeug: { name: "karte_link_schicken", args: {} }, antworten: ["Sehr gern!"] };
      const r = await lauf("4915900275004", k.personId);
      console.log(`   NEU: „${kurz(r.antwort, 300)}“`);
      ok(ton.fragtNachKarte("Wie komme ich jetzt zur DKB?") === false, "(kein Vorab — die Frage ist keine erkannte Kartenfrage)");
      ok(r.aufrufe[0]?.tools.includes("karte_link_schicken"), "das Werkzeug steht dem zahlenden Kunden zur Verfügung");
      if (KI) {
        console.log(`   (echtes Modell: karte_link_schicken ${r.karte.length ? "gerufen" : "nicht gerufen"})`);
        ok(/partnerbank|girokonto|\bdkb\b|link/i.test(r.antwort) && !/meldet sich|schaut nach|Boychenko/i.test(r.antwort), "(echtes Modell) erklärt den Weg zur DKB selbst, ohne Kollegen");
      } else ok(r.karte.length === 1 && r.antwort.includes(KARTEN_SATZ), "der Link ging raus, und der Server setzt den Satz in die Antwort, wo er fehlte");
      ok(!r.aufgaben.length, "keine Übergabe");
    }

    console.log("\n── B. k5: zahlend, kein Anruf gewollt — ein ungefragtes Terminangebot fällt weich ─");
    {
      const k = await kunde("k5", { bezahlt: true });
      await gespraech("4915900275005", k.personId, k.leadId, "Bekomme ich Bescheid, wenn alles fertig ist?");
      plan = { antworten: ["Ja, Sie bekommen Bescheid. Passt Ihnen heute um 15:50 Uhr ein Anruf mit Nikita Boychenko?", "Sobald Ihr Girokonto steht, buchen Sie im Banking Ihre Visa-Kreditkarte dazu — nach der Zusage der Bank ist sie in der Regel in 2–5 Werktagen bei Ihnen. Haben Sie den Link unserer Partnerbank schon geöffnet?"] };
      const r = await lauf("4915900275005", k.personId);
      console.log(`   NEU: „${kurz(r.antwort, 300)}“`);
      if (!KI) ok(r.aufrufe.some((x) => x.zweiter), "der erste Entwurf (Anruf ungefragt) ging in die zweite Runde");
      ok(!/Anruf|anrufen|ruft Sie|Termin|15:50|Boychenko/.test(r.antwort) && !r.aufgaben.length, "die Antwort ohne Anruf, ohne Termin und ohne Übergabe");
    }

    console.log("\n── B. k6: zahlend, keine E-Mail-Adresse — Mara fragt selbst danach ───");
    {
      kartenAntwort = "ohne_mail";
      const k = await kunde("k6", { bezahlt: true });
      await gespraech("4915900275006", k.personId, k.leadId, "Wo bleibt meine Karte?");
      plan = { antworten: ["Für den Link unserer Partnerbank zu Ihrem Kartenantrag brauche ich noch Ihre E-Mail-Adresse — schreiben Sie sie mir einfach hier?"] };
      const r = await lauf("4915900275006", k.personId);
      console.log(`   NEU: „${kurz(r.antwort, 300)}“`);
      ok(r.karte.length === 1 && r.aufrufe.some((x) => /FÜR DEN LINK DER PARTNERBANK FEHLT SEINE E-MAIL-ADRESSE/.test(x.system)), "das Modell weiß: die E-Mail-Adresse fehlt — fragen");
      ok(!r.aufgaben.length && /e-?mail/i.test(r.antwort) && !/Keine E-Mail-Adresse hinterlegt|Kein Kartenlink/.test(r.antwort), "keine Übergabe, die Frage nach der Adresse, kein interner Text");
      kartenAntwort = "gesendet";
    }
  } catch (e) {
    fehler++;
    console.error("ABBRUCH:", e);
  } finally {
    plan = null;
    await aufraeumen().catch((e) => console.error("Aufräumen:", e));
    await sql`DELETE FROM fiaon_settings WHERE key = ANY(${EINSTELLUNGEN})`.catch(() => {});
    for (const r of einstellungVorher) await sql`INSERT INTO fiaon_settings (key, value) VALUES (${r.key}, ${r.value}) ON CONFLICT (key) DO UPDATE SET value = ${r.value}`.catch(() => {});
    const rest = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_persons WHERE person_ref LIKE 'PRUEF275-%'`.catch(() => [{ n: -1 }])) as any[];
    ok(Number(rest[0].n) === 0, `Aufgeräumt: keine PRUEF275-Personen mehr (${rest[0].n})`);
  }
}
ok(FREMD.length === 0, `Kein Netzaufruf außer der Attrappe (${FREMD.slice(0, 3).join(", ") || "keiner"})`);
console.log(`\n${fehler ? "✗" : "✓"} ${geprueft - fehler}/${geprueft} Prüfungen bestanden${KI ? ` (mit DB und echtem Modell, ${OPENAI.length} Aufrufe)` : MIT_DB ? " (mit DB)" : " (offline)"}`);
process.exit(fehler ? 1 : 0);
