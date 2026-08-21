import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  InviteModal, MilestoneTasksCard, PartnerSuggestionsCard, ScriptsAdmin, SettingsCard,
} from "@/components/admin/TeamVerwaltung";
import { FiaonEbene } from "@/components/FiaonEbene";
import { NachbuchenTafel } from "@/components/admin/NachbuchenTafel";
import { AnrufPlayer } from "@/components/AnrufPlayer";
import VerguetungTafel from "@/components/admin/VerguetungTafel";

// ═══════════════════════════════════════════════════════════════════════════
// TEAM-ZENTRALE — alles über einen Menschen an einem Ort
//
// Bisher lag das Wissen über einen Mitarbeiter auf vier Seiten: Stammdaten und
// Provisionssatz in „Team-Übersicht", Zahlen in „Leistung", Nachbuchungen auf
// einer eigenen Seite, Auszahlungen auf einer fünften. Wer eine Frage zu einer
// Person hatte, klickte sich durch alle.
//
// NEU UND ZENTRAL: das PROTOKOLL. „Was hat diese Person eigentlich gemacht?"
// war bisher unbeantwortbar, obwohl die Antwort seit Monaten in
// `fiaon_agent_events` und `fiaon_contact_log` steht. Es wird nichts NEUES
// mitgeschrieben — es war nur nie lesbar.
// ═══════════════════════════════════════════════════════════════════════════

interface Mitglied {
  first_name?: string | null;
  pruefkonto?: boolean;
  id: number; name: string; vorname: string; email: string; avatar: string | null;
  rolle: string; active: boolean; distribution_active: boolean; is_test_account: boolean;
  commission_rate_bp: number | null; monthly_goal_cents: number | null;
  last_login_at: string | null;
  stufe_a: number; stufe_b: number; stufe_c: number; bestand: number;
  // Was davon HEUTE ansteht — ohne Ruhende und ohne Verabredungen in der
  // Zukunft. Der Bestand allein fuehrt in die Irre.
  stufe_a_heute?: number; stufe_b_heute?: number; stufe_c_heute?: number;
  heute: number; woche: number; erreichbarkeit: number | null;
  abschluesse_monat: number; umsatz_monat_cents: string;
  offen_cents: string; ausgezahlt_cents: string; letzte_aktivitaet: string | null;
  /** Maskiert — die vollständige IBAN kommt nur über den eigenen Endpunkt. */
  bank_iban_masked: string | null;
}

const ROLLE_TEXT: Record<string, string> = {
  agent: "Vertrieb", vertriebsleiter: "Vertriebsleitung", onboarding: "Onboarding",
  inkasso: "Forderungsmanagement",
};

function eur(cent: unknown): string {
  return `${(Number(cent ?? 0) / 100).toFixed(2).replace(".", ",")} €`;
}

function wann(iso: string | null): string {
  if (!iso) return "nie";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return `vor ${Math.max(1, min)} Min`;
  if (min < 1440) return `vor ${Math.round(min / 60)} Std`;
  const t = Math.round(min / 1440);
  return t === 1 ? "gestern" : `vor ${t} Tagen`;
}

/** Anfangsbuchstaben, wenn kein Bild da ist. */
function Avatar({ src, name, size = 40 }: { src: string | null; name: string; size?: number }) {
  const kuerzel = name.split(/\s+/).slice(0, 2).map((t) => t[0]).join("").toUpperCase();
  return src
    ? <img src={src} alt="" width={size} height={size} className="rounded-full object-cover border border-slate-200 shrink-0" />
    : (
      <span style={{ width: size, height: size, fontSize: Math.max(11, size * 0.34) }}
            className="rounded-full bg-slate-100 border border-slate-200 text-slate-500 font-semibold flex items-center justify-center shrink-0">
        {kuerzel}
      </span>
    );
}

/**
 * Drei Punkte — 20×20, 1,5 px, `currentColor`. Selbst gezeichnet, wie es
 * AGENTS.md verlangt (keine Icon-Bibliothek).
 */
function ZeichenDreiPunkte({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="4.5" r="1.5" fill="currentColor" />
      <circle cx="10" cy="10" r="1.5" fill="currentColor" />
      <circle cx="10" cy="15.5" r="1.5" fill="currentColor" />
    </svg>
  );
}

/**
 * Das Karten-Menü: die drei Handlungen je Mensch, die nicht ins Alltagsbild
 * gehören.
 *
 * ── WARUM ES DAS GIBT (19.08.2026) ────────────────────────────────────────
 * „als Testkonto markieren" stand als sichtbarer Link unter JEDEM Namen. Der
 * Betreiber nennt das Verwaltungsmüll, und das ist es: Die Handlung, die man
 * fast nie braucht, stand neben dem Menschen, den man täglich ansieht — und sie
 * schrieb das Wort „Test" über einen echten Kollegen.
 *
 * ── UND WARUM HIER ZWEI DINGE DAZUKOMMEN ──────────────────────────────────
 * „Profil öffnen" und „Als Mitarbeiter ansehen" gab es an der Karte GAR NICHT.
 * Die Ansicht-Route (`POST /admin/team/ansicht/:id`) existierte seit Tagen und
 * war von hier aus nicht erreichbar — genau das Muster, das AGENTS.md zweimal
 * beschreibt: eine Route ohne Knopf ist eine halbe Funktion.
 *
 * `stopPropagation` überall: Die ganze Karte ist ein Knopf, der das
 * Detailfenster öffnet.
 */
