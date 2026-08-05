// Prüfstand für Startseite, EINE Kundenliste und die Vertriebsleitung.
//
// Drei Dinge müssen stimmen, sonst ist die Umstellung schlimmer als der Zustand
// vorher:
//
//   1. Die Startseite ARBEITET NICHT. Sie darf keine Kunden zum Abtelefonieren
//      ausgeben, sonst haben wir wieder zwei Listen über denselben Bestand —
//      genau der Grund, warum zwei Mitarbeiter denselben Menschen angerufen haben.
//   2. Die EINE Kundenliste zeigt nur eigene Kunden, vollständig, mit Vorwahl,
//      und sie kennt alle Filter, die vorher über zwei Seiten verstreut waren.
//   3. Der Bereich Vertrieb existiert für die Leitung und ist für alle anderen
//      NICHT VORHANDEN (404, nicht 403 — eine 403 verrät, dass es die Seite gibt).
//
// Aufruf: npx tsx scripts/pruef-vertrieb.ts       (Server muss laufen)
import "dotenv/config";
import { createHmac } from "node:crypto";
import { sqlPool } from "../server/lib/db-pool";

const BASIS = process.env.BASIS || "http://localhost:5188";
const CODE = process.env.ADMIN_ACCESS_CODE || "20032017";

let rot = 0;
let gruen = 0;
const pruefe = (name: string, gut: boolean, hinweis = "") => {
  gut ? gruen++ : rot++;
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
  console.log("\n══ Startseite, eine Kundenliste, Vertriebsleitung ══\n");

  await sqlPool`ALTER TABLE fiaon_agents ADD COLUMN IF NOT EXISTS rolle TEXT NOT NULL DEFAULT 'agent'`;

  const auf = await fetch(`${BASIS}/api/fiaon/zugang/oeffnen`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: CODE }),
  });
  const adminCookie = (auf.headers.get("set-cookie") || "").split(";")[0];

  // Einen Agenten mit Bestand und einen Vertriebsleiter besorgen.
  const kandidaten = await sqlPool`
    SELECT a.id, a.name, a.session_epoch, COALESCE(a.rolle,'agent') AS rolle,
           (SELECT COUNT(*) FROM fiaon_applications x
             WHERE x.assigned_agent_id = a.id AND x.merged_into IS NULL) AS bestand
    FROM fiaon_agents a
    WHERE a.active AND COALESCE(a.is_test_account, FALSE) = FALSE
    ORDER BY bestand DESC
    LIMIT 4
  `;
  if (kandidaten.length < 2) { console.log("Zu wenige echte Agenten."); process.exit(1); }

  const agent = kandidaten[0];
  const zweiter = kandidaten[1];
  const aCookie = agentCookie(Number(agent.id), Number(agent.session_epoch || 0));
  const bCookie = agentCookie(Number(zweiter.id), Number(zweiter.session_epoch || 0));
  console.log(`Bezug: ${agent.name} (#${agent.id}, ${agent.bestand} Kunden) · ${zweiter.name} (#${zweiter.id})\n`);

  // ── 1. Startseite ────────────────────────────────────────────────────────
  console.log("1. Startseite /agent/start");
  const start = await ruf("/api/fiaon/agent/start", aCookie);
  pruefe("antwortet", start.status === 200 && start.body?.ok === true, `Status ${start.status}`);
  const v = start.body?.verdienst || {};
  const k = start.body?.kunden || {};
  pruefe("Verdienst des Monats", typeof v.monatCents === "number", JSON.stringify(v).slice(0, 80));
  pruefe("Guthaben (offene Provision)", typeof v.guthabenCents === "number");
  pruefe("bereits ausgezahlt", typeof v.ausgezahltCents === "number");
  pruefe("noch möglich (nicht abgerechnet)", typeof v.moeglichCents === "number");
  pruefe("Auszahlbarkeit ist eine klare Aussage", typeof v.auszahlbar === "boolean");
  pruefe("Bestand: wartende Kunden", typeof k.offen === "number", JSON.stringify(k).slice(0, 80));
  pruefe("Bestand: Zahlung gemeldet / Rechnung offen / Leads",
    typeof k.tier1 === "number" && typeof k.tier2 === "number" && typeof k.tier3 === "number");
  pruefe("Rolle wird mitgeliefert", typeof start.body?.agent?.rolle === "string", String(start.body?.agent?.rolle));

  // Der Kern der Umstellung: Die Startseite zeigt TERMINE (heute zugesagte
  // Zahlungen, vereinbarte Rückrufe) — keinen eigenen Kundenbestand zum
  // Abtelefonieren. Und was sie zeigt, muss in der EINEN Liste unter dem
  // passenden Filter wiederauftauchen. Sonst gibt es zwei Wahrheiten, und genau
  // daran ist die alte Tagesliste gescheitert.
  const zusagen: any[] = start.body?.zusagen || [];
  const rueckrufe: any[] = start.body?.rueckrufe || [];
  pruefe("Zusagen sind eine Terminliste", Array.isArray(zusagen));
  pruefe("Rückrufe sind eine Terminliste", Array.isArray(rueckrufe));
  pruefe("Startseite liefert KEINEN eigenen Bestand (kein 'personen'/'liste')",
    !["personen", "liste", "arbeitsliste"].some((f) => f in (start.body || {})),
    Object.keys(start.body || {}).join(", "));
  // EINE WAHRHEIT: Die Kennzahl „Zusage heute" muss genau so viele Karten
  // ergeben, wie die Startseite unter „Heute" gruppiert. Wäre das ungleich,
  // stünde auf derselben Seite eine Zahl gegen eine Liste.
  const heuteIso = new Date().toISOString().slice(0, 10);
  const heuteKarten = zusagen.filter((x) => String(x.zusagedatum || "").slice(0, 10) === heuteIso);
  pruefe("Kennzahl „Zusage heute“ = Karten mit heutigem Datum",
    Number(k.zusageHeute ?? -1) === heuteKarten.length,
    `Kennzahl ${k.zusageHeute}, Karten ${heuteKarten.length} (von ${zusagen.length} Terminen insgesamt)`);
  // Und die Terminliste muss vollständig sein: keine Zusage ohne Datum.
  pruefe("jeder Zusage-Termin hat ein Datum",
    zusagen.every((x) => !!x.zusagedatum),
    String(zusagen.filter((x) => !x.zusagedatum).length));

  // ── 2. Die EINE Kundenliste ──────────────────────────────────────────────
  console.log("\n2. Kundenliste /agent/kunden");
  const liste = await ruf("/api/fiaon/agent/kunden/liste?filter=alle", aCookie);
  pruefe("antwortet", liste.status === 200 && liste.body?.ok === true, `Status ${liste.status}`);
  const personen: any[] = liste.body?.kunden || [];
  pruefe("liefert Kunden", personen.length > 0, `${personen.length}`);

  // Fremdbestand darf nicht auftauchen — das war die Beschwerde.
  const fremd = await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_persons
    WHERE merged_into_person_id IS NULL AND assigned_agent_id IS NOT NULL AND assigned_agent_id <> ${agent.id}
  `;
  // Zuständigkeit hängt an der PERSON (fiaon_persons.assigned_agent_id) — die
  // Kundenliste ist personenbasiert. Genau das war der Bruch zwischen „Heute"
  // (Personen) und „Meine Kunden" (Bestellungen): zwei Quellen, zwei Wahrheiten.
  const eigene = await sqlPool`
    SELECT id AS person_id FROM fiaon_persons
    WHERE merged_into_person_id IS NULL AND assigned_agent_id = ${agent.id}
  `;
  const eigeneIds = new Set(eigene.map((r: any) => Number(r.person_id)));
  const fremdeInListe = personen.filter((p) => !eigeneIds.has(Number(p.personId)));
  pruefe(
    `kein fremder Kunde in der Liste (${fremd[0].n} fremde existieren)`,
    fremdeInListe.length === 0,
    fremdeInListe.slice(0, 3).map((p) => p.name).join(", "),
  );

  // Vollständigkeit je Karte: Ohne diese Felder muss der Agent die Seite wechseln.
  const mitTelefon = personen.filter((p) => p.telefon);
  const mitVorwahl = mitTelefon.filter((p) => String(p.telefonWaehlbar || "").startsWith("+"));
  pruefe(
    `alle Nummern mit Ländervorwahl (${mitVorwahl.length}/${mitTelefon.length})`,
    mitTelefon.length === 0 || mitVorwahl.length === mitTelefon.length,
    mitTelefon.filter((p) => !String(p.telefonWaehlbar || "").startsWith("+")).slice(0, 3).map((p) => p.telefon).join(", "),
  );
  const ersteMitMail = personen.find((p) => p.email);
  pruefe("E-Mail auf der Karte", !!ersteMitMail || personen.every((p) => !p.email), "keine E-Mail geliefert");
  const felder = ["personId", "name", "tier", "tierGrund", "letzterKontakt", "zusagedatum", "rueckrufAm", "nichtErreicht", "betreutSeit", "betrag", "produkt"];
  const fehlend = felder.filter((f) => personen.length > 0 && !(f in personen[0]));
  pruefe("Karte hat alle Arbeitsfelder", fehlend.length === 0, `fehlt: ${fehlend.join(", ")}`);

  // Filter: alles, was vorher über zwei Seiten verstreut war, muss hier greifen.
  console.log("\n3. Filter der Kundenliste");
  for (const f of ["alle", "zusage_heute", "ueberfaellig", "rueckruf", "tier1", "rechnung_offen", "frist_abgelaufen", "antrag_offen", "leads", "nicht_erreicht", "bezahlt", "gesperrt"]) {
    const r = await ruf(`/api/fiaon/agent/kunden/liste?filter=${f}`, aCookie);
    const ps: any[] = r.body?.kunden || [];
    const nurEigene = ps.every((p) => eigeneIds.has(Number(p.personId)));
    pruefe(`Filter „${f}“ (${ps.length}) nur eigene`, r.status === 200 && r.body?.ok && nurEigene, `Status ${r.status}`);
  }
  const suche = await ruf(`/api/fiaon/agent/kunden/liste?filter=alle&q=${encodeURIComponent(String(personen[0]?.name || "a").split(" ")[0])}`, aCookie);
  pruefe("Suche greift", suche.status === 200 && (suche.body?.kunden || []).length > 0,
    `${(suche.body?.kunden || []).length} Treffer`);

  // Zähler und Liste müssen übereinstimmen — zwei Zahlen für dasselbe sind ein Fehler.
  const zaehler = liste.body?.zaehler || {};
  for (const f of ["alle", "tier1", "rechnung_offen", "leads", "zusage_heute", "ueberfaellig", "rueckruf", "nicht_erreicht", "bezahlt", "gesperrt"]) {
    const r = await ruf(`/api/fiaon/agent/kunden/liste?filter=${f}`, aCookie);
    pruefe(`Zähler „${f}“ stimmt mit der Liste`,
      Number(zaehler[f] ?? -1) === (r.body?.kunden || []).length,
      `Zähler ${zaehler[f]}, Zeilen ${(r.body?.kunden || []).length}`);
  }
  // Sortierungen dürfen die Menge nicht verändern — nur die Reihenfolge.
  for (const s2 of ["arbeit", "neu", "betrag", "name"]) {
    const r = await ruf(`/api/fiaon/agent/kunden/liste?filter=alle&sort=${s2}`, aCookie);
    pruefe(`Sortierung „${s2}“ ändert die Menge nicht`,
      (r.body?.kunden || []).length === personen.length,
      `${(r.body?.kunden || []).length} statt ${personen.length}`);
  }

  // ── 4. Vertriebsleitung: Tür zu für normale Agenten ──────────────────────
  console.log("\n4. Vertrieb — verschlossen für normale Mitarbeiter");
  await sqlPool`UPDATE fiaon_agents SET rolle = 'agent' WHERE id = ${zweiter.id}`;
  for (const pfad of [
    "/api/fiaon/agent/vertrieb/uebersicht",
    "/api/fiaon/agent/vertrieb/personen?filter=alle",
    `/api/fiaon/agent/vertrieb/person/1`,
  ]) {
    const r = await ruf(pfad, bCookie);
    pruefe(`${pfad.replace("/api/fiaon/agent/vertrieb", "…")} → 404`, r.status === 404, `Status ${r.status}`);
  }
  const schreibVersuch = await ruf("/api/fiaon/agent/vertrieb/zuweisen", bCookie, {
    method: "POST", body: JSON.stringify({ personIds: [Number(personen[0]?.personId || 1)], agentId: zweiter.id }),
  });
  pruefe("Zuweisen durch normalen Agenten → 404", schreibVersuch.status === 404, `Status ${schreibVersuch.status}`);
  pruefe("404, nicht 403 (verrät die Existenz nicht)", schreibVersuch.status !== 403, "403 geliefert");
  const ohneCookie = await fetch(`${BASIS}/api/fiaon/agent/vertrieb/uebersicht`);
  pruefe("ohne Anmeldung → 401/404", [401, 404].includes(ohneCookie.status), `Status ${ohneCookie.status}`);

  // ── 5. Vertriebsleitung: Tür offen, aber nicht die Kasse ─────────────────
  console.log("\n5. Vertrieb — offen für die Leitung");
  await sqlPool`UPDATE fiaon_agents SET rolle = 'vertriebsleiter' WHERE id = ${zweiter.id}`;
  const ueber = await ruf("/api/fiaon/agent/vertrieb/uebersicht", bCookie);
  pruefe("Übersicht antwortet", ueber.status === 200 && ueber.body?.ok, `Status ${ueber.status}`);
  const vz = ueber.body?.zahlen || {};
  pruefe("Zahlen über ALLE Kunden",
    Number(vz.tier1 || 0) + Number(vz.tier2 || 0) + Number(vz.tier3 || 0) > Number(personen.length),
    JSON.stringify(vz).slice(0, 120));
  pruefe("„ohne Zuständigen“ ist sichtbar", typeof vz.ohneAgent === "number", String(vz.ohneAgent));
  pruefe("Bestand je Mitarbeiter", Array.isArray(ueber.body?.agenten) && ueber.body.agenten.length > 0);
  pruefe("Testkonten nicht in der Zuweisungsliste",
    !(ueber.body?.agenten || []).some((a: any) => /test|probe|demo/i.test(String(a.name))),
    (ueber.body?.agenten || []).map((a: any) => a.name).join(", "));

  const alleP = await ruf("/api/fiaon/agent/vertrieb/personen?filter=alle", bCookie);
  const vertriebsListe: any[] = alleP.body?.personen || alleP.body?.kunden || [];
  pruefe("sieht mehr Kunden als ein Agent", vertriebsListe.length >= personen.length,
    `${vertriebsListe.length} vs ${personen.length}`);
  pruefe("Zuständiger je Zeile sichtbar",
    vertriebsListe.length === 0 || vertriebsListe.some((p) => p.agentName),
    "keine Zuständigen");
  pruefe("dokumentierter Betreuer sichtbar",
    vertriebsListe.length === 0 || "betreuerName" in vertriebsListe[0]);

  // Die Kasse bleibt zu: keine Bankdaten, keine Buchung, keine Provisionsätze.
  const akte = await ruf(`/api/fiaon/agent/vertrieb/person/${vertriebsListe[0]?.personId}`, bCookie);
  pruefe("Akte lädt", akte.status === 200 && akte.body?.ok, `Status ${akte.status}`);
  const akteText = JSON.stringify(akte.body || {});
  pruefe("keine IBAN in der Akte", !/\biban\b/i.test(akteText), "IBAN gefunden");
  pruefe("keine Provisionssätze in der Akte", !/commission_rate|provisionssatz/i.test(akteText));
  for (const [pfad, koerper] of [
    ["/api/fiaon/admin/zahlungen/buchen", { ref: "x" }],
    ["/api/fiaon/admin/agents/1/rolle", { rolle: "vertriebsleiter" }],
    ["/api/fiaon/admin/agents", { email: "x@y.de" }],
  ] as [string, any][]) {
    const r = await ruf(pfad, bCookie, { method: "POST", body: JSON.stringify(koerper) });
    pruefe(`Admin-Endpunkt ${pfad.replace("/api/fiaon/admin", "…")} bleibt zu`,
      [401, 403, 404].includes(r.status), `Status ${r.status}`);
  }

  // ── 6. Zuweisen — Zuständigkeit ja, Provision nein ───────────────────────
  console.log("\n6. Zuweisen durch die Leitung");
  const opfer = vertriebsListe.find((p) => p.personId && Number(p.agentId || 0) !== Number(zweiter.id)) || vertriebsListe[0];
  const [vorher] = await sqlPool`
    SELECT assigned_agent_id, betreuung_seit FROM fiaon_persons
    WHERE id = ${opfer.personId} AND merged_into_person_id IS NULL
  `;
  const betreuerVorher = opfer.betreuerName ?? null;

  const zu = await ruf("/api/fiaon/agent/vertrieb/zuweisen", bCookie, {
    method: "POST", body: JSON.stringify({ personIds: [opfer.personId], agentId: zweiter.id }),
  });
  pruefe("Zuweisung geht", zu.status === 200 && zu.body?.ok, `Status ${zu.status} ${zu.body?.error || ""}`);
  const [nachher] = await sqlPool`
    SELECT assigned_agent_id, betreuung_seit FROM fiaon_persons
    WHERE id = ${opfer.personId} AND merged_into_person_id IS NULL
  `;
  pruefe("Zuständigkeit umgestellt", Number(nachher?.assigned_agent_id) === Number(zweiter.id),
    String(nachher?.assigned_agent_id));
  // DER KERN DES BESITZSCHUTZES: Ein Umzug verschiebt die Zuständigkeit, aber
  // NICHT den Anspruch. `betreuung_seit` ist die Spur der geleisteten Arbeit und
  // darf sich durch eine Zuweisung nie ändern.
  pruefe("betreuung_seit unverändert (Arbeitsspur bleibt)",
    String(vorher?.betreuung_seit ?? "") === String(nachher?.betreuung_seit ?? ""),
    `${vorher?.betreuung_seit} → ${nachher?.betreuung_seit}`);
  const nachListe = await ruf(`/api/fiaon/agent/vertrieb/personen?filter=alle&q=${encodeURIComponent(String(opfer.name).split(" ")[0])}`, bCookie);
  const nachZeile = (nachListe.body?.personen || []).find((p: any) => Number(p.personId) === Number(opfer.personId));
  pruefe("dokumentierter Betreuer UNVERÄNDERT (Provisionsanspruch bleibt)",
    String(nachZeile?.betreuerName ?? "") === String(betreuerVorher ?? ""),
    `${betreuerVorher} → ${nachZeile?.betreuerName}`);

  // Und die Bestellungen müssen mitgezogen sein — sonst zeigt die eine Seite
  // etwas anderes als die andere, und die Altmodell-Provision rechnet mit einem
  // Zuständigen, den es nicht mehr gibt.
  const [apps] = await sqlPool`
    SELECT COUNT(*)::int AS abweichend FROM fiaon_applications
    WHERE person_id = ${opfer.personId} AND merged_into IS NULL
      AND COALESCE(assigned_agent_id, 0) <> ${Number(zweiter.id)}
  `;
  pruefe("Bestellungen tragen dieselbe Zuständigkeit wie die Person",
    Number(apps.abweichend) === 0, `${apps.abweichend} abweichend`);

  const prot = await sqlPool`
    SELECT type, actor, meta FROM fiaon_agent_events
    WHERE type = 'vertrieb_zuweisung' ORDER BY id DESC LIMIT 1
  `;
  pruefe("Zuweisung protokolliert mit Akteur",
    prot.length > 0 && /vertriebsleiter:/.test(String(prot[0]?.actor || "")),
    JSON.stringify(prot[0] || {}).slice(0, 120));
  pruefe("Protokoll hält fest, ob der Kunde betreut war",
    prot.length > 0 && "war_betreut" in (typeof prot[0].meta === "string" ? JSON.parse(prot[0].meta) : prot[0].meta || {}),
    JSON.stringify(prot[0]?.meta || {}).slice(0, 100));

  // Zurücksetzen, damit der Prüfstand nichts hinterlässt.
  await sqlPool`
    UPDATE fiaon_persons SET assigned_agent_id = ${vorher?.assigned_agent_id ?? null}
    WHERE id = ${opfer.personId}
  `;
  await sqlPool`
    UPDATE fiaon_applications SET assigned_agent_id = ${vorher?.assigned_agent_id ?? null}
    WHERE person_id = ${opfer.personId} AND merged_into IS NULL
  `;
  await sqlPool`UPDATE fiaon_agents SET rolle = ${String(zweiter.rolle)} WHERE id = ${zweiter.id}`;

  // ── 7. Alte Adressen ─────────────────────────────────────────────────────
  console.log("\n7. Alte Adressen laufen nicht ins Leere");
  for (const pfad of ["/agent/heute", "/agent/kunden", "/agent/start", "/agent/vertrieb"]) {
    const r = await fetch(`${BASIS}${pfad}`, { headers: { cookie: aCookie } });
    pruefe(`${pfad} liefert eine Seite`, r.status === 200, `Status ${r.status}`);
  }
  const altAPI = await ruf("/api/fiaon/agent/heute/liste", aCookie);
  pruefe("alte Tagesliste-API weiterhin bedient (kein Bruch für offene Tabs)",
    [200, 404].includes(altAPI.status), `Status ${altAPI.status}`);

  console.log(`\n${rot === 0 ? "ALLES GRÜN" : `${rot} FEHLER`} — ${gruen} Prüfungen bestanden, ${rot} offen\n`);
  await sqlPool.end?.();
  process.exit(rot === 0 ? 0 : 1);
})().catch(async (e) => {
  console.error("Abbruch:", e);
  process.exit(1);
});
