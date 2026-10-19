// ═══════════════════════════════════════════════════════════════════════════
// JAHRESVERTRÄGE OHNE BELEGTE ANNAHME — EINE KARTE FÜR DIE LEITUNG (19.10.2026, E-396)
//
// Justins Regel vom 19.10. gibt jedem, der den Vertrag „durch Klick oder Unterschrift“ angenommen hat, die volle
// Laufzeit von zwölf Monaten (server/lib/fiaon-kuendigung.ts, Weg „laufzeit_ende“). Belegt ist die Annahme nur mit dem
// Vertrags-PDF (/antrag-neu) oder dem Knopf „Zahlungspflichtig annehmen“ (consent_contract). Gemessen am 19.10.2026
// (nur lesend): 8 bezahlte, ungekündigte Jahresverträge haben WEDER das eine NOCH das andere — und auch keine
// AGB-Zustimmung. Für sie bleibt das bisherige Verhalten (Kündigung → offene Rate → Ende), und die Leitung entscheidet
// mit einem Klick: den Zustimmungs-Link schicken (der Kunde nimmt Vertrag und AGB selbst an — dann gilt die volle
// Laufzeit) oder so lassen.
//
// Geladen über erweiterungenLaden (server/lib/fiaon-mara-entscheidungen.ts) — derselbe Weg wie die Karten des
// Postmeisters und der WhatsApp-Mara. Gelesen wird nur über `lauf` (lesend messbar, Prüfstand gegen lokale DB).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { entscheidungArt, detektorRegistrieren, werkzeugRegistrieren, ausfuehrErgebnis, type EntscheidungNeu } from "./fiaon-mara-entscheidungen";
import { ANNAHME_BELEGT_SQL } from "@shared/fiaon-jahresvertrag";
import { JAHRESVERTRAG_AB } from "@shared/fiaon-antrag-stand";
import { produktkategorieSql } from "@shared/fiaon-produktkategorie";

type Lauf = typeof sqlPool;

export const JV_OHNE_ANNAHME_ART = "jv_ohne_annahme";
entscheidungArt(JV_OHNE_ANNAHME_ART, "Jahresvertrag ohne Annahme", 75);

/** Bezahlte, ungekündigte Jahresverträge (Stufenpaket) ohne belegte Annahme — ohne Testkonten. */
export const JV_OHNE_ANNAHME_SQL = `
  SELECT a.ref, a.person_id, NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), '') AS name,
         SPLIT_PART(COALESCE(a.pack_name, ''), E'\\n', 1) AS paket, a.agb_stand::text AS agb,
         to_char(COALESCE((a.paid_at AT TIME ZONE 'Europe/Berlin')::date, a.completed_at::date), 'DD.MM.YYYY') AS bezahlt
    FROM fiaon_applications a
   WHERE a.merged_into IS NULL AND a.payment_status = 'paid' AND a.gekuendigt_am IS NULL
     AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
     AND a.agb_stand >= DATE '${JAHRESVERTRAG_AB}'
     AND ${produktkategorieSql("a")} = 'konto'
     AND NOT ${ANNAHME_BELEGT_SQL("a")}
     AND NOT EXISTS (SELECT 1 FROM fiaon_persons jv_pt WHERE jv_pt.id = a.person_id AND jv_pt.ist_test_am IS NOT NULL)
   ORDER BY a.created_at`;

export interface OhneAnnahmeFall { ref: string; personId: number | null; name: string | null; paket: string | null; bezahlt: string | null }

/** Die Liste — lesend (Messung, Karte, Prüfstand). */
export async function jahresvertraegeOhneAnnahme(lauf: Lauf = sqlPool): Promise<OhneAnnahmeFall[]> {
  const z = (await lauf.unsafe(JV_OHNE_ANNAHME_SQL)) as any[];
  return z.map((r) => ({ ref: String(r.ref), personId: r.person_id != null ? Number(r.person_id) : null, name: r.name ?? null, paket: r.paket || null, bezahlt: r.bezahlt ?? null }));
}

/** Der Schlüssel der Sammelkarte: die offene weiterführen, sonst eine neue Nummer (wie sammelSchluessel). */
async function schluesselFuer(lauf: Lauf): Promise<string> {
  const [t] = (await lauf.unsafe(`SELECT to_regclass('public.fiaon_mara_entscheidungen') IS NOT NULL AS da`)) as any[];
  if (!t?.da) return `${JV_OHNE_ANNAHME_ART}#1`;
  const [z] = (await lauf.unsafe(
    `SELECT (SELECT schluessel FROM fiaon_mara_entscheidungen WHERE art = $1 AND status IN ('offen', 'spaeter') ORDER BY id DESC LIMIT 1) AS offen,
            (SELECT COUNT(*)::int FROM fiaon_mara_entscheidungen WHERE art = $1) AS n`, [JV_OHNE_ANNAHME_ART]).catch(() => [])) as any[];
  return z?.offen ? String(z.offen) : `${JV_OHNE_ANNAHME_ART}#${Number(z?.n || 0) + 1}`;
}

