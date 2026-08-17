import { useState, useEffect, useCallback } from "react";
import { FiaonEbene } from "@/components/FiaonEbene";
import { Send, ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertTriangle, User, FlaskConical } from "lucide-react";
import { PageIntro, Tip } from "@/components/admin/PageHelp";

// ═══════════════════════════════════════════════════════════════════
// /admin/events — Event-Test-Konsole (Paket T)
// Alle Make-Event-Typen aus der Code-Registry (server/make-events-registry.ts):
// Test-Versand mit editierbarem Payload (test: true, email ersetzt),
// „Für echten Kunden senden" (mit Vorschau + Bestätigung), Diagnose-Tabelle
// (letzter Versand je Event) und Verlauf der letzten 20 Test-/Real-Sends.
// ═══════════════════════════════════════════════════════════════════

const ACCENT = "#2563eb";
const LS_KEY = "fiaon_admin_test_email";

interface EventDef {
  type: string;
  label: string;
  description: string;
  customerBound: boolean;
  deprecated?: boolean;
  recommendationOnly?: boolean;
  // GEMESSENER Stand statt Heuristik (09.08.2026). Siehe
  // server/lib/fiaon-mail-events.ts — `makeBranchReady` gibt es nicht mehr.
  verifikation?: "bestaetigt" | "nicht_bestaetigt" | "ungeprueft";
  verifikationsText?: string;
  brevoTemplateId?: number | null;
  brevoTemplateName?: string | null;
  example: Record<string, unknown>;
}

interface RegistryResponse {
  ok: boolean;
  events: EventDef[];
  makeWebhookConfigured: boolean;
  /** Ohne Brevo-Schlüssel kann sich die Ampel nicht selbst bestätigen. */
  brevoKonfiguriert?: boolean;
  brevoHinweis?: string | null;
  lastEvents: Record<string, string>;
  history: { event: string; email: string; ok: boolean; mode: "test" | "real"; at: string }[];
}

