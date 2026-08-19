import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ErsteSchritte } from "@/components/ErsteSchritte";
import { AgentShell, ACCENT } from "./shared";
import { Reveal } from "./motion";
import {
  Tilt, Ebene, Skelett, eur, useReduzierteBewegung, useToast,
} from "@/lib/fiaon-ui";
import { ZeichenTelefon, ZeichenWinkel } from "@/lib/fiaon-zeichen";

// ═══════════════════════════════════════════════════════════════════════════
// /agent/start — die Startseite INFORMIERT, sie arbeitet nicht
//
// Warum es diese Seite gibt (Meldung des Vertriebs, 05.08.2026):
//   Florentine: „Der Bereich Heute sorgt eher für doppelte Arbeit und
//               Überschneidungen. Unser Vorschlag: alle Kunden ausschließlich
//               unter Meine Kunden führen und von oben nach unten abarbeiten."
//
// Eine Tagesliste NEBEN der Kundenliste sind zwei Wahrheiten über denselben
// Bestand. Wer in der einen arbeitet, hinterlässt in der anderen einen
// veralteten Stand — und zwei Mitarbeiter rufen denselben Menschen an.
//
// Deshalb hat diese Seite KEINEN einzigen Arbeitsknopf. Kein „Erreicht", kein
// „Nicht erreicht", kein Anrufen. Sie beantwortet drei Fragen:
//   Was habe ich verdient? · Wie viele Kunden warten? · Was ist heute vereinbart?
// Jede Zahl ist ein Weg in die Kundenliste — dort wird gearbeitet.
// ═══════════════════════════════════════════════════════════════════════════

interface StartDaten {
  agent: { vorname: string; name: string; rolle: string };
  verdienst: {
    guthabenCents: number; angefordertCents: number; ausgezahltCents: number;
    monatCents: number; moeglichCents: number; moeglichAnzahl: number;
    monatszielCents: number | null; satzBp: number; mindestCents: number;
    auszahlbar: boolean; bankHinterlegt: boolean;
    offenerAntrag: { id: number; cents: number; am: string } | null;
  };
  kunden: {
    offen: number; tier1: number; tier2: number; tier3: number; bezahlt: number;
    zusageHeute: number; zusageUeberfaellig: number;
  };
  zusagen: any[];
  rueckrufe: { personId: number; name: string; am: string; notiz: string | null; tierGrund: string }[];
}

