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
import { requireKunde, kundenSitzungLoeschen, kundeAusCookie, passwortPasst, passwortHashen, istGehasht, type KundeRequest } from "../lib/fiaon-kunde-session";
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

/**
 * GET /kunde/me — ist jemand angemeldet, und wer?
 *
 * Die öffentliche Kopfzeile (GlassNav) kannte den Login-Zustand nicht: Ein
 * angemeldeter Kunde sah auf jeder Seite „Login" und fand nie zurück in
 * seinen Bereich (Justin, 22.08.2026). Antwortet IMMER 200 — „nicht
 * angemeldet" ist keine Fehlermeldung, sondern eine Auskunft.
 */
router.get("/kunde/me", async (req, res: Response) => {
  try {
    const ref = kundeAusCookie(req);
    if (!ref) return res.json({ ok: true, eingeloggt: false });
    const [a] = (await sqlPool`
      SELECT ref, first_name, last_name, company_name FROM fiaon_applications
      WHERE ref = ${ref} AND merged_into IS NULL AND gdpr_deleted_at IS NULL LIMIT 1`) as any[];
    if (!a) return res.json({ ok: true, eingeloggt: false });
    res.json({ ok: true, eingeloggt: true, ref: a.ref, vorname: a.first_name || null,
      name: [a.first_name, a.last_name].filter(Boolean).join(" ") || a.company_name || null });
  } catch (err) {
    console.error("[KUNDE] me:", err);
    res.json({ ok: true, eingeloggt: false });
  }
});

/**
 * POST /kunde/:ref/abo/verlaengerung — die Antwort auf „Möchten Sie bleiben?" (E-024).
 * { bleiben: true } → weitere 12 Raten, nächste Rate entsteht sofort, bei aktivem
 * Lastschrift-Mandat ein neues GoCardless-Abo. { bleiben: false } → Abo endet.
 */
