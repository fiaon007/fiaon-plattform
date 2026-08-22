// ═══════════════════════════════════════════════════════════════════════════
// MEIN BEREICH — der neue Kundenbereich (E-013, 22.08.2026)
//
// EIN Endpunkt liefert alles, was die Seite zeichnet. Die Seite rechnet nichts
// selbst: Stufe, Etappen und der nächste Schritt werden HIER abgeleitet, aus
// denselben Quellen wie Akte und Startgespräch-Gate (fiaon-kontostufe,
// fiaon-kundenstufe, fiaon-bonitaet-status). Zwei Wahrheiten gäbe es sonst
// wieder — eine im Portal, eine in der Akte.
//
// Alle Endpunkte hier stehen hinter `requireKunde` (signiertes Cookie, siehe
// fiaon-kunde-session.ts). Die Referenz in der URL muss zum Cookie passen.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireKunde, kundenSitzungLoeschen, passwortPasst, passwortHashen, type KundeRequest } from "../lib/fiaon-kunde-session";
import { effectiveLimit } from "./fiaon-antrag";
import { paket as paketVon } from "@shared/fiaon-pakete";

const router = Router();

type Stand = "fertig" | "jetzt" | "kommt";
interface Etappe { key: string; titel: string; text: string; stand: Stand; datum: string | null; stempel: string | null; href?: string }

const tag = (d: any): string | null => {
  if (!d) return null;
  const x = new Date(d); if (Number.isNaN(x.getTime())) return null;
  return x.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
};

