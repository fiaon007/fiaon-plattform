import { useCallback, useEffect, useRef, useState } from "react";
import { AgentShell } from "./agent/shared";
import { Reveal } from "./agent/motion";
import { FiaonEbene } from "@/components/FiaonEbene";

// ═══════════════════════════════════════════════════════════════════════════
// MAIL-ZENTRALE — der Florentine-Fall in zwanzig Sekunden
//
// „Hi {Anrede}, wie besprochen: {Zahlungsdaten}" — Kunde suchen, tippen,
// senden. Bisher war das eine Nachricht an den Vorgesetzten und ein Wartetag.
//
// Die Bausteine werden SERVERSEITIG je Empfänger gefüllt. Das ist der ganze
// Punkt: Bei zwei Empfängern stehen zwei verschiedene Verwendungszwecke in
// zwei verschiedenen Mails. Würde der Browser das ausfüllen, bekämen beide
// denselben — und die Buchhaltung dürfte raten, von wem das Geld kam.
// ═══════════════════════════════════════════════════════════════════════════

interface Treffer { personId: number | null; name: string; email: string; extern: boolean }
interface Gruppe { schluessel: string; titel: string; anzahl: number }
interface Baustein { marke: string; titel: string; erklaerung: string }

/**
 * Die KI-Marke: der Funken-Bogen der FIAON-Wortmarke.
 *
 * Kein Blitz, kein Stern — beide sind das Klischee, das jede zweite Oberfläche
 * für „KI" benutzt. Dies ist eine aufsteigende Linie mit drei Funken, wie ein
 * Gedanke, der Form annimmt.
 */
/**
 * Das Sendeergebnis — je Empfänger, mit Grund.
 *
 * ── DIE HAUSREGEL DAHINTER ─────────────────────────────────────────────────
 * Wenn etwas fehlschlägt, steht der GRUND in der Meldung. Nie ein Verweis auf
 * einen anderen Ort. Der Vorgesetzte sah „0 verschickt, 1 fehlgeschlagen (Grund
 * steht im Protokoll)" — und musste raten, wo dieses Protokoll ist.
 *
 * Der Grund lag zu diesem Zeitpunkt bereits vor. Er wurde ins Protokoll
 * geschrieben und aus der Antwort weggeworfen.
 */
