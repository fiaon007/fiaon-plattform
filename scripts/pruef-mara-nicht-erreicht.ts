// Prüfstand E-401 (5/6, 19.10.2026), offline: Mara fasst nach 2× „nicht erreicht“ selbst nach.
// Ohne Datenbank, ohne Netz, ohne Schlüssel. Prüft die reine Regel (shared/fiaon-nicht-erreicht-nachfass.ts),
// die Vorlage im Mailwerk (gerendert, mit Wortwänden), die Verdrahtung (Registry, Tür, Sperrlisten, Herkunft,
// Takt) und den Einbau in ergebnisAnwenden. Datenbank-Teil: scripts/pruef-mara-nicht-erreicht-db.ts.
//   env -i HOME=$HOME PATH=$PATH TZ=Europe/Berlin CRONS=aus DATABASE_URL=postgresql://pruef@127.0.0.1:9/keine \
//     node_modules/.bin/tsx scripts/pruef-mara-nicht-erreicht.ts
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN"]) delete process.env[k];
process.env.DATABASE_URL ||= "postgresql://pruef@127.0.0.1:9/keine";
process.env.CRONS = "aus";
import { readFileSync } from "node:fs";

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra: unknown = "") {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; console.log(`  ✗ ${was}${extra !== "" ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra)}` : ""}`); }
}
const lies = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

async function main() {
  const R = await import("../shared/fiaon-nicht-erreicht-nachfass");
  const { nachfassUrteil, GRUND, naechstesFenster, imVersandfenster, berlinMinuten } = R;

  // Berliner Wandzeit → absoluter Zeitpunkt (für feste Prüfzeiten). Oktober 2026: Umstellung am 25.10. um 3 Uhr.
  const B = (iso: string) => new Date(iso);
  const MITTAG = B("2026-10-20T12:00:00+02:00");
  const basis: import("../shared/fiaon-nicht-erreicht-nachfass").NachfassFakten = {
    personDa: true, versuche: 2, rolle: "vertrieb", globalKunde: false, sperre: null,
    terminOffen: false, hatEmail: true, letzteTerminMailAm: null,
  };
  const U = (f: Partial<typeof basis>, jetzt = MITTAG) => nachfassUrteil({ ...basis, ...f }, jetzt);

  console.log("── 1 · Wer bekommt die Mail (positiv)");
  ok(U({}).art === "senden", "Vertrieb, 2 Versuche, Mail da, 12:00 → senden", U({}));
  ok(U({ rolle: "onboarding" }).art === "senden", "Onboarding (bezahlt, Startgespräch offen) → senden");
  ok(U({ versuche: 3 }).art === "senden", "beim Senden zählt ≥ 2 (der Zähler kann bis zum Takt weiter gestiegen sein)");
  ok(U({ letzteTerminMailAm: new Date(MITTAG.getTime() - 21 * 3600_000) }).art === "senden", "letzte Terminlink-Mail vor 21 h → senden");

  console.log("── 2 · Wer bekommt sie NICHT (negativ)");
  const neg: [string, Partial<typeof basis>, string, string][] = [
    ["Person weg (zusammengeführt)", { personDa: false }, "auslassen", GRUND.personWeg],
    ["inzwischen erreicht (Zähler 0)", { versuche: 0 }, "erledigt", GRUND.erreicht],
    ["erst 1 Versuch", { versuche: 1 }, "erledigt", GRUND.erreicht],
    ["Termin oder Rückruf steht", { terminOffen: true }, "erledigt", GRUND.terminSteht],
    ["Kunde von FIAON Global", { globalKunde: true }, "auslassen", GRUND.global],
    ["Forderungsmanagement (Raten)", { rolle: "inkasso" }, "auslassen", GRUND.inkasso],
    ["Werbesperre", { sperre: "Werbesperre" }, "auslassen", "Werbesperre"],
    ["„Stopp“", { sperre: "„Stopp“ (will keine Nachrichten mehr)" }, "auslassen", "„Stopp“ (will keine Nachrichten mehr)"],
    ["Vertriebssperre (is_blocked)", { sperre: "Vertriebssperre" }, "auslassen", "Vertriebssperre"],
    ["Testkonto", { sperre: "Testkonto" }, "auslassen", "Testkonto"],
    ["gekündigt", { sperre: "gekündigt oder Vertrag beendet" }, "auslassen", "gekündigt oder Vertrag beendet"],
    ["keine E-Mail", { hatEmail: false }, "auslassen", GRUND.keineMail],
  ];
  for (const [name, f, art, grund] of neg) {
    const u = U(f);
    ok(u.art === art && (u as any).grund === grund, `${name} → ${art}`, u);
  }
  ok(U({ globalKunde: true, rolle: "inkasso", sperre: "Werbesperre" }).art === "auslassen", "mehrere Gründe zugleich → auslassen");
  ok(U({ terminOffen: true, sperre: "Werbesperre" }).art === "erledigt", "Termin steht schlägt Sperre (nichts zu tun)");

  console.log("── 3 · Versandfenster 08–20 Uhr (Berlin)");
  ok(imVersandfenster(B("2026-10-20T08:00:00+02:00")) && !imVersandfenster(B("2026-10-20T07:59:00+02:00")), "08:00 offen, 07:59 zu");
  ok(imVersandfenster(B("2026-10-20T19:59:00+02:00")) && !imVersandfenster(B("2026-10-20T20:00:00+02:00")), "19:59 offen, 20:00 zu");
  ok(berlinMinuten(B("2026-10-20T00:30:00+02:00")) === 30, "Mitternacht (h23) = 0 Minuten, keine NaN-Falle", berlinMinuten(B("2026-10-20T00:30:00+02:00")));
  const frueh = U({}, B("2026-10-20T06:15:00+02:00"));
  ok(frueh.art === "warten" && (frueh as any).nichtVor.toISOString() === "2026-10-20T06:00:00.000Z" && (frueh as any).grund === GRUND.fenster, "06:15 → wartet bis heute 08:00", frueh);
  const spaet = U({}, B("2026-10-20T20:30:00+02:00"));
  ok(spaet.art === "warten" && (spaet as any).nichtVor.toISOString() === "2026-10-21T06:00:00.000Z", "20:30 → wartet bis morgen 08:00", spaet);
  const umstellung = naechstesFenster(B("2026-10-24T21:00:00+02:00"));
  ok(umstellung.toISOString() === "2026-10-25T07:00:00.000Z", "Zeitumstellung 25.10.: morgen 08:00 Winterzeit = 07:00 UTC", umstellung.toISOString());
  const maerz = naechstesFenster(B("2027-03-27T22:00:00+01:00"));
  ok(maerz.toISOString() === "2027-03-28T06:00:00.000Z", "Zeitumstellung 28.03.: 08:00 Sommerzeit = 06:00 UTC", maerz.toISOString());
  ok(naechstesFenster(MITTAG).getTime() === MITTAG.getTime(), "im Fenster: sofort");

  console.log("── 4 · Abstand zur letzten Terminlink-Mail (Rückholung, Einladung, „verpasst“)");
  const vor5 = U({ letzteTerminMailAm: new Date(MITTAG.getTime() - 5 * 3600_000) });
  ok(vor5.art === "warten" && (vor5 as any).grund === GRUND.abstand, "Terminlink-Mail vor 5 h → wartet", vor5);
  ok(vor5.art === "warten" && (vor5 as any).nichtVor.toISOString() === "2026-10-21T06:00:00.000Z", "… bis zum nächsten Fenster nach +20 h (07:00 → 08:00)", vor5);
  ok(R.istTerminlinkEreignis("rueckhol_s4") && R.istTerminlinkEreignis("nicht_erreicht_termin") && R.istTerminlinkEreignis("onboarding_einladung")
    && R.istTerminlinkEreignis("termin_verpasst") && R.istTerminlinkEreignis(R.NACHFASS_EVENT) && !R.istTerminlinkEreignis("payment_reminder"),
    "Terminlink-Ereignisse: rueckhol_*, nicht_erreicht_termin, Einladung, verpasst, eigenes — keine Mahnung");

  console.log("── 5 · Schalter (Standard an) und Hinweise an den Mitarbeiter");
  ok(R.schalterAn(undefined) && R.schalterAn(null) && R.schalterAn("") && R.schalterAn("an") && R.schalterAn("1"), "fehlt/leer/an → an");
  ok(!R.schalterAn("aus") && !R.schalterAn("0") && !R.schalterAn("nein") && !R.schalterAn(" AUS "), "aus/0/nein → aus");
  const hSenden = R.hinweisFuerMitarbeiter({ art: "senden" }, MITTAG) ?? "";
  ok(/Mara schickt dem Kunden in den nächsten Minuten/.test(hSenden) && /Terminlink/.test(hSenden), "senden → „Mara schickt dem Kunden in den nächsten Minuten …“", hSenden);
  const hWarten = R.hinweisFuerMitarbeiter(spaet, B("2026-10-20T20:30:00+02:00")) ?? "";
  ok(/morgen 08:00 Uhr/.test(hWarten), "20:30 → „… morgen 08:00 Uhr …“", hWarten);
  ok(/Keine E-Mail-Adresse/.test(R.hinweisFuerMitarbeiter(U({ hatEmail: false })) ?? ""), "keine Mail → der Mitarbeiter erfährt es (er kann es beheben)");
  ok(R.hinweisFuerMitarbeiter(U({ sperre: "Werbesperre" })) === null && R.hinweisFuerMitarbeiter(U({ versuche: 0 })) === null, "Sperre/erreicht → kein Satz (steht in der Akte)");

  console.log("── 6 · Die Vorlage im Mailwerk (gerendert, Wortwände)");
  const motor = await import("../server/mail/motor");
  const { MAKE_EVENT_REGISTRY } = await import("../server/make-events-registry");
  const eintrag = MAKE_EVENT_REGISTRY.find((e) => e.type === R.NACHFASS_EVENT);
  ok(!!eintrag && !eintrag.deprecated && eintrag.customerBound, "Registry kennt nicht_erreicht_zweimal", eintrag?.type);
  const m = motor.mailRendern(R.NACHFASS_EVENT, { ...(eintrag?.example ?? {}) } as any);
  ok(!!m && !m.knopfEntfallen && m.fehlend.length === 0, "Beispiel füllt alles (Knopf mit Ziel)", m?.fehlend);
  ok(/zweimal nicht erreicht/.test(m?.betreff ?? "") && /wann passt es Ihnen/.test(m?.betreff ?? ""), "Betreff: „Wir haben Sie zweimal nicht erreicht — wann passt es Ihnen?“", m?.betreff);
  ok(/href="https:\/\/www\.fiaon\.com\/termin\/[^"]*von=nicht_erreicht_2_mail"/.test(m?.html ?? ""), "Knopf führt auf den persönlichen Terminlink (mit Herkunft)");
  ok(/Meine Zeit wählen/.test(m?.html ?? ""), "Knopf heißt „Meine Zeit wählen“");
  ok(/Herr Stripling/.test(m?.text ?? "") && !/\bDaniel\b/.test(m?.text ?? ""), "Mitarbeiter in der Nennform („Herr Stripling“), nie der Vorname");
  const kText = `${m?.betreff ?? ""}\n${m?.text ?? ""}`;
  const W = await import("../shared/fiaon-wortverbote");
  const T = await import("../shared/fiaon-mara-ton");
  ok(W.kopplungFinden(kText) === null && W.drohungFinden(kText) === null, "keine Kündigungs-Kopplung, keine Drohung (E-393)");
  ok(T.limitPruefen(kText).length === 0 && !T.BANK_SATZ_MUSTER.test(m?.text ?? ""), "kein Limit, kein Bank-Vorbehalt (E-281/E-373, ohne Karten-Block)");
  ok(T.ausrufezeichen(kText) === 0, "kein Ausrufezeichen", T.ausrufezeichen(kText));
  ok(!(m?.html ?? "").includes("Ihr Ziel"), "kein Karten-Block in dieser Terminmail");
  const sechs = motor.mailRendern("nicht_erreicht_termin", { vorname: "Max", nachname: "Muster", agent_vorname: "Herr Stripling", termin_link: "https://www.fiaon.com/termin/x" });
  ok(!!sechs && !/zweimal|Zwei Anrufe/i.test(`${sechs.betreff} ${sechs.text}`), "Die 6.-Versuch-Mail sagt nicht mehr „zweimal“ (sie kommt jetzt erst später)", sechs?.text.slice(0, 200));
  ok(!!sechs && !sechs.knopfEntfallen, "… und hat ihren Knopf behalten");

  console.log("── 7 · Verdrahtung (Tür, Sperrlisten, Herkunft, Menü, Takt)");
  const F = await import("../server/lib/fiaon-mail-frequenz");
  ok(F.NUR_BIS_VERTRAGSENDE.has(R.NACHFASS_EVENT), "NUR_BIS_VERTRAGSENDE: nicht nach Vertragsende, nie an Testkonten (Tür)");
  ok(!F.PFLICHTMAILS.has(R.NACHFASS_EVENT), "keine Pflichtmail — Werbesperre und Bremse der Tür gelten");
  const urteil = F.sperrUrteil(R.NACHFASS_EVENT, [{ personId: 1, werbesperre: false, werbesperreSeit: null, vertriebssperre: false, test: true, gekuendigt: false, vertragVorbei: false, laufendesPaket: false, laufendUngekuendigt: false, kundeMitHinweis: false }], { manuell: false });
  ok(!!urteil && /Testkonto/.test(urteil), "Tür: Testkonto → gesperrt", urteil);
  const tuer = lies("server/make-webhook.ts");
  const privat = tuer.slice(tuer.indexOf("const PRIVATLINIE_PERSON = new Set<string>(["), tuer.indexOf("]);", tuer.indexOf("const PRIVATLINIE_PERSON")));
  ok(privat.includes(`"${R.NACHFASS_EVENT}"`), "PRIVATLINIE_PERSON: nie an Kunden von FIAON Global (Tür, E-272)");
  ok(/\|\s*"nicht_erreicht_zweimal"/.test(tuer), "MakeEventType kennt das Ereignis");
  const { mailEvents, imMenue } = await import("../server/lib/fiaon-mail-events");
  const ev = (await mailEvents((() => Promise.resolve([])) as any)).find((e) => e.type === R.NACHFASS_EVENT);
  ok(!!ev && !imMenue(ev, "admin").ja && !imMenue(ev, "agent").ja, "steht in keinem Sende-Menü (nur automatisch)");
  const { herkunftPruefen } = await import("../server/lib/fiaon-termine");
  ok(herkunftPruefen(R.NACHFASS_HERKUNFT) === R.NACHFASS_HERKUNFT, "Herkunft nicht_erreicht_2_mail ist bekannt (Buchung wird zugeordnet)");
  const senden = lies("server/lib/fiaon-mail-senden.ts");
  ok(/eventType === "nicht_erreicht_zweimal"\) setze\("termin_link", terminLink\(personId, "nicht_erreicht_2_mail"\)\)/.test(senden), "Link-Baustein setzt den persönlichen Terminlink mit Herkunft");
  const routen = lies("server/routes.ts");
  ok(/tageslauf\('mara_nicht_erreicht_mail'[^\n]*nachfassTakt[^\n]*5 \* 60 \* 1000[^\n]*nurMitErgebnis: true/.test(routen), "Takt alle 5 Minuten registriert (nur mit Ergebnis in der Historie)");
  const ke = lies("server/lib/fiaon-kontakt-ergebnis.ts");
  const zweig = ke.slice(ke.indexOf("} else if (zaehlerHoch && gezaehlt) {"), ke.indexOf("return {\n    wiedervorlage: wiedervorlage ?? null"));
  ok(zweig.includes("automatikNachFehlversuch") && zweig.includes("nachfassVormerken(personId, versuche, lauf)"), "ergebnisAnwenden: Vormerken nur im Zweig „gezählter Fehlversuch“, mit dem Lauf des Aufrufers");
  ok(zweig.indexOf("automatikNachFehlversuch") < zweig.indexOf("nachfassVormerken"), "… nach der bestehenden Automatik (6.-Versuch-Mail bleibt unberührt)");
  const ne = lies("server/lib/fiaon-nicht-erreicht.ts");
  ok(/export const SCHWELLE_MAIL = 6;/.test(ne), "Die bestehende Schwelle der 6.-Versuch-Mail ist unverändert");
  const srv = lies("server/lib/fiaon-mara-nicht-erreicht.ts");
  ok(/FOR UPDATE SKIP LOCKED/.test(srv) && /status = 'in_arbeit'/.test(srv), "Takt nimmt Merker atomar (zwei Instanzen senden nie doppelt)");
  ok(/ON CONFLICT \(person_id\) DO UPDATE[\s\S]{0,400}vorgemerkt_am < NOW\(\) - \(\$\{SPERRE_TAGE\}/.test(srv), "Merker: neu nur, wenn der alte älter als 30 Tage ist (nie doppelt)");
  ok(/savepoint/.test(srv), "Vormerken in einer Transaktion: im Sicherungspunkt (bricht die Buchung nie ab)");
  ok(!/sendMakeWebhook|mailDirektSenden/.test(srv) && /versendenUndProtokollieren\(/.test(srv), "Versand nur über den einen Weg (versendenUndProtokollieren → Tür)");
  ok(!/whatsapp|waSenden/i.test(srv.replace(/\/\/.*$/gm, "")), "kein WhatsApp-Versand (keine passende freigegebene Vorlage)");
  const kartei = lies("shared/fiaon-lead-texte.ts");
  ok(/fiaon_kk_nicht_erreicht/.test(kartei) && /Vom Mitarbeiter per Knopf/.test(kartei), "Begründung geprüft: die WA-Vorlage fiaon_kk_nicht_erreicht ist eine Knopf-Vorlage mit festem Link");

  console.log("── 8 · Rot-Proben (der Prüfstand sieht den Fehler)");
  const ohneFenster = { ...basis };
  ok(nachfassUrteil(ohneFenster, B("2026-10-20T21:00:00+02:00")).art !== "senden", "Rot-Probe: um 21:00 würde ein Urteil ohne Fensterprüfung senden — dieses nicht");
  ok(nachfassUrteil({ ...basis, globalKunde: true }).art !== "senden", "Rot-Probe: Global-Kunde würde ohne Prüfung eine Privat-Mail bekommen — dieses nicht");

  console.log(`\n${gut} gut, ${schlecht} schlecht`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
