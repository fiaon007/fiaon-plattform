// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: ALS-KUNDE-ANSICHT, TERMIN-KLARHEIT, ZWEIG-PFLEGE
//
// ── DER KERN IST DIE SCHREIBROUTEN-MATRIX ──────────────────────────────────
// Die Als-Kunde-Ansicht setzt jemanden in ein fremdes Konto. Wenn EINE
// schreibende Route durchkommt, kann der Betreiber im Namen des Kunden
// bestellen, melden, hochladen oder kündigen — und niemand kann hinterher
// sagen, dass der Kunde es nicht selbst war.
//
// Deshalb wird nicht geprüft, ob die Wand im Quelltext steht, sondern ob sie
// HÄLT: Der Prüfstand geht mit einem echten Ansichts-Cookie gegen die
// gefährlichsten Schreibrouten des Kundenportals und verlangt bei jeder 403.
//
// ── ES ENTSTEHT DABEI NICHTS ───────────────────────────────────────────────
// Genau das ist der Punkt: Wenn die Wand hält, wird jede Anfrage abgelehnt,
// BEVOR sie etwas tut. Sollte eine durchkommen, ist das der Fehler, den dieser
// Prüfstand finden soll — und er wählt dafür Nutzlasten, die auch bei einem
// Durchkommen nichts Bleibendes anrichten (fremde Kennungen, leere Felder).
//
//   npx tsx scripts/pruef-kundenansicht.ts        (Server auf 5188)
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

