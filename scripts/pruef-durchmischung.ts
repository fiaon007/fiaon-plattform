// ═══════════════════════════════════════════════════════════════════════════
// Prüfstand für die zwei Meldungen vom 05.08.2026
//
//  A) „Die Kunden sind alle kreuz und quer gemischt, bezahlte Kunden tauchen
//     bei den Agenten auf." → Einstufung wurde nur von einem Handskript
//     geschrieben; nach einer Zahlung blieb die Person auf Tier 1 und wurde von
//     der Verteilung an den nächsten freien Agenten weitergegeben.
//
//  B) „Rechnung & Zahlungsdetails senden — Button ist da, geht nur nicht."
//     → In „Heute" war es ein mailto-Link (öffnete das Mailprogramm des
//     Agenten), und der echte Versand meldete Erfolg, ohne die Antwort von Make
//     abzuwarten.
//
// Der Server muss OHNE MAKE_WEBHOOK_URL laufen: Dann geht keine echte
// Kundenmail raus, und der Versand MUSS ehrlich scheitern — genau das prüfen wir.
//
// Aufruf: npx tsx scripts/pruef-durchmischung.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { createHmac } from "crypto";
import { sqlPool } from "../server/lib/db-pool";

const BASIS = process.env.BASIS || "http://localhost:5188";
const CODE = process.env.ADMIN_ACCESS_CODE || "20032017";
const heute = (() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d.toISOString().slice(0, 10); })();
const iso = (v: any) => (v ? new Date(v).toISOString().slice(0, 10) : null);

let rot = 0;
const pruefe = (name: string, gut: boolean, hinweis = "") => {
  if (!gut) rot++;
  console.log(`  ${gut ? "PASS" : "FAIL"}  ${name}${gut ? "" : `  → ${hinweis}`}`);
};

