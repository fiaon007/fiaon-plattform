// ═══════════════════════════════════════════════════════════════════════════
// DIE TERMIN-ZENTRALE — /admin/termine
//
// ── WARUM SIE ENTSTANDEN IST ───────────────────────────────────────────────
// GEMESSEN an 120 Terminen (26.08.2026):
//
//   Nikita Boychenko    34 Termine · 25 vergangen · erledigt  0 % · No-Show 64 %
//   Lucas Böhnert       30 Termine · 25 vergangen · erledigt  0 % · No-Show 76 %
//   Florentine Lombardi 27 Termine · 21 vergangen · erledigt 67 % · No-Show 19 %
//   Daniel Stripling    27 Termine · 23 vergangen · erledigt 78 % · No-Show  9 %
//
// Zwei Menschen haben bei 50 vergangenen Terminen KEINEN EINZIGEN als erledigt
// markiert, während zwei andere zwei Drittel bis vier Fünftel abschließen.
// Diese Auswertung stand in keiner Ansicht. Eine Zahl, die niemand sieht,
// ändert nichts.
//
// ── UND DIE 336 ────────────────────────────────────────────────────────────
// 336 bezahlte Kunden haben keinen einzigen Termin. Sie haben Geld überwiesen
// und warten. Die Karte unten zeigt sie mit Einladungs-Knopf — gestaffelt,
// höchstens 50 am Tag: Ein Knopf, der 336 Mails auf einmal schickt, ruiniert
// die Zustellbarkeit aller anderen.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import { PageIntro } from "@/components/admin/PageHelp";
import { TeamKalenderSchmal } from "@/components/internal/TeamKalenderSchmal";

const ACCENT = "#1d4ed8";

const zeit = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit",
});
const tagZeit = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit",
  hour: "2-digit", minute: "2-digit",
});
const datum = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric",
});

