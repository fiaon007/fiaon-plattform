// ═══════════════════════════════════════════════════════════════════════════
// WHATSAPP AN NEUE LEADS — DIE KETTE (23.09.2026, E-223)
//
// Justin, mit dem Verlauf von Lead #4664 vor Augen: „Warum keine
// WhatsApp-Nachricht geschickt, um den Kunden zu holen, zu closen? Warum kein
// Einwand? Mara muss sich da viel mehr Mühe geben."
//
// ── DER BEFUND ────────────────────────────────────────────────────────────
// Er hat recht, und die Ursache ist schlichter als gedacht: Es gab KEINEN Weg,
// der einem neuen Lead eine WhatsApp schickt. Gemessen an #4664 (gültige
// Handynummer +49170…, eigener Link, Person verknüpft): null WhatsApp-
// Nachrichten. Die einzigen Sender waren Mara als ANTWORT auf eine eingehende
// Nachricht, der Auftragsmotor und der Knopf in der Akte.
//
// Was der Mensch stattdessen bekam, war eine Mailsalve:
//   18:35 Begrüßung · 18:40 Rechnung · 18:45 Rückholung · 18:47 Abmeldung
// Dreizehn Minuten, drei Mails, dann weg — mit der Begründung „ist mir zu
// unsicher, im Voraus was einzahlen ist mir nichts". Das ist kein fehlender
// Verkaufsdruck, das ist zu viel Druck und kein Gespräch.
//
// ── WAS DIESE KETTE TUT ───────────────────────────────────────────────────
// Sie schickt dem Lead innerhalb von Minuten eine WhatsApp mit seinem eigenen
// Link — der Kanal, auf dem er antworten KANN. Antwortet er, übernimmt Mara
// im offenen Fenster und geht auf Einwände ein (fiaon-whatsapp-mara.ts).
// Antwortet er nicht, folgen Tag 1, 3, 7 und 14.
//
// ── DIE BREMSEN, UND WARUM JEDE EINZELNE DA IST ───────────────────────────
//   · Höchstens EINE Nachricht je Mensch und Tag. Die Mailsalve oben ist der
//     Grund; zwei Kanäle gleichzeitig zu bespielen macht es doppelt schlimm.
//   · Wer abgemeldet hat (`werbung_gesperrt_am`) oder „STOPP" geschrieben hat,
//     bekommt nichts. Das ist nicht Höflichkeit, das ist die Richtlinie.
//   · Wer bezahlt hat, ist raus — er bekommt die Aktivierungs-Nachricht, nicht
//     die Werbekette.
//   · Nur freigegebene Vorlagen. Was Meta nicht geprüft hat, geht nicht raus.
//   · Ein Tagesdeckel in Euro, wie überall sonst im Haus.
//   · Nachts nichts: 8 bis 20 Uhr Berliner Zeit.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { waSenden, vorlagenStand, waKonfig } from "./fiaon-whatsapp";
import { nummerFuerWhatsApp } from "../../shared/fiaon-whatsapp-erlaubnis";

/** Der Schalter. Vorgabe: AUS — Justin schaltet ihn im Steuerpult ein. */
export const SCHALTER = "lead_whatsapp_an";
const FRUEHESTENS = 8;
const SPAETESTENS = 20;

