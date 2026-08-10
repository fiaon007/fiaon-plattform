import { useCallback, useEffect, useMemo, useState } from "react";
import {
  InviteModal, MilestoneTasksCard, PartnerSuggestionsCard, ScriptsAdmin, SettingsCard,
} from "@/components/admin/TeamVerwaltung";
import { FiaonEbene } from "@/components/FiaonEbene";

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
  return (
    <div className="mb-3 px-4 py-3.5 rounded-2xl fi-flaeche-tief flex flex-wrap items-center gap-x-7 gap-y-2.5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.12em] fi-leise">Personalkosten Monat</p>
        <p className="text-[17px] font-bold tabular-nums leading-tight">{geld(d.personalkosten)}</p>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.12em] fi-leise">Umsatz Monat</p>
        <p className="text-[17px] font-bold tabular-nums leading-tight">{geld(d.umsatz)}</p>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.12em] fi-leise">Deckung</p>
        <p className="text-[17px] font-bold tabular-nums leading-tight"
           style={{ color: gut ? "#6ee7b7" : "#fcd34d" }}>{d.deckung} %</p>
      </div>
      <p className="text-[11.5px] leading-snug fi-leise" style={{ flex: "1 1 200px", minWidth: 0 }}>
        {d.satz} · {d.mitGehalt} {d.mitGehalt === 1 ? "Person" : "Personen"} mit Festgehalt.
      </p>
    </div>
  );
}

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
  const [team, setTeam] = useState<Mitglied[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [offen, setOffen] = useState<number | null>(null);
  const [rang, setRang] = useState(false);
  const [nachrichtAn, setNachrichtAn] = useState<number[] | null>(null);
  const [meldung, setMeldung] = useState<{ art: "gut" | "schlecht"; text: string } | null>(null);
  // Vier Blöcke, die aus der Altseite nachgezogen wurden. Reiter statt einer
  // endlos langen Seite: Wer Skripte pflegt, will nicht an dreißig
  // Mitarbeiterkarten vorbeiscrollen.
  const [reiter, setReiter] = useState<
    "menschen" | "aktivitaet" | "neu" | "partner" | "praemien" | "skripte" | "einstellungen"
  >(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    return (["menschen", "aktivitaet", "neu", "partner", "praemien", "skripte", "einstellungen"].includes(String(t))
      ? t : "menschen") as any;
  });
  const [einladen, setEinladen] = useState(
    () => new URLSearchParams(window.location.search).get("einladen") === "1",
  );

  const laden = useCallback(async () => {
    setLaedt(true);
    const r = await fetch("/api/fiaon/admin/zentrale/team", { credentials: "include" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok) setTeam(j.team || []);
    setLaedt(false);
  }, []);
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
              Kennzahlen, Provisionen, Protokolle und Nachrichten — alles zu einem Menschen an einem Ort.
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
            // Aktivität steht an ZWEITER Stelle: Sie ist die Aufsicht, und
            // eine Aufsicht, die man suchen muss, wird nicht benutzt.
            ["aktivitaet", "Aktivität"],
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

        {reiter === "aktivitaet" && <AktivitaetTafel />}

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
                <span className="absolute right-0 top-0 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                      style={{ background: "rgba(29,78,216,.07)", color: "#1d4ed8", borderBottomLeftRadius: 10 }}>
                  Platz {i + 1}
                </span>
              )}
              <button type="button" onClick={() => setOffen(m.id)} className="w-full text-left">
                <div className="flex items-start gap-3">
                  <Avatar src={m.avatar} name={m.name} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-bold text-slate-900 truncate">
                      {m.name}
                      {m.is_test_account && <span className="ml-2 text-[10px] font-bold uppercase text-slate-400">Testkonto</span>}
                    </p>
                    <p className="text-[11.5px] text-slate-400">
                      {ROLLE_TEXT[m.rolle] ?? m.rolle}
                      {!m.active && " · deaktiviert"}
                      {m.active && !m.distribution_active && " · keine Verteilung"}
                    </p>
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
                  <span>Bestand <b className="text-slate-800 tabular-nums">{m.bestand}</b></span>
                  <span className="tabular-nums">A {m.stufe_a} · B {m.stufe_b} · C {m.stufe_c}</span>
                  <span>heute <b className="text-slate-800 tabular-nums">{m.heute}</b></span>
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
      <TeamKosten />

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
    "zahlen" | "lohnt" | "verwaltung" | "protokoll" | "provision" | "verguetung"
  >("zahlen");
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
            {([["zahlen", "Zahlen"], ["lohnt", "Lohnt sich?"], ["verwaltung", "Verwaltung"],
               ["provision", "Provisionen"], ["verguetung", "Vergütung & Stunden"],
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
                  { t: "Bestand A", w: String(m.stufe_a) },
                  { t: "Bestand B", w: String(m.stufe_b) },
                  { t: "Bestand C", w: String(m.stufe_c) },
                  { t: "Offen", w: eur(m.offen_cents) },
                ].map((k) => (
                  <div key={k.t} className="p-3 rounded-xl bg-slate-50">
                    <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 leading-tight">{k.t}</p>
                    <p className="text-[17px] font-bold text-slate-900 tabular-nums leading-tight mt-0.5">{k.w}</p>
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

          {reiter === "provision" && (
            <>
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
function VerguetungTafel({ agentId, rolle }: { agentId: number; rolle: string }) {
  const [daten, setDaten] = useState<any>(null);
  const [satz, setSatz] = useState("");
  const [art, setArt] = useState("euro");
  const [wert, setWert] = useState("");
  const [monat, setMonat] = useState(new Date().toISOString().slice(0, 7));
  const [busy, setBusy] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const r = await fetch(`/api/fiaon/admin/inkasso/stunden/${agentId}`, { credentials: "include" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok) {
      setDaten(j);
      const v = j.verdienst ?? {};
      setSatz(String((Number(v.stundensatzCents ?? 0) / 100).toFixed(2)).replace(".", ","));
      setArt(String(v.praemieArt || "euro"));
      setWert(String((Number(v.praemieWert ?? 0) / 100).toFixed(2)).replace(".", ","));
    }
  }, [agentId]);
  useEffect(() => { void laden(); }, [laden]);

  if (!daten) return <p className="text-[13px] text-slate-400">Wird geladen …</p>;
  const v = daten.verdienst ?? {};
  const offen = (daten.stunden ?? []).filter((s: any) => !s.bestaetigt_am);

  const speichern = async () => {
    setBusy("satz");
    const r = await fetch(`/api/fiaon/admin/inkasso/verguetung/${agentId}`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stundensatzEuro: Number(satz.replace(",", ".")),
        praemieArt: art,
        praemieWert: Number(wert.replace(",", ".")),
      }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(null);
    setHinweis(j?.meldung || j?.error || "Fehler.");
    void laden();
  };

  return (
    <>
      {hinweis && <p className="mb-3 text-[12.5px] font-semibold text-emerald-700">{hinweis}</p>}

      {!v.verguetungBestaetigt && (
        <p className="mb-3 px-3.5 py-2.5 rounded-xl text-[12.5px] leading-relaxed"
           style={{ background: "rgba(217,119,6,.08)", color: "#b45309" }}>
          <b>Vom Vorgesetzter zu bestätigen.</b> Die Werte unten sind Platzhalter. Solange du sie
          nicht bestätigt hast, wird keine Prämie gebucht und lassen sich keine Stunden
          abrechnen — die Arbeit wird aber vollständig festgehalten und ist nachträglich
          abrechenbar.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Stundensatz (€)
          </label>
          <input value={satz} onChange={(e) => setSatz(e.target.value)} inputMode="decimal"
                 className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-[13.5px] tabular-nums" />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Prämie je eingezogener Rate
          </label>
          <div className="flex gap-1.5">
            <input value={wert} onChange={(e) => setWert(e.target.value)} inputMode="decimal"
                   className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-slate-200 text-[13.5px] tabular-nums" />
            <select value={art} onChange={(e) => setArt(e.target.value)}
                    className="px-2.5 py-2.5 rounded-xl border border-slate-200 text-[13px]">
              <option value="euro">€</option>
              <option value="prozent">% der Rate</option>
            </select>
          </div>
        </div>
      </div>
      <button type="button" onClick={() => void speichern()} disabled={busy === "satz"}
              className="px-4 py-2.5 rounded-xl text-[13px] font-bold text-white bg-[#1d4ed8] disabled:opacity-40">
        {busy === "satz" ? "…" : v.verguetungBestaetigt ? "Vergütung ändern" : "Vergütung bestätigen"}
      </button>
      <p className="mt-2 text-[11.5px] text-slate-400 leading-snug">
        Änderungen wirken auf künftige Prämien und Abrechnungen. Bereits gebuchte bleiben, wie
        sie sind. Eine Prämie entsteht nur, wenn eine Rate <b>bankbestätigt gebucht</b> wird und
        vorher dokumentiert bearbeitet wurde — Selbstzahler erzeugen keine.
      </p>

      {/* ── Stunden bestätigen ────────────────────────────────────────── */}
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mt-5 mb-2">
        Stunden bestätigen
      </p>
      <div className="grid grid-cols-3 gap-2.5 mb-3">
        {[
          { t: "Offen", w: `${Math.floor(Number(v.offeneMinuten ?? 0) / 60)} Std ${Number(v.offeneMinuten ?? 0) % 60} Min` },
          { t: "Bestätigt (Monat)", w: `${Math.floor(Number(v.bestaetigtMinuten ?? 0) / 60)} Std` },
          { t: "Prämien (Monat)", w: `${(Number(v.praemienCents ?? 0) / 100).toFixed(2).replace(".", ",")} €` },
        ].map((k) => (
          <div key={k.t} className="p-3 rounded-xl bg-slate-50">
            <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">{k.t}</p>
            <p className="text-[15px] font-bold tabular-nums text-slate-900 mt-0.5">{k.w}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input type="month" value={monat} onChange={(e) => setMonat(e.target.value)}
               className="px-3 py-2.5 rounded-xl border border-slate-200 text-[13px]" />
        <button type="button" disabled={busy === "best" || offen.length === 0}
                onClick={async () => {
                  setBusy("best");
                  const r = await fetch(`/api/fiaon/admin/inkasso/stunden/${agentId}/bestaetigen`, {
                    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ monat }),
                  }).catch(() => null);
                  const j = await r?.json().catch(() => null);
                  setBusy(null);
                  setHinweis(j?.meldung || j?.error || "Fehler.");
                  void laden();
                }}
                className="px-4 py-2.5 rounded-xl text-[13px] font-bold text-white bg-[#047857] disabled:opacity-30">
          {busy === "best" ? "…" : "Monat bestätigen"}
        </button>
      </div>
      <p className="mt-2 text-[11.5px] text-slate-400 leading-snug">
        Bestätigen macht die Zeilen <b>unveränderlich</b> und legt sie als Position in den
        Auszahlungsweg. Auch du kannst sie danach nicht mehr ändern — das schützt beide Seiten.
      </p>

      <div className="mt-4">
        {(daten.stunden ?? []).slice(0, 30).map((s: any) => (
          <div key={s.id} className="py-2 flex flex-wrap items-center gap-x-3 text-[12.5px]"
               style={{ borderBottom: "1px solid #f8fafc" }}>
            <span className="font-semibold tabular-nums text-slate-800">
              {new Date(s.tag).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}
            </span>
            <span className="tabular-nums text-slate-500">
              {String(s.von).slice(0, 5)}–{String(s.bis).slice(0, 5)}
            </span>
            <span className="font-bold tabular-nums text-slate-800">
              {Math.floor(s.minuten / 60)}:{String(s.minuten % 60).padStart(2, "0")}
            </span>
            {s.notiz && <span className="text-[11.5px] text-slate-400 truncate">{s.notiz}</span>}
            <span className="ml-auto text-[11.5px] font-semibold"
                  style={{ color: s.bestaetigt_am ? "#047857" : "#b45309" }}>
              {s.bestaetigt_am ? "bestätigt" : "wartet"}
            </span>
          </div>
        ))}
        {(daten.stunden ?? []).length === 0 && (
          <p className="text-[13px] text-slate-400">
            {rolle === "inkasso"
              ? "Noch keine Zeiten erfasst."
              : "Zeiterfassung nutzt bisher nur das Forderungsmanagement."}
          </p>
        )}
      </div>
    </>
  );
}


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
