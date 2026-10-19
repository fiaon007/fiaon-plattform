// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-401 (1/6), DATENBANK: Eine Mail — eine Einordnung, ein Aktenvermerk (19.10.2026)
//
// Ganze Takte gegen eine LOKALE Prüfdatenbank — Gmail und OpenAI sind Attrappen, nichts geht hinaus:
//   A  „#7110 nachgebaut“: frische Mail, KI-Pause gerade aufgehoben → der Nachhol-Lauf dreht EINE Runde
//      (vorher 20), die Mail wartet (Bündeln); der nächste Takt beantwortet sie — 1 Einordnung, 1 Vermerk.
//   B  „#5712 nachgebaut“: alte, in Gmail von Hand beantwortete Mail (Altbestand ohne Merker, Vermerk steht
//      schon) — der Rückstands-Takt nimmt sie nicht mehr; holt man sie trotzdem dreimal, entsteht kein
//      Vermerk und nur EINE Einordnung.
//   C  Altbestand ohne alten Vermerk → genau einer, danach keiner mehr.
//   D  Absender ohne Akte → kein Vermerk, Einordnung trotzdem nur einmal.
//   E  Zwei Anläufe gleichzeitig → genau ein Vermerk.  F  Geänderte Mail → neu eingeordnet.
//   Rot-Probe: ohne Merker (alter Weg einordnen()) zählt der Prüfstand zwei Einordnungen.
//
//   env -i HOME=$HOME PATH=$PATH TZ=Europe/Berlin CRONS=aus SESSION_SECRET=pruefstand-nur-lokal DOTENV_CONFIG_PATH=/dev/null \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_<kopie>?sslmode=require' \
//     node_modules/.bin/tsx scripts/pruef-postmeister-einmal-db.ts
// Eigene Datensätze (Personen PRUEF401A-…, Referenzen FIAON-P401A…, Mails e401a-…) werden am Ende entfernt.
// ═══════════════════════════════════════════════════════════════════════════
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "META_SYSTEM_TOKEN", "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY", "GOOGLE_SA_KEY", "GMAIL_CLIENT_SECRET", "RESEND_API_KEY", "TWILIO_AUTH_TOKEN", "VAPID_PRIVATE_KEY", "KI_ANBIETER"]) {
  if (process.env[k]) { console.error(`${k} ist gesetzt — Abbruch, der Prüfstand darf nichts versenden.`); process.exit(3); }
}
if (!/@(127\.0\.0\.1|localhost):54329\/fiaon_pruefstand/.test(String(process.env.DATABASE_URL))) { console.error("NUR gegen eine lokale fiaon_pruefstand*-Datenbank!"); process.exit(3); }
process.env.CRONS = "aus";
process.env.SESSION_SECRET ||= "pruefstand-nur-lokal";

import { generateKeyPairSync } from "node:crypto";

// ── Attrappen VOR jedem Import ────────────────────────────────────────────
process.env.OPENAI_API_KEY = "sk-pruef-lokal-e401a";
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
process.env.GOOGLE_SA_KEY = JSON.stringify({
  client_email: "pruef@e401a.invalid", private_key: privateKey.export({ type: "pkcs8", format: "pem" }), token_uri: "https://oauth2.pruef.invalid/token",
});

const MIN = 60_000, H = 60 * MIN;
const PF = "support@fiaon.com";
const OPENAI: { art: "einordnen" | "antwort"; text: string }[] = [];
const GMAIL_SUCHE: string[] = [];
const GMAIL_RAUS: string[] = [];
const FREMD: string[] = [];
let inboxListe: string[] = [];
let sentListe: string[] = [];
type Nachricht = { thread: string; labels: string[]; am: number; von: string; betreff: string; text: string };
const NACHRICHTEN = new Map<string, Nachricht>();