router.post("/kunde/:ref/abo/verlaengerung", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    const ref = req.kundeRef!;
    const bleiben = req.body?.bleiben === true;
    const [a] = (await sqlPool`SELECT ref, person_id, pack_key, abo_verlaengerung_gefragt_am, abo_verlaengert_am, abo_gestoppt_am
      FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL LIMIT 1`) as any[];
    if (!a) return res.status(404).json({ ok: false, error: "Konto nicht gefunden." });
    if (!a.abo_verlaengerung_gefragt_am) return res.status(409).json({ ok: false, error: "Die Laufzeit ist noch nicht erreicht." });
    if (bleiben) {
      const { ABO_LAUFZEIT_RATEN, naechsteRateAnlegen } = await import("./fiaon-abo");
      await sqlPool`UPDATE fiaon_applications SET abo_verlaengert_am = NOW(), abo_verlaengert_raten = COALESCE(abo_verlaengert_raten, 0) + ${ABO_LAUFZEIT_RATEN},
        abo_verlaengerung_gefragt_am = NULL, abo_gestoppt_am = NULL, updated_at = NOW() WHERE ref = ${ref}`;
      const [letzte] = (await sqlPool`SELECT rate_nr, faellig_am, betrag_cents, zahlungsreferenz FROM fiaon_abo_raten
        WHERE ref = ${ref} AND storniert_am IS NULL ORDER BY rate_nr DESC LIMIT 1`) as any[];
      if (letzte) await naechsteRateAnlegen(ref, letzte);
      // Lastschrift: neues 12er-Abo, wenn ein Mandat aktiv ist.
      try {
        const { gcAboAnlegen } = await import("./fiaon-lastschrift");
        await gcAboAnlegen(ref);
      } catch (e) { console.error("[MEIN-BEREICH] GC-Verlängerung:", e); }
      await sqlPool`INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
        VALUES (${ref}, NULL, 'System', 'system', 'Kunde hat das Abo um weitere 12 Raten verlängert (E-024).')`.catch(() => {});
      return res.json({ ok: true, verlaengert: true, meldung: "Schön, dass Sie bleiben. Ihr Abo läuft weitere zwölf Monate." });
    }
    await sqlPool`UPDATE fiaon_applications SET abo_gestoppt_am = NOW(), abo_stopp_grund = 'Kunde: nach 12 Raten nicht verlängert (E-024)', updated_at = NOW() WHERE ref = ${ref}`;
    await sqlPool`INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${ref}, NULL, 'System', 'system', 'Kunde hat das Abo nach 12 Raten NICHT verlängert — Abo beendet (E-024).')`.catch(() => {});
    res.json({ ok: true, verlaengert: false, meldung: "Ihr Abo endet mit der letzten Rate. Vielen Dank für Ihr Vertrauen — Sie sind jederzeit willkommen." });
  } catch (err) {
    console.error("[MEIN-BEREICH] verlaengerung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** GET /kunde/:ref/bereich — alles für die Seite. */
router.get("/kunde/:ref/bereich", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    const ref = req.kundeRef!;
    await (await import("./fiaon-abo")).ensureAboTabellen();
    const [a] = (await sqlPool`
      SELECT a.password, a.abo_verlaengerung_gefragt_am, a.abo_verlaengert_am, a.abo_gestoppt_am, a.ref, a.person_id, a.first_name, a.last_name, a.email, a.phone, a.phone_country_code,
             a.street, a.zip, a.city, a.country, a.birthdate,
             a.pack_key, a.pack_name, a.approved_limit, a.wanted_limit,
             a.payment_status, a.payment_reference, a.amount_due, a.payment_due_date,
             a.created_at, a.account_status, a.kyc_status,
             (a.bank_statement_pdf IS NOT NULL) AS hat_kontoauszug,
             (a.id_card_pdf IS NOT NULL) AS hat_ausweis,
             a.reupload_bank_statement, a.reupload_id_card, a.profile_changes_requested, a.admin_profile_note,
             p.assigned_agent_id, p.gc_mandate_ref, p.gc_mandate_status,
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
    // Ein Gespräch, nicht zwei (23.08.2026): Wer vor der Zahlung einen Termin gebucht hat, sieht ihn hier
    // als sein Gespräch — die Gesprächsart leitet die Terminlogik aus dem Zustand ab.
    const start = termine.find((t) => t.quelle === "onboarding_call" && t.status === "erledigt")
      || termine.find((t) => t.quelle === "onboarding_call" && t.status === "gebucht")
      || termine.find((t) => t.status === "gebucht" && new Date(t.beginn) > new Date()) || null;

    // ══════════════════════════════════════════════════════════════════════
    // HAT DAS GESPRÄCH STATTGEFUNDEN? (26.08.2026, Florentines Punkt 1)
    //
    // „Sobald der Kunde sich danach erneut auf der Plattform anmeldet, wird
    // ihm jedoch wieder angezeigt, dass er zunächst einen Termin beim
    // Onboarding buchen muss."
    //
    // BEFUND: Die Sperre hing allein an `start` — also an einem TERMIN. Die
    // Liste oben holt aber nur die letzten fünf, und ein Gespräch, das
    // stattgefunden hat, kann als „verpasst" oder „abgesagt" verbucht sein
    // (66 bzw. 18 Fälle): Der Kunde ging nicht ans erste Klingeln, man hat
    // ihn zurückgerufen, das Gespräch lief — der Termin blieb „verpasst".
    // GEMESSEN: 382 zahlende Kunden bekamen die Aufforderung erneut.
    //
    // NACHHER entscheidet nicht der Termin, sondern die TATSACHE: Gab es je
    // ein Onboarding-Gespräch? Eine eigene Abfrage ohne Fenstergrenze, und
    // sie zählt auch ein dokumentiertes Gespräch im Verlauf. Ein Mensch, mit
    // dem gesprochen wurde, wird nicht ein zweites Mal zur Buchung geschickt.
    // ══════════════════════════════════════════════════════════════════════
    // ══════════════════════════════════════════════════════════════════════
    // HIER STAND EINE DRITTE PRÜFUNG, UND SIE HAT ALLES LAHMGELEGT
    //
    // Am 26.08.2026 habe ich hier eine EXISTS-Prüfung auf
    // fiaon_onboarding_schritte mit os.person_id eingebaut. Diese Tabelle hat
    // aber gar keine Spalte person_id — sie führt die Einschulungsschritte der
    // MITARBEITER (id, agent_id, schluessel, erledigt_am). Eine entsprechende
    // Tabelle für Kunden gibt es nicht.
    //
    // Die Folge war nicht ein fehlendes Häkchen, sondern ein Fehler der GANZEN
    // Abfrage: Jeder angemeldete Kunde mit person_id bekam „Der Bereich konnte
    // gerade nicht geladen werden." Zwölf Stunden lang — gemeldet wurde es als
    // „man kann sich nicht einloggen", weil es sich für den Kunden genau so
    // anfühlt.
    //
    // LEHRE: Ein Spaltenname, den ich nicht nachgeschlagen habe, ist eine
    // Vermutung. In einer EXISTS-Unterabfrage fällt sie nicht auf — sie reisst
    // die ganze Antwort mit.
    //
    // Zwei Belege genügen und sind beide belastbar: ein als erledigt
    // vermerkter Onboarding-Termin oder ein dokumentiertes Gespräch.
    // ══════════════════════════════════════════════════════════════════════
    const [ob] = a.person_id ? ((await sqlPool`
      SELECT
        EXISTS (SELECT 1 FROM fiaon_termine t
                 WHERE t.person_id = ${a.person_id}
                   AND t.quelle = 'onboarding_call' AND t.status = 'erledigt') AS termin_erledigt,
        EXISTS (SELECT 1 FROM fiaon_contact_log cl
                 WHERE cl.person_id = ${a.person_id}
                   AND cl.type IN ('onboarding', 'startgespraech')) AS gespraech_im_verlauf,
        TRUE AS platzhalter
    `) as any[]) : [null];
    // Zwei Belege genügen und sind beide belastbar: ein als erledigt
    // vermerkter Onboarding-Termin oder ein dokumentiertes Gespräch.
    const onboardingGelaufen = !!(ob?.termin_erledigt || ob?.gespraech_im_verlauf);

    // Die Bonitätsauskunft ist eine EIGENE Bestellung (type='schufa') mit eigenem
    // Verwendungszweck — der Kunde soll sie VOR dem Startgespräch bezahlen können.
    const [schufa] = a.person_id ? ((await sqlPool`
      SELECT ref, payment_reference, payment_status, amount_due FROM fiaon_applications
      WHERE person_id = ${a.person_id} AND merged_into IS NULL AND archived_at IS NULL
        AND (type = 'schufa' OR ref LIKE 'FIAON-SCHUFA-%')
      ORDER BY created_at DESC LIMIT 1`) as any[]) : [null];

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

    // ── DERSELBE KARTEN-STAND WIE IN DER MITARBEITERANSICHT (27.08., P.18) ──
    // Gemeldet: Mitarbeiter sah „Alles fertig — Karte kann bestellt werden",
    // der Kunde im Portal „In Prüfung". Zwei Anzeigen, zwei Quellen. Jetzt
    // liest das Portal DIESELBE Funktion (kartenStand) wie die Akte — mit dem
    // Kundensatz je Tor, nicht dem internen. Geschuetzt: Faellt die Abfrage,
    // faellt nur die Kachel — nie der Bereich (Lehre vom 26./27.08.).
    let karte: any = null;
    if (a.person_id) {
      try {
        const { kartenStand } = await import("../lib/fiaon-konto-karte");
        const ks = await kartenStand(Number(a.person_id));
        if (ks) {
          karte = {
            bereit: ks.bereit,
            esFehlt: ks.esFehlt,
            verschickt: !!ks.versand,
            tore: (ks.tore || []).map((t: any) => ({
              titel: t.titel, erfuellt: t.erfuellt, warum: t.warumFuerKunden ?? null,
            })),
          };
        }
      } catch (e) {
        console.error("[MEIN-BEREICH] kartenStand:", e);
      }
    }

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
        pflicht: konto?.pflicht ?? false,
        bezahlt: String(a.payment_status) === "paid",
      },
      bonitaet: bonitaet ? {
        stufe: bonitaet.stufe, fuerKunden: bonitaet.fuerKunden, naechsterSchritt: bonitaet.naechsterSchritt,
        bezahlt: bonitaet.bezahlt, hatDokument: bonitaet.hatDokument, geprueft: bonitaet.dokumentGeprueft,
        darfKaufen: bonitaet.darfKaufen, darfHochladen: bonitaet.darfHochladen, bestellRef: bonitaet.bestellRef,
        zahlungsreferenz: schufa?.payment_reference || null, zahlungsstatus: schufa?.payment_status || null,
        preisEuro: schufa?.amount_due != null ? Number(schufa.amount_due) : 74,
      } : null,
      karte,
      unterlagen: {
        kontoauszug: !!a.hat_kontoauszug, ausweis: !!a.hat_ausweis, auskunft: auskunftDa,
        erneutKontoauszug: !!a.reupload_bank_statement, erneutAusweis: !!a.reupload_id_card,
        kycStatus: a.kyc_status || "pending", kontoStatus: a.account_status || "pending",
        // P9 (01.09.2026): Sofort-Befunde der automatischen Prüfung, in
        // Sie-Form — nur gesetzt, wenn etwas auffällig ist. Der 2,2-s-Reload
        // nach dem Upload holt sie meist schon mit.
        hinweise: await (async () => {
          try {
            const { urteileLesen } = await import("../lib/fiaon-dokument-pruefung");
            const u = await urteileLesen([String(ref)]);
            return Object.values(u)
              .filter((x: any) => x?.hinweisKunde && (x.erkannt === false || x.vollstaendig === false))
              .map((x: any) => String(x.hinweisKunde)).slice(0, 3);
          } catch { return []; }
        })(),
      },
      abo: {
        // E-024: Laufzeit erreicht? Dann zeigt der Bereich die Frage.
        verlaengerung: {
          gefragt: !!a.abo_verlaengerung_gefragt_am, entschieden: !!a.abo_verlaengert_am || !!a.abo_gestoppt_am,
          verlaengert: !!a.abo_verlaengert_am, beendet: !!a.abo_gestoppt_am,
          bezahlteRaten: raten.filter((r) => r.status === "bezahlt").length,
        },
        naechste: naechste ? { nr: naechste.rate_nr, betragCents: naechste.betrag_cents, faelligAm: tag(naechste.faellig_am), status: naechste.status, referenz: naechste.zahlungsreferenz } : null,
        offen: offen.length, bezahlt: raten.filter((r) => r.status === "bezahlt").length,
        raten: raten.map((r) => ({ nr: r.rate_nr, betragCents: r.betrag_cents, faelligAm: tag(r.faellig_am), faelligIso: r.faellig_am ? new Date(r.faellig_am).toISOString().slice(0, 10) : null, status: r.status, bezahltAm: tag(r.bezahlt_am), referenz: r.zahlungsreferenz })),
      },
      termin: start ? { beginn: start.beginn, status: start.status, agent: start.agent || null } : null,
      // Der Kundenbereich sperrt anhand dieser Tatsache, nicht anhand des Termins.
      onboardingGelaufen,
      fahrplan: etappen,
      naechsterSchritt: jetzt ? { key: jetzt.key, titel: jetzt.titel, text: jetzt.text, href: jetzt.href || null } : null,
      ansprechpartner: a.betreuer_name ? { name: a.betreuer_name, rolle: a.betreuer_rolle || null } : null,
      lastschrift: { mandat: a.gc_mandate_ref || null, status: a.gc_mandate_status || null, aktiv: a.gc_mandate_status === "active" },
      kontoVerbunden: false,
      // Einrichtung (23.08.2026): Ohne Passwort zeigt der Bereich die Einrichtungs-Ebene.
      passwortGesetzt: istGehasht(a.password),
      // Die Auswertung des Kontoauszugs (22.08.2026) — null, solange keiner da ist.
      finanzen: await (await import("../lib/fiaon-kontoauszug-analyse")).analyseFuer(ref).catch(() => null),
    });
  } catch (err) {
    console.error("[MEIN-BEREICH] bereich:", err);
    res.status(500).json({ ok: false, error: "Der Bereich konnte gerade nicht geladen werden. Bitte versuchen Sie es in einer Minute erneut." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// STAMMDATEN ÄNDERN (27.08.2026)
//
// Florentine: „Kunden-Adressänderung und Uploads werden nicht gespeichert."
//
// ── WAS WIRKLICH PASSIERTE ────────────────────────────────────────────────
// Der Kundenbereich rief `PATCH /profile/:ref` in fiaon-antrag.ts. Diese
// Route stammt aus dem Antragsweg und liest ganz andere Feldnamen:
// movedRecently, previousStreet, passportNumber, expensesFood und so fort.
// Der Bereich sendet email, phone, street, zip, city — KEINES davon wird
// dort gelesen.
//
// Die Folge war doppelt schlecht:
//   1. Die neue Anschrift wurde verworfen, und der Kunde las „Gespeichert."
//   2. Schlimmer: Weil die Route jedes ihrer Felder bedingungslos schreibt,
//      setzte derselbe Aufruf Ausweisnummer, Voranschrift und sämtliche
//      Ausgabenfelder auf NULL und `moved_recently` auf falsch. Ein Kunde,
//      der seine Anschrift berichtigen wollte, löschte damit seine eigenen
//      KYC-Angaben.
//
// ── DIE REGEL DIESER ROUTE ────────────────────────────────────────────────
// Geschrieben wird NUR, was auch gesendet wurde. Fehlt ein Feld in der
// Anfrage, bleibt die Spalte unangetastet — nicht null. Genau dieser
// Unterschied hat oben den Schaden angerichtet.
//
// Geändert wird ausschliesslich die eigene Akte (requireKunde liefert die
// Referenz aus dem signierten Cookie, nicht aus der Adresszeile), und jede
// Änderung hinterlässt einen Vermerk: Wer seine Anschrift ändert, ändert
// etwas, das für Rechnungen und Schreiben zählt.
// ═══════════════════════════════════════════════════════════════════════════
router.patch("/kunde/:ref/stammdaten", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    const ref = req.kundeRef!;
    const b = req.body ?? {};

    /** Leerer String heisst „gelöscht", fehlendes Feld heisst „unverändert". */
    const feld = (wert: unknown): string | null | undefined => {
      if (wert === undefined) return undefined;
      const t = String(wert ?? "").trim();
      return t === "" ? null : t;
    };

    const email = feld(b.email);
    const phone = feld(b.phone ?? b.telefon);
    const street = feld(b.street ?? b.strasse);
    const zip = feld(b.zip ?? b.plz);
    const city = feld(b.city ?? b.ort);

    if (email !== undefined && email !== null && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) {
      return res.status(400).json({ ok: false, error: "Diese E-Mail-Adresse sieht nicht richtig aus." });
    }
    if (zip !== undefined && zip !== null && !/^[0-9]{4,5}$/.test(zip)) {
      return res.status(400).json({ ok: false, error: "Die Postleitzahl besteht aus vier oder fünf Ziffern." });
    }

    const [alt] = (await sqlPool`
      SELECT email, phone, street, zip, city, person_id
        FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL LIMIT 1`) as any[];
    if (!alt) return res.status(404).json({ ok: false, error: "Konto nicht gefunden." });

    // Nur gesendete Felder — COALESCE auf den bisherigen Wert wäre falsch,
    // weil man dann nichts mehr leeren könnte.
    await sqlPool`
      UPDATE fiaon_applications SET
        email  = ${email  === undefined ? alt.email  : email},
        phone  = ${phone  === undefined ? alt.phone  : phone},
        street = ${street === undefined ? alt.street : street},
        zip    = ${zip    === undefined ? alt.zip    : zip},
        city   = ${city   === undefined ? alt.city   : city},
        updated_at = NOW()
      WHERE ref = ${ref}`;

    // Die Person führt dieselben Angaben — läuft sie auseinander, sucht das
    // Team später zwei Anschriften desselben Menschen. Die bisherigen Werte
    // werden GELESEN und zurückgeschrieben, statt einen SQL-Ausschnitt in die
    // Wertposition zu setzen: Das wäre eine Konstruktion, die beim nächsten
    // Bibliotheks-Update still das Falsche tut.
    if (alt.person_id) {
      try {
        const [pAlt] = (await sqlPool`
          SELECT primary_email, primary_phone, street, zip, city
            FROM fiaon_persons WHERE id = ${alt.person_id} LIMIT 1`) as any[];
        if (pAlt) {
          await sqlPool`
            UPDATE fiaon_persons SET
              primary_email = ${email  === undefined ? pAlt.primary_email : email},
              primary_phone = ${phone  === undefined ? pAlt.primary_phone : phone},
              street        = ${street === undefined ? pAlt.street : street},
              zip           = ${zip    === undefined ? pAlt.zip : zip},
              city          = ${city   === undefined ? pAlt.city : city},
              updated_at = NOW()
            WHERE id = ${alt.person_id}`;
        }
      } catch (e) {
        // Die Akte ist gespeichert; der Abgleich darf das nicht zurücknehmen.
        console.error("[MEIN-BEREICH] Personen-Abgleich:", String(e).slice(0, 160));
      }
    }

    // Was sich geändert hat, in Worten — für den Vermerk und die Antwort.
    const paare: [string, any, any][] = [
      ["E-Mail", alt.email, email], ["Telefon", alt.phone, phone],
      ["Straße", alt.street, street], ["PLZ", alt.zip, zip], ["Ort", alt.city, city],
    ];
    const geaendert = paare
      .filter(([, a, n]) => n !== undefined && String(a ?? "") !== String(n ?? ""))
      .map(([label, a, n]) => `${label}: ${a || "leer"} → ${n || "leer"}`);

    if (geaendert.length) {
      await sqlPool`
        INSERT INTO fiaon_vermerke (art, ref, text, sicht, autor_art, autor_name, created_at)
        VALUES ('system', ${ref}, ${"Der Kunde hat seine Stammdaten geändert — " + geaendert.join("; ")},
                'intern', 'kunde', 'Kundenbereich', NOW())`.catch(() => {});
      console.log(`[MEIN-BEREICH] Stammdaten ${ref}: ${geaendert.join("; ")}`);
    }

    res.json({ ok: true, geaendert });
  } catch (err) {
    console.error("[MEIN-BEREICH] stammdaten:", err);
    res.status(500).json({ ok: false, error: "Ihre Angaben konnten nicht gespeichert werden. Bitte versuchen Sie es erneut." });
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

// ═══════════════════════════════════════════════════════════════════════════
// TERMINE IM KUNDENPORTAL (27.08.2026, Team-Punkt 10)
//
// Der Kunde sieht seine Termine — kommende mit Absagelink, vergangene zur
// Einordnung — und kann selbst eine neue Zeit waehlen. Der Buchungslink ist
// derselbe persoenliche Terminlink wie ueberall (terminTokenErzeugen): Die
// GESPRAECHSART entscheidet dort die Ableitung aus seinem Zustand — genau die
// Team-Anforderung „klar definiert, fuer welche Anliegen welcher Termin".
// Wer schon voll freigeschaltet ist, bucht damit nie wieder ein Startgespraech
// — die Ableitung kennt seinen Stand.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/kunde/:ref/termine", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    const ref = String(req.params.ref);
    const [a] = (await sqlPool`
      SELECT person_id FROM fiaon_applications
      WHERE ref = ${ref} AND merged_into IS NULL LIMIT 1`) as any[];
    if (!a?.person_id) return res.json({ ok: true, kommende: [], vergangene: [], buchungsLink: null });

    const termine = (await sqlPool`
      SELECT t.id, t.beginn, t.dauer_min, t.status, t.quelle, t.storno_token,
             COALESCE(NULLIF(ag.name, ''), TRIM(CONCAT_WS(' ', NULLIF(ag.first_name, ''), NULLIF(ag.last_name, '')))) AS agent_vorname
        FROM fiaon_termine t LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
       WHERE t.person_id = ${a.person_id}
       ORDER BY t.beginn DESC LIMIT 20`) as any[];

    const { terminTokenErzeugen, berlinDatumText, berlinUhrzeit } = await import("../lib/fiaon-termine");
    const { terminArtAusQuelle } = await import("../../shared/fiaon-termin-art");
    const jetzt = Date.now();
    const zeile = (t: any) => ({
      beginn: t.beginn,
      datumText: berlinDatumText(new Date(t.beginn)),
      uhrzeit: berlinUhrzeit(new Date(t.beginn)),
      art: terminArtAusQuelle(String(t.quelle)).text,
      status: t.status,
      mit: t.agent_vorname || null,
      // Absagen nur fuer kommende gebuchte — ueber die bestehende oeffentliche Seite.
      absageLink: t.status === "gebucht" && new Date(t.beginn).getTime() > jetzt && t.storno_token
        ? `/termin/absagen/${t.storno_token}` : null,
    });
    res.json({
      ok: true,
      kommende: termine.filter((t: any) => new Date(t.beginn).getTime() > jetzt && t.status === "gebucht").map(zeile).reverse(),
      vergangene: termine.filter((t: any) => new Date(t.beginn).getTime() <= jetzt || t.status !== "gebucht").map(zeile).slice(0, 6),
      buchungsLink: `/termin/${terminTokenErzeugen(Number(a.person_id))}`,
    });
  } catch (err) {
    console.error("[KUNDE] termine:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

