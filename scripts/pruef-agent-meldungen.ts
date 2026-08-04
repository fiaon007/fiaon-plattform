// ═══════════════════════════════════════════════════════════════════════════
// Prüfstand für die Agenten-Meldungen vom 04.08.2026
//
// Jede gemeldete Beschwerde wird hier EINZELN nachgestellt und gegen die echte
// Datenbank geprüft. Testdaten werden am Ende wieder in den Ursprungszustand
// gebracht — es wird kein Kunde verändert zurückgelassen.
//
//  1. Ergebnis in „Meine Kunden" wirkt auf „Heute"
//  2. Alle Ergebnisse in „Heute" verfügbar (abgelehnt, Mailbox, Rückruf …)
//  3. Anrufen: Ländervorwahl vorhanden
//  4. Kein Kunde in „Heute", der in „Meine Kunden" fehlt
//  5. Stammdaten und E-Mail in „Heute" vorhanden
//  6. Akte: vollständige Daten, Dubletten-Hinweis nur bei echten Dubletten
//
// Aufruf: npx tsx scripts/pruef-agent-meldungen.ts   (Server muss laufen)
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { createHmac } from "crypto";
import { sqlPool } from "../server/lib/db-pool";

const BASIS = process.env.BASIS || "http://localhost:5188";
const CODE = process.env.ADMIN_ACCESS_CODE || "20032017";

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
    ...init,
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), cookie },
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

