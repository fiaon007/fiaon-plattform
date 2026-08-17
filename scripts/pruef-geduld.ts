// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: HAT DIE NACHSCHAU WIRKLICH GEDULD?
//
// ── WARUM DIESER PRÜFSTAND EIGENSTÄNDIG IST ────────────────────────────────
// `pruef-zweigampel.ts` prüft den QUELLTEXT: Steht dort eine Schleife, steht
// dort 240_000, steht dort der Takt. Das beweist, dass der Code so AUSSIEHT.
//
// Es beweist NICHT, dass er sich so VERHÄLT. Genau diese Lücke hat den Fehler
// vom 22.08.2026 durchgelassen: Der Code sah richtig aus („einmal warten, dann
// fragen"), und niemand hatte gemessen, ob Brevo bis dahin geantwortet hat.
//
// Hier läuft der echte Sammellauf gegen eine ATTRAPPE, die sich wie Brevo
// verhält — inklusive Verzug.
//
// ── DIE DREI FÄLLE (Auftrag, wörtlich) ─────────────────────────────────────
//   (a) Ereignis erscheint erst nach 90 Sekunden  → muss GRÜN werden
//   (b) Ereignis erscheint nie                    → „Zweig fehlt", aber erst
//                                                    nach Ablauf des Fensters
//   (c) Die Abfrage selbst scheitert (HTTP 400)   → „Prüfung gestört", und
//                                                    NICHT vier Minuten lang
//
// Damit das in Sekunden statt Minuten läuft, werden Takt und Fenster verkürzt
// (250 ms statt 30 s). Das Verhältnis bleibt gleich — geprüft wird die LOGIK.
//
//   npx tsx scripts/pruef-geduld.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";

let ok = 0;
let rot = 0;
const fehler: string[] = [];
function pruef(name: string, bedingung: boolean, hinweis = ""): void {
  if (bedingung) { ok++; console.log(`  ok    ${name}`); }
  else { rot++; fehler.push(name); console.log(`  ROT   ${name}${hinweis ? `  → ${hinweis}` : ""}`); }
}
function titel(t: string): void { console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); }

// ── DIE ATTRAPPE SITZT AM `fetch`, NICHT AM MODUL ─────────────────────────
//
// ── ERSTER VERSUCH UND WARUM ER SCHEITERTE ──────────────────────────────────
// Zuerst sollten `mailSenden` und `nachschauSammel` im Modul ersetzt werden:
//
//     (mailModul as any).mailSenden = async () => ({ ok: true });
//
// Das geht nicht — ES-Module sind schreibgeschützt („Cannot assign to read only
// property of object '[object Module]'").
//
// ── DER BESSERE WEG ─────────────────────────────────────────────────────────
// `globalThis.fetch` abfangen. Das ist nicht nur der einzige gangbare Weg, es
// prüft auch MEHR: Die echte Kette läuft durch — Registry, Payload-Bau,
// Brevo-URL mit `days` und `limit`, Fehlerübersetzung — und erst der
// Netzwerkaufruf wird abgefangen. Eine Modul-Attrappe hätte diese Strecke
// übersprungen.
//
// AGENTS.md: Eine Attrappe muss liefern, was der Server liefert. Also dieselbe
// Antwortform wie Brevo (`{ events: [...] }`) und wie Make (HTTP 200).
// ── EIN ATTRAPPEN-SCHLÜSSEL ───────────────────────────────────────────────
// `brevoKonfiguriert()` prüft BREVO_API_KEY. Ohne Schlüssel bricht der
// Sammellauf sofort mit „alles gestört" ab — richtig im Betrieb, aber dann
// prüft dieser Stand nichts.
//
// Der Wert geht nirgends hin: Der fetch-Abfang unten beantwortet jeden
// Brevo-Aufruf selbst. Und er ist erkennbar falsch, damit niemand ihn für einen
// echten hält.
process.env.BREVO_API_KEY = "xkeysib-PRUEFSTAND-ATTRAPPE-nicht-echt";
// Damit der Versand-Weg über Make ebenfalls durch die Attrappe läuft.
process.env.MAKE_WEBHOOK_URL ||= "https://hook.eu2.make.com/PRUEFSTAND-ATTRAPPE";

const echtesFetch = globalThis.fetch;

// WICHTIG: Der Import kommt NACH dem fetch-Abfang. Würde `fiaon-zustellung`
// vorher geladen, hätte es sich `fetch` schon gemerkt — und die Attrappe wäre
// wirkungslos.

