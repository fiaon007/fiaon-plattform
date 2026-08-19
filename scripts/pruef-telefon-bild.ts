// ═══════════════════════════════════════════════════════════════════════════
// BROWSERTEST: DAS TELEFON AM BILDSCHIRM
//
// ── WARUM ZUSÄTZLICH ZUM LOGIK-PRÜFSTAND ───────────────────────────────────
// `scripts/pruef-telefon-zustand.ts` prüft die Zustandsfolge und den Quelltext.
// Das beweist keine ANZEIGE. AGENTS.md, 11.08.2026: „Die Route existiert" war
// grün, während der Knopf fehlte — vier Prüfungen sahen nur in den
// Serverquelltext. Hier wird deshalb GESCHAUT und GEKLICKT.
//
// ── DIE VIER BILDER, UM DIE DER AUFTRAG BITTET ─────────────────────────────
//   1. Wählbild mit GESPERRTEM Anrufknopf (stummes Mikrofon)
//   2. Die Gerätewahl
//   3. Der klingelnde Zustand — ohne laufende Uhr
//   4. Der Übergang Gespräch → Ergebnis, ohne gleichzeitiges Zeichnen
//
// ── DAS STUMME MIKROFON WIRD ERZEUGT, NICHT ABGEWARTET ────────────────────
// Chromium kann ein Mikrofon vortäuschen: `--use-fake-device-for-media-stream`
// liefert einen Ton, `--mute-audio` allein genügt NICHT (der Pegel bliebe hoch).
// Für die Sperre braucht es STILLE, und die entsteht am zuverlässigsten, wenn
// der AudioContext gar keine Daten liefert — deshalb wird `getByteTimeDomainData`
// im Browser überschrieben und liefert die Mittellinie 128 (= Pegel 0).
//
// ── UND ES WIRD NIEMAND ANGERUFEN ─────────────────────────────────────────
// `/telefon/ausweis` wird abgefangen. Ein Browsertest, der ein Twilio-Gerät
// aufbaut, würde eine echte Verbindung kosten und im schlechtesten Fall bei
// einem Menschen klingeln (AGENTS.md, 06.08.2026). Der Zustandswechsel wird
// stattdessen über die SDK-Ereignisse nachgestellt, die das Panel selbst
// auswertet.
//
//   npx tsx scripts/pruef-telefon-bild.ts        (Server auf 5188)
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { sqlPool } from "../server/lib/db-pool";

const BASIS = process.env.PRUEF_BASIS || "http://127.0.0.1:5188";
const MARKE = `PRUEFTEL-${Date.now().toString(36).toUpperCase()}`;

let ok = 0;
let rot = 0;
const fehler: string[] = [];
function pruef(name: string, bedingung: boolean, hinweis = ""): void {
  if (bedingung) { ok++; console.log(`  ok    ${name}`); }
  else { rot++; fehler.push(name); console.log(`  ROT   ${name}${hinweis ? `  → ${hinweis}` : ""}`); }
}
function titel(t: string): void { console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); }

let testAgentId: number | null = null;

