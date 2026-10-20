// ═══════════════════════════════════════════════════════════════════════════
// ARAS-COCKPIT — die Wörter (20.10.2026, Justin: „vieles geht nicht … UI VIEL übersichtlicher, cleaner“)
//
// Jedes Systemwort, das der Server schickt (entfaellt, kunde_aufgelegt, aufnahme_abgelehnt …), wird HIER in einen
// deutschen Satz übersetzt — die Oberfläche zeigt nie ein rohes Wort, keine Millisekunden, keine Werkzeugnamen.
// Rein (kein React), damit scripts/pruef-aras-cockpit.ts jede Übersetzung prüfen kann.
// ═══════════════════════════════════════════════════════════════════════════
import { SPIELART_TEXT as KERN_SPIELART_TEXT, PROBE_TON_SCHLUESSEL } from "@shared/fiaon-aras";

/**
 * Was der Reiter „Probe“ selbst einstellt (Ton, Dialekt, Hintergrund, Zuhören, Stimme, Probe-Nummer, Tagesdeckel) —
 * im Reiter „Einstellungen“ nicht noch einmal (vorher standen Dialekt, Hintergrund und Zuhören doppelt da).
 */
export const PROBE_SCHLUESSEL: readonly string[] = [...PROBE_TON_SCHLUESSEL, "aras_stimme", "aras_probe_nummer", "aras_tag_euro"];
/** Was die Statusleiste oben schaltet (Leerlauf) — ebenfalls nicht doppelt in „Einstellungen“. */
export const COCKPIT_SCHLUESSEL: readonly string[] = ["aras_leerlauf", "aras_notaus"];

/** Ein Systemwort lesbar machen, wenn es (noch) keine Übersetzung hat: „neue_regel“ → „neue Regel“. */
export const lesbar = (w: string | null | undefined): string => String(w ?? "").replace(/_/g, " ").replace(/\s+/g, " ").trim();

/** Gesprächsart in Worten („rate“ → „Rate offen“). Eine Quelle: der Kern (shared/fiaon-aras.ts). */
export function spielartText(s: string | null | undefined): string {
  if (!s) return "";
  return (KERN_SPIELART_TEXT as Record<string, string>)[s] ?? lesbar(s);
}

/** Was beim Kunden herauskam (fiaon_aras_anruf.ergebnis). */
export const ERGEBNIS_TEXT: Record<string, string> = {
  erreicht_zahlt_am: "Zusage", erreicht_zahlt_gleich: "zahlt sofort", erreicht_abgelehnt: "abgelehnt", erreicht_sonstiges: "erreicht",
  nicht_erreicht: "nicht erreicht", mailbox: "Mailbox", rueckruf_termin: "Rückruf vereinbart", rueckruf: "Rückruf gewünscht",
  nummer_falsch: "falsche Nummer", nummer_blockiert: "Nummer gesperrt", uebergeben: "ans Team übergeben", abgebrochen: "abgebrochen",
  kein_interesse: "kein Interesse",
};
export const ergebnisText = (e: string | null | undefined): string => (e ? ERGEBNIS_TEXT[e] ?? lesbar(e) : "");

/** Wie das Gespräch endete (fiaon_aras_anruf.ende_grund) — beim Probeanruf bist DU der Kunde. */
export function endeText(grund: string | null | undefined, probe = false): string {
  const g = String(grund ?? "");
  if (!g) return "";
  const T: Record<string, string> = {
    kunde_aufgelegt: probe ? "beendet von dir" : "Kunde hat aufgelegt", aras_beendet: "ARAS hat aufgelegt", chef: "hier beendet", "Chefbüro": "hier beendet",
    mailbox: "Mailbox", stille: "Stille — aufgelegt", notaus: "Not-Aus", fehler: "Technik-Fehler", zeitlimit: "Zeitlimit erreicht",
    uebergabe: "ans Team übergeben", uebergabe_gescheitert_neu: "Übergabe klappte nicht", deploy: "Neustart der Plattform", kein_stream: "kein Ton",
    nicht_erreicht: probe ? "nicht abgenommen" : "nicht erreicht", haengend: "abgebrochen", besetzt: "besetzt", abgebrochen: "abgebrochen",
  };
  return T[g] ?? lesbar(g);
}

/** Prüf-Mara in Worten (Status der Liste bzw. Urteil im Detail) + Ampel-Klasse für den Punkt. */
export const PRUEF_TEXT: Record<string, { text: string; klasse: "" | "gut" | "warn" | "krit" }> = {
  ok: { text: "in Ordnung", klasse: "gut" },
  auffaellig: { text: "auffällig", klasse: "warn" },
  fehler: { text: "Fehler gefunden", klasse: "krit" },
  offen: { text: "wird noch geprüft", klasse: "" },
  entfaellt: { text: "nichts zu prüfen", klasse: "" },
};
export const pruefText = (s: string | null | undefined) => PRUEF_TEXT[String(s ?? "")] ?? { text: lesbar(s) || "—", klasse: "" as const };