let gesendet: string[] = [];
let abfragen = 0;
/** Was Brevo beim nächsten Abruf antwortet. */
let brevoAntwort: () => { status: number; koerper: unknown } =
  () => ({ status: 200, koerper: { events: [] } });

globalThis.fetch = (async (url: any, init?: any) => {
  const u = String(url);
  // Der Make-Webhook: Versand einer Probemail.
  if (/hook\.(eu\d?\.)?make\.com|MAKE_WEBHOOK/i.test(u)) {
    try {
      const body = JSON.parse(String(init?.body ?? "{}"));
      gesendet.push(String(body.event_type ?? body.event ?? "?"));
    } catch { gesendet.push("?"); }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
  // Die Brevo-Nachschau.
  if (/api\.brevo\.com.*statistics\/events/i.test(u)) {
    abfragen++;
    const a = brevoAntwort();
    return new Response(JSON.stringify(a.koerper), { status: a.status });
  }
  // Alles andere unverändert — sonst bricht der Datenbankzugriff.
  return echtesFetch(url, init);
}) as any;

const zustellModul = await import("../server/lib/fiaon-zustellung");

/**
 * Ein Ereignis in BREVOS Feldnamen, nicht in unseren.
 *
 * Die Attrappe sitzt am `fetch` — sie muss also die Antwortform der API
 * nachbilden (`date`, `event`, `subject`), nicht die unserer Übersetzung
 * (`am`, `ereignis`, `betreff`). Sonst prüft der Stand die Attrappe statt der
 * Umrechnung.
 */
function ereignis(typ: string, betreff: string) {
  return {
    email: "probe@example.invalid",
    event: "delivered",
    date: new Date().toISOString(),
    subject: betreff,
    messageId: `<pruefstand-${typ}@example.invalid>`,
  };
}

async function main(): Promise<void> {
  const AKTEUR = { name: "Prüfstand", agentId: null, rolle: "admin" as const };
  // Verkürzte Zeiten: dieselbe Logik, in Sekunden statt Minuten.
  const SCHNELL = {
    staffelMs: 0, taktMs: 250, maxWartenMs: 2000,
    // ── NICHTS IN DIE PRODUKTIONSDATENBANK ────────────────────────────────
    // Beim ersten Durchgang schrieb dieser Stand 34 echte Verifikationen —
    // darunter „Zweig bestätigt" für Ereignisse, die nur die Attrappe
    // bestätigt hatte. Eine falsche Bestätigung ist schlimmer als keine: Sie
    // macht die Ampel grün, ohne dass ein Zweig geprüft wurde.
    nichtSpeichern: true,
  };
  // Das Fenster beginnt NACH dem Versand (siehe fiaon-zustellung.ts). Ohne
  // diese Korrektur verbrauchten die 34 Probemails es vollständig — der
  // Prüfstand meldete 0 Abfragen und 34-mal „Prüfung gestört".

  // ═════════════════════════════════════════════════════════════════════════
  titel("(a) DAS EREIGNIS ERSCHEINT SPÄT — es muss GRÜN werden");
  // ═════════════════════════════════════════════════════════════════════════
  // Der Fehler vom 22.08.2026 in Reinform: Brevo antwortet, aber nicht sofort.
  gesendet = []; abfragen = 0;
  brevoAntwort = () => (abfragen <= 2
    // Die ersten zwei Abfragen: Brevo weiß noch nichts.
    ? { status: 200, koerper: { events: [] } }
    // Ab der dritten: beide Ereignisse sind da.
    : { status: 200, koerper: { events: [
        ereignis("welcome", "Probemail welcome"),
        ereignis("payment_details", "Probemail payment_details"),
      ] } });

  const spaet = await zustellModul.alleZweigePruefen("probe@example.invalid", AKTEUR, SCHNELL);
  console.log(`        ${spaet.zweige.length} Zweige · bestätigt ${spaet.bestaetigt} `
    + `· fehlt ${spaet.zweigFehlt} · gestört ${spaet.gestoert} · veraltet ${spaet.veraltet}`);
  // Die Attrappe liefert Ereignisse für ZWEI Betreffs — genau die werden grün.
  pruef("Die zwei antwortenden Zweige werden bestätigt, obwohl Brevo erst spät antwortet",
    spaet.bestaetigt === 2, `bestaetigt=${spaet.bestaetigt}`);
  pruef("Es wurde MEHRMALS gefragt", abfragen >= 3, `${abfragen} Abfragen`);
  // ── DER KERN: MIT DER ALTEN LOGIK WÄREN SIE ROT GEWESEN ────────────────
  // Die Attrappe antwortet erst ab der dritten Abfrage. Eine einzige Nachschau
  // hätte NICHTS gefunden — genau der Vorfall vom 22.08.2026 mit 34 falschen
  // Rot-Marken.
  pruef("Die beiden wären mit der alten EINMALIGEN Abfrage rot gewesen",
    abfragen >= 3 && spaet.bestaetigt === 2,
    `${abfragen} Abfragen nötig, um sie zu finden`);
  pruef("Das veraltete Ereignis wurde NICHT geprüft",
    !gesendet.includes("followup_48h"),
    `gesendet: ${gesendet.join(", ")}`);
  pruef("Es zählt in keiner Summe mit",
    spaet.veraltet === 1
      && spaet.bestaetigt + spaet.zweigFehlt + spaet.gestoert + spaet.veraltet === spaet.zweige.length,
    `veraltet=${spaet.veraltet}, Summen=${spaet.bestaetigt}+${spaet.zweigFehlt}+${spaet.gestoert}+${spaet.veraltet} von ${spaet.zweige.length}`);
  pruef("Es bekommt eine eigene Zeile",
    spaet.zweige.some((z) => z.event === "followup_48h" && z.zustand === "veraltet"));
  pruef("Die Zeile sagt, dass der Zweig gelöscht werden darf",
    /GELÖSCHT werden/.test(spaet.zweige.find((z) => z.event === "followup_48h")?.text ?? ""));

  // ═════════════════════════════════════════════════════════════════════════
  titel("(b) DAS EREIGNIS ERSCHEINT NIE — „Zweig fehlt“, aber erst nach Ablauf");
  // ═════════════════════════════════════════════════════════════════════════
  gesendet = []; abfragen = 0;
  brevoAntwort = () => ({ status: 200, koerper: { events: [] } });

  const nie = await zustellModul.alleZweigePruefen("probe@example.invalid", AKTEUR, SCHNELL);
  pruef("Alle lebenden gelten als „Zweig fehlt“",
    nie.zweigFehlt === nie.zweige.length - nie.veraltet,
    `zweigFehlt=${nie.zweigFehlt} von ${nie.zweige.length - nie.veraltet} lebenden`);
  // ── DIE ZEIT WIRD AN DEN ABFRAGEN GEMESSEN, NICHT AN DER UHR ───────────
  // Ein erster Entwurf verglich die Gesamtdauer mit dem Fenster. Das ging
  // schief, weil der Versand von 34 Probemails und die Attrappen-Antworten
  // selbst Zeit kosten — die Prüfung wurde rot, obwohl die Logik stimmte.
  // Die Zahl der Abfragen sagt dasselbe und ist unabhängig von der Maschine.
  pruef("Es wurde bis zum Ende des Fensters gefragt", abfragen >= 6,
    `${abfragen} Abfragen bei 250 ms Takt in 2000 ms Fenster`);


  // ── DIE DIAGNOSE STEHT DABEI ───────────────────────────────────────────
  const text = nie.zweige.find((z) => z.event === "welcome")?.text ?? "";
  pruef("Der Text nennt die gesuchte Adresse", text.includes("probe@example.invalid"), text.slice(0, 80));
  pruef("… und die Zahl der gefundenen Brevo-Ereignisse", /Brevo lieferte 0 Ereignisse/.test(text));
  pruef("… und sagt bei 0, dass es NICHT am Zweig liegt",
    /nicht am einzelnen Zweig/.test(text),
    "sonst sucht der Betreiber wieder in Make");
  // Die Speicherung geht in die echte Datenbank (fiaon_mail_events). Das ist
  // hier RICHTIG: Die Abfrage lief, es kam wirklich nichts an — der Zweig ist
  // also zu Recht als ungeprüft markiert. Geprüft wird es in
  // scripts/pruef-zweigampel.ts am Quelltext.
  pruef("Der Text nennt die Zahl der Nachfragen",
    /\(\d+ Nachfragen\)/.test(text), text.slice(0, 60));

  // ═════════════════════════════════════════════════════════════════════════
  titel("(c) DIE ABFRAGE SELBST SCHEITERT — nicht 4 Minuten denselben Fehler");
  // ═════════════════════════════════════════════════════════════════════════
  gesendet = []; abfragen = 0;
  // Genau die Antwort, die Brevo am 22.08.2026 wirklich schickte.
  brevoAntwort = () => ({
    status: 400,
    koerper: { message: "endDate must be lower than or equal to today", code: "invalid_parameter" },
  });

  const kaputt = await zustellModul.alleZweigePruefen("probe@example.invalid", AKTEUR, SCHNELL);
  pruef("Alle lebenden gelten als „Prüfung gestört“",
    kaputt.gestoert === kaputt.zweige.length - kaputt.veraltet,
    `gestoert=${kaputt.gestoert}, zweigFehlt=${kaputt.zweigFehlt}`);
  pruef("KEINER gilt als fehlender Zweig", kaputt.zweigFehlt === 0,
    "das war die falsche Anschuldigung vom 21.08.2026");
  pruef("Es wurde NUR EINMAL gefragt", abfragen === 1,
    `${abfragen} — vier Minuten denselben HTTP-400 zu wiederholen hilft niemandem`);
  // Wieder an den Abfragen gemessen: EINE genügt, um zu wissen, dass es nicht
  // besser wird. Mehr als eine wäre vier Minuten derselbe HTTP-400.
  pruef("Der Lauf pollte NICHT weiter", abfragen === 1, `${abfragen} Abfragen`);
  pruef("Der Text sagt, dass die PRÜFUNG gestört ist",
    /Prüfung selbst ist gestört/.test(kaputt.zweige[0]?.text ?? ""),
    kaputt.zweige[0]?.text?.slice(0, 70) ?? "");
  pruef("Der Klartext wird durchgereicht",
    /Prüfung selbst ist gestört/.test(kaputt.klartext?.titel ?? ""));

  // ═════════════════════════════════════════════════════════════════════════
  titel("(d) „NUR NACHSEHEN“ — ohne neue Probemails");
  // ═════════════════════════════════════════════════════════════════════════
  gesendet = []; abfragen = 0;
  brevoAntwort = () => ({ status: 200, koerper: { events: [
    ereignis("welcome", "Probemail welcome"),
    ereignis("payment_details", "Probemail payment_details"),
  ] } });

  const nachsehen = await zustellModul.alleZweigePruefen("probe@example.invalid", AKTEUR,
    { ...SCHNELL, nurNachsehen: true, suchAb: new Date(Date.now() - 600_000) });
  pruef("Es wurde KEINE Mail geschickt", gesendet.length === 0,
    `${gesendet.length} Mails — 35 unnötige kosten Zustellreputation`);
  pruef("Die antwortenden Zweige werden trotzdem bestätigt", nachsehen.bestaetigt === 2,
    `bestaetigt=${nachsehen.bestaetigt}`);
  // Höchstens zwei: Der erste Durchgang fragt sofort (ohne Wartezeit), der
  // zweite gibt Brevo eine letzte Gelegenheit. Mehr wäre sinnlos, denn der
  // Versand liegt in der Vergangenheit.
  pruef("Und zwar ohne Wartezeit vor der ersten Abfrage", abfragen <= 2,
    `${abfragen} Abfragen — die Mails sind von vorhin, es gibt nichts zu warten`);

  // Und der Fall, für den der Knopf gebaut wurde: Der Lauf gab zu früh auf,
  // die Mails liegen inzwischen bei Brevo.
  gesendet = []; abfragen = 0;
  const nachsehenLeer = await zustellModul.alleZweigePruefen("probe@example.invalid", AKTEUR,
    { ...SCHNELL, nurNachsehen: true, suchAb: new Date(Date.now() - 600_000) });
  pruef("Auch beim Nachsehen wird höchstens zweimal gefragt",
    abfragen <= 2, `${abfragen} — der Versand liegt in der Vergangenheit`);
  pruef("Der Misserfolgs-Text sagt, dass keine neuen Mails geschickt wurden",
    nachsehenLeer.bestaetigt === 2
      && nachsehenLeer.zweige.some((z) => /keine neuen Probemails/.test(z.text)),
    nachsehenLeer.zweige[0]?.text?.slice(0, 70) ?? "");

  console.log(`\n${"═".repeat(72)}`);
  console.log(`  ${ok} ok · ${rot} rot`);
  if (rot > 0) console.log(`\n  ROT:\n${fehler.map((f) => `    · ${f}`).join("\n")}`);
  console.log(`${"═".repeat(72)}\n`);
  process.exit(rot > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