(async () => {
  const [ag] = await sqlPool`
    SELECT id, name, session_epoch FROM fiaon_agents
    WHERE active AND COALESCE(is_test_account, FALSE) = FALSE
      AND EXISTS (SELECT 1 FROM fiaon_persons p WHERE p.assigned_agent_id = fiaon_agents.id)
    ORDER BY id LIMIT 1
  `;
  const cookie = agentCookie(ag.id, Number(ag.session_epoch || 0));
  console.log(`Agent: ${ag.name} (#${ag.id})\n`);

  // Eine eigene Person mit Bestellung als Prüfobjekt — Zustand wird am Ende
  // exakt zurückgeschrieben.
  // Prüfobjekt: eigene Person mit einer OFFENEN, nicht aussortierten Bestellung.
  // Eine bezahlte Bestellung weist der Kontakt-Endpunkt zu Recht ab („bereits
  // bezahlt") — daran würde die Prüfung scheitern, ohne einen Fehler zu zeigen.
  const [ziel] = await sqlPool`
    SELECT p.id, p.promised_payment_date, p.follow_up_date, p.is_blocked, p.unreachable_count,
           (SELECT a.ref FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.dismissed_at IS NULL
               AND a.payment_status IN ('pending_payment', 'claimed_paid')
             ORDER BY a.created_at DESC LIMIT 1) AS ref
    FROM fiaon_persons p
    WHERE p.assigned_agent_id = ${ag.id} AND p.merged_into_person_id IS NULL AND NOT p.is_blocked
      AND EXISTS (
        SELECT 1 FROM fiaon_applications a
        WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.dismissed_at IS NULL
          AND a.assigned_agent_id = ${ag.id}
          AND a.payment_status IN ('pending_payment', 'claimed_paid'))
    ORDER BY p.id LIMIT 1
  `;
  const zurueck = { ...ziel };
  const [appVorher] = await sqlPool`SELECT promised_pay_date FROM fiaon_applications WHERE ref = ${ziel.ref}`;

  const zustand = async () => {
    const [p] = await sqlPool`
      SELECT promised_payment_date, follow_up_date, is_blocked, unreachable_count
      FROM fiaon_persons WHERE id = ${ziel.id}
    `;
    return p;
  };
  // Berliner Tagesgrenze — der Server rechnet ebenso. Mit UTC wäre der Test
  // zwischen 00:00 und 02:00 Uhr grundlos rot.
  const heute = (() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d.toISOString().slice(0, 10); })();
  const tagPlus = (n: number) => {
    const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const iso = (v: any) => (v ? new Date(v).toISOString().slice(0, 10) : null);

  // ── 1. Ergebnis aus „Meine Kunden" wirkt auf „Heute" ──────────────────────
  console.log("── 1. Ergebnis in „Meine Kunden“ wirkt auf „Heute“ ──");
  const r1 = await ruf(`/api/fiaon/agent/customers/${encodeURIComponent(ziel.ref)}/contact-result`, cookie, {
    method: "POST", body: JSON.stringify({ outcome: "nicht_erreicht" }),
  });
  pruefe("„Nicht erreicht“ wird angenommen", r1.status === 200 && r1.body?.ok, JSON.stringify(r1.body).slice(0, 160));
  const z1 = await zustand();
  pruefe("Wiedervorlage steht jetzt auf morgen (Kunde fällt aus der heutigen Liste)",
    iso(z1.follow_up_date) === tagPlus(1), `Wiedervorlage: ${iso(z1.follow_up_date)}, erwartet ${tagPlus(1)}`);
  pruefe("Zähler „nicht erreicht“ ist gestiegen",
    Number(z1.unreachable_count) === Number(zurueck.unreachable_count) + 1,
    `${zurueck.unreachable_count} → ${z1.unreachable_count}`);
  pruefe("Der Agent erfährt, was passiert ist", typeof r1.body?.wirkung?.meldung === "string");

  const r1b = await ruf(`/api/fiaon/agent/customers/${encodeURIComponent(ziel.ref)}/contact-result`, cookie, {
    method: "POST", body: JSON.stringify({ outcome: "erreicht_zahlt_am", promisedDate: tagPlus(5) }),
  });
  const z1b = await zustand();
  pruefe("Zusage aus „Meine Kunden“ steht bei der Person",
    r1b.body?.ok && iso(z1b.promised_payment_date) === tagPlus(5),
    `Zusage: ${iso(z1b.promised_payment_date)}`);
  const [app1] = await sqlPool`SELECT promised_pay_date FROM fiaon_applications WHERE ref = ${ziel.ref}`;
  pruefe("… und ebenso bei der Bestellung (Verwaltung sieht dasselbe)",
    iso(app1.promised_pay_date) === tagPlus(5), `Bestellung: ${iso(app1.promised_pay_date)}`);

  // ── 2. Alle Ergebnisse in „Heute" ─────────────────────────────────────────
  console.log("\n── 2. Vollständige Ergebnisse in „Heute“ ──");
  const faelle: Array<[string, any, (z: any) => boolean, string]> = [
    ["Mailbox besprochen", { art: "mailbox" }, (z) => iso(z.follow_up_date) === tagPlus(2), "Wiedervorlage in 2 Tagen"],
    ["Rückruf vereinbart", { art: "rueckruf_termin", terminDatum: tagPlus(3) }, (z) => iso(z.follow_up_date) === tagPlus(3), "Wiedervorlage = Termin"],
    ["Falsche Nummer", { art: "nummer_falsch" }, (z) => iso(z.follow_up_date) === tagPlus(3), "Wiedervorlage in 3 Tagen"],
    ["Zahlt sofort", { art: "erreicht_zahlt_gleich" }, (z) => iso(z.promised_payment_date) === heute && iso(z.follow_up_date) === tagPlus(1), "Zusage heute, morgen prüfen"],
    ["Erreicht – abgelehnt", { art: "erreicht_abgelehnt" }, (z) => z.is_blocked === true && !z.follow_up_date, "gesperrt, keine Wiedervorlage"],
  ];
  for (const [name, body, erwartung, was] of faelle) {
    const r = await ruf(`/api/fiaon/agent/crm/kunden/${ziel.id}/aktivitaet`, cookie, {
      method: "POST", body: JSON.stringify(body),
    });
    const z = await zustand();
    pruefe(`„${name}“ wird angenommen und wirkt (${was})`,
      r.status === 200 && r.body?.ok === true && erwartung(z),
      `HTTP ${r.status} ${r.body?.error || ""} · Zustand: WV=${iso(z.follow_up_date)} Zusage=${iso(z.promised_payment_date)} gesperrt=${z.is_blocked}`);
    // Sperre sofort lösen, damit die weiteren Prüfungen laufen können.
    if (z.is_blocked) await sqlPool`UPDATE fiaon_persons SET is_blocked = FALSE WHERE id = ${ziel.id}`;
  }
  const rOhne = await ruf(`/api/fiaon/agent/crm/kunden/${ziel.id}/aktivitaet`, cookie, {
    method: "POST", body: JSON.stringify({ art: "rueckruf_termin" }),
  });
  pruefe("Rückruf ohne Termin wird abgelehnt", rOhne.status === 400, `HTTP ${rOhne.status}`);
  const rGestern = await ruf(`/api/fiaon/agent/crm/kunden/${ziel.id}/aktivitaet`, cookie, {
    method: "POST", body: JSON.stringify({ art: "rueckruf_termin", terminDatum: tagPlus(-3) }),
  });
  pruefe("Rückruf in der Vergangenheit wird abgelehnt", rGestern.status === 400, `HTTP ${rGestern.status}`);

  // ── 3. Anrufen mit Ländervorwahl ──────────────────────────────────────────
  console.log("\n── 3. Anrufen: Ländervorwahl ──");
  const liste = await ruf("/api/fiaon/agent/crm/kunden?state=offen", cookie);
  const mitNummer = (liste.body?.kunden || []).filter((k: any) => k.telefon);
  const waehlbar = mitNummer.filter((k: any) => k.telefonWaehlbar && String(k.telefonWaehlbar).startsWith("+"));
  pruefe("Liste liefert wählbare Nummern mit „+“",
    mitNummer.length > 0 && waehlbar.length / mitNummer.length > 0.9,
    `${waehlbar.length} von ${mitNummer.length} wählbar`);
  pruefe("Nicht wählbare Nummern tragen einen Hinweis statt eines toten Links",
    mitNummer.filter((k: any) => !k.telefonWaehlbar).every((k: any) => !!k.telefonHinweis));
  const [ohnePlus] = await sqlPool`
    SELECT COUNT(*)::int c FROM fiaon_persons
    WHERE merged_into_person_id IS NULL AND primary_phone IS NOT NULL AND primary_phone NOT LIKE '+%'
  `;
  pruefe("Datenbestand ist bereinigt (höchstens Einzelfälle ohne Land)",
    Number(ohnePlus.c) <= 5, `noch ohne Vorwahl: ${ohnePlus.c}`);

  // ── 4. Gleiche Menge ──────────────────────────────────────────────────────
  console.log("\n── 4. Kein Kunde nur in „Heute“ ──");
  const meineKunden = await ruf("/api/fiaon/agent/customers", cookie);
  const refsMeineKunden = new Set((meineKunden.body?.data || []).map((c: any) => c.ref));
  const heuteListe = await ruf("/api/fiaon/agent/crm/kunden?state=heute", cookie);
  const fehlen: string[] = [];
  for (const k of heuteListe.body?.kunden || []) {
    const ref = k.zahlung?.ref;
    // Nur offene Bestellungen können in „Meine Kunden“ stehen — bezahlte nicht.
    if (!ref) continue;
    const [a] = await sqlPool`SELECT payment_status FROM fiaon_applications WHERE ref = ${ref}`;
    if (a && ["pending_payment", "claimed_paid", "expired"].includes(a.payment_status) && !refsMeineKunden.has(ref)) {
      fehlen.push(`${k.name} (${ref})`);
    }
  }
  pruefe("Jeder offene Kunde aus „Heute“ ist auch in „Meine Kunden“ auffindbar",
    fehlen.length === 0, fehlen.slice(0, 3).join(", "));

  // ── 4b. Aussortieren zieht die Person mit ─────────────────────────────────
  console.log("\n── 4b. Aussortieren wirkt auf die Anrufliste ──");
  const [wegPerson] = await sqlPool`
    SELECT p.id, p.is_blocked, p.follow_up_date,
           (SELECT a.ref FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.dismissed_at IS NULL
               AND a.assigned_agent_id = ${ag.id}
               AND a.payment_status IN ('pending_payment', 'claimed_paid')
             ORDER BY a.created_at DESC LIMIT 1) AS ref
    FROM fiaon_persons p
    WHERE p.assigned_agent_id = ${ag.id} AND p.merged_into_person_id IS NULL AND NOT p.is_blocked
      AND p.id <> ${ziel.id}
      AND EXISTS (
        SELECT 1 FROM fiaon_applications a
        WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.dismissed_at IS NULL
          AND a.assigned_agent_id = ${ag.id}
          AND a.payment_status IN ('pending_payment', 'claimed_paid'))
    ORDER BY p.id DESC LIMIT 1
  `;
  if (wegPerson?.ref) {
    const vorher = { blocked: wegPerson.is_blocked, wv: wegPerson.follow_up_date };
    const rWeg = await ruf(`/api/fiaon/agent/customers/${encodeURIComponent(wegPerson.ref)}/dismiss`, cookie, {
      method: "POST", body: JSON.stringify({ reason: "abgelehnt" }),
    });
    const [pNach] = await sqlPool`SELECT is_blocked, follow_up_date FROM fiaon_persons WHERE id = ${wegPerson.id}`;
    pruefe("„100 % abgelehnt“ sperrt auch die Person (kein Wiedervorlegen morgen)",
      rWeg.body?.ok === true && pNach.is_blocked === true && !pNach.follow_up_date,
      `HTTP ${rWeg.status} ${rWeg.body?.error || ""} gesperrt=${pNach?.is_blocked}`);
    // Zurücksetzen
    await sqlPool`
      UPDATE fiaon_applications SET dismissed_at = NULL, dismissed_by = NULL, dismissed_reason = NULL
      WHERE ref = ${wegPerson.ref}
    `;
    await sqlPool`
      UPDATE fiaon_persons SET is_blocked = ${vorher.blocked}, follow_up_date = ${vorher.wv} WHERE id = ${wegPerson.id}
    `;
    await sqlPool`
      DELETE FROM fiaon_contact_log WHERE ref = ${wegPerson.ref} AND created_at > NOW() - INTERVAL '5 minutes' AND type = 'system'
    `;
  } else {
    console.log("  (kein passender Kunde zum Prüfen)");
  }

  // ── 5. Stammdaten und E-Mail in „Heute" ───────────────────────────────────
  console.log("\n── 5. Stammdaten in „Heute“ ──");
  const detail = await ruf(`/api/fiaon/agent/crm/kunden/${ziel.id}`, cookie);
  const k = detail.body?.kunde;
  pruefe("Karte liefert einen Stammdaten-Block", !!k?.stammdaten, JSON.stringify(k || {}).slice(0, 120));
  pruefe("Karte liefert Zahlungsreferenz (Verwendungszweck)", k?.zahlung?.referenz !== undefined);
  const mitStamm = (liste.body?.kunden || []).filter((x: any) => x.stammdaten || x.zahlung);
  pruefe("Auch die Listenkarten tragen Zahlungsdaten", mitStamm.length > 0);

  // ── 6. Akte: Vollständigkeit + Dubletten ──────────────────────────────────
  console.log("\n── 6. Akte ──");
  const auf = await fetch(`${BASIS}/api/fiaon/zugang/oeffnen`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: CODE }),
  });
  const adminCookie = (auf.headers.get("set-cookie") || "").split(";")[0];

  // Eine Person mit Paket UND Bonitätsauskunft: klassischer Zweitkauf, der
  // früher als Dublettenverdacht gemeldet wurde.
  // Sauberes Beispiel: GENAU eine lebende Paketbestellung und GENAU eine lebende
  // Bonitätsauskunft. Vier abgelaufene Bonitätsbestellungen wären echte
  // Dubletten — das wäre kein Gegenbeweis, sondern ein anderer Fall.
  const [zweitkauf] = await sqlPool`
    WITH lebendig AS (
      SELECT a.*, (a.type = 'schufa' OR a.ref LIKE 'FIAON-SCHUFA-%') AS ist_zusatz
      FROM fiaon_applications a
      WHERE a.merged_into IS NULL AND a.person_id IS NOT NULL
        AND a.payment_status IN ('pending_payment', 'claimed_paid', 'paid')
    )
    SELECT MIN(ref) FILTER (WHERE NOT ist_zusatz) AS ref
    FROM lebendig
    GROUP BY person_id
    HAVING COUNT(*) FILTER (WHERE NOT ist_zusatz) = 1
       AND COUNT(*) FILTER (WHERE ist_zusatz) = 1
    LIMIT 1
  `;
  if (zweitkauf) {
    const akte = await ruf(`/api/fiaon/admin/kunden/akte?id=${encodeURIComponent(zweitkauf.ref)}`, adminCookie);
    pruefe("Paket + Bonitätsauskunft ist KEIN Dublettenverdacht",
      akte.body?.head?.duplicateSuspicion === false,
      `Verdacht: ${akte.body?.head?.duplicateSuspicion}`);
  } else {
    console.log("  (kein Zweitkauf-Beispiel im Bestand)");
  }

  // Eine Akte, deren Primärsatz Lücken hat, die eine Schwester füllen kann.
  const [luecke] = await sqlPool`
    SELECT a.ref FROM fiaon_applications a
    WHERE a.merged_into IS NULL AND a.person_id IS NOT NULL
      AND (NULLIF(a.street,'') IS NULL OR a.birthdate IS NULL)
      AND EXISTS (
        SELECT 1 FROM fiaon_applications b WHERE b.person_id = a.person_id AND b.ref <> a.ref
          AND b.merged_into IS NULL
          AND (NULLIF(b.street,'') IS NOT NULL OR b.birthdate IS NOT NULL))
    LIMIT 1
  `;
  if (luecke) {
    const akte = await ruf(`/api/fiaon/admin/kunden/akte?id=${encodeURIComponent(luecke.ref)}`, adminCookie);
    const erg = akte.body?.ergaenzt || [];
    // Entweder wurde ergänzt ODER die Akte hat auf die vollständigere Bestellung
    // derselben Person umgeschaltet. Beides ist richtig; entscheidend ist, dass
    // am Ende keine Lücke sichtbar bleibt, die es im Bestand nicht gibt.
    pruefe("Akte zeigt vollständige Stammdaten (ergänzt oder vollständigere Bestellung)",
      !!(akte.body?.app?.street && akte.body?.app?.birthdate),
      `Straße=${akte.body?.app?.street} Geburtsdatum=${akte.body?.app?.birthdate} ergänzt=${JSON.stringify(erg).slice(0, 90)}`);
    pruefe("Jede Ergänzung nennt ihre Herkunft",
      Array.isArray(erg) && erg.every((e: any) => e.feld && e.ausRef));
  } else {
    console.log("  (keine füllbare Lücke im Bestand)");
  }
  const akteTel = await ruf(`/api/fiaon/admin/kunden/akte?id=${encodeURIComponent(ziel.ref)}`, adminCookie);
  pruefe("Akte liefert die Nummer in wählbarer Form",
    akteTel.body?.app?.phoneWaehlbar === null || String(akteTel.body?.app?.phoneWaehlbar || "").startsWith("+"),
    `${akteTel.body?.app?.phoneWaehlbar}`);

  // ── Aufräumen: Ursprungszustand exakt zurück ──────────────────────────────
  await sqlPool`
    UPDATE fiaon_persons SET
      promised_payment_date = ${zurueck.promised_payment_date},
      follow_up_date = ${zurueck.follow_up_date},
      is_blocked = ${zurueck.is_blocked},
      unreachable_count = ${zurueck.unreachable_count},
      updated_at = NOW()
    WHERE id = ${ziel.id}
  `;
  await sqlPool`
    UPDATE fiaon_applications SET promised_pay_date = ${appVorher.promised_pay_date} WHERE ref = ${ziel.ref}
  `;
  await sqlPool`
    DELETE FROM fiaon_contact_log
    WHERE ref = ${ziel.ref} AND created_at > NOW() - INTERVAL '10 minutes' AND agent_id = ${ag.id}
  `;
  const [kontrolle] = await sqlPool`
    SELECT promised_payment_date, follow_up_date, is_blocked, unreachable_count
    FROM fiaon_persons WHERE id = ${ziel.id}
  `;
  console.log("\n── Aufräumen ──");
  pruefe("Prüfobjekt ist im Ursprungszustand",
    iso(kontrolle.promised_payment_date) === iso(zurueck.promised_payment_date)
    && iso(kontrolle.follow_up_date) === iso(zurueck.follow_up_date)
    && kontrolle.is_blocked === zurueck.is_blocked
    && Number(kontrolle.unreachable_count) === Number(zurueck.unreachable_count));

  console.log(rot === 0 ? "\nAlles grün." : `\n${rot} Prüfung(en) rot.`);
  await sqlPool.end();
  process.exit(rot === 0 ? 0 : 1);
})().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