function AdminTerminePage() {
  // ── ALLE FILTER STEHEN IN DER ADRESSE ──────────────────────────────────
  // Wer einen Fund weitergeben will, schickt den Link. Ein Filter, der nur im
  // Kopf des Browsers lebt, ist beim Neuladen weg.
  const ausAdresse = (name: string, vorgabe = "") =>
    new URLSearchParams(window.location.search).get(name) || vorgabe;

  const [ansicht, setAnsicht] = useState(() => ausAdresse("ansicht", "woche"));
  const [agent, setAgent] = useState(() => ausAdresse("agent"));
  const [quelle, setQuelle] = useState(() => ausAdresse("quelle"));
  const [status, setStatus] = useState(() => ausAdresse("status"));
  const [daten, setDaten] = useState<any>(null);
  const [laedt, setLaedt] = useState(true);
  const [einladung, setEinladung] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ansicht, agent, quelle, status })) {
      if (v) p.set(k, v);
    }
    window.history.replaceState(null, "", `${window.location.pathname}?${p.toString()}`);
  }, [ansicht, agent, quelle, status]);

  const laden = useCallback(async () => {
    setLaedt(true);
    const p = new URLSearchParams({ ansicht });
    if (agent) p.set("agent", agent);
    if (quelle) p.set("quelle", quelle);
    if (status) p.set("status", status);
    const r = await fetch(`/api/fiaon/admin/termine?${p}`, { credentials: "include" })
      .then((x) => x.json()).catch(() => null);
    setDaten(r?.ok ? r : null);
    setLaedt(false);
  }, [ansicht, agent, quelle, status]);

  useEffect(() => { void laden(); }, [laden]);

  const einladen = async (refs: string[] | "alle", schreiben: boolean) => {
    setBusy(true);
    const r = await fetch("/api/fiaon/admin/termine/einladen", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(refs === "alle" ? { alle: true, schreiben } : { refs, schreiben }),
    }).then((x) => x.json()).catch(() => null);
    setBusy(false);
    setEinladung(r);
    if (r?.ok && !r.vorschau) void laden();
  };

  const z = daten?.zahlen;
  const feld = "px-2.5 py-2 rounded-lg border bg-white text-[12px]";

  return (
    // Die Hülle (Navigation, Kopf) kommt aus App.tsx über `admin(...)` — genau
    // wie bei admin-events.tsx. Eine eigene AdminShell hier würde sie doppeln.
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <PageIntro
          id="termine"
          title="Termin-Zentrale"
          subtitle="Alle Termine aller Mitarbeiter — heute, diese Woche, diesen Monat."
          steps={[
            "Der Kennzahlen-Kopf zeigt je Mitarbeiter, wie viele vergangene Termine erledigt und wie viele verpasst wurden. Nur vergangene zählen — ein Termin morgen ist weder das eine noch das andere.",
            "Die Karte „Bezahlte Kunden ohne Termin“ ist die Arbeitsliste: Diese Menschen haben gezahlt und warten. Einladungen gehen gestaffelt raus, höchstens 50 am Tag.",
            "Stornierte Termine bleiben sichtbar — mit Zeitpunkt und dem, der storniert hat.",
          ]}
        />

        {/* ══════════════════════════════════════════════════════════════════
            DER KENNZAHLEN-KOPF
            ══════════════════════════════════════════════════════════════════ */}
        {z && (
          <div className="grid gap-2.5 mb-5"
               style={{ gridTemplateColumns: "repeat(auto-fit,minmax(132px,1fr))" }}>
            {[
              ["heute", z.heute, ACCENT],
              ["diese Woche", z.woche, "#0f172a"],
              ["erledigt", z.erledigt, "#059669"],
              ["verpasst", z.verpasst, "#d97706"],
              ["storniert", z.abgesagt, "#94a3b8"],
              ["insgesamt", z.gesamt, "#64748b"],
            ].map(([t, w, f]) => (
              <div key={String(t)} className="px-3.5 py-3 rounded-xl"
                   style={{ background: `${f}0f`, boxShadow: `inset 0 0 0 1px ${f}2e` }}>
                <p className="text-[24px] font-bold leading-none tabular-nums" style={{ color: String(f) }}>
                  {String(w)}
                </p>
                <p className="text-[11.5px] font-semibold mt-1" style={{ color: String(f) }}>{String(t)}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── DER HEBEL-MESSWERT ──────────────────────────────────────────
            Woher kommen die Termine? Wenn alle aus einem Link kommen, ist der
            Link der Hebel — und jeder nicht verschickte Link ein verlorener
            Termin. */}
        {z && Number(z.gesamt) > 0 && (
          <p className="text-[12.5px] text-slate-600 mb-5 leading-relaxed">
            <b className="tabular-nums">{z.aus_terminlink}</b> von {z.gesamt} Terminen
            entstanden über einen verschickten Terminlink
            {Number(z.aus_terminlink) === Number(z.gesamt) && " — also ALLE"}.
            {Number(z.ueberfaellig) > 0 && (
              <> Und <b className="tabular-nums">{z.ueberfaellig}</b> Termine liegen in der
              Vergangenheit und stehen noch auf „gebucht“ — dort fehlt die
              Nachbearbeitung.</>
            )}
          </p>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            BUCHUNGSVERSUCHE — 7 TAGE (30.08.2026)

            Die Meldung war: „Die Buchung funktioniert unabhängig von der
            Uhrzeit nicht zuverlässig." Bis heute hinterließ ein Fehlschlag
            NICHTS — die Aussage war weder zu belegen noch zu widerlegen.

            Diese Karte ist der Beleg. Sie zeigt beides — gebucht UND
            abgelehnt —, denn eine Ablehnzahl ohne ihren Bezug ist keine
            Messung. Und sie unterscheidet „ist in Ordnung" von „ich kann es
            noch nicht messen": Solange nichts aufgelaufen ist, sagt sie das
            ausdrücklich, statt eine grüne Null zu zeigen.
            ══════════════════════════════════════════════════════════════════ */}
        {daten?.versuche && (
          <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 mb-5">
            <h2 className="text-[14px] font-bold text-slate-900">Buchungsversuche · 7 Tage</h2>
            {Number(daten.versuche.gesamt) === 0 ? (
              <p className="text-[12.5px] mt-1.5 leading-relaxed" style={{ color: "#92400e" }}>
                Noch keine Versuche protokolliert. Das bedeutet <b>nicht</b>, dass
                alles klappt — die Aufzeichnung ist am 30.08.2026 eingebaut worden
                und füllt sich erst mit dem nächsten Buchungsversuch. Sobald hier
                Zahlen stehen, lässt sich die Meldung „Buchung unzuverlässig"
                belegen oder widerlegen.
              </p>
            ) : (
              <>
                <p className="text-[12.5px] text-slate-600 mt-1 mb-3 leading-relaxed">
                  <b className="tabular-nums">{daten.versuche.gebucht}</b> gebucht ·{" "}
                  <b className="tabular-nums">{daten.versuche.abgelehnt}</b> abgelehnt
                  {Number(daten.versuche.gesamt) > 0 && (
                    <> — Ablehnquote <b className="tabular-nums">{daten.versuche.ablehnQuote} %</b></>
                  )}
                  . Davon <b className="tabular-nums">{daten.versuche.vonKunden}</b> von
                  Kunden (der Rest von Mitarbeitern — für die gilt kein Vorlauf).
                </p>
                {Array.isArray(daten.versuche.gruende) && daten.versuche.gruende.length > 0 && (
                  <div className="mb-1">
                    <p className="text-[11px] uppercase tracking-[.08em] text-slate-500 mb-1.5">
                      Gründe der Ablehnungen
                    </p>
                    {daten.versuche.gruende.map((g: any) => (
                      <div key={String(g.grund)}
                           className="flex items-baseline justify-between gap-3 py-1 border-b border-slate-100 last:border-0">
                        <span className="text-[12.5px] text-slate-700">{g.text}</span>
                        <span className="text-[12.5px] font-bold tabular-nums text-slate-900">{g.n}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Die Uhrzeit-Frage direkt beantwortet — „unabhängig von der
                    Uhrzeit" ist eine Behauptung, und hier steht sie zur Probe. */}
                {Array.isArray(daten.versuche.stunden) && daten.versuche.stunden.length > 0 && (
                  <p className="text-[11.5px] text-slate-500 mt-2.5 leading-relaxed">
                    Nach Stunde (Berlin):{" "}
                    {daten.versuche.stunden.map((s: any, i: number) => (
                      <span key={s.stunde}>
                        {i > 0 && " · "}
                        {String(s.stunde).padStart(2, "0")} Uhr: {s.gebucht}/{s.gebucht + s.abgelehnt}
                      </span>
                    ))}
                  </p>
                )}
              </>
            )}
          </section>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            JE MITARBEITER — DER VERGLEICH
            Eine Quote allein sagt wenig. Erst das Nebeneinander macht sie
            lesbar: 0 % neben 78 % ist eine Aussage.
            ══════════════════════════════════════════════════════════════════ */}
        {Array.isArray(daten?.jeAgent) && daten.jeAgent.length > 0 && (
          <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 mb-5">
            <h2 className="text-[14px] font-bold text-slate-900">Je Mitarbeiter</h2>
            <p className="text-[12px] text-slate-500 mt-0.5 mb-3 leading-relaxed">
              Die Quoten rechnen nur über <b>vergangene</b> Termine — ein Termin
              morgen ist weder erledigt noch verpasst.
            </p>
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-[12.5px]" style={{ minWidth: 560 }}>
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[.08em] text-slate-500">
                    <th className="pb-2 pr-3 font-bold">Mitarbeiter</th>
                    <th className="pb-2 px-2 font-bold text-right">Termine</th>
                    <th className="pb-2 px-2 font-bold text-right">vergangen</th>
                    <th className="pb-2 px-2 font-bold text-right">erledigt</th>
                    <th className="pb-2 px-2 font-bold text-right">verpasst</th>
                    <th className="pb-2 pl-2 font-bold text-right">kommend</th>
                  </tr>
                </thead>
                <tbody>
                  {daten.jeAgent.map((a: any) => {
                    // Bernstein ab 40 % No-Show: Dort lohnt ein Gespräch. Kein
                    // Rot — eine Farbe, die anklagt, führt zu Ausreden statt zu
                    // Ursachen.
                    const auffaellig = a.noShowQuote != null && a.noShowQuote >= 40;
                    const nichtsErledigt = a.vergangen >= 5 && a.erledigt === 0;
                    return (
                      <tr key={a.id} className="border-t border-slate-100">
                        <td className="py-2.5 pr-3">
                          <span className="font-semibold text-slate-800">{a.name}</span>
                          <span className="ml-1.5 text-[11px] text-slate-400">{a.rolle}</span>
                        </td>
                        <td className="py-2.5 px-2 text-right tabular-nums">{a.termine}</td>
                        <td className="py-2.5 px-2 text-right tabular-nums text-slate-500">{a.vergangen}</td>
                        <td className="py-2.5 px-2 text-right tabular-nums font-semibold"
                            style={{ color: nichtsErledigt ? "#b45309" : "#059669" }}>
                          {a.erledigt}
                          {a.erledigtQuote != null && (
                            <span className="ml-1 text-[11px] font-normal">({a.erledigtQuote} %)</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-right tabular-nums font-semibold"
                            style={{ color: auffaellig ? "#b45309" : "#64748b" }}>
                          {a.verpasst}
                          {a.noShowQuote != null && (
                            <span className="ml-1 text-[11px] font-normal">({a.noShowQuote} %)</span>
                          )}
                        </td>
                        <td className="py-2.5 pl-2 text-right tabular-nums text-slate-500">{a.kommend}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {daten.jeAgent.some((a: any) => a.vergangen >= 5 && a.erledigt === 0) && (
              <p className="mt-3 px-3.5 py-2.5 rounded-xl text-[12.5px] leading-relaxed"
                 style={{ background: "rgba(217,119,6,.09)", color: "#92400e" }}>
                Bei mindestens einem Mitarbeiter ist <b>kein einziger</b> vergangener
                Termin als erledigt markiert. Zwei Möglichkeiten: Die Gespräche
                finden nicht statt — oder sie werden nicht abgeschlossen. Beides
                klärt ein Gespräch, kein Programm.
              </p>
            )}
          </section>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            DIE FILTER
            ══════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-wrap items-end gap-2 mb-4">
          <div className="inline-flex bg-slate-100 rounded-xl p-1">
            {(["heute", "woche", "monat"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setAnsicht(v)}
                      className={`px-3.5 py-2 rounded-lg text-[12.5px] font-semibold ${
                        ansicht === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                      style={{ minHeight: 40 }}>
                {v === "heute" ? "Heute" : v === "woche" ? "Diese Woche" : "Dieser Monat"}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-500 mb-1">Mitarbeiter</span>
            <select value={agent} onChange={(e) => setAgent(e.target.value)} className={feld}
                    style={{ borderColor: "#e4e9f2", minHeight: 38 }}>
              <option value="">Alle</option>
              {(daten?.jeAgent ?? []).map((a: any) => (
                <option key={a.id} value={String(a.id)}>{a.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-500 mb-1">Quelle</span>
            <select value={quelle} onChange={(e) => setQuelle(e.target.value)} className={feld}
                    style={{ borderColor: "#e4e9f2", minHeight: 38 }}>
              <option value="">Alle</option>
              {Object.entries(daten?.quellen ?? {}).map(([k, v]) => (
                <option key={k} value={k}>{String(v)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold text-slate-500 mb-1">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={feld}
                    style={{ borderColor: "#e4e9f2", minHeight: 38 }}>
              <option value="">Alle</option>
              {Object.entries(daten?.statusListe ?? {}).map(([k, v]: any) => (
                <option key={k} value={k}>{v.text}</option>
              ))}
            </select>
          </label>
          {(agent || quelle || status) && (
            <button type="button" onClick={() => { setAgent(""); setQuelle(""); setStatus(""); }}
                    className="px-3 py-2 rounded-lg text-[12px] font-semibold text-slate-500"
                    style={{ minHeight: 38 }}>
              Filter zurücksetzen
            </button>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            DIE TERMINE — Tabelle auf Desktop, Karten auf dem Telefon
            ══════════════════════════════════════════════════════════════════ */}
        <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 mb-5">
          <h2 className="text-[14px] font-bold text-slate-900 mb-3">
            {ansicht === "heute" ? "Heute" : ansicht === "woche" ? "Diese Woche" : "Dieser Monat"}
            {daten?.termine && (
              <span className="ml-2 text-[12px] font-semibold text-slate-400 tabular-nums">
                {daten.termine.length}
              </span>
            )}
          </h2>

          {laedt && <p className="py-8 text-center text-[13px] text-slate-400">Lädt …</p>}
          {!laedt && daten?.termine?.length === 0 && (
            <p className="py-8 text-center text-[13px] text-slate-500">
              Keine Termine in diesem Zeitraum{agent || quelle || status ? " mit diesen Filtern" : ""}.
            </p>
          )}

          {/* ── AUF DEM TELEFON: KARTEN ──────────────────────────────────
              Das schmale Bauteil aus dem Vortag, jetzt an echte Daten
              angeschlossen. Ein 6-Spalten-Raster auf 380 px wäre unlesbar. */}
          {!laedt && daten?.termine?.length > 0 && (
            <div className="md:hidden">
              <TeamKalenderSchmal
                termine={daten.termine.map((t: any) => ({
                  id: t.id, start: t.beginn, title: t.kundeName,
                  agentName: t.agentName, art: t.quelleText,
                  kundeName: t.kundeName, kundeRef: t.ref, status: t.status,
                }))}
                tage={ansicht === "heute" ? 1 : ansicht === "woche" ? 7 : 31}
                // In der Zentrale sind die VERPASSTEN Termine die Arbeit — sie
                // liegen in der Vergangenheit. Ohne diese Angabe zeigte die
                // Kartenliste „keine Termine", während die Tabelle 52 hatte.
                auchVergangene
                onTerminClick={(t) => {
                  const treffer = daten.termine.find((x: any) => String(x.id) === String(t.id));
                  if (treffer?.akte) window.location.href = treffer.akte;
                }}
              />
            </div>
          )}

          {/* ── AUF DESKTOP: DIE TABELLE ──────────────────────────────── */}
          {!laedt && daten?.termine?.length > 0 && (
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[.08em] text-slate-500">
                    <th className="pb-2 pr-3 font-bold">Zeit</th>
                    <th className="pb-2 px-2 font-bold">Kunde</th>
                    <th className="pb-2 px-2 font-bold">Mitarbeiter</th>
                    <th className="pb-2 px-2 font-bold">Art</th>
                    <th className="pb-2 px-2 font-bold">Quelle</th>
                    <th className="pb-2 pl-2 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {daten.termine.map((t: any) => (
                    <tr key={t.id} className="border-t border-slate-100">
                      <td className="py-2.5 pr-3 tabular-nums whitespace-nowrap">
                        {ansicht === "heute" ? zeit.format(new Date(t.beginn))
                          : tagZeit.format(new Date(t.beginn))}
                      </td>
                      <td className="py-2.5 px-2">
                        {t.akte ? (
                          <a href={t.akte} className="font-semibold no-underline" style={{ color: ACCENT }}>
                            {t.kundeName}
                          </a>
                        ) : <span className="font-semibold text-slate-700">{t.kundeName}</span>}
                        {t.telefon && (
                          <span className="ml-2 text-[11px] text-slate-400 tabular-nums">{t.telefon}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-slate-600">{t.agentName}</td>
                      {/* Die ART neben der Quelle (30.08.2026): Die Quelle sagt,
                          WOHER der Termin kommt, die Art sagt, WAS gleich
                          passiert. Nur die Art beantwortet „worauf stelle ich
                          mich ein?" — und sie kommt aus derselben Ableitung wie
                          im Kalender und in der Mail. */}
                      <td className="py-2.5 px-2">
                        {t.artText && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold"
                                title={t.artErklaerung || undefined}
                                style={{ background: `${t.artTon || "#64748b"}14`, color: t.artTon || "#64748b" }}>
                            {t.artText}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-slate-500">{t.quelleText}</td>
                      <td className="py-2.5 pl-2">
                        <span className="px-2 py-0.5 rounded text-[11.5px] font-semibold"
                              style={{ background: `${t.ton}18`, color: t.ton }}>
                          {t.statusText}
                        </span>
                        {/* Stornierte bleiben sichtbar — mit Zeitpunkt und dem,
                            der storniert hat. Ein verschwundener Termin sieht
                            aus wie ein Fehler. */}
                        {t.abgesagtAm && (
                          <span className="block text-[11px] text-slate-400 mt-0.5">
                            storniert am {datum.format(new Date(t.abgesagtAm))}
                            {t.abgesagtVon ? ` durch ${t.abgesagtVon}` : " durch Kunde"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            BEZAHLTE KUNDEN OHNE TERMIN — DIE ARBEITSLISTE
            ══════════════════════════════════════════════════════════════════ */}
        {daten?.ohneTermin && (
          <section className="rounded-2xl p-4 sm:p-5"
                   style={{ background: "rgba(217,119,6,.07)", boxShadow: "inset 0 0 0 1px rgba(217,119,6,.22)" }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[14.5px] font-bold" style={{ color: "#92400e" }}>
                  {daten.ohneTermin.anzahl} bezahlte Kunden ohne Termin
                </h2>
                <p className="text-[12.5px] mt-1 leading-relaxed" style={{ color: "#92400e", maxWidth: 620 }}>
                  Diese Menschen haben Geld überwiesen und warten auf ihr
                  Startgespräch. {daten.ohneTermin.mitMail} von ihnen haben eine
                  E-Mail-Adresse — die übrigen brauchen einen Anruf.
                </p>
                {/* ── DIE GRENZE STEHT VOR DEM KLICK, NICHT DANACH ────────
                    Ein erster Entwurf nannte die 50 erst in der Vorschau. Wer
                    einen Knopf „alle einladen" sieht und 336 Kunden kennt,
                    rechnet mit 336 Mails — und traut sich nicht zu drücken. */}
                <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: "#92400e" }}>
                  Einladungen gehen <b>gestaffelt</b> raus: höchstens <b>50 am Tag</b>.
                  Eine plötzliche Spitze wertet Brevo als Spam — danach kommen auch
                  Zahlungsaufforderungen nicht mehr an. Der Knopf zeigt erst eine
                  Vorschau.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button type="button" disabled={busy}
                        onClick={() => void einladen("alle", false)}
                        className="px-4 py-2.5 rounded-xl border text-[12.5px] font-semibold"
                        style={{ borderColor: "rgba(217,119,6,.35)", color: "#92400e", minHeight: 44 }}>
                  Vorschau: alle einladen
                </button>
              </div>
            </div>

            {/* ── DIE VORSCHAU VOR DEM VERSAND ─────────────────────────── */}
            {einladung && (
              <div className="mt-3 px-3.5 py-3 rounded-xl bg-white">
                <p className="text-[12.5px] font-semibold text-slate-800">
                  {einladung.hinweis ?? einladung.error ?? "—"}
                </p>
                {einladung.vorschau && einladung.wuerdenGehen > 0 && (
                  <>
                    <p className="text-[12px] text-slate-500 mt-1.5 leading-relaxed">
                      Höchstens {einladung.tagesgrenze} am Tag — heute schon{" "}
                      {einladung.heuteSchon} verschickt. Eine plötzliche Spitze wertet
                      Brevo als Spam, und danach kommen auch Zahlungsaufforderungen
                      nicht mehr an.
                    </p>
                    {einladung.namen?.length > 0 && (
                      <p className="text-[11.5px] text-slate-400 mt-1.5">
                        z. B. {einladung.namen.slice(0, 6).join(" · ")}
                        {einladung.wuerdenGehen > 6 && ` … und ${einladung.wuerdenGehen - 6} weitere`}
                      </p>
                    )}
                    <button type="button" disabled={busy}
                            onClick={() => void einladen("alle", true)}
                            className="mt-2.5 px-4 py-2.5 rounded-xl text-white text-[12.5px] font-semibold"
                            style={{ background: ACCENT, minHeight: 44 }}>
                      {busy ? "Sendet …" : `Ja, ${einladung.wuerdenGehen} Einladungen senden`}
                    </button>
                  </>
                )}
                {Array.isArray(einladung.fehler) && einladung.fehler.length > 0 && (
                  <ul className="mt-2 text-[11.5px]" style={{ color: "#b91c1c" }}>
                    {einladung.fehler.map((f: string, i: number) => <li key={i}>· {f}</li>)}
                  </ul>
                )}
              </div>
            )}

            {/* ── DIE LISTE, LÄNGST BEZAHLTE ZUERST ────────────────────── */}
            <ul className="mt-3 space-y-1.5">
              {(daten.ohneTermin.liste ?? []).slice(0, 25).map((o: any) => (
                <li key={o.ref}
                    className="px-3 py-2.5 rounded-xl bg-white flex flex-wrap items-center gap-x-3 gap-y-1">
                  <a href={o.akte} className="text-[13px] font-semibold no-underline" style={{ color: ACCENT }}>
                    {o.name}
                  </a>
                  <span className="text-[11.5px] text-slate-500">{o.paket ?? "Paket unbekannt"}</span>
                  {o.bezahltAm && (
                    <span className="text-[11.5px] text-slate-400">
                      bezahlt {datum.format(new Date(o.bezahltAm))}
                    </span>
                  )}
                  {o.agentName && <span className="text-[11.5px] text-slate-400">{o.agentName}</span>}
                  {o.letzteEinladung ? (
                    <span className="text-[11.5px]" style={{ color: "#92400e" }}>
                      Einladung schon am {datum.format(new Date(o.letzteEinladung))}
                    </span>
                  ) : (
                    <span className="text-[11.5px] text-slate-400">noch nie eingeladen</span>
                  )}
                  <button type="button" disabled={busy || !o.email}
                          onClick={() => void einladen([o.ref], true)}
                          title={o.email ? undefined : "Ohne E-Mail-Adresse kann keine Einladung raus — dieser Kunde braucht einen Anruf."}
                          /* ── EIN AKTIVER KNOPF DARF NICHT AUSSEHEN WIE EIN
                                 DEAKTIVIERTER ────────────────────────────────
                             Erster Entwurf: `background: ACCENT12` (7 %
                             Deckkraft). Im Screenshot wirkten alle 25 Knöpfe
                             ausgegraut — ein Knopf, den man für inaktiv hält,
                             wird nicht gedrückt. Jetzt weißer Grund mit
                             Rahmen in Akzentfarbe: klarer Kontrast, ohne die
                             Liste zu übertönen. */
                          className="ml-auto px-3 py-2 rounded-lg text-[12px] font-bold disabled:opacity-40"
                          style={{
                            background: "#fff", color: ACCENT, minHeight: 40,
                            boxShadow: `inset 0 0 0 1.5px ${ACCENT}`,
                          }}>
                    Einladung senden
                  </button>
                </li>
              ))}
            </ul>
            {daten.ohneTermin.anzahl > 25 && (
              <p className="mt-2 text-[11.5px]" style={{ color: "#92400e" }}>
                Die 25 ältesten von {daten.ohneTermin.anzahl}. Über „alle einladen“
                gehen sie gestaffelt raus.
              </p>
            )}
          </section>
        )}
    </div>
  );
}

export default AdminTerminePage;
