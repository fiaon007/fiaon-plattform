// ═══════════════════════════════════════════════════════════════════════════
// ARAS — die zwölf Werkzeuge (E-408, Vertrag § 8)
//
// Deterministisch, kein zweites Modell: Jedes Werkzeug ruft eine BESTEHENDE
// Funktion des Hauses (Akte, ergebnisNachbereiten, ratenpauseAnwenden,
// terminBuchen, waSenden/mailSenden, Telefonsperre, Twilio-Aufnahme, Übergabe).
// Jeder Aufruf steht in fiaon_aras_werkzeug und im Protokoll (Kanal telefon).
// Das Ergebnis geht als kurzer Vorlese-Text (≤ 400 Zeichen) an die Stimme.
//
// Nie als Werkzeug: Geld buchen, Erstattung, Raten-Storno, Kündigung buchen,
// Vertrag schließen, Lastschrift. Global-Kunde: nur fünf Werkzeuge
// (werkzeugeFuer in shared/fiaon-aras-prompt.ts entscheidet die Liste).
//
// Ampel: EINE Quelle — der Schalter aras_ampel ({ stufen, verlauf }), denselben
// liest und setzt der KI-Raum (E-409, fiaon-ki-ampel.ts). Gelesen beim Anrufbeginn
// (ctx.einstellungen.ampel; feste Werkzeuge kann niemand umschalten).
// Rot = Werkzeug abgelehnt („das klärt ein Kollege“), gelb = läuft und steht in
// „Heute“ (Protokoll ampel_gelb), grün = läuft.
//
// PROBEANRUF (Justin testet „Mich anrufen“): die Werkzeuge laufen TROCKEN — sie
// melden, was sie täten, und schreiben nur ihre Zeile in fiaon_aras_werkzeug. Keine
// Nachricht, keine Akte, kein Termin, keine Sperre. Ausnahme: die Aufnahme (es ist
// sein eigener Anruf) und das Auflegen. Echt nur mit einer ausdrücklichen
// Testperson (fiaon_persons.ist_test_am), für die Abnahme von Scheibe 2.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { arasAusweisId } from "./fiaon-aras-schema";
import { arasEreignis } from "./fiaon-aras-ereignis";
import { akteVorlesen } from "./fiaon-aras-briefing";
import { telefonSperren, nummerKern } from "./fiaon-aras-sperre";
import { einwilligungWiderrufen } from "./fiaon-telefon-einwilligung";
import { praesent } from "./fiaon-softphone-praesenz";
import { planEinreihen } from "./fiaon-aras-plan";
import { istWerkzeug, FEEDBACK_ARTEN, JUSTIN_AUFGABE_ARTEN, JUSTIN_AUFGABE_TITEL, justinAufgabeSchluessel, type JustinAufgabeArt, type Werkzeug, type Spielart, type Land, type ArasEinstellungen, type ArasErgebnis, istArasErgebnis } from "../../shared/fiaon-aras";
import type { Briefing } from "../../shared/fiaon-aras-prompt";
import type { WerkzeugErgebnis } from "./fiaon-aras-adapter";
import { berlinToday } from "./fiaon-time";

type Lauf = typeof sqlPool;

export interface WerkzeugKontext {
  callId: number; arasAnrufId: number; personId: number | null; ref: string | null; nummer: string; land: Land; spielart: Spielart;
  briefing: Briefing; einstellungen: ArasEinstellungen;
  /** Die letzte Kundenzeile aus dem Live-Transkript (Nachweis fürs Aufnahme-Ja). */
  letzteKundenZeile: () => string | null;
  /** Hat der Kunde auf die Frage nach der Aufzeichnung eindeutig Ja gesagt? (Brücke, Live-Transkript) */
  kundeSagteJa?: () => boolean;
  /** … oder klar Nein? (Anrufe 11 und 16: Unklares, „Ja, und …“ oder ein „nicht“ irgendwo sind KEIN Nein.) */
  kundeSagteNein?: () => boolean;
  /** Brücke: das Nein zur Aufnahme vermerken (dann wertet sie die Antwort nicht mehr selbst). */
  aufnahmeAbgelehnt?: () => void;
  /** Probeanruf: Werkzeuge ohne Wirkung nach außen. */
  trocken?: boolean;
  /** Brücke: Twilio-Aufnahme starten (recordings.create). */
  aufnahmeStarten: () => Promise<{ ok: boolean; grund?: string; schon?: boolean }>;
  /** Brücke: ins Softphone eines Menschen verbinden. */
  uebergabe: (agentId: number, grund: string) => Promise<{ ok: boolean; grund?: string }>;
  /** Brücke: nach dem Abschied auflegen. */
  beenden: (ergebnis: ArasErgebnis, notiz: string) => Promise<void>;
  /** Wurde das Akten-Ergebnis in diesem Gespräch schon gesetzt (Zusage, Zahlung, Termin)? */
  ergebnisGesetzt: boolean;
  /** Die Ergebnisse dieses Gesprächs (für die Nachbereitung). */
  ausgefuehrt: { werkzeug: Werkzeug; ok: boolean; eingabe: unknown; am: number }[];
}

