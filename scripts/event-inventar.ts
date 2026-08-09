/**
 * ═══════════════════════════════════════════════════════════════════
 * EVENT-INVENTUR — jede Codestelle, die ein Make/Brevo-Event auslöst
 * ═══════════════════════════════════════════════════════════════════
 *
 * Zweck (Prompt „Offene Kartei", oberste Regel): Der Umbau der Kartei darf
 * die E-Mail-Kette NICHT brechen. Dieses Skript erzeugt eine vollständige,
 * maschinell reproduzierbare Inventur aller `sendMakeWebhook(...)`-Aufrufe:
 *
 *   Aktion → Event-Typ → auslösende Codestelle → Empfänger
 *
 * Es liest ausschließlich Quelldateien (kein DB-Zugriff, keine Schreibrechte
 * außer der Baseline/Markdown-Ausgabe).
 *
 * Verwendung:
 *   npx tsx scripts/event-inventar.ts              → Tabelle auf stdout
 *   npx tsx scripts/event-inventar.ts --md         → Markdown-Tabelle (für SYSTEM_DIAGNOSE.md)
 *   npx tsx scripts/event-inventar.ts --save       → Baseline schreiben (VOR dem Umbau)
 *   npx tsx scripts/event-inventar.ts --check      → gegen Baseline prüfen (NACH dem Umbau)
 *                                                    Exit 1, sobald ein Event fehlt.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = process.cwd();
const SERVER_DIR = join(ROOT, "server");
const BASELINE = join(ROOT, "docs", "event-inventar.baseline.json");

/** Backups/Konflikt-Kopien sind kein produktiver Code — sie verfälschen die Inventur. */
function isRelevantFile(path: string): boolean {
  if (!path.endsWith(".ts")) return false;
  const lower = path.toLowerCase();
  if (lower.includes("in konflikt stehende kopie")) return false;
  if (lower.includes(".backup") || lower.includes(".bak") || lower.includes(".broken")) return false;
  if (lower.includes("node_modules")) return false;
  return true;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (isRelevantFile(full)) out.push(full);
  }
  return out;
}

export interface EventSite {
  /** Make-Event-Typ, z. B. "agent_payment_reminder" */
  event: string;
  /** Datei relativ zum Repo-Root */
  file: string;
  /** Zeilennummer des sendMakeWebhook-Aufrufs */
  line: number;
  /** Auslösende Aktion in Klartext (Route oder Funktion) */
  trigger: string;
  /** HTTP-Methode + Pfad, falls der Aufruf in einer Route liegt */
  route: string | null;
  /** "Agent" | "Admin" | "System (Cron/Engine)" | "Kunde (öffentlich)" */
  actor: string;
  /** Empfänger der Mail in Klartext */
  recipient: string;
  /**
   * Liegt der Versand in einer Hilfsfunktion (keine Route), stehen hier die
   * Routen, die diese Funktion aufrufen — sonst wäre nicht sichtbar, dass z. B.
   * `number_update_request` am Kontakt-Ergebnis des Agenten hängt.
   */
  calledFrom: string[];
}

/** Empfänger je Event-Typ — aus der Registry (customerBound) + Payload-Semantik. */
const RECIPIENT: Record<string, string> = {
  welcome: "Kunde",
  payment_details: "Kunde",
  followup_48h: "Kunde (veraltet)",
  payment_reminder: "Kunde",
  claim_received: "Kunde",
  payment_confirmed: "Kunde",
  agent_payment_reminder: "Kunde",
  agent_invite: "Agent",
  agent_password_reset: "Agent",
  agent_payout_done: "Agent",
  agent_payout_rejected: "Agent",
  agent_callback_reminder: "Agent",
  agent_feedback_rewarded: "Agent",
  agent_feedback_reply: "Agent",
  lead_followup: "Lead",
  lead_application_link: "Lead",
  number_update_request: "Kunde/Lead (Selbstkorrektur-Link)",
  contract_signed: "Agent",
  commission_statement_issued: "Agent",
};

