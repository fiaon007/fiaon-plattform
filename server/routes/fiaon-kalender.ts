// ═══════════════════════════════════════════════════════════════════════════
// /kalender — TERMINE IM EIGENEN KALENDER (29.09.2026, E-263)
//
// Öffentlich (ohne Login — der Token IST die Berechtigung), eingehängt in
// server/routes.ts neben /llms.txt: vor den Seiten-Fangnetzen und außerhalb
// der /api/fiaon-Gatter. Der Anfrage-Logger schreibt nur /api-Pfade mit — ein
// Token landet so nie im Log (eigene Zeilen nennen nur die letzten sechs Zeichen).
//
//   GET|HEAD /kalender/<token>.ics        das Abo (text/calendar, ETag, 304 — nur über das ETag)
//   GET      /kalender/<token>            die Einrichtungsseite (iPhone, Google, Link kopieren)
//   GET      /kalender/t/<id>-<sig>.ics   ein Termin für den Mitarbeiter (?absage=1 → CANCEL)
//   GET      /kalender/k/<storno>.ics     ein Termin für den Kunden (abgesagt → CANCEL)
//
// Unbekannt, widerrufen, gesperrt: IMMER dieselbe Antwort — sie verrät nicht, ob
// es den Link je gab. Beim Abo (.ics mit gültiger Form) ist das seit der
// Gegenprüfung 29.09.2026 ein LEERER Kalender (200) statt 404: Kalender-Apps
// behalten bei einem Abruffehler den letzten Stand eingefroren, ein leerer
// Kalender leert sie wirklich. Die Seite und alles Falschgeformte bleiben 404.
// Jeder solche Abruf zählt als Fehlgriff. Drossel je Instanz: 20 Abrufe je Token
// und 60 je Adresse in 10 Minuten, mehr als 20 Fehlgriffe je Adresse → 429 mit Retry-After.
//
// Angemeldet (unter /api/fiaon, agentRouter):
//   GET  /agent/kalender-abo            Links + Zustand (legt beim ersten Aufruf an)
//   POST /agent/kalender-abo/erneuern   neuer Link, der alte hört sofort auf
//   POST /agent/kalender-abo/beenden
// Die Chef-Routen (eigene + team) stehen im Mara-Steuerpult
// (server/routes/fiaon-mara-steuerpult.ts, Stufe inhaber).
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response, type NextFunction } from "express";
import {
  aboPruefen, aboAbruf, aboFeedGemerkt, aboSicht, aboHolen, aboErneuern, aboBeenden, aboTabelleDa,
  einzelIcs, kundenIcs, tokenKurz, leererKalenderIcs, ABO_TOKEN_FORM,
} from "../lib/fiaon-kalender-abo";
import { kalenderSeiteHtml, kalenderUnbekanntHtml } from "../lib/fiaon-kalender-seite";

const router = Router();

// ── Drossel (im Speicher, je Instanz) ─────────────────────────────────────
const FENSTER_MS = 10 * 60_000;
export const DROSSEL = { jeToken: 20, jeAdresse: 60, fehlgriffeJeAdresse: 20 } as const;
const stempel = new Map<string, number[]>();

function frisch(schluessel: string, jetzt: number): number[] {
  const liste = (stempel.get(schluessel) ?? []).filter((t) => jetzt - t < FENSTER_MS);
  stempel.set(schluessel, liste);
  return liste;
}
/** Zählt einen Abruf; liefert die Sekunden bis zum nächsten erlaubten, wenn die Grenze erreicht ist. */
function zaehlen(schluessel: string, grenze: number, jetzt = Date.now()): number | null {
  const liste = frisch(schluessel, jetzt);
  if (liste.length >= grenze) return Math.max(1, Math.ceil((liste[0] + FENSTER_MS - jetzt) / 1000));
  liste.push(jetzt);
  return null;
}
function fehlgriffGesperrt(ip: string, jetzt = Date.now()): number | null {
  const liste = frisch(`f:${ip}`, jetzt);
  return liste.length >= DROSSEL.fehlgriffeJeAdresse ? Math.max(1, Math.ceil((liste[0] + FENSTER_MS - jetzt) / 1000)) : null;
}
function fehlgriff(ip: string): void {
  frisch(`f:${ip}`, Date.now()).push(Date.now());
}
function aufraeumen(): void {
  if (stempel.size < 5000) return;
  const jetzt = Date.now();
  for (const [k, v] of Array.from(stempel)) if (!v.some((t) => jetzt - t < FENSTER_MS)) stempel.delete(k);
}
/** Nur für Prüfstände: Zähler leeren. */
export function drosselVergessen(): void { stempel.clear(); }

