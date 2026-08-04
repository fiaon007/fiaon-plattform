// ═══════════════════════════════════════════════════════════════════════════
// Prüfstand: Erinnerungs-Lauf und automatische Ratenketten
//
// Gemeldet am 05.08.2026:
//   · „Erinnerungs-Lauf geht nicht — 0 gesendet." Der Knopf hing am Motor, der
//     nur „heute oder früher fällig" UND den Einführungsstichtag berücksichtigt.
//   · „Ketten anlegen" soll weg: Wer ein Paket kauft, HAT ein Abo.
//
// WICHTIG: Diese Prüfung darf keine echten Kundenmails auslösen. Der Server muss
// deshalb OHNE MAKE_WEBHOOK_URL laufen — dann meldet der Versand ehrlich
// „URL nicht gesetzt", die Mahnstufe bleibt stehen (das ist genau die Regel, die
// wir prüfen wollen), und kein Kunde bekommt Post.
//
//   MAKE_WEBHOOK_URL="" npx tsx server/index.ts
//   npx tsx scripts/pruef-abo-lauf.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";

const BASIS = process.env.BASIS || "http://localhost:5188";
const CODE = process.env.ADMIN_ACCESS_CODE || "20032017";

let rot = 0;
const pruefe = (name: string, gut: boolean, hinweis = "") => {
  if (!gut) rot++;
  console.log(`  ${gut ? "PASS" : "FAIL"}  ${name}${gut ? "" : `  → ${hinweis}`}`);
};