const ROUTE_RE = /^\s*(?:export\s+(?:const|default)\s+)?(\w*[Rr]outer)\s*\.\s*(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/;
const FUNC_RE = /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/;
const ARROW_FN_RE = /^\s*(?:export\s+)?const\s+(\w+)\s*(?::[^=]+)?=\s*(?:async\s*)?\(/;

/** Mount-Präfixe aus server/routes.ts (alle FIAON-Router hängen an /api/fiaon). */
const MOUNTS: Record<string, string> = {
  intakeRouter: "/api/leads",
  router: "/api/fiaon",
};

/**
 * Ermittelt für eine Zeile den umgebenden Auslöser: die nächstgelegene
 * vorangehende Route-Definition bzw. Funktions-Deklaration.
 */
function findTrigger(lines: string[], idx: number): { trigger: string; route: string | null } {
  let route: string | null = null;
  let routeIdx = -1;
  for (let i = idx; i >= 0; i--) {
    const m = ROUTE_RE.exec(lines[i]);
    if (m) {
      const prefix = MOUNTS[m[1]] ?? MOUNTS.router;
      route = `${m[2].toUpperCase()} ${prefix}${m[3]}`;
      routeIdx = i;
      break;
    }
  }
  let fn: string | null = null;
  let fnIdx = -1;
  for (let i = idx; i >= 0; i--) {
    const m = FUNC_RE.exec(lines[i]) || ARROW_FN_RE.exec(lines[i]);
    if (m) {
      fn = m[1];
      fnIdx = i;
      break;
    }
  }
  // Die zuletzt geöffnete Klammer gewinnt: eine Funktion INNERHALB einer Route
  // (bzw. eine Route nach der Funktion) ist der echte Auslöser.
  if (route && routeIdx > fnIdx) return { trigger: route, route };
  if (fn) return { trigger: `${fn}()`, route };
  return { trigger: "(Modul-Ebene)", route: null };
}

function classifyRoute(route: string): string {
  if (/\/admin\//.test(route)) return "Admin";
  if (/\/agent\//.test(route)) return "Agent";
  if (/\/intake|\/application|\/payment-order|\/claim-paid|\/antrag|\/zahlung/.test(route)) return "Kunde (öffentlich)";
  return "System (Cron/Engine)";
}

function classifyActor(route: string | null, calledFrom: string[]): string {
  if (route) return classifyRoute(route);
  const actors = new Set(calledFrom.map(classifyRoute));
  if (actors.size === 1) return [...actors][0];
  if (actors.size > 1) return [...actors].join(" / ");
  return "System (Cron/Engine)";
}

/**
 * Findet alle Routen, die eine Hilfsfunktion aufrufen (direkt oder über einen
 * dynamischen Import). Eine Ebene tief — das genügt für die vorhandenen Ketten
 * (Kontakt-Ergebnis → maybeSendNumberUpdateMail → number_update_request).
 */
function findCallers(fnName: string, files: { path: string; lines: string[] }[]): string[] {
  const callRe = new RegExp(`\\b${fnName}\\s*\\(`);
  const out = new Set<string>();
  for (const f of files) {
    for (let i = 0; i < f.lines.length; i++) {
      if (!callRe.test(f.lines[i])) continue;
      // Die Deklaration selbst ist kein Aufruf.
      if (new RegExp(`function\\s+${fnName}\\s*\\(`).test(f.lines[i])) continue;
      const { route } = findTrigger(f.lines, i);
      if (route) out.add(route);
    }
  }
  return [...out].sort();
}

export function collectEventSites(): EventSite[] {
  const paths = walk(SERVER_DIR).sort();
  const files = paths.map((p) => ({ path: relative(ROOT, p), lines: readFileSync(p, "utf8").split("\n") }));
  const sites: EventSite[] = [];
  for (const f of files) {
    // Die Definition selbst (make-webhook.ts) ist kein Auslöser.
    if (f.path.endsWith("make-webhook.ts")) continue;
    for (let i = 0; i < f.lines.length; i++) {
      const m = /sendMakeWebhook\(\s*["'`]([a-z0-9_]+)["'`]/i.exec(f.lines[i]);
      if (!m) continue;
      const event = m[1];
      const { trigger, route } = findTrigger(f.lines, i);
      const fnName = !route && trigger.endsWith("()") ? trigger.slice(0, -2) : null;
      const calledFrom = fnName ? findCallers(fnName, files) : [];
      sites.push({
        event,
        file: f.path,
        line: i + 1,
        trigger,
        route,
        actor: classifyActor(route, calledFrom),
        recipient: RECIPIENT[event] || "unbekannt",
        calledFrom,
      });
    }
  }
  return sites;
}

/** Menschlich lesbare Aktion je Codestelle (Klartext für den Vorgesetzten). */
const ACTION_LABEL: Record<string, string> = {
  "server/fiaon-number-update.ts:number_update_request":
    "Kontakt-Ergebnis „Nummer falsch“ → Kunde/Lead korrigiert Nummer selbst",
  "server/routes/fiaon-agent.ts:agent_payment_reminder": "Agent sendet Zahlungsdaten-Mail",
  "server/routes/fiaon-agent.ts:agent_callback_reminder": "Rückruf-Erinnerung 60 Min. vorher (Cron)",
  "server/routes/fiaon-agent.ts:agent_password_reset": "Agent fordert Passwort-Reset an",
  "server/routes/fiaon-leads.ts:lead_application_link": "Antrags-/Zahlungslink an Lead senden",
  "server/routes/fiaon-leads.ts:lead_followup": "Nachfass an Lead (Engine/Bulk/Einzel)",
  "server/routes/fiaon-onboarding.ts:contract_signed": "Agent signiert Handelsvertretervertrag",
  "server/routes/fiaon-onboarding.ts:commission_statement_issued": "Provisions-Abrechnung erzeugt",
  "server/routes/fiaon-team.ts:agent_invite": "Admin lädt Agent ein",
  "server/routes/fiaon-team.ts:agent_password_reset": "Admin löst Passwort-Reset aus",
  "server/routes/fiaon-team.ts:agent_payout_done": "Admin markiert Auszahlung als überwiesen",
  "server/routes/fiaon-team.ts:agent_payout_rejected": "Admin lehnt Auszahlung ab",
  "server/routes/fiaon-agent-portal.ts:agent_feedback_reply": "Admin antwortet auf Feedback-Ticket",
  "server/routes/fiaon-agent-portal.ts:agent_feedback_rewarded": "Admin honoriert Feedback",
  "server/routes/fiaon-antrag.ts:welcome": "Antrag eingegangen (Kunde)",
  "server/routes/fiaon-antrag.ts:payment_details": "Bestellung angelegt / Zahlungsdaten erneut",
  "server/routes/fiaon-antrag.ts:claim_received": "Kunde kündigt Überweisung an",
  "server/routes/fiaon-antrag.ts:payment_confirmed": "Zahlung bestätigt (Konto aktiv)",
  "server/routes/fiaon-antrag.ts:payment_reminder": "Zahlungserinnerung (Engine/Bulk)",
};

function actionLabel(s: EventSite): string {
  return ACTION_LABEL[`${s.file}:${s.event}`] || `${s.event} (${s.trigger})`;
}

/** Stabiler Schlüssel — bewusst OHNE Zeilennummer (Zeilen verschieben sich beim Umbau). */
function key(s: EventSite): string {
  return `${s.event}|${s.file}|${s.trigger}`;
}

function toMarkdown(sites: EventSite[]): string {
  const rows = sites
    .slice()
    .sort((a, b) => a.event.localeCompare(b.event) || a.file.localeCompare(b.file) || a.line - b.line);
  const out: string[] = [];
  out.push("| Aktion | Event-Typ | Auslösende Codestelle | Auslöser | Empfänger |");
  out.push("| --- | --- | --- | --- | --- |");
  for (const s of rows) {
    const where = s.route
      ? `\`${s.file}:${s.line}\` — \`${s.route}\``
      : `\`${s.file}:${s.line}\` — \`${s.trigger}\`${s.calledFrom.length ? `, aufgerufen von ${s.calledFrom.map((c) => `\`${c}\``).join(", ")}` : ""}`;
    out.push(`| ${actionLabel(s)} | \`${s.event}\` | ${where} | ${s.actor} | ${s.recipient} |`);
  }
  return out.join("\n");
}

function main(): void {
  const args = process.argv.slice(2);
  const sites = collectEventSites();
  const events = new Set(sites.map((s) => s.event));

  if (args.includes("--md")) {
    console.log(toMarkdown(sites));
    console.log("");
    console.log(`**Summe:** ${sites.length} Versandpunkte, ${events.size} verschiedene Event-Typen.`);
    return;
  }

  if (args.includes("--save")) {
    const payload = {
      generatedAt: new Date().toISOString(),
      count: sites.length,
      sites: sites.map((s) => ({ ...s, key: key(s) })).sort((a, b) => a.key.localeCompare(b.key)),
    };
    writeFileSync(BASELINE, JSON.stringify(payload, null, 2) + "\n", "utf8");
    console.log(`Baseline geschrieben: ${relative(ROOT, BASELINE)} (${sites.length} Versandpunkte)`);
    return;
  }

  if (args.includes("--check")) {
    if (!existsSync(BASELINE)) {
      console.error("FEHLER: Keine Baseline vorhanden. Zuerst `--save` VOR dem Umbau ausführen.");
      process.exit(2);
    }
    const base = JSON.parse(readFileSync(BASELINE, "utf8")) as {
      generatedAt?: string;
      sites: (EventSite & { key: string })[];
    };
    const now = new Map(sites.map((s) => [key(s), s]));
    let missing = 0;
    console.log(`Event-Inventur — Abgleich gegen Baseline vom ${base.generatedAt ?? "?"}\n`);
    for (const b of base.sites) {
      const hit = now.get(b.key);
      if (hit) {
        console.log(`  ${b.event} → vorher vorhanden → nachher vorhanden ✅  (${hit.file}:${hit.line})`);
      } else {
        missing++;
        console.log(`  ${b.event} → vorher vorhanden → NACHHER FEHLT ❌  (war ${b.file}, ${b.trigger})`);
      }
    }
    const added = sites.filter((s) => !base.sites.some((b) => b.key === key(s)));
    for (const a of added) console.log(`  ${a.event} → NEU hinzugekommen ➕  (${a.file}:${a.line})`);
    console.log(
      `\nErgebnis: ${base.sites.length - missing}/${base.sites.length} Versandpunkte erhalten, ${added.length} neu.`,
    );
    if (missing > 0) {
      console.error("\n❌ ABBRUCH: Mindestens ein Event-Versandpunkt ist verschwunden. Umbau zurücknehmen/korrigieren.");
      process.exit(1);
    }
    console.log("\n✅ Event-Inventur vollständig grün — kein Versandpunkt verloren.");
    return;
  }

  console.log(toMarkdown(sites));
  console.log(`\nSumme: ${sites.length} Versandpunkte, ${events.size} Event-Typen.`);
  console.log("Optionen: --md | --save (Baseline) | --check (Verifikation nach Umbau)");
}

main();