function schutzKoepfe(res: Response): void {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Referrer-Policy", "no-referrer");
}
function zuViel(res: Response, sekunden: number, ics: boolean): void {
  res.setHeader("Retry-After", String(sekunden));
  res.status(429).type(ics ? "text/plain" : "text/html").send(ics ? "Zu viele Abrufe — bitte später erneut." : kalenderUnbekanntHtml());
}
function unbekannt(req: Request, res: Response, ics: boolean): void {
  fehlgriff(req.ip || "?");
  res.setHeader("Cache-Control", "no-store");
  if (ics) res.status(404).type("text/plain").send("Dieser Kalender-Link gilt nicht (mehr).");
  else res.status(404).type("text/html").send(kalenderUnbekanntHtml());
}
/** Adresse zuerst: Wer zu oft daneben greift oder zu viel abruft, bekommt 429 — noch vor der Datenbank. */
function adresseDurch(req: Request, res: Response, ics: boolean): boolean {
  aufraeumen();
  const ip = req.ip || "?";
  const gesperrt = fehlgriffGesperrt(ip) ?? zaehlen(`ip:${ip}`, DROSSEL.jeAdresse);
  if (gesperrt != null) { zuViel(res, gesperrt, ics); return false; }
  return true;
}

// ── Einzeltermin (Mitarbeiter) ─────────────────────────────────────────────
router.get("/kalender/t/:datei", async (req: Request, res: Response) => {
  schutzKoepfe(res);
  if (!adresseDurch(req, res, true)) return;
  try {
    const erg = await einzelIcs(String(req.params.datei || ""), { absage: String(req.query.absage ?? "") === "1" });
    if (!erg) return unbekannt(req, res, true);
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${erg.abgesagt ? "fiaon-termin-absage.ics" : "fiaon-termin.ics"}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(erg.ics);
  } catch (err) {
    console.error("[KALENDER] Einzeltermin:", String((err as Error)?.message ?? err).slice(0, 200));
    res.status(500).type("text/plain").send("Die Kalenderdatei ließ sich nicht erstellen.");
  }
});

// ── Kunde (Bestätigung, Erinnerung) ─────────────────────────────────────────
router.get("/kalender/k/:datei", async (req: Request, res: Response) => {
  schutzKoepfe(res);
  if (!adresseDurch(req, res, true)) return;
  try {
    const erg = await kundenIcs(String(req.params.datei || ""));
    if (erg.status === 404) return unbekannt(req, res, true);
    // Abgesagt: dieselbe Adresse liefert METHOD:CANCEL (kundenIcs) — Apple/Outlook nehmen den Eintrag heraus.
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${erg.dateiname ?? "fiaon-termin.ics"}"`);
    res.send(erg.ics);
  } catch (err) {
    console.error("[KALENDER] Kundendatei:", String((err as Error)?.message ?? err).slice(0, 200));
    res.status(500).type("text/plain").send("Die Kalenderdatei ließ sich nicht erstellen.");
  }
});

