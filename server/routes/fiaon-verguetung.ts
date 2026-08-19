// ═══════════════════════════════════════════════════════════════════════════
// VERGÜTUNGS-STEUERUNG JE MENSCH — ROUTEN
//
// ── DER AUFTRAG (20.08.2026) ───────────────────────────────────────────────
// „Heute: zwei Felder (Stundensatz, Prämie je Rate). Zu wenig." Statt eines
// Formularblocks Bausteine, die einzeln an- und abgeschaltet werden: Fixum,
// Provision (Prozent oder Festbetrag, gestaffelt), Pauschale je Tätigkeit,
// Stundensatz, einmalige Gutschrift oder Abzug.
//
// ── DREI WÄNDE, DIE HIER STEHEN ───────────────────────────────────────────
// 1. NUR ZUKUNFT. Ein Baustein wird nie geändert, sondern ABGELÖST: der alte
//    bekommt `entfernt_am`, der neue eine eigene `gueltig_ab`. Damit bleibt
//    lesbar, was im Juli galt — und eine bereits gebuchte Provision kann sich
//    nicht nachträglich verschieben.
// 2. JEDE ÄNDERUNG INS PROTOKOLL, mit Alt→Neu. Es geht um Geld; wer sagt „das
//    war nicht abgesprochen", muss eine Antwort finden können.
// 3. EIN ABZUG BRAUCHT EINEN GRUND. Ohne Freitext keine negative Position —
//    im PDF steht sie später mit genau diesem Grund.
//
// Alle Routen liegen unter /admin/* und damit hinter `adminCodeGate` (401) und
// `blockAgentsFromAdmin` (403 für Agent-Token, auch Vertriebsleitung).
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { berlinToday } from "../lib/fiaon-time";
import { decryptSecret, logAgentEvent } from "./fiaon-agent";
import {
  bausteine, monatsVorschau, provisionCents, pauschaleCents, stundensatzCents,
  PAUSCHAL_ANLAESSE, PAKET_STAFFEL, RECHTSGRUENDE, type BausteinTyp,
} from "../lib/fiaon-verguetung";

const router = Router();

const TYPEN: BausteinTyp[] = ["fixum", "provision", "pauschale", "stundensatz", "einmalig"];

