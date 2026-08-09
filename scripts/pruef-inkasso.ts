// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: Team-Zentrale komplett, Inkasso, Vergütung, Erste Schritte
//
// Drei Dinge könnten hier echtes Geld kosten:
//   · Eine Prämie, die zweimal gebucht wird.
//   · Eine Prämie für eine Rate, die von selbst bezahlt wurde.
//   · Bestätigte Stunden, die sich nachträglich ändern lassen.
// Alle drei werden mit echten Daten in einer zurückgerollten Transaktion
// durchgespielt — nicht simuliert.
//
//   npx tsx scripts/pruef-inkasso.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";

const ECHT_MAKE = process.env.MAKE_WEBHOOK_URL;
process.env.MAKE_WEBHOOK_URL = "http://attrappe.pruefstand.invalid/keine-echten-mails";

import { existsSync, readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import {
  arbeitsliste, istRatenErgebnis, kennzahlen, praemieBuchen, RATEN_ERGEBNISSE,
  ratenErgebnisAnwenden, SICHTFELD, verdienst, VERGUETUNG_VORGABE,
} from "../server/lib/fiaon-inkasso";
import { INKASSO_ZUSAGE_TEXT, INKASSO_ZUSAGE_VERSION } from "../server/lib/fiaon-inkasso-zusage";
import { streckeFuer, STRECKEN } from "../shared/fiaon-onboarding-schritte";
import { berlinPlusTage, berlinToday } from "../server/lib/fiaon-time";

let bestanden = 0;
let fehlgeschlagen = 0;
const fehler: string[] = [];
const log = (s = "") => console.log(s);
function ok(name: string, b: boolean, detail = ""): void {
  if (b) { bestanden++; log(`  PASS  ${name}`); }
  else { fehlgeschlagen++; fehler.push(name); log(`  FAIL  ${name}${detail ? `  → ${detail}` : ""}`); }
}
function gleich(name: string, ist: unknown, soll: unknown): void {
  ok(name, String(ist) === String(soll), `ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`);
}
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 52 - t.length))}`); }

class Zurueckrollen extends Error {}
const stempel = Date.now().toString(36).toUpperCase();
const REF = (s: string) => `FIAON-INK${stempel}-${s}`;
const MAIL = (s: string) => `${s}-${stempel}@pruefstand-inkasso.test`.toLowerCase();

async function main(): Promise<void> {
  log("\n══ Prüfstand: Team-Zentrale, Inkasso, Erste Schritte ══\n");

  const [vorher] = await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_abo_raten)::int AS raten,
           (SELECT COUNT(*) FROM fiaon_commissions)::int AS provisionen,
           (SELECT COALESCE(SUM(amount_cents),0) FROM fiaon_commissions)::bigint AS provision_cents,
           (SELECT COUNT(*) FROM fiaon_stunden)::int AS stunden,
           (SELECT COUNT(*) FROM fiaon_raten_arbeit)::int AS arbeit,
           (SELECT COUNT(*) FROM fiaon_vermerke)::int AS vermerke,
           (SELECT COUNT(*) FROM fiaon_onboarding_schritte)::int AS schritte
  `;

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("1. Teil 0: die vier Altfunktionen am neuen Ort");
  // ═══════════════════════════════════════════════════════════════════════
  ok("Die alte Team-Seite existiert nicht mehr", !existsSync("client/src/pages/admin-team.tsx"));
  ok("Die alte Nachbuchung existiert nicht mehr", !existsSync("client/src/pages/admin-nachbuchung.tsx"));

  const app = readFileSync("client/src/App.tsx", "utf8");
  ok("Kein Import auf die Altseiten", !/pages\/admin-team"|pages\/admin-nachbuchung"/.test(app));
  ok("Kein AdminTeamPage mehr", !/AdminTeamPage/.test(app));
  ok("Kein AdminNachbuchungPage mehr", !/AdminNachbuchungPage/.test(app));
  ok("/admin/team-alt leitet um", /path="\/admin\/team-alt" component=\{\(\) => <Umleitung/.test(app));
  ok("/admin/nachbuchung leitet um", /path="\/admin\/nachbuchung" component=\{\(\) => <Umleitung/.test(app));
  // Auf ROUTEN prüfen, nicht auf das Wort: Der Kommentar über der Umleitung
  // erklärt, warum die Altseiten weg sind — er darf den Namen nennen.
  ok("Keine Route mehr auf nachbuchung-alt", !/path="\/admin\/nachbuchung-alt"/.test(app));
  ok("Auch kein Import darauf", !/admin-nachbuchung/.test(app));

  const verw = readFileSync("client/src/components/admin/TeamVerwaltung.tsx", "utf8");
  // Die Endpunkte MÜSSEN dieselben sein — ein Umbau wäre die Gelegenheit
  // gewesen, still etwas zu verlieren.
  for (const [name, endpunkt] of [
    ["Skripte laden", "/admin/scripts"],
    ["Skript anlegen", 'api("/admin/scripts", {'],
    ["Skript umschalten", "/admin/scripts/${s.id}/update"],
    ["Skript entfernen", "/admin/scripts/${s.id}/delete"],
    ["Skripte sortieren", "/admin/scripts/reorder"],
    ["Partner-Anfragen laden", "/admin/team/partner-suggestions"],
    ["Partner ablehnen", "/admin/team/partner-suggestions/${s.id}/reject"],
    ["Meilensteine laden", "/admin/team/milestones"],
    ["Meilenstein abhaken", "/admin/team/milestones/${m.id}/done"],
    ["Einstellungen laden", '"/admin/settings"'],
  ] as const) {
    ok(`Endpunkt unverändert: ${name}`, verw.includes(endpunkt), endpunkt);
  }
  ok("Alle vier Bausteine sind exportiert",
    ["PartnerSuggestionsCard", "MilestoneTasksCard", "SettingsCard", "ScriptsAdmin"]
      .every((n) => verw.includes(`export function ${n}`)));

  const zentrale = readFileSync("client/src/pages/admin-team-zentrale.tsx", "utf8");
  ok("Die Zentrale bindet alle vier ein",
    ["PartnerSuggestionsCard", "MilestoneTasksCard", "ScriptsAdmin", "SettingsCard"]
      .every((n) => new RegExp(`<${n}`).test(zentrale)));
  ok("… und das Einladen-Fenster", /<InviteModal/.test(zentrale));
  ok("Es gibt Reiter statt einer Endlosseite", /reiter === "skripte"/.test(zentrale));

  // ── Voice-SDK ──────────────────────────────────────────────────────────
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  ok("@twilio/voice-sdk ist installiert", !!pkg.dependencies?.["@twilio/voice-sdk"]);
  ok("… und liegt in node_modules", existsSync("node_modules/@twilio/voice-sdk"));
  const softphone = readFileSync("client/src/components/Softphone.tsx", "utf8");
  ok("Das Panel bindet das SDK ein", /await import\("@twilio\/voice-sdk"\)/.test(softphone));
  ok("… nachgeladen, nicht statisch importiert",
    !/^import .*@twilio\/voice-sdk/m.test(softphone));
  ok("Es verbindet über device.connect", /\.connect\(\{ params: \{ To:/.test(softphone));
  ok("Stummschalten geht auf die Verbindung", /verbindung\.current\?\.mute\?\.\(/.test(softphone));
  ok("Tasten gehen ins Gespräch", /sendDigits\?\.\(/.test(softphone));
  ok("Beim Verlassen wird aufgelegt", /useEffect\(\(\) => \(\) => \{[\s\S]{0,200}disconnect/.test(softphone));
  ok("Ohne Zugangsdaten bleibt der Einrichtungs-Zustand", /Noch nicht freigeschaltet/.test(softphone));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("2. Rolle, Zusage, Grenzen");
  // ═══════════════════════════════════════════════════════════════════════
  const team = readFileSync("server/routes/fiaon-team.ts", "utf8");
  ok("Die Rolle 'inkasso' ist vergebbar", /"inkasso"/.test(team));
  const bereich = readFileSync("server/routes/fiaon-inkasso-bereich.ts", "utf8");
  ok("Falsche Rolle bekommt 404, nicht 403",
    /istInkasso[\s\S]{0,200}status\(404\)/.test(bereich));
  ok("Ohne Zusage 403", /zusageStand[\s\S]{0,200}status\(403\)/.test(bereich));
  ok("Die Wand steht VOR jeder Arbeitsroute", (bereich.match(/await wand\(req, res\)/g) || []).length >= 6);

  gleich("Die Erklärung hat eine Fassung", INKASSO_ZUSAGE_TEXT.version, INKASSO_ZUSAGE_VERSION);
  for (const wort of ["Zweckbindung", "Vertraulichkeit", "Drohsprache", "Würde", "Meldepflicht"]) {
    ok(`Die Erklärung nennt ${wort}`,
      INKASSO_ZUSAGE_TEXT.pflichten.some((p) => p.titel.includes(wort)));
  }
  ok("Sie verbietet Erlass und Stundung ausdrücklich",
    INKASSO_ZUSAGE_TEXT.kannNicht.some((z) => /erlassen, stunden/.test(z)));
  ok("Sie verbietet Dokumenteinsicht",
    INKASSO_ZUSAGE_TEXT.kannNicht.some((z) => /Kundendokumente öffnen/.test(z)));
  ok("Sie verbietet den Zugriff auf Leads",
    INKASSO_ZUSAGE_TEXT.kannNicht.some((z) => /keine Leads/.test(z)));

  // ── ERLASS, STUNDUNG, STORNO EXISTIEREN NICHT ──────────────────────────
  const lib = readFileSync("server/lib/fiaon-inkasso.ts", "utf8");
  for (const verboten of ["erlass", "stundung", "storno", "kulanz"]) {
    ok(`Keine Funktion für „${verboten}“ in der Bibliothek`,
      !new RegExp(`function\\s+\\w*${verboten}`, "i").test(lib));
    ok(`Keine Route für „${verboten}“ im Bereich`,
      !new RegExp(`router\\.(post|patch|put)\\([^)]*${verboten}`, "i").test(bereich));
  }
  ok("Die Bibliothek ändert keinen Ratenbetrag", !/SET[\s\S]{0,80}betrag_cents\s*=/.test(lib));
  ok("… und keine Fälligkeit", !/SET[\s\S]{0,80}faellig_am\s*=/.test(lib));
  gleich("Es gibt genau vier Ratenergebnisse", RATEN_ERGEBNISSE.length, 4);
  ok("… und kein fünftes wird angenommen",
    !istRatenErgebnis("erlass") && !istRatenErgebnis("stundung") && istRatenErgebnis("zahlt_am"));

  // ── SICHTFELD ──────────────────────────────────────────────────────────
  ok("Das Sichtfeld verlangt eine BEZAHLTE Bestellung", /payment_status = 'paid'/.test(SICHTFELD));
  ok("… schließt Archiviertes aus", /archived_at IS NULL/.test(SICHTFELD));
  ok("… schließt DSGVO-Gelöschtes aus", /gdpr_deleted_at IS NULL/.test(SICHTFELD));
  ok("… und Zusammengeführtes", /merged_into IS NULL/.test(SICHTFELD));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("3. Erste Schritte je Rolle");
  // ═══════════════════════════════════════════════════════════════════════
  for (const rolle of ["agent", "vertriebsleiter", "onboarding", "inkasso"] as const) {
    const s = streckeFuer(rolle);
    ok(`${rolle}: Strecke vorhanden`, !!s && s.schritte.length >= 5, String(s?.schritte.length));
    ok(`${rolle}: 3 bis 5 Anleitungskarten`, s.karten.length >= 3 && s.karten.length <= 5, String(s.karten.length));
    ok(`${rolle}: erste Aufgabe mit Ziel`, !!s.ersteAufgabe.href && s.ersteAufgabe.text.length > 40);
    ok(`${rolle}: Der Vertrag wird erkannt`,
      s.schritte.some((x) => x.schluessel === "vertrag" && x.automatisch));
    // Die Verpflichtungserklärung gibt es NUR dort, wo man sie annehmen kann
    // (11.08.2026). Für die Rolle „agent" existiert keine solche Stelle — der
    // Schritt stand trotzdem in ihrer Liste und war eine Sackgasse.
    const hatZusage = s.schritte.some((x) => x.schluessel === "zusage");
    ok(`${rolle}: Erklärung nur, wo es sie gibt`,
      rolle === "agent" ? !hatZusage : hatZusage);
    if (hatZusage) {
      ok(`${rolle}: … mit einem Weg dorthin`,
        !!s.schritte.find((x) => x.schluessel === "zusage")?.ziel?.href);
    }
    ok(`${rolle}: „erstes Ergebnis“ wird erkannt, nicht geklickt`,
      s.schritte.some((x) => x.schluessel === "erstes_ergebnis" && x.automatisch));
  }
  ok("Verkauf erklärt die Stufen A/B/C", STRECKEN.agent.karten.some((k) => k.schema === "stufen"));
  ok("Verkauf erklärt das Softphone", STRECKEN.agent.karten.some((k) => k.schema === "telefon"));
  ok("Onboarding erklärt Startgespräche", STRECKEN.onboarding.karten.some((k) => k.schema === "termin"));
  ok("Inkasso erklärt die Ratenreihenfolge", STRECKEN.inkasso.karten.some((k) => k.schema === "raten"));
  ok("Inkasso nennt die vier Ergebnisse und was fehlt",
    STRECKEN.inkasso.karten.some((k) => /Erlass, Stundung/.test(k.text)));
  const tafel = readFileSync("client/src/components/ErsteSchritte.tsx", "utf8");
  ok("Die Tafel blockiert nicht", /Später — im Profil wiederfinden/.test(tafel));
  ok("… und die Schemata sind gezeichnet, keine Bilder",
    /<svg/.test(tafel) && !/<img/.test(tafel));

  try {
    await sqlPool.begin(async (tx) => {
      const [agentA] = (await tx`
        SELECT id, name FROM fiaon_agents WHERE active AND NOT is_test_account ORDER BY id LIMIT 1
      `) as any[];
      const [agentB] = (await tx`
        SELECT id, name FROM fiaon_agents WHERE active AND NOT is_test_account AND id <> ${agentA.id}
        ORDER BY id LIMIT 1
      `) as any[];

      const person = async (f: Record<string, unknown> = {}): Promise<number> => {
        const [r] = await tx`
          INSERT INTO fiaon_persons ${tx({
            person_ref: `FIAON-P-IK${stempel}${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
            first_name: "Prüf", last_name: `Inkasso${stempel}`, priority_tier: 0, tier_reason: "bezahlt", ...f,
          } as any)} RETURNING id
        `;
        return Number(r.id);
      };
      const bestellung = async (f: Record<string, unknown>): Promise<string> => {
        const [r] = await tx`
          INSERT INTO fiaon_applications ${tx({
            type: "private", status: "completed", payment_status: "paid", ...f,
          } as any)} RETURNING ref
        `;
        return String(r.ref);
      };
      const rate = async (f: Record<string, unknown>): Promise<number> => {
        const [r] = await tx`
          INSERT INTO fiaon_abo_raten ${tx({
            status: "offen", quelle: "auto", betrag_cents: 7999, ...f,
          } as any)} RETURNING id
        `;
        return Number(r.id);
      };

      // ═══════════════════════════════════════════════════════════════════
      gruppe("4. Sichtfeld: was Inkasso NICHT sieht");
      // ═══════════════════════════════════════════════════════════════════
      // Ein bezahlter Kunde mit Rate — SOLL sichtbar sein.
      const pOk = await person();
      const rOk = await bestellung({
        ref: REF("OK"), person_id: pOk, payment_status: "paid", amount_due: 79.99,
        payment_reference: `VZ${stempel}`, pack_name: "FIAON Ultra", phone: "1712345678",
        phone_country_code: "+49", first_name: "Zahlt", last_name: `Inkasso${stempel}`,
      });
      const rateOk = await rate({
        ref: rOk, rate_nr: 3, zahlungsreferenz: `VZ${stempel}-3`,
        faellig_am: berlinPlusTage(-20), mahnstufe: 2, erinnerungen: 2,
      });

      // Ein LEAD mit Rate — darf NICHT sichtbar sein.
      const pLead = await person({ priority_tier: 3, tier_reason: "nur_lead" });
      const rLead = await bestellung({
        ref: REF("LEAD"), person_id: pLead, payment_status: "pending_payment",
        payment_reference: `VZL${stempel}`,
      });
      const rateLead = await rate({
        ref: rLead, rate_nr: 1, zahlungsreferenz: `VZL${stempel}-1`, faellig_am: berlinPlusTage(-5),
      });

      // Eine ARCHIVIERTE bezahlte Bestellung — darf NICHT sichtbar sein.
      const pArch = await person();
      const rArch = await bestellung({
        ref: REF("ARCH"), person_id: pArch, payment_status: "paid",
        archived_at: new Date(), payment_reference: `VZA${stempel}`,
      });
      const rateArch = await rate({
        ref: rArch, rate_nr: 2, zahlungsreferenz: `VZA${stempel}-2`, faellig_am: berlinPlusTage(-9),
      });

      const liste = await arbeitsliste({ limit: 200 }, tx as any);
      const ids = liste.map((f: any) => Number(f.rate_id));
      ok("Der bezahlte Kunde mit Rate steht in der Liste", ids.includes(rateOk));
      ok("Der LEAD steht NICHT in der Liste", !ids.includes(rateLead));
      ok("Die ARCHIVIERTE Bestellung steht NICHT in der Liste", !ids.includes(rateArch));
      ok("Die Antwort enthält keine Dokumentinhalte",
        !JSON.stringify(liste).match(/id_card_pdf|bank_statement_pdf|schufa_pdf/));
      const zeile = liste.find((f: any) => Number(f.rate_id) === rateOk);
      ok("Die Zeile trägt den Verwendungszweck der RATE",
        zeile?.zahlungsreferenz === `VZ${stempel}-3`, zeile?.zahlungsreferenz);
      ok("… und die Mahnstufe", Number(zeile?.mahnstufe) === 2);
      ok("… und wie lange sie überfällig ist", Number(zeile?.tage_ueberfaellig) >= 19);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("5. Arbeitsliste: die Reihenfolge");
      // ═══════════════════════════════════════════════════════════════════
      const p1 = await person(); const p2 = await person(); const p3 = await person();
      const b1 = await bestellung({ ref: REF("S1"), person_id: p1, payment_reference: `S1${stempel}` });
      const b2 = await bestellung({ ref: REF("S2"), person_id: p2, payment_reference: `S2${stempel}` });
      const b3 = await bestellung({ ref: REF("S3"), person_id: p3, payment_reference: `S3${stempel}` });
      const s1 = await rate({ ref: b1, rate_nr: 1, zahlungsreferenz: `S1${stempel}-1`, faellig_am: berlinPlusTage(-8), mahnstufe: 1 });
      const s2 = await rate({ ref: b2, rate_nr: 1, zahlungsreferenz: `S2${stempel}-1`, faellig_am: berlinPlusTage(-16), mahnstufe: 2 });
      const s3 = await rate({ ref: b3, rate_nr: 1, zahlungsreferenz: `S3${stempel}-1`, faellig_am: berlinPlusTage(-30), mahnstufe: 3 });

      const sortiert = await arbeitsliste({ limit: 200 }, tx as any);
      const pos = (id: number) => sortiert.findIndex((f: any) => Number(f.rate_id) === id);
      ok("Stufe 3 steht vor Stufe 2", pos(s3) < pos(s2), `${pos(s3)} < ${pos(s2)}`);
      ok("Stufe 2 steht vor Stufe 1", pos(s2) < pos(s1), `${pos(s2)} < ${pos(s1)}`);
      const anrufPflicht = sortiert.find((f: any) => Number(f.rate_id) === s3);
      ok("Stufe 3 nach 30 Tagen ist Anruf-Pflicht", anrufPflicht?.anruf_pflicht === true);
      ok("Stufe 1 nach 8 Tagen ist es NICHT",
        sortiert.find((f: any) => Number(f.rate_id) === s1)?.anruf_pflicht === false);

      // Gebrochene Zusage steigt.
      await tx`UPDATE fiaon_abo_raten SET inkasso_zusage_am = ${berlinPlusTage(-2)} WHERE id = ${s1}`;
      const mitBruch = await arbeitsliste({ limit: 200 }, tx as any);
      const posB = (id: number) => mitBruch.findIndex((f: any) => Number(f.rate_id) === id);
      ok("Eine gebrochene Zusage steigt über Stufe 2", posB(s1) < posB(s2), `${posB(s1)} < ${posB(s2)}`);
      ok("… und ist als solche gekennzeichnet",
        mitBruch.find((f: any) => Number(f.rate_id) === s1)?.zusage_gebrochen === true);

      // Wiedervorlage in der Zukunft nimmt vom Tisch.
      await tx`UPDATE fiaon_abo_raten SET inkasso_wiedervorlage = ${berlinPlusTage(5)} WHERE id = ${s2}`;
      const ohne = await arbeitsliste({ limit: 200 }, tx as any);
      ok("Eine Wiedervorlage in der Zukunft nimmt die Rate vom Tisch",
        !ohne.some((f: any) => Number(f.rate_id) === s2));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("6. Ratenergebnisse");
      // ═══════════════════════════════════════════════════════════════════
      const zusage = await ratenErgebnisAnwenden({
        rateId: rateOk, ergebnis: "zahlt_am", agentId: Number(agentA.id),
        agentName: String(agentA.name), zusageDatum: berlinPlusTage(6),
      }, tx as any);
      ok("Zusage angenommen", zusage.ok, zusage.fehler);
      gleich("… mit der Zusage am genannten Tag", zusage.zusage, berlinPlusTage(6));
      ok("… und Wiedervorlage EINEN Tag danach",
        zusage.wiedervorlage === berlinPlusTage(7), `${zusage.wiedervorlage} vs ${berlinPlusTage(7)}`);
      const [nachZusage] = (await tx`
        SELECT inkasso_zusage_am, inkasso_wiedervorlage, inkasso_agent_id FROM fiaon_abo_raten WHERE id = ${rateOk}
      `) as any[];
      ok("Die Rate trägt die Zusage", !!nachZusage.inkasso_zusage_am);
      gleich("… und den Bearbeiter", Number(nachZusage.inkasso_agent_id), Number(agentA.id));

      const gestern = await ratenErgebnisAnwenden({
        rateId: rateOk, ergebnis: "zahlt_am", agentId: Number(agentA.id),
        agentName: String(agentA.name), zusageDatum: berlinPlusTage(-3),
      }, tx as any);
      ok("Eine Zusage in der Vergangenheit wird abgelehnt", !gestern.ok);
      const ohneDatum = await ratenErgebnisAnwenden({
        rateId: rateOk, ergebnis: "zahlt_am", agentId: Number(agentA.id), agentName: String(agentA.name),
      }, tx as any);
      ok("Eine Zusage ohne Datum wird abgelehnt", !ohneDatum.ok);

      // Eskalation braucht eine Notiz.
      const ohneNotiz = await ratenErgebnisAnwenden({
        rateId: s3, ergebnis: "eskalation", agentId: Number(agentA.id), agentName: String(agentA.name),
      }, tx as any);
      ok("Eskalation ohne Begründung wird abgelehnt", !ohneNotiz.ok);
      ok("… mit einer Erklärung, die sagt warum", /Betreiber nicht entscheiden/.test(ohneNotiz.fehler || ""));

      const vorVermerk = Number(((await tx`SELECT COUNT(*)::int AS n FROM fiaon_vermerke`) as any[])[0].n);
      const esk = await ratenErgebnisAnwenden({
        rateId: s3, ergebnis: "eskalation", agentId: Number(agentA.id), agentName: String(agentA.name),
        notiz: "Kunde hat angekündigt, Privatinsolvenz anzumelden. Bittet um Rückruf durch die Geschäftsleitung.",
      }, tx as any);
      ok("Eskalation mit Begründung läuft", esk.ok, esk.fehler);
      const nachVermerk = Number(((await tx`SELECT COUNT(*)::int AS n FROM fiaon_vermerke`) as any[])[0].n);
      gleich("… und erzeugt GENAU EINE Aufgabe", nachVermerk - vorVermerk, 1);
      const [aufgabe] = (await tx`
        SELECT art, fuer_betreiber, dringend, text, status FROM fiaon_vermerke ORDER BY id DESC LIMIT 1
      `) as any[];
      ok("Die Aufgabe geht an den Betreiber", aufgabe.fuer_betreiber === true && aufgabe.art === "aufgabe");
      ok("… ist dringend und offen", aufgabe.dringend === true && aufgabe.status === "offen");
      ok("… enthält die Notiz wörtlich", /Privatinsolvenz/.test(String(aufgabe.text)));
      ok("… nennt Rate, Betrag und Verwendungszweck",
        /Rate 1/.test(String(aufgabe.text)) && /Verwendungszweck/.test(String(aufgabe.text)));
      ok("… und sagt, dass nur der Betreiber nachlassen darf",
        /nur der Betreiber/.test(String(aufgabe.text)));

      // Alles landet in der Kundenakte.
      const [akte] = (await tx`
        SELECT outcome, note FROM fiaon_contact_log WHERE ref = ${rOk} ORDER BY id DESC LIMIT 1
      `) as any[];
      ok("Die Arbeit steht in der Kundenakte", /Forderungsmanagement/.test(String(akte?.note)));
      ok("… mit einem eigenen Ergebnis-Schlüssel", /^rate_/.test(String(akte?.outcome)));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("7. Prämie: nur bei Zahlung, nur mit Arbeit, nur einmal");
      // ═══════════════════════════════════════════════════════════════════
      // Vergütung noch NICHT bestätigt.
      await tx`
        UPDATE fiaon_agents SET stundensatz_cents = 1500, inkasso_praemie_art = 'euro',
          inkasso_praemie_wert = 200, verguetung_bestaetigt_am = NULL WHERE id = ${agentA.id}
      `;
      const ohneFreigabe = await praemieBuchen(rateOk, tx as any);
      ok("Ohne bestätigte Vergütung wird NICHTS gebucht", !ohneFreigabe.gebucht);
      ok("… mit dem Grund im Klartext", /nicht vom Betreiber bestätigt/.test(ohneFreigabe.grund));

      await tx`UPDATE fiaon_agents SET verguetung_bestaetigt_am = NOW() WHERE id = ${agentA.id}`;

      const vorProv = Number(((await tx`SELECT COUNT(*)::int AS n FROM fiaon_commissions`) as any[])[0].n);
      const erste = await praemieBuchen(rateOk, tx as any);
      ok("Mit Arbeit und Freigabe wird gebucht", erste.gebucht, erste.grund);
      gleich("… an den Bearbeiter", erste.agentId, Number(agentA.id));
      gleich("… 2,00 € wie eingestellt", erste.cents, 200);
      const nachProv = Number(((await tx`SELECT COUNT(*)::int AS n FROM fiaon_commissions`) as any[])[0].n);
      gleich("GENAU EINE Gutschrift", nachProv - vorProv, 1);

      // Zweiter Versuch — Doppelbuchung unmöglich.
      const zweite = await praemieBuchen(rateOk, tx as any);
      ok("Ein zweiter Versuch bucht NICHT", !zweite.gebucht);
      ok("… mit dem Grund", /schon gebucht/.test(zweite.grund));
      const nachZwei = Number(((await tx`SELECT COUNT(*)::int AS n FROM fiaon_commissions`) as any[])[0].n);
      gleich("Zählprobe: es bleibt bei einer", nachZwei - vorProv, 1);
      const [gutschrift] = (await tx`
        SELECT agent_id, kind, amount_cents, payment_reference, note, status
        FROM fiaon_commissions WHERE ref = ${`RATE-${rateOk}`}
      `) as any[];
      gleich("Die Gutschrift ist als Inkasso gekennzeichnet", gutschrift.kind, "inkasso");
      gleich("… mit dem Verwendungszweck der Rate", gutschrift.payment_reference, `VZ${stempel}-3`);
      gleich("… und bestätigt", gutschrift.status, "bestaetigt");

      // SELBSTZAHLER: keine Arbeit, keine Prämie.
      const pSelbst = await person();
      const bSelbst = await bestellung({ ref: REF("SELBST"), person_id: pSelbst, payment_reference: `SB${stempel}` });
      const rateSelbst = await rate({
        ref: bSelbst, rate_nr: 1, zahlungsreferenz: `SB${stempel}-1`, faellig_am: berlinPlusTage(-2),
      });
      const selbst = await praemieBuchen(rateSelbst, tx as any);
      ok("Eine Rate OHNE Bearbeitung erzeugt KEINE Prämie", !selbst.gebucht);
      ok("… und sagt „Selbstzahler“", /Selbstzahler/.test(selbst.grund));

      // Eine Eskalation ist kein Einzug.
      const pEsk = await person();
      const bEsk = await bestellung({ ref: REF("ESK"), person_id: pEsk, payment_reference: `EK${stempel}` });
      const rateEsk = await rate({
        ref: bEsk, rate_nr: 1, zahlungsreferenz: `EK${stempel}-1`, faellig_am: berlinPlusTage(-40), mahnstufe: 3,
      });
      await ratenErgebnisAnwenden({
        rateId: rateEsk, ergebnis: "eskalation", agentId: Number(agentA.id), agentName: String(agentA.name),
        notiz: "Kunde nicht erreichbar, Nummer abgeschaltet, Post kommt zurück.",
      }, tx as any);
      const nurEsk = await praemieBuchen(rateEsk, tx as any);
      ok("Eine Eskalation allein erzeugt KEINE Prämie", !nurEsk.gebucht, nurEsk.grund);

      // Prozent statt Euro.
      const pProz = await person();
      const bProz = await bestellung({ ref: REF("PROZ"), person_id: pProz, payment_reference: `PZ${stempel}` });
      const rateProz = await rate({
        ref: bProz, rate_nr: 1, zahlungsreferenz: `PZ${stempel}-1`, faellig_am: berlinPlusTage(-3), betrag_cents: 10_000,
      });
      await ratenErgebnisAnwenden({
        rateId: rateProz, ergebnis: "ueberwiesen_beleg", agentId: Number(agentB.id), agentName: String(agentB.name),
      }, tx as any);
      await tx`
        UPDATE fiaon_agents SET inkasso_praemie_art = 'prozent', inkasso_praemie_wert = 500,
          verguetung_bestaetigt_am = NOW() WHERE id = ${agentB.id}
      `;
      const proz = await praemieBuchen(rateProz, tx as any);
      ok("Prozent-Prämie wird gebucht", proz.gebucht, proz.grund);
      gleich("5 % von 100,00 € sind 5,00 €", proz.cents, 500);
      gleich("… an den richtigen Mitarbeiter", proz.agentId, Number(agentB.id));

      // Der Buchungsweg hängt sie ein.
      const aboQuelle = readFileSync("server/routes/fiaon-abo.ts", "utf8");
      ok("Die Prämie hängt im BESTEHENDEN Ratenbuchungsweg",
        /raten\/:id\/bezahlt[\s\S]{0,2200}praemieBuchen/.test(aboQuelle));
      ok("… und ein Fehler dort wirft die Ratenbuchung nicht um",
        /try \{[\s\S]{0,300}praemieBuchen[\s\S]{0,200}catch/.test(aboQuelle));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("8. Stunden");
      // ═══════════════════════════════════════════════════════════════════
      const [h1] = (await tx`
        INSERT INTO fiaon_stunden (agent_id, tag, von, bis, minuten, notiz)
        VALUES (${agentA.id}, ${berlinToday()}::date, '09:00', '12:30', 210, 'Prüfstand')
        RETURNING id
      `) as any[];
      const v1 = await verdienst(Number(agentA.id), tx as any);
      gleich("Erfasste, unbestätigte Zeit steht als offen", v1.offeneMinuten, 210);
      gleich("… und zählt NICHT zum Verdienst", v1.stundenCents, 0);
      ok("Die Prämie zählt schon", Number(v1.praemienCents) >= 200, String(v1.praemienCents));

      await tx`
        UPDATE fiaon_stunden SET bestaetigt_am = NOW(), bestaetigt_von = 'Betreiber' WHERE id = ${h1.id}
      `;
      const v2 = await verdienst(Number(agentA.id), tx as any);
      gleich("Nach Bestätigung zählt sie", v2.bestaetigtMinuten, 210);
      // 3,5 Std × 15,00 € = 52,50 €
      gleich("3,5 Std zu 15,00 € sind 52,50 €", v2.stundenCents, 5250);
      gleich("Gesamt ist Stunden plus Prämien",
        v2.gesamtCents, Number(v2.stundenCents) + Number(v2.praemienCents));

      // Bestätigte Zeilen sind unveränderlich.
      const geaendert = (await tx`
        UPDATE fiaon_stunden SET entfernt_am = NOW()
        WHERE id = ${h1.id} AND bestaetigt_am IS NULL AND entfernt_am IS NULL
        RETURNING id
      `) as any[];
      gleich("Eine bestätigte Zeile lässt sich nicht entfernen", geaendert.length, 0);
      const bereichQuelle = readFileSync("server/routes/fiaon-inkasso-bereich.ts", "utf8");
      ok("Die Route erlaubt es auch nicht",
        /entfernen[\s\S]{0,400}bestaetigt_am IS NULL/.test(bereichQuelle));
      ok("… und erklärt warum", /Abrechnung nachträglich verschiebbar/.test(bereichQuelle));
      ok("Bestätigen legt eine Position im Auszahlungsweg an",
        /INSERT INTO fiaon_commissions[\s\S]{0,300}'stunden'/.test(bereichQuelle));
      ok("… und läuft in einer Transaktion", /sqlPool\.begin/.test(bereichQuelle));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("9. Kennzahlen");
      // ═══════════════════════════════════════════════════════════════════
      const z = await kennzahlen(tx as any);
      ok("Alle Kennzahlen sind Zahlen",
        ["heute_cents", "ueberfaellig_cents", "eingezogen_monat_cents", "anruf_pflicht"]
          .every((k) => Number.isFinite(Number(z[k]))));
      ok("Überfällig ist nach Stufen aufgeteilt",
        Number(z.stufe1_cents) + Number(z.stufe2_cents) + Number(z.stufe3_cents) <= Number(z.ueberfaellig_cents));
      ok("Die Quote hat einen Nenner", z.quote === null || Number(z.quote_nenner) > 0);
      ok("Die Anruf-Frist ist einstellbar", Number(z.anruf_pflicht_tage) >= 0);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("10. Erste Schritte: Fortschritt");
      // ═══════════════════════════════════════════════════════════════════
      await tx`
        INSERT INTO fiaon_onboarding_schritte (agent_id, schluessel) VALUES (${agentA.id}, 'space')
        ON CONFLICT DO NOTHING
      `;
      const [wieder] = (await tx`
        INSERT INTO fiaon_onboarding_schritte (agent_id, schluessel) VALUES (${agentA.id}, 'space')
        ON CONFLICT DO NOTHING RETURNING id
      `) as any[];
      ok("Ein Schritt lässt sich nicht doppelt abhaken", !wieder);
      const [n] = (await tx`
        SELECT COUNT(*)::int AS n FROM fiaon_onboarding_schritte
        WHERE agent_id = ${agentA.id} AND schluessel = 'space'
      `) as any[];
      gleich("… und steht genau einmal", Number(n.n), 1);

      // Der Willkommens-Post genau einmal.
      const vorPosts = Number(((await tx`SELECT COUNT(*)::int AS n FROM fiaon_posts`) as any[])[0].n);
      const { autoPost } = await import("../server/lib/fiaon-space");
      for (let i = 0; i < 3; i++) {
        await autoPost("neuzugang", `agent-pruef-${stempel}`, "Testperson ist neu im Team.", tx as any);
      }
      const nachPosts = Number(((await tx`SELECT COUNT(*)::int AS n FROM fiaon_posts`) as any[])[0].n);
      gleich("Der Willkommens-Post entsteht GENAU EINMAL", nachPosts - vorPosts, 1);
      const [post] = (await tx`
        SELECT text FROM fiaon_posts WHERE auto_schluessel = ${`agent-pruef-${stempel}`}
      `) as any[];
      ok("… und enthält keine Kundendaten", !/@|FIAON-|\+49/.test(String(post?.text)));

      throw new Zurueckrollen();
    });
  } catch (e) {
    if (!(e instanceof Zurueckrollen)) throw e;
  }

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("11. Gegenprobe: nichts geschrieben");
  // ═══════════════════════════════════════════════════════════════════════
  const [nachher] = await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_abo_raten)::int AS raten,
           (SELECT COUNT(*) FROM fiaon_commissions)::int AS provisionen,
           (SELECT COALESCE(SUM(amount_cents),0) FROM fiaon_commissions)::bigint AS provision_cents,
           (SELECT COUNT(*) FROM fiaon_stunden)::int AS stunden,
           (SELECT COUNT(*) FROM fiaon_raten_arbeit)::int AS arbeit,
           (SELECT COUNT(*) FROM fiaon_vermerke)::int AS vermerke,
           (SELECT COUNT(*) FROM fiaon_onboarding_schritte)::int AS schritte
  `;
  for (const feld of ["provisionen", "provision_cents", "stunden", "arbeit", "schritte"] as const) {
    gleich(`Unverändert: ${feld}`, nachher[feld], vorher[feld]);
  }
  ok(`Raten nicht verloren (${vorher.raten} → ${nachher.raten})`,
    Number(nachher.raten) >= Number(vorher.raten));
  gleich("Keine Vermerke übrig", nachher.vermerke, vorher.vermerke);
  const [reste] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_persons WHERE last_name = ${`Inkasso${stempel}`}
  `) as any[];
  gleich("Keine eigene Person übrig", Number(reste.n), 0);

  process.env.MAKE_WEBHOOK_URL = ECHT_MAKE;
  log(`\n══ Ergebnis: ${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen ══\n`);
  if (fehlgeschlagen > 0) { log("Fehlgeschlagen:"); for (const f of fehler) log(`  · ${f}`); }
  await sqlPool.end();
  process.exit(fehlgeschlagen > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("\nPrüfstand abgebrochen:", err);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