async function einstellung(k: string, vorgabe: string): Promise<string> {
  const [r] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${k}`.catch(() => [])) as any[];
  return String(r?.value ?? vorgabe);
}

export async function ketteAn(): Promise<boolean> {
  return (await einstellung(SCHALTER, "aus")) === "an";
}

/**
 * Welche Vorlage ist für diesen Menschen dran?
 *
 * Die Reihenfolge ist Absicht: Eine offene Rechnung schlägt jede Werbung.
 * Wer zahlen soll, bekommt den Zahlungsweg — nicht noch eine Erinnerung an
 * seinen Antrag.
 */
function vorlageFuer(tageSeitEingang: number, hatOffeneRechnung: boolean, antragBegonnen: boolean): string | null {
  if (hatOffeneRechnung) return "fiaon_kk_rechnung";
  if (tageSeitEingang <= 0) return antragBegonnen ? "fiaon_kk_antrag_offen" : "fiaon_kk_anfrage";
  if (tageSeitEingang === 1) return "fiaon_kk_tag1";
  if (tageSeitEingang === 3) return "fiaon_kk_tag3";
  if (tageSeitEingang === 7) return "fiaon_kk_tag7";
  if (tageSeitEingang === 14) return "fiaon_kk_letzte";
  return null;
}

export interface KettenLauf { geprueft: number; gesendet: number; uebersprungen: Record<string, number> }

export async function whatsappKetteLaufen(deckel = 60): Promise<KettenLauf> {
  const erg: KettenLauf = { geprueft: 0, gesendet: 0, uebersprungen: {} };
  const weg = (grund: string) => { erg.uebersprungen[grund] = (erg.uebersprungen[grund] ?? 0) + 1; };

  if (!(await ketteAn())) { weg("Kette aus"); return erg; }
  const k = waKonfig();
  if (!k.bereit) { weg("WhatsApp nicht eingerichtet"); return erg; }

  const [jetzt] = (await sqlPool`
    SELECT EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Europe/Berlin'))::int AS stunde`) as any[];
  const stunde = Number(jetzt?.stunde ?? 0);
  if (stunde < FRUEHESTENS || stunde >= SPAETESTENS) { weg("außerhalb der Zeit"); return erg; }

  const freigegeben = new Set(
    (await vorlagenStand().catch(() => [])).filter((t) => t.status === "APPROVED").map((t) => t.name),
  );
  if (freigegeben.size === 0) { weg("keine Vorlage freigegeben"); return erg; }

  // ── WER IST DRAN ────────────────────────────────────────────────────────
  // Menschen mit Handynummer, die heute noch keine WhatsApp bekommen haben,
  // nicht abgemeldet und nicht gesperrt sind und noch nichts bezahlt haben.
  const kandidaten = (await sqlPool`
    SELECT p.id AS person_id, p.primary_phone, p.werbung_gesperrt_am,
           TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS name,
           l.id AS lead_id, l.link_code,
           GREATEST(COALESCE(l.erstellt_am, p.created_at), p.created_at) AS eingang,
           EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
                     AND a.payment_status = 'paid') AS bezahlt,
           EXISTS (SELECT 1 FROM fiaon_applications a2 WHERE a2.person_id = p.id AND a2.merged_into IS NULL
                     AND a2.payment_status IN ('pending_payment','expired') AND a2.mahnstopp_am IS NULL) AS rechnung_offen,
           EXISTS (SELECT 1 FROM fiaon_applications a3 WHERE a3.person_id = p.id AND a3.merged_into IS NULL
                     AND NOT a3.ist_entwurf) AS antrag_begonnen,
           (SELECT a4.payment_reference FROM fiaon_applications a4 WHERE a4.person_id = p.id AND a4.merged_into IS NULL
              AND a4.payment_status IN ('pending_payment','expired') ORDER BY a4.created_at DESC LIMIT 1) AS zahlungsreferenz,
           (SELECT ROUND(a5.amount_due, 2) FROM fiaon_applications a5 WHERE a5.person_id = p.id AND a5.merged_into IS NULL
              AND a5.payment_status IN ('pending_payment','expired') ORDER BY a5.created_at DESC LIMIT 1) AS betrag
      FROM fiaon_persons p
      LEFT JOIN LATERAL (
        SELECT id, link_code, erstellt_am FROM fiaon_leads le
         WHERE le.person_id = p.id ORDER BY le.erstellt_am DESC LIMIT 1
      ) l ON TRUE
     WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL AND NOT p.is_blocked
       AND p.primary_phone IS NOT NULL
       AND p.werbung_gesperrt_am IS NULL
       AND p.created_at > NOW() - INTERVAL '30 days'
       -- Heute noch keine WhatsApp von uns
       AND NOT EXISTS (
         SELECT 1 FROM fiaon_whatsapp w
          WHERE w.person_id = p.id AND w.richtung = 'raus'
            AND (w.created_at AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date)
       -- Wer „STOPP" geschrieben hat, ist raus. Für immer.
       AND NOT EXISTS (
         SELECT 1 FROM fiaon_whatsapp s
          WHERE s.person_id = p.id AND s.richtung = 'rein'
            AND (s.text ILIKE '%stopp%' OR s.knopf ILIKE '%stopp%' OR s.text ILIKE '%keine nachrichten%'))
     ORDER BY p.created_at DESC
     LIMIT ${Math.min(Math.max(deckel, 1), 200)}`.catch((e) => { console.error("[LEAD-WA] Kandidaten:", e); return []; })) as any[];

  for (const c of kandidaten) {
    erg.geprueft++;
    if (c.bezahlt === true) { weg("bezahlt"); continue; }
    const nummer = nummerFuerWhatsApp(c.primary_phone);
    if (!nummer) { weg("keine WhatsApp-Nummer"); continue; }

    const tage = Math.floor((Date.now() - new Date(String(c.eingang)).getTime()) / 86400000);
    const vorlage = vorlageFuer(tage, c.rechnung_offen === true, c.antrag_begonnen === true);
    if (!vorlage) { weg("heute kein Schritt fällig"); continue; }
    if (!freigegeben.has(vorlage)) { weg(`Vorlage ${vorlage} noch nicht freigegeben`); continue; }

    // Die Werte je Vorlage — Name zuerst, dann was die Vorlage sonst braucht.
    const anrede = String(c.name || "").trim() || "und willkommen";
    const werte = vorlage === "fiaon_kk_rechnung"
      ? [anrede, String(c.betrag ?? "").replace(".", ",") || "0,00", String(c.zahlungsreferenz ?? "")]
      : [anrede];
    if (vorlage === "fiaon_kk_rechnung" && !c.zahlungsreferenz) { weg("Rechnung ohne Verwendungszweck"); continue; }

    const r = await waSenden(nummer, { vorlage, werte }, { personId: Number(c.person_id), leadId: c.lead_id ? Number(c.lead_id) : null, von: "Mara" });
    if (r.ok) {
      erg.gesendet++;
      await sqlPool`
        INSERT INTO fiaon_contact_log (person_id, agent_name, type, note, created_at)
        VALUES (${Number(c.person_id)}, 'Mara', 'system',
                ${`WhatsApp „${vorlage}" gesendet (Tag ${tage} nach Eingang).`}, NOW())`.catch(() => {});
    } else {
      weg(r.grund ?? "Senden fehlgeschlagen");
    }
  }

  if (erg.gesendet || erg.geprueft) {
    console.log(`[LEAD-WA] ${erg.gesendet} gesendet von ${erg.geprueft} geprüft · ${JSON.stringify(erg.uebersprungen)}`);
  }
  return erg;
}