/** Der Detektor: eine Sammelkarte, solange es solche Verträge gibt. */
export async function findeJahresvertraegeOhneAnnahme(lauf: Lauf = sqlPool): Promise<EntscheidungNeu[]> {
  const faelle = await jahresvertraegeOhneAnnahme(lauf);
  if (!faelle.length) return [];
  const n = faelle.length;
  return [{
    schluessel: await schluesselFuer(lauf),
    art: JV_OHNE_ANNAHME_ART,
    titel: `${n} ${n === 1 ? "Jahresvertrag" : "Jahresverträge"} ohne belegte Annahme`,
    text: "Bezahlt, AGB ab dem 03.09.2026 — aber weder Vertrags-PDF noch der Knopf „Zahlungspflichtig annehmen“ ist belegt (auch keine AGB-Zustimmung). "
      + "Ohne diesen Beleg gilt die Zwölf-Monats-Regel nicht sicher: Eine Kündigung läuft bei ihnen wie bisher (mit der Zahlung der offenen Rate endet der Vertrag). "
      + "Mit dem Zustimmungs-Link nimmt jeder den Vertrag selbst an — danach gilt die volle Laufzeit.",
    empfehlung: "zustimmung",
    optionen: [
      { key: "zustimmung", label: "Zustimmungs-Link an alle schicken", werkzeug: "jv_zustimmung_anfordern", args: { refs: faelle.map((f) => f.ref) }, ton: "gut",
        titel: "Jeder bekommt per E-Mail den Link zur Annahme (AGB und Vertrag, Knopf „Zahlungspflichtig annehmen“). Nimmt er an, gilt die volle Laufzeit von zwölf Monaten." },
      { key: "lassen", label: "So lassen (bisheriger Weg)", werkzeug: "nichts", ton: "neutral", titel: "Eine Kündigung läuft bei ihnen wie bisher." },
    ],
    belege: faelle.slice(0, 20).map((f) => ({ art: "zeile" as const, text: `${f.paket || "Paket"}${f.bezahlt ? ` · bezahlt ${f.bezahlt}` : ""}`, name: f.name, personId: f.personId })),
  }];
}

detektorRegistrieren({
  art: JV_OHNE_ANNAHME_ART, finden: findeJahresvertraegeOhneAnnahme,
  erledigtText: "Hat sich erledigt — alle Jahresverträge haben jetzt eine belegte Annahme (oder sind gekündigt).",
});

/**
 * „Zustimmungs-Link an alle schicken“ — derselbe Weg wie der Knopf in der Akte (POST …/zustimmungs-link): Lage prüfen,
 * Mail zustimmung_link über mailSenden, Vermerk im Verlauf. Jede Bestellung wird direkt davor neu geprüft (noch bezahlt,
 * ungekündigt, Annahme noch nicht belegt) — sonst nichts.
 */
werkzeugRegistrieren("jv_zustimmung_anfordern", async (args, k) => {
  const refs: string[] = Array.isArray(args?.refs) ? args.refs.map(String).slice(0, 50) : [];
  if (!refs.length) return ausfuehrErgebnis.fehler("Die Karte nennt keine Bestellung.");
  const offen = new Map((await jahresvertraegeOhneAnnahme(k.lauf)).map((f) => [f.ref, f]));
  const { zustimmungsLage, zustimmungLink } = await import("./fiaon-zustimmung");
  const { mailSenden } = await import("./fiaon-mail-senden");
  let raus = 0, ohneMail = 0, schon = 0;
  for (const ref of refs) {
    const f = offen.get(ref);
    if (!f || !f.personId) { schon++; continue; }
    const lage = await zustimmungsLage(ref, k.lauf);
    if (!lage || lage.fertig || !lage.spalten.includes("consent_contract")) { schon++; continue; }
    const offenText = lage.offen.join(", ");
    const v = await mailSenden({
      event: "zustimmung_link", personId: f.personId,
      zusatz: { zustimmung_url: zustimmungLink(ref), offen: offenText, paket: lage.paket ?? "", paket_satz: lage.paket ? ` über ${lage.paket}` : "" },
      akteur: { name: k.von, agentId: k.agentId, rolle: "admin" as any },
    }).catch((e) => ({ ok: false, grund: e instanceof Error ? e.message : String(e) }));
    const gesendet = (v as any).ok === true;
    if (gesendet) raus++; else ohneMail++;
    await k.lauf`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
      VALUES (${ref}, ${f.personId}, ${k.agentId}, ${`Mara (Entscheidung: ${k.von})`.slice(0, 120)}, 'system',
              ${gesendet
                ? `Zustimmungs-Link per E-Mail geschickt (Jahresvertrag ohne belegte Annahme, E-396; offen: ${offenText}). Nimmt er an, gilt die volle Laufzeit.`
                : `Zustimmungs-Link NICHT per E-Mail verschickt (${String((v as any).grund ?? "unbekannt").slice(0, 160)}) — Jahresvertrag ohne belegte Annahme (E-396).`}, NOW())`.catch(() => {});
  }
  if (!raus && !ohneMail) return ausfuehrErgebnis.vonSelbst("Nichts mehr zu schicken — alle haben inzwischen angenommen, gekündigt oder sind nicht mehr bezahlt.");
  return ausfuehrErgebnis.erledigt(`Zustimmungs-Link an ${raus} ${raus === 1 ? "Kunden" : "Kunden"} geschickt${ohneMail ? `, ${ohneMail} ohne Mail (Grund im Verlauf)` : ""}${schon ? `, ${schon} schon erledigt` : ""}.`);
});