function ErgebnisKarte({ ergebnis, onZu }: { ergebnis: any; onZu: () => void }) {
  const [offen, setOffen] = useState(true);
  const misslungen = ergebnis.ergebnisse.filter((e: any) => !e.ok);
  const geklappt = ergebnis.ergebnisse.filter((e: any) => e.ok);
  const alleGut = misslungen.length === 0;

  return (
    <div className="mt-3 rounded-2xl overflow-hidden"
         style={{
           background: alleGut
             ? "linear-gradient(158deg, rgba(5,150,105,.07), rgba(5,150,105,.02))"
             : "linear-gradient(158deg, rgba(217,119,6,.08), rgba(217,119,6,.025))",
           boxShadow: `inset 0 0 0 1px ${alleGut ? "rgba(5,150,105,.2)" : "rgba(217,119,6,.22)"}`,
         }}>
      <button type="button" onClick={() => setOffen((o) => !o)}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-bold"
                style={{ color: alleGut ? "#047857" : "#b45309" }}>
            {geklappt.length} verschickt{misslungen.length > 0 && `, ${misslungen.length} nicht`}
          </span>
          {!alleGut && ergebnis.gruende?.length === 1 && (
            <span className="block text-[12px] mt-0.5 leading-snug" style={{ color: "#92400e" }}>
              {ergebnis.gruende[0]}
            </span>
          )}
        </span>
        <span className="text-[11.5px] font-semibold shrink-0" style={{ color: "var(--fi-text-still)" }}>
          {offen ? "Zuklappen" : "Je Empfänger ansehen"}
        </span>
      </button>

      {offen && (
        <div className="px-4 pb-4">
          {ergebnis.ergebnisse.map((e: any) => (
            <div key={e.email} className="py-2.5"
                 style={{ boxShadow: "inset 0 1px 0 rgba(15,23,42,.06)" }}>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: e.ok ? "#059669" : "#d97706" }} />
                <span className="text-[13px] font-semibold" style={{ color: "var(--fi-text)" }}>
                  {e.name}
                </span>
                <span className="text-[11.5px]" style={{ color: "var(--fi-text-still)" }}>{e.email}</span>
              </div>
              {!e.ok && (
                <>
                  <p className="mt-1 ml-3.5 text-[12px] leading-relaxed" style={{ color: "#92400e" }}>
                    {e.grund || "Kein Grund übermittelt — bitte im Protokoll nachsehen."}
                  </p>
                  {/* Der Tiefverweis: springt auf GENAU diese Zeile, nicht auf
                      eine Liste, in der man wieder suchen muss. */}
                  <a href={`/admin/mail-protokoll?id=${e.protokollId ?? ""}`}
                     className="inline-block mt-1.5 ml-3.5 text-[11.5px] font-semibold underline"
                     style={{ color: "var(--fi-primaer)" }}>
                    Im Protokoll öffnen
                  </a>
                  {/^.*Freigabeliste.*$/.test(String(e.grund || "")) && (
                    <a href="/admin/diagnose#ausgangs-ip"
                       className="inline-block mt-1.5 ml-3 text-[11.5px] font-semibold underline"
                       style={{ color: "var(--fi-primaer)" }}>
                      So behebst du das
                    </a>
                  )}
                </>
              )}
            </div>
          ))}
          <button type="button" onClick={onZu}
                  className="mt-3 text-[12px] font-semibold" style={{ color: "var(--fi-text-still)" }}>
            Ergebnis schließen
          </button>
        </div>
      )}
    </div>
  );
}

function MarkeFunke({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor"
         strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M3 16c2.4-1.2 4.1-3.1 5.2-5.6C9.3 7.8 11.1 5.9 13.6 5" />
      <path d="M15.4 3.2v3.1M17 4.7h-3.1" />
      <circle cx="6.2" cy="6.4" r="1" />
      <circle cx="16.4" cy="13.6" r="1" />
    </svg>
  );
}

export default function MailZentraleSeite() {
  // ── ZWEI HÜLLEN, EIN INHALT ─────────────────────────────────────────────
  // `AgentShell` prüft die Agent-Anmeldung und zeigt sonst eine
  // Anmeldeaufforderung. Der Vorgesetzte hat kein Agent-Konto — für ihn wäre das
  // eine Sackgasse, und genau die hat er gemeldet.
  //
  // Unter /admin/ kommt die Seite deshalb OHNE AgentShell: Die Admin-Hülle
  // (AdminShell) liegt schon außen herum, weil die Route über `admin(…)`
  // eingehängt ist. Der INHALT ist in beiden Fällen derselbe — eine zweite
  // Fassung wäre eine zweite Sendestrecke zum Pflegen.
  const alsAdmin = typeof window !== "undefined"
    && window.location.pathname.startsWith("/admin/");
  if (alsAdmin) return <Inhalt />;
  return <AgentShell><Inhalt /></AgentShell>;
}