const EINORDNUNG = { kategorien: ["zahlung"], flags: { zahlung_behauptet: true }, dringend: false, sprache: "de", fragen: ["Ist meine Überweisung angekommen?"], zusammenfassung: "Kunde meldet seine Überweisung und fragt, ob sie angekommen ist." };
const ANTWORT = {
  antwort: "Vielen Dank für Ihre Nachricht. Ich sehe mir Ihre Überweisung an und melde mich, sobald sie bei uns verbucht ist.",
  naechster_schritt: { art: "keiner", url: null, text: "" }, belege: [], fragen_beantwortet: [], merken: [],
};

const json = (status: number, j: unknown) => new Response(JSON.stringify(j), { status, headers: { "Content-Type": "application/json" } });
const nachricht = (text: string) => ({ output: [{ type: "message", content: [{ type: "output_text", text }] }] });
const echtFetch = globalThis.fetch;
globalThis.fetch = (async (eingabe: any, init?: any) => {
  const u = String(typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe?.url ?? eingabe);
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) return echtFetch(eingabe, init);
  if (u.startsWith("https://api.openai.com/")) {
    const text = typeof init?.body === "string" ? init.body : "";
    const einordnen = text.includes("Du ordnest eingehende Kundenmails");
    OPENAI.push({ art: einordnen ? "einordnen" : "antwort", text });
    const body = JSON.parse(text || "{}");
    const aus = einordnen ? nachricht(JSON.stringify(EINORDNUNG)) : body.text?.format ? nachricht(JSON.stringify(ANTWORT)) : nachricht("fertig");
    return json(200, { status: "completed", ...aus, usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 } });
  }
  if (u === "https://oauth2.pruef.invalid/token") return json(200, { access_token: "pruef-token", expires_in: 3600 });
  if (u.startsWith("https://gmail.googleapis.com/")) {
    const methode = String(init?.method ?? "GET").toUpperCase();
    if (/\/messages\/send|\/drafts/.test(u)) { GMAIL_RAUS.push(u); return json(200, { id: `raus-${GMAIL_RAUS.length}`, threadId: "t", message: { id: "x" } }); }
    if (/\/messages\?/.test(u)) {
      const q = decodeURIComponent(new URL(u).searchParams.get("q") ?? "");
      GMAIL_SUCHE.push(q);
      const ids = q.includes("in:sent") ? sentListe : inboxListe;
      return json(200, { messages: ids.map((id) => ({ id })), resultSizeEstimate: ids.length });
    }
    const m = u.match(/\/messages\/([^/?]+)\?format=full/);
    if (m) {
      const n = NACHRICHTEN.get(m[1]);
      if (!n) return json(404, { error: { message: "Not Found" } });
      return json(200, {
        id: m[1], threadId: n.thread, labelIds: n.labels, internalDate: String(n.am), snippet: n.text.slice(0, 80),
        payload: { mimeType: "text/plain", headers: [
          { name: "From", value: n.von }, { name: "To", value: PF }, { name: "Subject", value: n.betreff },
          { name: "Date", value: new Date(n.am).toUTCString() }, { name: "Message-ID", value: `<${m[1]}@kunde.invalid>` }],
          body: { data: Buffer.from(n.text).toString("base64") } },
      });
    }
    if (u.endsWith("/labels")) return json(200, methode === "POST" ? { id: "L1" } : { labels: [] });
    return json(200, {});
  }
  FREMD.push(u);
  throw new Error(`Prüfstand: kein Netz (${u})`);
}) as typeof fetch;

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra: unknown = "") {
  if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}${extra !== "" ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra)}` : ""}`); }
}
const einordnungen = (ab = 0) => OPENAI.slice(ab).filter((o) => o.art === "einordnen").length;

const { sqlPool: sql } = await import("../server/lib/db-pool");
const kp = await import("../server/lib/fiaon-ki-pause");
kp.kiNetzAbsichern();
const lauf = await import("../server/lib/fiaon-postmeister-lauf");
const pm = await import("../server/routes/fiaon-postmeister");
const auf = await import("../server/lib/fiaon-postmeister-aufholen");
const agent = await import("../server/lib/fiaon-postmeister-agent");
const einmal = await import("../server/lib/fiaon-postmeister-einmal");
const { akteVermerkKopf } = await import("../shared/fiaon-postmeister-merker");
const { postmeisterSchema } = await import("../server/lib/fiaon-postmeister-schema");