async function api(pfad: string, init?: RequestInit) {
  const res = await fetch(`/api/fiaon${pfad}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok && json?.ok, json };
}

/** Relativer Tag in Klartext — „heute", „morgen", „seit 3 Tagen überfällig". */
function relativerTag(iso: string | null): { text: string; ton: "dringend" | "heute" | "bald" | "ruhig" } {
  if (!iso) return { text: "ohne Datum", ton: "ruhig" };
  const heute = new Date(); heute.setHours(0, 0, 0, 0);
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  const tage = Math.round((d.getTime() - heute.getTime()) / 86_400_000);
  if (tage < 0) return { text: `seit ${Math.abs(tage)} ${Math.abs(tage) === 1 ? "Tag" : "Tagen"} überfällig`, ton: "dringend" };
  if (tage === 0) return { text: "zahlt heute", ton: "heute" };
  if (tage === 1) return { text: "zahlt morgen", ton: "bald" };
  if (tage <= 7) return { text: `zahlt in ${tage} Tagen`, ton: "bald" };
  return {
    text: `zahlt am ${d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}`,
    ton: "ruhig",
  };
}

function zeitpunkt(iso: string): { tag: string; uhr: string; vorbei: boolean } {
  const d = new Date(iso);
  const heute = new Date();
  const gleicherTag = d.toDateString() === heute.toDateString();
  const morgen = new Date(heute.getTime() + 86_400_000).toDateString() === d.toDateString();
  return {
    tag: gleicherTag ? "heute" : morgen ? "morgen" : d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" }),
    uhr: d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
    vorbei: d.getTime() < Date.now(),
  };
}

const TON_FARBE: Record<string, string> = {
  dringend: "var(--fi-tier1)",
  heute: "var(--fi-primaer)",
  bald: "var(--fi-tier2)",
  ruhig: "var(--fi-text-still)",
};

export default function AgentStartSeite() {
  return (
    <AgentShell>
      {/* Erste Schritte fuer neue Kollegen. Verschwindet von selbst,
          sobald alles erledigt ist, und blockiert nie. */}
      <ErsteSchritte />
      <Inhalt />
    </AgentShell>
  );
}

/**
 * Die Tageszeit in der Anrede — „Guten Morgen" um sieben, „Guten Abend" um
 * neun. Das kostet nichts und macht aus einer Maske einen Arbeitsplatz.
 * Gerechnet wird in Europe/Berlin, nicht in der Zeitzone des Browsers.
 */
function gruss(): string {
  const stunde = Number(new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin", hour: "2-digit", hour12: false,
  }).format(new Date()));
  if (stunde < 11) return "Guten Morgen";
  if (stunde < 18) return "Guten Tag";
  return "Guten Abend";
}

interface AgentTermin {
  id: number; personId: number; name: string; beginn: string;
  datumText: string; uhrzeit: string; dauerMin: number;
  status: string; quelle: string; heute: boolean;
}

function Inhalt() {
  const [d, setD] = useState<StartDaten | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [busy, setBusy] = useState(false);
  const reduziert = useReduzierteBewegung();
  const { zeige } = useToast();

  const [termine, setTermine] = useState<AgentTermin[]>([]);
  const [termineLaedt, setTermineLaedt] = useState(true);
  /** Warum die Startzahlen fehlen — im Klartext, nicht als „bitte neu laden". */
  const [startFehler, setStartFehler] = useState<
    { code: number; text: string; server: string | null } | null>(null);

  const laden = useCallback(async () => {
    // Zwei unabhängige Auskünfte gleichzeitig — die Startseite hat sich einmal
    // fünf Sekunden Zeit gelassen, weil sie sie hintereinander geholt hat.
    const [r, t] = await Promise.all([api("/agent/start"), api("/agent/termine")]);
    if (r.ok) { setD(r.json); setStartFehler(null); }
    // ══════════════════════════════════════════════════════════════════════
    // DER GRUND WIRD FESTGEHALTEN, NICHT WEGGEWORFEN (19.08.2026)
    //
    // Vorher stand hier nur `if (r.ok) setD(...)`. Scheiterte der Aufruf, blieb
    // `d` leer, die Karte fiel auf 0,00 € zurück und daneben stand „bitte neu
    // laden" — ein Satz, der beim Neuladen dasselbe Ergebnis bringt.
    //
    // GEMESSEN am 19.08.2026: Die Route antwortete mit HTTP 500
    // („missing FROM-clause entry for table p"). Vier Mitarbeiter haben ein
    // leeres Portal gemeldet, und niemand konnte am Bildschirm sehen, warum.
    // Die Antwort des Servers lag vor — sie wurde nur nicht angesehen.
    //
    // AGENTS.md: „Ein Zustand ‚konnte nicht prüfen‘ ist nicht derselbe wie
    // ‚ist kaputt‘" und „Statuscodes nach VERURSACHER trennen".
    // ══════════════════════════════════════════════════════════════════════
    else {
      const code = Number((r as any).status ?? 0);
      const wer = code === 401 ? "Deine Sitzung ist abgelaufen — melde dich neu an."
        : code === 403 ? "Für diese Zahlen fehlt dir die Berechtigung."
        : code >= 500 ? "Der Server hat einen Fehler gemeldet. Das ist unsere Seite, "
          + "nicht deine — die Verwaltung sieht es im Protokoll."
        : code === 0 ? "Keine Verbindung zum Server. Prüf dein Netz."
        : "Die Zahlen kamen nicht zurück.";
      setStartFehler({
        code,
        text: wer,
        server: String((r as any).json?.error ?? "").slice(0, 200) || null,
      });
    }
    if (t.ok) setTermine(t.json.termine || []);
    setLaedt(false);
    setTermineLaedt(false);
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  /**
   * Auszahlung von hier aus einleiten — über den BESTEHENDEN Weg
   * (POST /agent/payouts). Kein zweiter Auszahlungspfad: Geld darf nur an einer
   * Stelle im Code angefordert werden.
   */
  const auszahlungEinleiten = async () => {
    if (!d) return;
    if (!confirm(
      `Auszahlung über ${eur(d.verdienst.guthabenCents)} anfordern?\n\n`
      + `Der Betrag wird zur Freigabe eingereicht. Die Überweisung macht die Verwaltung `
      + `von Hand — du bekommst eine Bestätigungsmail und eine Abrechnung als PDF.`,
    )) return;
    setBusy(true);
    const r = await api("/agent/payouts", { method: "POST", body: JSON.stringify({}) });
    setBusy(false);
    if (r.ok) {
      zeige("erfolg", "Auszahlung angefordert", `${eur(d.verdienst.guthabenCents)} zur Freigabe eingereicht.`);
      void laden();
    } else {
      zeige("fehler", "Nicht möglich", r.json?.error || "Bitte im Bereich Verdienst prüfen.");
    }
  };

  const zusagenGruppen = useMemo(() => {
    const heute: any[] = [], morgen: any[] = [], woche: any[] = [], ueber: any[] = [], spaeter: any[] = [];
    for (const k of d?.zusagen || []) {
      const r = relativerTag(k.zusagedatum);
      if (r.ton === "dringend") ueber.push(k);
      else if (r.text === "zahlt heute") heute.push(k);
      else if (r.text === "zahlt morgen") morgen.push(k);
      else if (r.ton === "bald") woche.push(k);
      else spaeter.push(k);
    }
    return { ueber, heute, morgen, woche, spaeter };
  }, [d]);

  // ══════════════════════════════════════════════════════════════════════
  // DIE NICHT-NULL-ZUSICHERUNG HAT GELOGEN
  //
  // ── DER BEFUND (16.08.2026, Knopf-Durchgang) ─────────────────────────
  // Der Knopf „Gelesen" auf /agent/start ließ die Seite weiß werden:
  //   „Cannot read properties of undefined (reading 'guthabenCents')"
  //
  // Ursache: Unten stand dreimal `v.guthabenCents`. Das Ausrufezeichen
  // BEHAUPTET, `v` sei da — geprüft wurde nur `laedt`. Antwortet der Server
  // aber mit einem Objekt OHNE `verdienst` (Teilfehler, 403 auf einer der
  // Unterabfragen, Rechteproblem), ist `laedt` false und `v` undefined. Der
  // Zugriff wirft, React reißt den ganzen Baum ab, und der Mensch sieht:
  // nichts. Kein Fehlertext, keine Meldung — eine weiße Seite.
  //
  // Gefunden hat das kein Typcheck (das `!` schaltet ihn ja ab) und kein
  // Test, sondern der Knopf-Durchgang: drücken und zusehen.
  //
  // Der Rückfall auf 0 ist hier richtig: „0,00 €" ist eine Aussage, die der
  // Mensch prüfen kann. Eine weiße Seite ist keine.
  // ══════════════════════════════════════════════════════════════════════
  const v: NonNullable<typeof d>["verdienst"] = d?.verdienst ?? {
    guthabenCents: 0, angefordertCents: 0, ausgezahltCents: 0,
    monatCents: 0, moeglichCents: 0, moeglichAnzahl: 0,
    monatszielCents: null, satzBp: 0, mindestCents: 0,
    auszahlbar: false, bankHinterlegt: false, offenerAntrag: null,
  };
  const verdienstFehlt = !laedt && !d?.verdienst;

  return (
    <div className="pb-10">
      <div className="mx-auto" style={{ maxWidth: "var(--fi-breite-max)" }}>
        {/* ── 1 · Begrüßung ─────────────────────────────────────────────── */}
        <Reveal index={0}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight leading-tight">
                <span className="fi-gradient-text">
                  {laedt ? gruss() : `${gruss()}${d?.agent.vorname ? `, ${d.agent.vorname}` : ""}`}
                </span>
              </h1>
              <p className="mt-1 text-[13px]" style={{ color: "var(--fi-text-leise)" }}>
                {laedt ? "Lade deine Übersicht …"
                  : d && d.kunden.offen > 0
                    ? `${d.kunden.offen} Kunden gehören dir. Gearbeitet wird in der Kundenliste — von oben nach unten.`
                    : "Aktuell sind dir keine offenen Kunden zugewiesen."}
              </p>
            </div>
            <Link href="/agent/updates"
                  className="shrink-0 inline-flex items-center px-2.5 py-1.5 rounded-xl border bg-white text-[12px] font-semibold
                             transition-transform duration-150 active:scale-[0.96]"
                  style={{ borderColor: "var(--fi-linie)", color: "var(--fi-primaer)" }}>
              Neuigkeiten
            </Link>
          </div>
        </Reveal>

        {/* ── 2 · Verdienst ─────────────────────────────────────────────── */}
        <Reveal index={1}>
          <section className="mt-6">
            <h2 className="text-[11px] font-semibold uppercase tracking-[.09em] mb-2.5"
                style={{ color: "var(--fi-text-still)" }}>
              Dein Verdienst
            </h2>
            <Tilt max={reduziert ? 0 : 3}>
              <div className="fi-karte p-5 sm:p-6">
                <Ebene z={1}>
                  {/* ══════════════════════════════════════════════════════
                      KEINE ZAHL, WENN ES KEINE ZAHL GIBT (19.08.2026)

                      Hier stand „0,00 €" mit dem Warntext daneben. Das mischt
                      zwei Aussagen, die nichts miteinander zu tun haben: „du
                      hast nichts verdient" und „wir konnten es nicht laden".
                      Der Mitarbeiter liest die Zahl und erschrickt.

                      GEMESSEN am 19.08.2026 bei Daniel Stripling: 734,50 €
                      Guthaben — angezeigt wurden 0,00 €, weil die Route mit
                      HTTP 500 antwortete.

                      Jetzt steht statt der Zahl ein Strich und darunter der
                      GRUND. Eine sichtbare Lücke ist ehrlich; eine gefüllte
                      Lücke ist eine Behauptung (AGENTS.md).
                     ══════════════════════════════════════════════════════ */}
                  {verdienstFehlt && startFehler && (
                    <div className="mb-4 px-3.5 py-3 rounded-xl" data-fiaon="verdienst-grund"
                         style={{ background: "rgba(180,83,9,.08)",
                                  border: "1px solid rgba(180,83,9,.26)" }}>
                      <p className="text-[12.5px] font-semibold" style={{ color: "#92400e" }}>
                        Deine Zahlen konnten nicht geladen werden
                        {startFehler.code > 0 ? ` (HTTP ${startFehler.code})` : ""}.
                      </p>
                      <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: "#92400e" }}>
                        {startFehler.text}
                      </p>
                      {startFehler.server && (
                        <p className="text-[11px] mt-1" style={{ color: "#a16207" }}>
                          Meldung des Servers: {startFehler.server}
                        </p>
                      )}
                      <button type="button" onClick={() => void laden()}
                              className="mt-2 px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-white"
                              style={{ border: "1px solid rgba(180,83,9,.35)", color: "#92400e" }}>
                        Noch einmal versuchen
                      </button>
                    </div>
                  )}
                  <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
                    <div>
                      <p className="text-[11.5px] font-semibold uppercase tracking-[.07em]"
                         style={{ color: "var(--fi-text-still)" }}>
                        Kontostand
                      </p>
                      {laedt ? <Skelett h={34} w={140} /> : (
                        <p className="text-[30px] sm:text-[34px] font-bold leading-none mt-1 fi-zahl"
                           style={verdienstFehlt ? { color: "var(--fi-text-still)" } : undefined}>
                          {verdienstFehlt ? "—" : eur(v.guthabenCents)}
                        </p>
                      )}
                      <p className="mt-1 text-[11.5px]"
                         style={{ color: verdienstFehlt ? "#b45309" : "var(--fi-text-still)" }}>
                        {verdienstFehlt
                          ? "unbekannt — siehe den Grund oben"
                          : "bestätigt und auszahlbar"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11.5px] font-semibold uppercase tracking-[.07em]"
                         style={{ color: "var(--fi-text-still)" }}>
                        Diesen Monat
                      </p>
                      {laedt ? <Skelett h={24} w={100} /> : (
                        <p className="text-[22px] font-bold leading-none mt-1 fi-zahl">{eur(v.monatCents)}</p>
                      )}
                      {!laedt && v.monatszielCents ? (
                        <p className="mt-1 text-[11.5px]" style={{ color: "var(--fi-text-still)" }}>
                          Ziel {eur(v.monatszielCents)}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-[11.5px] font-semibold uppercase tracking-[.07em]"
                         style={{ color: "var(--fi-text-still)" }}>
                        Möglich
                      </p>
                      {laedt ? <Skelett h={24} w={100} /> : (
                        <p className="text-[22px] font-bold leading-none mt-1 fi-zahl">{eur(v.moeglichCents)}</p>
                      )}
                      <p className="mt-1 text-[11.5px]" style={{ color: "var(--fi-text-still)" }}>
                        {laedt ? "" : `aus ${v.moeglichAnzahl} offenen Kunden`}
                      </p>
                    </div>
                  </div>
                </Ebene>

                {/* Fortschrittsbalken zum Monatsziel — nur wenn ein Ziel gesetzt ist. */}
                {!laedt && v.monatszielCents ? (
                  <div className="mt-4">
                    <div className="h-[6px] rounded-full overflow-hidden" style={{ background: "var(--fi-seite)" }}>
                      <div className="h-full rounded-full"
                           style={{
                             width: `${Math.min(100, Math.round((v.monatCents / v.monatszielCents) * 100))}%`,
                             background: "var(--fi-verlauf-primaer)",
                             transition: "width 600ms cubic-bezier(0.32,0.72,0,1)",
                           }} />
                    </div>
                  </div>
                ) : null}

                {/* ── AUSZAHLUNG ─────────────────────────────────────────
                    `verdienstFehlt` schließt diesen Block aus. Sonst stand
                    hier „Für eine Auszahlung fehlen deine Bankdaten" bei
                    Menschen, deren IBAN hinterlegt ist — der Rückfall setzt
                    `bankHinterlegt: false`, und die Anzeige hielt das für eine
                    Auskunft. Ein Satz über fehlende Bankdaten schickt jemanden
                    ins Profil, um etwas nachzutragen, das längst dasteht. */}
                {!laedt && !verdienstFehlt && (
                  <div className="mt-5 pt-5 flex flex-wrap items-center gap-3"
                       style={{ borderTop: "1px solid var(--fi-linie)" }}>
                    {!v.bankHinterlegt ? (
                      <>
                        <p className="text-[12.5px] flex-1 min-w-[220px]" style={{ color: "var(--fi-tier2)" }}>
                          Für eine Auszahlung fehlen deine Bankdaten. Ohne IBAN kann die Verwaltung nicht überweisen.
                        </p>
                        <Link href="/agent/profil" className="fi-primaerknopf px-4 py-2.5 text-[13px] font-semibold text-white">
                          Bankdaten hinterlegen
                        </Link>
                      </>
                    ) : v.offenerAntrag ? (
                      <>
                        <p className="text-[12.5px] flex-1 min-w-[220px]" style={{ color: "var(--fi-text-leise)" }}>
                          Ein Antrag über <b>{eur(v.offenerAntrag.cents)}</b> liegt zur Freigabe bei der Verwaltung
                          (eingereicht {new Date(v.offenerAntrag.am).toLocaleDateString("de-DE")}).
                        </p>
                        <Link href="/agent/auszahlung" className="fi-zweitknopf px-4 py-2.5 text-[12.5px] font-semibold">
                          Stand ansehen
                        </Link>
                      </>
                    ) : v.auszahlbar ? (
                      <>
                        <button type="button" onClick={() => void auszahlungEinleiten()} disabled={busy}
                                className="fi-sendeknopf px-5 py-2.5 text-[13px] font-semibold">
                          {busy ? "Wird eingereicht …" : `Auszahlung einleiten · ${eur(v.guthabenCents)}`}
                        </button>
                        <Link href="/agent/auszahlung" className="fi-zweitknopf px-4 py-2.5 text-[12.5px] font-semibold">
                          Verlauf
                        </Link>
                      </>
                    ) : (
                      <>
                        <p className="text-[12.5px] flex-1 min-w-[220px]" style={{ color: "var(--fi-text-leise)" }}>
                          Auszahlung ab {eur(v.mindestCents)} möglich — dir fehlen noch{" "}
                          <b>{eur(Math.max(0, v.mindestCents - v.guthabenCents))}</b>.
                        </p>
                        <Link href="/agent/auszahlung" className="fi-zweitknopf px-4 py-2.5 text-[12.5px] font-semibold">
                          Verdienst ansehen
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            </Tilt>
          </section>
        </Reveal>

        {/* ── 3 · Deine Kunden ──────────────────────────────────────────── */}
        <Reveal index={2}>
          <section className="mt-7">
            <div className="flex items-baseline justify-between gap-3 mb-2.5">
              <h2 className="text-[11px] font-semibold uppercase tracking-[.09em]"
                  style={{ color: "var(--fi-text-still)" }}>
                Deine Kunden
              </h2>
              <Link href="/agent/kunden" className="text-[12.5px] font-semibold inline-flex items-center gap-1"
                    style={{ color: "var(--fi-primaer)" }}>
                Kundenliste öffnen <ZeichenWinkel richtung="rechts" size={13} />
              </Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {[
                { titel: "Warten auf dich", wert: d?.kunden.offen, ziel: "/agent/kunden", farbe: "var(--fi-text)" },
                { titel: "Zahlung gemeldet", wert: d?.kunden.tier1, ziel: "/agent/kunden?filter=tier1", farbe: "var(--fi-tier1)" },
                { titel: "Rechnung offen", wert: d?.kunden.tier2, ziel: "/agent/kunden?filter=rechnung_offen", farbe: "var(--fi-tier2)" },
                { titel: "Neue Leads", wert: d?.kunden.tier3, ziel: "/agent/kunden?filter=leads", farbe: "var(--fi-tier3)" },
              ].map((k, i) => (
                <Link key={k.titel} href={k.ziel} className="fi-karte fi-karte--hebt p-4 block">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[.08em]"
                     style={{ color: "var(--fi-text-still)" }}>{k.titel}</p>
                  {laedt ? <Skelett h={28} w={54} className="mt-1.5" /> : (
                    <p className="text-[26px] font-bold leading-none mt-1.5 fi-zahl" style={{ color: k.farbe }}>
                      {k.wert ?? 0}
                    </p>
                  )}
                  <p className="mt-1.5 text-[11px] font-semibold inline-flex items-center gap-1"
                     style={{ color: "var(--fi-primaer)" }}>
                    ansehen <ZeichenWinkel richtung="rechts" size={11} />
                  </p>
                </Link>
              ))}
            </div>
          </section>
        </Reveal>

        {/* ── 4 · Zahlungszusagen ───────────────────────────────────────── */}
        <Reveal index={3}>
          <section className="mt-7">
            <h2 className="text-[11px] font-semibold uppercase tracking-[.09em] mb-2.5"
                style={{ color: "var(--fi-text-still)" }}>
              Zahlungszusagen
            </h2>
            {laedt ? (
              <div className="fi-karte p-4 space-y-3">
                {[0, 1, 2].map((i) => <Skelett key={i} h={20} />)}
              </div>
            ) : (d?.zusagen.length || 0) === 0 ? (
              <div className="fi-karte p-5">
                <p className="text-[13.5px] font-semibold">Keine Zahlungszusage offen.</p>
                <p className="text-[12.5px] mt-1" style={{ color: "var(--fi-text-still)" }}>
                  Sobald du in der Kundenliste „Zahlt am …" festhältst, erscheint der Termin hier.
                </p>
              </div>
            ) : (
              <div className="fi-karte overflow-hidden">
                {([
                  ["Überfällig", zusagenGruppen.ueber],
                  ["Heute", zusagenGruppen.heute],
                  ["Morgen", zusagenGruppen.morgen],
                  ["Diese Woche", zusagenGruppen.woche],
                  ["Später", zusagenGruppen.spaeter],
                ] as const).filter(([, l]) => l.length > 0).map(([titel, liste]) => (
                  <div key={titel}>
                    <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[.08em]"
                       style={{ background: "var(--fi-seite)", color: "var(--fi-text-still)" }}>
                      {titel} · {liste.length}
                    </p>
                    {liste.map((k: any) => {
                      const r = relativerTag(k.zusagedatum);
                      return (
                        <Link key={k.personId} href={`/agent/kunden?person=${k.personId}`}
                              className="px-4 py-3 flex items-center gap-3 block"
                              style={{ boxShadow: "inset 0 -1px 0 var(--fi-linie)" }}>
                          <span className="w-1 self-stretch rounded-full shrink-0"
                                style={{ background: TON_FARBE[r.ton], minHeight: 28 }} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13.5px] font-semibold truncate">{k.name}</span>
                            <span className="block text-[11.5px] mt-0.5" style={{ color: "var(--fi-text-still)" }}>
                              {k.produkt || "—"}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-[13px] font-bold fi-zahl">{eur(k.betrag)}</span>
                            <span className="block text-[11.5px] font-semibold" style={{ color: TON_FARBE[r.ton] }}>
                              {r.text}
                            </span>
                          </span>
                          <ZeichenWinkel richtung="rechts" size={14} className="shrink-0 opacity-40" />
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </section>
        </Reveal>

        {/* ── 5 · Gebuchte Termine ──────────────────────────────────────────
            Ein Rückruf ist eine Notiz des Agenten; ein Termin ist eine Zusage
            an den Kunden, der sich die Uhrzeit selbst ausgesucht hat und
            wartet. Deshalb steht er darüber. */}
        <Reveal index={4}>
          <section className="mt-7">
            <h2 className="text-[11px] font-semibold uppercase tracking-[.09em] mb-2.5"
                style={{ color: "var(--fi-text-still)" }}>
              Gebuchte Termine
            </h2>
            {termineLaedt ? (
              <div className="fi-karte p-4"><Skelett h={20} /></div>
            ) : termine.length === 0 ? (
              <div className="fi-karte p-5">
                <p className="text-[13.5px] font-semibold">Kein Termin gebucht.</p>
                <p className="text-[12.5px] mt-1" style={{ color: "var(--fi-text-still)" }}>
                  Kunden, die du zweimal nicht erreichst, bekommen automatisch einen Buchungslink —
                  gewählte Zeiten stehen dann hier.
                </p>
              </div>
            ) : (
              <div className="fi-karte overflow-hidden">
                {termine.map((t) => {
                  const z = zeitpunkt(t.beginn);
                  return (
                    <Link key={t.id} href={`/agent/kunden?person=${t.personId}`}
                          className="px-4 py-3 flex items-center gap-3 block"
                          style={{ boxShadow: "inset 0 -1px 0 var(--fi-linie)" }}>
                      <span className="shrink-0 w-[62px] text-center">
                        <span className="block text-[11px] font-semibold uppercase"
                              style={{ color: t.heute ? "#059669" : "var(--fi-text-still)" }}>
                          {z.tag}
                        </span>
                        <span className="block text-[15px] font-bold fi-zahl"
                              style={{ color: t.heute ? "#059669" : "var(--fi-text)" }}>
                          {t.uhrzeit}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-semibold truncate">{t.name}</span>
                        <span className="block text-[11.5px] truncate" style={{ color: "var(--fi-text-still)" }}>
                          {t.dauerMin} Minuten · {t.quelle === "agent_manuell" ? "von dir angelegt" : "vom Kunden gewählt"}
                        </span>
                      </span>
                      {t.heute && (
                        <span className="shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded-md"
                              style={{ background: "rgba(5,150,105,.10)", color: "#059669" }}>
                          heute
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </Reveal>

        {/* ── 6 · Rückrufe ──────────────────────────────────────────────── */}
        <Reveal index={5}>
          <section className="mt-7">
            <h2 className="text-[11px] font-semibold uppercase tracking-[.09em] mb-2.5"
                style={{ color: "var(--fi-text-still)" }}>
              Vereinbarte Rückrufe
            </h2>
            {laedt ? (
              <div className="fi-karte p-4"><Skelett h={20} /></div>
            ) : (d?.rueckrufe.length || 0) === 0 ? (
              <div className="fi-karte p-5">
                <p className="text-[13.5px] font-semibold">Kein Rückruf vereinbart.</p>
                <p className="text-[12.5px] mt-1" style={{ color: "var(--fi-text-still)" }}>
                  Halte in der Kundenliste „Rückruf vereinbart" mit Datum und Uhrzeit fest — der Termin steht dann hier.
                </p>
              </div>
            ) : (
              <div className="fi-karte overflow-hidden">
                {d!.rueckrufe.map((r) => {
                  const z = zeitpunkt(r.am);
                  return (
                    <Link key={r.personId} href={`/agent/kunden?person=${r.personId}`}
                          className="px-4 py-3 flex items-center gap-3 block"
                          style={{ boxShadow: "inset 0 -1px 0 var(--fi-linie)" }}>
                      <span className="shrink-0 w-[62px] text-center">
                        <span className="block text-[11px] font-semibold uppercase"
                              style={{ color: z.vorbei ? "var(--fi-tier1)" : "var(--fi-text-still)" }}>
                          {z.tag}
                        </span>
                        <span className="block text-[15px] font-bold fi-zahl"
                              style={{ color: z.vorbei ? "var(--fi-tier1)" : "var(--fi-text)" }}>
                          {z.uhr}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-semibold truncate">{r.name}</span>
                        {r.notiz && (
                          <span className="block text-[11.5px] truncate" style={{ color: "var(--fi-text-still)" }}>
                            {r.notiz}
                          </span>
                        )}
                      </span>
                      {z.vorbei && (
                        <span className="shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded-md"
                              style={{ background: "rgba(220,38,38,.08)", color: "var(--fi-tier1)" }}>
                          fällig
                        </span>
                      )}
                      <ZeichenTelefon size={14} className="shrink-0 opacity-40" />
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </Reveal>

        {/* ── 6 · Hinweis auf die eine Arbeitsliste ─────────────────────── */}
        <Reveal index={5}>
          <div className="mt-7 p-4 rounded-[14px]"
               style={{ background: "var(--fi-flaeche-akzent, #f1f5ff)", border: "1px solid rgba(29,78,216,.14)" }}>
            <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--fi-text-leise)" }}>
              <b>Gearbeitet wird in der Kundenliste.</b> Dort stehen alle deine Kunden in der Reihenfolge, in der sie
              dran sind — Zusagen und Rückrufe zuerst. Diese Startseite zeigt nur, wie du stehst; sie nimmt dir keine
              Kunden weg und gibt dir keine neuen.
            </p>
            <Link href="/agent/kunden"
                  className="fi-primaerknopf inline-flex items-center gap-2 px-4 py-2.5 mt-3 text-[13px] font-semibold text-white">
              Zur Kundenliste
            </Link>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
