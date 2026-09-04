import { useCallback, useEffect, useMemo, useState } from "react";
import { AgentShell, api } from "./shared";
import { Reveal } from "./motion";
import { Skelett, useToast } from "@/lib/fiaon-ui";
import { ZeichenHaken } from "@/lib/fiaon-zeichen";
import { LageTafel } from "./vertrieb-service";
import { ZusageTafel } from "./vertrieb-zusage";
import { OnboardingCockpit } from "@/components/agent/OnboardingCockpit";
import { anrufStarten } from "@/components/Softphone";

// ═══════════════════════════════════════════════════════════════════════════
// /agent/startgespraeche — der Onboarding-Bereich
//
// Fünfzehn Minuten mit einem Menschen, der gerade bezahlt hat. Diese Seite
// beantwortet dafür genau zwei Fragen: Wen spreche ich heute? Und was weiß das
// System schon über ihn?
//
// Was hier NICHT steht: Umsätze, Provisionen, Vertriebslisten, andere Kunden.
// Der Server liefert sie nicht aus (404/403), und die Seite fragt nicht danach.
// ═══════════════════════════════════════════════════════════════════════════

interface Termin {
  id: number;
  personId: number;
  name: string;
  vorname: string | null;
  telefon: string | null;
  email: string | null;
  beginn: string;
  datum: string;
  datumText: string;
  uhrzeit: string;
  dauerMin: number;
  status: string;
  notiz: string | null;
  heute: boolean;
  vorbei: boolean;
  /** Wann wurde er abgeschlossen? Steht als Datum an der Erledigt-Marke. */
  erledigtAm?: string | null;
  /** Vom Kunden abgesagt — bleibt sieben Tage sichtbar, aber nie unter „Offen". */
  abgesagtAm?: string | null;
  quelle?: string | null;
  /** Die Art aus `shared/fiaon-termin-art.ts` — Onboarding, Vertrieb, Rückruf. */
  terminArt?: string | null;
  terminArtText?: string | null;
  terminArtTon?: string | null;
}