interface RealPreview {
  eventType: string;
  customer: string;
  email: string;
  status: string;
  payload: Record<string, unknown>;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/**
 * Alle Zweige auf einmal prüfen.
 *
 * ── WAS EIN LAUF WIRKLICH TUT ──────────────────────────────────────────────
 * Jede Prüfung SENDET eine Probemail an die Testadresse und wartet, ob Brevo
 * eine Zustellung meldet. Bei 33 Ereignissen sind das 33 Mails. Das muss
 * vorher dastehen — sonst wundert sich der Vorgesetzte über ein volles
 * Postfach und traut dem Knopf beim nächsten Mal nicht mehr.
 *
 * ── DIE ARBEITSLISTE IST DAS EIGENTLICHE ERGEBNIS ──────────────────────────
 * Ein „22 von 33 bestätigt" ist eine Zahl. Was der Vorgesetzte braucht, ist die
 * Liste der elf fehlenden Zweige mit ihren Variablennamen — damit geht er zu
 * Make und legt sie an. Deshalb steht sie unten, mit Kopierknopf.
 */
function AlleZweigePruefen({ anzahl, testAdresse, onFertig }: {
  anzahl: number; testAdresse: string; onFertig: () => void;
}) {
  const [frage, setFrage] = useState(false);
  const [laeuft, setLaeuft] = useState<null | "voll" | "nachsehen">(null);
  const [erg, setErg] = useState<any>(null);
  const [kopiert, setKopiert] = useState(false);
  // ── DIE LEISTE ZÄHLT MIT ──────────────────────────────────────────────
  // Der Lauf dauert bis zu vier Minuten (Brevo trägt Ereignisse mit 1–3
  // Minuten Verzug ein). Ohne eine Anzeige, die sich BEWEGT, sieht das aus
  // wie ein Hänger — und wer abbricht, sieht danach 34 falsche Rot-Marken.
  const [verstrichen, setVerstrichen] = useState(0);

  useEffect(() => {
    if (!laeuft) { setVerstrichen(0); return; }
    const t = setInterval(() => setVerstrichen((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [laeuft]);

  const starten = async (nurNachsehen = false) => {
    setFrage(false);
    setLaeuft(nurNachsehen ? "nachsehen" : "voll");
    setErg(null);
    const r = await fetch("/api/fiaon/admin/mail/alle-pruefen", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testAdresse, nurNachsehen }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setLaeuft(null);
    setErg(j ?? { ok: false, error: "Der Lauf war nicht erreichbar." });
    onFertig();
  };

  // ══════════════════════════════════════════════════════════════════════
  // „NICHT BESTÄTIGT" IST NICHT DASSELBE WIE „ZWEIG FEHLT" (21.08.2026)
  //
  // Hier stand: `filter((z) => !z.bestaetigt)` — und die Kachel darüber hieß
  // „ohne Zweig". Als die Nachschau selbst kaputt war (endDate in der Zukunft
  // → HTTP 400), meldete diese Seite „35 ohne Zweig", während der Betreiber
  // die Testmails EMPFING und die Zweige längst gebaut hatte.
  //
  // Eine Anschuldigung gegen den Betreiber für einen Fehler in unserem Code.
  // Dasselbe Muster wie am 09.08.2026, als die Plattform aus einem Wort in
  // ihrer eigenen Beschreibung „MAKE-ZWEIG FEHLT" machte.
  //
  // Jetzt werden drei Dinge getrennt: bestätigt · Zweig fehlt · Prüfung
  // gestört. Und nur das MITTLERE gehört in die Liste „fehlt in Make".
  // ══════════════════════════════════════════════════════════════════════
  const alleZweige = (erg?.zweige ?? []) as any[];
  const fehlende = alleZweige.filter((z: any) =>
    z.zustand ? z.zustand === "zweig_fehlt" : !z.bestaetigt);
  const gestoerte = alleZweige.filter((z: any) => z.zustand === "pruefung_gestoert");
  // ── VERALTETE STEHEN FÜR SICH ────────────────────────────────────────────
  // `followup_48h` wird nie mehr gefeuert (gemessen: null Versände) und der
  // Zweig darf in Make gelöscht werden. Bis heute bekam es eine Probemail, kam
  // nie an und zählte als „Zweig fehlt". Eine Ampel, die einen absichtlich
  // gelöschten Zweig anmahnt, wird ignoriert — und mit ihr die echten Funde.
  const veraltete = alleZweige.filter((z: any) => z.zustand === "veraltet");
  const liste = fehlende.map((z: any) => z.event).join("\n");

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 mb-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[14px] font-bold text-slate-900">Alle Zweige prüfen</h2>
          <p className="text-[12px] text-slate-500 leading-relaxed mt-0.5" style={{ maxWidth: 620 }}>
            Sendet an jeden der {anzahl || "—"} Ereignistypen eine Probemail an deine
            Testadresse und wartet, ob Brevo die Zustellung meldet. Danach steht hier,
            welche Zweige in Make noch fehlen.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* ══════════════════════════════════════════════════════════════
              „NUR NACHSEHEN" (23.08.2026)

              Der Lauf vom 22.08. gab nach 25 Sekunden auf und meldete 34
              fehlende Zweige — während die Mails im Postfach lagen. Brevo
              trägt Ereignisse mit 1–3 Minuten Verzug ein.

              Dieser Knopf fragt Brevo über das Zeitfenster des LETZTEN
              Versands erneut ab, OHNE neue Probemails. Genau für den Fall,
              dass der Lauf zu früh aufgab: Die Mails sind längst da, es fehlt
              nur der Abgleich. 35 unnötige Mails an die Testadresse kosten
              Zustellreputation.
              ══════════════════════════════════════════════════════════════ */}
          <button type="button" onClick={() => void starten(true)}
                  disabled={!!laeuft}
                  title="Fragt Brevo erneut über das Zeitfenster des letzten Versands ab — ohne neue Probemails zu schicken."
                  className="fi-knopf-glas px-4 py-2.5 text-[12.5px]">
            {laeuft === "nachsehen" ? "Sieht nach …" : "Nur nachsehen"}
          </button>
          <button type="button" onClick={() => setFrage(true)} disabled={!!laeuft || !anzahl}
                  className="fi-knopf-primaer px-5">
            {laeuft === "voll" ? `Prüft ${anzahl} Zweige …` : "Alle Zweige prüfen"}
          </button>
        </div>
      </div>

      {laeuft && (
        <div className="mt-4">
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(15,23,42,.07)" }}>
            <div style={{
              height: "100%", width: "40%", borderRadius: 999,
              background: "linear-gradient(90deg, transparent, #1d4ed8, transparent)",
              animation: "fiLauf 1.4s ease-in-out infinite",
            }} />
          </div>
          <style>{"@keyframes fiLauf{0%{transform:translateX(-100%)}100%{transform:translateX(320%)}}"}</style>
          {/* ── DIE ZEITANGABE STIMMT JETZT — UND SIE BEWEGT SICH ──────────
              Erst hieß es „jeder Zweig bekommt vier Sekunden" (über zwei
              Minuten). Dann „einmal nachsehen, 34 Sekunden" — und der Lauf
              meldete 34 falsche Rot-Marken, weil Brevo 1–3 Minuten braucht.

              Jetzt wird MEHRMALS nachgefragt, und die Anzeige zeigt, dass
              etwas passiert. Eine Anzeige, die stillsteht, wird abgebrochen. */}
          <p className="mt-2 text-[12px] text-slate-500 leading-relaxed">
            {laeuft === "nachsehen" ? (
              <>Es werden <b>keine neuen Mails</b> geschickt — wir sehen nur nach,
              was von vorhin schon bei Brevo liegt.</>
            ) : (
              <>Alle {anzahl} Probemails gehen sofort hintereinander raus. Danach
              fragen wir <b>alle 30 Sekunden</b> bei Brevo nach, bis zu 4 Minuten —
              Brevo trägt Zustellungen mit 1–3 Minuten Verzug ein.</>
            )}
            {" "}Läuft seit <b className="tabular-nums">{verstrichen} s</b>.
            {verstrichen > 40 && (
              <> Nächste Nachfrage in{" "}
                <b className="tabular-nums">{30 - (verstrichen % 30)} s</b>.</>
            )}
          </p>
          <p className="mt-1 text-[11.5px] text-slate-400">
            Fenster offen lassen. Ein Abbruch verwirft nur die Anzeige — die
            Zweige bleiben, wie sie sind.
          </p>
        </div>
      )}

      {erg && !erg.ok && (
        <p className="mt-4 px-3.5 py-3 rounded-xl text-[12.5px] font-semibold"
           style={{ background: "rgba(220,38,38,.07)", color: "#b91c1c" }}>
          {erg.error}
        </p>
      )}

      {erg?.ok && (
        <>
          <div className="mt-4 grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))" }}>
            {[
              ["bestätigt", erg.sauber, "#059669"],
              ["Zweig fehlt", erg.beanstandet, "#d97706"],
              // Der dritte Zustand. Er zählt NICHT als „ohne Zweig" — über
              // diese Zweige ist nichts gesagt, weil die Prüfung nicht lief.
              ["Prüfung gestört", erg.gestoert ?? gestoerte.length, "#7c3aed"],
              ["geprüft", erg.gepruefte, "#64748b"],
              // Nur zeigen, wenn es welche gibt — eine Null-Kachel ist Rauschen.
              ...(Number(erg.veraltet ?? veraltete.length) > 0
                ? [["veraltet (darf weg)", erg.veraltet ?? veraltete.length, "#94a3b8"] as [string, number, string]]
                : []),
            ].map(([t, w, f]) => (
              <div key={String(t)} className="px-3.5 py-3 rounded-xl"
                   style={{ background: `${f}0f`, boxShadow: `inset 0 0 0 1px ${f}2e` }}>
                <p className="text-[22px] font-bold leading-none tabular-nums" style={{ color: String(f) }}>
                  {String(w)}
                </p>
                <p className="text-[11.5px] font-semibold mt-1" style={{ color: String(f) }}>{String(t)}</p>
              </div>
            ))}
          </div>

          {erg.brevo && (() => {
            // ── DIE FARBE SAGT, WER DEN FEHLER HAT ──────────────────────
            // Violett = wir (Programmfehler). Bernstein = Einstellung oder
            // Brevo. Dieselbe Farbe für beides hätte den Betreiber wieder in
            // Make suchen lassen.
            const wirSchuld = erg.brevo.wer === "wir";
            const ton = wirSchuld ? "#7c3aed" : "#d97706";
            const dunkel = wirSchuld ? "#5b21b6" : "#92400e";
            return (
              <div className="mt-3 px-3.5 py-3 rounded-xl"
                   style={{ background: `${ton}14`, boxShadow: `inset 0 0 0 1px ${ton}38` }}>
                <p className="text-[12.5px] font-bold" style={{ color: dunkel }}>
                  {wirSchuld && (
                    <span className="mr-1.5 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-[.08em]"
                          style={{ background: `${ton}22`, color: dunkel }}>
                      unser Fehler
                    </span>
                  )}
                  {erg.brevo.titel}
                </p>
                {(erg.brevo.anleitung ?? []).map((a: string, i: number) => (
                  <p key={i} className="text-[12px] mt-1 leading-relaxed" style={{ color: dunkel }}>· {a}</p>
                ))}
                {erg.brevo.roh && (
                  <details className="mt-2">
                    <summary className="text-[11.5px] font-semibold cursor-pointer" style={{ color: dunkel }}>
                      Vollständige Antwort von Brevo
                    </summary>
                    {/* Der Auftrag verlangt sie ausdrücklich aufklappbar: Ohne
                        sie sucht der nächste Leser dieselbe Ursache von vorn. */}
                    <pre className="mt-1.5 p-2.5 rounded-lg text-[11px] overflow-x-auto whitespace-pre-wrap"
                         style={{ background: "rgba(15,23,42,.05)", color: "#334155" }}>
                      {erg.brevo.roh}
                    </pre>
                  </details>
                )}
              </div>
            );
          })()}

          {/* ── DIE VERALTETEN: ERLEDIGT, NICHT OFFEN ───────────────────── */}
          {veraltete.length > 0 && (
            <div className="mt-3 px-3.5 py-3 rounded-xl"
                 style={{ background: "rgba(15,23,42,.04)" }}>
              <p className="text-[12px] font-bold text-slate-600">
                {veraltete.length} Ereignis{veraltete.length === 1 ? "" : "se"} ist veraltet und
                wird nicht mehr geprüft
              </p>
              {veraltete.map((z: any) => (
                <p key={z.event} className="text-[12px] text-slate-500 mt-1 leading-relaxed">
                  <code className="text-[11.5px]">{z.event}</code> — wird nie mehr gefeuert.
                  Der Zweig kann in Make <b>gelöscht</b> werden. Zählt in keiner Summe mit.
                </p>
              ))}
            </div>
          )}

          {/* ── DIE GESTÖRTEN GETRENNT AUFFÜHREN ────────────────────────── */}
          {gestoerte.length > 0 && (
            <div className="mt-3 px-3.5 py-3 rounded-xl"
                 style={{ background: "rgba(124,58,237,.07)", boxShadow: "inset 0 0 0 1px rgba(124,58,237,.2)" }}>
              <p className="text-[12px] font-bold" style={{ color: "#5b21b6" }}>
                Bei {gestoerte.length} Ereignis{gestoerte.length === 1 ? "" : "sen"} konnte nicht geprüft werden
              </p>
              <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "#5b21b6" }}>
                Das heißt <b>nicht</b>, dass diese Zweige fehlen — es heißt, dass wir es nicht
                nachsehen konnten. Sie stehen deshalb nicht in der Liste unten.
              </p>
            </div>
          )}

          {fehlende.length > 0 && (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[.1em] text-slate-500">
                  Diese Zweige fehlen in Make
                </p>
                <button type="button"
                        onClick={() => { void navigator.clipboard.writeText(liste); setKopiert(true); }}
                        className="fi-knopf-glas px-3 py-1.5 text-[11.5px]">
                  {kopiert ? "Kopiert" : "Liste kopieren"}
                </button>
              </div>
              <div className="mt-2 rounded-xl overflow-hidden" style={{ boxShadow: "inset 0 0 0 1px #eef2f7" }}>
                {fehlende.map((z: any) => (
                  <div key={z.event} className="px-3.5 py-2.5" style={{ borderBottom: "1px solid #f8fafc" }}>
                    <p className="text-[12.5px] font-semibold text-slate-800">
                      <span className="font-mono text-[#1d4ed8]">{z.event}</span>
                      {z.titel && <span className="ml-2 font-normal text-slate-500">{z.titel}</span>}
                    </p>
                    <p className="text-[11.5px] text-slate-500 leading-snug mt-0.5">
                      {/* BEIDE Ursachen nennen: Der Vorgesetzte kann von hier aus
                          nicht sehen, welche zutrifft — und eine falsche
                          Vermutung kostet ihn eine halbe Stunde in Make. */}
                      {z.text || "Keine Zustellung gemeldet. Entweder gibt es in Make keinen Zweig "
                        + "für diesen Typ — oder er existiert, hat aber die Mail nicht ausgelöst."}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          {fehlende.length === 0 && (
            <p className="mt-3 px-3.5 py-3 rounded-xl text-[12.5px] font-semibold"
               style={{ background: "rgba(5,150,105,.08)", color: "#047857" }}>
              Jeder Zweig hat geantwortet. Alle {erg.gepruefte} Ereignisse kommen beim Kunden an.
            </p>
          )}
        </>
      )}

      <FiaonEbene
        offen={frage}
        onZu={() => setFrage(false)}
        titel={`${anzahl} Probemails senden?`}
        ueberschrift="Bitte einmal bestätigen"
        breite={480}
        kinder={
          <>
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--fi-text-leise)" }}>
              Der Lauf sendet an <b>jeden</b> Ereignistyp eine Probemail — das sind{" "}
              <b>{anzahl} Mails</b> an{" "}
              <b style={{ fontFamily: "ui-monospace, monospace" }}>{testAdresse || "deine Testadresse"}</b>.
              Kunden bekommen nichts davon zu sehen; jede Mail trägt <code>test: true</code>.
            </p>
            <p className="mt-2.5 text-[12.5px] leading-relaxed" style={{ color: "var(--fi-text-still)" }}>
              {/* ── DIE ANGABE STAND AUF DER ALTEN LAUFZEIT ──────────────
                  Gefunden im Screenshot der Browser-Abnahme: Die
                  Fortschrittsleiste war schon umgestellt, dieser Dialog nicht.
                  Zwei Angaben derselben Zahl an zwei Stellen — die eine wurde
                  korrigiert, die andere vergessen. */}
              {/* ── ZUM ZWEITEN MAL DIESELBE FALLE ────────────────────────
                  Gestern stand hier „etwa 2 Minuten", während die Leiste schon
                  die neue Zeit nannte. Heute stand hier „34 Sekunden", während
                  der Lauf auf Polling umgestellt wurde.

                  Dieselbe Zahl an zwei Stellen wird einmal korrigiert
                  (AGENTS.md). Deshalb steht sie jetzt hier UND in der Leiste
                  aus derselben Rechnung — und der Prüfstand hält beide
                  gegeneinander. */}
              Der Lauf dauert <b>bis zu 4 Minuten</b>: Alle {anzahl} Mails gehen
              sofort hintereinander raus, danach fragen wir alle 30 Sekunden bei
              Brevo nach. Sind alle Zweige in Ordnung, ist er nach etwa einer
              Minute fertig — Brevo trägt Zustellungen mit 1–3 Minuten Verzug ein.
            </p>
            {!testAdresse && (
              <p className="mt-3 px-3.5 py-2.5 rounded-xl text-[12.5px] font-semibold"
                 style={{ background: "rgba(217,119,6,.08)", color: "#b45309" }}>
                Trag zuerst oben eine Testadresse ein — sonst weiß niemand, wohin die Mails gehen.
              </p>
            )}
          </>
        }
        fuss={
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setFrage(false)}
                    className="text-[13px] font-semibold" style={{ color: "var(--fi-text-still)" }}>
              Abbrechen
            </button>
            <button type="button" onClick={() => void starten()} disabled={!testAdresse}
                    className="ml-auto fi-knopf-primaer px-5">
              {anzahl} Probemails senden
            </button>
          </div>
        }
      />
    </div>
  );
}

/**
 * ══════════════════════════════════════════════════════════════════════════
 * DAS ZUSTELLPROTOKOLL — der Weg, den die Dashboard-Karte verspricht
 *
 * Die Karte „Zustellung heute" nennt die Zahl der Fehlschläge und verlinkt
 * hierher. Es gab dafür KEINE Anzeige: `mail-zentrale.tsx` verlinkte auf
 * „/admin/mail-protokoll", eine Seite, die nie existiert hat. Ein Link ins
 * Leere sieht wie eine Möglichkeit aus — schlimmer als kein Link.
 *
 * Vorgabe ist der Filter aus der Adresse (`?status=fehlgeschlagen`): Wer aus
 * der Karte kommt, will genau das sehen und nicht erst filtern.
 * ══════════════════════════════════════════════════════════════════════════
 */
function Zustellprotokoll() {
  const [status, setStatus] = useState<string>(
    () => new URLSearchParams(window.location.search).get("status") || "fehlgeschlagen",
  );
  const [daten, setDaten] = useState<any>(null);
  const [laedt, setLaedt] = useState(true);

  useEffect(() => {
    let weg = false;
    setLaedt(true);
    void fetch(`/api/fiaon/admin/mail/protokoll?status=${encodeURIComponent(status)}&tage=14`,
      { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (!weg) { setDaten(j?.ok ? j : null); setLaedt(false); } })
      .catch(() => { if (!weg) setLaedt(false); });
    return () => { weg = true; };
  }, [status]);

  const FILTER: { wert: string; text: string }[] = [
    { wert: "fehlgeschlagen", text: "Fehlgeschlagen" },
    { wert: "versandt", text: "Versandt" },
    { wert: "uebersprungen", text: "Übersprungen" },
    { wert: "alle", text: "Alle" },
  ];

  return (
    <section id="zustellung" className="a3-tafel mb-4">
      <header className="a3-tafel-kopf">
        <h2 className="text-[14px] font-bold text-slate-900">Zustellprotokoll — letzte 14 Tage</h2>
        <Tip text={"Jede Mail, die das Haus verlässt, steht hier — auch die, die NICHT rausging, mit Grund. "
          + "Die Empfängeradresse wird über die Person aufgelöst (aktuelle Adresse, dann früher benutzte). "
          + "Findet sich keine, wird nicht gesendet, und genau das steht dann hier."} />
      </header>

      <div className="p-3.5 sm:p-4">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {FILTER.map((f) => (
            <button key={f.wert} type="button" onClick={() => setStatus(f.wert)}
              className="px-2.5 py-1.5 rounded-lg border text-[11.5px] font-semibold"
              style={{
                borderColor: "var(--a3-linie,#e4e9f2)",
                background: status === f.wert ? ACCENT : "#fff",
                color: status === f.wert ? "#fff" : "#475569",
              }}>
              {f.text}
              {daten?.zahlen && f.wert !== "alle" && ` ${daten.zahlen[f.wert] ?? 0}`}
            </button>
          ))}
        </div>

        {laedt && <p className="text-[13px] text-slate-400">Wird geladen …</p>}
        {/* Ein Ladefehler wird angezeigt, nicht verschluckt — sonst steht hier
            ewig „Wird geladen" und niemand weiß, ob es etwas zu sehen gäbe. */}
        {!laedt && !daten && (
          <p className="text-[13px]" style={{ color: "#b45309" }}>
            Das Protokoll konnte nicht geladen werden. Bitte die Seite neu laden.
          </p>
        )}

        {daten && daten.gruende?.length > 0 && (
          <div className="mb-3 rounded-lg border px-3 py-2"
               style={{ borderColor: "var(--a3-linie,#e4e9f2)", background: "#fffbf5" }}>
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
              Woran es liegt
            </p>
            {daten.gruende.slice(0, 4).map((g: any) => (
              <p key={g.grund} className="mt-1 text-[12px] text-slate-700">
                <b className="tabular-nums">{g.anzahl}×</b> {g.grund}
              </p>
            ))}
          </div>
        )}

        {daten && daten.zeilen.length === 0 && (
          <p className="text-[13px] text-slate-500">
            {status === "fehlgeschlagen"
              ? "Keine fehlgeschlagene Mail in den letzten 14 Tagen."
              : "Keine Einträge in diesem Filter."}
          </p>
        )}

        {daten && daten.zeilen.length > 0 && (
          <ul className="space-y-1.5">
            {daten.zeilen.map((z: any) => (
              <li key={z.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 pl-3 text-[12px]"
                  style={{
                    borderLeft: `2px solid ${z.status === "fehlgeschlagen" ? "#b91c1c"
                      : z.status === "versandt" ? "#15803d" : "#94a3b8"}`,
                  }}>
                <span className="font-mono text-[11px] text-slate-500">{fmtTime(z.wann)}</span>
                <span className="font-semibold text-slate-800">{z.event}</span>
                <span className="text-slate-600">{z.empfaenger || "— keine Adresse —"}</span>
                {z.name && <span className="text-slate-500">{z.name}</span>}
                {z.grund && (
                  <span className="w-full sm:w-auto" style={{ color: "#b91c1c" }}>{z.grund}</span>
                )}
                {z.akte && (
                  <a href={z.akte} className="ml-auto text-[11.5px] font-semibold" style={{ color: ACCENT }}>
                    Akte
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default function AdminEventsPage() {
  const [data, setData] = useState<RegistryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [testEmail, setTestEmail] = useState(() => localStorage.getItem(LS_KEY) || "");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [payloads, setPayloads] = useState<Record<string, string>>({});
  const [refInputs, setRefInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [preview, setPreview] = useState<RealPreview | null>(null);
  const [pruefeLaeuft, setPruefeLaeuft] = useState<string | null>(null);

  /**
   * Zweig prüfen: Testversand raus, dann bei Brevo nachsehen.
   *
   * Das kann bis zu drei Minuten dauern — Make arbeitet asynchron, Brevo
   * protokolliert verzögert. Der Knopf sagt das, statt so zu tun, als ginge
   * es sofort.
   */
  const zweigPruefen = useCallback(async (typ: string) => {
    setPruefeLaeuft(typ);
    const r = await fetch(`/api/fiaon/admin/mail/registry/${encodeURIComponent(typ)}/pruefen`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testAdresse: testEmail }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setPruefeLaeuft(null);
    setResults((m) => ({ ...m, [typ]: { ok: !!j?.bestaetigt, text: j?.text || j?.error || "Prüfung nicht möglich." } }));
    load();
  }, [testEmail]);

  const load = useCallback(() => {
    fetch("/api/fiaon/admin/events/registry", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) {
          setData(j);
          setPayloads((prev) => {
            const next = { ...prev };
            for (const e of j.events as EventDef[]) {
              if (!next[e.type]) next[e.type] = JSON.stringify(e.example, null, 2);
            }
            return next;
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { localStorage.setItem(LS_KEY, testEmail); }, [testEmail]);

  const setResult = (type: string, ok: boolean, text: string) => setResults((m) => ({ ...m, [type]: { ok, text } }));

  const sendTest = async (ev: EventDef) => {
    let payload: Record<string, unknown> | undefined;
    try {
      payload = JSON.parse(payloads[ev.type] || "{}");
    } catch {
      setResult(ev.type, false, "Payload ist kein gültiges JSON");
      return;
    }
    setBusy(`test:${ev.type}`);
    try {
      const res = await fetch("/api/fiaon/admin/events/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ eventType: ev.type, email: testEmail.trim(), payload }),
      });
      const j = await res.json().catch(() => null);
      if (res.ok && j?.ok) {
        setResult(ev.type, j.sent, j.sent ? `Test gesendet an ${testEmail.trim()} — ${fmtTime(j.at)}` : "Make hat den Webhook nicht angenommen (Log prüfen)");
        load();
      } else {
        setResult(ev.type, false, j?.error || `HTTP ${res.status}`);
      }
    } catch {
      setResult(ev.type, false, "Netzwerkfehler");
    } finally {
      setBusy(null);
    }
  };

  const checkReal = async (ev: EventDef) => {
    const ref = (refInputs[ev.type] || "").trim();
    if (!ref) { setResult(ev.type, false, "Bitte Referenz eingeben"); return; }
    setBusy(`real:${ev.type}`);
    try {
      const res = await fetch("/api/fiaon/admin/events/send-real", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ eventType: ev.type, paymentRef: ref, dryRun: true }),
      });
      const j = await res.json().catch(() => null);
      if (res.ok && j?.ok) {
        setPreview({ eventType: ev.type, customer: j.customer, email: j.email, status: j.status, payload: j.payload });
      } else {
        setResult(ev.type, false, j?.error || `HTTP ${res.status}`);
      }
    } catch {
      setResult(ev.type, false, "Netzwerkfehler");
    } finally {
      setBusy(null);
    }
  };

  const confirmReal = async () => {
    if (!preview) return;
    const ref = (refInputs[preview.eventType] || "").trim();
    setBusy(`confirm:${preview.eventType}`);
    try {
      const res = await fetch("/api/fiaon/admin/events/send-real", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ eventType: preview.eventType, paymentRef: ref }),
      });
      const j = await res.json().catch(() => null);
      if (res.ok && j?.ok) {
        setResult(preview.eventType, j.sent, j.sent ? `An echten Kunden gesendet: ${j.customer} (${j.email}) — ${fmtTime(j.at)}` : "Make hat den Webhook nicht angenommen");
        load();
      } else {
        setResult(preview.eventType, false, j?.error || `HTTP ${res.status}`);
      }
    } catch {
      setResult(preview.eventType, false, "Netzwerkfehler");
    } finally {
      setBusy(null);
      setPreview(null);
    }
  };

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail.trim());

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <PageIntro
        id="events"
        title="E-Mail-Events (Make)"
        subtitle="Hier testest du jede automatische Kunden-Mail und siehst, welcher Event-Typ zuletzt (oder noch nie) gefeuert hat."
        steps={[
          "Jede Zeile ist ein Event-Typ aus dem Code (z. B. payment_confirmed). „Noch nie gefeuert“ heißt: Make kennt die Struktur noch nicht — vor dem Anlegen eines neuen Make-Zweigs hier einmal testen.",
          "„Test senden“ schickt das Event mit Beispieldaten an DEINE Test-Adresse (test: true) — es löst keinen echten Workflow aus.",
          "„Für echten Kunden senden“ nutzt die ECHTEN Kundendaten — mit Vorschau und Bestätigung. Vorsicht bei payment_reminder: das zählt als echte Erinnerung.",
          "Steht oben „Seit X Stunden kein Lead-Eingang“ im Dashboard, prüfe hier zuerst, ob der Make-Webhook konfiguriert ist und Events ankommen.",
        ]}
      />

      {/* ══════════════════════════════════════════════════════════════════
          DIE ARBEITSFLÄCHE NACH OBEN, DAS NACHSCHLAGEWERK NACH UNTEN
          (21.08.2026)

          Hier stand `<Zustellprotokoll />` — als ERSTES, direkt unter der
          Einleitung. Der Betreiber musste an einer 14-Tage-Liste vorbeiscrollen,
          um an „Alle Zweige prüfen" und die Ereignisliste zu kommen. Das sind
          die beiden Dinge, für die er die Seite öffnet.

          Neue Ordnung: (1) Ampel und Prüfknopf, (2) die Ereignisse, (3) ganz
          unten das Protokoll zum Nachschlagen. Ein Sprunganker im Kopf führt
          direkt hin, für die Fälle, in denen er wirklich nachschlagen will.
          ══════════════════════════════════════════════════════════════════ */}

      {/* ══════════════════════════════════════════════════════════════════
          ALLE ZWEIGE PRÜFEN
          Der Server konnte das seit dem 11.08. — nur klicken konnte es
          niemand. Der Prüfstand von damals sah ausschließlich in den
          SERVERQUELLTEXT („die Route existiert") und war grün, während die
          Funktion für einen Menschen unerreichbar war.

          Daraus die Regel, die jetzt in AGENTS.md steht: Eine Funktion gilt
          erst als geliefert, wenn ein Browsertest den KNOPF findet und
          drückt.
          ══════════════════════════════════════════════════════════════════ */}
      <AlleZweigePruefen anzahl={data?.events?.length ?? 0}
                         testAdresse={testEmail}
                         onFertig={() => void load()} />

      {/* ══════════════════════════════════════════════════════════════════
          DIE AMPEL KANN NICHT GRÜN WERDEN, WENN DER SCHLÜSSEL FEHLT
          (20.08.2026)

          ── WAS DER BETREIBER ERLEBT HAT ────────────────────────────────
          Er hat alle Zweige in Make von Hand geprüft. Die Mails kommen an.
          Trotzdem stand hier bei jedem Ereignis eine gelbe Marke
          „nicht bestätigt" — und keine Erklärung, was ihm fehlt.

          ── DIE URSACHE ─────────────────────────────────────────────────
          Die Bestätigung läuft über die Brevo-API: Ein Versand gilt als
          bewiesen, wenn Brevo die Zustellung meldet (fiaon-zustellung.ts).
          Ohne BREVO_API_KEY läuft dieser Abgleich NIE — GEMESSEN: 10.431
          Mails in 30 Tagen, 0 abgeglichen, 0 von 35 Zweigen bestätigt.

          Die Ampel war also nicht gelb, weil etwas kaputt ist, sondern weil
          sie nichts messen KANN. Das ist ein Unterschied, und er muss
          dastehen — sonst sucht der Betreiber einen Fehler, den es nicht gibt.

          ── WARUM DIESE KARTE GANZ OBEN STEHT ───────────────────────────
          Weil sie jede andere Anzeige auf dieser Seite relativiert. Wer sie
          nicht liest, hält 35 gelbe Marken für 35 Probleme.
          ══════════════════════════════════════════════════════════════════ */}
      {/* ── SPRUNGANKER ────────────────────────────────────────────────────
          Das Protokoll steht jetzt unten. Wer wirklich nachschlagen will,
          soll nicht scrollen müssen. */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <a href="#zustellprotokoll"
           className="fi-knopf-glas px-3.5 py-2 text-[12px] no-underline">
          Zum Zustellprotokoll ↓
        </a>
        <span className="text-[11.5px] text-slate-400">
          Die Arbeitsfläche steht oben, das Nachschlagewerk unten.
        </span>
      </div>

      {data && !data.brevoKonfiguriert && (
        <div className="mb-5 rounded-2xl p-4 sm:p-5"
             style={{ background: "linear-gradient(180deg,rgba(217,119,6,.09),rgba(217,119,6,.03))",
                      boxShadow: "inset 0 0 0 1px rgba(217,119,6,.3)" }}>
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: "#b45309" }} />
            <div className="min-w-0">
              <h2 className="text-[14.5px] font-bold" style={{ color: "#92400e" }}>
                Bestätigung inaktiv: BREVO_API_KEY fehlt in der Umgebung
              </h2>
              <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: "#92400e" }}>
                Die gelben Marken unten bedeuten <b>nicht</b>, dass Zweige fehlen. Sie bedeuten:
                Wir können es nicht nachprüfen. Die Bestätigung liest bei Brevo nach, ob eine
                Mail zugestellt wurde — ohne Schlüssel läuft dieser Abgleich nie.
              </p>
              <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: "#92400e" }}>
                <b>Gemessen:</b> 10.431 Mails in 30 Tagen, davon 0 abgeglichen — und deshalb
                0 von {data.events?.length ?? "…"} Zweigen bestätigt, obwohl die Mails ankommen.
              </p>
              <p className="mt-2.5 text-[12.5px] leading-relaxed font-semibold" style={{ color: "#78350f" }}>
                Zu tun: <code>BREVO_API_KEY</code> in den Umgebungsvariablen des Deployments
                eintragen. Danach bestätigt sich die Ampel selbst — bei jeder echten
                Zustellung, ohne dass jemand einen Knopf drücken muss.
              </p>
            </div>
          </div>
        </div>
      )}

      {data && !data.makeWebhookConfigured && (
        <div className="mb-5 px-4 py-3 rounded-xl border border-amber-300 bg-amber-50 text-[13px] text-amber-800 flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          <span><b>MAKE_WEBHOOK_URL ist nicht gesetzt</b> — Versand ist deaktiviert, bis die Umgebungsvariable im Deployment hinterlegt ist.</span>
        </div>
      )}

      {/* Test-Adresse */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-5 flex flex-wrap items-center gap-3">
        <FlaskConical size={16} className="text-slate-400 shrink-0" />
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-slate-700">Test-E-Mail-Adresse</p>
          <p className="text-[11px] text-slate-400">Ersetzt bei jedem Test-Versand das Feld <code className="font-mono">email</code>; zusätzlich wird <code className="font-mono">test: true</code> mitgesendet.</p>
        </div>
        <input
          type="email"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          placeholder="deine-admin@adresse.de"
          className="ml-auto w-full sm:w-72 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 outline-none text-[13px]"
        />
      </div>

      {/* T3: Diagnose */}
      <section className="mb-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400 mb-2.5">Webhook-Diagnose — letzter erfolgreicher Versand je Event</h2>
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Event", "Beschreibung", "Letzter Versand", ""].map((h, i) => (
                    <th key={i} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={4} className="px-4 py-8 text-center text-[13px] text-slate-400">Lädt …</td></tr>}
                {data?.events.map((ev) => {
                  const last = data.lastEvents[ev.type];
                  return (
                    <tr key={ev.type} className="border-b border-slate-50">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="text-[12px] font-mono font-semibold text-slate-800">{ev.type}</span>
                        {ev.deprecated && <span className="ml-2 px-1.5 py-0.5 rounded border border-slate-300 text-[10px] font-bold text-slate-500 uppercase">veraltet</span>}
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-slate-500 max-w-[340px]">{ev.label}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {last ? (
                          <span className="text-[12px] text-slate-700 tabular-nums">{fmtTime(last)}</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-[11px] font-semibold text-amber-700">noch nie gesendet</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setExpanded(expanded === ev.type ? null : ev.type); }}
                          className="text-[12px] font-semibold hover:underline"
                          style={{ color: ACCENT }}
                        >
                          {expanded === ev.type ? "Schließen" : "Testen"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* T1/T2: Event-Karten */}
      <section className="mb-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400 mb-2.5">Event-Katalog — Payload prüfen und senden</h2>
        <div className="space-y-2.5">
          {data?.events.map((ev) => {
            const open = expanded === ev.type;
            const result = results[ev.type];
            return (
              <div key={ev.type} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setExpanded(open ? null : ev.type); }}
                  className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-slate-50/60 transition-colors"
                >
                  {open ? <ChevronDown size={15} className="text-slate-400 shrink-0" /> : <ChevronRight size={15} className="text-slate-400 shrink-0" />}
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[13.5px] font-bold text-slate-900">{ev.label}</span>
                      <span className="text-[11px] font-mono text-slate-400">{ev.type}</span>
                      {ev.deprecated && <span className="px-1.5 py-0.5 rounded border border-slate-300 text-[10px] font-bold text-slate-500 uppercase">veraltet</span>}
                      {ev.recommendationOnly && !ev.deprecated && (
                        <span className="px-1.5 py-0.5 rounded border border-violet-200 bg-violet-50 text-[10px] font-bold uppercase text-violet-700">Empfehlung</span>
                      )}
                      {ev.customerBound && !ev.deprecated && (
                        <span className="px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-[10px] font-bold uppercase" style={{ color: ACCENT }}>kundengebunden</span>
                      )}
                      {!ev.deprecated && ev.verifikation === "bestaetigt" && (
                        <span className="px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-[10px] font-bold uppercase text-emerald-700">Zweig bestätigt</span>
                      )}
                      {!ev.deprecated && ev.verifikation === "nicht_bestaetigt" && (
                        <span className="px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50 text-[10px] font-bold uppercase text-amber-700">nicht bestätigt</span>
                      )}
                      {!ev.deprecated && ev.verifikation === "ungeprueft" && (
                        <span className="px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-[10px] font-bold uppercase text-slate-500">ungeprüft</span>
                      )}
                    </span>
                    <span className="block text-[12px] text-slate-400 mt-0.5">{ev.description}</span>
                    {/* ── DER AUFRÄUM-HINWEIS (19.08.2026) ────────────────
                        „VERALTET" allein lässt den Betreiber rätseln, ob er den
                        Zweig in Make noch braucht. Bei followup_48h ist die
                        Antwort gemessen: null Versände, keine auslösende Stelle
                        im Quelltext. Also kann er weg — und das steht hier, wo
                        er die Entscheidung trifft, nicht in einem Changelog. */}
                    {ev.deprecated && (
                      <span className="block mt-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold leading-snug"
                            style={{ background: "rgba(100,116,139,.07)", color: "#475569",
                                     boxShadow: "inset 0 0 0 1px rgba(100,116,139,.16)" }}>
                        Zweig in Make kann gelöscht werden — wird nie mehr gefeuert.
                      </span>
                    )}
                  </span>
                </button>

                {open && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-100">
                    {/* ── GEMESSEN, NICHT BEHAUPTET ─────────────────────
                        Hier stand bis zum 09.08.2026 eine Warnung über einen
                        angeblich fehlenden Zweig
                        — ausgelöst davon, dass in unserer eigenen
                        Beschreibung das Wort „Vorgesetzten-TODO" vorkam. 23 von
                        33 Ereignissen waren so gekennzeichnet, obwohl alle 21
                        Zweige aktiv waren. */}
                    {!ev.deprecated && (
                      <div className="mt-3 px-3.5 py-2.5 rounded-xl border text-[12px] leading-relaxed"
                           style={ev.verifikation === "bestaetigt"
                             ? { borderColor: "#a7f3d0", background: "#ecfdf5", color: "#065f46" }
                             : { borderColor: "#e2e8f0", background: "#f8fafc", color: "#475569" }}>
                        {ev.verifikationsText}
                        {ev.verifikation !== "bestaetigt" && (
                          <button type="button" onClick={() => void zweigPruefen(ev.type)}
                                  disabled={pruefeLaeuft === ev.type}
                                  className="ml-2 font-bold underline disabled:opacity-50">
                            {pruefeLaeuft === ev.type ? "prüft … (etwa 30 Sekunden)" : "Zweig prüfen"}
                          </button>
                        )}
                        {ev.recommendationOnly && <><br />Für dieses Ereignis löst der Code noch keinen automatischen Versand aus — es lässt sich aber testen.</>}
                      </div>
                    )}
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5 mt-3">Payload (editierbar — Beispielwerte vorausgefüllt)</p>
                    <textarea
                      value={payloads[ev.type] || ""}
                      onChange={(e) => setPayloads((m) => ({ ...m, [ev.type]: e.target.value }))}
                      rows={Math.min(12, (payloads[ev.type] || "").split("\n").length + 1)}
                      spellCheck={false}
                      className="w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-slate-50 font-mono text-[12px] leading-relaxed focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 outline-none"
                    />
                    <div className="flex flex-wrap items-center gap-2.5 mt-3">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); sendTest(ev); }}
                        disabled={!emailValid || busy != null || !data?.makeWebhookConfigured}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[13px] font-semibold disabled:opacity-40 transition-opacity"
                        style={{ background: ACCENT }}
                        title={!emailValid ? "Erst Test-E-Mail-Adresse oben eintragen" : undefined}
                      >
                        <Send size={13} /> {busy === `test:${ev.type}` ? "Sendet …" : "Test an Make senden"}
                      </button>

                      {ev.customerBound && !ev.deprecated && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            type="text"
                            value={refInputs[ev.type] || ""}
                            onChange={(e) => setRefInputs((m) => ({ ...m, [ev.type]: e.target.value }))}
                            placeholder="Zahlungs- oder Antragsreferenz"
                            className="w-56 px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono text-[12px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 outline-none"
                          />
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); checkReal(ev); }}
                            disabled={busy != null}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 text-[13px] font-semibold text-slate-700 hover:border-slate-400 disabled:opacity-40 transition-colors"
                          >
                            <User size={13} /> {busy === `real:${ev.type}` ? "Prüft …" : "Für echten Kunden senden"}
                          </button>
                        </div>
                      )}
                    </div>

                    {result && (
                      <p className={`mt-3 text-[12.5px] font-semibold flex items-center gap-1.5 ${result.ok ? "text-emerald-600" : "text-red-600"}`}>
                        {result.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />} {result.text}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Verlauf */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400 mb-2.5">Verlauf — letzte {data?.history.length ?? 0} Sends über die Konsole</h2>
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {(!data || data.history.length === 0) ? (
            <p className="px-4 py-6 text-center text-[13px] text-slate-400">Noch keine Test-Sends.</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Zeit", "Event", "Empfänger", "Modus", "Status"].map((h, i) => (
                    <th key={i} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.history.map((h, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="px-4 py-2.5 text-[12px] text-slate-500 tabular-nums whitespace-nowrap">{fmtTime(h.at)}</td>
                    <td className="px-4 py-2.5 text-[12px] font-mono font-semibold text-slate-800 whitespace-nowrap">{h.event}</td>
                    <td className="px-4 py-2.5 text-[12px] text-slate-600 break-all">{h.email}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${h.mode === "real" ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-500"}`}>
                        {h.mode === "real" ? "Echter Kunde" : "Test"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {h.ok
                        ? <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-600"><CheckCircle2 size={13} /> OK</span>
                        : <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-red-600"><XCircle size={13} /> Fehler</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          DAS PROTOKOLL — GANZ UNTEN, ZUM NACHSCHLAGEN
          Es stand vorher als ERSTES auf der Seite. Der Betreiber scrollte an
          einer 14-Tage-Liste vorbei, um an die Arbeitsfläche zu kommen.
          ══════════════════════════════════════════════════════════════════ */}
      <div id="zustellprotokoll" className="mt-8 pt-2" style={{ scrollMarginTop: 84 }}>
        <Zustellprotokoll />
      </div>

      {/* Bestätigungsdialog „Für echten Kunden senden" */}
      {preview && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4" onClick={() => setPreview(null)}>
          <div className="absolute inset-0 bg-slate-900/40" />
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={17} className="text-amber-500" />
              <h3 className="text-[15px] font-bold text-slate-900">Der Kunde erhält wirklich diese E-Mail</h3>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 mb-4 text-[13px] space-y-1">
              <p><span className="text-slate-400">Event:</span> <span className="font-mono font-semibold">{preview.eventType}</span></p>
              <p><span className="text-slate-400">Kunde:</span> <span className="font-semibold">{preview.customer}</span></p>
              <p><span className="text-slate-400">E-Mail:</span> <span className="font-semibold break-all">{preview.email}</span></p>
              <p><span className="text-slate-400">Status:</span> <span className="font-semibold">{preview.status}</span></p>
            </div>
            <p className="text-[12px] text-slate-500 mb-4">
              Es werden die echten Kundendaten gesendet (kein <code className="font-mono">test</code>-Feld) — Make löst die reale E-Mail aus.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setPreview(null); }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:border-slate-300 transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); confirmReal(); }}
                disabled={busy != null}
                className="px-4 py-2.5 rounded-xl text-white text-[13px] font-semibold disabled:opacity-40"
                style={{ background: ACCENT }}
              >
                {busy?.startsWith("confirm:") ? "Sendet …" : "Ja, an Kunden senden"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