function Inhalt() {
  // ── EINE SEITE, ZWEI WEGE ────────────────────────────────────────────────
  // Der Vorgesetzte hat keinen Agent-Zugang. Bis zum 11.08.2026 zeigte sein
  // Menüpunkt auf /agent/mail-zentrale und verlangte eine Anmeldung für ein
  // Konto, das er nicht besitzt.
  //
  // Statt einer zweiten Seite (zwei Fassungen einer Sendestrecke) entscheidet
  // die Adresse über die Endpunkte. Die Oberfläche ist identisch — nur die
  // Grenzen sind es nicht: Der Vorgesetzte sendet an bis zu 5.000 Empfänger,
  // ein Teammitglied an zehn.
  const alsAdmin = typeof window !== "undefined"
    && window.location.pathname.startsWith("/admin/");
  const basis = alsAdmin ? "/api/fiaon/admin/mail/zentrale" : "/api/fiaon/mail/zentrale";
  const [suche, setSuche] = useState("");
  const [treffer, setTreffer] = useState<Treffer[]>([]);
  const [gewaehlt, setGewaehlt] = useState<Treffer[]>([]);
  const [gruppen, setGruppen] = useState<Gruppe[]>([]);
  const [aktiveGruppen, setAktiveGruppen] = useState<string[]>([]);
  const [bausteine, setBausteine] = useState<Baustein[]>([]);
  const [maxEmpfaenger, setMaxEmpfaenger] = useState(10);
  const [betreff, setBetreff] = useState("");
  const [text, setText] = useState("");
  const [extern, setExtern] = useState("");
  const [vorschau, setVorschau] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ art: "gut" | "schlecht"; text: string } | null>(null);
  const [gruppenWahl, setGruppenWahl] = useState(false);
  // Das Ergebnis je Empfänger — mit Grund. Siehe „Fehlergründe gehören an den
  // Ort des Geschehens" im CHANGELOG vom 11.08.2026.
  const [ergebnis, setErgebnis] = useState<any>(null);
  // KI: Fehler als Karte, alter Stand zum Zurückholen, kurzes Aufblinken.
  const [kiFehler, setKiFehler] = useState<string | null>(null);
  const [zurueck, setZurueck] = useState<{ betreff: string; text: string } | null>(null);
  const [eingefuegt, setEingefuegt] = useState(false);
  const feld = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`${basis}/gruppen`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (!j?.ok) return;
        setGruppen(j.gruppen || []);
        setBausteine(j.bausteine || []);
        setMaxEmpfaenger(j.maxEmpfaenger || 10);
      })
      .catch(() => {});
  }, []);

  // Autocomplete ab dem ERSTEN Zeichen — wer „S" tippt, sucht schon.
  useEffect(() => {
    if (suche.trim().length < 1) { setTreffer([]); return; }
    const t = setTimeout(() => {
      fetch(`${basis}/suche?q=${encodeURIComponent(suche)}`, { credentials: "include" })
        .then((r) => r.json())
        .then((j) => setTreffer(j?.ok ? j.treffer : []))
        .catch(() => {});
    }, 180);
    return () => clearTimeout(t);
  }, [suche]);

  const auswahl = useCallback(() => ({
    personIds: gewaehlt.filter((g) => g.personId).map((g) => g.personId!),
    gruppen: aktiveGruppen,
    extern: extern.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean),
  }), [gewaehlt, aktiveGruppen, extern]);

  const bausteinEinfuegen = (marke: string) => {
    const el = feld.current;
    if (!el) { setText((t) => `${t}${marke}`); return; }
    const a = el.selectionStart ?? text.length;
    setText(`${text.slice(0, a)}${marke}${text.slice(el.selectionEnd ?? a)}`);
    setTimeout(() => { el.focus(); el.setSelectionRange(a + marke.length, a + marke.length); }, 0);
  };

  const vorschauHolen = async () => {
    setBusy("vorschau");
    const r = await fetch(`${basis}/vorschau`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...auswahl(), betreff, text }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(null);
    if (!j?.ok) { setMeldung({ art: "schlecht", text: j?.error || "Vorschau nicht möglich." }); return; }
    setVorschau(j);
  };

  const senden = async () => {
    setBusy("senden");
    const r = await fetch(`${basis}/senden`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...auswahl(), betreff, text, merkmal: vorschau?.merkmal }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(null);
    setMeldung({ art: j?.ok && !j?.fehlgeschlagen ? "gut" : "schlecht",
                 text: j?.meldung || j?.error || "Unbekannter Fehler." });
    // Das Einzelergebnis stehen lassen, AUCH wenn alles geklappt hat: Wer
    // fünfzig Mails schickt, will nachsehen können, wer sie bekommen hat.
    setErgebnis(j?.ergebnisse?.length ? j : null);
    if (j?.ok) { setVorschau(null); setText(""); setBetreff(""); setGewaehlt([]); setAktiveGruppen([]); }
  };

  /**
   * Der KI-Assistent.
   *
   * ── DREI FEHLER, DIE HIER LAGEN ──────────────────────────────────────────
   * 1. Die Adresse war fest `/mail/zentrale/ki` — eine Route hinter
   *    `requireAgent`. Vom Verwaltungsbereich aus lief jeder Aufruf in ein
   *    401, und die Meldung „KI nicht verfügbar" klang nach fehlendem
   *    Schlüssel statt nach fehlender Route. Jetzt `basis`.
   * 2. Der BETREFF wurde nie gefüllt — die KI lieferte gar keinen. Jetzt
   *    liefert sie eine Betreffzeile, und sie landet im Betrefffeld.
   * 3. Kein Weg zurück. Wer seine Stichpunkte durch einen Entwurf ersetzt
   *    bekam, hatte sie verloren. Jetzt wird der alte Stand gesichert.
   */
  const ki = async (art: string) => {
    setBusy(`ki-${art}`);
    setKiFehler(null);
    const vorher = { betreff, text };
    const r = await fetch(`${basis}/ki`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ art, eingabe: text }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(null);

    if (!j?.ok) {
      // Klartext-Karte statt eines stummen Bandes — Hausregel: Der Grund
      // steht am Ort des Geschehens.
      setKiFehler(j?.grund || j?.error
        || "Die KI war nicht erreichbar. Prüfe die Verbindung und versuche es erneut.");
      return;
    }

    setZurueck(vorher);
    setText(j.text);
    if (j.betreff && !betreff.trim()) setBetreff(j.betreff);
    // Die Felder blinken kurz auf — sonst merkt niemand, dass sich etwas
    // geändert hat, und die Meldung oben wirkt wie eine leere Behauptung.
    setEingefuegt(true);
    window.setTimeout(() => setEingefuegt(false), 1400);
    setMeldung({
      art: "gut",
      text: (j.entfernt?.length ?? 0) > 0
        ? `Vorschlag steht im Feld. Entschärft wurde: ${j.entfernt.join(", ")} — solche Zusagen dürfen nicht an Kunden.`
        : "Vorschlag steht im Feld. Bitte lies ihn, bevor du sendest.",
    });
  };

  const gewaehltGesamt = gewaehlt.length
    + aktiveGruppen.reduce((s, g) => s + (gruppen.find((x) => x.schluessel === g)?.anzahl ?? 0), 0)
    + extern.split(/[,;\s]+/).filter(Boolean).length;

  return (
    <div className="pb-24 md:pb-10">
      <div className="mx-auto" style={{ maxWidth: 860 }}>
        <Reveal index={0}>
          <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight leading-tight">
            <span className="fi-gradient-text">Mail-Zentrale</span>
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--fi-text-leise)" }}>
            Kunden suchen, schreiben, senden. Bausteine füllt der Server je Empfänger einzeln.
          </p>
        </Reveal>

        {meldung && (
          <p className="mt-4 px-3.5 py-2.5 rounded-xl text-[12.5px] font-semibold leading-relaxed"
             style={meldung.art === "gut"
               ? { background: "rgba(5,150,105,.08)", color: "#047857" }
               : { background: "rgba(217,119,6,.08)", color: "#b45309" }}>
            {meldung.text}
          </p>
        )}

        {/* ── DAS ERGEBNIS, EMPFÄNGER FÜR EMPFÄNGER ─────────────────────────
            Bis zum 11.08.2026 stand hier „1 fehlgeschlagen (Grund steht im
            Protokoll)". Der Grund lag zu dem Zeitpunkt schon vor — er wurde
            ins Protokoll geschrieben und aus der Antwort weggeworfen. Wer ihn
            wissen wollte, musste eine Tabelle suchen. */}
        {ergebnis && ergebnis.ergebnisse?.length > 0 && (
          <ErgebnisKarte ergebnis={ergebnis} onZu={() => setErgebnis(null)} />
        )}

        {/* ── Empfänger ────────────────────────────────────────────────── */}
        <Reveal index={1}>
          <div className="fi-karte mt-4 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[.08em] mb-2.5"
               style={{ color: "var(--fi-text-still)" }}>
              Empfänger {gewaehltGesamt > 0 && <span className="fi-zahl">· {gewaehltGesamt}</span>}
            </p>

            {gewaehlt.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {gewaehlt.map((g) => (
                  <span key={g.email} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-[12px]"
                        style={{ background: "rgba(29,78,216,.07)", color: "var(--fi-primaer)" }}>
                    {g.name}
                    {g.extern && <span className="text-[10px] font-bold uppercase opacity-70">extern</span>}
                    <button type="button" aria-label={`${g.name} entfernen`}
                            onClick={() => setGewaehlt((l) => l.filter((x) => x.email !== g.email))}
                            className="w-4 h-4 flex items-center justify-center opacity-60">
                      <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                        <path d="m5 5 10 10M15 5 5 15" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* ── EIN FELD FÜR ALLES ────────────────────────────────────
                Der Vorgesetzte: „verdammt kompliziert". Vorher waren es DREI
                Eingaben — Kundensuche, Gruppen-Knopfwand, externes Feld —
                und man musste wissen, welche wofür ist.

                Jetzt: hier tippen. Es sucht Kunden UND nimmt jede freie
                Adresse; Enter macht daraus einen Chip. Die Gruppen liegen
                hinter EINEM Knopf daneben — wer sie nicht braucht, sieht
                sie nicht. */}
            <div className="flex items-stretch gap-2">
              <input value={suche} onChange={(e) => setSuche(e.target.value)}
                     onKeyDown={(e) => {
                       if (e.key !== "Enter") return;
                       e.preventDefault();
                       const wert = suche.trim();
                       // Sieht es aus wie eine Adresse, ist es eine.
                       if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(wert)) return;
                       setGewaehlt((l) => l.some((x) => x.email.toLowerCase() === wert.toLowerCase())
                         ? l
                         : [...l, { email: wert, name: wert, extern: true } as Treffer]);
                       setSuche(""); setTreffer([]);
                     }}
                     placeholder="Name, Kundennummer oder E-Mail eintippen …"
                     aria-label="Empfänger suchen oder E-Mail eingeben"
                     className="flex-1 min-w-0 rounded-xl px-3.5 py-2.5 text-[13.5px] outline-none"
                     style={{ border: "1px solid var(--fi-linie)", background: "var(--fi-seite)", minHeight: 46 }} />
              <button type="button" onClick={() => setGruppenWahl(true)}
                      className="fi-knopf-glas shrink-0 px-3.5 text-[12.5px] font-semibold whitespace-nowrap">
                Gruppe wählen
                {aktiveGruppen.length > 0 && (
                  <span className="ml-1.5 fi-zahl" style={{ color: "var(--fi-primaer)" }}>
                    {aktiveGruppen.length}
                  </span>
                )}
              </button>
            </div>

            {treffer.length > 0 && (
              <div className="mt-1.5 rounded-xl overflow-hidden" style={{ border: "1px solid var(--fi-linie)" }}>
                {treffer.slice(0, 8).map((t) => (
                  <button key={t.email} type="button"
                          onClick={() => {
                            setGewaehlt((l) => l.some((x) => x.email === t.email) ? l : [...l, t]);
                            setSuche(""); setTreffer([]);
                          }}
                          className="w-full text-left px-3.5 py-2.5 text-[13px] hover:bg-slate-50"
                          style={{ boxShadow: "inset 0 -1px 0 var(--fi-linie)" }}>
                    <span className="font-semibold">{t.name}</span>
                    <span className="ml-2" style={{ color: "var(--fi-text-still)" }}>{t.email}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Eine freie Adresse braucht einen Hinweis, sonst rät man. */}
            {suche.trim().length > 2 && treffer.length === 0 && (
              <p className="mt-2 text-[11.5px]" style={{ color: "var(--fi-text-still)" }}>
                {/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(suche.trim())
                  ? "Enter drücken — die Adresse wird als externer Empfänger übernommen."
                  : "Kein Kunde gefunden. Eine vollständige E-Mail-Adresse kannst du mit Enter direkt übernehmen."}
              </p>
            )}

            <p className="mt-2.5 text-[11px] leading-snug" style={{ color: "var(--fi-text-still)" }}>
              Testeinträge, DSGVO-Gelöschte und archivierte Datensätze sind immer ausgeschlossen.
              {maxEmpfaenger < 1000 && ` Deine Rolle darf an höchstens ${maxEmpfaenger} Empfänger senden.`}
            </p>

            <FiaonEbene
              offen={gruppenWahl}
              onZu={() => setGruppenWahl(false)}
              titel="Eine ganze Gruppe anschreiben"
              ueberschrift="Zielgruppen"
              breite={520}
              kinder={
                <>
                  <p className="text-[12.5px] leading-relaxed mb-3" style={{ color: "var(--fi-text-still)" }}>
                    Die Zahl ist der aktuelle Stand — sie wird beim Senden neu ermittelt,
                    nicht aus dieser Ansicht übernommen.
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {gruppen.map((g) => {
                      const an = aktiveGruppen.includes(g.schluessel);
                      return (
                        <button key={g.schluessel} type="button" disabled={g.anzahl === 0}
                                onClick={() => setAktiveGruppen((l) =>
                                  an ? l.filter((x) => x !== g.schluessel) : [...l, g.schluessel])}
                                className="flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left disabled:opacity-35"
                                style={an
                                  ? { background: "linear-gradient(158deg, rgba(59,130,246,.14), rgba(29,78,216,.05))",
                                      boxShadow: "inset 0 0 0 1px rgba(37,99,235,.28)" }
                                  : { background: "rgba(15,23,42,.028)", boxShadow: "inset 0 0 0 1px rgba(15,23,42,.06)" }}>
                          <span className="w-5 h-5 rounded-md shrink-0 flex items-center justify-center"
                                style={an
                                  ? { background: "var(--fi-primaer)", color: "#fff" }
                                  : { boxShadow: "inset 0 0 0 1.5px rgba(15,23,42,.16)" }}>
                            {an && (
                              <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                                   strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                                <path d="m4.5 10.5 3.5 3.5 7.5-8" />
                              </svg>
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13.5px] font-semibold"
                                  style={{ color: an ? "var(--fi-primaer)" : "var(--fi-text)" }}>
                              {g.titel}
                            </span>
                          </span>
                          <span className="fi-zahl text-[13px] font-bold shrink-0"
                                style={{ color: an ? "var(--fi-primaer)" : "var(--fi-text-still)" }}>
                            {g.anzahl}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              }
              fuss={
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setAktiveGruppen([])}
                          className="text-[13px] font-semibold" style={{ color: "var(--fi-text-still)" }}>
                    Keine
                  </button>
                  <button type="button" onClick={() => setGruppenWahl(false)}
                          className="ml-auto fi-knopf-primaer px-5 py-2.5 text-[14px]">
                    Übernehmen
                  </button>
                </div>
              }
            />
          </div>
        </Reveal>

        {/* ── Inhalt ───────────────────────────────────────────────────── */}
        <Reveal index={2}>
          <div className="fi-karte mt-3 p-4">
            <input value={betreff} onChange={(e) => setBetreff(e.target.value)} placeholder="Betreff"
                   className={`w-full text-[15px] font-semibold bg-transparent outline-none pb-2.5 ${eingefuegt ? "fi-eingefuegt" : ""}`}
                   style={{ borderBottom: "1px solid var(--fi-linie)" }} />
            <textarea ref={feld} value={text} onChange={(e) => setText(e.target.value)} rows={9}
                      placeholder="Hi {Anrede}, wie besprochen: {Zahlungsdaten}"
                      className={`w-full mt-3 resize-none bg-transparent text-[14px] leading-relaxed outline-none ${eingefuegt ? "fi-eingefuegt" : ""}`} />
            <style>{`
              /* Kurzes Aufblinken, wenn die KI etwas eingesetzt hat. Ohne
                 diesen Hinweis wirkt die Meldung oben wie eine leere
                 Behauptung — man sieht nicht, dass sich etwas geändert hat. */
              .fi-eingefuegt { animation: fiEingefuegt 1.4s cubic-bezier(.32,.72,0,1) both; }
              @keyframes fiEingefuegt {
                0%   { background: rgba(37,99,235,.16); box-shadow: 0 0 0 6px rgba(37,99,235,.1); }
                100% { background: transparent; box-shadow: 0 0 0 0 transparent; }
              }
              @media (prefers-reduced-motion: reduce) { .fi-eingefuegt { animation: none; } }
            `}</style>

            <div className="mt-2 pt-2.5 flex flex-wrap gap-1.5" style={{ borderTop: "1px solid var(--fi-linie)" }}>
              {bausteine.map((b) => (
                <button key={b.marke} type="button" onClick={() => bausteinEinfuegen(b.marke)} title={b.erklaerung}
                        className="px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold"
                        style={{ background: "var(--fi-seite)", color: "var(--fi-text-leise)" }}>
                  {b.titel}
                </button>
              ))}
            </div>

            {kiFehler && (
              <div className="mt-3 px-3.5 py-3 rounded-xl"
                   style={{ background: "rgba(217,119,6,.08)", boxShadow: "inset 0 0 0 1px rgba(217,119,6,.22)" }}>
                <p className="text-[12.5px] font-bold" style={{ color: "#b45309" }}>
                  Der Entwurf ist nicht entstanden
                </p>
                <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "#92400e" }}>{kiFehler}</p>
                {/^Die KI antwortete mit HTTP 401/.test(kiFehler) && (
                  <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: "#92400e" }}>
                    Das ist kein Fehler an deinem Text: Der hinterlegte OpenAI-Schlüssel wird
                    abgelehnt. Der Vorgesetzte muss ihn erneuern — schreib solange von Hand.
                  </p>
                )}
              </div>
            )}

            <div className="mt-3 pt-3 flex flex-wrap items-center gap-2" style={{ borderTop: "1px solid var(--fi-linie)" }}>
              {[
                { art: "entwurf", titel: "Entwurf aus Stichpunkten" },
                { art: "ton", titel: "Ton glätten" },
                { art: "kuerzen", titel: "Kürzen" },
              ].map((k) => (
                <button key={k.art} type="button" onClick={() => void ki(k.art)} disabled={!!busy || text.trim().length < 3}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold disabled:opacity-40"
                        style={{ background: "rgba(29,78,216,.06)", color: "var(--fi-primaer)" }}>
                  <MarkeFunke size={14} />
                  {busy === `ki-${k.art}` ? "…" : k.titel}
                </button>
              ))}

              {/* Rückgängig: Wer seine Stichpunkte durch einen Entwurf
                  ersetzt bekommt, muss sie zurückholen können. */}
              {zurueck && (
                <button type="button"
                        onClick={() => { setBetreff(zurueck.betreff); setText(zurueck.text); setZurueck(null); }}
                        className="fi-knopf-glas px-3 py-2 text-[12px]">
                  Rückgängig
                </button>
              )}
            </div>
            <p className="mt-2 text-[11px] leading-snug" style={{ color: "var(--fi-text-still)" }}>
              Die KI schlägt vor, du sendest. Zusagen zu Limits und das Wort „Beratung" werden automatisch entfernt.
            </p>
          </div>
        </Reveal>

        {/* ── Senden ───────────────────────────────────────────────────── */}
        <Reveal index={3}>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button"
                    onClick={async () => {
                      setBusy("test");
                      const r = await fetch(`${basis}/test`, {
                        method: "POST", credentials: "include",
                        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ betreff, text }),
                      }).catch(() => null);
                      const j = await r?.json().catch(() => null);
                      setBusy(null);
                      setMeldung({ art: j?.ok ? "gut" : "schlecht", text: j?.meldung || j?.error || "Fehler." });
                    }}
                    disabled={!!busy || !betreff || !text}
                    className="fi-zweitknopf px-4 py-2.5 text-[13px] font-semibold disabled:opacity-40">
              {busy === "test" ? "…" : "Test an mich"}
            </button>
            {/* EIN Primärweg: Die Vorschau IST der Sendeknopf. Vorher waren
                es zwei Schritte mit zwei Knöpfen — und der zweite hieß
                „Vorschau (Pflicht)", was wie eine Hürde klang statt wie der
                Weg zum Ziel. */}
            <button type="button" onClick={() => void vorschauHolen()}
                    disabled={!!busy || !betreff || !text || gewaehltGesamt === 0}
                    className="fi-knopf-primaer ml-auto px-5">
              {busy === "vorschau" ? "…" : "Vorschau & senden"}
            </button>
          </div>
        </Reveal>
      </div>

      {/* ── Pflicht-Vorschau ──────────────────────────────────────────── */}
      {vorschau && (
        <>
          <div className="fixed inset-0 z-[400]" onClick={() => setVorschau(null)} aria-hidden="true"
               style={{ background: "rgba(7,11,22,.6)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }} />
          <div className="fixed inset-0 z-[401] flex items-end sm:items-center justify-center sm:p-6 pointer-events-none">
            <div role="dialog" aria-modal="true" aria-label="Vorschau vor dem Versand"
                 className="w-full flex flex-col overflow-hidden pointer-events-auto"
                 style={{ maxWidth: 620, maxHeight: "90vh", background: "#fff",
                          borderRadius: 22, boxShadow: "0 40px 120px -24px rgba(13,26,63,.5)" }}>
              <div className="px-5 sm:px-7 pt-5 pb-4 shrink-0 fi-glas">
                <p className="text-[10.5px] font-semibold uppercase tracking-[.2em]" style={{ color: "var(--fi-text-still)" }}>
                  So geht es raus
                </p>
                <h2 className="mt-1 text-[19px] font-bold tracking-tight">
                  <span className="fi-gradient-text">{vorschau.anzahl} {vorschau.anzahl === 1 ? "Empfänger" : "Empfänger"}</span>
                </h2>
                <p className="mt-1.5 text-[12px]" style={{ color: "var(--fi-text-still)" }}>
                  {vorschau.empfaenger.map((e: any) => e.name).slice(0, 6).join(", ")}
                  {vorschau.anzahl > 6 && ` und ${vorschau.anzahl - 6} weitere`}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-4" style={{ background: "var(--fi-seite)" }}>
                <p className="text-[12px] mb-2" style={{ color: "var(--fi-text-still)" }}>
                  Betreff: <b style={{ color: "var(--fi-text)" }}>{vorschau.betreff}</b> — Bausteine sind hier mit den
                  Daten des ersten Empfängers gefüllt; jeder bekommt seine eigenen.
                </p>
                <iframe title="Vorschau" sandbox="" srcDoc={vorschau.html}
                        style={{ width: "100%", height: 420, border: "1px solid var(--fi-linie)", borderRadius: 12, background: "#fff" }} />
              </div>
              <div className="px-5 sm:px-7 py-4 shrink-0 flex flex-wrap items-center gap-2"
                   style={{ borderTop: "1px solid var(--fi-linie)" }}>
                <button type="button" onClick={() => setVorschau(null)}
                        className="text-[13px] font-semibold" style={{ color: "var(--fi-text-still)" }}>
                  Zurück zum Text
                </button>
                <button type="button" onClick={() => void senden()} disabled={busy === "senden"}
                        className="fi-primaerknopf ml-auto px-5 py-2.5 text-[14px] font-bold disabled:opacity-40">
                  {busy === "senden" ? "Wird verschickt …" : `An ${vorschau.anzahl} senden`}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