/** Die Regeln der Live-Prüfung (Schlüssel aus fiaon_aras_anruf.pruefung bzw. fiaon_ki_pruefung.punkte) in einem Satz. */
export const REGEL_TEXT: Record<string, string> = {
  ki_hinweis_fehlt: "Den KI-Hinweis hat ARAS nicht gesagt.", ki_hinweis_spaet: "Der KI-Hinweis kam zu spät.", ki_hinweis_unbelegt: "Der KI-Hinweis ist nicht belegt.",
  aufnahme_vor_ja: "Aufnahme lief vor dem Ja.", aufnahme_trotz_nein: "Aufnahme trotz Nein.", sperrwunsch_ohne_sperre: "Kunde wollte keine Anrufe mehr — Sperre fehlte.",
  anliegen_vor_identitaet: "Anliegen genannt, bevor klar war, wer dran ist.", vertrag_zusage: "Vertrag am Telefon zugesagt.", druck: "Druck gemacht.",
  drohung: "Gedroht (Gericht, Inkasso, SCHUFA …).", lastschrift: "Lastschrift angeboten.", kopplung: "Kündigung an Zahlung gekoppelt.",
  amd_widerspruch: "Als Mailbox erkannt, obwohl jemand sprach.", betrag_null: "„Null Euro“ gesagt.", url_vorgelesen: "Eine Internetadresse vorgelesen.",
  antrag_durch: "Antrag als „genehmigt“ dargestellt.", karte_versprochen: "Eine Karte versprochen.", wiederholung: "Einen Satz wortgleich wiederholt.",
  fuellwort_allein: "Nur ein Füllwort als Antwort.", fuellwort_satzanfang: "Zu viele Sätze mit „Also/Ähm“.", abschied_fehlt: "Aufgelegt ohne Abschied.",
};
export function regelText(regel: string, hinweis?: string | null): string {
  const r = String(regel ?? "").replace(/^modell_/, "");
  if (hinweis && hinweis.trim()) return hinweis.replace(/^Live-Prüfung ohne Aufnahme:\s*/, "").trim();
  return REGEL_TEXT[r] ?? (lesbar(r) ? `${lesbar(r)}.` : "");
}

/** Was Aras im Gespräch getan hat (fiaon_aras_werkzeug.werkzeug) — ohne Namen und Millisekunden. */
export const WERKZEUG_TEXT: Record<string, string> = {
  akte_nachsehen: "Akte angesehen", aufnahme_starten: "Aufnahme gestartet", aufnahme_abgelehnt: "Aufnahme abgelehnt", zahlungslink_senden: "Zahlungslink geschickt",
  zahlungszusage_merken: "Zusage notiert", zahlung_gemeldet: "Zahlung gemeldet", ratenpause_setzen: "Ratenpause gesetzt", rueckruf_buchen: "Rückruf eingetragen",
  notiz_schreiben: "Notiz geschrieben", nicht_mehr_anrufen: "Anrufe gesperrt (Kundenwunsch)", mensch_verbinden: "an einen Menschen übergeben", anruf_beenden: "Gespräch beendet",
};
export const werkzeugText = (w: string | null | undefined): string => (w ? WERKZEUG_TEXT[w] ?? lesbar(w) : "");

/** Was gerade im Live-Gespräch passiert (Zustand der Brücke oder Ereignisart ohne „aras_“). */
export const ZUSTAND_TEXT: Record<string, string> = {
  waehlt: "wählt …", gewaehlt: "klingelt …", klingelt: "klingelt …", angenommen: "verbunden", hallo: "verbunden", spricht: "ARAS spricht", hoert: "hört zu",
  werkzeug: "erledigt etwas …", ki_hinweis: "KI-Hinweis gesagt", aufnahme_ja: "Aufnahme: Ja", aufnahme_nein: "ohne Aufnahme", zusage: "Zusage notiert",
  link: "Link geschickt", termin: "Rückruf eingetragen", uebergabe: "übergibt …", sperre: "Sperre gesetzt", fehler: "Technik-Problem",
  amd_widerspruch: "läuft weiter", ende: "beendet", endet: "legt auf …",
};
export const zustandText = (z: string | null | undefined): string => (z ? ZUSTAND_TEXT[z] ?? lesbar(z) : "");