/** Euro-Eingabe („15,00", „15.00", 15) → Cent. Eine Stelle, ein Verfahren. */
function centsAus(v: unknown): number | null {
  if (v == null || v === "") return null;
  const s = String(v).replace(/\s/g, "").replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function wer(req: Request): string {
  return String((req as any).adminName || "Verwaltung");
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /admin/verguetung/:agentId — alles, was der Reiter braucht
// ═══════════════════════════════════════════════════════════════════════════
router.get("/admin/verguetung/:agentId", async (req: Request, res: Response) => {
  try {
    const agentId = Number(req.params.agentId);
    if (!Number.isFinite(agentId) || agentId <= 0) {
      return res.status(400).json({ ok: false, error: "Ungültige Kennung." });
    }
    const [a] = (await sqlPool`
      SELECT id, name, rolle, email, commission_rate_bp, override_rate_bp, stundensatz_cents,
             inkasso_praemie_art, inkasso_praemie_wert, verguetung_bestaetigt_am,
             bank_holder_enc, bank_iban_enc, bank_bic_enc, bank_iban_masked,
             bank_updated_at, bank_change_ack
        FROM fiaon_agents WHERE id = ${agentId}
    `) as any[];
    if (!a) return res.status(404).json({ ok: false, error: "Mitarbeiter nicht gefunden." });

    const monat = String(req.query.monat ?? "").match(/^\d{4}-\d{2}$/)
      ? String(req.query.monat) : (await berlinToday()).slice(0, 7);

    // ── DIE BANKVERBINDUNG — VOLLSTÄNDIG ──────────────────────────────────
    // Der Betreiber überweist manuell über Wise und braucht die IBAN zum
    // KOPIEREN. Eine maskierte IBAN ist dafür wertlos.
    //
    // JEDER Abruf wird protokolliert — eine IBAN ist ein Zahlungsziel, und wer
    // sie gesehen hat, gehört nachvollziehbar festgehalten. Das Protokoll ist
    // der Preis dafür, dass sie im Klartext dasteht.
    const ip = String((req.headers["x-forwarded-for"] as string || "").split(",")[0].trim()
      || req.socket?.remoteAddress || "");
    const hatBank = !!a.bank_iban_enc;
    if (hatBank) {
      await logAgentEvent(agentId, "bank_viewed_by_admin", {
        at: new Date().toISOString(), ip, wo: "verguetung-reiter", wer: wer(req),
      }).catch((e) => console.error("[VERGUETUNG] Bank-Protokoll:", e));
    }

    // ══════════════════════════════════════════════════════════════════════
    // „VORHANDEN, ABER NICHT LESBAR" IST EIN EIGENER ZUSTAND (20.08.2026)
    //
    // Der Schlüssel für die Bankdaten wird aus `SESSION_SECRET` abgeleitet
    // (`bankKey()` in fiaon-agent.ts). Ist er nicht derselbe wie beim
    // Verschlüsseln — etwa auf einem Entwicklungsrechner ohne diese Variable —
    // gibt `decryptSecret` sauber `null` zurück.
    //
    // Das ist RICHTIG so: Verschlüsselte Zahlungsdaten sollen sich nicht überall
    // öffnen lassen. Falsch war die Anzeige: Sie bekam `vorhanden: true` und
    // `iban: null` und zeigte einen LEEREN Block. Der Betreiber hätte daraus
    // geschlossen, die Bankdaten seien weg — dabei liegen sie da und der
    // Schlüssel fehlt nur.
    //
    // Aufgefallen ist es im Prüfstand: „Die IBAN steht vollständig da" wurde rot,
    // und die Ursache lag nicht in der Maske.
    // ══════════════════════════════════════════════════════════════════════
    const iban = hatBank ? decryptSecret(a.bank_iban_enc) : null;
    const lesbar = !hatBank || iban != null;
    if (hatBank && !lesbar) {
      console.error(`[VERGUETUNG] Bankdaten von Agent ${agentId} liegen vor, sind aber nicht `
        + "entschlüsselbar — SESSION_SECRET weicht vom Schlüssel beim Speichern ab.");
    }

    const liste = await bausteine(agentId);
    const vorschau = await monatsVorschau(agentId, monat);

    // Was gilt gerade — durch DIESELBEN Funktionen, die auch buchen.
    const beispielUmsatz = 9999;
    const prov = await provisionCents(agentId, beispielUmsatz, {
      personSatzBp: a.commission_rate_bp ?? null,
    });
    const std = await stundensatzCents(agentId, { personCents: a.stundensatz_cents ?? null });
    const pausch = await Promise.all(PAUSCHAL_ANLAESSE.map(async (p) => ({
      schluessel: p.schluessel, text: p.text, hinweis: p.hinweis,
      ...(await pauschaleCents(agentId, p.schluessel)),
    })));

    res.json({
      ok: true,
      mitarbeiter: { id: Number(a.id), name: a.name, rolle: a.rolle, email: a.email },
      bank: {
        vorhanden: hatBank,
        // Wenn nicht lesbar: die Maske sagt es, statt einen leeren Block zu zeigen.
        lesbar,
        nichtLesbarGrund: hatBank && !lesbar
          ? "Die Bankdaten liegen verschlüsselt vor, lassen sich hier aber nicht öffnen: "
            + "Der Schlüssel (SESSION_SECRET) weicht von dem ab, mit dem sie gespeichert "
            + "wurden. Auf dem Produktionsserver sind sie lesbar. Die maskierte Form unten "
            + "stammt aus dem Klartext beim Speichern und ist verlässlich."
          : null,
        kontoinhaber: hatBank ? decryptSecret(a.bank_holder_enc) : null,
        iban,
        bic: hatBank ? decryptSecret(a.bank_bic_enc) : null,
        ibanMaskiert: a.bank_iban_masked ?? null,
        geaendertAm: a.bank_updated_at ?? null,
        aenderungBestaetigt: a.bank_change_ack ?? null,
      },
      bausteine: liste,
      /** Was heute gilt, mit Herkunft — damit sichtbar ist, was Baustein und was Altfeld ist. */
      gilt: {
        provision: { ...prov, beispielUmsatzCents: beispielUmsatz },
        stundensatz: std,
        pauschalen: pausch,
      },
      vorschau,
      // Die Auswahllisten kommen vom SERVER, damit Oberfläche und Buchung
      // dieselben Schlüssel benutzen. Ein Anlass, den nur die Maske kennt,
      // erzeugt eine Pauschale, die niemand bucht.
      auswahl: {
        anlaesse: PAUSCHAL_ANLAESSE,
        pakete: PAKET_STAFFEL,
        rechtsgruende: RECHTSGRUENDE,
      },
      altfelder: {
        provisionSatzBp: a.commission_rate_bp == null ? null : Number(a.commission_rate_bp),
        teamSatzBp: a.override_rate_bp == null ? null : Number(a.override_rate_bp),
        stundensatzCents: a.stundensatz_cents == null ? null : Number(a.stundensatz_cents),
        praemieArt: a.inkasso_praemie_art ?? null,
        praemieWertCents: a.inkasso_praemie_wert == null ? null : Number(a.inkasso_praemie_wert),
        bestaetigtAm: a.verguetung_bestaetigt_am ?? null,
      },
    });
  } catch (err) {
    console.error("[VERGUETUNG] laden:", err);
    res.status(500).json({ ok: false, error: "Die Vergütungsdaten konnten nicht geladen werden." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /admin/verguetung/:agentId/baustein — anlegen oder ABLÖSEN
// ═══════════════════════════════════════════════════════════════════════════
router.post("/admin/verguetung/:agentId/baustein", async (req: Request, res: Response) => {
  try {
    const agentId = Number(req.params.agentId);
    const b = req.body ?? {};
    const typ = String(b.typ ?? "") as BausteinTyp;
    if (!TYPEN.includes(typ)) {
      return res.status(400).json({ ok: false, error: `Unbekannter Baustein-Typ: ${b.typ}` });
    }

    const betragCents = centsAus(b.betragEuro);
    const satzBp = b.satzProzent == null || b.satzProzent === ""
      ? null : Math.round(Number(String(b.satzProzent).replace(",", ".")) * 100);
    const modus = typ === "provision" ? (b.modus === "festbetrag" ? "festbetrag" : "prozent") : null;
    const vermerk = String(b.vermerk ?? "").trim() || null;

    // ── DIE PRÜFUNGEN, DIE GELD BETREFFEN ──────────────────────────────────
    if (typ === "einmalig") {
      if (betragCents == null || betragCents === 0) {
        return res.status(400).json({ ok: false, error: "Eine Einmalzahlung braucht einen Betrag." });
      }
      if (!vermerk) {
        // Ein Abzug ohne Grund ist der Anfang eines Streits — und er steht
        // spaeter im PDF, wo der Mensch ihn liest.
        return res.status(400).json({
          ok: false,
          error: "Eine Gutschrift oder ein Abzug braucht einen Grund. Er erscheint "
            + "später auf der Abrechnung, die der Mitarbeiter liest.",
        });
      }
    }
    if (typ === "fixum" && (betragCents == null || betragCents <= 0)) {
      return res.status(400).json({ ok: false, error: "Ein Fixum braucht einen Betrag über null." });
    }
    if (typ === "provision") {
      if (modus === "prozent" && (satzBp == null || satzBp <= 0)) {
        return res.status(400).json({ ok: false, error: "Bei Prozent braucht es einen Satz über null." });
      }
      if (modus === "festbetrag" && (betragCents == null || betragCents <= 0)) {
        return res.status(400).json({ ok: false, error: "Bei Festbetrag braucht es einen Betrag über null." });
      }
    }
    if (typ === "pauschale") {
      if (!String(b.anlass ?? "").trim()) {
        return res.status(400).json({ ok: false, error: "Eine Pauschale braucht einen Anlass." });
      }
      if (betragCents == null || betragCents <= 0) {
        return res.status(400).json({ ok: false, error: "Eine Pauschale braucht einen Betrag über null." });
      }
    }
    if (typ === "stundensatz" && (betragCents == null || betragCents <= 0)) {
      return res.status(400).json({ ok: false, error: "Ein Stundensatz braucht einen Betrag über null." });
    }

    // Rechtsgrund entscheidet, ob gebucht wird.
    const rechtsgrund = typ === "fixum"
      ? (RECHTSGRUENDE.find((r) => r.schluessel === b.rechtsgrund)?.schluessel ?? "dienstvertrag")
      : null;
    const buchen = typ === "fixum"
      ? (RECHTSGRUENDE.find((r) => r.schluessel === rechtsgrund)?.buchen ?? true)
      : true;

    const heute = await berlinToday();
    const gueltigAb = String(b.gueltigAb ?? "").match(/^\d{4}-\d{2}-\d{2}$/)
      ? String(b.gueltigAb) : heute;
    // ── KEINE RÜCKWIRKUNG ─────────────────────────────────────────────────
    // Ein Baustein, dessen Gültigkeit in der Vergangenheit beginnt, könnte
    // Positionen betreffen, die schon gebucht sind. Das Einfrier-Prinzip
    // verbietet das — also wird es hier abgelehnt und nicht stillschweigend
    // korrigiert.
    if (gueltigAb < heute) {
      return res.status(400).json({
        ok: false,
        error: `Gültig ab ${gueltigAb} liegt in der Vergangenheit. Bereits gebuchte `
          + "Positionen dürfen sich nicht nachträglich ändern — frühestens heute "
          + `(${heute}).`,
      });
    }

    const anlass = typ === "pauschale" ? String(b.anlass).trim() : null;
    const paket = typ === "provision" && b.paket ? String(b.paket) : null;

    // ── ABLÖSEN STATT ÄNDERN ──────────────────────────────────────────────
    // Der bisher gültige Baustein derselben Art (und desselben Pakets/Anlasses)
    // wird zurückgezogen. Er bleibt lesbar; nur seine Wirkung endet.
    const [alt] = (await sqlPool`
      SELECT * FROM fiaon_verguetung_bausteine
       WHERE agent_id = ${agentId} AND typ = ${typ} AND entfernt_am IS NULL AND aktiv
         AND typ <> 'einmalig'
         AND (${anlass}::text IS NULL OR anlass = ${anlass})
         AND (${paket}::text IS NULL OR paket = ${paket})
         AND COALESCE(paket, '') = COALESCE(${paket}, '')
         AND COALESCE(anlass, '') = COALESCE(${anlass}, '')
       ORDER BY gueltig_ab DESC LIMIT 1
    `) as any[];

    const [neu] = (await sqlPool`
      INSERT INTO fiaon_verguetung_bausteine
        (agent_id, typ, aktiv, betrag_cents, satz_bp, modus, paket, anlass,
         rechtsgrund, buchen, auszahlungstag, gueltig_ab, wirkt_am, vermerk,
         erstellt_von, loest_ab_id)
      VALUES (${agentId}, ${typ}, TRUE, ${betragCents}, ${satzBp}, ${modus}, ${paket}, ${anlass},
              ${rechtsgrund}, ${buchen},
              ${typ === "fixum" && b.auszahlungstag ? Number(b.auszahlungstag) : null},
              ${gueltigAb}::date,
              ${typ === "einmalig" ? gueltigAb : null}::date,
              ${vermerk}, ${wer(req)}, ${alt ? Number(alt.id) : null})
      RETURNING id
    `) as any[];

    if (alt && typ !== "einmalig") {
      await sqlPool`
        UPDATE fiaon_verguetung_bausteine
           SET entfernt_am = NOW(), entfernt_von = ${wer(req)}
         WHERE id = ${Number(alt.id)}
      `;
    }

    // ── PROTOKOLL MIT ALT→NEU ─────────────────────────────────────────────
    const beschreibung = (x: any) => x == null ? "—"
      : [x.typ, x.modus, x.paket, x.anlass,
        x.betrag_cents != null ? `${(Number(x.betrag_cents) / 100).toFixed(2)} €` : null,
        x.satz_bp != null ? `${(Number(x.satz_bp) / 100).toFixed(2)} %` : null,
      ].filter(Boolean).join(" · ");
    await logAgentEvent(agentId, "verguetung_baustein_geaendert", {
      typ, alt: beschreibung(alt), neu: beschreibung({
        typ, modus, paket, anlass, betrag_cents: betragCents, satz_bp: satzBp,
      }), gueltigAb, vermerk, wer: wer(req), at: new Date().toISOString(),
    }).catch((e) => console.error("[VERGUETUNG] Protokoll:", e));

    res.json({
      ok: true,
      id: Number(neu.id),
      meldung: alt && typ !== "einmalig"
        ? `Baustein ersetzt — gültig ab ${gueltigAb}. Der bisherige bleibt im Verlauf lesbar.`
        : `Baustein angelegt — gültig ab ${gueltigAb}.`,
      hinweis: !buchen
        ? "Rechtsgrund Anstellung: Das Fixum wird nur ANGEZEIGT und nicht als "
          + "Provisionsgutschrift gebucht — es läuft über die Lohnabrechnung."
        : null,
    });
  } catch (err) {
    console.error("[VERGUETUNG] Baustein:", err);
    res.status(500).json({ ok: false, error: "Der Baustein konnte nicht gespeichert werden." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /admin/verguetung/baustein/:id/schalter — an oder aus
// ═══════════════════════════════════════════════════════════════════════════
router.post("/admin/verguetung/baustein/:id/schalter", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const an = req.body?.aktiv === true;
    const [b] = (await sqlPool`
      SELECT * FROM fiaon_verguetung_bausteine WHERE id = ${id} AND entfernt_am IS NULL
    `) as any[];
    if (!b) return res.status(404).json({ ok: false, error: "Baustein nicht gefunden." });
    await sqlPool`
      UPDATE fiaon_verguetung_bausteine
         SET aktiv = ${an}, geaendert_am = NOW(), geaendert_von = ${wer(req)}
       WHERE id = ${id}
    `;
    await logAgentEvent(Number(b.agent_id), "verguetung_baustein_geaendert", {
      typ: b.typ, alt: b.aktiv ? "aktiv" : "aus", neu: an ? "aktiv" : "aus",
      wer: wer(req), at: new Date().toISOString(),
    }).catch(() => {});
    res.json({
      ok: true,
      meldung: an
        ? "Baustein eingeschaltet — er wirkt auf künftige Positionen."
        : "Baustein ausgeschaltet. Bereits gebuchte Positionen bleiben unverändert.",
    });
  } catch (err) {
    console.error("[VERGUETUNG] Schalter:", err);
    res.status(500).json({ ok: false, error: "Serverfehler." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /admin/verguetung/:agentId/bank-erinnerung — wenn keine IBAN da ist
// ═══════════════════════════════════════════════════════════════════════════
router.post("/admin/verguetung/:agentId/bank-erinnerung", async (req: Request, res: Response) => {
  try {
    const agentId = Number(req.params.agentId);
    const [a] = (await sqlPool`
      SELECT name, first_name, email, bank_iban_enc FROM fiaon_agents WHERE id = ${agentId}
    `) as any[];
    if (!a) return res.status(404).json({ ok: false, error: "Mitarbeiter nicht gefunden." });
    if (a.bank_iban_enc) {
      return res.status(409).json({
        ok: false,
        error: "Es sind schon Bankdaten hinterlegt — eine Erinnerung wäre verwirrend.",
      });
    }
    const email = String(a.email ?? "").trim();
    if (!email.includes("@")) {
      return res.status(409).json({
        ok: false, error: `${a.name} hat keine brauchbare E-Mail-Adresse.`,
      });
    }
    const { sendMakeWebhookMitGrund } = await import("../make-webhook");
    const versand = await sendMakeWebhookMitGrund("agent_bank_reminder", {
      email, vorname: a.first_name || a.name || "",
    });
    if (!versand.ok) {
      return res.status(502).json({
        ok: false,
        error: `Die Erinnerung ging nicht raus: ${versand.grund || "keine Antwort"}. `
          + "Bitte erneut versuchen oder direkt anrufen.",
      });
    }
    await logAgentEvent(agentId, "bank_reminder_sent", {
      wer: wer(req), at: new Date().toISOString(),
    }).catch(() => {});
    res.json({ ok: true, meldung: `Erinnerung an ${email} gesendet.` });
  } catch (err) {
    console.error("[VERGUETUNG] Bank-Erinnerung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler." });
  }
});

export default router;