/** GET /kunde/:ref/bereich — alles für die Seite. */
router.get("/kunde/:ref/bereich", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    const ref = req.kundeRef!;
    const [a] = (await sqlPool`
      SELECT a.ref, a.person_id, a.first_name, a.last_name, a.email, a.phone, a.phone_country_code,
             a.street, a.zip, a.city, a.country, a.birthdate,
             a.pack_key, a.pack_name, a.approved_limit, a.wanted_limit,
             a.payment_status, a.payment_reference, a.amount_due, a.payment_due_date,
             a.created_at, a.account_status, a.kyc_status,
             (a.bank_statement_pdf IS NOT NULL) AS hat_kontoauszug,
             (a.id_card_pdf IS NOT NULL) AS hat_ausweis,
             a.reupload_bank_statement, a.reupload_id_card, a.profile_changes_requested, a.admin_profile_note,
             p.assigned_agent_id,
             (SELECT g.name FROM fiaon_agents g WHERE g.id = p.assigned_agent_id) AS betreuer_name,
             (SELECT g.rolle FROM fiaon_agents g WHERE g.id = p.assigned_agent_id) AS betreuer_rolle
      FROM fiaon_applications a
      LEFT JOIN fiaon_persons p ON p.id = a.person_id
      WHERE a.ref = ${ref} AND a.merged_into IS NULL
      LIMIT 1
    `) as any[];
    if (!a) return res.status(404).json({ ok: false, error: "Konto nicht gefunden." });

    const { stufeVon } = await import("../lib/fiaon-kontostufe");
    const { stufeAbleiten } = await import("../lib/fiaon-kundenstufe");
    const { bonitaetFuer } = await import("../lib/fiaon-bonitaet-status");
    const [konto, abgeleitet, bonitaet] = await Promise.all([
      stufeVon(ref).catch(() => null),
      stufeAbleiten(ref).catch(() => null),
      bonitaetFuer(ref).catch(() => null),
    ]);

    // Termine des Kunden (Startgespräch)
    const termine = a.person_id ? ((await sqlPool`
      SELECT id, beginn, dauer_min, status, quelle, erledigt_am,
             (SELECT g.name FROM fiaon_agents g WHERE g.id = t.agent_id) AS agent
      FROM fiaon_termine t WHERE t.person_id = ${a.person_id}
      ORDER BY beginn DESC LIMIT 5
    `) as any[]) : [];
    const start = termine.find((t) => t.quelle === "onboarding_call" && t.status === "erledigt")
      || termine.find((t) => t.quelle === "onboarding_call" && t.status === "gebucht") || null;

    // Abo-Raten
    const raten = (await sqlPool`
      SELECT rate_nr, betrag_cents, faellig_am, status, bezahlt_am, zahlungsreferenz
      FROM fiaon_abo_raten WHERE ref = ${ref} ORDER BY faellig_am ASC
    `) as any[];
    const offen = raten.filter((r) => r.status !== "bezahlt");
    const naechste = offen.find((r) => new Date(r.faellig_am) >= new Date(new Date().toDateString())) || offen[0] || null;
    const pk = paketVon(a.pack_key);

    // ── Etappen — eine Reihenfolge, aus echten Zuständen ────────────────────
    const unterlagenOk = !!a.hat_kontoauszug && !!a.hat_ausweis && !a.reupload_bank_statement && !a.reupload_id_card;
    const startErledigt = !!start && start.status === "erledigt";
    const auskunftBezahlt = !!bonitaet?.bezahlt;
    const auskunftDa = !!bonitaet?.hatDokument;
    const analyseFertig = !!bonitaet?.dokumentGeprueft;

    const etappen: Etappe[] = [
      {
        key: "start", titel: "Startgespräch",
        text: startErledigt
          ? `Geführt${start?.agent ? ` mit ${start.agent}` : ""}. Ihr Konto ist seitdem vollständig freigeschaltet.`
          : start ? `Gebucht für ${new Date(start.beginn).toLocaleString("de-DE", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })} Uhr${start.agent ? ` mit ${start.agent}` : ""}.`
          : "Fünfzehn Minuten am Telefon: Wir gehen Ihren Bereich gemeinsam durch und schalten Ihr Konto vollständig frei.",
        stand: startErledigt ? "fertig" : "jetzt",
        datum: tag(start?.erledigt_am || start?.beginn), stempel: startErledigt ? "erledigt" : start ? "gebucht" : "Termin wählen",
        href: startErledigt ? undefined : "/dashboard",
      },
      {
        key: "unterlagen", titel: "Unterlagen vollständig",
        text: unterlagenOk ? "Kontoauszug und Ausweis liegen vor und sind geprüft."
          : [!a.hat_kontoauszug || a.reupload_bank_statement ? "Kontoauszug der letzten drei Monate" : null,
             !a.hat_ausweis || a.reupload_id_card ? "Ausweis oder Reisepass" : null].filter(Boolean).join(" und ") + " fehlt noch. Ein Handyfoto genügt, wenn alles lesbar ist.",
        stand: unterlagenOk ? "fertig" : "kommt", datum: null, stempel: unterlagenOk ? "geprüft" : "offen", href: "#unterlagen",
      },
      {
        key: "auskunft", titel: "Bonitätsauskunft",
        text: auskunftDa ? "Ihre Auskunft ist eingegangen."
          : auskunftBezahlt ? "Bezahlt — wir beschaffen die Auskunft und melden uns, sobald sie vorliegt."
          : "Eine tagesaktuelle Auskunft, neutral abgerufen — der Abruf verändert Ihren Wert nicht. Einmalig 74 €, kein Abo.",
        stand: auskunftDa ? "fertig" : "kommt", datum: null,
        stempel: auskunftDa ? "liegt vor" : auskunftBezahlt ? "in Beschaffung" : "74 € einmalig", href: "#bonitaet",
      },
      {
        key: "analyse", titel: "Analyse durch FIAON",
        text: analyseFertig ? "Jeder Eintrag geprüft und in Menschensprache erklärt."
          : "Wir gehen jeden Eintrag durch, bewerten seine Wirkung und leiten daraus Ihre nächsten Schritte ab.",
        stand: analyseFertig ? "fertig" : "kommt", datum: null, stempel: analyseFertig ? "fertig" : "nach der Auskunft",
      },
      { key: "schreiben", titel: "Schreiben versenden", text: "Löschanträge, Widersprüche und Ratenvereinbarungen — fertig vorbereitet, juristisch geprüft, mit einem Klick versendet.", stand: "kommt", datum: null, stempel: "nach der Analyse", href: "#schreiben" },
      { key: "girokonto", titel: "Girokonto bei der DKB", text: "Kostenlos, unabhängig von Ihrer Bonität. Spart im Jahr rund 60 € Kontoführung.", stand: "kommt", datum: null, stempel: "heute möglich", href: "#vorteile" },
      { key: "karte", titel: `Kreditkarte${a.wanted_limit ? ` bis ${Number(a.wanted_limit).toLocaleString("de-DE")} €` : ""}`, text: "Das Ziel. Realistisch, sobald Ihr Wert die Schwelle des Kartenpartners erreicht — wir sagen Ihnen, wann es so weit ist.", stand: "kommt", datum: null, stempel: "Ziel", href: "#vorteile" },
    ];
    // Genau EINE Etappe ist „jetzt": die erste, die nicht fertig ist.
    let jetztGesetzt = false;
    for (const e of etappen) {
      if (e.stand === "fertig") continue;
      e.stand = jetztGesetzt ? "kommt" : "jetzt"; jetztGesetzt = true;
    }
    const jetzt = etappen.find((e) => e.stand === "jetzt") || null;

    res.json({
      ok: true,
      kunde: {
        ref, vorname: a.first_name || "", nachname: a.last_name || "", email: a.email || "",
        telefon: [a.phone_country_code, a.phone].filter(Boolean).join(" "),
        strasse: a.street || "", plz: a.zip || "", ort: a.city || "", land: a.country || "",
        geburtsdatum: a.birthdate || null, kundeSeit: tag(a.created_at),
        profilRueckfrage: !!a.profile_changes_requested, profilHinweis: a.admin_profile_note || null,
      },
      paket: {
        key: a.pack_key || null, name: a.pack_name || pk?.label || "FIAON", abo: pk?.abo ?? true,
        rahmen: effectiveLimit(a.pack_key, a.approved_limit), wunschlimit: a.wanted_limit != null ? Number(a.wanted_limit) : null,
        monatlichCents: pk?.preisCents ?? (a.amount_due != null ? Math.round(Number(a.amount_due) * 100) : null),
        zahlungsstatus: a.payment_status || "pending", zahlungsreferenz: a.payment_reference || null,
        faelligAm: tag(a.payment_due_date),
      },
      stufe: {
        stufe: abgeleitet?.stufe ?? konto?.stufe ?? null, text: konto?.text ?? null,
        grund: abgeleitet?.grund ?? null, naechsterSchritt: abgeleitet?.naechsterSchritt ?? null,
        vollAktiv: (abgeleitet?.stufe ?? konto?.stufe) === "voll_aktiv",
      },
      bonitaet: bonitaet ? {
        stufe: bonitaet.stufe, fuerKunden: bonitaet.fuerKunden, naechsterSchritt: bonitaet.naechsterSchritt,
        bezahlt: bonitaet.bezahlt, hatDokument: bonitaet.hatDokument, geprueft: bonitaet.dokumentGeprueft,
        darfKaufen: bonitaet.darfKaufen, darfHochladen: bonitaet.darfHochladen, bestellRef: bonitaet.bestellRef,
      } : null,
      unterlagen: {
        kontoauszug: !!a.hat_kontoauszug, ausweis: !!a.hat_ausweis, auskunft: auskunftDa,
        erneutKontoauszug: !!a.reupload_bank_statement, erneutAusweis: !!a.reupload_id_card,
        kycStatus: a.kyc_status || "pending", kontoStatus: a.account_status || "pending",
      },
      abo: {
        naechste: naechste ? { nr: naechste.rate_nr, betragCents: naechste.betrag_cents, faelligAm: tag(naechste.faellig_am), status: naechste.status, referenz: naechste.zahlungsreferenz } : null,
        offen: offen.length, bezahlt: raten.filter((r) => r.status === "bezahlt").length,
        raten: raten.map((r) => ({ nr: r.rate_nr, betragCents: r.betrag_cents, faelligAm: tag(r.faellig_am), faelligIso: r.faellig_am ? new Date(r.faellig_am).toISOString().slice(0, 10) : null, status: r.status, bezahltAm: tag(r.bezahlt_am), referenz: r.zahlungsreferenz })),
      },
      termin: start ? { beginn: start.beginn, status: start.status, agent: start.agent || null } : null,
      fahrplan: etappen,
      naechsterSchritt: jetzt ? { key: jetzt.key, titel: jetzt.titel, text: jetzt.text, href: jetzt.href || null } : null,
      ansprechpartner: a.betreuer_name ? { name: a.betreuer_name, rolle: a.betreuer_rolle || null } : null,
      kontoVerbunden: false,
    });
  } catch (err) {
    console.error("[MEIN-BEREICH] bereich:", err);
    res.status(500).json({ ok: false, error: "Der Bereich konnte gerade nicht geladen werden. Bitte versuchen Sie es in einer Minute erneut." });
  }
});