/**
 * Sofort nach dem Eingang eines Leads — der wichtigste Moment.
 *
 * Speed-to-Lead ist bei Kaltkontakten der einzige Hebel, der messbar wirkt.
 * Diese Funktion wartet nicht auf den Takt; sie läuft im Anschluss an die
 * Lead-Anlage und schickt die erste Nachricht in Sekunden.
 */
export async function ersteWhatsAppFuerLead(leadId: number): Promise<{ ok: boolean; grund?: string }> {
  if (!(await ketteAn())) return { ok: false, grund: "Die WhatsApp-Kette ist aus." };
  const k = waKonfig();
  if (!k.bereit) return { ok: false, grund: "WhatsApp ist nicht eingerichtet." };
  const [l] = (await sqlPool`
    SELECT le.id, le.person_id, le.telefon, le.link_code,
           TRIM(COALESCE(le.vorname,'') || ' ' || COALESCE(le.nachname,'')) AS name,
           p.werbung_gesperrt_am, p.is_blocked
      FROM fiaon_leads le LEFT JOIN fiaon_persons p ON p.id = le.person_id
     WHERE le.id = ${leadId} LIMIT 1`.catch(() => [])) as any[];
  if (!l) return { ok: false, grund: "Lead nicht gefunden." };
  if (l.werbung_gesperrt_am || l.is_blocked) return { ok: false, grund: "Abgemeldet oder gesperrt." };
  const nummer = nummerFuerWhatsApp(l.telefon);
  if (!nummer) return { ok: false, grund: "Keine Nummer, über die WhatsApp läuft." };

  const freigegeben = new Set((await vorlagenStand().catch(() => [])).filter((t) => t.status === "APPROVED").map((t) => t.name));
  if (!freigegeben.has("fiaon_kk_anfrage")) return { ok: false, grund: "Die erste Vorlage ist bei Meta noch nicht freigegeben." };

  const r = await waSenden(
    nummer,
    { vorlage: "fiaon_kk_anfrage", werte: [String(l.name || "").trim() || "und willkommen"] },
    { personId: l.person_id ? Number(l.person_id) : null, leadId: Number(l.id), von: "Mara" },
  );
  if (r.ok) {
    console.log(`[LEAD-WA] Erste WhatsApp an Lead ${leadId} raus.`);
    await sqlPool`
      INSERT INTO fiaon_whatsapp_gespraech (nummer, person_id, lead_id, mara_an, updated_at)
      VALUES (${nummer}, ${l.person_id ?? null}, ${Number(l.id)}, TRUE, NOW())
      ON CONFLICT (nummer) DO UPDATE SET person_id = COALESCE(EXCLUDED.person_id, fiaon_whatsapp_gespraech.person_id), updated_at = NOW()`.catch(() => {});
  }
  return r.ok ? { ok: true } : { ok: false, grund: r.grund };
}