const kurz = (t: string, n = 400) => String(t ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** Die wirksame Ampel-Stufe — aus aras_ampel (derselbe Schalter wie im KI-Raum, E-409). */
async function ampelFuer(ctx: WerkzeugKontext, name: Werkzeug): Promise<"gruen" | "gelb" | "rot"> {
  return ctx.einstellungen.ampel[name] ?? "gruen";
}
const tagDe = (iso: string) => iso.split("-").reverse().join(".");

async function akteur(): Promise<{ id: number; name: string }> {
  return { id: await arasAusweisId(), name: "Aras" };
}

/** Ein Ergebnis in die Akte (Verlauf + Zustand + Aufträge) — immer über die EINE Kette des Hauses. */
async function ergebnisInDieAkte(ctx: WerkzeugKontext, ergebnis: ArasErgebnis, notiz: string, extra: { zusageDatum?: string | null; terminZeitpunkt?: string | null } = {}): Promise<string> {
  if (!ctx.ref || !ctx.personId) return "Kein Vertrag in der Akte — nur als Notiz festgehalten.";
  if (ergebnis === "uebergeben" || ergebnis === "abgebrochen") return "";
  const { ergebnisNachbereiten } = await import("./fiaon-kontakt-ergebnis");
  const a = await akteur();
  const r = await ergebnisNachbereiten({ ref: ctx.ref, personId: ctx.personId, ergebnis, notiz: `Aras am Telefon: ${notiz}`.slice(0, 400), akteur: a, herkunft: "telefon", ...extra });
  ctx.ergebnisGesetzt = true;
  return r.meldung;
}

// ── Die Werkzeuge ──────────────────────────────────────────────────────────
const WERKZEUG: Record<Werkzeug, (ctx: WerkzeugKontext, e: any, lauf: Lauf) => Promise<WerkzeugErgebnis>> = {
  async akte_nachsehen(ctx, e) {
    const bereich = ["zahlungen", "termine", "notizen", "vertrag"].includes(e?.bereich) ? e.bereich : "zahlungen";
    return { ok: true, vorlesen: kurz(akteVorlesen(ctx.briefing, bereich)) };
  },

  async aufnahme_starten(ctx, _e, lauf) {
    const [z] = (await lauf`SELECT aufnahme_ja_am, aufnahme_nein_am, aufnahme_gestartet_am FROM fiaon_aras_anruf WHERE id = ${ctx.arasAnrufId}`) as any[];
    if (z?.aufnahme_gestartet_am) return { ok: true, vorlesen: "Die Aufzeichnung läuft schon." };
    // § 201 StGB: nur nach einem hörbaren, eindeutigen Ja. Das Live-Transkript ist der Beweis — fehlt es, keine Aufnahme.
    const ja = ctx.kundeSagteJa ? ctx.kundeSagteJa() : !z?.aufnahme_nein_am;
    // Ein früheres Nein bleibt — außer Aras hat noch einmal gefragt und der Kunde sagt JETZT klar Ja (Anruf 16: „Ja, zeichnen Sie auf“).
    if (z?.aufnahme_nein_am && !ja) return { ok: false, vorlesen: "Der Kunde hat Nein gesagt — keine Aufnahme.", fehler: "aufnahme_nein" };
    if (!ja) return { ok: false, vorlesen: "Ich habe kein eindeutiges Ja gehört — frag noch einmal kurz nach, oder mach ohne Aufzeichnung weiter.", fehler: "kein_ja" };
    if (z?.aufnahme_nein_am) {
      await lauf`UPDATE fiaon_aras_anruf SET aufnahme_nein_am = NULL, updated_at = NOW() WHERE id = ${ctx.arasAnrufId}`;
      await lauf`UPDATE fiaon_calls SET ohne_aufzeichnung_am = NULL, transkript_status = 'offen', transkript_grund = NULL, updated_at = NOW() WHERE id = ${ctx.callId} AND transkript_status = 'entfaellt'`.catch(() => null);
    }
    const jaText = kurz(ctx.letzteKundenZeile() ?? "", 120);
    const r = await ctx.aufnahmeStarten();
    // Hat ein gleichzeitiger Aufruf (Ja-Erkennung der Brücke) schon gestartet, zählt dieser hier nicht noch einmal.
    if (r.ok && r.schon) return { ok: true, vorlesen: "Die Aufzeichnung läuft schon." };
    await lauf`UPDATE fiaon_aras_anruf SET aufnahme_ja_am = COALESCE(aufnahme_ja_am, NOW()), aufnahme_ja_text = COALESCE(aufnahme_ja_text, ${jaText || null}),
                aufnahme_gestartet_am = CASE WHEN ${r.ok} THEN COALESCE(aufnahme_gestartet_am, NOW()) ELSE aufnahme_gestartet_am END, updated_at = NOW() WHERE id = ${ctx.arasAnrufId}`;
    await arasEreignis({ art: "aras_aufnahme_ja", callId: ctx.callId, arasAnrufId: ctx.arasAnrufId, personId: ctx.personId, spielart: ctx.spielart, text: r.ok ? "Aufnahme nach Ja gestartet" : `Aufnahme-Ja, Start fehlgeschlagen: ${r.grund ?? ""}`, ok: r.ok, daten: { jaText } });
    return r.ok ? { ok: true, vorlesen: "Danke, dann zeichne ich jetzt auf." } : { ok: false, vorlesen: "Die Aufzeichnung ließ sich gerade nicht starten — wir machen ohne weiter.", fehler: r.grund };
  },

  async aufnahme_abgelehnt(ctx, _e, lauf) {
    // Nur ein KLARES Nein (Anrufe 11 und 16): „Ja, und …“, ein Zögern oder eine Gegenfrage ist keins — dann bleibt alles offen,
    // Aras beantwortet die Frage und fragt noch einmal (aufgezeichnet wird ohnehin nur nach einem klaren Ja).
    if (ctx.kundeSagteNein && !ctx.kundeSagteNein()) return { ok: false, vorlesen: "", still: "Kein klares Nein gehört — beantworte seine Frage und frag dann noch einmal kurz nach der Aufzeichnung. Ohne klares Ja wird ohnehin nicht aufgezeichnet.", fehler: "kein_nein" };
    ctx.aufnahmeAbgelehnt?.();
    const [vorher] = (await lauf`SELECT aufnahme_nein_am FROM fiaon_aras_anruf WHERE id = ${ctx.arasAnrufId}`) as any[];
    if (vorher?.aufnahme_nein_am) return { ok: true, vorlesen: "Ist vermerkt — ohne Aufzeichnung." };
    const { WIDERSPRUCH_GRUND } = await import("./fiaon-transkript");
    await lauf`UPDATE fiaon_aras_anruf SET aufnahme_nein_am = COALESCE(aufnahme_nein_am, NOW()), updated_at = NOW() WHERE id = ${ctx.arasAnrufId}`;
    await lauf`UPDATE fiaon_calls SET ohne_aufzeichnung_am = COALESCE(ohne_aufzeichnung_am, NOW()), transkript_status = 'entfaellt', transkript_grund = ${WIDERSPRUCH_GRUND}, updated_at = NOW() WHERE id = ${ctx.callId}`;
    await arasEreignis({ art: "aras_aufnahme_nein", callId: ctx.callId, arasAnrufId: ctx.arasAnrufId, personId: ctx.personId, spielart: ctx.spielart, text: "Kunde lehnt Aufzeichnung ab — ohne Band weiter" });
    return { ok: true, vorlesen: "Alles klar, dann ohne Aufzeichnung — kein Problem." };
  },

  async zahlungslink_senden(ctx, e, lauf) {
    const weg = e?.weg === "mail" ? "mail" : "whatsapp";
    const zweck: "antrag" | "zahlung" | "rate" = ["antrag", "zahlung", "rate"].includes(e?.zweck) ? e.zweck : (ctx.briefing.offeneRate ? "rate" : ctx.briefing.stufe === "zahlung_offen" ? "zahlung" : "antrag");
    if (!ctx.personId) return { ok: false, vorlesen: "Dafür brauche ich erst Ihre Daten — ich notiere es.", fehler: "ohne_person" };
    if (ctx.briefing.global) return { ok: false, vorlesen: "Das klärt jemand aus dem Team mit Ihnen.", fehler: "global" };
    if (zweck === "antrag" && ctx.briefing.isBlocked) return { ok: false, vorlesen: "Den Antrag-Link kann ich gerade nicht schicken — ich notiere Ihren Wunsch.", fehler: "is_blocked" };
    const b = ctx.briefing;
    const a = await akteur();
    const name = b.nachname ? `${b.anrede ?? ""} ${b.nachname}`.trim() : "";
    try {
      if (weg === "whatsapp") {
        const { waSenden, fensterOffen } = await import("./fiaon-whatsapp");
        const { nummerFuerWhatsApp } = await import("../../shared/fiaon-whatsapp-erlaubnis");
        const nummer = nummerFuerWhatsApp(ctx.nummer, ctx.land) ?? ctx.nummer;
        const offen = await fensterOffen(nummer, lauf);
        let r;
        if (zweck === "rate" && b.offeneRate) {
          r = await waSenden(nummer, { vorlage: "fiaon_kk_rate", werte: [name || "Guten Tag", b.offeneRate.betrag.replace(" €", ""), b.offeneRate.faelligAm, b.offeneRate.verwendungszweck], knopfWert: b.offeneRate.verwendungszweck }, { personId: ctx.personId, von: "aras", absender: "Aras" }, lauf);
        } else if (zweck === "zahlung" && b.zahlungsseite) {
          const referenz = b.zahlungsseite.split("/").pop() ?? "";
          r = await waSenden(nummer, { vorlage: "fiaon_kk_rechnung", werte: [name || "Guten Tag", b.paketKey ? (await import("../../shared/fiaon-mara-ton")).paketPreisText(b.paketKey).replace(" €", "") : "", referenz], knopfWert: referenz }, { personId: ctx.personId, von: "aras", absender: "Aras" }, lauf);
        } else {
          // Antrag-Link: nur im offenen 24-h-Fenster als Text (keine freigegebene Vorlage für ARAS) — sonst Mail.
          if (!offen) return await WERKZEUG.zahlungslink_senden(ctx, { weg: "mail", zweck }, lauf);
          const { kurzlinkFuerLead, kurzlinkUrl } = await import("./fiaon-kurzlink");
          const [l] = (await lauf`SELECT id FROM fiaon_leads WHERE person_id = ${ctx.personId} ORDER BY erstellt_am DESC LIMIT 1`) as any[];
          const link = l ? kurzlinkUrl(await kurzlinkFuerLead(Number(l.id), lauf), "w") : null;
          if (!link) return await WERKZEUG.zahlungslink_senden(ctx, { weg: "mail", zweck }, lauf);
          r = await waSenden(nummer, { text: `Hier ist Aras von FIAON — wie eben besprochen Ihr persönlicher Link: ${link}` }, { personId: ctx.personId, von: "aras", absender: "Aras" }, lauf);
        }
        if (!r.ok) {
          if (!offen || r.gebremst) return await WERKZEUG.zahlungslink_senden(ctx, { weg: "mail", zweck }, lauf);
          return { ok: false, vorlesen: "WhatsApp ging gerade nicht raus — ich schicke es Ihnen per E-Mail.", fehler: r.grund };
        }
        await arasEreignis({ art: "aras_link", callId: ctx.callId, arasAnrufId: ctx.arasAnrufId, personId: ctx.personId, spielart: ctx.spielart, text: `Link per WhatsApp (${zweck})`, daten: { weg, zweck } });
        return { ok: true, vorlesen: "Der Link ist raus — per WhatsApp, Sie sollten ihn gleich sehen." };
      }
      const { mailSenden } = await import("./fiaon-mail-senden");
      const event = zweck === "rate" ? "abo_payment_reminder" : zweck === "zahlung" ? "payment_reminder" : "antrag_erinnerung";
      const r = await mailSenden({ event, personId: ctx.personId, akteur: { name: "Aras", agentId: a.id, rolle: "admin" }, lauf });
      if (!r.ok) return { ok: false, vorlesen: "Die E-Mail ging gerade nicht raus — ich notiere es, jemand aus dem Team schickt sie.", fehler: r.grund ?? r.meldung };
      await arasEreignis({ art: "aras_link", callId: ctx.callId, arasAnrufId: ctx.arasAnrufId, personId: ctx.personId, spielart: ctx.spielart, text: `Link per Mail (${event})`, daten: { weg, zweck, event } });
      return { ok: true, vorlesen: "Die E-Mail mit Ihrem Link ist raus." };
    } catch (err) {
      return { ok: false, vorlesen: "Das Schicken hat gerade nicht geklappt — ich notiere es.", fehler: String((err as Error)?.message ?? err).slice(0, 200) };
    }
  },

  async zahlungszusage_merken(ctx, e) {
    const datum = /^\d{4}-\d{2}-\d{2}$/.test(String(e?.datum ?? "")) ? String(e.datum) : null;
    if (!datum) return { ok: false, vorlesen: "Welcher Tag genau — nennen Sie mir bitte das Datum.", fehler: "datum" };
    if (datum < berlinToday()) return { ok: false, vorlesen: "Der Tag liegt in der Vergangenheit — welcher Tag passt Ihnen?", fehler: "vergangenheit" };
    const meldung = await ergebnisInDieAkte(ctx, "erreicht_zahlt_am", `Zusage für den ${tagDe(datum)}`, { zusageDatum: datum });
    if (ctx.personId) {
      const tagDanach = new Date(`${datum}T09:00:00+02:00`); tagDanach.setDate(tagDanach.getDate() + 1);
      await planEinreihen({ personId: ctx.personId, ref: ctx.ref, nummer: ctx.nummer, spielart: "zusage", grund: `Zusage vom ${tagDe(datum)} nachfassen`, erzeugtVon: "takt", fruehAb: tagDanach, spaetBis: new Date(tagDanach.getTime() + 10 * 3600_000), anlassAm: new Date() }).catch(() => null);
    }
    await arasEreignis({ art: "aras_zusage", callId: ctx.callId, arasAnrufId: ctx.arasAnrufId, personId: ctx.personId, spielart: ctx.spielart, text: `Zahlungszusage ${tagDe(datum)}`, daten: { datum, meldung } });
    return { ok: true, vorlesen: `Notiert: Sie überweisen am ${tagDe(datum)}. Am Tag danach melde ich mich kurz, falls nichts angekommen ist.` };
  },

  async zahlung_gemeldet(ctx, e, lauf) {
    const am = /^\d{4}-\d{2}-\d{2}$/.test(String(e?.am ?? "")) ? String(e.am) : berlinToday();
    const betrag = Number.isFinite(Number(e?.betrag_cents)) && Number(e.betrag_cents) > 0 ? Number(e.betrag_cents) : null;
    await ergebnisInDieAkte(ctx, "erreicht_zahlt_gleich", `Zahlung gemeldet${betrag ? ` (${(betrag / 100).toFixed(2).replace(".", ",")} €)` : ""}, ${tagDe(am)}`);
    if (ctx.ref) {
      // Stufe A wie bei Maras Zahlungsmeldung: die Bestellung trägt claimed_paid_at — der Abgleich sucht im Bankbuch.
      await lauf`UPDATE fiaon_applications SET claimed_paid_at = COALESCE(claimed_paid_at, NOW()),
                   payment_status = CASE WHEN COALESCE(payment_status, '') IN ('pending_payment', 'pending', 'unpaid', '', 'expired') THEN 'claimed_paid' ELSE payment_status END
                 WHERE ref = ${ctx.ref}`.catch(() => null);
    }
    await arasEreignis({ art: "aras_werkzeug", callId: ctx.callId, arasAnrufId: ctx.arasAnrufId, personId: ctx.personId, spielart: ctx.spielart, text: "Zahlung gemeldet — Suche im Bankbuch folgt", daten: { werkzeug: "zahlung_gemeldet", am, betrag } });
    return { ok: true, vorlesen: "Danke — ich habe die Überweisung vermerkt. Sobald sie bei uns gebucht ist, geht es automatisch weiter." };
  },

  async ratenpause_setzen(ctx, e) {
    const grund = kurz(String(e?.grund ?? ""), 200);
    if (!ctx.ref) return { ok: false, vorlesen: "Dafür fehlt mir der Vertrag — das klärt jemand aus dem Team.", fehler: "ohne_ref" };
    if (ctx.einstellungen.ampel.ratenpause_setzen === "rot") return { ok: false, vorlesen: "Das klärt ein Kollege, ich notiere es.", fehler: "ampel_rot" };
    const { ratenpauseAnwenden } = await import("./fiaon-ratenpause");
    const a = await akteur();
    const r = await ratenpauseAnwenden({ ref: ctx.ref, grund: `Aras am Telefon: ${grund}`, agentId: a.id, agentName: "Aras" });
    if (!r.ok) return { ok: false, vorlesen: "Eine Pause geht gerade nicht automatisch — die Leitung schaut sich das an.", fehler: r.fehler };
    await arasEreignis({ art: "aras_werkzeug", callId: ctx.callId, arasAnrufId: ctx.arasAnrufId, personId: ctx.personId, spielart: ctx.spielart, text: `Ratenpause ${r.monate} Monat(e) — 24 h rückgängig`, daten: { werkzeug: "ratenpause_setzen", monate: r.monate, grund } });
    return { ok: true, vorlesen: `Ich habe Ihre Raten um ${r.monate} Monat${r.monate === 1 ? "" : "e"} nach hinten geschoben. Die Leitung bestätigt das noch — Sie bekommen Bescheid.` };
  },

  async rueckruf_buchen(ctx, e, lauf) {
    if (!ctx.personId) return { ok: false, vorlesen: "Dafür brauche ich erst Ihre Daten.", fehler: "ohne_person" };
    const zeitpunkt = new Date(String(e?.zeitpunkt ?? ""));
    if (!Number.isFinite(zeitpunkt.getTime())) return { ok: false, vorlesen: "Welche Uhrzeit genau?", fehler: "zeitpunkt" };
    const beiAras = e?.bei === "aras";
    const { terminBuchen, freieSlots, TerminFehler } = await import("./fiaon-termine");
    const ausweis = await arasAusweisId(lauf);
    let agentId: number | null = beiAras ? ausweis : null;
    if (!agentId) {
      const [p] = (await lauf`SELECT p.assigned_agent_id FROM fiaon_persons p JOIN fiaon_agents a ON a.id = p.assigned_agent_id AND a.active AND a.zugang_gesperrt_am IS NULL AND COALESCE(a.art, 'mensch') = 'mensch' WHERE p.id = ${ctx.personId}`) as any[];
      agentId = p?.assigned_agent_id ? Number(p.assigned_agent_id) : null;
    }
    if (!agentId) agentId = ausweis;
    try {
      // Bei Aras: ein eigener Anruf des (KI-)Mitarbeiters (agent_manuell: keine Ableitung, kein Rollenfilter, kein Vorlauf).
      // Beim Betreuer: abgeleitete Art, `vereinbart` = der Kunde hat die Zeit eben am Telefon genannt (E-395, kein 2-h-Vorlauf).
      const b = await terminBuchen({ personId: ctx.personId, agentId, beginn: zeitpunkt, quelle: agentId === ausweis ? "agent_manuell" : "auto", herkunft: "aras_telefon", vereinbart: true }, lauf);
      await arasEreignis({ art: "aras_termin", callId: ctx.callId, arasAnrufId: ctx.arasAnrufId, personId: ctx.personId, spielart: ctx.spielart, text: `Anruf eingetragen ${b.datumText} ${b.uhrzeit} (${agentId === ausweis ? "Aras" : "Betreuer"})`, daten: { terminId: b.id, bei: agentId === ausweis ? "aras" : "betreuer" } });
      if (!ctx.ergebnisGesetzt) await ergebnisInDieAkte(ctx, "rueckruf_termin", `Anruf ${b.datumText} ${b.uhrzeit}`, { terminZeitpunkt: b.beginn.slice(0, 19) });
      return { ok: true, vorlesen: `Eingetragen: ${b.datumText} um ${b.uhrzeit} Uhr${agentId === ausweis ? " — ich rufe Sie dann an" : ` — ${ctx.briefing.betreuer?.nom ?? "jemand aus dem Team"} ruft Sie dann an`}.`, daten: { terminId: b.id } };
    } catch (err) {
      const f = err instanceof TerminFehler ? err.message : String((err as Error)?.message ?? err);
      let alternativen = "";
      try {
        const s = await freieSlots(ctx.personId, lauf, "auto");
        alternativen = s.slots.slice(0, 2).map((x) => `${x.datum.split("-").reverse().join(".")} um ${x.uhrzeit} Uhr`).join(" oder ");
      } catch { /* ohne Vorschlag */ }
      return { ok: false, vorlesen: `Die Zeit geht leider nicht${alternativen ? ` — möglich wäre ${alternativen}` : ""}.`.replace("leider ", ""), fehler: f.slice(0, 200) };
    }
  },

  async notiz_schreiben(ctx, e, lauf) {
    const text = kurz(String(e?.text ?? ""), 400);
    if (text.length < 3) return { ok: false, vorlesen: "", fehler: "leer" };
    const a = await akteur();
    if (ctx.ref && ctx.personId) {
      const { ergebnisNachbereiten } = await import("./fiaon-kontakt-ergebnis");
      await ergebnisNachbereiten({ ref: ctx.ref, personId: ctx.personId, ergebnis: null, notiz: `Aras am Telefon: ${text}`, akteur: a, herkunft: "telefon" });
    } else {
      // Ohne Vertrag gibt es keine Akte-Zeile mit Kennung — die Notiz steht im Telefon-Protokoll (Kanal telefon) an der Person.
      await arasEreignis({ art: "aras_werkzeug", callId: ctx.callId, arasAnrufId: ctx.arasAnrufId, personId: ctx.personId, spielart: ctx.spielart, text: `Notiz: ${text}`, daten: { werkzeug: "notiz_schreiben" } });
    }
    return { ok: true, vorlesen: "", still: "Notiz geschrieben." };
  },

  // Go-live C (Koordination 20.10.2026): „Ich hab keine Karte bekommen“ → GENAU EINE Aufgabe für Justin je Kunde und Sache —
  // auf seinem Board (bleibt bei ihm, nicht beim Betreuer), mit Link zur Akte. Ein zweiter Anruf zur selben Sache hängt nur still an.
  async aufgabe_fuer_justin(ctx, e, lauf) {
    if (!ctx.personId) return { ok: false, vorlesen: "", fehler: "ohne_person" };
    const art: JustinAufgabeArt = (JUSTIN_AUFGABE_ARTEN as readonly string[]).includes(e?.art) ? e.art : "sonstiges";
    const text = kurz(String(e?.text ?? ""), 400);
    if (text.length < 5) return { ok: false, vorlesen: "", fehler: "leer" };
    const wer = ctx.briefing.nachname ? `${ctx.briefing.anrede ?? ""} ${ctx.briefing.nachname}`.trim() : "Kunde";
    // Die Akte hängt am Antrag: ohne Kennung im Plan die aktuelle Bestellung des Kunden (wie im Briefing).
    const ref = ctx.ref ?? ((await lauf`SELECT ref FROM fiaon_applications WHERE person_id = ${ctx.personId} AND merged_into IS NULL AND gdpr_deleted_at IS NULL
                                       ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1`.catch(() => [])) as any[])[0]?.ref ?? null;
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    const r = await auftragFuerKunden({
      personId: ctx.personId, ref, titel: `${JUSTIN_AUFGABE_TITEL[art]} — ${wer}`.slice(0, 160),
      text: `ARAS am Telefon (${berlinToday().split("-").reverse().join(".")}): ${text}`, schluessel: justinAufgabeSchluessel(ctx.personId, art),
      anBetreiber: true, anlass: "zustand", still: true, quelle: "aras", autorName: "ARAS", anlageText: "Angelegt von ARAS aus einem Kundenanruf",
    });
    await arasEreignis({ art: "aras_werkzeug", callId: ctx.callId, arasAnrufId: ctx.arasAnrufId, personId: ctx.personId, spielart: ctx.spielart, text: `Aufgabe für Justin: ${JUSTIN_AUFGABE_TITEL[art]}`, daten: { werkzeug: "aufgabe_fuer_justin", art, todoId: r.id } });
    return { ok: true, vorlesen: "", still: "Aufgabe für Justin angelegt.", daten: { todoId: r.id } };
  },

  async nicht_mehr_anrufen(ctx, _e, lauf) {
    await telefonSperren({ nummerKern: nummerKern(ctx.nummer), personId: ctx.personId, quelle: "aras", grund: "Kunde am Telefon: nicht mehr anrufen", callId: ctx.callId }, lauf);
    await einwilligungWiderrufen({ nummerKern: nummerKern(ctx.nummer), personId: ctx.personId, quelle: "aras_telefon" }, lauf).catch(() => 0);
    await arasEreignis({ art: "aras_sperre", callId: ctx.callId, arasAnrufId: ctx.arasAnrufId, personId: ctx.personId, spielart: ctx.spielart, text: "Telefonsperre gesetzt (Kundenwunsch)", nummer: ctx.nummer });
    return { ok: true, vorlesen: "Verstanden — Sie bekommen von uns keine Anrufe mehr. Alles Weitere nur noch schriftlich." };
  },

  async mensch_verbinden(ctx, e, lauf) {
    const grund = String(e?.grund ?? "wunsch");
    const u = ctx.einstellungen.uebergabe;
    const kandidaten: number[] = [];
    if (ctx.spielart === "rate" || ctx.spielart === "zusage" || grund === "erlass") kandidaten.push(...(u.rate ?? []));
    if (ctx.spielart === "zuruf" || ctx.spielart === "stufe_b" || ctx.spielart === "lead") kandidaten.push(...(u.verkauf ?? []));
    if (ctx.personId) {
      const [p] = (await lauf`SELECT assigned_agent_id FROM fiaon_persons WHERE id = ${ctx.personId}`) as any[];
      if (p?.assigned_agent_id) kandidaten.push(Number(p.assigned_agent_id));
    }
    const { arbeitszeitAm } = await import("./fiaon-mara-termin");
    for (const id of Array.from(new Set(kandidaten.map(Number).filter(Boolean)))) {
      const [a] = (await lauf`SELECT id FROM fiaon_agents WHERE id = ${id} AND active AND zugang_gesperrt_am IS NULL AND COALESCE(art, 'mensch') = 'mensch'`) as any[];
      if (!a) continue;
      const zeit = await arbeitszeitAm(id, berlinToday(), lauf);
      if (!zeit) continue;
      if (!(await praesent(id, 120, lauf))) continue;
      const r = await ctx.uebergabe(id, grund);
      if (r.ok) {
        await arasEreignis({ art: "aras_uebergabe", callId: ctx.callId, arasAnrufId: ctx.arasAnrufId, personId: ctx.personId, spielart: ctx.spielart, text: `Übergabe an Mitarbeiter ${id} (${grund})`, daten: { agentId: id, grund } });
        return { ok: true, vorlesen: "Einen Moment, ich verbinde Sie." };
      }
    }
    // Kein Mensch erreichbar → Anruf beim Betreuer eintragen (nächster freier Platz), ehrlich sagen
    let satz = "Gerade ist niemand aus dem Team frei.";
    if (ctx.personId) {
      try {
        const { freieSlots, terminBuchen } = await import("./fiaon-termine");
        const s = await freieSlots(ctx.personId, lauf, "auto");
        const slot = s.slots[0];
        if (slot && s.betreuer) {
          const b = await terminBuchen({ personId: ctx.personId, agentId: s.betreuer.id, beginn: slot.beginn, quelle: "auto", herkunft: "aras_telefon", vereinbart: true }, lauf);
          satz += ` ${s.betreuer.nom ?? "Jemand aus dem Team"} ruft Sie ${b.datumText} um ${b.uhrzeit} Uhr zurück.`;
          if (!ctx.ergebnisGesetzt) await ergebnisInDieAkte(ctx, "rueckruf_termin", `Übergabe-Wunsch (${grund}), Anruf ${b.datumText} ${b.uhrzeit}`, { terminZeitpunkt: b.beginn.slice(0, 19) });
        } else {
          satz += " Jemand aus dem Team meldet sich bei Ihnen.";
          await WERKZEUG.notiz_schreiben(ctx, { text: `Kunde möchte einen Menschen sprechen (${grund}) — niemand erreichbar, kein freier Termin gefunden.` }, lauf);
        }
      } catch {
        satz += " Jemand aus dem Team meldet sich bei Ihnen.";
      }
    }
    await arasEreignis({ art: "aras_uebergabe", callId: ctx.callId, arasAnrufId: ctx.arasAnrufId, personId: ctx.personId, spielart: ctx.spielart, text: `Übergabe-Wunsch ohne Ziel (${grund})`, ok: false, daten: { grund } });
    return { ok: false, vorlesen: satz, fehler: "kein_ziel" };
  },

  /** Nur im Probeanruf: Justins Feedback („sprich FIAON richtig aus“) für „Dein Feedback aus Probeanrufen“ (übernehmen → Hausanweisung). */
  async probe_feedback_merken(ctx, e, lauf) {
    if (ctx.spielart !== "probe" && !ctx.briefing.probe) return { ok: false, vorlesen: "", fehler: "nur_probe" };
    const text = kurz(String(e?.text ?? ""), 400);
    if (text.length < 3) return { ok: false, vorlesen: "", fehler: "leer" };
    const regel = kurz(String(e?.regel ?? ""), 240) || null;
    const art = (FEEDBACK_ARTEN as readonly string[]).includes(String(e?.art)) ? String(e.art) : "sonstiges";
    // Dasselbe Feedback im selben Anruf nur einmal (das Hintergrund-Modell ruft gelegentlich doppelt).
    const [schon] = (await lauf`SELECT id FROM fiaon_aras_feedback WHERE aras_anruf_id = ${ctx.arasAnrufId} AND lower(text) = lower(${text})`) as any[];
    if (!schon) await lauf`INSERT INTO fiaon_aras_feedback (aras_anruf_id, call_id, text, regel, art, quelle) VALUES (${ctx.arasAnrufId}, ${ctx.callId}, ${text}, ${regel}, ${art}, 'telefon')`;
    return { ok: true, vorlesen: "", still: "Feedback festgehalten — setz es sofort um und mach ganz normal weiter (keine Weiterleitung)." };
  },

  async anruf_beenden(ctx, e) {
    const ergebnis: ArasErgebnis = istArasErgebnis(e?.ergebnis) ? e.ergebnis : "erreicht_sonstiges";
    const notiz = kurz(String(e?.notiz ?? ""), 400);
    if (!ctx.ergebnisGesetzt && ergebnis !== "uebergeben" && ergebnis !== "abgebrochen") await ergebnisInDieAkte(ctx, ergebnis, notiz || "Gespräch beendet.");
    await ctx.beenden(ergebnis, notiz);
    return { ok: true, vorlesen: "", still: "Gespräch beendet." };
  },
};

/** Die eine Tür: Werkzeug ausführen, Zeile in fiaon_aras_werkzeug, Protokoll, Ergebnis für die Stimme. */
/** Probe: was das Werkzeug täte — ohne Wirkung nach außen. */
function trockenErgebnis(name: Werkzeug, e: any): WerkzeugErgebnis {
  const tag = (d: unknown) => (/^\d{4}-\d{2}-\d{2}/.test(String(d ?? "")) ? tagDe(String(d).slice(0, 10)) : "dem genannten Tag");
  switch (name) {
    case "zahlungslink_senden": return { ok: true, vorlesen: `Der Link ist raus — per ${e?.weg === "mail" ? "E-Mail" : "WhatsApp"}.`, still: "Probe: nichts wirklich verschickt." };
    case "zahlungszusage_merken": return { ok: true, vorlesen: `Notiert: Sie überweisen am ${tag(e?.datum)}. Am Tag danach melde ich mich kurz, falls nichts angekommen ist.`, still: "Probe: nichts eingetragen." };
    case "zahlung_gemeldet": return { ok: true, vorlesen: "Danke — die Überweisung ist vermerkt. Sobald sie gebucht ist, geht es automatisch weiter.", still: "Probe: nichts vermerkt." };
    case "ratenpause_setzen": return { ok: true, vorlesen: "Ich habe Ihre Raten um einen Monat nach hinten geschoben. Die Leitung bestätigt das noch.", still: "Probe: keine Rate verschoben." };
    case "rueckruf_buchen": return { ok: true, vorlesen: `Eingetragen — ${e?.bei === "aras" ? "ich rufe Sie dann an" : "jemand aus dem Team ruft Sie dann an"}.`, still: "Probe: kein Termin gebucht." };
    case "notiz_schreiben": return { ok: true, vorlesen: "", still: "Probe: Notiz nicht gespeichert." };
    case "aufgabe_fuer_justin": return { ok: true, vorlesen: "", still: "Probe: keine Aufgabe für Justin angelegt." };
    case "nicht_mehr_anrufen": return { ok: true, vorlesen: "Verstanden — Sie bekommen von uns keine Anrufe mehr. Alles Weitere nur noch schriftlich.", still: "Probe: keine Sperre gesetzt." };
    case "mensch_verbinden": return { ok: false, vorlesen: "Gerade ist niemand aus dem Team frei — jemand ruft Sie zurück.", still: "Probe: niemand wurde verbunden.", fehler: "probe" };
    case "akte_nachsehen": return { ok: true, vorlesen: "" };
    default: return { ok: true, vorlesen: "" };
  }
}

export async function werkzeugAusfuehren(ctx: WerkzeugKontext, name: Werkzeug, eingabe: unknown, aufrufId: string, lauf: Lauf = sqlPool): Promise<WerkzeugErgebnis> {
  const t0 = Date.now();
  let erg: WerkzeugErgebnis;
  const stufe = istWerkzeug(name) ? await ampelFuer(ctx, name) : "gruen";
  if (!istWerkzeug(name)) erg = { ok: false, vorlesen: "", fehler: `Unbekanntes Werkzeug „${String(name).slice(0, 40)}“.` };
  else if (stufe === "rot") erg = { ok: false, vorlesen: "Das klärt ein Kollege — ich notiere es.", fehler: "ampel_rot" };
  else if (ctx.trocken && !["akte_nachsehen", "aufnahme_starten", "aufnahme_abgelehnt", "anruf_beenden", "probe_feedback_merken"].includes(name)) erg = trockenErgebnis(name, eingabe);
  else {
    try { erg = await WERKZEUG[name](ctx, eingabe ?? {}, lauf); }
    catch (err) { erg = { ok: false, vorlesen: "Das hat gerade nicht geklappt — ich notiere es.", fehler: String((err as Error)?.message ?? err).slice(0, 300) }; }
  }
  if (stufe === "gelb" && erg.ok && !ctx.trocken) {
    // Gelb: läuft, steht aber in „Heute“ (Protokoll-Art ampel_gelb — dieselbe Liste wie bei Mara).
    try {
      const { protokollieren } = await import("./fiaon-mara-termin");
      // „ampel_gelb“ ist die Protokoll-Art des KI-Raums (E-409) — auf main noch nicht im Typ, darum über string.
      await protokollieren({ art: "ampel_gelb" as string as Parameters<typeof protokollieren>[0]["art"], kanal: "telefon", personId: ctx.personId, nummer: ctx.nummer, text: `Aras: Werkzeug „${name}“ ausgeführt — Ampel gelb (steht in „Heute“).`, daten: { werkzeug: name, stufe, callId: ctx.callId }, ok: true });
    } catch { /* Komfort */ }
  }
  erg.vorlesen = kurz(erg.vorlesen ?? "", 400);
  ctx.ausgefuehrt.push({ werkzeug: name, ok: erg.ok, eingabe, am: Date.now() });
  await lauf`INSERT INTO fiaon_aras_werkzeug (aras_anruf_id, werkzeug, aufruf_id, eingabe, ergebnis, ok, dauer_ms)
             VALUES (${ctx.arasAnrufId}, ${String(name)}, ${aufrufId}, ${lauf.json((eingabe ?? {}) as any)}, ${lauf.json({ ok: erg.ok, vorlesen: erg.vorlesen, still: erg.still ?? null, fehler: erg.fehler ?? null, daten: erg.daten ?? null, trocken: ctx.trocken === true } as any)}, ${erg.ok}, ${Date.now() - t0})`.catch((e) => console.error("[ARAS-WERKZEUG] Zeile:", String(e).slice(0, 200)));
  if (name !== "anruf_beenden" && name !== "notiz_schreiben") {
    await arasEreignis({ art: "aras_werkzeug", callId: ctx.callId, arasAnrufId: ctx.arasAnrufId, personId: ctx.personId, spielart: ctx.spielart, text: `${name}${erg.ok ? "" : ` fehlgeschlagen: ${erg.fehler ?? ""}`}`, ok: erg.ok, daten: { werkzeug: name, ok: erg.ok, dauerMs: Date.now() - t0 } });
  }
  return erg;
}