let cookie = "";
async function ruf(pfad: string, init?: RequestInit) {
  const res = await fetch(`${BASIS}${pfad}`, {
    ...init,
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), cookie },
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

async function setzeEinstellung(key: string, wert: string | null) {
  if (wert === null) {
    await sqlPool`DELETE FROM fiaon_settings WHERE key = ${key}`;
  } else {
    await sqlPool`
      INSERT INTO fiaon_settings (key, value) VALUES (${key}, ${wert})
      ON CONFLICT (key) DO UPDATE SET value = ${wert}
    `;
  }
}

(async () => {
  const auf = await fetch(`${BASIS}/api/fiaon/zugang/oeffnen`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: CODE }),
  });
  cookie = (auf.headers.get("set-cookie") || "").split(";")[0];

  // Ausgangszustand sichern — die Prüfung stellt ihn am Ende wieder her.
  const [alteEinst] = await sqlPool`
    SELECT
      (SELECT value FROM fiaon_settings WHERE key = 'abo_fenster_start') AS start,
      (SELECT value FROM fiaon_settings WHERE key = 'abo_fenster_ende') AS ende
  `;

  // ── 1. Versandfenster wird ausgewiesen statt still zu schlucken ────────────
  console.log("── 1. Versandfenster ──");
  await setzeEinstellung("abo_fenster_start", "23");
  await setzeEinstellung("abo_fenster_ende", "24");
  const zu = await ruf("/api/fiaon/admin/abo/lauf", { method: "POST", body: JSON.stringify({ art: "heute" }) });
  const jetzt = Number(new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", hour12: false })
    .formatToParts(new Date()).find((p) => p.type === "hour")?.value || "0");
  const solltGesperrtSein = !(jetzt >= 23 && jetzt < 24);
  if (solltGesperrtSein) {
    pruefe("Außerhalb des Fensters: klare Absage statt „0 gesendet“",
      zu.status === 400 && /Versandfenster/.test(String(zu.body?.error)), `HTTP ${zu.status} ${zu.body?.error}`);
  } else {
    console.log("  (läuft gerade im Testfenster — Absage-Prüfung übersprungen)");
  }

  // Fenster für die restlichen Prüfungen öffnen.
  await setzeEinstellung("abo_fenster_start", "0");
  await setzeEinstellung("abo_fenster_ende", "24");

  // ── 2. Vorschau je Ansicht ────────────────────────────────────────────────
  console.log("\n── 2. Vorschau kennt die geöffnete Ansicht ──");
  const arten = ["heute", "woche", "ueberfaellig", "offen", "zustellfehler"] as const;
  const vor: Record<string, any> = {};
  for (const art of arten) {
    const v = await ruf(`/api/fiaon/admin/abo/lauf/vorschau?art=${art}`);
    vor[art] = v.body;
    pruefe(`Vorschau „${art}“ antwortet mit Zahlen`,
      v.status === 200 && typeof v.body?.gefunden === "number" && typeof v.body?.sendbar === "number",
      JSON.stringify(v.body).slice(0, 120));
  }
  pruefe("„Heute“ und „Nächste 7 Tage“ sind verschiedene Mengen",
    vor.heute.gefunden !== vor.woche.gefunden || vor.heute.gefunden === 0,
    `heute ${vor.heute.gefunden} · woche ${vor.woche.gefunden}`);
  pruefe("„Nächste 7 Tage“ ist als Vorabinfo gekennzeichnet", vor.woche.alsVorabinfo === true);
  pruefe("„Heute“ ist KEINE Vorabinfo (dort steigt die Mahnstufe)", vor.heute.alsVorabinfo === false);
  pruefe("Vorschau weist die 20-Stunden-Sperre aus",
    typeof vor.heute.uebersprungen?.gesperrt === "number");

  // ── 3. Der Lauf wirkt auf die gewählte Ansicht ────────────────────────────
  // MAKE_WEBHOOK_URL ist leer ⇒ jeder Versand scheitert ehrlich. Genau das
  // prüfen wir: Die Mahnstufe darf NICHT steigen, und der Fehlgrund muss an der
  // Rate stehen. Es geht dabei keine einzige Mail an einen Kunden.
  console.log("\n── 3. Lauf auf „Heute“ (ohne Make-URL: darf nichts stillschweigend tun) ──");
  // Berliner Tagesgrenze: Postgres' CURRENT_DATE rechnet in UTC und liegt
  // zwischen 00:00 und 02:00 Berliner Zeit einen Tag zurück — der Test hätte
  // dann eine leere Menge geprüft und wäre grundlos rot geworden.
  const berlinHeute = (() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d.toISOString().slice(0, 10); })();
  const vorher = await sqlPool`
    SELECT id, mahnstufe, erinnerungen, letzte_erinnerung_at FROM fiaon_abo_raten
    WHERE status = 'offen' AND faellig_am = ${berlinHeute}::date ORDER BY id
  `;
  pruefe("Prüfmenge ist nicht leer (sonst prüft der Test nichts)", vorher.length > 0, `Raten heute fällig: ${vorher.length}`);
  const lauf = await ruf("/api/fiaon/admin/abo/lauf", { method: "POST", body: JSON.stringify({ art: "heute" }) });
  pruefe("Lauf antwortet mit einer verständlichen Meldung",
    lauf.status === 200 && typeof lauf.body?.meldung === "string" && lauf.body.meldung.length > 10,
    JSON.stringify(lauf.body).slice(0, 160));
  const ohneUrl = !process.env.MAKE_WEBHOOK_URL;
  if (ohneUrl) {
    pruefe("Ohne Make-URL wird NICHT „gesendet“ gemeldet",
      lauf.body?.gesendet === 0 && lauf.body?.fehlgeschlagen === vor.heute.sendbar,
      `gesendet ${lauf.body?.gesendet} · fehlgeschlagen ${lauf.body?.fehlgeschlagen} · erwartet fehlgeschlagen ${vor.heute.sendbar}`);
    pruefe("Der Grund steht in der Antwort",
      Array.isArray(lauf.body?.fehlerGruende) && lauf.body.fehlerGruende.length > 0,
      JSON.stringify(lauf.body?.fehlerGruende));
    const nachher = await sqlPool`
      SELECT id, mahnstufe, letzter_fehler, fehlversuche, letzte_erinnerung_at FROM fiaon_abo_raten
      WHERE id = ANY(${vorher.map((r: any) => r.id)}) ORDER BY id
    `;
    const stufenGleich = vorher.every((v: any, i: number) => Number(nachher[i].mahnstufe) === Number(v.mahnstufe));
    pruefe("Mahnstufe bleibt bei Fehlschlag unverändert", stufenGleich);
    pruefe("Fehlgrund steht an der Rate",
      nachher.filter((n: any) => n.letzter_fehler).length > 0);
    pruefe("20-Stunden-Sperre wird NICHT gesetzt (erneuter Versuch bleibt möglich)",
      vorher.every((v: any, i: number) =>
        String(nachher[i].letzte_erinnerung_at || "") === String(v.letzte_erinnerung_at || "")));
    // Fehlerspuren dieser Prüfung entfernen — sie sind keine echten Zustellfehler.
    await sqlPool`
      UPDATE fiaon_abo_raten SET letzter_fehler = NULL, letzter_fehler_at = NULL, fehlversuche = 0
      WHERE id = ANY(${vorher.map((r: any) => r.id)})
    `;
  } else {
    console.log("  ⚠ MAKE_WEBHOOK_URL ist gesetzt — Sendeprüfung übersprungen (es sollen keine echten Mails rausgehen).");
  }

  // ── 4. Unbekannte Ansicht wird abgelehnt ──────────────────────────────────
  const quatsch = await ruf("/api/fiaon/admin/abo/lauf", { method: "POST", body: JSON.stringify({ art: "irgendwas" }) });
  pruefe("Unbekannte Ansicht wird abgelehnt", quatsch.status === 400, `HTTP ${quatsch.status}`);

  // ── 5. Ratenketten entstehen von selbst ───────────────────────────────────
  console.log("\n── 5. Ketten ohne Knopf ──");
  // Beweis statt Behauptung: Bei einem Kunden wird die offene Rate ENTFERNT und
  // muss durch das Öffnen der Tafel von selbst zurückkommen — mit identischen
  // Werten. Gewählt wird bewusst eine Rate ohne Erinnerungs-Historie, damit
  // beim Wiederanlegen nichts verloren gehen kann.
  const [opfer] = await sqlPool`
    SELECT r.id, r.ref, r.rate_nr, r.zahlungsreferenz, r.betrag_cents, r.faellig_am, r.quelle, r.notiz
    FROM fiaon_abo_raten r
    JOIN fiaon_applications a ON a.ref = r.ref AND a.merged_into IS NULL
    WHERE r.status = 'offen' AND r.mahnstufe = 0 AND r.erinnerungen = 0 AND r.letzter_fehler IS NULL
      AND a.payment_status = 'paid'
    ORDER BY r.faellig_am DESC LIMIT 1
  `;
  let heilung: any = null;
  if (opfer) {
    await sqlPool`DELETE FROM fiaon_abo_raten WHERE id = ${opfer.id}`;
    const [weg] = await sqlPool`SELECT COUNT(*)::int AS c FROM fiaon_abo_raten WHERE ref = ${opfer.ref} AND rate_nr > 1`;
    pruefe("Rate für den Test entfernt", Number(weg.c) === 0);
  }

  const [ohneKetteVorher] = await sqlPool`
    SELECT COUNT(*)::int AS c FROM fiaon_applications a
    WHERE a.payment_status = 'paid' AND a.merged_into IS NULL AND a.abo_gestoppt_am IS NULL
      AND a.completed_at IS NOT NULL AND a.payment_reference IS NOT NULL
      AND a.type <> 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
      AND NOT EXISTS (SELECT 1 FROM fiaon_abo_raten r WHERE r.ref = a.ref AND r.rate_nr > 1)
  `;
  // Die Tafel aufrufen — das allein muss die Ketten anlegen.
  const uebersicht = await ruf("/api/fiaon/admin/abo/uebersicht");
  if (opfer) {
    const [zurueckGekommen] = await sqlPool`
      SELECT rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status
      FROM fiaon_abo_raten WHERE ref = ${opfer.ref} AND rate_nr > 1 ORDER BY rate_nr DESC LIMIT 1
    `;
    heilung = zurueckGekommen;
    pruefe("Entfernte Rate ist nach dem Öffnen der Tafel wieder da",
      !!zurueckGekommen, "keine Rate wiederhergestellt");
    pruefe("Wiederhergestellte Rate hat dieselbe Referenz und denselben Betrag",
      zurueckGekommen?.zahlungsreferenz === opfer.zahlungsreferenz
      && Number(zurueckGekommen?.betrag_cents) === Number(opfer.betrag_cents),
      `${zurueckGekommen?.zahlungsreferenz} / ${zurueckGekommen?.betrag_cents} statt ${opfer.zahlungsreferenz} / ${opfer.betrag_cents}`);
  }
  const [ohneKetteNachher] = await sqlPool`
    SELECT COUNT(*)::int AS c FROM fiaon_applications a
    WHERE a.payment_status = 'paid' AND a.merged_into IS NULL AND a.abo_gestoppt_am IS NULL
      AND a.completed_at IS NOT NULL AND a.payment_reference IS NOT NULL
      AND a.type <> 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
      AND NOT EXISTS (SELECT 1 FROM fiaon_abo_raten r WHERE r.ref = a.ref AND r.rate_nr > 1)
  `;
  console.log(`  ohne Kette: ${ohneKetteVorher.c} → ${ohneKetteNachher.c}`);
  pruefe("Das Öffnen der Tafel legt fehlende Ketten an", Number(ohneKetteNachher.c) === 0,
    `noch ohne Kette: ${ohneKetteNachher.c}`);
  pruefe("Bonitäts-Checks bekommen weiterhin KEINE Kette",
    Number((await sqlPool`
      SELECT COUNT(*)::int AS c FROM fiaon_abo_raten r
      JOIN fiaon_applications a ON a.ref = r.ref
      WHERE a.type = 'schufa' OR a.ref LIKE 'FIAON-SCHUFA-%'
    `)[0].c) === 0);
  pruefe("Neu angelegte Fälligkeiten liegen in der Zukunft (kein Rückwirkend-Mahnen)",
    Number((await sqlPool`
      SELECT COUNT(*)::int AS c FROM fiaon_abo_raten
      WHERE quelle = 'nachgezogen' AND status = 'offen' AND faellig_am < CURRENT_DATE
    `)[0].c) === 0);
  pruefe("Übersicht zählt die neuen Abos mit",
    Number(uebersicht.body?.laufend?.abos || 0) >= Number(ohneKetteVorher.c));

  // ── Aufräumen ─────────────────────────────────────────────────────────────
  await setzeEinstellung("abo_fenster_start", alteEinst?.start ?? null);
  await setzeEinstellung("abo_fenster_ende", alteEinst?.ende ?? null);
  console.log("\n── Aufräumen ──");
  const [kontrolle] = await sqlPool`
    SELECT (SELECT value FROM fiaon_settings WHERE key = 'abo_fenster_start') AS start,
           (SELECT value FROM fiaon_settings WHERE key = 'abo_fenster_ende') AS ende
  `;
  pruefe("Versandfenster ist wieder im Ausgangszustand",
    String(kontrolle?.start ?? "") === String(alteEinst?.start ?? "")
    && String(kontrolle?.ende ?? "") === String(alteEinst?.ende ?? ""),
    `${kontrolle?.start}/${kontrolle?.ende}`);

  // Die künstlichen Zustellfehler dieser Prüfung entfernen — sonst stünde in der
  // Zahlungszentrale „5× nicht zugestellt", obwohl kein echter Kunde betroffen war.
  const [aufgeraeumt] = await sqlPool`
    WITH weg AS (
      UPDATE fiaon_abo_raten
      SET letzter_fehler = NULL, letzter_fehler_at = NULL, fehlversuche = 0
      WHERE letzter_fehler LIKE '%MAKE_WEBHOOK_URL%' RETURNING 1
    ) SELECT COUNT(*)::int AS c FROM weg
  `;
  pruefe("Künstliche Zustellfehler der Prüfung entfernt",
    Number((await sqlPool`SELECT COUNT(*)::int c FROM fiaon_abo_raten WHERE letzter_fehler LIKE '%MAKE_WEBHOOK_URL%'`)[0].c) === 0,
    `bereinigt: ${aufgeraeumt.c}`);

  console.log(rot === 0 ? "\nAlles grün." : `\n${rot} Prüfung(en) rot.`);
  await sqlPool.end();
  process.exit(rot === 0 ? 0 : 1);
})().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