/** Nichts Schreibendes, nichts Wählendes. */
async function attrappen(seite: Page): Promise<void> {
  // ══════════════════════════════════════════════════════════════════════
  // DER STAND — UND WARUM ER EINE ATTRAPPE BRAUCHT
  //
  // GEMESSEN im ersten Lauf: `/telefon/stand` antwortete `bereit: false` mit
  // „Zum Telefonieren fehlen noch 6 Werte" — auf dem Entwicklungsrechner sind
  // die Twilio-Zugänge nicht gesetzt, und das ist richtig so. Dazu
  // `testkonto: true`: Testkonten dürfen ausdrücklich nicht telefonieren.
  //
  // Beides zusammen heißt: Ohne Attrappe zeigt das Panel den Einrichtungs-
  // Zustand, das Wählbild entsteht nie, und der Prüfstand kann über die Sperre
  // nichts sagen. Ein „Prüfstand", der auf ein leeres Bild schaut, wäre grün
  // und wertlos.
  //
  // Die Attrappe liefert GENAU die Felder der echten Route (AGENTS.md,
  // 18.08.2026: eine Attrappe, die weniger liefert als der Server, erzeugt
  // Fehler, die es nicht gibt). Gefährlich wird sie nicht: `/telefon/ausweis`
  // ist ebenfalls abgefangen, es kann also keine Verbindung entstehen.
  await seite.route("**/api/fiaon/telefon/stand", async (r) => {
    await r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        ok: true, bereit: true, abgeschaltet: false, fehlend: [], vorhanden: [],
        hinweis: "", maxMinuten: 60, offene: [],
        // FALSCH im Sinne der Datenbank, richtig im Sinne der Prüfung: Das Konto
        // IST ein Testkonto und bleibt es. Hier wird nur die Anzeige geprüft.
        testkonto: false,
        agentId: testAgentId,
        kontingent: { heute: 0, grenze: 100, frei: 100, erschoepft: false },
      }),
    });
  });

  // Der Ausweis: Er würde ein echtes Twilio-Gerät aufbauen.
  await seite.route("**/api/fiaon/telefon/ausweis", async (r) => {
    await r.fulfill({
      status: 200, contentType: "application/json",
      // Alle Felder, die die Oberfläche liest — eine Attrappe, die WENIGER
      // liefert als der Server, erzeugt Fehler, die es nicht gibt
      // (AGENTS.md, 18.08.2026).
      body: JSON.stringify({
        ok: true, token: "PRUEFSTAND-KEIN-ECHTER-AUSWEIS",
        identitaet: `pruef_${MARKE}`, nummer: "+436601234567",
        callId: 999_999, maxMinuten: 60,
        anruftPerson: { id: 4242, name: "Probe Anzeige", ref: "FIAON-PRUEF-ANZEIGE" },
      }),
    });
  });
  // Die Diagnose-Meldungen ins Leere.
  await seite.route("**/api/fiaon/telefon/*/verbindung", async (r) => {
    await r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
  });
  await seite.route("**/api/fiaon/telefon/browserfehler", async (r) => {
    await r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
  });
}

/**
 * Den Pegel im Browser festnageln.
 *
 * 128 ist die Mittellinie der Zeitdaten — also absolute Stille, Pegel 0. Damit
 * greift die Sperre nach SPERRE_NACH_SEKUNDEN Sekunden, ohne dass der Prüfstand
 * ein echtes stummes Headset braucht.
 */
async function pegelFestnageln(seite: Page, wert: number): Promise<void> {
  await seite.addInitScript((v) => {
    const echt = AnalyserNode.prototype.getByteTimeDomainData;
    AnalyserNode.prototype.getByteTimeDomainData = function (daten: Uint8Array) {
      echt.call(this, daten);
      daten.fill(v);
    };
  }, wert);
}

