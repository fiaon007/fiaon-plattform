// ═══════════════════════════════════════════════════════════════════════════
// EINE WAND FÜR BUCHUNGSJOURNAL, BUCHHALTUNG UND INVESTORENDATEN (06.09.2026)
//
// ── DER BEFUND (Lücken-Audit B9) ────────────────────────────────────────
// In drei Routendateien (admin-ledger, admin-accounting, admin-investors) und
// drei Browser-Bausteinen stand dasselbe feste Kennwort „fiaon-admin-2024" —
// im Quelltext UND im ausgelieferten JavaScript. Wer die Seite lud, hatte den
// Schlüssel zum Buchungsjournal (lesen, anlegen, löschen), zur Buchhaltung
// und zu den Investorendaten. ADMIN_TOKEN war in keiner Umgebung gesetzt, der
// Rückfall im Code galt also produktiv.
//
// ── DIE REGEL ───────────────────────────────────────────────────────────
// Es zählt, was auch sonst im Admin-Bereich zählt: der Admin-Code (Ziffern-
// tastatur, signiertes Cookie) oder das Chef-Token der Stufe „inhaber". Ein
// Kopfzeilen-Token gilt NUR, wenn ADMIN_TOKEN in der Umgebung gesetzt ist —
// für Skripte, nie als Rückfall im Code. Die drei Browser-Bausteine senden
// die alte Zeichenkette noch mit; sie öffnet nichts mehr und verschwindet mit
// dem Admin-Dashboard-Umbau.
// ═══════════════════════════════════════════════════════════════════════════
import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";
import { hasAdminCode } from "../routes/fiaon-admin-zugang";
import { readChef } from "../routes/fiaon-chef-zugang";

function tokenPasst(kopf: unknown): boolean {
  const soll = process.env.ADMIN_TOKEN;
  if (!soll || typeof kopf !== "string" || !kopf) return false;
  const a = Buffer.from(kopf);
  const b = Buffer.from(soll);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function adminZugriff(req: Request, res: Response, next: NextFunction): void {
  if (tokenPasst(req.headers["x-admin-token"])) { next(); return; }
  if (hasAdminCode(req)) { next(); return; }
  if (readChef(req)?.stufe === "inhaber") { next(); return; }
  res.status(401).json({ error: "Unauthorized", message: "Admin-Anmeldung erforderlich." });
}