function agentCookie(id: number, epoch: number): string {
  const secret = process.env.SESSION_SECRET || "fiaon-dev-agent-secret";
  const exp = Date.now() + 3_600_000;
  const payload = `${id}.${epoch}.${exp}`;
  const sig = createHmac("sha256", secret).update(`agent2:${payload}`).digest("hex").slice(0, 40);
  return `fiaon_agent_token=${payload}.${sig}`;
}
async function ruf(pfad: string, cookie: string, init?: RequestInit) {
  const res = await fetch(`${BASIS}${pfad}`, {
    ...init, headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), cookie },
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

(async () => {
  const auf = await fetch(`${BASIS}/api/fiaon/zugang/oeffnen`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: CODE }),
  });
  const adminCookie = (auf.headers.get("set-cookie") || "").split(";")[0];

  const [ag] = await sqlPool`
    SELECT id, name, session_epoch FROM fiaon_agents
    WHERE active AND COALESCE(is_test_account, FALSE) = FALSE
      AND EXISTS (SELECT 1 FROM fiaon_persons p WHERE p.assigned_agent_id = fiaon_agents.id)
    ORDER BY id LIMIT 1
  `;
  const cookie = agentCookie(ag.id, Number(ag.session_epoch || 0));
  console.log(`Agent: ${ag.name} (#${ag.id})\n`);

  // ── A1 · Bestand ist sauber ───────────────────────────────────────────────
  console.log("── A1. Bestand: keine bezahlten Kunden im Vertrieb ──");
  const [bezahltDrin] = await sqlPool`
    SELECT COUNT(*)::int AS c FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL AND NOT p.is_blocked AND p.assigned_agent_id IS NOT NULL
      AND p.priority_tier BETWEEN 1 AND 2
      AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
                    AND a.payment_status = 'paid')
      AND NOT EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
                        AND a.payment_status IN ('pending_payment', 'claimed_paid'))
  `;
  pruefe("Kein vollständig bezahlter Kunde steht im Vertrieb", Number(bezahltDrin.c) === 0, `${bezahltDrin.c} gefunden`);

  const [falscherAgent] = await sqlPool`
    SELECT COUNT(*)::int AS c FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL AND p.assigned_agent_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
                    AND a.assigned_agent_id IS NOT NULL AND a.payment_status <> 'superseded')
      AND NOT EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
                        AND a.assigned_agent_id = p.assigned_agent_id)
  `;
  pruefe("Keine Person gehört zu einem Agenten ohne eigene Bestellung",
    Number(falscherAgent.c) === 0, `${falscherAgent.c} gefunden`);

  const [tierAlt] = await sqlPool.unsafe(`
    WITH t AS (${(await import("../server/lib/tier")).personTierSql()})
    SELECT COUNT(*)::int AS c FROM fiaon_persons p JOIN t ON t.person_id = p.id
    WHERE p.priority_tier IS DISTINCT FROM t.priority_tier`) as any[];
  pruefe("Gespeicherte Einstufung stimmt mit der Berechnung überein",
    Number(tierAlt.c) === 0, `${tierAlt.c} abweichend`);

  // ── A2 · Eine Zahlung nimmt den Kunden LIVE aus dem Vertrieb ──────────────
  console.log("\n── A2. Zahlung wirkt sofort ──");
  const [kandidat] = await sqlPool`
    SELECT p.id AS person_id, p.assigned_agent_id, p.priority_tier, p.tier_reason,
           p.follow_up_date, p.promised_payment_date,
           a.ref, a.payment_status, a.payment_reference, a.completed_at, a.assigned_agent_id AS app_agent
    FROM fiaon_persons p
    JOIN fiaon_applications a ON a.person_id = p.id AND a.merged_into IS NULL
    WHERE p.merged_into_person_id IS NULL AND p.priority_tier BETWEEN 1 AND 2
      AND a.payment_status IN ('pending_payment', 'claimed_paid')
      AND a.payment_reference IS NOT NULL
    ORDER BY p.id DESC LIMIT 1
  `;
  const zurueck = { ...kandidat };
  console.log(`   Prüfkunde: ${kandidat.ref} (Tier ${kandidat.priority_tier}, ${kandidat.tier_reason})`);

  // Zahlung buchen — derselbe Weg wie in der Zahlungszentrale.
  const buchen = await ruf(`/api/fiaon/admin/payments/${encodeURIComponent(kandidat.payment_reference)}/mark-paid`,
    adminCookie, { method: "POST", body: JSON.stringify({ zahlungsdatum: heute }) });
  pruefe("Zahlung wird gebucht", buchen.status === 200 && buchen.body?.ok, JSON.stringify(buchen.body).slice(0, 140));

  // Der Provisions-Hook läuft absichtlich asynchron (eine Zahlung darf nicht auf
  // Folgeschritte warten). Also wird auf die Wirkung GEWARTET statt eine
  // Sekundenzahl zu raten: Ein fester Schlaf ist auf einem schnellen Rechner
  // grün und auf einer langsamen Verbindung rot — und misst dann die Latenz,
  // nicht die Funktion.
  let nachher: any = null;
  for (let versuch = 0; versuch < 30; versuch++) {
    const [row] = await sqlPool`
      SELECT priority_tier, tier_reason, follow_up_date, promised_payment_date, assigned_agent_id
      FROM fiaon_persons WHERE id = ${kandidat.person_id}
    `;
    nachher = row;
    if (Number(row.priority_tier) === 0) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  pruefe("Person ist sofort Tier 0 (bezahlt) — raus aus dem Vertrieb",
    Number(nachher.priority_tier) === 0 && nachher.tier_reason === "bezahlt",
    `Tier ${nachher.priority_tier} (${nachher.tier_reason})`);
  pruefe("Wiedervorlage und Zusage sind gelöscht (keine Anrufliste mehr)",
    !nachher.follow_up_date && !nachher.promised_payment_date,
    `WV ${iso(nachher.follow_up_date)} · Zusage ${iso(nachher.promised_payment_date)}`);

  // Die Anrufliste des Agenten darf den Kunden nicht mehr enthalten.
  const agentCookie2 = agentCookie(Number(nachher.assigned_agent_id || ag.id), 0);
  const [epoch] = await sqlPool`SELECT session_epoch FROM fiaon_agents WHERE id = ${nachher.assigned_agent_id || ag.id}`;
  const c2 = agentCookie(Number(nachher.assigned_agent_id || ag.id), Number(epoch?.session_epoch || 0));
  const liste = await ruf("/api/fiaon/agent/crm/kunden?state=offen", c2);
  const drin = (liste.body?.kunden || []).some((k: any) => k.personId === kandidat.person_id);
  pruefe("Der bezahlte Kunde steht in KEINER Anrufliste mehr", !drin);

  // Zurücksetzen — der Prüfkunde soll wieder offen sein.
  await sqlPool`
    UPDATE fiaon_applications SET payment_status = ${zurueck.payment_status},
      completed_at = ${zurueck.completed_at}, status = 'payment_pending', updated_at = NOW()
    WHERE ref = ${zurueck.ref}
  `;
  await sqlPool`
    UPDATE fiaon_persons SET priority_tier = ${zurueck.priority_tier}, tier_reason = ${zurueck.tier_reason},
      follow_up_date = ${zurueck.follow_up_date}, promised_payment_date = ${zurueck.promised_payment_date},
      assigned_agent_id = ${zurueck.assigned_agent_id}, updated_at = NOW()
    WHERE id = ${zurueck.person_id}
  `;
  await sqlPool`DELETE FROM fiaon_abo_raten WHERE ref = ${zurueck.ref}`;
  await sqlPool`DELETE FROM fiaon_contact_log WHERE ref = ${zurueck.ref} AND created_at > NOW() - INTERVAL '5 minutes'`;
  const [kontrolle] = await sqlPool`SELECT payment_status FROM fiaon_applications WHERE ref = ${zurueck.ref}`;
  pruefe("Prüfkunde ist zurückgesetzt", kontrolle.payment_status === zurueck.payment_status,
    `${kontrolle.payment_status} statt ${zurueck.payment_status}`);

  // ── B · Versand von Zahlungsdaten ─────────────────────────────────────────
  console.log("\n── B. Zahlungsdaten senden ──");
  const [mitMail] = await sqlPool`
    SELECT p.id, p.invoice_sent_count
    FROM fiaon_persons p
    WHERE p.assigned_agent_id = ${ag.id} AND p.merged_into_person_id IS NULL
      AND EXISTS (
        SELECT 1 FROM fiaon_applications a
        WHERE a.person_id = p.id AND a.merged_into IS NULL
          AND a.payment_status IN ('pending_payment', 'claimed_paid', 'expired')
          AND COALESCE(NULLIF(a.email,''), NULLIF(a.contact_email,''), NULLIF(a.billing_email,'')) IS NOT NULL)
    ORDER BY p.id LIMIT 1
  `;
  const senden = await ruf(`/api/fiaon/agent/crm/kunden/${mitMail.id}/rechnung`, cookie, {
    method: "POST", body: JSON.stringify({}),
  });
  const ohneUrl = !process.env.MAKE_WEBHOOK_URL;
  if (ohneUrl) {
    pruefe("Ohne Make-URL meldet der Versand einen FEHLER (keine falsche Erfolgsmeldung)",
      senden.status === 502 && /NICHT raus/.test(String(senden.body?.error)),
      `HTTP ${senden.status} ${JSON.stringify(senden.body).slice(0, 140)}`);
    const [nachVersuch] = await sqlPool`SELECT invoice_sent_count FROM fiaon_persons WHERE id = ${mitMail.id}`;
    pruefe("Ein Fehlversand wird NICHT als Versand gezählt",
      Number(nachVersuch.invoice_sent_count) === Number(mitMail.invoice_sent_count),
      `${mitMail.invoice_sent_count} → ${nachVersuch.invoice_sent_count}`);
    const [logEintrag] = await sqlPool`
      SELECT COUNT(*)::int AS c FROM fiaon_contact_log c
      JOIN fiaon_applications a ON a.ref = c.ref
      WHERE a.person_id = ${mitMail.id} AND c.type = 'email_sent' AND c.created_at > NOW() - INTERVAL '2 minutes'
    `;
    pruefe("Ein Fehlversand erzeugt KEINEN Verlaufseintrag (kein falscher Betreuungsnachweis)",
      Number(logEintrag.c) === 0, `${logEintrag.c} Einträge`);
  } else {
    console.log("  ⚠ MAKE_WEBHOOK_URL gesetzt — Versandprüfung übersprungen (keine echten Mails).");
  }

  // Kunde ohne E-Mail: klare Absage
  const [ohneMail] = await sqlPool`
    SELECT p.id FROM fiaon_persons p
    WHERE p.assigned_agent_id = ${ag.id} AND p.merged_into_person_id IS NULL
      AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
                    AND a.payment_status IN ('pending_payment','claimed_paid','expired'))
      AND NOT EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
                        AND COALESCE(NULLIF(a.email,''), NULLIF(a.contact_email,''), NULLIF(a.billing_email,'')) IS NOT NULL)
    LIMIT 1
  `;
  if (ohneMail) {
    const r = await ruf(`/api/fiaon/agent/crm/kunden/${ohneMail.id}/rechnung`, cookie, { method: "POST", body: JSON.stringify({}) });
    pruefe("Ohne E-Mail-Adresse kommt eine klare Absage", r.status === 400 && /E-Mail/.test(String(r.body?.error)),
      `HTTP ${r.status} ${r.body?.error}`);
  }

  // ── B2 · Rückruf mit Uhrzeit ──────────────────────────────────────────────
  console.log("\n── B2. Rückruf mit Uhrzeit ──");
  const [rueck] = await sqlPool`
    SELECT p.id, p.follow_up_date FROM fiaon_persons p
    WHERE p.assigned_agent_id = ${ag.id} AND p.merged_into_person_id IS NULL AND NOT p.is_blocked
      AND p.priority_tier BETWEEN 1 AND 2
      AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
                    AND a.payment_status IN ('pending_payment','claimed_paid'))
    ORDER BY p.id DESC LIMIT 1
  `;
  const wvVorher = rueck.follow_up_date;
  const morgen = (() => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();
  const rr = await ruf(`/api/fiaon/agent/crm/kunden/${rueck.id}/aktivitaet`, cookie, {
    method: "POST", body: JSON.stringify({ art: "rueckruf_termin", terminDatum: morgen, terminZeit: "14:30" }),
  });
  pruefe("Rückruf mit Uhrzeit wird angenommen", rr.status === 200 && rr.body?.ok,
    `HTTP ${rr.status} ${rr.body?.error || ""}`);
  const [termin] = await sqlPool`
    SELECT c.scheduled_at FROM fiaon_contact_log c
    JOIN fiaon_applications a ON a.ref = c.ref
    WHERE a.person_id = ${rueck.id} AND c.outcome = 'rueckruf_termin'
    ORDER BY c.created_at DESC LIMIT 1
  `;
  const zeit = termin?.scheduled_at ? new Date(termin.scheduled_at) : null;
  pruefe("Die Uhrzeit steht im Verlauf (nicht 00:00)",
    !!zeit && zeit.getHours() === 14 && zeit.getMinutes() === 30,
    `gespeichert: ${zeit ? zeit.toLocaleString("de-DE") : "nichts"}`);
  await sqlPool`UPDATE fiaon_persons SET follow_up_date = ${wvVorher} WHERE id = ${rueck.id}`;
  await sqlPool`
    DELETE FROM fiaon_contact_log WHERE id IN (
      SELECT c.id FROM fiaon_contact_log c JOIN fiaon_applications a ON a.ref = c.ref
      WHERE a.person_id = ${rueck.id} AND c.created_at > NOW() - INTERVAL '2 minutes')
  `;

  // ── C · Verbuchungs-Seite ist abgeschaltet ────────────────────────────────
  console.log("\n── C. /admin/verbuchung ──");
  const verb = await ruf("/api/fiaon/admin/verbuchung/uebersicht", adminCookie);
  pruefe("Verbuchung antwortet mit 410 und Hinweis",
    verb.status === 410 && /Zahlungszentrale/.test(String(verb.body?.error)),
    `HTTP ${verb.status} ${verb.body?.error}`);
  const badges = await ruf("/api/fiaon/admin/hub/badges", adminCookie);
  pruefe("Dashboard bietet die Aufgabe nicht mehr an",
    Number(badges.body?.warn?.bankMatchedUnapplied || 0) === 0 && badges.body?.flags?.verbuchung === false,
    JSON.stringify(badges.body?.flags));

  console.log(rot === 0 ? "\nAlles grün." : `\n${rot} Prüfung(en) rot.`);
  await sqlPool.end();
  process.exit(rot === 0 ? 0 : 1);
})().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