const EINSTELLUNGEN = ["ki_pause", "postmeister_an", "postmeister_v2", "postmeister_modus_support", "postmeister_modus_welcome"];
const einstellungVorher = (await sql`SELECT key, value FROM fiaon_settings WHERE key = ANY(${EINSTELLUNGEN})`) as any[];

async function kunde(kurz: string): Promise<{ id: number; ref: string; mail: string; von: string }> {
  const mail = `probe401${kurz.toLowerCase()}@kunde.invalid`;
  const ref = `FIAON-P401A${kurz}`;
  const [p] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email) VALUES (${`PRUEF401A-${kurz}`}, 'Sam', ${`Probe${kurz}`}, ${mail}) RETURNING id`) as any[];
  await sql`INSERT INTO fiaon_applications (ref, person_id, type, status, pack_key, pack_name, payment_reference, payment_status, amount_due, first_name, last_name, email, created_at)
            VALUES (${ref}, ${Number(p.id)}, 'private', 'submitted', 'pro', 'FIAON Pro (Standard)', ${ref}, 'claimed_paid', 59.99, 'Sam', ${`Probe${kurz}`}, ${mail}, NOW() - INTERVAL '30 days')`;
  return { id: Number(p.id), ref, mail, von: `Sam Probe <${mail}>` };
}
const zeile = async (gmailId: string) => ((await sql`SELECT * FROM fiaon_postmeister WHERE gmail_id = ${gmailId}`) as any[])[0];
const vermerke = async (ref: string, betreff: string) => Number(((await sql`
  SELECT COUNT(*)::int AS n FROM fiaon_contact_log WHERE ref = ${ref} AND agent_name = 'Postmeister' AND LEFT(note, ${akteVermerkKopf(PF, betreff).length}) = ${akteVermerkKopf(PF, betreff)}`) as any[])[0].n);
const inboxSuchen = () => GMAIL_SUCHE.filter((q) => q.includes("in:inbox")).length;

try {
  await postmeisterSchema();
  await sql`DELETE FROM fiaon_settings WHERE key = ANY(${EINSTELLUNGEN})`;
  await sql`INSERT INTO fiaon_settings (key, value) VALUES ('postmeister_an', 'an'), ('postmeister_modus_support', 'entwurf'), ('postmeister_modus_welcome', 'aus')`;
  kp.kiPauseZwischenspeicherLeeren?.();
  const spalten = ((await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'fiaon_postmeister' AND column_name IN ('einordnung_merker', 'akte_vermerk_am')`) as any[]).map((r) => r.column_name).sort();
  ok(spalten.join() === "akte_vermerk_am,einordnung_merker", "Schema: Spalten einordnung_merker + akte_vermerk_am angelegt", spalten);

  // ═══ A · #7110 nachgebaut ═══════════════════════════════════════════════
  console.log("── A · Frische Mail, KI-Pause gerade aufgehoben: eine Runde, ein Vermerk, eine Einordnung");
  const A = await kunde("A");
  const betreffA = "Re: Kurz zu Ihrer Überweisung";
  NACHRICHTEN.set("e401a-m1", { thread: "e401a-t1", labels: ["INBOX", "UNREAD"], am: Date.now() - MIN, von: A.von, betreff: betreffA, text: "Guten Tag, ich habe gestern überwiesen. Ist das Geld angekommen? Gruß" });
  inboxListe = ["e401a-m1"];
  const kiVorA = OPENAI.length, sucheVorA = inboxSuchen();
  const n1 = await pm.postmeisterNachDerPause(new Date(Date.now() - 3 * H).toISOString());
  const zA1 = await zeile("e401a-m1");
  ok(n1.verarbeitet === 0, `Nachhol-Lauf: die wartende Mail zählt nicht als verarbeitet (${n1.verarbeitet})`);
  ok(inboxSuchen() - sucheVorA === 1, `Nachhol-Lauf dreht EINE Runde (Gmail-Suchen: ${inboxSuchen() - sucheVorA}; vorher bis zu 20 in zwei Minuten)`);
  ok(zA1?.aktion === "vorgeordnet" && /^Bündeln/.test(String(zA1?.begruendung)), `Mail wartet einen Takt (Bündeln, E-369): ${zA1?.aktion} / ${String(zA1?.begruendung).slice(0, 40)}`);
  ok(einordnungen(kiVorA) === 1, `eine KI-Einordnung (${einordnungen(kiVorA)})`);
  ok(typeof zA1?.einordnung_merker === "object" && zA1.einordnung_merker?.v === 1 && /^[0-9a-f]{32}$/.test(String(zA1.einordnung_merker?.fp)), "Merker der Einordnung steht an der Zeile (als Objekt, Fingerabdruck)", zA1?.einordnung_merker);
  ok(!!zA1?.akte_vermerk_am, "Merker des Aktenvermerks steht an der Zeile");
  ok(await vermerke(A.ref, betreffA) === 1, "genau ein Vermerk „E-Mail an …“ in der Akte");

  // Ein Takt von Hand, solange sie noch frisch ist — wartet wieder, ohne KI und ohne Vermerk.
  const lA1 = await pm.postmeisterLauf();
  ok(lA1.verarbeitet === 0 && lA1.aktionen.wartet === 1, `Takt mit noch frischer Mail: wartet, nicht verarbeitet (${JSON.stringify(lA1.aktionen)})`);
  ok(einordnungen(kiVorA) === 1 && await vermerke(A.ref, betreffA) === 1, "… keine zweite Einordnung, kein zweiter Vermerk");

  // Fünf Minuten später: der reguläre Takt beantwortet sie.
  NACHRICHTEN.get("e401a-m1")!.am = Date.now() - 6 * MIN;
  const kiVorA2 = OPENAI.length;
  const lA2 = await pm.postmeisterLauf();
  const zA2 = await zeile("e401a-m1");
  ok(lA2.verarbeitet === 1, `nächster Takt: verarbeitet (${JSON.stringify(lA2.aktionen)})`);
  ok(["entwurf", "auto_beantwortet"].includes(String(zA2?.aktion)), `Antwort entsteht wie bisher (${zA2?.aktion}: ${String(zA2?.begruendung ?? "").slice(0, 60)})`);
  ok(einordnungen(kiVorA2) === 0, `KEINE zweite KI-Einordnung (${einordnungen(kiVorA2)}) — der Merker trägt sie`);
  ok(OPENAI.slice(kiVorA2).some((o) => o.art === "antwort"), "die Antwort-KI lief (die Arbeit selbst ist unverändert)");
  ok(await vermerke(A.ref, betreffA) === 1, `weiter genau EIN Vermerk „E-Mail an …“ (${await vermerke(A.ref, betreffA)})`);
  ok(zA2?.kategorie === "zahlung" && zA2?.zusammenfassung === EINORDNUNG.zusammenfassung && JSON.stringify(zA2?.kategorien) === '["zahlung"]',
    "Zeile trägt die gemerkte Einordnung (Kategorie, Zusammenfassung)", { k: zA2?.kategorie, z: zA2?.zusammenfassung });
  const flagsA = typeof zA2?.flags === "string" ? JSON.parse(zA2.flags) : zA2?.flags;
  ok(flagsA?.zahlung_behauptet === true, "Merkmale aus der gemerkten Einordnung (zahlung_behauptet)", flagsA);

  // ═══ B · #5712 nachgebaut ═══════════════════════════════════════════════
  console.log("── B · Alte, in Gmail von Hand beantwortete Mail (Altbestand) — Rückstands-Takt");
  const B = await kunde("B");
  const betreffB = "Aw: Ein kurzer Schritt zur Karte";
  const amB = Date.now() - 21 * 24 * H;
  NACHRICHTEN.set("e401a-m2", { thread: "e401a-t2", labels: ["INBOX"], am: amB, von: B.von, betreff: betreffB, text: "Ich habe die Unterlagen schon geschickt. Wann geht es weiter?" });
  NACHRICHTEN.set("e401a-s2", { thread: "e401a-t2", labels: ["SENT"], am: amB + 3 * H, von: `FIAON Support <${PF}>`, betreff: `Re: ${betreffB}`, text: "Antwort eines Menschen." });
  const [zB0] = (await sql`
    INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, aktion, begruendung, versuche, person_id, ref, von, betreff, empfangen_am, kategorie, created_at, updated_at)
    VALUES (${PF}, 'e401a-m2', 'e401a-t2', 'geordnet', 'vom Menschen beantwortet (Gmail, 28.09. 14:08) — keine zweite Antwort', 1, ${B.id}, ${B.ref},
            ${B.von}, ${betreffB}, ${new Date(amB)}, 'unterlagen', ${new Date(amB + 60_000)}, ${new Date(amB + 60_000)})
    RETURNING id`) as any[];
  // Der Vermerk des ersten Laufs (alter Code) steht schon in der Akte.
  await sql`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
            VALUES (${B.ref}, ${B.id}, NULL, 'Postmeister', 'system', ${`${akteVermerkKopf(PF, betreffB)}Kunde fragt, wann es weitergeht.`}, ${new Date(amB + 2 * 60_000)})`;
  // Eine echte offene Unterhaltung zum Vergleich (kein Mensch hat geantwortet).
  const C0 = await kunde("C0");
  await sql`INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, aktion, begruendung, versuche, person_id, ref, von, betreff, empfangen_am, kategorie)
            VALUES (${PF}, 'e401a-m9', 'e401a-t9', 'geordnet', 'nur eingeordnet', 0, ${C0.id}, ${C0.ref}, ${C0.von}, 'Frage', NOW() - INTERVAL '2 days', 'status_frage')`;
  const offen = (await auf.offeneUnterhaltungen(500)).map((k: any) => String(k.gmail_id));
  ok(!offen.includes("e401a-m2"), "Rückstands-Takt: die von Hand beantwortete Unterhaltung ist NICHT mehr offen");
  ok(offen.includes("e401a-m9"), "… eine wirklich offene Unterhaltung bleibt Kandidat (Gegenprobe)");

  // ── B2 · Nachbesserung: JEDER Weg, auf dem ein Mensch eine Mail schließt, bleibt geschlossen ──
  // Vorher kannte der Filter nur „vom Menschen beantwortet“ — „Nichts senden“ (E-371), „Verworfen“, „Vom Betreuer
  // übernommen“, die 24-Stunden-Ablage und die Doppel-Zeilen holte der Takt alle 20 Minuten wieder hervor.
  console.log("── B2 · Nichts senden, Verworfen, Übernommen, 24-Stunden-Ablage, Doppel → nicht mehr offen");
  const B2 = await kunde("B2");
  const geschlossen: [string, string][] = [
    ["e401a-m21", "Nicht beantwortet — Entscheidung Justin (E-371)"],
    ["e401a-m22", "Verworfen: doppelt"],
    ["e401a-m23", "Vom Betreuer übernommen (Herr Probe): per Telefon erledigt"],
    ["e401a-m24", "Nicht mehr nötig (24-Stunden-Regel): Der Kunde hat danach noch einmal geschrieben"],
    ["e401a-m25", "Dieselbe Mail liegt auch in welcome@fiaon.com"],
    ["e401a-m26", "Doppel von Mail #1 — derselbe Text noch einmal geschickt; nur eine Antwort (E-248)"],
  ];
  for (const [gid, grund] of geschlossen) {
    await sql`INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, aktion, begruendung, versuche, person_id, ref, von, betreff, empfangen_am, kategorie)
              VALUES (${PF}, ${gid}, ${`${gid}-t`}, 'geordnet', ${grund}, 0, ${B2.id}, ${B2.ref}, ${B2.von}, 'Frage', NOW() - INTERVAL '1 day', 'status_frage')`;
  }
  // Gegenprobe: ein verworfener ALT-Entwurf (aufholen.ts) soll ausdrücklich wieder offen werden — neu beantwortet.
  await sql`INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, aktion, begruendung, versuche, person_id, ref, von, betreff, empfangen_am, kategorie)
            VALUES (${PF}, 'e401a-m27', 'e401a-m27-t', 'geordnet', 'Alt-Entwurf ohne Belege (erste Fassung, ungedeckt)', 0, ${B2.id}, ${B2.ref}, ${B2.von}, 'Frage', NOW() - INTERVAL '1 day', 'status_frage')`;
  const offen2 = (await auf.offeneUnterhaltungen(500)).map((k: any) => String(k.gmail_id));
  for (const [gid, grund] of geschlossen) ok(!offen2.includes(gid), `nicht offen: „${grund.slice(0, 48)}…“`);
  ok(offen2.includes("e401a-m27"), "… ein verworfener Alt-Entwurf bleibt offen (wird neu beantwortet — Gegenprobe)");
  // Rot-Probe: mit dem alten Filter (nur „vom Menschen beantwortet“) wären alle sechs Kandidaten.
  const altFilter = (await sql`
    SELECT gmail_id FROM fiaon_postmeister
     WHERE gmail_id = ANY(${geschlossen.map((g) => g[0])}) AND aktion = 'geordnet'
       AND NOT (COALESCE(begruendung, '') LIKE 'vom Menschen beantwortet%')`) as any[];
  ok(altFilter.length === geschlossen.length, `Rot-Probe: der alte Filter ließ alle ${geschlossen.length} durch (${altFilter.length})`);

  // Holt man sie trotzdem dreimal (so wie der Takt bisher alle 20 Minuten): kein Vermerk, EINE Einordnung.
  sentListe = ["e401a-s2"];
  const kiVorB = OPENAI.length;
  for (let i = 0; i < 3; i++) {
    await sql`UPDATE fiaon_postmeister SET aktion = 'vorgeordnet', versuche = 0 WHERE id = ${Number(zB0.id)}`;
    await lauf.mailBearbeiten({ postfach: PF, gmailId: "e401a-m2", gruss: "Gruß", modus: "entwurf" });
  }
  const zB = await zeile("e401a-m2");
  ok(zB?.aktion === "geordnet" && /^vom Menschen beantwortet/.test(String(zB?.begruendung)), `jedes Mal wieder „vom Menschen beantwortet“ (${zB?.aktion})`);
  ok(einordnungen(kiVorB) === 1, `drei Anläufe → EINE KI-Einordnung (${einordnungen(kiVorB)}; vorher 3)`);
  ok(OPENAI.slice(kiVorB).every((o) => o.art !== "antwort"), "keine Antwort-KI (es gibt nichts zu beantworten)");
  ok(await vermerke(B.ref, betreffB) === 1, `kein neuer Vermerk — der alte (Altbestand) wurde gefunden (${await vermerke(B.ref, betreffB)}; vorher +3)`);
  ok(!!zB?.akte_vermerk_am && !!zB?.einordnung_merker, "beide Merker stehen jetzt an der Zeile");
  sentListe = [];

  // ═══ C · Altbestand ohne alten Vermerk ═══════════════════════════════════
  console.log("── C · Altbestand ohne Vermerk (früherer Anlauf scheiterte vorher) → genau einer, dann keiner mehr");
  const C = await kunde("C");
  const betreffC = "Frage zu meinem Zugang";
  NACHRICHTEN.set("e401a-m3", { thread: "e401a-t3", labels: ["INBOX"], am: Date.now() - 3 * H, von: C.von, betreff: betreffC, text: "Ich komme nicht in mein Konto. Können Sie helfen?" });
  await sql`INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, aktion, begruendung, versuche, naechster_versuch_am, created_at)
            VALUES (${PF}, 'e401a-m3', '', 'fehler', 'Gmail: kurz nicht erreichbar', 1, NOW() - INTERVAL '1 minute', NOW() - INTERVAL '2 hours')`;
  sentListe = [];
  await lauf.mailBearbeiten({ postfach: PF, gmailId: "e401a-m3", gruss: "Gruß", modus: "entwurf" });
  ok(await vermerke(C.ref, betreffC) === 1, `ein Vermerk geschrieben (${await vermerke(C.ref, betreffC)})`);
  const zC = await zeile("e401a-m3");
  await sql`UPDATE fiaon_postmeister SET aktion = 'vorgeordnet', versuche = 0 WHERE id = ${Number(zC.id)}`;
  const kiVorC = OPENAI.length;
  await lauf.mailBearbeiten({ postfach: PF, gmailId: "e401a-m3", gruss: "Gruß", modus: "entwurf" });
  ok(await vermerke(C.ref, betreffC) === 1 && einordnungen(kiVorC) === 0, `zweiter Anlauf: kein Vermerk, keine Einordnung (${await vermerke(C.ref, betreffC)} / ${einordnungen(kiVorC)})`);

  // ═══ D · Absender ohne Akte ══════════════════════════════════════════════
  console.log("── D · Absender ohne Akte: kein Vermerk, die Einordnung trotzdem nur einmal");
  NACHRICHTEN.set("e401a-m4", { thread: "e401a-t4", labels: ["INBOX"], am: Date.now() - MIN, von: "Unbekannt Probe <unbekannt401@kunde.invalid>", betreff: "Anfrage", text: "Was kostet die Karte bei Ihnen?" });
  const kiVorD = OPENAI.length;
  const d1 = await lauf.mailBearbeiten({ postfach: PF, gmailId: "e401a-m4", gruss: "Gruß", modus: "entwurf" });
  const d2 = await lauf.mailBearbeiten({ postfach: PF, gmailId: "e401a-m4", gruss: "Gruß", modus: "entwurf" });
  const zD = await zeile("e401a-m4");
  ok(d1.wartet === true && d2.wartet === true, "zweimal frisch → zweimal „wartet“ (Bündeln über die Adresse)");
  ok(einordnungen(kiVorD) === 1, `EINE Einordnung (${einordnungen(kiVorD)})`);
  ok(!zD?.akte_vermerk_am && !!zD?.einordnung_merker, "ohne Akte kein Vermerk-Merker, aber der Einordnungs-Merker steht");

  // ═══ E · Zwei Anläufe gleichzeitig ═══════════════════════════════════════
  console.log("── E · Zwei Vermerk-Versuche gleichzeitig → genau einer");
  const E = await kunde("E");
  const [zE] = (await sql`INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, aktion) VALUES (${PF}, 'e401a-m5', '', 'in_arbeit') RETURNING id, created_at`) as any[];
  const parallel = await Promise.all([0, 1, 2].map(() => einmal.akteVermerkEinmal({
    postmeisterId: Number(zE.id), ref: E.ref, personId: E.id, postfach: PF, betreff: "Gleichzeitig", zusammenfassung: "Test.",
    neuAngelegt: true, vermerkMerker: null, einordnungMerker: null, zeileSeit: new Date(zE.created_at),
  })));
  ok(parallel.filter((x) => x === "geschrieben").length === 1 && await vermerke(E.ref, "Gleichzeitig") === 1, `drei gleichzeitig → ein Vermerk (${parallel.join(", ")})`);
  ok(await einmal.akteVermerkEinmal({ postmeisterId: Number(zE.id), ref: null, personId: null, postfach: PF, betreff: "x", zusammenfassung: "", neuAngelegt: true, vermerkMerker: null, einordnungMerker: null, zeileSeit: new Date() }) === "ohne_ref", "ohne Referenz: kein Vermerk (wie seit E-094)");

  // ═══ F · Geänderte Mail ══════════════════════════════════════════════════
  console.log("── F · Geänderte Anfrage → neu eingeordnet; gleiche → aus dem Merker");
  const mailF = { betreff: "Frage", text: "Wann kommt meine Karte?", von: "Sam Probe <probe401f@kunde.invalid>", alterTage: 0 };
  const kiVorF = OPENAI.length;
  const f1 = await agent.einordnenMitMerker(mailF, null);
  const f2 = await agent.einordnenMitMerker({ ...mailF, alterTage: 3 }, JSON.parse(JSON.stringify(f1.merker)));
  const f3 = await agent.einordnenMitMerker({ ...mailF, text: "Wann kommt meine Karte? Ich warte seit Wochen." }, f1.merker);
  ok(!f1.wiederverwendet && f2.wiederverwendet && !f3.wiederverwendet, "frisch → gemerkt (auch Tage später) → geänderter Text neu", [f1.wiederverwendet, f2.wiederverwendet, f3.wiederverwendet]);
  ok(einordnungen(kiVorF) === 2, `zwei KI-Aufrufe für drei Anfragen (${einordnungen(kiVorF)})`);
  ok(JSON.stringify(f2.einordnung) === JSON.stringify(f1.einordnung), "gemerkte Einordnung = frische");
  const gemerktOk = await einmal.einordnungMerken(Number(zE.id), f1.merker);
  const [typ] = (await sql`SELECT jsonb_typeof(einordnung_merker) AS t, einordnung_merker->>'fp' AS fp FROM fiaon_postmeister WHERE id = ${Number(zE.id)}`) as any[];
  ok(gemerktOk && typ?.t === "object" && typ?.fp === f1.merker.fp, `Merker landet als echtes JSON-Objekt an der Zeile (jsonb_typeof: ${typ?.t}; kein Text-Skalar, E-238)`);
  const { einordnungMerkerLesen } = await import("../shared/fiaon-postmeister-merker");
  ok(einordnungMerkerLesen((await zeile("e401a-m5"))?.einordnung_merker, f1.merker.fp) !== null, "… und wird so, wie die Datenbank ihn zurückgibt, wieder gelesen");

  // ═══ Rot-Probe ═══════════════════════════════════════════════════════════
  console.log("── Rot-Probe: der alte Weg (einordnen ohne Merker) — der Prüfstand würde ihn sehen");
  const kiVorR = OPENAI.length;
  await agent.einordnen(mailF);
  await agent.einordnen(mailF);
  ok(einordnungen(kiVorR) === 2, `ohne Merker: zwei Einordnungen für dieselbe Mail (${einordnungen(kiVorR)}) — genau das zählt der Prüfstand oben`);

  ok(FREMD.length === 0, `kein Netz außer den Attrappen (${FREMD.length})`, FREMD.slice(0, 3));
} catch (e: any) {
  schlecht++;
  console.error("  ✗ Abbruch:", e?.stack ?? e);
} finally {
  await sql`DELETE FROM fiaon_contact_log WHERE ref LIKE 'FIAON-P401A%'`.catch(() => {});
  await sql`DELETE FROM fiaon_postmeister WHERE gmail_id LIKE 'e401a-%'`.catch(() => {});
  await sql`DELETE FROM fiaon_applications WHERE ref LIKE 'FIAON-P401A%'`.catch(() => {});
  await sql`DELETE FROM fiaon_persons WHERE person_ref LIKE 'PRUEF401A-%'`.catch(() => {});
  await sql`DELETE FROM fiaon_settings WHERE key = ANY(${EINSTELLUNGEN})`.catch(() => {});
  for (const r of einstellungVorher) await sql`INSERT INTO fiaon_settings (key, value) VALUES (${r.key}, ${r.value}) ON CONFLICT (key) DO UPDATE SET value = ${r.value}`.catch(() => {});
  console.log(`\n${gut} gut, ${schlecht} schlecht`);
  await sql.end({ timeout: 2 }).catch(() => {});
  process.exit(schlecht ? 1 : 0);
}