function KartenMenue({ m, laden, onProfil }: {
  m: any; laden: () => void;
  /** Öffnet die Akte-Schublade IN der Seite — sie ist keine eigene Adresse. */
  onProfil: () => void;
}) {
  const [offen, setOffen] = useState(false);
  const huelle = useRef<HTMLDivElement | null>(null);

  // Haken stehen ÜBER dem ersten `return` (AGENTS.md, zweimal in Softphone.tsx
  // gelernt).
  useEffect(() => {
    if (!offen) return;
    const zu = (e: MouseEvent) => {
      if (huelle.current && !huelle.current.contains(e.target as Node)) setOffen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOffen(false); };
    document.addEventListener("mousedown", zu);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", zu);
      document.removeEventListener("keydown", esc);
    };
  }, [offen]);

  const testkontoUmschalten = async () => {
    setOffen(false);
    if (!confirm(m.is_test_account
      ? `Die Testkonto-Marke von „${m.name}“ aufheben?\n\n`
        + "Das Konto erscheint danach wieder in der Team-Zentrale und in den "
        + "Kennzahlen. Ein deaktiviertes Konto wird dadurch NICHT nutzbar — "
        + "dafür braucht es zusätzlich ein neues Passwort."
      : `„${m.name}“ als Testkonto markieren?\n\n`
        + "Das Konto verschwindet aus der Team-Zentrale, aus allen Kennzahlen "
        + "und aus der Kundenverteilung. Provisionen und Verlauf bleiben.")) return;
    const r = await fetch(`/api/fiaon/admin/agents/${m.id}/testkonto`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ist: !m.is_test_account }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    alert(j?.ok ? j.hinweis : (j?.error || "Das hat nicht geklappt."));
    if (j?.ok) laden();
  };

  const alsMitarbeiterAnsehen = async () => {
    setOffen(false);
    const r = await fetch(`/api/fiaon/admin/team/ansicht/${m.id}`, {
      method: "POST", credentials: "include",
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!j?.ok) { alert(j?.error || "Die Ansicht konnte nicht gestartet werden."); return; }
    // Der Zielweg kommt vom SERVER, nicht aus einem Literal hier: Sonst zeigen
    // zwei Stellen auf verschiedene Seiten, sobald sich die Startseite ändert.
    window.location.href = String(j.ziel || "/agent/start");
  };

  const eintrag = "w-full text-left px-3 py-2 text-[12.5px] hover:bg-slate-50";

  return (
    <div ref={huelle} className="absolute right-1.5 top-1.5 z-20" data-fiaon="karten-menue">
      <button type="button"
              aria-label={`Mehr zu ${m.name}`}
              aria-expanded={offen}
              title="Profil, Ansicht, Verwaltung"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOffen((o) => !o); }}
              className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-50">
        <ZeichenDreiPunkte />
      </button>
      {offen && (
        <div className="absolute right-0 mt-1 w-[232px] bg-white rounded-xl overflow-hidden"
             style={{ border: "1px solid #e2e8f0", boxShadow: "0 18px 40px -16px rgba(15,23,42,.28)" }}
             onClick={(e) => e.stopPropagation()}>
          {/* ══════════════════════════════════════════════════════════════
              „PROFIL ÖFFNEN" FÜHRTE INS LEERE (19.08.2026)

              Hier stand `<a href="/admin/agents/{id}">`. Diese Adresse gibt es
              nicht: Der Browsertest landete auf „Diese Seite existiert nicht —
              /admin/agents/811 führt ins Leere".

              Die Akte ist eine SCHUBLADE in dieser Seite (`MitgliedDetail`),
              keine eigene Adresse. AGENTS.md, wörtlich: „Ein `<a href>` ist
              kein Knopf. Wenn etwas aufgehen soll, gehört ein `onClick` daran."
              Gefunden hat es der Browsertest, der den Reiter „Gespräche"
              drücken wollte und nie dort ankam.
              ══════════════════════════════════════════════════════════════ */}
          <button type="button"
                  onClick={(e) => { e.stopPropagation(); setOffen(false); onProfil(); }}
                  className={`${eintrag} text-slate-700`}>
            Profil öffnen
          </button>
          <button type="button" onClick={() => void alsMitarbeiterAnsehen()}
                  disabled={!m.active}
                  title={m.active ? undefined
                    : "Das Konto ist deaktiviert — die Ansicht zeigte nur eine Anmeldeseite."}
                  className={`${eintrag} text-slate-700 disabled:text-slate-300`}>
            Als Mitarbeiter ansehen
          </button>
          <div style={{ borderTop: "1px solid #f1f5f9" }} />
          <button type="button" onClick={() => void testkontoUmschalten()}
                  className={`${eintrag} text-slate-500`}>
            {m.is_test_account ? "Testkonto-Marke aufheben" : "Als Testkonto markieren"}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Die Summenzeile: Was kostet das Team diesen Monat, was hat es
 * hereingeholt? Eine Zeile, im CI-Dunkelblau, ganz oben.
 *
 * Sie erscheint NUR, wenn überhaupt Festgehälter hinterlegt sind. Eine
 * Deckungsquote von „unendlich Prozent", weil niemand ein Gehalt bekommt,
 * ist keine Information — sie ist Lärm.
 */
/**
 * Aktivität — was die Leitung getan hat.
 *
 * ── WARUM DIE FILTER OBEN UND NICHT IN EINEM MENÜ STEHEN ───────────────────
 * Die häufigste Frage ist „was wurde gelöscht". Sie darf keinen Klick in ein
 * Aufklappmenü kosten. Deshalb liegen die drei Stufen als Chips offen da, und
 * der Lösch-Zähler ist selbst ein Filter: Antippen zeigt die Löschungen.
 */
/**
 * Inkasso-Zuteilung.
 *
 * ── DIE FRAGE, DIE DAS BEANTWORTET ─────────────────────────────────────────
 * „Hans-Jürgen Gerhold ist unser neuer Mitarbeiter für Inkasso — wie teile ich
 * ihm Kunden zu? Wir bekommen noch 1–2 weitere, wie mache ich das mit den
 * überfälligen Zahlungen?"
 *
 * Die Antwort ist: normalerweise gar nicht. Die Verteilung läuft lastgerecht
 * von selbst — wer weniger offene Fälle hat, bekommt mehr neue. Von Hand
 * eingreifen muss man nur im Ausnahmefall.
 *
 * Zugeteilt wird eine RATE, nicht ein Kunde: Ein Kunde hat zwölf Raten, und
 * wenn Rate 3 überfällig ist und Rate 7 später auch, muss nicht derselbe
 * Mensch dran sein.
 */
function InkassoZuteilung() {
  const [d, setD] = useState<any>(null);
  const [rein, setRein] = useState<any>(null);
  const [reinFrage, setReinFrage] = useState(false);
  const [abos, setAbos] = useState<any>(null);
  const [aboFrage, setAboFrage] = useState(false);
  const [aboLaeuft, setAboLaeuft] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [frage, setFrage] = useState(false);
  const [nurAgent, setNurAgent] = useState("");

  const holen = useCallback(async () => {
    const p = new URLSearchParams();
    if (nurAgent) p.set("agent", nurAgent);
    const r = await fetch(`/api/fiaon/admin/inkasso/zuteilung?${p}`, { credentials: "include" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setD(j?.ok ? j : { hinweis: j?.error || "Nicht erreichbar." });
  }, [nurAgent]);
  useEffect(() => { void holen(); }, [holen]);

  // ── DIE BEREINIGUNG ────────────────────────────────────────────────────
  // Vertriebskunden, die bei Sonderrollen gelandet sind. Sie werden GEZEIGT,
  // nicht stillschweigend verschoben: Es betrifft drei andere Agenten, die
  // sonst morgen früh unerklärt mehr Arbeit hätten.
  useEffect(() => {
    void fetch("/api/fiaon/admin/team/sonderrollen-bereinigen", { credentials: "include" })
      .then((r) => r.json()).then((j) => setRein(j?.ok ? j : null)).catch(() => {});
  }, []);

  // ── FEHLENDE ABOS ─────────────────────────────────────────────────────
  // „JEDER Kunde BIS AUF SCHUFA (74 €) HAT EIN ABO, JEDER."
  const abosHolen = useCallback(async () => {
    const r = await fetch("/api/fiaon/admin/inkasso/abos-nachtragen", { credentials: "include" })
      .catch(() => null);
    const j = await r?.json().catch(() => null);
    setAbos(j?.ok ? j : null);
  }, []);
  useEffect(() => { void abosHolen(); }, [abosHolen]);

  const abosAnlegen = async () => {
    setAboFrage(false);
    setAboLaeuft(true);
    const r = await fetch("/api/fiaon/admin/inkasso/abos-nachtragen", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schreiben: true }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setAboLaeuft(false);
    if (j?.ok) setAbos(j);
    void abosHolen();
    void holen();
  };

  const bereinigen = async () => {
    setReinFrage(false);
    const r = await fetch("/api/fiaon/admin/team/sonderrollen-bereinigen", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schreiben: true }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setRein(j?.ok ? j : rein);
    void holen();
  };

  const verteilen = async () => {
    setFrage(false);
    setLaeuft(true);
    const r = await fetch("/api/fiaon/admin/inkasso/zuteilung", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schreiben: true, agent: nurAgent || null }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setLaeuft(false);
    setD(j?.ok ? j : { hinweis: j?.error || "Fehlgeschlagen." });
  };

  const geld = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`;
  const tage = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

  return (
    <div>
      {/* ══════════════════════════════════════════════════════════════════
          FEHLENDE ABOS

          Der Vorgesetzte: „JEDER Kunde BIS AUF SCHUFA (74 €) HAT EIN ABO,
          JEDER — ab Tag der Verbuchung, genau ab dem Tag bezahlt er JEDES
          Monat sein Paket. Jeder, der seine Rate nicht bezahlt hat, muss zum
          Inkasso kommen."

          Gemessen: 67 bezahlte Kunden hatten KEINE einzige Abo-Rate. Sie
          konnten im Forderungsmanagement nie auftauchen — nicht weil sie
          zahlten, sondern weil niemand eine Rate erwartete.
          ══════════════════════════════════════════════════════════════════ */}
      {(abos?.kandidaten ?? []).length > 0 && (
        <div className="rounded-2xl p-5 mb-4"
             style={{ background: "rgba(217,119,6,.05)", boxShadow: "inset 0 0 0 1px rgba(217,119,6,.22)" }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[14px] font-bold" style={{ color: "#b45309" }}>
                {abos.kandidaten.length} bezahlte Kunden haben keine Abo-Rate
              </h2>
              <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "#92400e", maxWidth: 660 }}>
                Jeder Kunde außer SCHUFA (74 €) zahlt ab dem Tag der Verbuchung monatlich sein Paket.
                Für diese hier wurde nie eine Rate angelegt — sie konnten im Forderungsmanagement
                nie auftauchen, egal wie lange sie nicht gezahlt haben.
                {abos.uebersprungen?.length > 0 && (
                  <> <b>{abos.uebersprungen.length}</b> davon haben weder Paket noch Betrag hinterlegt;
                  für die kann der Monatsbeitrag nicht abgeleitet werden.</>
                )}
              </p>
              <p className="text-[11.5px] mt-1.5" style={{ color: "#92400e" }}>
                Preise: {Object.entries(abos.preise ?? {}).map(([k, c]) =>
                  `${k} ${(Number(c) / 100).toFixed(2)} €`).join(" · ")}
              </p>
            </div>
            <button type="button" onClick={() => setAboFrage(true)} disabled={aboLaeuft}
                    className="fi-knopf-primaer px-5 shrink-0">
              {aboLaeuft ? "Legt an …" : `${abos.ratenGesamt} Raten anlegen`}
            </button>
          </div>
          <div className="mt-3.5 rounded-xl overflow-hidden bg-white"
               style={{ boxShadow: "inset 0 0 0 1px rgba(217,119,6,.16)", maxHeight: 280, overflowY: "auto" }}>
            {abos.kandidaten.map((k: any) => (
              <div key={k.ref} className="px-3.5 py-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5"
                   style={{ borderBottom: "1px solid #fffbeb", opacity: k.problem ? .55 : 1 }}>
                <span className="text-[12.5px] font-semibold text-slate-800">{k.name}</span>
                <span className="text-[11px] font-mono text-slate-400">{k.ref}</span>
                <span className="text-[11.5px] font-semibold"
                      style={{ color: k.problem ? "#b91c1c" : "var(--fi-primaer)" }}>
                  {k.problem ? "kein Betrag ableitbar" : `${k.packKey} · ${(k.betragCents / 100).toFixed(2)} €`}
                </span>
                <span className="ml-auto shrink-0 text-[11.5px] text-slate-500">
                  ab {k.start} {k.ausBank ? "(Bankbuchung)" : "(Anlagedatum)"} ·{" "}
                  <b style={{ color: k.ratenFaellig > 0 ? "#b45309" : "inherit" }}>
                    {k.ratenFaellig} überfällig
                  </b>
                </span>
              </div>
            ))}
          </div>
          {!abos.kandidaten.some((k: any) => k.ausBank) && (
            <p className="text-[11.5px] mt-2 leading-relaxed" style={{ color: "#92400e" }}>
              Für keinen dieser Kunden gibt es eine zugeordnete Bankbuchung — der Starttag kommt
              vom Anlagedatum der Bestellung. Das ist die schlechtere, aber einzige Auskunft.
            </p>
          )}
        </div>
      )}

      {(abos?.schufaMitRaten ?? []).length > 0 && (
        <p className="mb-4 px-4 py-3 rounded-xl text-[12.5px] leading-relaxed"
           style={{ background: "rgba(185,28,28,.06)", color: "#b91c1c" }}>
          <b>{abos.schufaMitRaten.length} SCHUFA-Bestellungen haben Abo-Raten.</b> Eine
          Bonitätsauskunft ist eine Einmalzahlung — sie darf keine monatliche Rate haben.
        </p>
      )}

      <FiaonEbene
        offen={aboFrage} onZu={() => setAboFrage(false)}
        titel={`${abos?.ratenGesamt ?? 0} Raten anlegen?`}
        ueberschrift="Das löst Mahnungen aus"
        breite={520}
        kinder={
          <>
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--fi-text-leise)" }}>
              Für {abos?.kandidaten?.filter((k: any) => !k.problem).length ?? 0} Kunden werden
              zusammen {abos?.ratenGesamt ?? 0} Raten angelegt — alle, die seit dem Starttag fällig
              geworden sind, plus die nächste.
            </p>
            <p className="mt-2.5 text-[12.5px] leading-relaxed" style={{ color: "var(--fi-text-still)" }}>
              <b>Was danach passiert:</b> Jeder mit einer überfälligen Rate steht im
              Forderungsmanagement und bekommt die üblichen Zahlungserinnerungen. Das ist gewollt —
              aber es ist ein Vorgang, der beim Kunden ankommt.
            </p>
            <p className="mt-2.5 text-[12.5px] leading-relaxed" style={{ color: "var(--fi-text-still)" }}>
              SCHUFA-Bestellungen (74 €) bleiben unberührt. Kunden ohne hinterlegtes Paket werden
              übersprungen — für sie ist der Beitrag nicht ableitbar.
            </p>
          </>
        }
        fuss={
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setAboFrage(false)}
                    className="text-[13px] font-semibold" style={{ color: "var(--fi-text-still)" }}>
              Abbrechen
            </button>
            <button type="button" onClick={() => void abosAnlegen()} className="ml-auto fi-knopf-primaer px-5">
              Jetzt anlegen
            </button>
          </div>
        }
      />

      {/* ══════════════════════════════════════════════════════════════════
          FALSCH ZUGEWIESENE VERTRIEBSKUNDEN

          Der Vorgesetzte: „Die Abteilung Forderungsmanagement hat Kunden
          drinnen, die die Agenten abgelehnt haben oder auf nicht erreicht."

          Gemessen: 22 Vertriebskunden lagen bei den beiden
          Inkasso-Mitarbeitern. Ursache war die Lead-Zuteilung — sie prüfte
          „aktiv" und „nimmt an der Verteilung teil", aber NICHT die Rolle.
          Ein neues Inkasso-Konto hat null Kunden und war damit immer „der
          Agent mit der kleinsten Last".

          Der Hahn ist zu. Diese Karte räumt auf, was durchgelaufen ist.
          ══════════════════════════════════════════════════════════════════ */}
      {(rein?.zeilen ?? []).length > 0 && (
        <div className="rounded-2xl p-5 mb-4"
             style={{ background: "rgba(185,28,28,.045)", boxShadow: "inset 0 0 0 1px rgba(185,28,28,.2)" }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[14px] font-bold" style={{ color: "#b91c1c" }}>
                {rein.zeilen.length} Vertriebskunden liegen beim Forderungsmanagement
              </h2>
              <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "#7f1d1d", maxWidth: 640 }}>
                Sie kamen über die Lead-Zuteilung dorthin: Die hat geprüft, wer aktiv ist und an der
                Verteilung teilnimmt — aber nicht, welche Rolle jemand hat. Ein neues Inkasso-Konto
                hat null Kunden und war damit immer „der mit der kleinsten Last".
                <b> Das ist behoben — neue kommen keine mehr dazu.</b> Diese hier gehen zurück in den
                Vertrieb, gleichmäßig verteilt.
              </p>
            </div>
            <button type="button" onClick={() => setReinFrage(true)}
                    className="fi-knopf-gefahr fi-knopf-gefahr-voll px-5 shrink-0"
                    style={{ minHeight: 40 }}>
              {rein.zeilen.length} zurückgeben
            </button>
          </div>
          <div className="mt-3.5 rounded-xl overflow-hidden bg-white"
               style={{ boxShadow: "inset 0 0 0 1px rgba(185,28,28,.14)", maxHeight: 260, overflowY: "auto" }}>
            {rein.zeilen.map((z: any) => (
              <div key={z.personId} className="px-3.5 py-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5"
                   style={{ borderBottom: "1px solid #fef2f2" }}>
                <span className="text-[12.5px] font-semibold text-slate-800">{z.name}</span>
                <span className="text-[11.5px]" style={{ color: "#b45309" }}>
                  Stufe {z.stufe}{z.grund ? ` · ${z.grund}` : ""}
                </span>
                <span className="ml-auto shrink-0 text-[11.5px] text-slate-500">
                  {z.vonName} <span style={{ color: "var(--fi-primaer)" }}>→ {z.anName}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {rein && (rein.zeilen ?? []).length === 0 && (
        <p className="mb-4 px-4 py-3 rounded-xl text-[12.5px] leading-relaxed"
           style={{ background: "rgba(5,150,105,.07)", color: "#047857" }}>
          Keine Sonderrolle hat Vertriebskunden. Das Forderungsmanagement sieht ausschließlich
          Kunden mit offener Rate.
        </p>
      )}

      <FiaonEbene
        offen={reinFrage} onZu={() => setReinFrage(false)}
        titel={`${rein?.zeilen?.length ?? 0} Kunden zurückgeben?`}
        ueberschrift="Bitte einmal bestätigen"
        breite={520}
        kinder={
          <>
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--fi-text-leise)" }}>
              Diese Kunden wechseln zurück in den Vertrieb — an ihren früheren Betreuer, wenn es
              einen gibt, sonst gleichmäßig an die Agenten mit der geringsten Last.
            </p>
            <p className="mt-2.5 text-[12.5px] leading-relaxed" style={{ color: "var(--fi-text-still)" }}>
              Drei Agenten bekommen dadurch mehr Arbeit. Jede Umhängung steht mit altem und neuem
              Zuständigen im Protokoll. Der Kunde merkt nichts — es geht keine Mail raus.
            </p>
          </>
        }
        fuss={
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setReinFrage(false)}
                    className="text-[13px] font-semibold" style={{ color: "var(--fi-text-still)" }}>
              Abbrechen
            </button>
            <button type="button" onClick={() => void bereinigen()}
                    className="ml-auto fi-knopf-primaer px-5">
              Jetzt zurückgeben
            </button>
          </div>
        }
      />

      {/* ── Die Mannschaft ─────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
        <h2 className="text-[14px] font-bold text-slate-900 mb-1">Wer bearbeitet Inkasso?</h2>
        <p className="text-[12px] text-slate-500 leading-relaxed mb-4" style={{ maxWidth: 620 }}>
          Die Verteilung läuft <b>lastgerecht</b>: Wer weniger offene Fälle hat, bekommt mehr neue.
          So gleicht sich ein Rückstand von selbst aus, statt sich zu verfestigen. Von Hand
          eingreifen musst du nur im Ausnahmefall.
        </p>
        {(d?.mannschaft ?? []).length === 0 ? (
          <p className="px-3.5 py-3 rounded-xl text-[12.5px] leading-relaxed"
             style={{ background: "rgba(217,119,6,.08)", color: "#b45309" }}>
            {d?.hinweis || "Kein aktiver Mitarbeiter mit der Rolle Inkasso."}
          </p>
        ) : (
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
            {d.mannschaft.map((m: any) => (
              <div key={m.id} className="px-4 py-3.5 rounded-2xl"
                   style={{ background: "rgba(37,99,235,.05)", boxShadow: "inset 0 0 0 1px rgba(37,99,235,.16)" }}>
                <p className="text-[13.5px] font-bold text-slate-800">{m.name}</p>
                <p className="text-[22px] font-bold leading-none tabular-nums mt-1.5"
                   style={{ color: "var(--fi-primaer)" }}>{m.offen}</p>
                <p className="text-[11.5px] font-semibold" style={{ color: "var(--fi-primaer)" }}>
                  offene {m.offen === 1 ? "Rate" : "Raten"}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Heute bearbeitet: {m.heuteBearbeitet}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Was liegt herum? ───────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[14px] font-bold text-slate-900">Überfällige Raten ohne Zuständigen</h2>
            <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed" style={{ maxWidth: 560 }}>
              {d?.hinweis || "Wird geladen …"}
            </p>
          </div>
          {(d?.mannschaft ?? []).length > 0 && (d?.vorschlag ?? []).length > 0 && (
            <button type="button" onClick={() => setFrage(true)} disabled={laeuft}
                    className="fi-knopf-primaer px-5 shrink-0">
              {laeuft ? "Verteilt …" : `${d.vorschlag.length} verteilen`}
            </button>
          )}
        </div>

        {(d?.mannschaft ?? []).length > 1 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[11.5px] text-slate-500">Nur an:</span>
            {([["", "Alle (lastgerecht)"], ...d.mannschaft.map((m: any) => [String(m.id), m.name])] as any[])
              .map(([w, t]) => (
                <button key={w} type="button" onClick={() => setNurAgent(w)}
                        className="px-3 py-1.5 rounded-xl text-[12px] font-semibold"
                        style={nurAgent === w
                          ? { background: "var(--fi-primaer)", color: "#fff" }
                          : { background: "rgba(15,23,42,.04)", color: "#475569" }}>
                  {t}
                </button>
              ))}
          </div>
        )}

        {(d?.vorschlag ?? []).length > 0 && (
          <div className="mt-3.5 rounded-xl overflow-hidden" style={{ boxShadow: "inset 0 0 0 1px #eef2f7" }}>
            {d.vorschlag.slice(0, 25).map((v: any) => (
              <div key={v.rateId} className="px-3.5 py-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1"
                   style={{ borderBottom: "1px solid #f8fafc" }}>
                <span className="text-[13px] font-semibold text-slate-800">{v.kunde}</span>
                <span className="text-[11.5px] font-mono" style={{ color: "var(--fi-primaer)" }}>{v.ref}</span>
                <span className="text-[12px] font-semibold tabular-nums" style={{ color: "#b45309" }}>
                  {tage(v.faelligAm)} Tage überfällig
                </span>
                <span className="text-[12px] tabular-nums text-slate-600">{geld(v.betragCents)}</span>
                <span className="ml-auto shrink-0 text-[12px] font-semibold" style={{ color: "var(--fi-primaer)" }}>
                  → {v.anAgentName}
                </span>
              </div>
            ))}
            {d.vorschlag.length > 25 && (
              <p className="px-3.5 py-2.5 text-[11.5px] text-slate-400">
                … und {d.vorschlag.length - 25} weitere. Verteilt werden alle {d.vorschlag.length}.
              </p>
            )}
          </div>
        )}
      </div>

      <FiaonEbene
        offen={frage} onZu={() => setFrage(false)}
        titel={`${d?.vorschlag?.length ?? 0} Raten verteilen?`}
        ueberschrift="Bitte einmal bestätigen"
        breite={480}
        kinder={
          <>
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--fi-text-leise)" }}>
              {d?.vorschlag?.length ?? 0} überfällige Raten werden{" "}
              {nurAgent ? "einem Mitarbeiter" : `auf ${d?.mannschaft?.length ?? 0} Mitarbeiter`} verteilt.
              Sie erscheinen dann in dessen Arbeitsliste.
            </p>
            <p className="mt-2.5 text-[12.5px] leading-relaxed" style={{ color: "var(--fi-text-still)" }}>
              Der Kunde merkt davon nichts — es wird keine Mail verschickt und keine Mahnung
              ausgelöst. Nur die Zuständigkeit wird gesetzt.
            </p>
          </>
        }
        fuss={
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setFrage(false)}
                    className="text-[13px] font-semibold" style={{ color: "var(--fi-text-still)" }}>
              Abbrechen
            </button>
            <button type="button" onClick={() => void verteilen()} className="ml-auto fi-knopf-primaer px-5">
              Jetzt verteilen
            </button>
          </div>
        }
      />
    </div>
  );
}

function AktivitaetTafel() {
  const [d, setD] = useState<any>(null);
  const [schwere, setSchwere] = useState<"" | "hoch" | "mittel">("");
  const [typ, setTyp] = useState("");
  const [agent, setAgent] = useState("");
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [team, setTeam] = useState<any[]>([]);
  const [laedt, setLaedt] = useState(true);

  const holen = useCallback(async () => {
    setLaedt(true);
    const p = new URLSearchParams();
    if (schwere) p.set("schwere", schwere);
    if (typ) p.set("typ", typ);
    if (agent) p.set("agent", agent);
    if (von) p.set("von", von);
    if (bis) p.set("bis", bis);
    const r = await fetch(`/api/fiaon/admin/team/aktivitaet?${p}`, { credentials: "include" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setD(j?.ok ? j : null);
    setLaedt(false);
  }, [schwere, typ, agent, von, bis]);
  useEffect(() => { void holen(); }, [holen]);

  useEffect(() => {
    void fetch("/api/fiaon/admin/zentrale/team", { credentials: "include" })
      .then((r) => r.json()).then((j) => setTeam(j?.team ?? [])).catch(() => {});
  }, []);

  // ── ANRUFE, DIE EINE KLÄRUNG BRAUCHEN ──────────────────────────────────
  // Beim Umbau der Anruf-Zuordnung (16.08.2026) blieben vier Anrufe übrig, bei
  // denen sich nicht eindeutig sagen ließ, wem sie gehören. Sie tragen eine
  // Marke in der Datenbank — die niemand gefunden hätte. Hier ist sie sichtbar.
  const [pruefAnrufe, setPruefAnrufe] = useState<any>(null);
  useEffect(() => {
    void fetch("/api/fiaon/admin/team/anrufe-pruefen", { credentials: "include" })
      .then((r) => r.json()).then((j) => { if (j?.ok) setPruefAnrufe(j); }).catch(() => {});
  }, []);

  const zeit = (s: string) => new Date(s).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/Berlin",
  });

  const stufe = (w: string) => w === "hoch"
    ? { farbe: "#b91c1c", flaeche: "rgba(185,28,28,.08)", wort: "Sensibel" }
    : w === "mittel"
      ? { farbe: "#b45309", flaeche: "rgba(217,119,6,.08)", wort: "Beachten" }
      : { farbe: "#64748b", flaeche: "rgba(15,23,42,.045)", wort: "Notiz" };

  // Löschungen sind eine eigene Frage — der Katalog kennt sie.
  const loeschTypen = (d?.katalog ?? [])
    .filter((k: any) => /gelöscht|Löschung|archiviert|entfernt|zusammengeführt/i.test(k.titel))
    .map((k: any) => k.typ);

  return (
    <div>
      {/* ── Die Zahlen ─────────────────────────────────────────────────── */}
      {d?.zahlen && (
        <div className="mb-4 grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))" }}>
          <button type="button"
                  onClick={() => { setSchwere(""); setTyp(loeschTypen[0] ?? ""); }}
                  className="px-4 py-3.5 rounded-2xl text-left"
                  style={{ background: "rgba(185,28,28,.06)", boxShadow: "inset 0 0 0 1px rgba(185,28,28,.18)" }}>
            <p className="text-[24px] font-bold leading-none tabular-nums" style={{ color: "#b91c1c" }}>
              {d.zahlen.loeschungenWoche}
            </p>
            <p className="text-[11.5px] font-semibold mt-1" style={{ color: "#b91c1c" }}>
              {d.zahlen.loeschungenWoche === 1 ? "Löschung" : "Löschungen"} diese Woche
            </p>
            {d.zahlen.letzteLoeschung && (
              <p className="text-[11px] mt-1 leading-snug" style={{ color: "#7f1d1d" }}>
                Letzte: {d.zahlen.letzteLoeschung.titel} von {d.zahlen.letzteLoeschung.wer},{" "}
                {zeit(d.zahlen.letzteLoeschung.am)}
              </p>
            )}
            <p className="text-[11px] mt-1.5 font-semibold" style={{ color: "#b91c1c" }}>Ansehen</p>
          </button>

          {([["Sensible Aktionen (7 Tage)", d.zahlen.hochWoche, "#b45309"],
             ["Heute insgesamt", d.zahlen.heute, "#1d4ed8"]] as const).map(([t, w, f]) => (
            <div key={t} className="px-4 py-3.5 rounded-2xl"
                 style={{ background: `${f}0f`, boxShadow: `inset 0 0 0 1px ${f}26` }}>
              <p className="text-[24px] font-bold leading-none tabular-nums" style={{ color: f }}>{w}</p>
              <p className="text-[11.5px] font-semibold mt-1" style={{ color: f }}>{t}</p>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ANRUFE MIT MARKE „ZUORDNUNG PRÜFEN"

          Vier Anrufe aus dem Umbau vom 16.08.2026, bei denen die gewählte
          Nummer keinen oder mehrere Menschen traf. Sie standen als Marke in
          der Datenbank — sichtbar war sie nirgends. Eine Marke, die niemand
          findet, ist keine Marke.
          ══════════════════════════════════════════════════════════════════ */}
      {pruefAnrufe && pruefAnrufe.anzahl > 0 && (
        <div className="rounded-2xl p-4 mb-4"
             style={{ background: "rgba(180,83,9,.055)", boxShadow: "inset 0 0 0 1px rgba(180,83,9,.24)" }}>
          <p className="text-[13.5px] font-bold" style={{ color: "#92400e" }}>
            {pruefAnrufe.anzahl} {pruefAnrufe.anzahl === 1 ? "Anruf braucht" : "Anrufe brauchen"} eine Klärung
          </p>
          <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "#92400e" }}>
            {pruefAnrufe.hinweis}
          </p>
          <ul className="mt-3 space-y-1.5">
            {pruefAnrufe.anrufe.map((a: any) => (
              <li key={a.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-white px-3 py-2"
                  style={{ boxShadow: "inset 0 0 0 1px rgba(180,83,9,.16)" }}>
                <span className="text-[11.5px] font-mono text-slate-500">{zeit(a.beginn)}</span>
                <span className="text-[12.5px] font-semibold text-slate-900">{a.nummer}</span>
                <span className="text-[12px] text-slate-600">{a.kunde}</span>
                {a.agent && <span className="text-[11.5px] text-slate-400">durch {a.agent}</span>}
                <span className="text-[11.5px] font-semibold" style={{ color: "#b45309" }}>
                  {String(a.marke).replace(/^Zuordnung prüfen:\s*/, "")}
                </span>
                {a.hatAufnahme && (
                  <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(15,23,42,.06)", color: "#475569" }}>
                    Aufnahme da
                  </span>
                )}
                {a.akte && (
                  <a href={a.akte} className="ml-auto text-[11.5px] font-semibold"
                     style={{ color: "#1d4ed8" }}>
                    Zur Akte
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Filter ─────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {([["", "Alles"], ["hoch", "Nur sensibel"], ["mittel", "Nur beachten"]] as const).map(([w, t]) => (
            <button key={w} type="button" onClick={() => { setSchwere(w); setTyp(""); }}
                    className="px-3.5 py-2 rounded-xl text-[12.5px] font-semibold"
                    style={schwere === w && !typ
                      ? { background: "var(--fi-primaer)", color: "#fff" }
                      : { background: "rgba(15,23,42,.04)", color: "#475569" }}>
              {t}
            </button>
          ))}
          <select value={typ} onChange={(e) => { setTyp(e.target.value); setSchwere(""); }}
                  aria-label="Aktionsart"
                  className="px-3 py-2 rounded-xl text-[12.5px] font-semibold"
                  style={{ background: "rgba(15,23,42,.04)", color: "#475569", border: 0 }}>
            <option value="">Jede Aktionsart</option>
            {(d?.katalog ?? []).map((k: any) => (
              <option key={k.typ} value={k.typ}>{k.titel}</option>
            ))}
          </select>
          <select value={agent} onChange={(e) => setAgent(e.target.value)} aria-label="Person"
                  className="px-3 py-2 rounded-xl text-[12.5px] font-semibold"
                  style={{ background: "rgba(15,23,42,.04)", color: "#475569", border: 0 }}>
            <option value="">Jede Person</option>
            {team.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <input type="date" value={von} onChange={(e) => setVon(e.target.value)} aria-label="Von"
                 className="px-3 py-2 rounded-xl text-[12.5px]"
                 style={{ background: "rgba(15,23,42,.04)", color: "#475569", border: 0 }} />
          <input type="date" value={bis} onChange={(e) => setBis(e.target.value)} aria-label="Bis"
                 className="px-3 py-2 rounded-xl text-[12.5px]"
                 style={{ background: "rgba(15,23,42,.04)", color: "#475569", border: 0 }} />
          {(schwere || typ || agent || von || bis) && (
            <button type="button"
                    onClick={() => { setSchwere(""); setTyp(""); setAgent(""); setVon(""); setBis(""); }}
                    className="text-[12px] font-semibold" style={{ color: "var(--fi-primaer)" }}>
              Filter aufheben
            </button>
          )}
        </div>
      </div>

      {/* ── Die Liste ──────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {laedt && <p className="px-4 py-6 text-[13px] text-slate-500">Wird geladen …</p>}
        {!laedt && (d?.zeilen ?? []).length === 0 && (
          <p className="px-4 py-8 text-[13px] text-slate-500 text-center">
            Keine Aktion in diesem Zeitraum. Das ist eine gute Nachricht.
          </p>
        )}
        {(d?.zeilen ?? []).map((z: any) => {
          const st = stufe(z.schwere);
          return (
            <div key={z.id} className="px-4 py-3 flex flex-wrap items-baseline gap-x-3 gap-y-1"
                 style={{ borderBottom: "1px solid #f8fafc" }}>
              <span className="shrink-0 text-[9.5px] font-bold uppercase tracking-[.1em] px-2 py-1 rounded-md"
                    style={{ background: st.flaeche, color: st.farbe }}>
                {st.wort}
              </span>
              <span className="text-[13px] font-semibold text-slate-800">{z.titel}</span>
              <span className="text-[12.5px] text-slate-600">
                von <b className="font-semibold">{z.wer}</b>
                {z.wen && <> · betrifft <b className="font-semibold">{z.wen}</b></>}
              </span>
              {z.referenz && (
                <span className="text-[11.5px] font-mono" style={{ color: "var(--fi-primaer)" }}>{z.referenz}</span>
              )}
              <span className="ml-auto shrink-0 text-[11.5px] tabular-nums text-slate-400">{zeit(z.am)}</span>
              {z.grund && (
                <p className="w-full text-[12px] leading-snug text-slate-500 mt-0.5">{z.grund}</p>
              )}
            </div>
          );
        })}
      </div>
      {(d?.zeilen ?? []).length >= 120 && (
        <p className="mt-2 text-[11.5px] text-slate-400">
          Die neuesten 120 Einträge. Für ältere den Zeitraum eingrenzen.
        </p>
      )}
    </div>
  );
}

function TeamKosten() {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    void fetch("/api/fiaon/admin/team/wirtschaftlichkeit", { credentials: "include" })
      .then((r) => r.json()).then((j) => setD(j?.ok ? j : null)).catch(() => setD(null));
  }, []);
  if (!d || d.mitGehalt === 0) return null;

  const geld = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`;
  const gut = d.deckung >= 100;
  // Der Balken zeigt die Deckung, aber gedeckelt bei 100 %: Ein Balken, der
  // bei 461 % viermal aus dem Kasten läuft, sagt nichts mehr. Die Zahl steht
  // daneben und darf so groß sein, wie sie ist.
  const balken = Math.max(4, Math.min(100, Number(d.deckung) || 0));

  return (
    <>
      <style>{KOSTEN_CSS}</style>
      {/* ══════════════════════════════════════════════════════════════════════
          DIE KOSTENBÜHNE

          ── DER BEFUND ────────────────────────────────────────────────────────
          Der Vorgesetzte: „Die Schriftfarbe ist blau auf schwarz — mach das
          moderner, Animationen, 3D-Elemente und vor allem LESBAR!"

          Gemessen: Die Zahlen trugen `rgb(17, 24, 39)` (Tailwinds
          text-gray-900) auf `rgb(10, 26, 60)`. Kontrast praktisch null.

          Der Grund lag in der Hausregel selbst: `.fi-flaeche-tief * { color:
          inherit }` hat dieselbe Spezifität wie eine Tailwind-Utility, und
          Tailwind wird SPÄTER eingefügt. Bei gleichem Gewicht gewinnt das
          Spätere. Der Kommentar behauptete Strenge, das CSS hatte keine.

          Jetzt: eigene Klassen mit erzwungener Farbe, ein Deckungsbalken, der
          beim Erscheinen einläuft, gestaffelte Tiefe statt flacher Fläche.
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="fi-kosten" data-gut={gut ? "1" : "0"} data-fiaon="wirtschaftlichkeit">
        <div className="fi-kosten-glanz" aria-hidden="true" />

        {/* Die Karte trägt jetzt eine Überschrift. Ohne sie war es „irgendeine
            dunkle Leiste mit Zahlen" — als Karte im Kennzahlenbereich braucht
            sie einen Namen, sonst weiß niemand, was er da liest. */}
        <h3 className="fi-kosten-titel">Wirtschaftlichkeit</h3>

        <div className="fi-kosten-zahlen">
          <div className="fi-kosten-block">
            <p className="fi-kosten-marke">Personalkosten Monat</p>
            <p className="fi-kosten-wert">{geld(d.personalkosten)}</p>
          </div>
          <span className="fi-kosten-teiler" aria-hidden="true" />
          <div className="fi-kosten-block">
            <p className="fi-kosten-marke">Umsatz Monat</p>
            <p className="fi-kosten-wert">{geld(d.umsatz)}</p>
          </div>
          <span className="fi-kosten-teiler" aria-hidden="true" />
          <div className="fi-kosten-block">
            <p className="fi-kosten-marke">Deckung</p>
            <p className="fi-kosten-wert fi-kosten-deckung">{d.deckung} %</p>
          </div>
        </div>

        {/* ── DER BALKEN ─────────────────────────────────────────────────────
            Er läuft beim Erscheinen von null auf seinen Wert. Nicht als
            Verzierung: Eine Zahl allein sagt „461 %", der Balken sagt „das
            ist weit über der Linie". Zwei Sinne für dieselbe Auskunft. */}
        <div className="fi-kosten-balken" role="img"
             aria-label={`Deckung ${d.deckung} Prozent`}>
          <span className="fi-kosten-balken-fuell"
                style={{ ["--ziel" as any]: `${balken}%` }} />
          <span className="fi-kosten-balken-linie" aria-hidden="true" />
        </div>

        <p className="fi-kosten-satz">
          {d.satz} · {d.mitGehalt} {d.mitGehalt === 1 ? "Person" : "Personen"} mit Festgehalt.
        </p>

        {/* ══════════════════════════════════════════════════════════════════
            WAS FLIESST DA EIGENTLICH EIN? (19.08.2026)

            „Personalkosten" ist kein Begriff, den zwei Menschen gleich
            verstehen — und die Zahl entscheidet mit, ob jemand eingestellt wird.
            Deshalb steht die Zusammensetzung dabei, nicht in einer Dokumentation.

            NACHGERECHNET (scripts/mess-wirtschaftlichkeit.ts):
              Festgehälter anteilig   3.342,86 €
              Provisionen des Monats  3.368,10 €
              ────────────────────────────────
              Personalkosten          6.710,96 €   → geht auf

            Und eine Korrektur am Sprachgebrauch: Es sind NICHT die
            „ausgezahlten" Provisionen. Die Abfrage nimmt jede nicht stornierte
            Provision des Monats — auch bestätigte und beantragte. Das ist
            richtig (die Verbindlichkeit entsteht mit dem Abschluss, nicht mit
            der Überweisung), aber es heißt anders. Gemessen: von 3.368,10 €
            sind 1.343,80 € wirklich überwiesen.

            Stundenlöhne stecken als Provisionsart „stunden" mit drin; diesen
            Monat sind es 0,00 €.
            ══════════════════════════════════════════════════════════════════ */}
        <p className="fi-kosten-erklaerung">
          Personalkosten = Festgehälter (anteilig nach verstrichenen Arbeitstagen)
          + alle gebuchten Provisionen und Stundenlöhne dieses Monats, auch die noch
          nicht überwiesenen. Umsatz = Bemessungsgrundlage dieser Provisionen ohne
          Stunden. Deckung = Umsatz ÷ Personalkosten.
        </p>
      </div>
    </>
  );
}

const KOSTEN_CSS = `
/* ── DIE KOSTENBÜHNE ────────────────────────────────────────────────────────
   Dunkel, aber lesbar: Jede Schriftfarbe steht ausdrücklich, keine wird
   geerbt. Die Hausregel „inherit" hat gegen Tailwind verloren. */
.fi-kosten {
  position: relative;
  overflow: hidden;
  margin-bottom: 14px;
  padding: 18px 20px 16px;
  border-radius: 22px;
  background:
    radial-gradient(120% 140% at 8% 0%, rgba(59,130,246,.22), transparent 58%),
    linear-gradient(158deg, #16305f, #0b1b3f 58%, #071129);
  /* Gestaffelte Tiefe: ein enger Schatten für die Kante, ein weiter für die
     Höhe, eine Lichtkante oben. Drei Ebenen ergeben eine Fläche, die über
     der Seite zu schweben scheint statt aufgeklebt zu sein. */
  box-shadow:
    0 2px 8px -3px rgba(7,17,41,.5),
    0 26px 54px -28px rgba(7,17,41,.8),
    inset 0 1px 0 rgba(255,255,255,.14),
    inset 0 0 0 1px rgba(255,255,255,.07);
  animation: fiKostenAuf 520ms cubic-bezier(.32,.72,0,1) both;
}
@keyframes fiKostenAuf {
  from { opacity: 0; transform: translateY(10px) scale(.995); }
  to   { opacity: 1; transform: none; }
}

/* Ein wandernder Glanz — sehr dezent, einmal alle acht Sekunden. Er macht die
   Fläche lebendig, ohne die Aufmerksamkeit zu fordern. */
.fi-kosten-glanz {
  position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(105deg, transparent 38%, rgba(255,255,255,.055) 48%, transparent 58%);
  transform: translateX(-120%);
  animation: fiKostenGlanz 8s ease-in-out 1.2s infinite;
}
@keyframes fiKostenGlanz {
  0%, 72%, 100% { transform: translateX(-120%); }
  86% { transform: translateX(120%); }
}

.fi-kosten-zahlen {
  position: relative; z-index: 1;
  display: flex; align-items: flex-end; flex-wrap: wrap; gap: 0 22px;
}
.fi-kosten-block { min-width: 0; }
.fi-kosten-teiler {
  width: 1px; height: 30px; align-self: center;
  background: linear-gradient(180deg, transparent, rgba(255,255,255,.16), transparent);
}
.fi-kosten-marke {
  font-size: 9.5px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase;
  color: rgba(191,214,247,.72) !important;
  margin-bottom: 3px;
}
/* Die Zahl: ausdrücklich weiß, mit tabellarischen Ziffern. Ohne das
   !important gewinnt Tailwinds text-gray-900 — gemessen. */
.fi-kosten-wert {
  font-size: 21px; font-weight: 700; line-height: 1.05;
  font-variant-numeric: tabular-nums;
  color: #f4f8ff !important;
  text-shadow: 0 1px 0 rgba(7,17,41,.5);
}
.fi-kosten[data-gut="1"] .fi-kosten-deckung { color: #6ee7b7 !important; }
.fi-kosten[data-gut="0"] .fi-kosten-deckung { color: #fcd34d !important; }

/* ── DER BALKEN ─────────────────────────────────────────────────────────── */
.fi-kosten-balken {
  position: relative; z-index: 1;
  height: 7px; margin: 13px 0 11px;
  border-radius: 999px; overflow: hidden;
  background: rgba(7,17,41,.55);
  box-shadow: inset 0 1px 2px rgba(0,0,0,.4);
}
.fi-kosten-balken-fuell {
  display: block; height: 100%; width: var(--ziel, 0%);
  border-radius: 999px;
  background: linear-gradient(90deg, #3b82f6, #34d399);
  box-shadow: 0 0 14px -2px rgba(52,211,153,.55);
  animation: fiKostenBalken 900ms cubic-bezier(.32,.72,0,1) 180ms both;
}
.fi-kosten[data-gut="0"] .fi-kosten-balken-fuell {
  background: linear-gradient(90deg, #f59e0b, #fcd34d);
  box-shadow: 0 0 14px -2px rgba(252,211,77,.5);
}
@keyframes fiKostenBalken { from { width: 0; } to { width: var(--ziel, 0%); } }
/* Die 100-Prozent-Linie: Ohne sie ist der Balken eine Länge ohne Maßstab. */
.fi-kosten-balken-linie {
  position: absolute; top: -2px; bottom: -2px; left: calc(100% - 1.5px);
  width: 1.5px; background: rgba(255,255,255,.4);
}

.fi-kosten-satz {
  position: relative; z-index: 1;
  font-size: 11.5px; line-height: 1.5;
  color: rgba(191,214,247,.74) !important;
}
/* ── DIE ÜBERSCHRIFT DER KARTE ─────────────────────────────────────────────
   Ruhig, klein, in Versalien — die Karte lebt von den Zahlen, nicht vom Titel.
   Farbe ausdrücklich (die Hausregel „inherit" verliert gegen Tailwind). */
.fi-kosten-titel {
  position: relative; z-index: 1;
  margin: 0 0 10px;
  font-size: 10.5px; font-weight: 700;
  letter-spacing: .11em; text-transform: uppercase;
  color: rgba(191,214,247,.66) !important;
}
/* ── DIE ERKLÄRZEILE ──────────────────────────────────────────────────────
   Leiser als der Satz darüber: Sie wird einmal gelesen und danach nur noch
   gebraucht, wenn jemand die Zahl anzweifelt. */
.fi-kosten-erklaerung {
  position: relative; z-index: 1;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(191,214,247,.14);
  font-size: 10.5px; line-height: 1.55;
  color: rgba(191,214,247,.52) !important;
  max-width: 78ch;
}
/* ── PLATZ FÜR DEN TELEFONKNOPF ────────────────────────────────────────────
   Er schwebt rechts unten und überdeckte auf 390 px den Satz „2 Personen mit
   Festgehalt". Derselbe Fehler wie am 11.08. in der Vertriebsliste: Ein
   schwebendes Element gehört in die Platzrechnung, nicht darüber hinweg.
   Gemessen per Bounding-Box: 64 px breit, 14 px vom Rand — 82 px genügen. */
@media (max-width: 639px) {
  .fi-kosten-satz { padding-right: 82px; }
}

@media (max-width: 639px) {
  .fi-kosten { padding: 15px 16px 14px; border-radius: 18px; }
  .fi-kosten-zahlen { gap: 0 16px; }
  .fi-kosten-wert { font-size: 18px; }
  .fi-kosten-teiler { display: none; }
  .fi-kosten-block { flex: 1 1 44%; }
}

@media (prefers-reduced-motion: reduce) {
  .fi-kosten, .fi-kosten-balken-fuell { animation: none !important; }
  .fi-kosten-glanz { display: none; }
  .fi-kosten-balken-fuell { width: var(--ziel, 0%); }
}
`;

/**
 * „Lohnt sich dieser Mensch?" — Kosten gegen Beitrag, heute und im Monat.
 *
 * ── WAS DIESE ZAHL IST UND WAS NICHT ───────────────────────────────────────
 * Sie beantwortet EINE Frage: Hat dieser Mensch heute mehr hereingeholt, als
 * er heute gekostet hat. Sie ist KEIN Deckungsbeitrag im buchhalterischen
 * Sinn — keine Arbeitsplatzkosten, keine Abgaben, keine Werbung. Das steht
 * auch so auf der Karte; eine Zahl, die mehr verspricht, als sie hält, führt
 * zu Entscheidungen, die man später bereut.
 */
function LohntSich({ agentId, name }: { agentId: number; name: string }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    void fetch(`/api/fiaon/admin/team/wirtschaftlichkeit/${agentId}`, { credentials: "include" })
      .then((r) => r.json()).then((j) => setD(j?.ok ? j : null)).catch(() => setD(null));
  }, [agentId]);

  if (!d) return <p className="text-[13px] text-slate-500">Wird gerechnet …</p>;

  const geld = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`;
  const gut = d.deckung >= 100;
  const hoechst = Math.max(1, ...d.verlauf.map((v: any) => Math.max(v.beitrag, v.kosten)));

  return (
    <>
      {/* Die Kachel, die der Vorgesetzte im Vorbeigehen liest. */}
      <div className="p-4 rounded-2xl fi-flaeche-tief">
        <p className="text-[10.5px] font-bold uppercase tracking-[.12em] fi-leise">Heute</p>
        <p className="mt-1.5 text-[22px] font-bold leading-none tracking-tight"
           style={{ color: gut ? "#6ee7b7" : d.deckung > 0 ? "#fcd34d" : "#fca5a5" }}>
          {d.satz}
        </p>
        <div className="mt-3.5 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[11px] fi-leise">Kosten heute</p>
            <p className="text-[16px] font-bold tabular-nums">{geld(d.kosten.gesamt)}</p>
            <p className="text-[10.5px] fi-leise leading-snug mt-0.5">
              {d.kosten.gehaltAnteil > 0 && `${geld(d.kosten.gehaltAnteil)} Gehaltsanteil`}
              {d.kosten.gehaltAnteil > 0 && (d.kosten.stunden > 0 || d.kosten.provisionen > 0) && " · "}
              {d.kosten.stunden > 0 && `${geld(d.kosten.stunden)} Stunden`}
              {d.kosten.stunden > 0 && d.kosten.provisionen > 0 && " · "}
              {d.kosten.provisionen > 0 && `${geld(d.kosten.provisionen)} Provision`}
              {d.kosten.gesamt === 0 && "keine hinterlegt"}
            </p>
          </div>
          <div>
            <p className="text-[11px] fi-leise">Hereingeholt</p>
            <p className="text-[16px] font-bold tabular-nums">{geld(d.beitrag)}</p>
            <p className="text-[10.5px] fi-leise mt-0.5">Auftragswert seiner Abschlüsse</p>
          </div>
        </div>

        {/* Die Linie: 30 Tage Beitrag gegen die Kostenlinie. */}
        <div className="mt-4 flex items-end gap-[3px]" style={{ height: 46 }}>
          {d.verlauf.map((v: any) => {
            const h = Math.max(2, Math.round((v.beitrag / hoechst) * 44));
            const gedeckt = v.kosten === 0 || v.beitrag >= v.kosten;
            return (
              <span key={v.tag} title={`${v.tag}: ${geld(v.beitrag)}`}
                    style={{
                      flex: 1, height: h, borderRadius: 2,
                      background: v.beitrag === 0
                        ? "rgba(255,255,255,.1)"
                        : gedeckt ? "rgba(110,231,183,.85)" : "rgba(252,211,77,.8)",
                    }} />
            );
          })}
        </div>
        <p className="mt-1.5 text-[10px] fi-leise">30 Tage · grün = Kosten gedeckt</p>
      </div>

      {/* Der Monat. */}
      <div className="mt-3 p-4 rounded-2xl" style={{ background: "rgba(15,23,42,.03)", boxShadow: "inset 0 0 0 1px rgba(15,23,42,.07)" }}>
        <p className="text-[10.5px] font-bold uppercase tracking-[.12em] text-slate-500">Dieser Monat</p>
        <div className="mt-2 grid grid-cols-3 gap-3">
          {[
            ["Kosten", geld(d.monat.kosten)],
            ["Umsatz", geld(d.monat.beitrag)],
            ["Deckung", `${d.monat.deckung} %`],
          ].map(([t, w]) => (
            <div key={t}>
              <p className="text-[11px] text-slate-500">{t}</p>
              <p className="text-[15px] font-bold tabular-nums text-slate-900">{w}</p>
            </div>
          ))}
        </div>
        <p className="mt-2.5 text-[12px] text-slate-600 leading-relaxed">
          {d.monat.breakEvenTag
            ? `Break-even am ${new Date(d.monat.breakEvenTag).toLocaleDateString("de-DE", { day: "numeric", month: "long" })} — ab da arbeitet ${name} für den Gewinn.`
            : d.monat.kosten === 0
              ? "Kein Festgehalt hinterlegt — dieser Mensch kostet nur, was er verdient."
              : "Der Break-even ist diesen Monat noch nicht erreicht."}
        </p>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Diese Rechnung enthält Festgehalt, bestätigte Stunden und gebuchte Provisionen —
        keine Arbeitsplatzkosten, keine Abgaben, keine Werbekosten. Sie beantwortet eine
        einzige Frage: Hat dieser Mensch heute mehr hereingeholt, als er heute gekostet hat.
        Der Umsatz kommt aus derselben Quelle wie die Rangliste, es wird nicht zweimal gezählt.
      </p>
    </>
  );
}

export default function AdminTeamZentrale() {

  // ══════════════════════════════════════════════════════════════════════
  // DER ACADEMY-STAND JE MENSCH
  //
  // Eine Abfrage für alle, nicht eine je Karte: Bei sechs Mitarbeitern wären das
  // sechs Aufrufe für eine Zahl. Die Route liefert sie gebündelt.
  //
  // AGENTS.md: Haken stehen ÜBER dem ersten `return`.
  // ══════════════════════════════════════════════════════════════════════
  const [academyStand, setAcademyStand] = useState<Map<number, any>>(new Map());
  useEffect(() => {
    void fetch("/api/fiaon/admin/academy/stand", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        // Ohne Stand zeigt jede Karte „Kapitel 0" — nicht von „hat nichts
        // gemacht" zu unterscheiden.
        if (!j?.ok) {
          console.error("[TEAM] Academy-Stand nicht geladen, die Karten zeigen 0:", j?.error);
          return;
        }
        setAcademyStand(new Map((j.mitarbeiter ?? [])
          .map((x: any) => [Number(x.id), x])));
      })
      .catch(() => {});
  }, []);
  const [team, setTeam] = useState<Mitglied[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [offen, setOffen] = useState<number | null>(null);
  const [rang, setRang] = useState(false);
  const [nachrichtAn, setNachrichtAn] = useState<number[] | null>(null);
  const [meldung, setMeldung] = useState<{ art: "gut" | "schlecht"; text: string } | null>(null);
  // Vier Blöcke, die aus der Altseite nachgezogen wurden. Reiter statt einer
  // endlos langen Seite: Wer Skripte pflegt, will nicht an dreißig
  // Mitarbeiterkarten vorbeiscrollen.
  // ── „NACHBUCHUNG“ IST EIN REITER, KEIN GERÜCHT ──────────────────────────
  // `/admin/nachbuchung` leitet seit dem 10.08.2026 um auf
  // „/admin/team?tab=nachbuchung“ — und diesen Reiter gab es NICHT. Ein
  // unbekannter Wert fällt hier auf „menschen“ zurück: Der Betreiber landete
  // auf der Mitarbeiterliste, ohne jeden Hinweis, und meldete zu Recht „ich
  // kann keine Provisionen mehr nachbuchen“.
  //
  // Die Funktion war die ganze Zeit da — vier Ebenen tief im Mitarbeiter-
  // Detail. Jetzt ist sie da, wo der Weg schon hinzeigte.
  const [reiter, setReiter] = useState<
    "menschen" | "nachbuchung" | "aktivitaet" | "inkasso" | "neu" | "partner"
    | "praemien" | "skripte" | "einstellungen"
  >(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    return (["menschen", "nachbuchung", "aktivitaet", "inkasso", "neu", "partner", "praemien", "skripte", "einstellungen"].includes(String(t))
      ? t : "menschen") as any;
  });
  const [einladen, setEinladen] = useState(
    () => new URLSearchParams(window.location.search).get("einladen") === "1",
  );

  // ── TESTKONTEN SIND EIN FILTER, KEIN DAUERGAST ──────────────────────────
  // GEMESSEN am 17.08.2026: 49 Mitarbeiter-Konten, davon 43 Testkonten aus
  // Prüfständen — und 6 echte Menschen. Der Betreiber sah 11 Karten.
  //
  // Der Server entscheidet, was hereinkommt (echteMitarbeiterSql). Hier ist
  // nur der Umschalter, damit die Konten nicht verschwinden, sondern
  // WEGGERÄUMT sind: Wer wissen will, was ein Prüfstand angelegt hat, sieht es.
  const [nurTest, setNurTest] = useState(false);
  const [testZahl, setTestZahl] = useState<{ test: number; echt: number; testAktiv: number } | null>(null);
  const [telefonie, setTelefonie] = useState<Record<string, any> | null>(null);

  const laden = useCallback(async () => {
    setLaedt(true);
    // ── BEIM UMSCHALTEN DIE ALTEN KARTEN WEGNEHMEN ────────────────────────
    // Aufgefallen auf dem Screenshot: Der Kopf stand schon auf „Testkonten“,
    // darunter standen weiter die sechs Menschen und dazwischen „Wird geladen“.
    // Zwei Aussagen auf einem Bildschirm, die sich widersprechen, kosten mehr
    // Vertrauen als eine halbe Sekunde Leerraum.
    setTeam([]);
    const r = await fetch(`/api/fiaon/admin/zentrale/team${nurTest ? "?test=1" : ""}`,
      { credentials: "include" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok) {
      setTeam(j.team || []);
      if (j.testkonten) setTestZahl(j.testkonten);
      // Der Telefonie-Nachweis je Mitarbeiter (31.08.2026): Versuche,
      // Annahmequote, Kurzgespräche, Stumm-Verdacht. Damit ist in drei Tagen
      // belegbar, ob Nikitas 40 % Kurzgespräche am Mikrofon lagen.
      setTelefonie(j.telefonie || null);
    }
    setLaedt(false);
  }, [nurTest]);
  useEffect(() => { void laden(); }, [laden]);

  const sortiert = useMemo(() => {
    const l = [...team];
    // Rangliste: nach Umsatz des Monats. Sonst: aktive zuerst, Testkonten ans
    // Ende — sie sind keine Kollegen, sondern Werkzeug.
    if (rang) l.sort((a, b) => Number(b.umsatz_monat_cents) - Number(a.umsatz_monat_cents));
    return l;
  }, [team, rang]);

  return (
    <>
      <div className="max-w-[1400px] mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900">Team-Zentrale</h1>
            <p className="text-[12.5px] text-slate-500 mt-0.5">
              {nurTest
                ? "Testkonten aus Prüfständen und Knopf-Durchgängen — sie zählen in keiner Kennzahl mit."
                : "Kennzahlen, Provisionen, Protokolle und Nachrichten — alles zu einem Menschen an einem Ort."}
              {!nurTest && testZahl && testZahl.test > 0 && (
                <span className="block mt-0.5 text-[11.5px] text-slate-400">
                  {testZahl.echt} {testZahl.echt === 1 ? "Mensch" : "Menschen"} im Team ·{" "}
                  {testZahl.test} Testkonten ausgeblendet
                  {testZahl.testAktiv > 0 && ` (${testZahl.testAktiv} davon noch aktiv)`}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setRang((r) => !r)}
                    className="px-3.5 py-2 rounded-xl text-[12.5px] font-semibold"
                    style={rang ? { background: "#1d4ed8", color: "#fff" } : { background: "#fff", border: "1px solid #e2e8f0", color: "#475569" }}>
              Rangliste Monat
            </button>
            <button type="button" onClick={() => setNachrichtAn(team.filter((m) => m.active && (!m.is_test_account || m.pruefkonto)).map((m) => m.id))}
                    className="px-3.5 py-2 rounded-xl text-[12.5px] font-semibold bg-white border border-slate-200 text-slate-600">
              Nachricht ans Team
            </button>
            {/* Nur zeigen, wenn es überhaupt Testkonten gibt — ein Filter für
                eine leere Menge ist ein Knopf ins Leere. */}
            {testZahl && testZahl.test > 0 && (
              <button type="button" onClick={() => setNurTest((v) => !v)}
                      title={nurTest
                        ? "Zurück zu den echten Menschen"
                        : `${testZahl.test} Konten aus Prüfständen und Knopf-Durchgängen ansehen`}
                      className="px-3.5 py-2 rounded-xl text-[12.5px] font-semibold"
                      style={nurTest
                        ? { background: "#475569", color: "#fff" }
                        : { background: "#fff", border: "1px solid #e2e8f0", color: "#64748b" }}>
                {nurTest ? `Testkonten (${testZahl.test}) — zurück zum Team` : `Testkonten ${testZahl.test}`}
              </button>
            )}
            <button type="button" onClick={() => setEinladen(true)}
                    className="px-3.5 py-2 rounded-xl text-[12.5px] font-bold text-white bg-[#1d4ed8]">
              Teammitglied anlegen
            </button>
          </div>
        </div>

        {/* ── Reiter ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {([
            ["menschen", "Menschen"],
            ["nachbuchung", "Provisionen nachbuchen"],
            // Aktivität steht an ZWEITER Stelle: Sie ist die Aufsicht, und
            // eine Aufsicht, die man suchen muss, wird nicht benutzt.
            ["aktivitaet", "Aktivität"],
            ["inkasso", "Inkasso-Zuteilung"],
            ["neu", "Neu im Team"],
            ["partner", "Partner-Anfragen"],
            ["praemien", "Meilenstein-Prämien"],
            ["skripte", "Skripte & Leitfäden"],
            ["einstellungen", "Einstellungen"],
          ] as const).map(([w, t]) => (
            <button key={w} type="button"
                    onClick={() => {
                      setReiter(w);
                      const p = new URLSearchParams(window.location.search);
                      w === "menschen" ? p.delete("tab") : p.set("tab", w);
                      window.history.replaceState(null, "", `/admin/team${p.toString() ? `?${p}` : ""}`);
                    }}
                    className="px-3.5 py-2 rounded-xl text-[12.5px] font-semibold"
                    style={reiter === w
                      ? { background: "#1d4ed8", color: "#fff" }
                      : { background: "#fff", border: "1px solid #e2e8f0", color: "#475569" }}>
              {t}
            </button>
          ))}
        </div>

        {meldung && (
          <p className="mb-3 px-3.5 py-2.5 rounded-xl text-[12.5px] font-semibold"
             style={meldung.art === "gut"
               ? { background: "rgba(5,150,105,.08)", color: "#047857" }
               : { background: "rgba(217,119,6,.08)", color: "#b45309" }}>
            {meldung.text}
          </p>
        )}

        {laedt && <p className="py-10 text-center text-[13px] text-slate-400">Wird geladen …</p>}

        {reiter === "neu" && <NeuImTeam onNachricht={(id) => setNachrichtAn([id])} />}
        {reiter === "partner" && (
          <PartnerSuggestionsCard flash={(m) => setMeldung({ art: "gut", text: m })} onChanged={laden} />
        )}
        {reiter === "praemien" && (
          <MilestoneTasksCard flash={(m) => setMeldung({ art: "gut", text: m })} />
        )}
        {reiter === "skripte" && (
          <ScriptsAdmin flash={(m) => setMeldung({ art: "gut", text: m })} />
        )}
        {reiter === "einstellungen" && (
          <SettingsCard flash={(m) => setMeldung({ art: "gut", text: m })} onSaved={laden} />
        )}

        {reiter === "nachbuchung" && (
          <NachbuchenTafel onMeldung={(art, text) => setMeldung({ art, text })} />
        )}
        {reiter === "aktivitaet" && <AktivitaetTafel />}
        {reiter === "inkasso" && <InkassoZuteilung />}

        {/* ══════════════════════════════════════════════════════════════════
            DIE WIRTSCHAFTLICHKEIT STEHT OBEN, NICHT UNTEN (19.08.2026)

            Die Personalkosten lagen als dunkle Leiste UNTER den Karten — nach
            zwei Dutzend Menschen, dort, wo niemand hinsieht. Entscheidung des
            Betreibers: keine Leiste mehr, sondern eine normale Karte im
            Kennzahlenbereich.

            Das ist mehr als Umstellen: Eine Zahl, die man nur beim Scrollen
            findet, ändert nichts (AGENTS.md, „Eine Zahl, die niemand sieht").
            Und die Erklärzeile darunter ist Pflicht — „Personalkosten" ist kein
            Begriff, den zwei Menschen gleich verstehen.
            ══════════════════════════════════════════════════════════════════ */}
        {reiter === "menschen" && <TeamKosten />}

        {reiter === "menschen" && (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {sortiert.map((m, i) => (
            <div key={m.id}
                 className="bg-white rounded-2xl border border-slate-200 p-4 relative overflow-hidden"
                 style={{
                   boxShadow: "0 1px 2px rgba(15,23,42,.04)",
                   opacity: m.active ? 1 : 0.55,
                   animation: `teamAuf 420ms cubic-bezier(.32,.72,0,1) ${Math.min(i, 8) * 45}ms both`,
                 }}>
              {rang && i < 3 && (
                <span className="absolute left-0 top-0 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                      style={{ background: "rgba(29,78,216,.07)", color: "#1d4ed8", borderBottomRightRadius: 10 }}>
                  Platz {i + 1}
                </span>
              )}
              <KartenMenue m={m} laden={laden} onProfil={() => setOffen(m.id)} />
              <button type="button" onClick={() => setOffen(m.id)} className="w-full text-left">
                <div className="flex items-start gap-3">
                  <Avatar src={m.avatar} name={m.name} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-bold text-slate-900 truncate">
                      {m.name}
                      {m.is_test_account && <span className="ml-2 text-[10px] font-bold uppercase text-slate-400">Testkonto</span>}
                    </p>
                    {/* ══════════════════════════════════════════════════════
                        DIE VERWALTUNG STEHT IM DREI-PUNKTE-MENÜ (19.08.2026)

                        Hier stand „als Testkonto markieren" als sichtbarer Link
                        unter JEDEM Namen. Der Betreiber: „Verwaltungsmüll im
                        Alltagsbild" — und er hat recht: Neben einem Menschen,
                        den man jeden Tag ansieht, steht die eine Handlung, die
                        man fast nie braucht, und sie sagt außerdem „Test" über
                        einem echten Kollegen.

                        Der Schalter bleibt (die Marke wird von jedem Prüfstand
                        gesetzt und trifft irgendwann wieder ein echtes Konto —
                        deshalb gehört er dorthin, wo der Betreiber das Konto
                        sieht, und nicht in ein Skript). Er steht jetzt im Menü,
                        zusammen mit den zwei Wegen, die es vorher an der Karte
                        gar nicht gab: Profil öffnen und Als Mitarbeiter ansehen.
                        ══════════════════════════════════════════════════════ */}
                    <p className="text-[11.5px] text-slate-400">
                      {ROLLE_TEXT[m.rolle] ?? m.rolle}
                      {!m.active && " · deaktiviert"}
                      {m.active && !m.distribution_active && " · keine Verteilung"}
                    </p>
                    {/* ══════════════════════════════════════════════════════
                        TELEFONIE, 7 TAGE (31.08.2026)

                        Die gemeldete Quote „2 von 158" hat sich NICHT
                        bestätigt (55–64 % Annahme). Aufgefallen ist etwas
                        anderes: Kurzgespräche unter fünf Sekunden — bei einem
                        Mitarbeiter 40 %, bei einem anderen 58 %, beim dritten
                        5 %. Diese Zeile macht es vergleichbar.

                        Bernstein ab einem Drittel Kurzgespräche: Das ist ein
                        HINWEIS, kein Urteil. Wer abhebt und sofort auflegt,
                        sieht genauso aus wie einer, der nichts hört.
                        ══════════════════════════════════════════════════════ */}
                    {(() => {
                      const t = telefonie?.[String(m.id)];
                      if (!t || t.versuche === 0) return null;
                      const auffaellig = t.unter5sQuote >= 33;
                      return (
                        <p className="text-[11px] mt-0.5 tabular-nums"
                           title={"7 Tage, ausgehend. Kurzgespräche = angenommen und unter 5 Sekunden."}
                           style={{ color: auffaellig ? "#92400e" : "#64748b" }}>
                          {t.versuche} Anrufe · {t.annahmeQuote} % angenommen ·{" "}
                          <b>{t.unter5s} unter 5 s ({t.unter5sQuote} %)</b>
                          {t.schnittSek > 0 && ` · Ø ${t.schnittSek} s`}
                          {t.stumm > 0 && ` · ${t.stumm} stumm-verdächtig`}
                        </p>
                      );
                    })()}
                    {/* ══════════════════════════════════════════════════════
                        DER ACADEMY-STAND (29.08.2026)

                        Die Route `/admin/academy/stand` lieferte diese Zahl seit
                        dem 28.08. — es gab nur keine Anzeige. Genau der Fehler,
                        der beim Produkt-Knopf vier Tage Arbeit blockiert hat:
                        „Die Route existiert" ist keine Funktion.

                        Kein Urteil, nur ein Stand: Die Leitung sieht, mit wem
                        sie noch einmal durchgehen sollte. Wer nichts angefangen
                        hat, steht in Bernstein — nicht in Rot. Eine Farbe, die
                        anklagt, erzeugt Ausreden statt Gespräche.
                        ══════════════════════════════════════════════════════ */}
                    {/* ── ROT IST FEHLERN VORBEHALTEN (19.08.2026) ──────────
                        „Kapitel 0/14 — noch nicht geöffnet" stand in Bernstein
                        (#92400e). Der Betreiber liest das als Fehlermeldung —
                        und es ist keine: Ein Mensch, der die Academy noch nicht
                        geöffnet hat, ist kein Defekt.

                        Jetzt eine dezente graue Zeile mit kleinem Balken. Der
                        Balken sagt mehr als die Farbe: 3/14 und 12/14 sehen
                        verschieden aus, ohne dass eine Farbe jemanden anklagt.
                        Grün bleibt für „durch" — das ist eine Auszeichnung,
                        keine Anklage. */}
                    {(() => {
                      const ac = academyStand.get(Number(m.id));
                      if (!ac) return null;
                      const soll = Number(ac.kapitelSoll ?? 0);
                      const ist = Number(ac.kapitelIst ?? 0);
                      const anteil = soll > 0 ? Math.min(1, Math.max(0, ist / soll)) : 0;
                      const durch = soll > 0 && ist >= soll;
                      return (
                        <div className="mt-1" data-fiaon="academy-stand">
                          <p className="text-[11px]" style={{ color: durch ? "#047857" : "#94a3b8" }}>
                            {ac.kurz}
                            {!ac.angefangen && soll > 0 && " · noch nicht geöffnet"}
                          </p>
                          {soll > 0 && (
                            <div className="mt-1 h-[3px] w-full rounded-full overflow-hidden"
                                 style={{ background: "#f1f5f9" }}
                                 role="progressbar" aria-valuenow={ist} aria-valuemin={0}
                                 aria-valuemax={soll}
                                 aria-label={`Academy ${ist} von ${soll} Kapiteln`}>
                              <div style={{
                                width: `${Math.round(anteil * 100)}%`, height: "100%",
                                background: durch ? "#047857" : "#cbd5e1",
                                transition: "width 500ms cubic-bezier(.32,.72,0,1)",
                              }} />
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3.5">
                  {[
                    { t: "Umsatz Monat", w: eur(m.umsatz_monat_cents) },
                    { t: "Abschlüsse", w: String(m.abschluesse_monat) },
                    { t: "Erreichbar", w: m.erreichbarkeit != null ? `${m.erreichbarkeit} %` : "—" },
                  ].map((k) => (
                    <div key={k.t}>
                      <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">{k.t}</p>
                      <p className="text-[15px] font-bold text-slate-900 tabular-nums leading-tight">{k.w}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 pt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-slate-500"
                     style={{ borderTop: "1px solid #f1f5f9" }}>
                  {/* ── BESTAND UND WAS HEUTE ANSTEHT ─────────────────────────
                      Hier stand bis zum 11.08.2026 der SQL-Quelltext statt der
                      Zahl: `bestandSql(1)` wurde in ein getaggtes Template
                      eingesetzt, wo jedes ${…} als PARAMETER gebunden wird —
                      der Ausdruck landete als Text-Literal in der Antwort.
                      Jede Karte zeigte drei Absätze SQL.

                      Mein Fehler dabei war nicht der Ausdruck, sondern die
                      Abnahme: `tsc` und `esbuild` waren grün, weil es weder
                      ein Typ- noch ein Syntaxfehler ist. Nur der Browser
                      hätte es gezeigt. */}
                  <span>Bestand <b className="text-slate-800 tabular-nums">{m.bestand}</b></span>
                  <span className="tabular-nums">
                    A {m.stufe_a} · B {m.stufe_b} · C {m.stufe_c}
                    {m.stufe_a_heute != null && (
                      <b className="ml-1.5" style={{ color: "var(--fi-primaer)" }}>
                        ({Number(m.stufe_a_heute) + Number(m.stufe_b_heute ?? 0) + Number(m.stufe_c_heute ?? 0)} heute dran)
                      </b>
                    )}
                  </span>
                  <span>Kontakte heute <b className="text-slate-800 tabular-nums">{m.heute}</b></span>
                  <span className="ml-auto">{wann(m.letzte_aktivitaet)}</span>
                </div>

                <div className="mt-2 text-[11.5px] text-slate-400">
                  Offen <b className="text-slate-700">{eur(m.offen_cents)}</b> ·
                  ausgezahlt {eur(m.ausgezahlt_cents)}
                  {m.commission_rate_bp != null && ` · ${(m.commission_rate_bp / 100).toFixed(1).replace(".", ",")} %`}
                </div>
              </button>
            </div>
          ))}
        </div>
        )}
        <style>{`
          @keyframes teamAuf { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
          @media (prefers-reduced-motion: reduce) { [style*="teamAuf"] { animation: none !important } }
        `}</style>
      </div>

      {offen != null && (
        <MitgliedDetail id={offen} team={team} onZu={() => setOffen(null)}
                        onNachricht={(id) => setNachrichtAn([id])} onAenderung={laden} />
      )}
      {einladen && (
        <InviteModal
          defaults={{ commissionRateBp: 1500 }}
          onClose={() => setEinladen(false)}
          onDone={() => { setEinladen(false); void laden(); }}
          flash={(m: string) => setMeldung({ art: "gut", text: m })}
        />
      )}
      {nachrichtAn && (
        <NachrichtDialog agentIds={nachrichtAn} team={team} onZu={() => setNachrichtAn(null)}
                         onFertig={(t) => { setNachrichtAn(null); setMeldung({ art: "gut", text: t }); }} />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DETAIL — die Schublade
// ═══════════════════════════════════════════════════════════════════════════

function MitgliedDetail({
  id, team, onZu, onNachricht, onAenderung,
}: {
  id: number; team: Mitglied[]; onZu: () => void; onNachricht: (id: number) => void; onAenderung: () => void;
}) {
  const m = team.find((x) => x.id === id);
  const [reiter, setReiter] = useState<
    "zahlen" | "lohnt" | "verwaltung" | "protokoll" | "provision" | "verguetung" | "gespraeche"
  >("zahlen");
  // ── DIE AKTE: PROVISIONSVERLAUF UND GESPRÄCHE ──────────────────────────
  // Beides lag längst in der Datenbank — 98 Provisionen, Anrufe mit agent_id.
  // Es gab nur keinen Ort, wo man sie sieht.
  const [akte, setAkte] = useState<any>(null);
  const [auswertung, setAuswertung] = useState<any>(null);
  const [wertetAus, setWertetAus] = useState(false);
  const [offenerAnruf, setOffenerAnruf] = useState<number | null>(null);
  const [logs, setLogs] = useState<any>(null);
  const [logArt, setLogArt] = useState("");
  const [logSuche, setLogSuche] = useState("");
  const [satz, setSatz] = useState(m ? String((m.commission_rate_bp ?? 0) / 100) : "");
  const [busy, setBusy] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [kandidaten, setKandidaten] = useState<any[] | null>(null);

  const logsLaden = useCallback(async () => {
    const p = new URLSearchParams();
    if (logArt) p.set("art", logArt);
    if (logSuche) p.set("q", logSuche);
    const r = await fetch(`/api/fiaon/admin/zentrale/team/${id}/logs?${p}`, { credentials: "include" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok) setLogs(j);
  }, [id, logArt, logSuche]);

  useEffect(() => { if (reiter === "protokoll") void logsLaden(); }, [reiter, logsLaden]);

  // ── DIE AKTE ────────────────────────────────────────────────────────────
  // Eine Abfrage für alles: Provisionsverlauf, Gespräche, Auszahlungen,
  // Kundenbewegungen, Ereignisse. Wer eine Akte öffnet, will nicht sechsmal
  // warten.
  useEffect(() => {
    if (!id) return;
    setAkte(null); setAuswertung(null); setOffenerAnruf(null);
    void fetch(`/api/fiaon/admin/team/${id}/akte`, { credentials: "include" })
      .then((r) => r.json()).then((j) => setAkte(j?.ok ? j : null)).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (reiter !== "provision" || kandidaten) return;
    fetch("/api/fiaon/admin/commission-backfill/candidates", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setKandidaten(j?.candidates ?? j?.kandidaten ?? []))
      .catch(() => setKandidaten([]));
  }, [reiter, kandidaten]);

  if (!m) return null;

  const satzSpeichern = async () => {
    setBusy("satz");
    // DERSELBE Endpunkt wie in der alten Team-Seite. Kein zweiter Weg, der
    // eines Tages anders prüft als der erste.
    const r = await fetch(`/api/fiaon/admin/agents/${id}/update`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commissionRateBp: Math.round(Number(satz.replace(",", ".")) * 100) }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(null);
    setHinweis(j?.ok ? "Provisionssatz gespeichert." : (j?.error || "Fehler."));
    if (j?.ok) onAenderung();
  };

  return (
    <FiaonEbene
      offen onZu={onZu}
      titel={m.name}
      ueberschrift={ROLLE_TEXT[m.rolle] ?? m.rolle}
      unterzeile={`${m.email} · zuletzt ${wann(m.last_login_at)} angemeldet`}
      breite={760}
      marke={<Avatar src={m.avatar} name={m.name} size={36} />}
      kopf={
        <>
          <div className="flex items-start gap-3">
            <Avatar src={m.avatar} name={m.name} size={44} />
            <div className="min-w-0 flex-1">
              <h2 className="text-[19px] font-bold tracking-tight text-slate-900" style={{ overflowWrap: "anywhere" }}>
                {m.name}
              </h2>
              {/* UMBRECHEN statt kürzen — der Vorgesetzte hat abgeschnittene
                  Texte gemeldet. Eine Mailadresse, die man nicht ganz sieht,
                  kann man nicht abtippen. */}
              <p className="text-[12px] text-slate-400 leading-snug" style={{ overflowWrap: "anywhere" }}>
                {ROLLE_TEXT[m.rolle] ?? m.rolle} · {m.email}
                <br />zuletzt {wann(m.last_login_at)} angemeldet
              </p>
            </div>
            <button type="button" onClick={onZu} aria-label="Schließen" className="fi-ebene-kreuz shrink-0">
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                   strokeWidth={1.6} strokeLinecap="round"><path d="m5 5 10 10M15 5 5 15" /></svg>
            </button>
          </div>
          {/* Die Reiterleiste rollt waagerecht, statt umzubrechen: Sechs
              Reiter auf 380 px sind sonst drei Zeilen hoch. */}
          <div className="mt-3.5 flex gap-1.5 overflow-x-auto pb-0.5"
               style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {([["zahlen", "Zahlen"], ["lohnt", "Lohnt sich?"],
               // ── GESPRÄCHE UND PROVISIONSVERLAUF ──────────────────────────
               // Der Vorgesetzte: „Unter ‚Provisionen' findet man keine
               // Verläufe. Ich muss die Gespräche beim Agenten zugewiesen
               // haben, der sie geführt hat. Ich muss KI-Auswertungen machen
               // können."
               //
               // Beides lag in der Datenbank: 98 Provisionen und die Anrufe
               // mit `agent_id`. Es gab nur keinen Ort, wo man sie sieht.
               ["gespraeche", "Gespräche"],
               ["provision", "Provisionen"], ["verwaltung", "Verwaltung"],
               ["verguetung", "Vergütung & Stunden"],
               ["protokoll", "Protokoll"]] as const)
              .map(([w, t]) => (
                <button key={w} type="button" onClick={() => setReiter(w)}
                        className="shrink-0 px-3 py-1.5 rounded-xl text-[12.5px] font-semibold whitespace-nowrap"
                        style={reiter === w
                          ? { background: "#1d4ed8", color: "#fff", boxShadow: "0 8px 18px -10px rgba(29,78,216,.6)" }
                          : { background: "rgba(15,23,42,.045)", color: "#64748b" }}>
                  {t}
                </button>
              ))}
            <button type="button" onClick={() => onNachricht(m.id)}
                    className="shrink-0 ml-auto px-3 py-1.5 rounded-xl text-[12.5px] font-semibold bg-white text-slate-600"
                    style={{ boxShadow: "inset 0 0 0 1px #e2e8f0" }}>
              Nachricht
            </button>
          </div>
        </>
      }
      kinder={
        <>
          {hinweis && <p className="mb-3 text-[12.5px] font-semibold text-emerald-700">{hinweis}</p>}

          {reiter === "lohnt" && <LohntSich agentId={m.id} name={m.name} />}

          {reiter === "zahlen" && (
            <>
              <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
                {[
                  { t: "Umsatz Monat", w: eur(m.umsatz_monat_cents) },
                  { t: "Abschlüsse", w: String(m.abschluesse_monat) },
                  { t: "Kontakte Woche", w: String(m.woche) },
                  { t: "Erreichbarkeit", w: m.erreichbarkeit != null ? `${m.erreichbarkeit} %` : "—" },
                  // ── ZWEI ZAHLEN, WEIL EINE IRREFÜHRT ─────────────────────
                  // Der Vorgesetzte: „In meiner Ansicht steht, dass er so und
                  // so viele A-, B- und C-Kunden hat — in seiner Ansicht steht
                  // aber was ganz anderes!"
                  //
                  // Gemessen für Daniel Stripling, Stufe A: hier 58, in seiner
                  // Kundenliste 30, in seiner Arbeitsliste 4. Keine Zahl war
                  // falsch — falsch war, dass sie dieselbe Überschrift trugen.
                  //
                  // Wer 58 sieht und fragt, warum nur vier abgearbeitet
                  // wurden, stellt die falsche Frage. Und der Agent kann sich
                  // nicht wehren, weil er die 58 nie gesehen hat.
                  { t: "Bestand A", w: String(m.stufe_a),
                    zusatz: m.stufe_a_heute != null ? `${m.stufe_a_heute} heute dran` : null },
                  { t: "Bestand B", w: String(m.stufe_b),
                    zusatz: m.stufe_b_heute != null ? `${m.stufe_b_heute} heute dran` : null },
                  { t: "Bestand C", w: String(m.stufe_c),
                    zusatz: m.stufe_c_heute != null ? `${m.stufe_c_heute} heute dran` : null },
                  { t: "Offen", w: eur(m.offen_cents) },
                ].map((k) => (
                  <div key={k.t} className="p-3 rounded-xl bg-slate-50">
                    <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 leading-tight">{k.t}</p>
                    <p className="text-[17px] font-bold text-slate-900 tabular-nums leading-tight mt-0.5">{k.w}</p>
                    {(k as any).zusatz && (
                      <p className="text-[10px] leading-tight mt-0.5" style={{ color: "var(--fi-primaer)" }}>
                        {(k as any).zusatz}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mt-5 mb-2">
                Provisionssatz
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input value={satz} onChange={(e) => setSatz(e.target.value)} inputMode="decimal"
                       aria-label="Provisionssatz in Prozent"
                       className="w-24 px-3 py-2.5 rounded-xl border border-slate-200 text-[13.5px] tabular-nums outline-none"
                       style={{ minHeight: 42 }} />
                <span className="text-[13px] text-slate-400">Prozent</span>
                <button type="button" onClick={() => void satzSpeichern()} disabled={busy === "satz"}
                        className="px-4 py-2.5 rounded-xl text-[13px] font-bold text-white bg-[#1d4ed8] disabled:opacity-40">
                  {busy === "satz" ? "…" : "Speichern"}
                </button>
              </div>
              <p className="mt-2 text-[11.5px] text-slate-400 leading-snug">
                Änderungen wirken auf künftige Buchungen. Bereits gebuchte Provisionen bleiben, wie sie sind.
              </p>
            </>
          )}

          {reiter === "verwaltung" && (
            <>
              {/* ── PORTAL ANSEHEN ─────────────────────────────────────────
                  Der Vorgesetzte: „ich kann mir ja nicht ein Account machen um
                  jede Abteilung, jedes Dashboard zu sehen." Jetzt: ein Klick,
                  neuer Tab, das Portal exakt so, wie dieser Mensch es sieht —
                  aber NUR LESEND. Jede schreibende Route lehnt die Sitzung
                  serverseitig ab, an einer Stelle. */}
              <div className="mb-4 p-4 rounded-2xl fi-flaeche-tief">
                <p className="text-[10.5px] font-bold uppercase tracking-[.12em] fi-leise">Durchblick</p>
                <p className="mt-1 text-[14px] font-bold">
                  Portal ansehen als {m.first_name || m.name}
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed fi-leise">
                  Öffnet das Team-Portal in einem neuen Tab, genau so, wie {m.first_name || "diese Person"} es
                  sieht — Rolle, Kundenliste, Verdienst, Space.{" "}
                  <b style={{ color: "#fff" }}>Nur-Ansicht:</b> Es lassen sich keine Ergebnisse buchen,
                  keine Mails senden und keine Beiträge schreiben. Die Sitzung läuft nach
                  30 Minuten von selbst ab und wird protokolliert.
                </p>
                <button type="button"
                        onClick={async () => {
                          const r = await fetch(`/api/fiaon/admin/team/ansicht/${m.id}`, {
                            method: "POST", credentials: "include",
                          }).catch(() => null);
                          const j = await r?.json().catch(() => null);
                          if (!j?.ok) { setHinweis(j?.error || "Ansicht konnte nicht gestartet werden."); return; }
                          window.open(j.ziel || "/agent/start", "_blank", "noopener");
                        }}
                        className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold"
                        style={{ background: "rgba(255,255,255,.14)", color: "#fff",
                                 boxShadow: "inset 0 1px 0 rgba(255,255,255,.2)" }}>
                  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                       strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1.8 10S4.9 4.5 10 4.5 18.2 10 18.2 10 15.1 15.5 10 15.5 1.8 10 1.8 10Z" />
                    <circle cx="10" cy="10" r="2.4" />
                  </svg>
                  Portal öffnen
                </button>
              </div>
              <VerwaltungTafel m={m} onAenderung={onAenderung} onHinweis={setHinweis} onZu={onZu} />
            </>
          )}

          {reiter === "verguetung" && <VerguetungTafel agentId={id} rolle={m.rolle} />}

          {reiter === "protokoll" && (
            <>
              {/* Die „genaue Klicks"-Ansicht. Alles hier steht seit Monaten
                  in der Datenbank — es war nur nie an einem Ort lesbar. */}
              <div className="flex flex-wrap gap-2 mb-3">
                <input value={logSuche} onChange={(e) => setLogSuche(e.target.value)}
                       onKeyDown={(e) => { if (e.key === "Enter") void logsLaden(); }}
                       placeholder="Im Protokoll suchen …"
                       className="flex-1 min-w-[150px] px-3 py-2 rounded-xl border border-slate-200 text-[13px] outline-none"
                       style={{ minHeight: 40 }} />
                <select value={logArt} onChange={(e) => setLogArt(e.target.value)}
                        aria-label="Art"
                        className="px-3 py-2 rounded-xl border border-slate-200 text-[12.5px]" style={{ minHeight: 40 }}>
                  <option value="">Alle Arten</option>
                  <option value="kontakt">Kundenkontakte</option>
                  {(logs?.arten ?? []).map((a: string) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              {!logs && <p className="text-[13px] text-slate-400">Wird geladen …</p>}
              {logs?.eintraege?.length === 0 && (
                <p className="text-[13px] text-slate-400">Kein Eintrag für diese Filter.</p>
              )}
              {(logs?.eintraege ?? []).map((e: any) => (
                <div key={`${e.quelle}-${e.id}`} className="py-2 text-[12.5px]" style={{ borderBottom: "1px solid #f8fafc" }}>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                      {new Date(e.created_at).toLocaleString("de-DE", {
                        day: "2-digit", month: "2-digit", year: "2-digit",
                        hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin",
                      })}
                    </span>
                    <span className="font-bold text-slate-800">{e.art}</span>
                    {e.ref && <span className="font-mono text-[11px] text-slate-400">{e.ref}</span>}
                    {e.actor && <span className="text-[11px] text-slate-400">durch {e.actor}</span>}
                  </div>
                  {(e.reason || e.notiz || e.meta) && (
                    <p className="text-[11.5px] text-slate-500 leading-snug mt-0.5"
                       style={{ overflowWrap: "anywhere" }}>
                      {e.reason || e.notiz || String(e.meta).slice(0, 200)}
                    </p>
                  )}
                </div>
              ))}
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              GESPRÄCHE ÜBER DAS PLATTFORM-TELEFON

              „Ich muss die Gespräche, die durch das Plattform-Telefon geführt
              wurden, beim Agenten zugewiesen haben, der sie geführt hat. Ich
              muss KI-Auswertungen machen können."

              Sie waren zugewiesen — über `fiaon_calls.agent_id`. Sie waren nur
              nie sichtbar.
              ══════════════════════════════════════════════════════════════════ */}
          {reiter === "gespraeche" && (
            <>
              {akte?.anrufZahlen && (
                <div className="grid gap-2 mb-3.5"
                     style={{ gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))" }}>
                  {([
                    // „Gespräche" zählt jetzt nur, was diese Person BELEGT
                    // geführt hat — dieselbe Menge wie die Liste darunter.
                    // „Verbunden" trennt Wahlversuche von Gesprächen: über die
                    // Hälfte aller Zeilen kam nie durch.
                    ["Gespräche", String(akte.anrufZahlen.anrufe)],
                    ["Verbunden", String(akte.anrufZahlen.verbunden ?? "—")],
                    ["Erreicht", `${akte.anrufZahlen.erreicht}`],
                    ["Gesprächszeit", `${Math.round(Number(akte.anrufZahlen.sekunden) / 60)} Min`],
                    ["Aufnahmen", String(akte.anrufZahlen.aufnahmen)],
                    ["Ausgewertet", String(akte.anrufZahlen.ausgewertet)],
                  ] as const).map(([t, w]) => (
                    <div key={t} className="px-3 py-2.5 rounded-xl bg-slate-50">
                      <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 leading-tight">{t}</p>
                      <p className="text-[16px] font-bold text-slate-900 tabular-nums leading-tight mt-0.5">{w}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* ── DIE KI-AUSWERTUNG ─────────────────────────────────────────
                  Beobachtungen, keine Note. Eine Zahl von eins bis zehn über
                  einen Menschen beendet das Gespräch mit ihm; eine Beobachtung
                  eröffnet es. */}
              <div className="rounded-2xl p-4 mb-3.5"
                   style={{ background: "rgba(37,99,235,.05)", boxShadow: "inset 0 0 0 1px rgba(37,99,235,.16)" }}>
                <div className="flex flex-wrap items-start justify-between gap-2.5">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold" style={{ color: "var(--fi-primaer)" }}>
                      Gespräche auswerten lassen
                    </p>
                    <p className="text-[11.5px] text-slate-500 mt-0.5 leading-relaxed" style={{ maxWidth: 460 }}>
                      Die KI liest die Transkripte der letzten 30 Tage und nennt Beobachtungen —
                      was gut läuft, wo Gespräche abbrechen, was ungesagt bleibt. Keine Note:
                      Ein Transkript hat keinen Tonfall.
                    </p>
                  </div>
                  <button type="button" disabled={wertetAus}
                          onClick={async () => {
                            setWertetAus(true); setAuswertung(null);
                            const r = await fetch(`/api/fiaon/admin/team/${id}/gespraeche-auswerten`, {
                              method: "POST", credentials: "include",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ tage: 30, max: 12 }),
                            }).catch(() => null);
                            const j = await r?.json().catch(() => null);
                            setWertetAus(false);
                            setAuswertung(j?.auswertung ?? { ok: false, grund: "Keine Antwort vom Server." });
                          }}
                          className="fi-knopf-primaer px-4 shrink-0" style={{ minHeight: 38 }}>
                    {wertetAus ? "Liest …" : "Auswerten"}
                  </button>
                </div>
                {auswertung && (
                  <div className="mt-3 px-3.5 py-3 rounded-xl bg-white"
                       style={{ boxShadow: "inset 0 0 0 1px rgba(37,99,235,.12)" }}>
                    {auswertung.ok ? (
                      <>
                        <p className="text-[11px] font-semibold mb-2" style={{ color: "var(--fi-primaer)" }}>
                          {auswertung.gespraeche} Gespräche · {auswertung.minuten} Minuten ·{" "}
                          {auswertung.von} bis {auswertung.bis}
                        </p>
                        <p className="text-[13px] leading-relaxed text-slate-700"
                           style={{ whiteSpace: "pre-wrap" }}>{auswertung.text}</p>
                        <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed">
                          Beruht auf Transkripten. Ein Transkript hat keinen Tonfall, keine Pause,
                          kein Zögern — das Anhören ersetzt es nicht.
                        </p>
                      </>
                    ) : (
                      <p className="text-[12.5px] leading-relaxed" style={{ color: "#b45309" }}>
                        {auswertung.grund}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* ── DIE GESPRÄCHE ─────────────────────────────────────────── */}
              {!akte && <p className="text-[13px] text-slate-400">Wird geladen …</p>}
              {akte && (akte.anrufe ?? []).length === 0 && (
                <p className="text-[13px] text-slate-400">
                  Über das Plattform-Telefon wurde noch kein Gespräch geführt.
                </p>
              )}
              {(akte?.anrufe ?? []).map((a: any) => (
                <div key={a.id} className="py-2.5" style={{ borderBottom: "1px solid #f8fafc" }}>
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[12.5px]">
                    {/* Ein Name, dem man nicht glauben darf, wird nicht gezeigt.
                        AGENTS.md: „Eine sichtbare Lücke ist ehrlich; eine
                        gefüllte Lücke ist eine Behauptung." Die Nummer steht
                        stattdessen — die ist belegt. */}
                    {a.zuordnung_unklar_am
                      ? <span className="font-semibold" style={{ color: "#b45309" }}>
                          Zuordnung unklar · {a.nummer}
                        </span>
                      : <span className="font-semibold text-slate-800">{a.kunde}</span>}
                    <span className="text-slate-400 tabular-nums">
                      {new Date(a.beginn).toLocaleString("de-DE", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                        timeZone: "Europe/Berlin",
                      })}
                    </span>
                    {a.dauer_sek != null && (
                      <span className="text-slate-500 tabular-nums">
                        {Math.floor(a.dauer_sek / 60)}:{String(a.dauer_sek % 60).padStart(2, "0")} Min
                      </span>
                    )}
                    {/* ── ERGEBNISSE IN KLARTEXT ────────────────────────────
                        Im Schnappschuss stand „nicht_erreicht" — die Kennung
                        aus der Datenbank. Ein Vorgesetzter, der eine Akte
                        liest, soll keine Feldnamen entziffern. */}
                    {a.ergebnis
                      ? <span className="font-semibold"
                              style={{ color: /zahlt|erreicht_zahlt/.test(a.ergebnis) ? "#047857"
                                : /nicht_erreicht|mailbox/.test(a.ergebnis) ? "#b45309" : "#475569" }}>
                          {({
                            erreicht_zahlt_gleich: "zahlt sofort",
                            erreicht_zahlt_am: "zahlt am …",
                            erreicht_abgelehnt: "abgelehnt",
                            nicht_erreicht: "nicht erreicht",
                            mailbox: "Mailbox besprochen",
                            rueckruf_termin: "Rückruf vereinbart",
                            nummer_falsch: "falsche Nummer",
                            nummer_blockiert: "Nummer blockiert",
                            notiz: "Notiz",
                          } as Record<string, string>)[a.ergebnis] ?? a.ergebnis}
                        </span>
                      : <span className="font-semibold text-amber-700">ohne Ergebnis</span>}
                    <span className="ml-auto flex items-center gap-2 shrink-0">
                      {/* „Anhören" nur, wenn es wirklich etwas zu hören gibt.
                          Im Schnappschuss stand beides nebeneinander: der Knopf
                          UND „ohne Aufzeichnung". Ein Widerspruch, den man erst
                          durch Klicken auflöst. */}
                      {a.hat_aufnahme && !a.ohne_aufzeichnung_am && (
                        <button type="button"
                                onClick={() => setOffenerAnruf(offenerAnruf === a.id ? null : a.id)}
                                className="text-[11.5px] font-semibold" style={{ color: "var(--fi-primaer)" }}>
                          {offenerAnruf === a.id ? "Player zu" : "Anhören"}
                        </button>
                      )}
                      {a.aufnahme_geloescht_am && (
                        <span className="text-[11px] text-slate-400">Aufnahme gelöscht</span>
                      )}
                      {a.ohne_aufzeichnung_am && (
                        <span className="text-[11px] text-slate-400">ohne Aufzeichnung</span>
                      )}
                    </span>
                  </div>
                  {/* ══════════════════════════════════════════════════════════
                      WER · WEN · WELCHE NUMMER (19.08.2026)

                      Der Betreiber: „Der Kundenname links passt oft nicht zum
                      Gesprächsinhalt." Man hört eine Aufnahme und liest einen
                      Namen daneben — und kann den Widerspruch erst NACH dem
                      Anhören bemerken.

                      Diese Zeile macht ihn vorher sichtbar: geführt von wem,
                      welcher Kunde, welche Nummer wurde gewählt. Passt die
                      Nummer nicht zur Person, steht es rot dabei statt als
                      stiller Widerspruch.
                      ══════════════════════════════════════════════════════════ */}
                  <p className="text-[11px] mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5"
                     data-fiaon="anruf-herkunft" style={{ color: "#94a3b8" }}>
                    <span>geführt von <b style={{ color: "#64748b" }}>{a.gefuehrt_von ?? "—"}</b></span>
                    <span>· Kunde <b style={{ color: "#64748b" }}>{a.kunde}</b></span>
                    <span>· Nummer <span className="tabular-nums">{a.nummer ?? "—"}</span></span>
                    {a.kunde_betreuer && (
                      <span>· betreut von {a.kunde_betreuer}</span>
                    )}
                    {/* Ein Wahlversuch, der nie durchkam, ist kein Gespräch.
                        GEMESSEN: über die Hälfte aller Zeilen. Ohne diese Marke
                        liest man drei Zeilen „Klaus Peter Feltes" und hält die
                        Liste für kaputt. */}
                    {(a.dauer_sek ?? 0) === 0 && (
                      <span className="px-1.5 py-0.5 rounded font-semibold"
                            data-fiaon="anruf-nicht-verbunden"
                            style={{ background: "#f1f5f9", color: "#64748b" }}>
                        nicht verbunden
                      </span>
                    )}
                    {a.nummer_passt === false && (
                      <span className="px-1.5 py-0.5 rounded font-semibold"
                            data-fiaon="anruf-nummer-passt-nicht"
                            style={{ background: "rgba(185,28,28,.08)", color: "#b91c1c" }}>
                        Nummer gehört nicht zu diesem Kunden
                      </span>
                    )}
                    {a.zuordnung_unklar_am && (
                      <span className="px-1.5 py-0.5 rounded font-semibold"
                            data-fiaon="anruf-zuordnung-unklar"
                            title={a.zuordnung_unklar_grund ?? undefined}
                            style={{ background: "rgba(180,83,9,.10)", color: "#b45309" }}>
                        Zuordnung unklar
                      </span>
                    )}
                  </p>
                  {a.zusammenfassung && (
                    <p className="text-[12.5px] text-slate-600 leading-relaxed mt-1">{a.zusammenfassung}</p>
                  )}
                  {a.transkript_status === "fehlgeschlagen" && (
                    <p className="text-[11.5px] text-slate-400 mt-1">{a.transkript_grund}</p>
                  )}
                  {offenerAnruf === a.id && (
                    <div className="mt-2">
                      <AnrufPlayer anrufId={a.id} kennzeichen="anruf-player-profil" />
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {reiter === "provision" && (
            <>
              {/* ══════════════════════════════════════════════════════════════
                  UNTERBEREICH „ABRECHNUNGEN" (19.08.2026)

                  Der Betreiber soll BEIDE Wege haben: zentral über
                  /admin/abrechnungen und hier je Mensch. Dieselben Zeilen,
                  gefiltert auf diese Person — nicht eine zweite Fassung der
                  Liste, sondern derselbe Datensatz aus derselben Route.
                  ══════════════════════════════════════════════════════════════ */}
              {(akte?.abrechnungen ?? []).length > 0 && (
                <div className="rounded-2xl p-4 mb-3.5" data-fiaon="profil-abrechnungen"
                     style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                    <p className="text-[13px] font-bold text-slate-800">
                      Abrechnungen ({(akte.abrechnungen ?? []).length})
                    </p>
                    <a href="/admin/abrechnungen" className="text-[11.5px] font-semibold"
                       style={{ color: "var(--fi-primaer)" }}>
                      Alle in der Abrechnungs-Zentrale
                    </a>
                  </div>
                  {(akte.abrechnungen ?? []).map((s: any) => (
                    <div key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
                         style={{ borderTop: "1px solid #eef2f7" }}>
                      <span className="text-[12.5px] font-bold text-slate-800 tabular-nums">{s.nummer}</span>
                      <span className="text-[12px] text-slate-500 tabular-nums">
                        {s.zeitraumVon ? new Date(s.zeitraumVon).toLocaleDateString("de-DE") : "—"}
                      </span>
                      <span className="text-[12.5px] font-bold text-slate-900 tabular-nums">
                        {eur(s.betragCents)}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold"
                            style={{
                              background: s.zustand === "ausgezahlt" ? "rgba(4,120,87,.10)"
                                : s.zustand === "gesendet" ? "rgba(29,78,216,.10)" : "rgba(180,83,9,.10)",
                              color: s.zustand === "ausgezahlt" ? "#047857"
                                : s.zustand === "gesendet" ? "#1d4ed8" : "#b45309",
                            }}>{s.zustand}</span>
                      {s.gesendetAm && (
                        <span className="text-[11px] text-slate-400">
                          {s.sendeAnzahl > 1 ? `erneut gesendet (${s.sendeAnzahl}×)` : "gesendet"}
                        </span>
                      )}
                      <a href={`/api/fiaon/admin/abrechnungen/${s.id}.pdf`} target="_blank" rel="noreferrer"
                         data-fiaon="profil-pdf"
                         className="ml-auto text-[11.5px] font-semibold"
                         style={{ color: "var(--fi-primaer)", opacity: s.hatPdf ? 1 : .4 }}>
                        PDF ansehen
                      </a>
                    </div>
                  ))}
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════════
                  DER VERLAUF — er fehlte ganz

                  „Unter ‚Provisionen' findet man keine Verläufe."

                  Hier standen NUR offene Nachbuchungen, also das, was fehlt.
                  Was gebucht IST, stand nirgends: 98 Zeilen in der Datenbank,
                  keine einzige sichtbar. Ein Mensch, der fragt „womit habe ich
                  meine 2.221 € verdient", fand keine Antwort.
                  ══════════════════════════════════════════════════════════════ */}
              {akte?.provisionSummen && (
                <div className="grid gap-2 mb-3.5"
                     style={{ gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))" }}>
                  {([
                    ["Gesamt", eur(akte.provisionSummen.gesamt), "#0f172a"],
                    ["Ausgezahlt", eur(akte.provisionSummen.ausgezahlt), "#047857"],
                    ["Offen", eur(akte.provisionSummen.offen), "#b45309"],
                    ["Buchungen", String(akte.provisionSummen.anzahl), "#64748b"],
                  ] as const).map(([t, w, f]) => (
                    <div key={t} className="px-3 py-2.5 rounded-xl bg-slate-50">
                      <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 leading-tight">{t}</p>
                      <p className="text-[16px] font-bold tabular-nums leading-tight mt-0.5"
                         style={{ color: f }}>{w}</p>
                    </div>
                  ))}
                </div>
              )}

              {(akte?.provisionen ?? []).length > 0 && (
                <div className="rounded-xl overflow-hidden mb-4"
                     style={{ boxShadow: "inset 0 0 0 1px #eef2f7", maxHeight: 340, overflowY: "auto" }}>
                  {akte.provisionen.map((c: any) => (
                    <div key={c.id} className="px-3.5 py-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5"
                         style={{ borderBottom: "1px solid #f8fafc" }}>
                      <span className="text-[12.5px] font-semibold text-slate-800">
                        {c.kunde || c.ref}
                      </span>
                      <span className="text-[11px] text-slate-400">{c.pack_name}</span>
                      {c.kind && c.kind !== "sale" && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                              style={{ background: "rgba(37,99,235,.08)", color: "var(--fi-primaer)" }}>
                          {c.kind === "override" ? `Leitung${c.quelle_name ? ` · ${c.quelle_name}` : ""}` : c.kind}
                        </span>
                      )}
                      {c.rate_bp != null && (
                        <span className="text-[11px] text-slate-400 tabular-nums">
                          {(Number(c.rate_bp) / 100).toLocaleString("de-DE", { maximumFractionDigits: 2 })} %
                        </span>
                      )}
                      <span className="ml-auto shrink-0 flex items-baseline gap-2.5">
                        <span className="text-[11px] text-slate-400 tabular-nums">
                          {new Date(c.created_at).toLocaleDateString("de-DE", {
                            day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Berlin",
                          })}
                        </span>
                        <span className="text-[12.5px] font-bold tabular-nums"
                              style={{ color: c.payout_id ? "#047857" : c.status === "cancelled" ? "#b91c1c" : "#0f172a" }}>
                          {eur(c.amount_cents)}
                        </span>
                        <span className="text-[10px] font-semibold w-[68px] text-right"
                              style={{ color: c.payout_id ? "#047857" : "#94a3b8" }}>
                          {c.payout_id ? "ausgezahlt" : c.status === "cancelled" ? "storniert" : "offen"}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[12.5px] font-bold text-slate-800 mb-1.5">Nachbuchen</p>
              <p className="text-[12.5px] text-slate-500 leading-relaxed mb-3">
                Bezahlte Bestellungen ohne gebuchte Provision. Früher eine eigene Seite
                (<span className="font-mono text-[11.5px]">/admin/nachbuchung</span>) — jetzt hier, wo auch der Satz steht.
              </p>
              {!kandidaten && <p className="text-[13px] text-slate-400">Wird geladen …</p>}
              {kandidaten?.length === 0 && (
                <p className="text-[13px] text-slate-400">Nichts offen — jede bezahlte Bestellung hat ihre Provision.</p>
              )}
              {(kandidaten ?? []).filter((k: any) => !k.agent_id || k.agent_id === id).slice(0, 40).map((k: any) => (
                <div key={k.ref} className="py-2.5 flex flex-wrap items-center gap-2 text-[12.5px]"
                     style={{ borderBottom: "1px solid #f8fafc" }}>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-slate-800" style={{ overflowWrap: "anywhere" }}>
                      {k.customer_name || k.ref}
                    </span>
                    <span className="block text-[11px] text-slate-400">
                      {k.pack_name} · {k.amount_cents ? eur(k.amount_cents) : "Betrag unklar"}
                      {k.agent_suggested && " · Agent vorgeschlagen"}
                    </span>
                  </span>
                  <button type="button" disabled={busy === k.ref || k.status === "betrag_unklar"}
                          onClick={async () => {
                            setBusy(k.ref);
                            const r = await fetch(`/api/fiaon/admin/commission-backfill/${encodeURIComponent(k.ref)}/book`, {
                              method: "POST", credentials: "include",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ agentId: k.agent_id ?? id }),
                            }).catch(() => null);
                            const j = await r?.json().catch(() => null);
                            setBusy(null);
                            setHinweis(j?.ok ? `${k.ref} gebucht.` : (j?.error || "Fehler."));
                            setKandidaten(null);
                          }}
                          className="px-3 py-2 rounded-xl text-[12px] font-semibold text-white bg-[#1d4ed8] disabled:opacity-30">
                    {busy === k.ref ? "…" : "Buchen"}
                  </button>
                </div>
              ))}
            </>
          )}
        </>
      }
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// NACHRICHT — Banner im Team-Portal, mit Bestätigung
// ═══════════════════════════════════════════════════════════════════════════

function NachrichtDialog({
  agentIds, team, onZu, onFertig,
}: {
  agentIds: number[]; team: Mitglied[]; onZu: () => void; onFertig: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [tage, setTage] = useState("7");
  const [alsEvent, setAlsEvent] = useState(false);
  const [titel, setTitel] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const senden = async () => {
    setBusy(true);
    const pfad = alsEvent ? "event" : "nachricht";
    const koerper = alsEvent
      ? { titel, text, auchBanner: true, von: "Vorgesetzter" }
      : {
          agentIds, text, von: "Vorgesetzter",
          bannerBis: tage ? new Date(Date.now() + Number(tage) * 86_400_000).toISOString() : null,
        };
    const r = await fetch(`/api/fiaon/admin/zentrale/team/${pfad}`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(koerper),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(false);
    if (!j?.ok) { setFehler(j?.error || "Fehler."); return; }
    onFertig(j.meldung);
  };

  const namen = team.filter((m) => agentIds.includes(m.id)).map((m) => m.vorname);

  return (
    <FiaonEbene
      offen onZu={onZu}
      titel={alsEvent ? "Ereignis verkünden" : "Persönliche Nachricht"}
      ueberschrift={alsEvent
        ? "Alle sehen es im Space"
        : `An ${agentIds.length} ${agentIds.length === 1 ? "Person" : "Personen"}`}
      unterzeile={alsEvent ? undefined : namen.join(", ")}
      breite={560}
      fuss={
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onZu} className="text-[13px] font-semibold text-slate-500">
            Abbrechen
          </button>
          <button type="button" onClick={() => void senden()}
                  disabled={busy || text.trim().length < 3 || (alsEvent && titel.trim().length < 3)}
                  className="ml-auto px-5 py-2.5 rounded-xl text-[14px] font-bold text-white bg-[#1d4ed8] disabled:opacity-30"
                  style={{ boxShadow: "0 12px 26px -12px rgba(29,78,216,.6)" }}>
            {busy ? "…" : alsEvent ? "Verkünden" : "Zustellen"}
          </button>
        </div>
      }
      kinder={
        <>
          {fehler && <p className="mb-3 text-[12.5px] font-semibold text-amber-700">{fehler}</p>}

          <div className="flex gap-1.5 mb-3">
            {([[false, "Nachricht"], [true, "Ereignis"]] as const).map(([w, t]) => (
              <button key={String(w)} type="button" onClick={() => setAlsEvent(w)}
                      className="px-3 py-1.5 rounded-xl text-[12.5px] font-semibold"
                      style={alsEvent === w
                        ? { background: "#1d4ed8", color: "#fff" }
                        : { background: "rgba(15,23,42,.045)", color: "#64748b" }}>
                {t}
              </button>
            ))}
          </div>

          {alsEvent && (
            <input value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="Überschrift"
                   aria-label="Überschrift"
                   className="w-full mb-2 px-3 py-2.5 rounded-xl border border-slate-200 text-[14px] font-semibold outline-none"
                   style={{ minHeight: 42 }} />
          )}
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5}
                    aria-label="Text"
                    placeholder={alsEvent
                      ? "Was gibt es zu verkünden? Landet als angepinnter Beitrag im Space."
                      : "Was soll die Person lesen? Erscheint als Banner über allem, bis sie „Verstanden“ klickt."}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-[13.5px] leading-relaxed outline-none resize-none" />

          {!alsEvent && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="text-[12.5px] text-slate-500">Banner läuft nach</label>
              <input value={tage} onChange={(e) => setTage(e.target.value)} inputMode="numeric"
                     aria-label="Tage"
                     className="w-16 px-2.5 py-2 rounded-xl border border-slate-200 text-[13px] tabular-nums outline-none" />
              <span className="text-[12.5px] text-slate-500">Tagen ab — oder sobald bestätigt wurde.</span>
            </div>
          )}
          <p className="mt-3 text-[11.5px] text-slate-400 leading-snug">
            {alsEvent
              ? "Ein angepinnter Beitrag im Space, sichtbar für das ganze Team, dazu ein Banner für sieben Tage."
              : "Wer wann bestätigt hat, steht danach in der Team-Zentrale. Das ist der Zweck: nicht das Senden, sondern der Nachweis des Ankommens."}
          </p>
        </>
      }
    />
  );

}


// ═══════════════════════════════════════════════════════════════════════════
// NEU IM TEAM — wer hängt?
//
// Die Frage, die der Vorgesetzte sonst nie stellt, weil sie Arbeit macht: Ist der
// Kollege von letzter Woche eigentlich angekommen? „Vertrag ✓, Erklärung ✓,
// Checkliste 3/7, noch keine Dokumentation" beantwortet sie in einer Zeile.
// ═══════════════════════════════════════════════════════════════════════════
function NeuImTeam({ onNachricht }: { onNachricht: (id: number) => void }) {
  const [neue, setNeue] = useState<any[] | null>(null);

  useEffect(() => {
    fetch("/api/fiaon/admin/erste-schritte", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setNeue(j?.ok ? j.neue : []))
      .catch(() => setNeue([]));
  }, []);

  if (!neue) return <p className="text-[13px] text-slate-400">Wird geladen …</p>;
  if (neue.length === 0) {
    return (
      <p className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-[13px] text-slate-400">
        In den letzten 90 Tagen ist niemand neu dazugekommen.
      </p>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <p className="px-4 pt-4 pb-2 text-[12px] text-slate-500 leading-relaxed">
        Einarbeitung der letzten 90 Tage. „Hängt" heißt: seit über einer Woche dabei und noch
        kein einziges Ergebnis dokumentiert — dann fehlt es meistens nicht am Willen, sondern
        an einer Frage, die niemand gestellt hat.
      </p>
      {neue.map((n) => (
        <div key={n.id} className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1"
             style={{ borderTop: "1px solid #f1f5f9" }}>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold text-slate-900">
              {n.name}
              {n.haengt && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      style={{ background: "rgba(217,119,6,.1)", color: "#b45309" }}>
                  hängt
                </span>
              )}
            </p>
            <p className="text-[11.5px] text-slate-400">
              {ROLLE_TEXT[n.rolle] ?? n.rolle} · dabei seit{" "}
              {new Date(n.seit).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}
              {n.letzterLogin && ` · zuletzt ${wann(n.letzterLogin)} angemeldet`}
            </p>
          </div>
          <span className="text-[12px] text-slate-500">
            Vertrag {n.vertrag ? "ja" : "—"} · Erklärung {n.zusage ? "ja" : "—"}
          </span>
          <span className="text-[12.5px] font-semibold tabular-nums text-slate-700">
            Checkliste {n.fertig}/{n.gesamt}
          </span>
          <span className="text-[12px] text-slate-500">
            {n.ersteDokumentation
              ? `erste Doku ${new Date(n.ersteDokumentation).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}`
              : "noch keine Dokumentation"}
          </span>
          <button type="button" onClick={() => onNachricht(n.id)}
                  className="px-3 py-1.5 rounded-xl text-[12px] font-semibold bg-white border border-slate-200 text-slate-600">
            Nachfassen
          </button>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VERGÜTUNG & STUNDEN
//
// Die Platzhalter sind ABSICHTLICH auffällig und stehen unter dem Hinweis
// „vom Vorgesetzter zu bestätigen". Solange `verguetung_bestaetigt_am` leer ist,
// wird KEINE Prämie gebucht und lassen sich KEINE Stunden abrechnen — ein
// stiller Vorgabewert, den niemand prüft, wird sonst zur echten Abrechnung.
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// VERGÜTUNG & STUNDEN — ausgezogen nach components/admin/VerguetungTafel.tsx
//
// Hier standen 160 Zeilen mit zwei Feldern und einem orangenen Kasten darüber.
// Der Betreiber nannte den Reiter „völlig dumm“ — zu Recht: keine Überschriften,
// keine Bankverbindung, ein Grammatikfehler im wichtigsten Satz und ein
// Systemhinweis, der wie eine Fehlermeldung aussah.
//
// Die neue Fassung hat fünf Abschnitte und ist deshalb zu groß für diese Datei
// (admin-team-zentrale.tsx hat bereits über 2900 Zeilen).
// ═══════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════
// VERWALTUNG — die Vollständigkeitsliste an einem Ort
//
// Der Vorgesetzte musste bisher für Reset, Deaktivieren, Rolle, Bank und
// Umhängen zwischen Ansichten wechseln oder auf eine gelöschte Altseite. Alles
// davon liegt jetzt in einem Reiter im Mitarbeiter-Detail — ohne Seitenwechsel.
//
// Die Endpunkte sind unverändert die bestehenden. Neu gebaut wurde nur die
// LÖSCHUNG, weil es sie noch nicht gab.
// ═══════════════════════════════════════════════════════════════════════════
function VerwaltungTafel({
  m, onAenderung, onHinweis, onZu,
}: {
  m: Mitglied; onAenderung: () => void;
  onHinweis: (t: string) => void; onZu: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [bank, setBank] = useState<any>(null);
  const [loeschen, setLoeschen] = useState<any>(null);
  const [wortlaut, setWortlaut] = useState("");
  // Kundenstand und Ziel für das Umhängen — erst auf Knopfdruck geladen: Die
  // Zahl kostet fünf Abfragen, und sie interessiert nur, wenn jemand geht.
  const [umhaengen, setUmhaengen] = useState<any>(null);
  const [umhaengenGrund, setUmhaengenGrund] = useState("");

  const ruf = async (pfad: string, koerper?: any, name = pfad) => {
    setBusy(name);
    const r = await fetch(`/api/fiaon${pfad}`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(koerper ?? {}),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(null);
    onHinweis(j?.meldung || j?.error || (j?.ok ? "Erledigt." : "Fehler."));
    if (j?.ok) onAenderung();
    return j;
  };

  const ROLLEN: { wert: string; text: string; erklaerung: string }[] = [
    { wert: "agent", text: "Vertrieb", erklaerung: "Sieht nur die eigenen Kunden." },
    { wert: "vertriebsleiter", text: "Vertriebsleitung", erklaerung: "Sieht alle Kunden, kann zuweisen und korrigieren." },
    { wert: "onboarding", text: "Onboarding", erklaerung: "Führt die Startgespräche." },
    { wert: "inkasso", text: "Forderungsmanagement", erklaerung: "Sieht nur bezahlte Kunden mit laufender Ratenzahlung." },
  ];

  return (
    <>
      {/* ── Rolle ────────────────────────────────────────────────────────── */}
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-2">Rolle</p>
      <div className="space-y-1.5 mb-5">
        {ROLLEN.map((r) => {
          const aktiv = String(m.rolle) === r.wert;
          return (
            <button key={r.wert} type="button" disabled={aktiv || busy != null}
                    onClick={() => void ruf(`/admin/agents/${m.id}/rolle`, { rolle: r.wert }, r.wert)}
                    className="w-full text-left px-3.5 py-2.5 rounded-xl disabled:cursor-default"
                    style={aktiv
                      ? { background: "rgba(29,78,216,.07)", boxShadow: "inset 0 0 0 1px rgba(29,78,216,.28)" }
                      : { background: "#f8fafc", boxShadow: "inset 0 0 0 1px transparent" }}>
              <span className="flex items-baseline gap-2">
                <span className="text-[13px] font-bold" style={{ color: aktiv ? "#1d4ed8" : "#0f172a" }}>
                  {r.text}
                </span>
                {aktiv && <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#1d4ed8]">aktuell</span>}
              </span>
              <span className="block text-[11.5px] text-slate-500 leading-snug mt-0.5">{r.erklaerung}</span>
            </button>
          );
        })}
      </div>

      {/* ── Zugang ───────────────────────────────────────────────────────── */}
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-2">Zugang</p>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        <button type="button" disabled={busy != null}
                onClick={() => void ruf(`/admin/agents/${m.id}/force-reset`, {}, "reset")}
                className="px-3 py-2 rounded-xl text-[12.5px] font-semibold bg-white text-slate-700 disabled:opacity-40"
                style={{ boxShadow: "inset 0 0 0 1px #e2e8f0" }}>
          {busy === "reset" ? "…" : "Passwort-Reset erzwingen"}
        </button>
        <button type="button" disabled={busy != null}
                onClick={() => void ruf(`/admin/agents/${m.id}/reinvite`, {}, "reinvite")}
                className="px-3 py-2 rounded-xl text-[12.5px] font-semibold bg-white text-slate-700 disabled:opacity-40"
                style={{ boxShadow: "inset 0 0 0 1px #e2e8f0" }}>
          {busy === "reinvite" ? "…" : "Einladung erneut senden"}
        </button>
        <button type="button" disabled={busy != null}
                onClick={() => void ruf(`/admin/agents/${m.id}/toggle`, {}, "toggle")}
                className="px-3 py-2 rounded-xl text-[12.5px] font-semibold disabled:opacity-40"
                style={m.active
                  ? { background: "rgba(217,119,6,.08)", color: "#b45309" }
                  : { background: "rgba(5,150,105,.08)", color: "#047857" }}>
          {busy === "toggle" ? "…" : m.active ? "Deaktivieren" : "Wieder aktivieren"}
        </button>
      </div>
      <p className="text-[11.5px] text-slate-400 leading-snug mb-5">
        Ein Reset entwertet alle Sitzungen sofort und schickt einen Link, der eine Stunde gilt.
      </p>

      {/* ══════════════════════════════════════════════════════════════════
          KUNDEN UMHÄNGEN — der Fall „ein Mensch geht"

          Die EINZIGE der fünfzehn Funktionen aus Paket 8, die hier wirklich
          fehlte. Es gab die Route `/admin/team/reassign`, aber die hängt nur
          die BESTELLUNG um — die Arbeitslisten filtern auf die PERSON. Ein
          Umhängen darüber hätte die Karten nicht bewegt.
          ══════════════════════════════════════════════════════════════════ */}
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-2">
        Kunden umhängen
      </p>
      {!umhaengen ? (
        <button type="button" disabled={busy === "kundenstand"}
                onClick={async () => {
                  setBusy("kundenstand");
                  const r = await fetch(`/api/fiaon/admin/team/agents/${m.id}/kunden`,
                    { credentials: "include" }).catch(() => null);
                  const j = await r?.json().catch(() => null);
                  setBusy(null);
                  if (j?.ok) setUmhaengen(j);
                  else onHinweis(j?.error || "Der Kundenstand ist nicht abrufbar.");
                }}
                className="px-3 py-2 rounded-xl text-[12.5px] font-semibold bg-white text-slate-700 mb-4"
                style={{ boxShadow: "inset 0 0 0 1px #e2e8f0" }}>
          {busy === "kundenstand" ? "…" : "Kundenstand ansehen"}
        </button>
      ) : (
        <div className="mb-4 rounded-xl border p-3" style={{ borderColor: "#e2e8f0" }}>
          <p className="text-[12.5px] text-slate-700 leading-relaxed">{umhaengen.hinweis}</p>
          {umhaengen.stand.personen > 0 && (
            <>
              <p className="text-[11.5px] text-slate-500 mt-1.5 leading-relaxed">
                {umhaengen.stand.bestellungen} Bestellungen
                {umhaengen.stand.termine > 0 && ` · ${umhaengen.stand.termine} gebuchte Termine`}
                {umhaengen.stand.offeneRaten > 0 && ` · ${umhaengen.stand.offeneRaten} offene Raten`}
              </p>
              <p className="text-[11.5px] text-slate-400 mt-1 leading-relaxed">
                Termine und Raten bleiben bei ihm — sie hängen an Vereinbarungen mit
                Menschen, nicht an einer Zuteilung.
              </p>
              <input type="text" value={umhaengenGrund}
                     onChange={(e) => setUmhaengenGrund(e.target.value)}
                     placeholder="Grund (steht im Verlauf jedes Kunden)"
                     className="w-full mt-2.5 rounded-lg px-3 py-2 text-[12.5px] outline-none"
                     style={{ border: "1px solid #e2e8f0" }} />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {/* Der Regelfall zuerst: zurück in die Verteilung. Ein Mensch
                    von Hand verteilt nicht gleichmäßig, der Rundlauf schon. */}
                <button type="button" disabled={busy === "umhaengen" || umhaengenGrund.trim().length < 5}
                        onClick={async () => {
                          if (!confirm(
                            `Alle ${umhaengen.stand.personen} Kunden von ${m.name} `
                            + "zurück in die Verteilung geben?\n\nSie werden beim nächsten "
                            + "Lauf gleichmäßig neu vergeben.",
                          )) return;
                          setBusy("umhaengen");
                          const r = await fetch(
                            `/api/fiaon/admin/team/agents/${m.id}/kunden-umhaengen`,
                            {
                              method: "POST", credentials: "include",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ zielId: null, grund: umhaengenGrund.trim() }),
                            },
                          ).catch(() => null);
                          const j = await r?.json().catch(() => null);
                          setBusy(null);
                          onHinweis(j?.meldung || j?.error || "Nicht umgehängt.");
                          if (j?.ok) { setUmhaengen(null); setUmhaengenGrund(""); onAenderung(); }
                        }}
                        className="px-3 py-2 rounded-xl text-[12px] font-semibold text-white disabled:opacity-30"
                        style={{ background: "#1d4ed8" }}>
                  {busy === "umhaengen" ? "…" : "Zurück in die Verteilung"}
                </button>
                {(umhaengen.ziele ?? []).slice(0, 6).map((z: any) => (
                  <button key={z.id} type="button"
                          disabled={busy === "umhaengen" || umhaengenGrund.trim().length < 5}
                          title={`${z.name} betreut aktuell ${z.last} Kunden im Bestand`}
                          onClick={async () => {
                            if (!confirm(
                              `Alle ${umhaengen.stand.personen} Kunden von ${m.name} `
                              + `auf ${z.name} umhängen?`,
                            )) return;
                            setBusy("umhaengen");
                            const r = await fetch(
                              `/api/fiaon/admin/team/agents/${m.id}/kunden-umhaengen`,
                              {
                                method: "POST", credentials: "include",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ zielId: z.id, grund: umhaengenGrund.trim() }),
                              },
                            ).catch(() => null);
                            const j = await r?.json().catch(() => null);
                            setBusy(null);
                            onHinweis(j?.meldung || j?.error || "Nicht umgehängt.");
                            if (j?.ok) { setUmhaengen(null); setUmhaengenGrund(""); onAenderung(); }
                          }}
                          className="px-3 py-2 rounded-xl text-[12px] font-semibold bg-white text-slate-700 disabled:opacity-30"
                          style={{ boxShadow: "inset 0 0 0 1px #e2e8f0" }}>
                    → {z.name} <span className="text-slate-400">({z.last})</span>
                  </button>
                ))}
              </div>
              {umhaengenGrund.trim().length < 5 && (
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Der Grund fehlt noch — er steht später im Verlauf jedes Kunden.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Bankdaten ────────────────────────────────────────────────────── */}
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-2">Bankdaten</p>
      {bank ? (
        <p className="text-[13px] font-mono text-slate-800 mb-1.5" style={{ overflowWrap: "anywhere" }}>
          {bank.holder} · {bank.iban}{bank.bic ? ` · ${bank.bic}` : ""}
        </p>
      ) : (
        <p className="text-[12.5px] text-slate-500 mb-1.5">
          {m.bank_iban_masked || "Keine Bankdaten hinterlegt."}
        </p>
      )}
      {!bank && m.bank_iban_masked && (
        <button type="button" disabled={busy === "bank"}
                onClick={async () => {
                  setBusy("bank");
                  const r = await fetch(`/api/fiaon/admin/team/agents/${m.id}/bank`, { credentials: "include" }).catch(() => null);
                  const j = await r?.json().catch(() => null);
                  setBusy(null);
                  if (j?.ok) setBank(j.bank ?? j);
                  else onHinweis(j?.error || "Nicht abrufbar.");
                }}
                className="px-3 py-2 rounded-xl text-[12.5px] font-semibold bg-white text-slate-700"
                style={{ boxShadow: "inset 0 0 0 1px #e2e8f0" }}>
          {busy === "bank" ? "…" : "Vollständig anzeigen"}
        </button>
      )}
      <p className="text-[11.5px] text-slate-400 leading-snug mt-1.5 mb-5">
        Das vollständige Anzeigen wird protokolliert — eine IBAN ist ein Zahlungsziel.
      </p>

      {/* ── Löschen ──────────────────────────────────────────────────────── */}
      <p className="text-[10.5px] font-bold uppercase tracking-wider mb-2" style={{ color: "#b91c1c" }}>
        Mitarbeiter löschen
      </p>
      {!loeschen ? (
        <>
          <button type="button" disabled={busy === "vorschau"}
                  onClick={async () => {
                    setBusy("vorschau");
                    const r = await fetch(`/api/fiaon/admin/agents/${m.id}/loesch-vorschau`, { credentials: "include" }).catch(() => null);
                    const j = await r?.json().catch(() => null);
                    setBusy(null);
                    if (j?.ok) { setLoeschen(j); setWortlaut(""); }
                    else onHinweis(j?.error || "Vorschau nicht möglich.");
                  }}
                  className="px-3.5 py-2 rounded-xl text-[12.5px] font-bold text-white disabled:opacity-40"
                  style={{ background: "#b91c1c", boxShadow: "0 10px 22px -12px rgba(185,28,28,.5)" }}>
            {busy === "vorschau" ? "…" : "Löschen …"}
          </button>
          <p className="text-[11.5px] text-slate-400 leading-snug mt-1.5">
            Wer Provisionen hat, wird anonymisiert statt entfernt — die Buchungen bleiben nach
            § 147 AO zehn Jahre lesbar. Die Vorschau zeigt vorher, was gilt.
          </p>
        </>
      ) : (
        <div className="p-3.5 rounded-2xl"
             style={{ background: "rgba(185,28,28,.045)", boxShadow: "inset 0 0 0 1px rgba(185,28,28,.16)" }}>
          <p className="text-[13px] font-bold" style={{ color: "#b91c1c" }}>
            {loeschen.art === "endgueltig" ? "Wird vollständig entfernt" : "Wird anonymisiert"}
          </p>
          {loeschen.hinweise.map((h: string, i: number) => (
            <p key={i} className="text-[12px] text-slate-600 leading-relaxed mt-1.5">{h}</p>
          ))}
          <label className="block text-[12px] font-semibold text-slate-600 mt-3 mb-1">
            Zur Bestätigung eintippen: <span className="font-mono text-slate-900">{loeschen.bestaetigung}</span>
          </label>
          <input value={wortlaut} onChange={(e) => setWortlaut(e.target.value)}
                 aria-label="Bestätigungstext"
                 className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none" />
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setLoeschen(null)}
                    className="text-[12.5px] font-semibold text-slate-500">Abbrechen</button>
            <button type="button"
                    disabled={busy === "loeschen" || wortlaut.trim() !== loeschen.bestaetigung}
                    onClick={async () => {
                      const j = await ruf(`/admin/agents/${m.id}/loeschen`, { bestaetigung: wortlaut }, "loeschen");
                      if (j?.ok) onZu();
                    }}
                    className="ml-auto px-4 py-2.5 rounded-xl text-[13px] font-bold text-white disabled:opacity-30"
                    style={{ background: "#b91c1c" }}>
              {busy === "loeschen" ? "Läuft …" : "Ausführen"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
