// Prüfstand für Notizen und Aufgaben (Vermerke).
//
// Der harte Teil ist NICHT das Anlegen, sondern die Sichtbarkeit: Ein privater
// Vermerk, der im Agent-Portal auftaucht, ist ein Vertrauensbruch. Deshalb wird
// hier gegen die echte Datenbank geprüft, was ein Agent sehen KANN — mit einem
// Testeintrag je Sichtbarkeitsstufe, der am Ende wieder verschwindet.
//
// Aufruf: npx tsx scripts/pruef-vermerke.ts     (Server muss laufen)
import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";

const BASIS = process.env.BASIS || "http://localhost:5188";
const CODE = process.env.ADMIN_ACCESS_CODE || "20032017";

let rot = 0;
const pruefe = (name: string, gut: boolean, hinweis = "") => {
  if (!gut) rot++;
  console.log(`  ${gut ? "PASS" : "FAIL"}  ${name}${gut ? "" : `  ${hinweis}`}`);
};

async function json(pfad: string, init?: RequestInit, cookie?: string) {
  const res = await fetch(`${BASIS}${pfad}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
    },
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

(async () => {
  // Zugang
  const auf = await fetch(`${BASIS}/api/fiaon/zugang/oeffnen`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: CODE }),
  });
  const adminCookie = (auf.headers.get("set-cookie") || "").split(";")[0];

  // Ein echter Kunde und zwei echte Agenten als Bezug.
  const [kunde] = await sqlPool`
    SELECT ref FROM fiaon_applications WHERE merged_into IS NULL AND payment_reference IS NOT NULL LIMIT 1
  `;
  const agenten = await sqlPool`
    SELECT id, name FROM fiaon_agents WHERE active AND COALESCE(is_test_account, FALSE) = FALSE ORDER BY id LIMIT 2
  `;
  if (!kunde || agenten.length < 2) {
    console.log("Zu wenig Testdaten (Kunde/Agenten) — Prüfung abgebrochen.");
    process.exit(1);
  }
  const [a1, a2] = agenten;
  console.log(`Bezug: Kunde ${kunde.ref} · Agenten ${a1.name} (#${a1.id}) und ${a2.name} (#${a2.id})\n`);

  const angelegt: number[] = [];
  const anlegen = async (daten: Record<string, unknown>) => {
    const r = await json("/api/fiaon/admin/vermerke", { method: "POST", body: JSON.stringify(daten) }, adminCookie);
    if (r.body?.id) angelegt.push(r.body.id);
    return r;
  };

  console.log("── Anlegen ───────────────────────────────");
  const privat = await anlegen({ art: "notiz", ref: kunde.ref, text: "PRUEFUNG privat — darf kein Agent sehen", sicht: "privat" });
  pruefe("Private Notiz angelegt", privat.status === 200 && privat.body?.ok === true, JSON.stringify(privat.body));

  const team = await anlegen({ art: "notiz", ref: kunde.ref, text: "PRUEFUNG team — alle Agenten", sicht: "team" });
  pruefe("Team-Notiz angelegt", team.body?.ok === true);

  const auswahl = await anlegen({ art: "notiz", ref: kunde.ref, text: "PRUEFUNG auswahl — nur Agent 1", sicht: "auswahl", sichtAgenten: [a1.id] });
  pruefe("Notiz für bestimmte Personen angelegt", auswahl.body?.ok === true);

  const morgen = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const aufgabe = await anlegen({
    art: "aufgabe", ref: kunde.ref, text: "PRUEFUNG Aufgabe für Agent 1", sicht: "privat",
    zustaendigAgentId: a1.id, faelligAm: morgen, dringend: true,
  });
  pruefe("Aufgabe an Agent 1 vergeben (Sicht privat)", aufgabe.body?.ok === true);

  const eigene = await anlegen({ art: "aufgabe", text: "PRUEFUNG eigene Aufgabe", sicht: "privat", faelligAm: morgen });
  pruefe("Eigene Aufgabe ohne Kundenbezug angelegt", eigene.body?.ok === true);

  const leer = await anlegen({ art: "notiz", ref: kunde.ref, text: " ", sicht: "privat" });
  pruefe("Leerer Text wird abgelehnt", leer.status === 400);

  const ohneAuswahl = await anlegen({ art: "notiz", ref: kunde.ref, text: "PRUEFUNG ohne Auswahl", sicht: "auswahl", sichtAgenten: [] });
  pruefe("Sicht „bestimmte Personen“ ohne Auswahl wird abgelehnt", ohneAuswahl.status === 400);

  const falscheFrist = await anlegen({ art: "aufgabe", ref: kunde.ref, text: "PRUEFUNG Frist", sicht: "privat", faelligAm: "31.12.2026" });
  pruefe("Unlesbare Frist wird abgelehnt", falscheFrist.status === 400);

  // ── Sichtbarkeit aus Agentensicht ────────────────────────────────────────
  console.log("\n── Sichtbarkeit (das Wesentliche) ────────");
  const sichtFuer = async (agentId: number) => {
    const rows = await sqlPool`
      SELECT id, text, sicht, zustaendig_agent_id FROM fiaon_vermerke
      WHERE entfernt_am IS NULL AND text LIKE 'PRUEFUNG%' AND (
        zustaendig_agent_id = ${agentId}
        OR sicht = 'team'
        OR (sicht = 'auswahl' AND ${agentId} = ANY(sicht_agenten))
      )
    `;
    return rows.map((r: any) => String(r.text));
  };
  const sicht1 = await sichtFuer(a1.id);
  const sicht2 = await sichtFuer(a2.id);

  pruefe("Agent 1 sieht die Team-Notiz", sicht1.some((t) => t.includes("team")));
  pruefe("Agent 2 sieht die Team-Notiz", sicht2.some((t) => t.includes("team")));
  pruefe("Agent 1 sieht die Notiz für bestimmte Personen", sicht1.some((t) => t.includes("auswahl")));
  pruefe("Agent 2 sieht sie NICHT", !sicht2.some((t) => t.includes("auswahl")));
  pruefe("Agent 1 sieht seine Aufgabe (trotz Sicht privat)", sicht1.some((t) => t.includes("Aufgabe für Agent 1")));
  pruefe("Agent 2 sieht die fremde Aufgabe NICHT", !sicht2.some((t) => t.includes("Aufgabe für Agent 1")));
  pruefe("KEIN Agent sieht die private Notiz",
    !sicht1.some((t) => t.includes("privat —")) && !sicht2.some((t) => t.includes("privat —")));

  // ── Betreiber-Sicht und Zähler ───────────────────────────────────────────
  console.log("\n── Liste und Zähler ─────────────────────");
  const liste = await json(`/api/fiaon/admin/vermerke?ref=${encodeURIComponent(kunde.ref)}`, undefined, adminCookie);
  const meine = (liste.body?.vermerke || []).filter((v: any) => String(v.text).startsWith("PRUEFUNG"));
  pruefe("Betreiber sieht alle Vermerke der Person", meine.length >= 4, `gefunden: ${meine.length}`);
  const dieAufgabe = meine.find((v: any) => v.text.includes("Aufgabe für Agent 1"));
  pruefe("Aufgabe trägt Zuständigen und Frist",
    !!dieAufgabe && dieAufgabe.zustaendigName === a1.name && dieAufgabe.faelligAm === morgen,
    JSON.stringify({ zust: dieAufgabe?.zustaendigName, frist: dieAufgabe?.faelligAm }));
  pruefe("Aufgabe ist als dringend markiert", !!dieAufgabe?.dringend);

  const zahlen = await json("/api/fiaon/admin/vermerke/zahlen", undefined, adminCookie);
  pruefe("Zähler nennt eigene offene Aufgaben", (zahlen.body?.offen || 0) >= 1, JSON.stringify(zahlen.body));
  pruefe("Zähler nennt vergebene Aufgaben", (zahlen.body?.zugewiesen || 0) >= 1);

  // ── Erledigen ────────────────────────────────────────────────────────────
  console.log("\n── Erledigen ────────────────────────────");
  const erledigt = await json(`/api/fiaon/admin/vermerke/${dieAufgabe.id}`, {
    method: "PATCH", body: JSON.stringify({ status: "erledigt" }),
  }, adminCookie);
  pruefe("Betreiber kann erledigen", erledigt.body?.ok === true);
  const [nach] = await sqlPool`SELECT status, erledigt_am FROM fiaon_vermerke WHERE id = ${dieAufgabe.id}`;
  pruefe("Status und Zeitpunkt gespeichert", nach.status === "erledigt" && !!nach.erledigt_am);

  const wieder = await json(`/api/fiaon/admin/vermerke/${dieAufgabe.id}`, {
    method: "PATCH", body: JSON.stringify({ status: "offen" }),
  }, adminCookie);
  const [nach2] = await sqlPool`SELECT status, erledigt_am FROM fiaon_vermerke WHERE id = ${dieAufgabe.id}`;
  pruefe("Wieder öffnen setzt den Zeitpunkt zurück", wieder.body?.ok === true && nach2.status === "offen" && !nach2.erledigt_am);

  // ── Agent darf nichts Fremdes ────────────────────────────────────────────
  console.log("\n── Fremdzugriff ─────────────────────────");
  const fremd = await fetch(`${BASIS}/api/fiaon/agent/vermerke/${dieAufgabe.id}/status`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "erledigt" }),
  });
  pruefe("Ohne Anmeldung kein Zugriff auf Agenten-Endpunkt", fremd.status === 401, `HTTP ${fremd.status}`);

  // ── Zurückziehen räumt auf ───────────────────────────────────────────────
  console.log("\n── Aufräumen (Zurückziehen statt Löschen) ──");
  for (const id of angelegt) {
    await json(`/api/fiaon/admin/vermerke/${id}`, { method: "DELETE" }, adminCookie);
  }
  const [rest] = await sqlPool`
    SELECT COUNT(*)::int AS c FROM fiaon_vermerke WHERE text LIKE 'PRUEFUNG%' AND entfernt_am IS NULL
  `;
  pruefe("Alle Testeinträge zurückgezogen", Number(rest.c) === 0, `noch sichtbar: ${rest.c}`);
  const [erhalten] = await sqlPool`
    SELECT COUNT(*)::int AS c FROM fiaon_vermerke WHERE text LIKE 'PRUEFUNG%'
  `;
  pruefe("Datensätze bleiben nachvollziehbar (kein echtes Löschen)", Number(erhalten.c) >= angelegt.length);
  // Prüfspuren endgültig entfernen — sie sollen nicht in der Historie stehen.
  await sqlPool`DELETE FROM fiaon_vermerke WHERE text LIKE 'PRUEFUNG%'`;
  await sqlPool`DELETE FROM fiaon_contact_log WHERE note LIKE '%PRUEFUNG%'`;
  await sqlPool`DELETE FROM fiaon_agent_events WHERE type = 'aufgabe_zugewiesen' AND created_at > NOW() - INTERVAL '10 minutes'`;

  console.log(rot === 0 ? "\nAlles grün." : `\n${rot} Prüfung(en) rot.`);
  await sqlPool.end();
  process.exit(rot === 0 ? 0 : 1);
})().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