// ── Abo (Feed) und Einrichtungsseite ─────────────────────────────────────────
router.get("/kalender/:datei", async (req: Request, res: Response) => {
  schutzKoepfe(res);
  const datei = String(req.params.datei || "");
  const istIcs = /\.ics$/i.test(datei);
  const token = datei.replace(/\.ics$/i, "");
  if (!adresseDurch(req, res, istIcs)) return;
  try {
    const abo = await aboPruefen(token);
    if (!abo && istIcs && ABO_TOKEN_FORM.test(token)) {
      // Unbekannt, widerrufen oder gesperrt: ein leerer Kalender — für jeden solchen Link derselbe.
      fehlgriff(req.ip || "?");
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", "inline; filename=\"fiaon-termine.ics\"");
      res.setHeader("Cache-Control", "no-store");
      return void res.status(200).send(leererKalenderIcs());
    }
    if (!abo) return unbekannt(req, res, istIcs);
    const zuVielToken = zaehlen(`t:${abo.id}`, DROSSEL.jeToken);
    if (zuVielToken != null) return zuViel(res, zuVielToken, istIcs);

    if (!istIcs) {
      res.setHeader("Cache-Control", "private, no-store");
      return void res.status(200).type("text/html").send(kalenderSeiteHtml(aboSicht(abo)));
    }

    // Jeder GET einer Kalender-App zählt (auch ein 304) — ein Browser nicht (aboAbruf).
    if (req.method === "GET") {
      await aboAbruf(abo, req.get("user-agent")).catch((e) => console.error(`[KALENDER] Abruf ${tokenKurz(token)} nicht vermerkt:`, String(e?.message ?? e).slice(0, 160)));
    }
    const feed = await aboFeedGemerkt(abo);
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", "inline; filename=\"fiaon-termine.ics\"");
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("ETag", feed.etag);
    // Bewusst KEIN Last-Modified (siehe AboFeed): Es sank bei einer Absage, und ein Client mit nur
    // If-Modified-Since bekam 304. Ohne den Kopf wertet Express If-Modified-Since als „veraltet" → 200.
    const wenn = String(req.get("if-none-match") ?? "");
    if (wenn && wenn.split(/\s*,\s*/).some((e) => e === feed.etag || e === `W/${feed.etag}` || e === "*")) {
      return void res.status(304).end();
    }
    res.status(200).send(feed.ics);
  } catch (err) {
    console.error(`[KALENDER] Abo ${tokenKurz(token)}:`, String((err as Error)?.message ?? err).slice(0, 200));
    res.status(500).type(istIcs ? "text/plain" : "text/html").send(istIcs ? "Der Kalender ließ sich gerade nicht laden." : kalenderUnbekanntHtml());
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ANGEMELDET: der Mitarbeiter und sein eigenes Abo (Calendar → „In meinen Kalender")
// ═══════════════════════════════════════════════════════════════════════════
// requireAgent erst beim Aufruf laden: Die öffentlichen Routen oben sollen die
// schwere Mitarbeiter-Routendatei nicht mitziehen (Prüfstand, Startzeit).
const agentWand = async (req: Request, res: Response, next: NextFunction) => {
  const { requireAgent } = await import("./fiaon-agent");
  return requireAgent(req as any, res, next);
};
type MitAgent = Request & { agent?: { id: number; name: string; ansicht?: boolean } };

export const agentRouter = Router();

agentRouter.get("/agent/kalender-abo", agentWand, async (req: MitAgent, res: Response) => {
  try {
    const agent = req.agent!;
    // In der Nur-Ansicht (der Vorgesetzte sieht mit den Augen des Mitarbeiters) gibt es keinen Link:
    // Er ist persönlich, und wer ihn hat, sieht die Termine.
    if (agent.ansicht) return void res.json({ ok: true, ansicht: true, eingerichtet: true, abo: null });
    if (!(await aboTabelleDa())) return void res.json({ ok: true, eingerichtet: false, abo: null });
    const abo = await aboHolen(agent.id, "eigene", `Mitarbeiter #${agent.id}`);
    res.json({ ok: true, eingerichtet: true, abo: abo ? aboSicht(abo) : null });
  } catch (err) {
    console.error("[KALENDER] Agent-Abo:", String((err as Error)?.message ?? err).slice(0, 200));
    res.status(500).json({ ok: false, error: "Das Kalender-Abo ließ sich nicht laden." });
  }
});

agentRouter.post("/agent/kalender-abo/:aktion", agentWand, async (req: MitAgent, res: Response) => {
  const aktion = String(req.params.aktion || "");
  if (aktion !== "erneuern" && aktion !== "beenden") return void res.status(404).json({ ok: false, error: "Unbekannte Aktion." });
  try {
    const agent = req.agent!;
    if (agent.ansicht) return void res.status(403).json({ ok: false, error: "In der Ansicht nicht möglich." });
    const von = `Mitarbeiter #${agent.id}`;
    if (aktion === "beenden") {
      const war = await aboBeenden(agent.id, "eigene", von);
      console.log(`[KALENDER] ${von}: Abo beendet (${war ? "war aktiv" : "war keins aktiv"})`);
      return void res.json({ ok: true, beendet: true, abo: null });
    }
    const abo = await aboErneuern(agent.id, "eigene", von);
    console.log(`[KALENDER] ${von}: neuer Abo-Link`);
    res.json({ ok: true, abo: abo ? aboSicht(abo) : null });
  } catch (err) {
    console.error("[KALENDER] Agent-Abo ändern:", String((err as Error)?.message ?? err).slice(0, 200));
    res.status(500).json({ ok: false, error: "Das hat nicht geklappt — bitte noch einmal." });
  }
});

export default router;
