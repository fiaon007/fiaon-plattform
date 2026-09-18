// ═══════════════════════════════════════════════════════════════════════════
// VERSANDZENTRUM — Routen
//
// Zwei Wege: die Historie lesen und eine Sendung wiederholen. Die Regeln
// (Zustand, Tageslimit, Rollen) stehen in server/lib/fiaon-versand.ts — hier
// steht nur, wer welchen Kunden anfassen darf.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { rolleVon, darfAnKunde } from "../lib/fiaon-kundenzugriff";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { ensureRolleSpalte } from "./fiaon-vertrieb";
import {
  artenFuerRolle, versandErlaubt, versandHistorie, versandKnoepfe, VERSAND_TEXT,
  type VersandArt,
} from "../lib/fiaon-versand";
import { versendenUndProtokollieren } from "../lib/fiaon-mail-log";
// ══════════════════════════════════════════════════════════════════════════
// EINE NUTZLAST, NICHT ZWEI (18.09.2026)
//
// Bis heute baute diese Route ihre Nutzlast selbst — rund 170 Zeilen neben
// `sendePayloadBauen` (fiaon-mail-senden.ts), das dasselbe für Sende-Menü und
// Vorschau tat. Die beiden liefen auseinander: Hier gab es Zahlungsdaten der
// offenen Bestellung, sepa_link und das Datum des verpassten Termins, dort
// nicht; dort gab es den Katalogpreis (E-181), hier nicht. Und „Willkommen
// und Zugang" schickte von hier `welcome` ohne jeden Link.
// Jetzt baut `sendePayloadBauen` für beide Wege — mit allem, was hier stand
// (Zahlungsdaten 02.09., Lastschrift 01./02.09., No-Show 24.08.). Die Regeln
// dieser Route (Rechte, Zustand, Tageslimit) bleiben, wo sie waren; vor dem
// Versand prüft `versandLuecke`, ob die Mail vollständig ist.
// ══════════════════════════════════════════════════════════════════════════
import { sendePayloadBauen, versandLuecke } from "../lib/fiaon-mail-senden";
import { mailEvent } from "../lib/fiaon-mail-events";

const router = Router();

// ── DIE ROLLE KOMMT AUS fiaon-kundenzugriff.ts ───────────────────────────
// Hier stand eine eigene Fassung. Die in fiaon-mail.ts deutete „inkasso"
// stillschweigend zu „agent" um — eine Erlaubnisliste aus drei Namen, die
// niemand erweiterte. Der Inkasso-Mitarbeiter bekam beim Senden 403.

/**
 * Darf dieser Mitarbeiter an diesen Kunden senden?
 *
 * Ein Teammitglied nur an EIGENE Kunden — sonst wäre das Versandzentrum ein
 * Weg, jedem Menschen im Bestand eine Mail zu schicken, ohne je für ihn
 * zuständig gewesen zu sein.
 */
// P13 (01.09.2026): Die private darfAnKunde-Kopie ist weg — sie kannte weder
// 'admin' noch 'inkasso' noch die Pool-Regel und lief zwangsläufig auseinander.
// Es gilt die EINE Definition aus server/lib/fiaon-kundenzugriff.ts (Import oben).

/** GET /agent/versand/:personId — Historie und Knöpfe. */
router.get("/agent/versand/:personId", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    const rolle = await rolleVon(req.agent!.id);
    if (!(await darfAnKunde(req.agent!.id, rolle, personId))) {
      return res.status(403).json({ ok: false, error: "Dieser Kunde wird von jemand anderem betreut." });
    }
    const [historie, knoepfe] = await Promise.all([
      versandHistorie(personId),
      versandKnoepfe(personId, rolle),
    ]);
    res.json({ ok: true, historie, knoepfe, rolle });
  } catch (err) {
    console.error("[VERSAND] lesen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /agent/versand/:personId/:art — erneut senden. */
router.post("/agent/versand/:personId/:art", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    const art = String(req.params.art) as VersandArt;
    const rolle = await rolleVon(req.agent!.id);

    if (!artenFuerRolle(rolle).includes(art)) {
      return res.status(403).json({ ok: false, error: "Diese Art darfst du nicht senden." });
    }
    if (!(await darfAnKunde(req.agent!.id, rolle, personId))) {
      return res.status(403).json({ ok: false, error: "Dieser Kunde wird von jemand anderem betreut." });
    }
    // Zustand UND Tageslimit — serverseitig, nicht nur am ausgegrauten Knopf.
    const pruefung = await versandErlaubt(personId, art);
    if (!pruefung.erlaubt) return res.status(409).json({ ok: false, error: pruefung.grund });

    // Die Nutzlast baut EINE Funktion für Versandzentrum, Sende-Menü und
    // Vorschau (siehe Kopf). Was an diesem Kunden so nicht geht (kein
    // verpasster Termin, keine offene Zahlung …), kommt als Klartext zurück.
    const gebaut = await sendePayloadBauen(art, personId, sqlPool, { akteurName: req.agent!.name });
    if (!gebaut) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden." });
    if (gebaut.fehler) {
      await gebaut.aufraeumen?.();
      return res.status(409).json({ ok: false, error: gebaut.fehler });
    }
    const payload = { ...gebaut.basis, ...gebaut.links };
    // Vollständig? Ein Knopf ohne Ziel verschwand bisher still — die Mail ging
    // trotzdem raus („Willkommen und Zugang" ohne jeden Link).
    const def = await mailEvent(art);
    const luecke = def ? await versandLuecke(def, payload) : null;
    if (luecke) {
      await gebaut.aufraeumen?.();
      return res.status(409).json({ ok: false, error: luecke });
    }

    const erg = await versendenUndProtokollieren(art as any, payload as any, {
      personId,
      verlaufRef: gebaut.ref,
      verlaufText: `Erneut gesendet von ${req.agent!.name}: ${VERSAND_TEXT[art]?.titel ?? art}.`,
      ausgeloestVon: req.agent!.name,
      ausgeloestAgentId: req.agent!.id,
    });
    if (erg.status !== "versandt") await gebaut.aufraeumen?.();

    res.json({
      ok: erg.status === "versandt",
      status: erg.status,
      grund: erg.grund,
      meldung: erg.status === "versandt"
        ? `Verschickt an ${String(payload.email || "")}.${erg.hinweis ? ` ${erg.hinweis}` : ""}`
        : `Nicht verschickt: ${erg.grund}. Es steht mit Grund im Protokoll.`,
      knoepfe: await versandKnoepfe(personId, rolle),
      historie: await versandHistorie(personId),
    });
  } catch (err) {
    console.error("[VERSAND] senden:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