/** Uhrzeit in Europe/Berlin — nie über `toISOString` (AGENTS.md). */
function uhrzeitVon(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

/** Tag und Uhrzeit für den Verlauf — kurz, in Berliner Zeit. */
function uhrzeitTag(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

interface Kennzahlen {
  dieseWoche: number; offen: number; erledigt: number; verpasst: number;
  erledigungsquote: number | null; noShowQuote: number | null;
  /** Neu: der Kennzahlen-Kopf des Bereichs (Teil 2.4). */
  heuteGeplant?: number; heuteErledigt?: number; heuteNoShow?: number;
  dauerSchnittMin?: number | null; freigeschaltetWoche?: number;
  /** Die beiden Zahlen, die den Zweck des Bereichs messen (22.08.2026). */
  wartend?: number; wartendOhneTermin?: number;
}

/** Ein Wartender: bezahlt, Konto eingeschränkt, noch kein geführtes Startgespräch. */
interface Wartender {
  personId: number; name: string; vorname: string | null; telefon: string | null; email: string | null;
  ref: string | null; paket: string | null; bezahltAm: string | null; tage: number | null;
  terminAm: string | null; eingeladenAm: string | null; spaeterAm: string | null; verpasst: number;
}

export default function AgentStartgespraecheSeite() {
  return <AgentShell><Inhalt /></AgentShell>;
}

function Inhalt() {
  const { zeige } = useToast();
  const [termine, setTermine] = useState<Termin[]>([]);
  const [zahlen, setZahlen] = useState<Kennzahlen | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [keinZugang, setKeinZugang] = useState(false);
  const [zusageOffen, setZusageOffen] = useState(false);
  const [ansicht, setAnsicht] = useState<"liste" | "kalender">("liste");
  /** Offen oder erledigt — der Reiter, der Teil 9 beantwortet. */
  const [reiter, setReiter] = useState<"offen" | "erledigt" | "wartende">("offen");
  const [offen, setOffen] = useState<number | null>(null);
  // ── DIE GESPRÄCHSBÜHNE ──────────────────────────────────────────────────
  // Ein Startgespräch wird GEFÜHRT, nicht abgehakt. Das Cockpit hat die Agenda,
  // die Uhr, den Anrufen-Knopf und den einen Abschluss-Knopf, der freischaltet.
  const [cockpit, setCockpit] = useState<Termin | null>(null);

  const laden = useCallback(async () => {
    const r = await api("/agent/startgespraeche".replace("/startgespraeche", "/onboarding/termine"));
    if (r.status === 404) { setKeinZugang(true); setLaedt(false); return; }
    if (r.status === 403 && r.json?.code === "zusage_erforderlich") { setZusageOffen(true); setLaedt(false); return; }
    if (r.ok) setTermine(r.json.termine || []);
    const k = await api("/agent/onboarding/kennzahlen");
    if (k.ok) setZahlen(k.json);
    setLaedt(false);
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  // ══════════════════════════════════════════════════════════════════════════
  // OFFEN UND ERLEDIGT SIND ZWEI LISTEN (19.08.2026)
  //
  // ── DIE MELDUNG (Onboarding) ────────────────────────────────────────────
  // „Kunden, die ich bereits erreicht und vollständig bearbeitet habe, bleiben
  // weiterhin in meiner Liste. Dadurch ist nicht eindeutig erkennbar, ob der
  // Vorgang vom System tatsächlich als erledigt erfasst wurde."
  //
  // ── DER BEFUND ──────────────────────────────────────────────────────────
  // Der Filter lautete `x.status === "gebucht" || x.heute`. Das zweite Glied
  // holte JEDEN heutigen Termin zurück — auch den erledigten. Im Screenshot
  // vom 19.08.2026 stand „Bereits Erledigt Testfall" mitten in der Liste
  // „HEUTE", in derselben Karte, mit demselben Knopf wie der offene Termin.
  // Ein graues Wort „erledigt" hinter der Rufnummer war der ganze Unterschied.
  //
  // GEMESSEN in `fiaon_termine` (30 Tage, Quelle onboarding_call): 13 gebucht,
  // 7 erledigt, 2 verpasst, 2 abgesagt. Die 7 standen alle in der Tagesliste.
  //
  // Und es war schon einmal dieselbe Klasse: In der Termin-Leiste fehlte der
  // `erledigt_am`-Filter. Deshalb steht die Trennung jetzt in EINER Ableitung,
  // und ein Reiter macht sie sichtbar — ein Vorgang, der verschwindet, ohne
  // irgendwo aufzutauchen, sieht wie Datenverlust aus.
  // ══════════════════════════════════════════════════════════════════════════
  const istErledigt = (t: Termin) =>
    t.status === "erledigt" || t.status === "verpasst" || !!t.erledigtAm || !!t.abgesagtAm;

  const offeneTermine = useMemo(() => termine.filter((t) => !istErledigt(t)), [termine]);
  const erledigteTermine = useMemo(
    () => termine.filter(istErledigt)
      .sort((a, b) => +new Date(b.erledigtAm ?? b.beginn) - +new Date(a.erledigtAm ?? a.beginn)),
    [termine],
  );

  /** Nach Tagen gruppieren — der Kalenderblick ist eine Tagesspalte, keine Matrix. */
  const tage = useMemo(() => {
    const map = new Map<string, Termin[]>();
    for (const t of (reiter === "erledigt" ? erledigteTermine : offeneTermine)) {
      const l = map.get(t.datum) || [];
      l.push(t);
      map.set(t.datum, l);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [offeneTermine, erledigteTermine, reiter]);

  if (zusageOffen) {
    return (
      <ZusageTafel
        basis="/agent/onboarding/zusage"
        onAngenommen={() => { setZusageOffen(false); setLaedt(true); void laden(); }}
      />
    );
  }

  if (keinZugang) {
    return (
      <div className="fi-karte p-8 text-center max-w-lg mx-auto">
        <p className="text-[15px] font-semibold">Nicht gefunden.</p>
        <p className="text-[13px] mt-1.5" style={{ color: "var(--fi-text-still)" }}>
          Diese Seite gibt es für dein Konto nicht.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-24 md:pb-10">
      <div className="mx-auto" style={{ maxWidth: "var(--fi-breite-max)" }}>
        <Reveal index={0}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight leading-tight">
                <span className="fi-gradient-text">Startgespräche</span>
              </h1>
              <p className="mt-1 text-[13px]" style={{ color: "var(--fi-text-leise)" }}>
                Fünfzehn Minuten, in denen ein Kunde das System einmal erklärt bekommt.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {(["liste", "kalender"] as const).map((a) => (
                <button key={a} type="button" onClick={() => setAnsicht(a)}
                        className="px-3 py-1.5 rounded-xl text-[12.5px] font-semibold"
                        style={ansicht === a
                          ? { background: "var(--fi-primaer)", color: "#fff" }
                          : { background: "#fff", border: "1px solid var(--fi-linie)", color: "var(--fi-text-leise)" }}>
                  {a === "liste" ? "Liste" : "Kalender"}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        {/* ── Kennzahlen ─────────────────────────────────────────────────── */}
        <Reveal index={1}>
          <div className="mt-4 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
            {[
              { t: "Heute geplant", w: zahlen?.heuteGeplant ?? 0,
                h: "Startgespräche, die HEUTE stattfinden sollen. Die Zahl, mit der der Tag anfängt." },
              { t: "Heute erledigt", w: zahlen?.heuteErledigt ?? 0,
                h: "Heute geführte Gespräche. Jedes davon hat ein Konto freigeschaltet." },
              { t: "Nicht erschienen", w: zahlen?.heuteNoShow ?? 0,
                h: "Heute nicht erschienen. Diese Kunden werden automatisch erneut eingeladen." },
              // ── DIE ZWEI ZAHLEN, DIE DEN ZWECK MESSEN (22.08.2026) ──────
              // Sie wurden berechnet und weggeworfen; stattdessen standen
              // „Ø Dauer" und „Erledigungsquote" da. Ein Onboarder sah drei
              // Termine und wusste nicht, dass 213 Menschen auf ihn warten.
              { t: "Wartet auf Gespräch", w: zahlen?.wartend ?? 0,
                h: "Bezahlte Kunden, deren Konto bis zum Startgespräch eingeschränkt bleibt — hausweit. Das ist der Arbeitsvorrat." },
              { t: "Davon ohne Termin", w: zahlen?.wartendOhneTermin ?? 0,
                h: "Wartende, die noch keinen Termin gewählt haben. Unter „Wartende“ lassen sie sich einladen oder anrufen." },
              { t: "Freigeschaltet (7 Tage)", w: zahlen?.freigeschaltetWoche ?? 0,
                h: "Konten, die in den letzten sieben Tagen nach dem Startgespräch voll freigeschaltet wurden." },
            ].map((f) => (
              <div key={f.t} className="fi-karte p-4" title={f.h}>
                <p className="text-[10.5px] font-semibold uppercase tracking-[.08em]" style={{ color: "var(--fi-text-still)" }}>
                  {f.t}
                </p>
                {zahlen ? (
                  <p className="text-[24px] font-bold leading-none mt-1.5 fi-zahl">{f.w ?? 0}</p>
                ) : <Skelett h={26} w={48} className="mt-1.5" />}
              </div>
            ))}
          </div>
        </Reveal>

        {/* ══════════════════════════════════════════════════════════════════
            DIE REITER — OFFEN UND ERLEDIGT

            Erledigte verschwinden aus der Arbeitsliste, aber nicht aus dem
            System. Der Reiter mit Zähler sagt beides: wie viele noch offen sind
            und dass die anderen erfasst wurden.
            ══════════════════════════════════════════════════════════════════ */}
        <div className="mt-5 flex items-center gap-1.5" data-fiaon="onboarding-reiter">
          {([
            ["offen", "Offen", offeneTermine.length],
            ["erledigt", "Erledigt", erledigteTermine.length],
            ["wartende", "Wartende", zahlen?.wartendOhneTermin ?? 0],
          ] as const).map(([k, label, n]) => (
            <button key={k} type="button" onClick={() => setReiter(k)}
                    data-fiaon={`reiter-${k}`}
                    className="px-3 py-1.5 rounded-xl text-[12.5px] font-semibold"
                    style={reiter === k
                      ? { background: "var(--fi-primaer)", color: "#fff" }
                      : { background: "#fff", border: "1px solid var(--fi-linie)", color: "var(--fi-text-leise)" }}>
              {label} <span className="fi-zahl">{n}</span>
            </button>
          ))}
        </div>

        {reiter === "wartende" && <WartendeListe onGeaendert={() => void laden()} />}

        {/* ── Termine ────────────────────────────────────────────────────── */}
        {reiter !== "wartende" && <div className="mt-3 space-y-3">
          {laedt && [0, 1].map((i) => <div key={i} className="fi-karte p-4"><Skelett h={20} /></div>)}

          {!laedt && tage.length === 0 && reiter === "erledigt" && (
            <div className="fi-karte p-6 text-center">
              <p className="text-[14px] font-semibold">Noch nichts abgeschlossen.</p>
              <p className="text-[12.5px] mt-1" style={{ color: "var(--fi-text-still)" }}>
                Geführte und verpasste Gespräche stehen hier — mit Häkchen und Uhrzeit.
              </p>
            </div>
          )}

          {!laedt && tage.length === 0 && reiter === "offen" && (
            <div className="fi-karte p-6 text-center">
              <p className="text-[14px] font-semibold">Kein offenes Startgespräch.</p>
              <p className="text-[12.5px] mt-1" style={{ color: "var(--fi-text-still)" }}>
                Bezahlte Kunden werden beim ersten Login eingeladen und wählen ihre Zeit selbst.
                Trag deine Erreichbarkeit unter „Mehr“ → „Profil“ ein, damit dort Zeiten stehen.
                {erledigteTermine.length > 0
                  && ` ${erledigteTermine.length} bereits bearbeitete stehen unter „Erledigt".`}
              </p>
            </div>
          )}

          {!laedt && ansicht === "kalender" && tage.length > 0 && (
            <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
              {tage.map(([datum, liste]) => (
                <div key={datum} className="fi-karte p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[.08em] mb-2.5"
                     style={{ color: liste[0].heute ? "#059669" : "var(--fi-text-still)" }}>
                    {liste[0].heute ? "Heute" : liste[0].datumText}
                  </p>
                  <div className="space-y-1.5">
                    {liste.map((t) => (
                      <button key={t.id} type="button" onClick={() => { setAnsicht("liste"); setOffen(t.id); }}
                              className="w-full text-left px-2.5 py-2 rounded-lg"
                              style={{ background: "var(--fi-seite)", border: "1px solid var(--fi-linie)" }}>
                        <span className="block text-[13px] font-bold fi-zahl">{t.uhrzeit}</span>
                        <span className="block text-[12px] truncate" style={{ color: "var(--fi-text-leise)" }}>{t.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!laedt && ansicht === "liste" && tage.map(([datum, liste]) => (
            <div key={datum}>
              <p className="text-[11px] font-semibold uppercase tracking-[.09em] mb-2 mt-4"
                 style={{ color: liste[0].heute ? "#059669" : "var(--fi-text-still)" }}>
                {liste[0].heute ? "Heute" : liste[0].datumText}
              </p>
              <div className="space-y-2.5">
                {liste.map((t, i) => (
                  <TerminKarte key={t.id} termin={t} index={i} offen={offen === t.id}
                               onOeffnen={() => setOffen(offen === t.id ? null : t.id)}
                               onFertig={laden} onCockpit={() => setCockpit(t)} zeige={zeige} />
                ))}
              </div>
            </div>
          ))}
        </div>}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          DIE GESPRÄCHSBÜHNE
          Sie liegt ÜBER der Seite, nicht statt ihr: Wer sie schließt, steht
          wieder in seiner Liste und hat den Überblick nicht verloren.
          ══════════════════════════════════════════════════════════════ */}
      {cockpit && (
        <OnboardingCockpit
          termin={{
            id: cockpit.id, personId: cockpit.personId, name: cockpit.name,
            telefon: cockpit.telefon ?? null, email: cockpit.email ?? null,
            beginn: cockpit.beginn, datumText: cockpit.datumText, uhrzeit: cockpit.uhrzeit,
            dauerMin: cockpit.dauerMin, status: cockpit.status,
          }}
          onZu={() => setCockpit(null)}
          onFertig={(meldung) => {
            setCockpit(null);
            zeige("erfolg", "Startgespräch abgeschlossen", meldung);
            void laden();
          }}
          // Das BESTEHENDE Softphone mit Kundenkontext — kein zweites Telefon
          // und kein selbst erfundenes Ereignis. `anrufStarten` ist der Weg,
          // den auch das Forderungsmanagement benutzt.
          onAnrufen={(nummer, personId, name) => { anrufStarten(nummer, personId, name); }}
        />
      )}
    </div>
  );
}

function TerminKarte({
  termin, index, offen, onOeffnen, onFertig, onCockpit, zeige,
}: {
  termin: Termin; index: number; offen: boolean;
  onOeffnen: () => void; onFertig: () => void; onCockpit: () => void;
  zeige: ReturnType<typeof useToast>["zeige"];
}) {
  const [notiz, setNotiz] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  /** Der Verlauf der PERSON — die eine Quelle für Notizen. */
  const [verlauf, setVerlauf] = useState<any[] | null>(null);
  const [notizFehler, setNotizFehler] = useState<string | null>(null);

  // Der Verlauf kommt, sobald die Karte aufgeht. Alle Haken stehen ÜBER dem
  // ersten `return` (AGENTS.md, zweimal in Softphone.tsx gelernt).
  useEffect(() => {
    if (!offen) return;
    let weg = false;
    void api(`/agent/onboarding/person/${termin.personId}/verlauf`).then((r) => {
      if (!weg) setVerlauf(r.ok ? (r.json.verlauf ?? []) : []);
    });
    return () => { weg = true; };
  }, [offen, termin.personId]);

  // ══════════════════════════════════════════════════════════════════════════
  // DIE NOTIZ SPEICHERT FÜR SICH — UND BLEIBT SICHTBAR (19.08.2026)
  //
  // Vorher ging das Textfeld nur ZUSAMMEN mit einem Ergebnis mit („Nachtragen:
  // geführt" / „Nicht erschienen"). Wer nur etwas vermerken wollte, musste ein
  // Ergebnis erfinden — oder die Notiz war weg.
  //
  // Jetzt: eigener Knopf, eigene Route, Ablage am MENSCHEN. Der Verlauf wird
  // aus der Antwort übernommen, also steht der Satz sofort da. Und ein Fehler
  // steht AM FELD, nicht in einem Kurzhinweis, der nach vier Sekunden geht.
  // ══════════════════════════════════════════════════════════════════════════
  const notizSpeichern = async () => {
    const text = notiz.trim();
    if (text.length < 2) { setNotizFehler("Bitte etwas mehr als ein Zeichen."); return; }
    setBusy("notiz");
    setNotizFehler(null);
    const r = await api(`/agent/onboarding/person/${termin.personId}/notiz`, {
      method: "POST", body: JSON.stringify({ notiz: text }),
    });
    setBusy(null);
    if (!r.ok) {
      const grund = r.json?.error || "Die Notiz wurde nicht gespeichert.";
      setNotizFehler(grund);
      zeige("fehler", "Nicht gespeichert", grund);
      return;
    }
    setNotiz("");
    setVerlauf(r.json.verlauf ?? []);
    zeige("erfolg", "Notiz gespeichert", "Sie steht jetzt im Verlauf des Kunden.");
  };

  const dokumentieren = async (ergebnis: "erledigt" | "verpasst") => {
    setBusy(ergebnis);
    const r = await api(`/agent/onboarding/termine/${termin.id}/ergebnis`, {
      method: "POST", body: JSON.stringify({ ergebnis, notiz: notiz.trim() || undefined }),
    });
    setBusy(null);
    if (!r.ok) { zeige("fehler", "Nicht gespeichert", r.json?.error || "Bitte erneut versuchen."); return; }
    zeige("erfolg", "Festgehalten", r.json.hinweis || "");
    setNotiz("");
    onFertig();
  };

  const einladen = async () => {
    setBusy("einladung");
    const r = await api(`/agent/onboarding/person/${termin.personId}/einladung`, { method: "POST" });
    setBusy(null);
    zeige(r.ok ? "erfolg" : "info", r.ok ? "Einladung verschickt" : "Nicht verschickt",
      r.ok ? `An ${termin.email}` : (r.json?.error || r.json?.grund || "Bitte später erneut."));
  };

  return (
    <Reveal index={Math.min(index, 6)}>
      <div className="fi-karte relative overflow-hidden">
        <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-[3px]"
              style={{ background: termin.heute ? "#059669" : "var(--fi-linie)" }} />
        <div className="p-4 sm:p-5 pl-5 sm:pl-6">
          <div className="flex items-start gap-3">
            <span className="shrink-0 w-[58px] text-center">
              <span className="block text-[16px] font-bold fi-zahl leading-none">{termin.uhrzeit}</span>
              <span className="block text-[10.5px] mt-0.5" style={{ color: "var(--fi-text-still)" }}>
                {termin.dauerMin} Min
              </span>
            </span>
            <button type="button" onClick={onOeffnen} className="flex-1 min-w-0 text-left">
              <p className="text-[15.5px] font-bold leading-tight truncate">{termin.name}</p>
              <p className="mt-0.5 text-[12.5px] flex flex-wrap items-center gap-x-1.5"
                 style={{ color: "var(--fi-text-still)" }}>
                {/* Die Art des Termins — dieselbe Ableitung wie überall sonst. */}
                {termin.terminArtText && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md font-semibold"
                        data-fiaon="termin-art"
                        style={{
                          background: `${termin.terminArtTon || "#64748b"}14`,
                          color: termin.terminArtTon || "#64748b",
                        }}>
                    {termin.terminArtText}
                  </span>
                )}
                <span>{termin.telefon || "keine Nummer hinterlegt"}</span>
                {/* ── ERLEDIGT MIT HÄKCHEN UND DATUM ────────────────────────
                    Daniel: „Dadurch ist nicht eindeutig erkennbar, ob der
                    Vorgang vom System tatsächlich als erledigt erfasst wurde."
                    Ein graues Wort „erledigt" hinter der Rufnummer war zu
                    wenig — jetzt eine grüne Marke mit Haken und Uhrzeit. */}
                {termin.status === "erledigt" && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-semibold"
                        data-fiaon="termin-erledigt"
                        style={{ background: "rgba(5,150,105,.10)", color: "#059669" }}>
                    <ZeichenHaken size={11} />
                    erledigt{termin.erledigtAm ? ` · ${uhrzeitVon(termin.erledigtAm)}` : ""}
                  </span>
                )}
                {termin.status === "verpasst" && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md font-semibold"
                        style={{ background: "rgba(180,83,9,.10)", color: "#b45309" }}>
                    nicht erschienen
                  </span>
                )}
                {!!termin.abgesagtAm && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md font-semibold"
                        style={{ background: "rgba(15,23,42,.06)", color: "var(--fi-text-still)" }}>
                    vom Kunden abgesagt · {uhrzeitTag(termin.abgesagtAm)}
                  </span>
                )}
              </p>
            </button>
            {/* ══════════════════════════════════════════════════════════════
                „GESPRÄCH FÜHREN" STEHT JETZT AUF DER KARTE (19.08.2026)

                ── DIE MELDUNG (Onboarding) ────────────────────────────────
                „Ich klicke auf ‚Gespräch führen', aber die Gesprächsführung
                öffnet sich nicht. Nach dem Klick passiert einfach nichts."

                ── WAS DER SCREENSHOT ZEIGTE ───────────────────────────────
                Auf der zusammengeklappten Karte stand GENAU EIN Knopf:
                „Anrufen". „Gespräch führen" lag zwei Klicks tief — man musste
                erst den KUNDENNAMEN anklicken, der wie normaler Text aussieht,
                und dort erschien es unter der Lage-Tafel.

                Und „Anrufen" war ein `<a href="tel:…">`. Am Schreibtisch, ohne
                Telefonie-Programm im Browser, tut dieser Link NICHTS — kein
                Dialog, keine Meldung. Der auffälligste Knopf der Seite war der
                einzige, der nichts sichtbar bewirkt.

                Jetzt: „Gespräch führen" ist der Hauptknopf und steht sofort da.
                Anrufen läuft über das EIGENE Softphone (`anrufStarten`) — der
                Weg, den das Cockpit und das Forderungsmanagement auch nehmen.
                ══════════════════════════════════════════════════════════════ */}
            <span className="shrink-0 flex flex-wrap items-center gap-1.5 justify-end">
              {termin.status === "gebucht" && (
                <button type="button" onClick={onCockpit}
                        data-fiaon="gespraech-fuehren"
                        className="fi-primaerknopf px-3.5 py-2 text-[12.5px] font-semibold">
                  Gespräch führen
                </button>
              )}
              {termin.telefon && (
                <button type="button"
                        onClick={() => anrufStarten(termin.telefon!, termin.personId, termin.name)}
                        data-fiaon="anrufen"
                        className="fi-zweitknopf px-3.5 py-2 text-[12.5px] font-semibold">
                  Anrufen
                </button>
              )}
            </span>
          </div>

          {offen && (
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--fi-linie)" }}>
              {/* Die Lage — dieselbe Tafel wie im Vertriebsbereich, nur über
                  einen Endpunkt, der ausschließlich lesend ist. */}
              <LageTafel personId={termin.personId} basis="/agent/onboarding/person" />

              {termin.status === "gebucht" && (
                <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--fi-linie)" }}>
                  <p className="text-[11px] font-semibold uppercase tracking-[.08em] mb-2"
                     style={{ color: "var(--fi-text-still)" }}>
                    Ergebnis festhalten
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {/* ── DER WEG INS COCKPIT ──────────────────────────────
                        Der Hauptweg. „Gespräch geführt" daneben bleibt für
                        den Fall, dass jemand ohne Cockpit telefoniert hat —
                        wer nachträgt, soll nicht durch eine Bühne müssen. */}
                    <button type="button" onClick={onCockpit} disabled={!!busy}
                            className="fi-primaerknopf px-4 py-2 text-[13px] font-semibold disabled:opacity-40">
                      Gespräch führen
                    </button>
                    <button type="button" onClick={() => void dokumentieren("erledigt")} disabled={!!busy}
                            className="fi-zweitknopf px-4 py-2 text-[13px] font-semibold disabled:opacity-40">
                      {busy === "erledigt" ? "…" : "Nachtragen: geführt"}
                    </button>
                    <button type="button" onClick={() => void dokumentieren("verpasst")} disabled={!!busy}
                            className="fi-zweitknopf px-4 py-2 text-[13px] font-semibold disabled:opacity-40">
                      {busy === "verpasst" ? "…" : "Nicht erschienen"}
                    </button>
                    <button type="button" onClick={() => void einladen()} disabled={!!busy}
                            className="fi-zweitknopf px-4 py-2 text-[13px] font-semibold disabled:opacity-40">
                      {busy === "einladung" ? "…" : "Einladung erneut senden"}
                    </button>
                  </div>
                  <p className="mt-2 text-[11.5px] leading-snug" style={{ color: "var(--fi-text-still)" }}>
                    „Nicht erschienen“ zählt wie ein erfolgloser Anruf und lädt den Kunden erneut ein.
                  </p>
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════
                  NOTIZ UND VERLAUF — AN DER PERSON, NICHT AM TERMIN

                  Das Feld stand vorher unter „Ergebnis festhalten" und ging nur
                  ZUSAMMEN mit einem Ergebnis mit. Wer nach dem Gespräch etwas
                  vermerken wollte, hatte keinen Weg — und die Notiz landete am
                  Termin, wo der nächste Aufruf sie auf NULL setzte.

                  Jetzt: eigener Knopf, Ablage im Verlauf des KUNDEN, und der
                  Verlauf steht direkt darunter. Auch bei erledigten Terminen —
                  gerade dann trägt man nach.
                  ══════════════════════════════════════════════════════════ */}
              <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--fi-linie)" }}
                   data-fiaon="onboarding-notiz">
                <p className="text-[11px] font-semibold uppercase tracking-[.08em] mb-2"
                   style={{ color: "var(--fi-text-still)" }}>
                  Notiz zum Kunden
                </p>
                <textarea value={notiz} onChange={(e) => { setNotiz(e.target.value); setNotizFehler(null); }}
                          rows={2}
                          placeholder="Was ist zu wissen? Steht danach im Verlauf des Kunden."
                          aria-label="Notiz zum Kunden"
                          className="w-full resize-none rounded-xl px-3 py-2 text-[13px] outline-none"
                          style={{ border: "1px solid var(--fi-linie)", background: "var(--fi-seite)" }} />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => void notizSpeichern()}
                          disabled={busy === "notiz" || notiz.trim().length < 2}
                          data-fiaon="notiz-speichern"
                          className="fi-zweitknopf px-3.5 py-2 text-[12.5px] font-semibold disabled:opacity-40">
                    {busy === "notiz" ? "Speichert …" : "Notiz speichern"}
                  </button>
                  {notizFehler && (
                    <span className="text-[11.5px] font-semibold" role="alert"
                          data-fiaon="notiz-fehler" style={{ color: "#b91c1c" }}>
                      {notizFehler}
                    </span>
                  )}
                </div>

                {/* Der Verlauf — der Beweis, dass die Notiz angekommen ist. */}
                <div className="mt-3" data-fiaon="onboarding-verlauf">
                  {!verlauf && <Skelett h={14} />}
                  {verlauf && verlauf.length === 0 && (
                    <p className="text-[12px]" style={{ color: "var(--fi-text-still)" }}>
                      Noch kein Eintrag.
                    </p>
                  )}
                  {verlauf && verlauf.length > 0 && (
                    <ul className="space-y-1.5 max-h-[200px] overflow-y-auto">
                      {verlauf.map((v: any, i: number) => (
                        <li key={i} className="text-[12px] leading-snug">
                          <span className="font-semibold">{uhrzeitTag(v.am)}</span>
                          {" · "}
                          <span style={{ color: "var(--fi-text-leise)" }}>
                            {v.agent_name || "System"}
                          </span>
                          {v.notiz && (
                            <span style={{ color: "var(--fi-text-still)" }}> — {v.notiz}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {termin.notiz && (
                <p className="mt-4 text-[12.5px] leading-relaxed" style={{ color: "var(--fi-text-leise)" }}>
                  Gesprächsnotiz: {String(termin.notiz).replace(/^Gesprächsnotiz:\s*/i, "")}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Reveal>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// DIE WARTENDEN — bezahlt, ohne geführtes Startgespräch (22.08.2026, K10)
//
// Das ist die Liste, die dem Bereich fehlte: Wer auf sein Gespräch wartet,
// war bisher nur auf /admin/hub zu sehen — für das Onboarding unsichtbar.
// Jede Zeile hat die zwei Handgriffe, die hier helfen: einladen, anrufen.
// ═══════════════════════════════════════════════════════════════════════════
function WartendeListe({ onGeaendert }: { onGeaendert: () => void }) {
  const { zeige } = useToast();
  const [zeilen, setZeilen] = useState<Wartender[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [nur, setNur] = useState<"ohne_termin" | "alle">("ohne_termin");
  const [busy, setBusy] = useState<number | null>(null);
  const [link, setLink] = useState<Record<number, string>>({});

  const laden = useCallback(async () => {
    const r = await api("/agent/onboarding/wartende");
    if (r.ok) { setZeilen(r.json.wartende || []); setFehler(null); }
    else setFehler(r.json?.error || `Die Liste kam nicht (HTTP ${r.status}).`);
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  const einladen = async (w: Wartender) => {
    setBusy(w.personId);
    const r = await api(`/agent/onboarding/wartende/${w.personId}/einladung`, { method: "POST" });
    setBusy(null);
    if (r.ok) {
      zeige("erfolg", "Einladung verschickt", `${w.name} hat den Terminlink per E-Mail bekommen.`);
      if (r.json?.terminLink) setLink((l) => ({ ...l, [w.personId]: r.json.terminLink }));
      void laden(); onGeaendert();
    } else {
      zeige("fehler", "Nicht verschickt", r.json?.error || r.json?.grund || "Bitte anrufen und den Link durchgeben.");
      if (r.json?.terminLink) setLink((l) => ({ ...l, [w.personId]: r.json.terminLink }));
    }
  };

  const sichtbar = (zeilen ?? []).filter((w) => nur === "alle" || !w.terminAm);

  return (
    <div className="mt-3 space-y-3" data-fiaon="wartende">
      <div className="fi-karte p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold" style={{ color: "var(--fi-text)" }}>
              Bezahlt, aber noch kein Startgespräch
            </h2>
            <p className="text-[12.5px] mt-1 leading-snug" style={{ color: "var(--fi-text-leise)" }}>
              Diese Kunden haben gezahlt und warten — ihr Konto bleibt bis zum Gespräch eingeschränkt.
              Wer keinen Termin hat, bekommt mit einem Klick den Terminlink; wer nicht reagiert, einen Anruf.
              Die Liste ist hausweit und nach Wartezeit sortiert.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {([["ohne_termin", "Ohne Termin"], ["alle", "Alle Wartenden"]] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setNur(k)}
                      className="px-3 py-1.5 rounded-xl text-[12px] font-semibold"
                      style={nur === k
                        ? { background: "var(--fi-primaer)", color: "#fff" }
                        : { background: "#fff", border: "1px solid var(--fi-linie)", color: "var(--fi-text-leise)" }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {fehler && (
        <div className="fi-karte p-4" role="alert" style={{ borderColor: "rgba(185,28,28,.3)" }}>
          <p className="text-[13px] font-bold" style={{ color: "#b91c1c" }}>{fehler}</p>
          <button type="button" onClick={() => void laden()} className="mt-2 text-[12.5px] font-semibold" style={{ color: "var(--fi-primaer)" }}>
            Noch einmal laden
          </button>
        </div>
      )}
      {!zeilen && !fehler && [0, 1, 2].map((i) => <div key={i} className="fi-karte p-4"><Skelett h={20} /></div>)}
      {zeilen && sichtbar.length === 0 && (
        <div className="fi-karte p-6 text-center">
          <p className="text-[14px] font-semibold">Niemand wartet{nur === "ohne_termin" ? " ohne Termin" : ""}.</p>
        </div>
      )}
      {sichtbar.map((w) => (
        <div key={w.personId} className="fi-karte p-4">
          <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-bold" style={{ color: "var(--fi-text)" }}>{w.name}</p>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--fi-text-leise)" }}>
                {w.paket || "Paket"}
                {w.tage != null && ` · bezahlt vor ${w.tage} ${w.tage === 1 ? "Tag" : "Tagen"}`}
                {w.verpasst > 0 && ` · ${w.verpasst}× nicht erschienen`}
              </p>
              <p className="text-[12px] mt-0.5 font-semibold"
                 style={{ color: w.terminAm ? "#059669" : w.eingeladenAm ? "#b45309" : "#b91c1c" }}>
                {w.terminAm
                  ? `Termin gebucht: ${uhrzeitTag(w.terminAm)}`
                  : w.eingeladenAm
                    ? `Eingeladen am ${uhrzeitTag(w.eingeladenAm)} — noch keine Buchung`
                    : "Noch nie eingeladen"}
              </p>
              {link[w.personId] && (
                <p className="text-[11.5px] mt-1 break-all" style={{ color: "var(--fi-text-still)" }}>
                  Terminlink zum Durchgeben: <span className="font-mono">{link[w.personId]}</span>
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {w.telefon && (
                <button type="button" onClick={() => anrufStarten(w.telefon!, w.personId, w.name)}
                        className="fi-primaerknopf px-3.5 py-2 text-[12.5px] font-semibold text-white">
                  Anrufen
                </button>
              )}
              {!w.terminAm && (
                <button type="button" onClick={() => void einladen(w)} disabled={busy === w.personId}
                        className="fi-zweitknopf px-3.5 py-2 text-[12.5px] font-semibold disabled:opacity-50">
                  {busy === w.personId ? "Sendet …" : w.eingeladenAm ? "Erneut einladen" : "Einladung senden"}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