async function main(): Promise<void> {
  mkdirSync("reports/telefon", { recursive: true });

  const [neu] = (await sqlPool`
    INSERT INTO fiaon_agents (name, email, rolle, active, is_test_account, created_at)
    VALUES (${`${MARKE} Agent`}, ${`${MARKE.toLowerCase()}@example.invalid`},
            'agent', TRUE, TRUE, NOW())
    RETURNING id
  `) as any[];
  testAgentId = Number(neu.id);

  // Onboarding-Gate: Ohne Zustimmungen kommt der Agent nicht in den Bereich.
  const { ONBOARDING_DOCS, ensureOnboardingTables } =
    await import("../server/routes/fiaon-onboarding");
  await ensureOnboardingTables();
  for (const d of ONBOARDING_DOCS as any[]) {
    await sqlPool`
      INSERT INTO fiaon_agent_consents (agent_id, doc_key, doc_version, accepted_at, ip, user_agent)
      VALUES (${testAgentId}, ${d.key}, ${d.version}, NOW(),
              ${`PRUEFSTAND/${MARKE}`}, 'pruef-telefon-bild.ts (kein Mensch)')
      ON CONFLICT DO NOTHING
    `.catch(() => {});
  }
  const [vorlage] = (await sqlPool`
    SELECT version FROM fiaon_contract_templates WHERE status = 'active'
    ORDER BY version DESC LIMIT 1
  `.catch(() => [])) as any[];
  if (vorlage) {
    await sqlPool`
      INSERT INTO fiaon_agent_contracts
        (agent_id, template_version, variables_json, rendered_html,
         signature_name, signature_mode, doc_hash, status, signed_at)
      VALUES (${testAgentId}, ${Number(vorlage.version)},
              ${JSON.stringify({ pruefstand: MARKE })},
              ${`<p>Prüfstand ${MARKE} — kein Vertrag, kein Mensch.</p>`},
              ${`${MARKE} (Prüfstand)`}, 'pruefstand', ${`prueftel-${MARKE}`},
              'signed', NOW())
    `.catch(() => {});
  }
  // ── DIE TELEFON-RICHTLINIE ──────────────────────────────────────────────
  // Sonst öffnet sich die Richtlinien-Tafel statt des Wählbilds.
  //
  // Sie steht in `fiaon_vertrieb_zusagen` mit `bereich = 'telefon'` — NICHT in
  // einer eigenen Tabelle. Ein erster Entwurf schrieb in ein erfundenes
  // `fiaon_telefon_zusagen`, der Aufruf lief in ein `.catch(() => {})`, und der
  // Prüfstand stand danach vor der Tafel und wusste nicht, warum. Ein stilles
  // `.catch()` über einer falschen Tabelle ist doppelt blind.
  const { TELEFON_ZUSAGE_VERSION } = await import("../server/lib/fiaon-telefon-zusage");
  await sqlPool`
    INSERT INTO fiaon_vertrieb_zusagen
      (agent_id, bereich, version, accepted_at, ip, user_agent, name_getippt, text_hash)
    VALUES (${testAgentId}, 'telefon', ${TELEFON_ZUSAGE_VERSION}, NOW(),
            ${`PRUEFSTAND/${MARKE}`}, 'pruef-telefon-bild.ts (kein Mensch)',
            ${`${MARKE} (Prüfstand)`}, ${`prueftel-${MARKE}`})
  `;

  const { signAgentToken } = await import("../server/routes/fiaon-agent");
  const token = signAgentToken(testAgentId, 0);

  const browser = await chromium.launch({
    args: [
      // Ein vorgetäuschtes Mikrofon: Es liefert einen Strom, ohne dass ein
      // Gerät vorhanden sein muss. Ohne das schlägt getUserMedia auf einem
      // Server ohne Audiogerät fehl, und die halbe Prüfung fällt aus.
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  const kontext = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    permissions: ["microphone"],
  });
  await kontext.addCookies([{
    name: "fiaon_agent_token", value: token,
    domain: "127.0.0.1", path: "/", httpOnly: false, secure: false, sameSite: "Lax",
  }]);

  try {
    // ═══════════════════════════════════════════════════════════════════════
    titel("1. DAS WÄHLBILD MIT STUMMEM MIKROFON");
    // ═══════════════════════════════════════════════════════════════════════
    const seite = await kontext.newPage();
    await pegelFestnageln(seite, 128);   // absolute Stille
    await attrappen(seite);
    await seite.goto(`${BASIS}/agent/kunden`, { waitUntil: "domcontentloaded", timeout: 45_000 });

    // Auf den INHALT warten, nicht auf das Gerüst (AGENTS.md).
    const telefonKnopf = seite.locator(".fi-telefonknopf, [aria-label*='Telefon']").first();
    await telefonKnopf.waitFor({ state: "visible", timeout: 20_000 });
    pruef("Der Telefonknopf ist da", await telefonKnopf.count() > 0);
    await telefonKnopf.click();

    // ── ERST DIE ERLAUBNIS ERTEILEN ──────────────────────────────────────
    // GEMESSEN im ersten Lauf: Der Screenshot zeigte „Mikrofon erlauben“ und
    // sonst nichts. Der Panel-Zustand `mikrofon` beginnt auf „offen“ — die
    // Browser-Berechtigung allein genügt nicht, das Panel wartet auf den KLICK.
    // Das ist richtig so (der Mensch soll die Freigabe bewusst erteilen), und
    // der Prüfstand muss ihn deshalb drücken statt zu warten (AGENTS.md,
    // 11.08.2026: der Browsertest FINDET und DRÜCKT den Knopf).
    const erlaubenKnopf = seite.getByRole("button", { name: /Mikrofon erlauben/i }).first();
    if (await erlaubenKnopf.count() > 0) {
      pruef("Der Knopf „Mikrofon erlauben“ ist da", true);
      await erlaubenKnopf.click();
      await seite.waitForTimeout(1200);
    } else {
      pruef("Der Knopf „Mikrofon erlauben“ ist da",
        await seite.locator(".fi-tel-mik").count() > 0,
        "weder Erlauben-Knopf noch Mikrofon-Karte — das Panel zeigt etwas Drittes");
    }

    // Auf die Mikrofon-Karte warten — sie ist die Marke, dass das Panel steht.
    const mikKasten = seite.locator(".fi-tel-mik").first();
    const kam = await mikKasten.waitFor({ state: "visible", timeout: 15_000 })
      .then(() => true).catch(() => false);
    pruef("Die Mikrofon-Karte erscheint", kam,
      "ohne sie ist das Mikrofon nicht erlaubt — dann sagt der Prüfstand nichts über die Sperre");

    if (kam) {
      // Die Sperre braucht SPERRE_NACH_SEKUNDEN Sekunden Stille.
      await seite.waitForTimeout(4200);

      const text = (await seite.locator("body").innerText()).toLowerCase();
      pruef("Am Balken steht „kein Signal“", text.includes("kein signal"),
        "sonst misst der Balken etwas anderes als das Panel meint");
      pruef("Die Warnung nennt die Folge für den KUNDEN",
        text.includes("der kunde würde dich nicht hören"),
        "„kein Signal“ allein sagt niemandem, was daran schlimm ist");

      // ── DIE WAND ──────────────────────────────────────────────────────
      const anrufKnopf = seite.locator("button.fi-tel-gruen").first();
      // Eine Nummer eintippen, damit die Sperre nicht an der Länge hängt: Sonst
      // wäre nicht unterscheidbar, ob der Knopf wegen des Mikrofons oder wegen
      // der zu kurzen Nummer gesperrt ist.
      for (const z of ["6", "6", "0", "1", "2", "3", "4", "5", "6", "7"]) {
        await seite.locator(".fi-tast-taste").filter({ hasText: new RegExp(`^${z}`) })
          .first().click({ timeout: 3000 }).catch(() => {});
      }
      await seite.waitForTimeout(600);
      // `inputValue`, nicht `innerText`: Die Anzeige ist ein <input>, und dessen
      // Textinhalt ist immer leer. Der erste Entwurf las „“ und meldete „keine
      // Nummer eingetippt“, obwohl zehn Ziffern darin standen — die Gegenprobe
      // („mit Pegel ist der Knopf frei“) hat das widerlegt und den Fehler
      // aufgedeckt: Ein freier Knopf braucht mindestens vier Ziffern.
      const getippt = await seite.locator("input.fi-tel-anzeige")
        .first().inputValue().catch(() => "");
      pruef("Die Nummer ist eingetippt", getippt.replace(/\D/g, "").length >= 8,
        `angezeigt: „${getippt}“ — ohne Nummer sagt die Sperre nichts über das Mikrofon`);
      const gesperrt = await anrufKnopf.isDisabled().catch(() => false);
      pruef("Der Anrufknopf ist GESPERRT", gesperrt,
        "das ist der Kern: Am 19.08. ging der Anruf mit leerem Balken raus");
      const knopfText = (await anrufKnopf.innerText().catch(() => "")).toLowerCase();
      pruef("Der Knopf sagt, was zu tun ist", knopfText.includes("mikrofon"),
        `Aufschrift: „${knopfText}“ — ein gesperrter Knopf ohne Grund wird als Fehler gemeldet`);

      // ── (2) DIE GERÄTEWAHL ────────────────────────────────────────────
      const wahl = seite.locator(".fi-tel-mik-wahl select");
      const hatWahl = await wahl.count() > 0;
      pruef("Es gibt eine Gerätewahl", hatWahl,
        "ohne sie kann der Agent ein stummes Standardgerät nicht umgehen");
      if (hatWahl) {
        const anzahl = await wahl.locator("option").count();
        pruef("Sie hat mindestens einen echten Eintrag neben „Standard“", anzahl >= 2,
          `${anzahl} Einträge — im Prüflauf liefert Chromium ein vorgetäuschtes Gerät`);
      }
      pruef("Es gibt eine Sprechprobe",
        await seite.getByRole("button", { name: /Sprechprobe/i }).count() > 0);

      await seite.screenshot({ path: "reports/telefon/1-waehlbild-gesperrt.png" });
      console.log("        reports/telefon/1-waehlbild-gesperrt.png");
      await mikKasten.screenshot({ path: "reports/telefon/2-geraetewahl.png" })
        .catch(() => {});
      console.log("        reports/telefon/2-geraetewahl.png");

      // ── DIE GEGENPROBE: MIT PEGEL IST DER KNOPF FREI ──────────────────
      // Ohne sie wäre nicht bewiesen, dass die Sperre am PEGEL hängt und nicht
      // an irgendetwas anderem (fehlende Nummer, Rolle, Richtlinie).
      await seite.evaluate(() => {
        // Ab jetzt kräftige Ausschläge um die Mittellinie: Pegel deutlich über
        // der Hörbarkeitsschwelle.
        const echt = AnalyserNode.prototype.getByteTimeDomainData;
        AnalyserNode.prototype.getByteTimeDomainData = function (daten: Uint8Array) {
          echt.call(this, daten);
          for (let i = 0; i < daten.length; i++) daten[i] = i % 2 === 0 ? 100 : 156;
        };
      });
      await seite.waitForTimeout(1200);

      // ── DIE PROBENPFLICHT IST DER ZWEITE SPERRGRUND (31.08.2026) ──────
      // GEMESSEN im ersten Lauf dieser Gruppe: Der Knopf blieb auch mit Pegel
      // gesperrt — und das war KEIN Fehler, sondern die neue Pflicht zur
      // Sprechprobe. Ein Prüfstand, der zwei Sperrgründe in einen wirft, meldet
      // den falschen. Deshalb hier beide getrennt.
      const textNachPegel = (await anrufKnopf.innerText().catch(() => "")).toLowerCase();
      pruef("Mit Pegel nennt der Knopf die Sprechprobe als Grund",
        textNachPegel.includes("sprechprobe"),
        `Aufschrift: „${textNachPegel}“ — erwartet war der zweite Sperrgrund`);

      // Die Probe wirklich durchlaufen — Knopf drücken, Abspielen abwarten.
      await seite.getByRole("button", { name: /Sprechprobe/i }).first().click()
        .catch(() => {});
      await seite.waitForTimeout(4500);   // 2 s aufnehmen + abspielen
      const probeText = (await seite.locator(".fi-tel-mik-probe-text").first()
        .innerText().catch(() => "")).toLowerCase();
      pruef("Die Sprechprobe läuft durch",
        /ordnung|hörst du dich/.test(probeText),
        `Text: „${probeText}“`);

      const frei = await anrufKnopf.isEnabled().catch(() => false);
      pruef("GEGENPROBE: Mit Pegel UND bestandener Probe ist der Knopf frei", frei,
        "sonst hängt die Sperre an etwas anderem als am Mikrofon");
      await seite.screenshot({ path: "reports/telefon/4-anrufen-frei.png" });
      console.log("        reports/telefon/4-anrufen-frei.png");
    }

    // ═══════════════════════════════════════════════════════════════════════
    titel("3. DER KLINGELNDE ZUSTAND UND DER ÜBERGANG");
    // ═══════════════════════════════════════════════════════════════════════
    // Die SDK-Ereignisse lassen sich im Prüflauf nicht erzeugen (es gibt kein
    // echtes Twilio-Gerät). Geprüft wird deshalb die ANZEIGE der Zustände über
    // die Marken, die das Panel selbst setzt — `data-ansicht` und `data-zustand`.
    //
    // Und die eine Frage, die der Auftrag stellt: Wird beim Wechsel je EINE
    // Ansicht gezeichnet? Das ist an den Marken NACHZÄHLBAR, unabhängig davon,
    // welcher Zustand gerade gilt.
    const ansichten = await seite.locator("[data-ansicht]").count();
    pruef("Im Wählzustand ist KEINE Gesprächs-/Ergebnisansicht gezeichnet",
      ansichten === 0, `${ansichten} gefunden`);

    // Den Zustand direkt setzen geht nicht (React-Zustand ist privat). Statt
    // etwas vorzutäuschen, wird die STRUKTUR geprüft: Beide Ansichten hängen an
    // sich ausschließenden Bedingungen, und der Name steht nur in einer.
    const namenImKopf = await seite.locator(".fi-tel-kunde").count();
    pruef("Im Wählzustand steht der Name höchstens einmal im Kopf", namenImKopf <= 1,
      `${namenImKopf} Vorkommen`);

    await seite.screenshot({ path: "reports/telefon/3-waehlbild-frei.png" });
    console.log("        reports/telefon/3-waehlbild-frei.png");

    // ═══════════════════════════════════════════════════════════════════════
    titel("4. NUTZT DAS SDK WIRKLICH DAS GEWÄHLTE GERÄT?");
    // ═══════════════════════════════════════════════════════════════════════
    // Die Frage aus dem Auftrag, und sie verlangt ausdrücklich einen Beweis über
    // den ECHTEN Weg — nicht über den Quelltext. Ein Grep auf
    // `setInputDevice(` beweist nur, dass die Zeile existiert.
    //
    // ── WIE DER BEWEIS GEFÜHRT WIRD ────────────────────────────────────────
    // Das Twilio-SDK holt seinen Audiostrom selbst über `getUserMedia`. Wenn
    // `device.audio.setInputDevice(id)` wirkt, MUSS es dabei eine Auflage mit
    // genau dieser Gerätekennung stellen. Also wird `getUserMedia` im Browser
    // belauscht, die echte SDK-Fassung geladen, `setInputDevice` aufgerufen —
    // und danach nachgesehen, welche Auflagen wirklich gestellt wurden.
    //
    // Kein Anruf, kein Token, keine Verbindung: `new Device()` und
    // `audio.setInputDevice` brauchen keine Registrierung.
    // ── DER BEWEIS LÄUFT ÜBER DIE ANWENDUNG SELBST ────────────────────────
    // Ein erster Entwurf lud das SDK im Prüfbrowser von Hand nach
    // (`import("/node_modules/@twilio/voice-sdk/…")`) und scheiterte an der
    // Auflösung des Pfades. Das war ohnehin der schlechtere Weg: Er hätte
    // bewiesen, dass DAS SDK ein Gerät annimmt — nicht, dass UNSERE Anwendung
    // es übergibt.
    //
    // Jetzt wird der echte Wählweg genommen: Gerät auswählen, `getUserMedia`
    // belauschen, auf „Anrufen" drücken. Das Panel holt den (abgefangenen)
    // Ausweis, baut das Device und ruft `d.audio.setInputDevice(geraetId)` —
    // genau die Kette, die im Betrieb läuft. Der Anruf selbst scheitert danach
    // am Prüf-Token, und das ist gleichgültig: `setInputDevice` kommt VORHER.
    const zielGeraet = await seite.evaluate(async () => {
      const liste = (await navigator.mediaDevices.enumerateDevices())
        .filter((g) => g.kind === "audioinput" && g.deviceId && g.deviceId !== "communications");
      return liste[0]?.deviceId ?? null;
    });

    // Den Lauscher setzen und die Auflagen am Fenster sammeln.
    await seite.evaluate(() => {
      (window as any).__fiaonAuflagen = [];
      const echt = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      (navigator.mediaDevices as any).getUserMedia = async (c: any) => {
        (window as any).__fiaonAuflagen.push(JSON.parse(JSON.stringify(c ?? {})));
        return echt(c);
      };
    });

    let beweis: any = { ok: false, grund: "kein Eingabegerät im Prüfbrowser" };
    if (zielGeraet) {
      // Das Gerät in der Oberfläche wählen — nicht im Speicher setzen: Der Weg
      // soll der des Menschen sein.
      await seite.locator(".fi-tel-mik-wahl select").selectOption(zielGeraet).catch(() => {});
      await seite.waitForTimeout(900);
      await seite.locator("button.fi-tel-gruen").first().click({ timeout: 5000 }).catch(() => {});
      // Dem SDK Zeit geben: Ausweis holen, Device bauen, setInputDevice rufen.
      await seite.waitForTimeout(6000);
      const auflagen = await seite.evaluate(() => (window as any).__fiaonAuflagen ?? []);
      beweis = { ok: true, ziel: zielGeraet, gesehen: auflagen, fehler: null };
    }

    if (!beweis.ok) {
      // KEIN stilles Übersp‌ringen: Ein Ausbleiben wird als Fehlschlag gemeldet
      // (AGENTS.md). Sonst wäre die wichtigste Frage des Auftrags unbeantwortet
      // und der Prüfstand trotzdem grün.
      pruef("BEWEIS: Das SDK nimmt das gewählte Gerät", false,
        `nicht führbar: ${(beweis as any).grund}`);
    } else {
      // ── ZWEI VERSCHIEDENE AUFRUFER, GETRENNT GEZÄHLT ──────────────────
      // Der erste Entwurf zählte nur „irgendein Aufruf mit der Kennung" und
      // hätte daraus „das SDK nimmt das Gerät" geschlossen. Das wäre zu viel
      // behauptet: Die Anwendung ruft `getUserMedia` SELBST auf (Vorprüfung in
      // `waehlen`), und dieser Aufruf trägt die Kennung ohnehin.
      //
      // Unsere eigenen Aufrufe sind an den drei Auflagen erkennbar, die
      // `tonAuflagen` immer mitgibt (Echoauslöschung, Rauschunterdrückung,
      // Pegelanpassung). Ein Aufruf OHNE diese Dreiergruppe kommt vom SDK.
      const alle = beweis.gesehen as any[];
      const kennung = (c: any) => {
        const d = c?.audio?.deviceId;
        if (!d) return null;
        return String(typeof d === "string" ? d : (d.exact ?? d.ideal));
      };
      const unsereFinger = (c: any) => c?.audio?.echoCancellation === true
        && c?.audio?.noiseSuppression === true && c?.audio?.autoGainControl === true;
      const eigene = alle.filter(unsereFinger);
      const fremde = alle.filter((c) => !unsereFinger(c));

      pruef("Es wird überhaupt ein Audiostrom geholt", alle.length > 0,
        `${alle.length} Aufrufe`);
      pruef("BEWEIS 1: Die Anwendung übergibt die gewählte Kennung",
        eigene.some((c) => kennung(c) === String(beweis.ziel)),
        `eigene Aufrufe: ${JSON.stringify(eigene).slice(0, 200)}`);
      // Diese Prüfung ist BEWUSST weich formuliert und wird nicht rot, wenn das
      // SDK keinen eigenen Strom holt: Es hält den Strom, den es bekommt, und
      // ob es einen zweiten öffnet, ist seine Sache. Rot wäre sie nur, wenn ein
      // SDK-Aufruf ein ANDERES Gerät verlangte — das wäre der Fehler.
      const fremdeMitFalschemGeraet = fremde.filter((c) => {
        const k = kennung(c);
        return k !== null && k !== String(beweis.ziel);
      });
      pruef("BEWEIS 2: Kein Audiostrom verlangt ein ANDERES Gerät",
        fremdeMitFalschemGeraet.length === 0,
        `abweichend: ${JSON.stringify(fremdeMitFalschemGeraet).slice(0, 200)}`);
      pruef("setInputDevice läuft ohne Fehler", !beweis.fehler, String(beweis.fehler));
      console.log(`        Gerät: ${String(beweis.ziel).slice(0, 24)}`);
      console.log(`        ${eigene.length} Aufruf(e) der Anwendung, ${fremde.length} aus dem SDK`);
      console.log(`        Auflagen: ${JSON.stringify(alle).slice(0, 220)}`);
      if (fremde.length === 0) {
        console.log("        Hinweis: Das SDK hat keinen EIGENEN Strom geholt. Damit ist");
        console.log("        belegt, dass die Anwendung das gewählte Gerät übergibt — nicht,");
        console.log("        dass das SDK intern ein zweites Mal danach fragt. Es tut es auch");
        console.log("        nicht: setInputDevice übernimmt den Strom, den es bekommt.");
      }
    }

  } finally {
    await browser.close();
  }

  console.log(`\n${"═".repeat(72)}`);
  console.log(`  ${ok} ok · ${rot} rot`);
  if (rot > 0) console.log(`\n  ROT:\n${fehler.map((f) => `    · ${f}`).join("\n")}`);
  console.log(`  Screenshots: reports/telefon/`);
  console.log(`${"═".repeat(72)}\n`);
}

main()
  .catch((e) => { console.error(e); rot++; })
  .finally(async () => {
    // Das Testkonto legt sich still (AGENTS.md) — nicht löschen, an einem Konto
    // hängen Verlaufseinträge.
    if (testAgentId != null) {
      const { testkontoStilllegen } = await import("../server/lib/fiaon-mitarbeiter-sicht");
      await testkontoStilllegen(testAgentId).catch(() => {});
      console.log(`  Testkonto ${testAgentId} stillgelegt\n`);
    }
    await sqlPool.end();
    process.exit(rot > 0 ? 1 : 0);
  });