/** Dauer in Worten: 0 → „0:00 Min“, 92 → „1:32 Min“. */
export function dauerText(sek: number | null | undefined): string {
  const s = Math.max(0, Math.round(Number(sek) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} Min`;
}
/** Uhrzeit (Berlin) aus einem Zeitpunkt: „14:27“. */
export const uhrzeit = (iso: string | number | null | undefined): string =>
  iso == null || iso === "" ? "" : new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
/** Euro mit Komma: 0.16 → „0,16 €“. */
export const euroText = (n: number | null | undefined): string => `${Number(n ?? 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/** Heute in Berlin als JJJJ-MM-TT. */
export const berlinHeute = (jetzt: Date = new Date()): string => jetzt.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
/** Einen Tag (JJJJ-MM-TT) um n Tage verschieben — kalendarisch, ohne Zeitzonen-Falle. */
export function tagPlus(tag: string, n: number): string {
  const [j, m, t] = tag.split("-").map(Number);
  const d = new Date(Date.UTC(j, (m || 1) - 1, t || 1) + n * 86_400_000);
  return d.toISOString().slice(0, 10);
}
/** „Heute“, „Gestern“ oder „Mo., 13.10.“. */
export function tagName(tag: string, heute: string = berlinHeute()): string {
  if (tag === heute) return "Heute";
  if (tag === tagPlus(heute, -1)) return "Gestern";
  const [j, m, t] = tag.split("-").map(Number);
  return new Date(Date.UTC(j, (m || 1) - 1, t || 1, 12)).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

/** Eine Anrufzeile der Liste (Server: shared/fiaon-aras.ts AnrufZeile). */
export interface AnrufZeile {
  id: number; callId: number; am: string; spielart: string; personId: number | null; name: string | null; ergebnis: string | null; dauerSek: number;
  kostenCents: number; pruefung: string | null; uebergabe: string | null; endeGrund?: string | null; angenommen?: boolean; probeUrteil?: string | null;
}

/** Wer/was: „Probe · Rate fällig“ oder „Mila Muster · Rate fällig“ — nie doppelt („Probe Probe“). */
export function werText(z: { spielart: string; name?: string | null; gespielt?: string | null }): string {
  if (z.spielart === "probe") return z.gespielt ? `Probe · ${spielartText(z.gespielt)}` : "Probe";
  const name = z.name && z.name !== "—" && z.name !== "Probe" ? z.name : "";
  return [name, spielartText(z.spielart)].filter(Boolean).join(" · ");
}

/** Wie der Anruf ausging — ein kurzer Satz für die Liste. */
export function ausgangText(z: Pick<AnrufZeile, "spielart" | "ergebnis" | "endeGrund" | "angenommen" | "dauerSek" | "uebergabe">): string {
  const probe = z.spielart === "probe";
  if (z.uebergabe === "angenommen") return "ans Team übergeben";
  if (probe) {
    if (z.angenommen === false || (!z.dauerSek && (z.endeGrund === "nicht_erreicht" || z.ergebnis === "nicht_erreicht"))) return "nicht abgenommen";
    return endeText(z.endeGrund, true) || ergebnisText(z.ergebnis) || "beendet";
  }
  return ergebnisText(z.ergebnis) || endeText(z.endeGrund) || "—";
}

/** Die Listen-Zeile als ein Satz (Barrierefreiheit, Prüfstand): „Probe · 14:27 · 1:30 Min · 0,16 € · beendet von dir“. */
export function anrufSatz(z: AnrufZeile & { gespielt?: string | null }): string {
  return [werText(z), uhrzeit(z.am), dauerText(z.dauerSek), euroText((Number(z.kostenCents) || 0) / 100), ausgangText(z)].filter(Boolean).join(" · ");
}

/** Filter der Anrufliste. */
export type AnrufFilter = "alle" | "probe" | "kunden" | "daumen";
export function anrufFiltern<T extends Pick<AnrufZeile, "spielart" | "probeUrteil">>(zeilen: readonly T[], f: AnrufFilter): T[] {
  if (f === "probe") return zeilen.filter((z) => z.spielart === "probe");
  if (f === "kunden") return zeilen.filter((z) => z.spielart !== "probe");
  if (f === "daumen") return zeilen.filter((z) => z.probeUrteil === "runter");
  return [...zeilen];
}

/**
 * Die Zusammenfassung lesbar machen. Ohne KI-Zusammenfassung (Kunde sprach nicht, zu kurz, kein Schlüssel) schreibt der
 * Kern eine technische Zeile („Gespräch „probe“, 6 s, Ende: kunde_aufgelegt. Werkzeuge: zahlungslink_senden. Ohne
 * Aufzeichnung.“) — hier wird daraus ein Satz in Worten. Eine echte Zusammenfassung (Prosa) bleibt, wie sie ist. Rein.
 */
export function zusammenfassungText(text: string | null | undefined, probe = false): string {
  const t = String(text ?? "").trim();
  const m = /^Gespräch „([^“]*)“, (\d+) s, Ende: ([^.]+)\.(?: Werkzeuge: ([^.]+)\.)?( Ohne Aufzeichnung\.)?$/.exec(t);
  if (!m) return t;
  const sek = Number(m[2]);
  const ende = endeText(m[3].trim(), probe || m[1] === "probe") || "beendet";
  const werkzeuge = m[4] ? m[4].split(",").map((w) => {
    const x = w.trim();
    const fehl = / \(fehlgeschlagen\)$/.test(x);
    return `${werkzeugText(x.replace(/ \(fehlgeschlagen\)$/, ""))}${fehl ? " (hat nicht geklappt)" : ""}`;
  }).join(", ") : "";
  if (!sek) return `Kein Gespräch — ${ende}.`;
  const satz = sek < 60 ? `Kurzes Gespräch (${sek} Sekunden), ${ende}.` : `Gespräch über ${dauerText(sek)}, ${ende}.`;
  return [satz, werkzeuge ? `Erledigt: ${werkzeuge}.` : "", m[5] ? "Ohne Aufnahme." : ""].filter(Boolean).join(" ");
}

/** Der eine Satz oben im Cockpit: was Aras gerade tut. Rein (Prüfstand). */
export function statusSatz(l: { an: boolean; notaus: boolean; leerlauf?: boolean; stufe?: number }, live: { probe: boolean; zustand: string; zeilen: unknown[] }[]): { satz: string; klasse: "" | "gut" | "warn" | "krit" } {
  if (live.length) {
    if (live.length === 1 && live[0].probe) return { satz: !live[0].zeilen.length && /^(|waehlt|gewaehlt|klingelt)$/.test(live[0].zustand) ? "ARAS ruft dich gerade an" : "Probeanruf läuft", klasse: "gut" };
    return { satz: live.length === 1 ? "ARAS telefoniert gerade" : `ARAS telefoniert gerade · ${live.length} Gespräche`, klasse: "gut" };
  }
  if (l.notaus) return { satz: "Not-Aus — ARAS ist gestoppt", klasse: "krit" };
  if (l.leerlauf) return { satz: "Leerlauf — ARAS beginnt kein neues Gespräch", klasse: "warn" };
  if (l.an && Number(l.stufe ?? 0) >= 1) return { satz: "ARAS ruft Kunden an — gerade ist niemand dran", klasse: "gut" };
  return { satz: "ARAS ruft gerade niemanden an", klasse: "" };
}


// ── Feedback aus Probeanrufen (Routen des Kerns, ArasFeedback.tsx) ─────────────────────────────────────────────────────
export interface FeedbackPunkt { id: string; text: string; vorschlag: string | null; am: string | null; status: "offen" | "uebernommen" | "verworfen"; daumen: string | null; anrufe: number | null }

/** Die Antwort des Kerns in eine feste Form bringen. Rein (Prüfstand). */
export function feedbackLesen(j: any): FeedbackPunkt[] {
  const roh: any[] = Array.isArray(j) ? j : Array.isArray(j?.zeilen) ? j.zeilen : Array.isArray(j?.feedback) ? j.feedback : Array.isArray(j?.liste) ? j.liste : Array.isArray(j?.eintraege) ? j.eintraege : Array.isArray(j?.punkte) ? j.punkte : [];
  return roh.map((x: any, i: number) => {
    const s = String(x?.status ?? "").toLowerCase();
    const status: FeedbackPunkt["status"] = /uebernommen|übernommen|angenommen|umgesetzt/.test(s) || x?.uebernommenAm || x?.uebernommen_am ? "uebernommen"
      : /verworfen|abgelehnt/.test(s) || x?.verworfenAm || x?.verworfen_am ? "verworfen" : "offen";
    const anzahl = Number(x?.anzahl ?? x?.anrufe ?? x?.haeufigkeit ?? NaN);
    return {
      id: String(x?.id ?? x?.feedbackId ?? x?.schluessel ?? i),
      text: String(x?.text ?? x?.feedback ?? x?.grund ?? x?.titel ?? x?.wunsch ?? x?.satz ?? "").trim(),
      vorschlag: (x?.vorschlag ?? x?.aenderung ?? x?.massnahme ?? x?.umsetzung ?? x?.regel ?? null) ? String(x?.vorschlag ?? x?.aenderung ?? x?.massnahme ?? x?.umsetzung ?? x?.regel).trim() : null,
      am: x?.am ?? x?.createdAt ?? x?.created_at ?? x?.erstelltAm ?? null,
      status, daumen: x?.daumen ?? x?.urteil ?? null,
      anrufe: Number.isFinite(anzahl) && anzahl > 0 ? anzahl : null,
    };
  }).filter((p) => p.text || p.vorschlag);
}