/** POST /kunde/:ref/passwort — eigenes Passwort ändern (altes muss stimmen). */
router.post("/kunde/:ref/passwort", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    const ref = req.kundeRef!;
    const alt = String(req.body?.alt ?? "");
    const neu = String(req.body?.neu ?? "");
    if (neu.length < 8) return res.status(400).json({ ok: false, error: "Das neue Passwort braucht mindestens 8 Zeichen." });
    const [a] = (await sqlPool`SELECT password FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL LIMIT 1`) as any[];
    if (!a) return res.status(404).json({ ok: false, error: "Konto nicht gefunden." });
    if (!passwortPasst(a.password, alt)) return res.status(400).json({ ok: false, error: "Das bisherige Passwort stimmt nicht." });
    await sqlPool`UPDATE fiaon_applications SET password = ${passwortHashen(neu)}, updated_at = NOW() WHERE ref = ${ref}`;
    res.json({ ok: true });
  } catch (err) {
    console.error("[MEIN-BEREICH] passwort:", err);
    res.status(500).json({ ok: false, error: "Das Passwort konnte nicht geändert werden." });
  }
});

/** POST /kunde/logout — Sitzung beenden. */
router.post("/kunde/logout", (_req, res: Response) => {
  kundenSitzungLoeschen(res);
  res.json({ ok: true });
});

export default router;