const BASIS = process.env.PRUEF_BASIS ?? "http://localhost:5188";

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
  titel("TEIL 1 — DAS TOKEN");
  // ═════════════════════════════════════════════════════════════════════════
  const ka = await import("../server/lib/fiaon-kundenansicht");

  const echt = ka.kundenansichtTokenBauen(4711, "FIAON-TEST-1", "admin", 0);
  const gelesen = ka.kundenansichtTokenPruefen(echt);
  pruef("Ein gültiges Token wird gelesen", gelesen?.personId === 4711 && gelesen?.ref === "FIAON-TEST-1");
  pruef("Die Art fährt mit", gelesen?.art === "admin");

  // ── DIE SIGNATUR ───────────────────────────────────────────────────────
  const teile = echt.split(".");
  pruef("Ein verändertes Token wird abgelehnt (Person)",
    ka.kundenansichtTokenPruefen(`9999.${teile.slice(1).join(".")}`) === null,
    "sonst könnte man durch Hochzählen in fremde Konten sehen");
  pruef("Ein verändertes Token wird abgelehnt (Bestellung)",
    ka.kundenansichtTokenPruefen([teile[0], "FIAON-FREMD", ...teile.slice(2)].join(".")) === null);
  pruef("Ein verändertes Token wird abgelehnt (Ablauf)",
    ka.kundenansichtTokenPruefen([...teile.slice(0, 4), String(Date.now() + 9e9), teile[5]].join(".")) === null,
    "sonst ließe sich die Gültigkeit verlängern");
  pruef("Eine gefälschte Signatur wird abgelehnt",
    ka.kundenansichtTokenPruefen([...teile.slice(0, 5), "0".repeat(32)].join(".")) === null);
  pruef("Müll wird abgelehnt", ka.kundenansichtTokenPruefen("abc") === null
    && ka.kundenansichtTokenPruefen(undefined) === null);

  // ── DER ABLAUF ─────────────────────────────────────────────────────────
  // Nicht warten, sondern ein Token mit vergangenem Ablauf SIGNIEREN — sonst
  // dauerte der Prüfstand dreißig Minuten. Dafür wird die Signatur über
  // dieselbe Funktion gebildet, die der Server nutzt.
  const { createHmac } = await import("node:crypto");
  const geheim = process.env.SESSION_SECRET || process.env.ADMIN_ACCESS_CODE || "fiaon-kundenansicht";
  const abgelaufenKern = `4711.FIAON-TEST-1.admin.0.${Date.now() - 60_000}`;
  const abgelaufen = `${abgelaufenKern}.${createHmac("sha256", geheim).update(abgelaufenKern).digest("hex").slice(0, 32)}`;
  pruef("Ein abgelaufenes Token wird abgelehnt — trotz gültiger Signatur",
    ka.kundenansichtTokenPruefen(abgelaufen) === null,
    "die halbe Stunde ist die Grenze, nicht ein Vorschlag");
  pruef("Die Gültigkeit beträgt 30 Minuten", ka.KUNDENANSICHT_MINUTEN === 30);

  // ═════════════════════════════════════════════════════════════════════════
  titel("TEIL 1 — DIE RECHTE");
  // ═════════════════════════════════════════════════════════════════════════
  pruef("Die Verwaltung darf jedes Konto",
    (await ka.darfAnsehen("admin", 0, 999999)).erlaubt);

  // Ein Agent OHNE Leitungsrolle darf nie.
  const [agent] = (await sqlPool`
    SELECT id, name FROM fiaon_agents
    WHERE active AND COALESCE(rolle, 'agent') = 'agent' AND NOT COALESCE(is_test_account, FALSE)
    LIMIT 1
  `) as any[];
  if (agent) {
    const r = await ka.darfAnsehen("leitung", Number(agent.id), 1);
    pruef("Ein Agent ohne Leitungsrolle darf NICHT", !r.erlaubt, r.grund);
    pruef("Und er erfährt, warum", /Leitung|Liste/i.test(r.grund),
      "„Keine Berechtigung\u201c bringt niemanden weiter");
  } else pruef("Ein Agent ohne Leitungsrolle darf NICHT", false, "kein Prüffall gefunden");

  // Eine Leitung darf ihre eigenen — und fremde nicht.
  const [leitung] = (await sqlPool`
    SELECT ag.id, ag.name,
           (SELECT p.id FROM fiaon_persons p
             WHERE p.assigned_agent_id = ag.id AND p.merged_into_person_id IS NULL LIMIT 1) AS eigener
    FROM fiaon_agents ag
    WHERE ag.active AND ag.rolle = 'vertriebsleiter' AND NOT COALESCE(ag.is_test_account, FALSE)
      AND EXISTS (SELECT 1 FROM fiaon_persons p2 WHERE p2.assigned_agent_id = ag.id)
    LIMIT 1
  `) as any[];
  if (leitung?.eigener) {
    pruef("Eine Leitung darf ihren eigenen Kunden",
      (await ka.darfAnsehen("leitung", Number(leitung.id), Number(leitung.eigener))).erlaubt);
    // Ein Kunde, der NICHT dieser Leitung gehört und auch nicht ihren Geworbenen.
    const [fremd] = (await sqlPool`
      SELECT p.id FROM fiaon_persons p
      WHERE p.merged_into_person_id IS NULL
        AND (p.assigned_agent_id IS NULL OR (
          p.assigned_agent_id <> ${leitung.id}
          AND p.assigned_agent_id NOT IN (SELECT id FROM fiaon_agents WHERE recruited_by = ${leitung.id})))
      LIMIT 1
    `) as any[];
    if (fremd) {
      const r = await ka.darfAnsehen("leitung", Number(leitung.id), Number(fremd.id));
      pruef("Eine Leitung darf einen FREMDEN Kunden NICHT", !r.erlaubt, r.grund);
    } else pruef("Eine Leitung darf einen FREMDEN Kunden NICHT", false, "kein Prüffall");
  } else {
    pruef("Eine Leitung darf ihren eigenen Kunden", false, "keine Leitung mit Kunden gefunden");
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("TEIL 1 — DIE SCHREIBROUTEN-MATRIX (der Kern)");
  // ═════════════════════════════════════════════════════════════════════════
  // Ein echtes Ansichts-Cookie bauen. Es zeigt auf eine erfundene Person und
  // eine erfundene Bestellung: Selbst wenn eine Route durchkäme, träfe sie
  // niemanden — und der Prüfstand meldet den Durchbruch trotzdem.
  const cookieToken = ka.kundenansichtTokenBauen(999_999, "FIAON-PRUEFSTAND", "admin", 0);
  const kopf = { Cookie: `${ka.KUNDENANSICHT_COOKIE}=${cookieToken}`, "Content-Type": "application/json" };

  // Die gefährlichsten Schreibwege des Kundenportals. Jeder bewegt Geld, Recht
  // oder Daten des Menschen.
  // Siehe die Begründung weiter unten bei der Aufräum-Regel: Die Adresse ist
  // eindeutig und nach RFC 2606 garantiert niemandem zugeordnet.
  const PRUEF_ADRESSE_VOR = "pruefstand-kundenansicht@example.invalid";
  const matrix: { was: string; pfad: string; methode?: string; leib?: unknown }[] = [
    { was: "Bonitätsauskunft bestellen (74 €)", pfad: "/api/fiaon/payment-order",
      leib: { kind: "schufa", email: PRUEF_ADRESSE_VOR } },
    { was: "„Ich habe überwiesen“ melden", pfad: "/api/fiaon/payment-order/FIAON-PRUEFSTAND/claim-paid" },
    { was: "Telefonnummer ändern", pfad: "/api/fiaon/number-update/erfundenes-token",
      leib: { phone: "01701234567" } },
    { was: "Startgespräch buchen", pfad: "/api/fiaon/termin/erfundenes-token/buchen",
      leib: { beginn: new Date().toISOString(), agentId: 1 } },
    { was: "Startgespräch „später“", pfad: "/api/fiaon/startgespraech/FIAON-PRUEFSTAND/spaeter" },
    { was: "Termin absagen", pfad: "/api/fiaon/termin/absagen/erfundenes-token" },
    { was: "Anmelden (fremdes Konto)", pfad: "/api/fiaon/login",
      leib: { email: PRUEF_ADRESSE_VOR, password: "x" } },
    { was: "Antrag abschicken", pfad: "/api/fiaon/applications", leib: {} },
    { was: "Von der Lead-Strecke abmelden", pfad: "/api/fiaon/abmelden/" + "z".repeat(36) },
    { was: "Zahlung als Verwaltung buchen", pfad: "/api/fiaon/admin/payments/FIAON-PRUEFSTAND/mark-paid" },
    { was: "Kunde löschen (Verwaltung)", pfad: "/api/fiaon/admin/kunden/FIAON-PRUEFSTAND/loeschen",
      methode: "DELETE" },
  ];

  // ══════════════════════════════════════════════════════════════════════
  // DIE ROT-PROBE HINTERLÄSST SPUREN — UND SIE MÜSSEN WEG
  //
  // ── WAS AM 19.08.2026 PASSIERT IST ──────────────────────────────────
  // Für die Rot-Probe wurde die Nur-Lesen-Wand absichtlich entfernt. Prompt
  // antwortete „Bonitätsauskunft bestellen (74 €)" mit HTTP 200 — der
  // Prüfstand hatte eine echte SCHUFA-Bestellzeile in der Produktions-
  // datenbank angelegt. Genau der Schaden, den die Wand verhindert; und der
  // Beweis, dass diese Matrix echte Wege prüft und keine erfundenen.
  //
  // ── DIE LEHRE ───────────────────────────────────────────────────────
  // Ein Prüfstand, der eine Sicherheitswand testet, MUSS damit rechnen, dass
  // sie fällt. Sonst räumt er im Erfolgsfall nichts auf (weil nichts entsteht)
  // und im Fehlerfall auch nicht (weil er es nicht kann) — und der Fehlerfall
  // ist genau der, in dem etwas entsteht.
  //
  // Die Adresse ist deshalb eindeutig und ungültig (`.invalid` ist nach
  // RFC 2606 reserviert, es kann sie also niemandem gehören), und am Ende wird
  // aufgeräumt: archiviert, nicht gelöscht (AGENTS.md).
  // ══════════════════════════════════════════════════════════════════════
  let durchbrueche = 0;
  for (const m of matrix) {
    const r = await fetch(`${BASIS}${m.pfad}`, {
      method: m.methode ?? "POST", headers: kopf,
      body: m.methode === "DELETE" ? undefined : JSON.stringify(m.leib ?? {}),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    const gewehrt = r?.status === 403 && j?.code === "NUR_ANSICHT";
    if (!gewehrt) durchbrueche++;
    pruef(`Abgewehrt: ${m.was}`, gewehrt,
      `HTTP ${r?.status} · ${String(j?.code ?? j?.error ?? "").slice(0, 70)}`);
  }
  pruef("KEIN Durchbruch in der ganzen Matrix", durchbrueche === 0,
    `${durchbrueche} von ${matrix.length} Routen waren erreichbar`);

  // ── AUFRÄUMEN, FALLS DIE WAND GEFALLEN IST ──────────────────────────────
  // Läuft immer, nicht nur bei Durchbrüchen: Ein Prüfstand, der nur im
  // Fehlerfall aufräumt, räumt nie auf, weil man den Fehlerfall nicht plant.
  const spuren = (await sqlPool`
    UPDATE fiaon_applications
    SET archived_at = NOW(),
        admin_note = COALESCE(admin_note || E'\n', '') ||
          'Vom Kundenansicht-Prüfstand erzeugt, als die Nur-Lesen-Wand offen war. Kein echter Kunde. Archiviert statt gelöscht.'
    WHERE email = ${PRUEF_ADRESSE_VOR} AND archived_at IS NULL
    RETURNING ref
  `) as any[];
  if (spuren.length > 0) {
    console.log(`\n        AUFGERÄUMT: ${spuren.length} Zeile(n) archiviert, die durch offene Wand entstanden:`);
    for (const z of spuren) console.log(`          ${z.ref}`);
  }

  // Lesen muss weiter gehen — sonst wäre die Ansicht wertlos.
  const lesen = await fetch(`${BASIS}/api/fiaon/kundenansicht/stand`, { headers: kopf })
    .then((r) => r.status).catch(() => 0);
  pruef("Lesen bleibt erlaubt", lesen === 200, `HTTP ${lesen}`);

  // Und das Beenden muss durchkommen, obwohl es ein POST ist.
  const beenden = await fetch(`${BASIS}/api/fiaon/kundenansicht/beenden`, {
    method: "POST", headers: kopf,
  }).then((r) => r.status).catch(() => 0);
  pruef("Beenden kommt durch die Wand", beenden === 200,
    `HTTP ${beenden} — sonst käme man nicht mehr heraus`);

  // ── DIE BINDUNG AN DEN ANSEHENDEN ──────────────────────────────────────
  // Ein Kundenansichts-Cookie OHNE Verwaltungszugang darf nichts zeigen.
  const ohneCode = await fetch(`${BASIS}/api/fiaon/kundenansicht/stand`, {
    headers: { Cookie: `${ka.KUNDENANSICHT_COOKIE}=${cookieToken}` },
  }).then((r) => r.json()).catch(() => null);
  pruef("Ohne Verwaltungszugang zeigt die Ansicht nichts", ohneCode?.aktiv === false,
    "ein weitergegebenes Cookie wäre sonst ein Dauerzugang in ein fremdes Konto");

  // ── EINE WAND, NICHT ZWEI ──────────────────────────────────────────────
  const routen = lies("server/routes.ts");
  pruef("Die Wand ist EINE Middleware für beide Ansichten",
    /nurLesenWand/.test(routen) && !/ansichtNurLesen/.test(routen),
    "zwei Middlewares für dasselbe gehen auseinander");
  const wand = lies("server/lib/fiaon-kundenansicht.ts");
  pruef("Sie prüft nach der METHODE, nicht nach einer Routenliste",
    /req\.method === "GET"/.test(wand),
    "eine Liste müsste gepflegt werden, und genau eine würde vergessen");

  // ── DAS PROTOKOLL ──────────────────────────────────────────────────────
  await sqlPool.begin(async (tx: any) => {
    const [a] = (await tx`
      SELECT a.ref, a.person_id FROM fiaon_applications a
      WHERE a.person_id IS NOT NULL AND a.merged_into IS NULL LIMIT 1
    `) as any[];
    await ka.kundenansichtProtokoll({
      ref: String(a.ref), personId: Number(a.person_id), art: "admin",
      ansehenderId: 0, name: "Prüfstand",
    }, "gestartet", tx);
    const [eintrag] = (await tx`
      SELECT note FROM fiaon_contact_log
      WHERE ref = ${a.ref} AND type = 'system' AND note LIKE '%Portal-Ansicht GESTARTET%'
      ORDER BY id DESC LIMIT 1
    `) as any[];
    pruef("Der Start steht im Kundenverlauf", !!eintrag,
      "die Frage lautet später „wer hat in mein Konto gesehen?“");
    pruef("Der Eintrag sagt, dass nichts entstehen kann",
      /keine Aktionen im Namen des Kunden/.test(String(eintrag?.note ?? "")));
    throw new Error("ROLLBACK");
  }).catch((e: any) => { if (e.message !== "ROLLBACK") throw e; });

  // ── DER BANNER UND DIE SCHLEUSE ────────────────────────────────────────
  pruef("Der Banner steht über dem GANZEN Portal",
    /<KundenansichtBanner \/>/.test(lies("client/src/App.tsx")),
    "in dashboard.tsx allein wäre er auf jeder Unterseite weg");
  const banner = lies("client/src/components/KundenansichtBanner.tsx");
  pruef("Er ist nicht wegklickbar", !/schliessen|onClose|setVersteckt/i.test(banner));
  pruef("Er trägt Namen und Restzeit",
    /Du siehst das Portal als \{stand\.name\}/.test(banner) && /noch \$\{m\} Min/.test(banner));
  pruef("Beenden räumt AUCH die Kunden-Anmeldung",
    /removeItem\("fiaon_user"\)/.test(banner),
    "sonst bliebe der Betreiber im fremden Portal, nur ohne Banner");
  pruef("Die Schleuse setzt die Kundendaten in der Login-Form",
    /setItem\("fiaon_user"/.test(lies("client/src/pages/als-kunde.tsx")));
  pruef("Die Schleuse ist verdrahtet",
    /path="\/als-kunde"/.test(lies("client/src/App.tsx")));

  // ── DIE KNÖPFE (ein Mensch muss sie finden) ────────────────────────────
  pruef("Knopf in der Kundenakte",
    /Portal ansehen/.test(lies("client/src/pages/admin-kunde.tsx")));
  pruef("Knopf in der Leitungs-Schublade",
    /Portal ansehen/.test(lies("client/src/pages/agent/vertrieb.tsx")));
  pruef("Beide öffnen einen NEUEN Tab",
    (lies("client/src/pages/admin-kunde.tsx").match(/window\.open\("\/als-kunde"/g) || []).length === 1
      && (lies("client/src/pages/agent/vertrieb.tsx").match(/window\.open\("\/als-kunde"/g) || []).length === 1,
    "sonst verliert der Betreiber die Akte, auf der er arbeitet");

  // ═════════════════════════════════════════════════════════════════════════
  titel("TEIL 2 — TERMIN-KLARHEIT „WIR RUFEN AN“");
  // ═════════════════════════════════════════════════════════════════════════
  const tt = await import("../shared/fiaon-termin-text");
  pruef("Der Satz nennt den Anruf", /ruft dich .*an/.test(tt.anrufHinweis("Anna")));
  pruef("Er nennt die Handlung", /halte dein Telefon bereit/.test(tt.anrufHinweis("Anna")));
  pruef("Ohne Namen kein leerer Platz",
    tt.anrufHinweis(null).startsWith("Dein Ansprechpartner"),
    "„ ruft dich an“ liest sich wie ein Fehler");
  pruef("Keine Meeting-Erwartung im Satz",
    tt.erwartungsHygiene(`${tt.anrufHinweis("Anna")} ${tt.ABSAGE_HINWEIS}`).length === 0);

  const seiten: [string, string][] = [
    ["Buchungsseite", "client/src/pages/termin.tsx"],
    ["Startgespräch-Tafel", "client/src/components/StartgespraechGate.tsx"],
  ];
  for (const [name, pfad] of seiten) {
    const q = lies(pfad);
    pruef(`${name}: nutzt den EINEN Satz`, /anrufHinweis\(/.test(q),
      "eine eigene Fassung würde von der Mail abweichen");
    pruef(`${name}: keine Meeting-Wörter`,
      tt.erwartungsHygiene(q.replace(/VERBOTENE_WORTE|erwartungsHygiene/g, "")).length === 0,
      tt.erwartungsHygiene(q).join(", "));
  }
  pruef("Die Bestätigungsansicht nennt auch die Absage",
    /ABSAGE_HINWEIS/.test(lies("client/src/pages/termin.tsx")),
    "ein Termin, den man nicht absagen kann, wird verpasst statt abgesagt");

  // Die Payloads.
  for (const [name, pfad] of [
    ["termin_bestaetigung", "server/routes/fiaon-termin.ts"],
    ["termin_erinnerung", "server/routes/fiaon-followup.ts"],
  ] as [string, string][]) {
    pruef(`${name}: hinweis_anruf fährt mit`, /hinweis_anruf: anrufHinweis\(/.test(lies(pfad)),
      "der Betreiber soll ihn in Brevo nur einsetzen müssen");
  }
  const reg = lies("server/make-events-registry.ts");
  pruef("Die Variable steht in der Ereignisliste",
    (reg.match(/hinweis_anruf/g) || []).length >= 2,
    "sonst weiß der Betreiber nicht, dass es sie gibt");
  pruef("Die Beschreibung nennt {{params.hinweis_anruf}}",
    /params\.hinweis_anruf/.test(reg));

  // Der Cockpit-Kopf.
  const cockpit = lies("client/src/components/agent/OnboardingCockpit.tsx");
  pruef("Die Nummer steht GROSS im Cockpit-Kopf",
    /fi-ob-nummer\b/.test(cockpit) && /font-size:19px/.test(cockpit),
    "sie wird zur Terminzeit abgelesen und abgetippt");
  pruef("Sie ist gruppiert", /function nummerGruppiert/.test(cockpit));
  pruef("Anrufen-Knopf direkt daneben", /fi-ob-nummer-knopf/.test(cockpit));
  pruef("Fehlende Nummer wird als Problem benannt",
    /Keine Telefonnummer hinterlegt/.test(cockpit),
    "ein Gespräch ohne Nummer kann nicht stattfinden");

  // Gruppierung an echten Nummern.
  const { default: reactFrei } = { default: null } as any;
  void reactFrei;
  const gruppen = /function nummerGruppiert[\s\S]*?\n}/.exec(cockpit)?.[0] ?? "";
  pruef("Unbekannte Formate bleiben unverändert", /return nummer;/.test(gruppen),
    "eine falsch gruppierte Nummer ist schlimmer als eine ungruppierte");

  // ═════════════════════════════════════════════════════════════════════════
  titel("TEIL 3 — DER ZWEIG PFLEGT SICH SELBST");
  // ═════════════════════════════════════════════════════════════════════════
  const zu = await import("../server/lib/fiaon-zustellung");
  pruef("Es gibt eine Liste beweisender Zustände", Array.isArray(zu.ZUSTELLUNG_BEWEIST_ZWEIG as any));
  pruef("„zugestellt“ beweist den Zweig",
    (zu.ZUSTELLUNG_BEWEIST_ZWEIG as readonly string[]).includes("zugestellt"));
  pruef("„angenommen“ beweist ihn NICHT",
    !(zu.ZUSTELLUNG_BEWEIST_ZWEIG as readonly string[]).includes("angenommen"),
    "angenommen heißt nur: Brevo hat sie entgegengenommen — sie kann noch bouncen");
  const zq = lies("server/lib/fiaon-zustellung.ts");
  pruef("Der Abgleich lädt das Ereignis mit", /SELECT id, event, empfaenger/.test(zq),
    "ohne das Ereignis lässt sich kein Zweig zuordnen");
  pruef("Er ruft die EINE Speicherfunktion", /verifikationSpeichern\(/.test(zq),
    "eine zweite Schreibstelle für denselben Status wäre die zweite Wahrheit");
  pruef("Ein Fehler dort hält den Abgleich nicht an", /Zweig-Pflege:/.test(zq));

  // Und es wirkt wirklich: in einer zurückgerollten Transaktion.
  await sqlPool.begin(async (tx: any) => {
    const { verifikationSpeichern, mailEvent } = await import("../server/lib/fiaon-mail-events");
    const vorher = await mailEvent("welcome", tx);
    await verifikationSpeichern("welcome", true, "Prüfstand", tx);
    const nachher = await mailEvent("welcome", tx);
    pruef("Ein Zustell-Treffer setzt den Status auf „bestätigt“",
      nachher?.verifikation === "bestaetigt",
      `vorher ${vorher?.verifikation}, nachher ${nachher?.verifikation}`);
    throw new Error("ROLLBACK");
  }).catch((e: any) => { if (e.message !== "ROLLBACK") throw e; });

  // Die ehrliche Zahl: Läuft der Abgleich überhaupt?
  const [abg] = (await sqlPool`
    SELECT COUNT(*)::int AS gesamt,
           COUNT(*) FILTER (WHERE abgeglichen_am IS NOT NULL)::int AS abgeglichen
    FROM fiaon_mail_log WHERE created_at > NOW() - INTERVAL '30 days'
  `) as any[];
  console.log(`\n        MESSUNG: ${abg.gesamt} Mails in 30 Tagen, ${abg.abgeglichen} abgeglichen.`);
  if (Number(abg.abgeglichen) === 0) {
    console.log("        Der Zustell-Abgleich braucht BREVO_API_KEY. Ohne ihn kann sich");
    console.log("        die Ampel nicht selbst pflegen — die Verdrahtung steht, das Tor ist zu.");
    console.log("        → Betreiber-TODO im Report.");
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("TEIL 4 — KLEINIGKEITEN");
  // ═════════════════════════════════════════════════════════════════════════
  pruef("Der veraltete Zweig sagt, dass er weg kann",
    /kann gelöscht werden — wird nie mehr gefeuert/.test(lies("client/src/pages/admin-events.tsx")));
  pruef("Und die Beschreibung nennt die Messung",
    /null Versände/.test(reg), "„VERALTET“ allein lässt den Betreiber rätseln");
  const [f48] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE event = 'followup_48h'
  `) as any[];
  pruef("followup_48h wurde wirklich nie gefeuert", Number(f48.n) === 0,
    `${f48.n} Versände — dann ist die Aussage falsch und muss weg`);

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
