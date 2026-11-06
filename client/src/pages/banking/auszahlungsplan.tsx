// ═══════════════════════════════════════════════════════════════════════════
// FIAON BANKING — Auszahlungsplan (E-484, 06.11.2026)
//
// Ein zugesagter Betrag, ausgezahlt in festen Teilbeträgen — je Empfänger ein
// eigener Plan mit eigener Uhr. Ablauf je Teilbetrag: auslösen → mit TAN
// freigeben → die Freigabe geht automatisch an die Buchhaltung → erst deren
// Bestätigung bucht aus und erzeugt den Durchführungsbeleg.
//
// Die Seite entscheidet nichts selbst. Ob ein Knopf geht, sagt der Server
// (GET /buchhaltung/auszahlungsplan, planLage). Die Uhr zählt mit dem Versatz
// zur Server-Zeit nur herunter und lädt bei 0 neu — sie löst nie selbst aus.
// Fehler bleiben als Meldung stehen. Genau EIN Navy-Glas: die Takt-Platte.
// Namen, Beträge und Adressen kommen nur aus den Daten, nie aus dem Quelltext.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import {
  BankFehler, ruf,
  type Altposten, type AltpostenModus, type Auftrag, type PlanAltpostenDetail, type PlanAuftrag, type PlanEingabe,
  type PlanGrenzen, type PlanKandidat, type PlanLage, type PlanTakt, type PlanVorgaben, type PlanVorschau, type PlanZeile, type PlanZustand,
} from "./api";
import { centsAus, geld, tag, uhr, zeit } from "./format";
import { Chip, Feld, Guilloche, Knopf, KnopfLink, Laden, Meldung, Zeichen, type ChipArt } from "./ui";
import { TanDialog } from "./tan";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGANG_AUSZAHLUNGSPLAN } from "@/pages/agent/rundgaenge";

/** Nach so langer Wartezeit sagt die Seite „antwortet langsam“ — statt für immer zu laden (AGENTS.md, Checkliste Nr. 4). */
const ZEITGRENZE_MS = 15_000;
/** Solange der Reiter sichtbar ist, holt er alle zwei Minuten den neuen Stand (die andere Person arbeitet mit). */
const AUFFRISCHEN_MS = 120_000;

type MeldungArt = "gut" | "fehler" | "info" | "warn";
interface Hinweis { art: MeldungArt; text: ReactNode }

const fehlerText = (e: unknown, sonst: string): string => (e instanceof Error && e.message ? e.message : sonst);
const mehrzahl = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;
const reduziert = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
function hinrollen(id: string) {
  window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: reduziert() ? "auto" : "smooth", block: "center" }), 80);
}

/** Lesende Abrufe bekommen eine Zeitgrenze. Aktionen nie: Der Server könnte sie trotzdem ausführen. */
function mitZeitgrenze<T>(p: Promise<T>, ms = ZEITGRENZE_MS): Promise<T> {
  return new Promise<T>((ja, nein) => {
    const t = window.setTimeout(() => nein(new Error("Der Server antwortet gerade nicht. Bitte erneut versuchen.")), ms);
    p.then((w) => { window.clearTimeout(t); ja(w); }, (e) => { window.clearTimeout(t); nein(e); });
  });
}

/** 1:12:05 oder 4:09 */
function dauerText(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sek = s % 60;
  const zwei = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${zwei(m)}:${zwei(sek)}` : `${m}:${zwei(sek)}`;
}

/** „seit 12 Min.“ / „seit 3 Std.“ / „seit 4 Tagen“ — gerechnet in Server-Zeit. */
function seitText(iso: string | null, versatz: number): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const min = Math.max(0, Math.floor((Date.now() + versatz - t) / 60_000));
  if (min < 60) return `seit ${min} Min.`;
  const std = Math.floor(min / 60);
  return std < 48 ? `seit ${std} Std.` : `seit ${Math.floor(std / 24)} Tagen`;
}

const ZUSTAND: Record<PlanZustand, { kurz: string; text: string; art: ChipArt }> = {
  bereit: { kurz: "Bereit", text: "Bereit", art: "gut" },
  wartet: { kurz: "Wartezeit", text: "Wartezeit läuft", art: "info" },
  stau: { kurz: "Stau", text: "Stau-Grenze erreicht", art: "warn" },
  unterwegs: { kurz: "Unterwegs", text: "Alle übrigen unterwegs", art: "info" },
  konto: { kurz: "Konto prüfen", text: "Angehalten: Konto", art: "warn" },
  pausiert: { kurz: "Pausiert", text: "Pausiert", art: "still" },
  fertig: { kurz: "Fertig", text: "Abgeschlossen", art: "gut" },
  beendet: { kurz: "Beendet", text: "Beendet", art: "still" },
};

const AUSZAHLUNG_STAND: Record<string, string> = { angefordert: "angefordert", requested: "Altbestand", ausgezahlt: "ausgezahlt", abgelehnt: "abgelehnt" };
const AUFTRAG_STAND: Record<string, string> = { entwurf: "Entwurf", eingereicht: "wartet auf Freigabe", freigegeben: "freigegeben" };
const TAKT_ART: Record<PlanTakt["ergebnis"], ChipArt> = {
  zur_freigabe: "warn", bei_buchhaltung: "info", ausgefuehrt: "gut", abgelehnt: "fehler", zurueckgezogen: "still", zurueckgerufen: "still", unbekannt: "still",
};

/**
 * Die Altposten in Worten — für die Vorschau („wird verrechnet“), die Plan-Karte („wurde verrechnet“) und die
 * Zeile „außerhalb des Plans offen“. Der Betrag eines Auftrags steckt in seiner Auszahlung und wird nicht doppelt gezählt.
 */
function altpostenZeilen(a: Altposten | PlanAltpostenDetail | null, art: "vorschau" | "verrechnet" | "offen"): string[] {
  if (!a) return [];
  const z: string[] = [];
  if (a.vormerkungen?.anzahl) z.push(`${mehrzahl(a.vormerkungen.anzahl, "Vormerkung", "Vormerkungen")} · ${geld(a.vormerkungen.cents)}`);
  if (a.provisionen?.anzahl) z.push(`${mehrzahl(a.provisionen.anzahl, "bestätigte Provision", "bestätigte Provisionen")} · ${geld(a.provisionen.cents)}`);
  for (const p of a.auszahlungen ?? []) z.push(`Auszahlung Nr. ${p.id} · ${geld(p.cents)} (${AUSZAHLUNG_STAND[p.status] ?? p.status})`);
  for (const o of a.auftraege ?? []) {
    const schon = o.auszahlungStatus === "ausgezahlt" ? " · die Auszahlung ist schon als überwiesen gebucht und bleibt so" : "";
    const was = art === "vorschau"
      ? (o.beiBuchhaltung ? "liegt bei der Buchhaltung — wird zurückgerufen („Bitte NICHT ausführen“)" : `${AUFTRAG_STAND[o.status] ?? o.status} — wird geschlossen`)
      : art === "verrechnet"
        ? (o.beiBuchhaltung ? "bei der Buchhaltung zurückgerufen" : "geschlossen")
        : (o.beiBuchhaltung ? "liegt bei der Buchhaltung" : AUFTRAG_STAND[o.status] ?? o.status);
    z.push(`${o.nummer} · ${geld(o.cents)} · ${was}${schon}`);
  }
  return z;
}

const hatAltposten = (a: Altposten | null) => !!a && (a.anzahl > 0 || a.auftraege.length > 0);

// ═══════════════════════════════════════════════════════════════════════════
// KLEINE BAUSTEINE
// ═══════════════════════════════════════════════════════════════════════════

/** Die Uhr zählt nur herunter. Bei 0 bittet sie die Seite, neu zu laden — auslösen tut nur ein Mensch. */
function PlanUhr({ bis, versatz, onNull }: { bis: string; versatz: number; onNull: () => void }) {
  const ziel = Date.parse(bis);
  const [rest, setRest] = useState(() => ziel - (Date.now() + versatz));
  const gemeldet = useRef(false);
  const onNullRef = useRef(onNull);
  onNullRef.current = onNull;
  useEffect(() => {
    gemeldet.current = false;
    const tick = () => {
      const r = ziel - (Date.now() + versatz);
      setRest(r);
      // Eine Sekunde Luft: Die Server-Uhr soll sicher schon „bereit“ sagen, wenn die Seite neu fragt.
      if (r <= 0 && !gemeldet.current) { gemeldet.current = true; window.setTimeout(() => onNullRef.current(), 1200); }
    };
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [ziel, versatz]);
  return <span className="bk-plan-uhr" role="timer" aria-label={`Noch ${dauerText(rest)}`}>{Number.isFinite(rest) ? dauerText(rest) : "—"}</span>;
}

/** Ein Grund als Pflichtfeld (Ablehnen, Zurückrufen, Pausieren, Beenden) — mit Zeichenzähler statt stummem Sperren. */
function GrundEingabe({ id, label, knopf, art = "warnung", min = 3, hinweis, onSenden, onAbbrechen }: {
  id: string; label: string; knopf: string; art?: "warnung" | "primaer" | "neutral"; min?: number; hinweis?: string;
  onSenden: (grund: string) => Promise<void> | void; onAbbrechen: () => void;
}) {
  const [grund, setGrund] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const zuKurz = grund.trim().length < min;
  const senden = async () => {
    if (zuKurz || laeuft) return;
    setLaeuft(true);
    try { await onSenden(grund.trim()); } finally { setLaeuft(false); }
  };
  return (
    <div className="bk-plan-grund">
      <Feld id={id} l={label} hinweis={hinweis ?? (zuKurz ? `Bitte mindestens ${min} Zeichen — der Grund steht im Protokoll.` : "Der Grund steht im Protokoll.")}>
        <input id={id} value={grund} maxLength={300} autoFocus autoComplete="off"
          onChange={(e) => setGrund(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void senden(); } else if (e.key === "Escape") onAbbrechen(); }} />
      </Feld>
      <div className="bk-knopfreihe">
        <Knopf art={art} disabled={zuKurz || laeuft} onClick={() => void senden()}>{laeuft ? "Sende …" : knopf}</Knopf>
        <Knopf art="still" disabled={laeuft} onClick={onAbbrechen}>Abbrechen</Knopf>
      </div>
    </div>
  );
}

function HinweisZeile({ h, onZu }: { h?: Hinweis; onZu: () => void }) {
  return h ? <Meldung art={h.art} onZu={onZu}>{h.text}</Meldung> : null;
}

/** Ein aufklappbarer Abschnitt — der Kopf steht immer da (auch als Ziel für den Rundgang). */
function Aufklapp({ titel, neben, offen, onUm, children, id }: { titel: string; neben?: ReactNode; offen: boolean; onUm: () => void; children: ReactNode; id: string }) {
  return (
    <>
      <h2 className="bk-plan-auf-h">
        <button type="button" className="bk-plan-auf" aria-expanded={offen} aria-controls={id} onClick={onUm}>
          <Zeichen n="rechts" g={15} />
          <span className="bk-plan-auf-t">{titel}</span>
          {neben ? <span className="bk-plan-auf-neben">{neben}</span> : null}
        </button>
      </h2>
      {offen ? <div id={id} className="bk-plan-auf-inhalt">{children}</div> : null}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE TAKT-PLATTE — das eine Navy-Glas: je laufendem Plan eine Zeile mit eigener Uhr und eigenem Knopf
// ═══════════════════════════════════════════════════════════════════════════
function TaktZeile({ p, versatz, laeuft, onAusloesen, onUhrNull, onFortsetzen, onKonto }: {
  p: PlanZeile; versatz: number; laeuft: string | null;
  onAusloesen: (p: PlanZeile) => void; onUhrNull: () => void; onFortsetzen: (p: PlanZeile) => void; onKonto: (p: PlanZeile) => void;
}) {
  const z = p.zustand;
  const betrag = p.naechsterTeil?.betragCents ?? p.teilCents;
  const anteil = p.anzahlTeile > 0 ? Math.min(100, Math.round((p.ausgefuehrt.anzahl / p.anzahlTeile) * 100)) : 0;
  const knopfDa = z === "bereit" || z === "wartet" || z === "stau" || z === "unterwegs" || z === "konto";
  const grundId = `bk-plan-sperre-${p.id}`;
  return (
    <div className={`bk-plan-zeile bk-plan-z-${z}`} data-fiaon={`plan-zeile-${p.id}`}>
      <div className="bk-plan-links">
        <span className="bk-plan-auge">
          <i className={`bk-plan-punkt ${z}`} aria-hidden="true" />
          <span>{ZUSTAND[z].kurz}</span>
          <span className="bk-mono bk-plan-nr">{p.nummer}</span>
          {p.ichBinEmpfaenger ? <span className="bk-plan-selbst">Selbst Empfängerin</span> : null}
        </span>
        <span className="bk-plan-betrag">{geld(betrag)}</span>
        <span className="bk-plan-an">
          {p.naechsterTeil ? <>Teilbetrag {p.naechsterTeil.nr} von {p.anzahlTeile}</> : <>Teilbeträge à {geld(p.teilCents)}</>}
          {" · "}geht an <strong>{p.empfaengerName}</strong>
          {p.ibanMasked ? <> · Konto <span className="bk-mono">{p.ibanMasked}</span></> : null}
        </span>
        <div className="bk-plan-balken" aria-hidden="true"><i style={{ width: `${anteil}%` }} /></div>
        <span className="bk-plan-fein">{p.ausgefuehrt.anzahl} von {p.anzahlTeile} ausgeführt · {geld(p.ausgefuehrt.cents)} von {geld(p.anspruchCents)}</span>
      </div>
      <div className="bk-plan-rechts">
        {z === "wartet" ? (
          <>
            <span className="bk-plan-satz" id={grundId}>Nächster Teilbetrag ab {uhr(p.naechsteAb)} Uhr</span>
            <PlanUhr key={p.naechsteAb} bis={p.naechsteAb} versatz={versatz} onNull={onUhrNull} />
            {p.letzteAusloesungAm ? (
              <span className="bk-plan-fein">Zuletzt ausgelöst um {uhr(p.letzteAusloesungAm)} Uhr{p.letzteAusloesungVonName ? ` von ${p.letzteAusloesungVonName}` : ""}.</span>
            ) : null}
          </>
        ) : z !== "bereit" && p.sperrGrund ? <span className="bk-plan-satz" id={grundId}>{p.sperrGrund}</span> : null}
        {knopfDa ? (
          <button type="button" className="bk-plan-ausloesen" data-fiaon="plan-ausloesen"
            disabled={!p.darfAusloesen || laeuft !== null} aria-describedby={z !== "bereit" ? grundId : undefined}
            onClick={() => onAusloesen(p)}>
            <Zeichen n="senden" g={16} />
            <span>{laeuft === `ausloesen-${p.id}` ? "Wird ausgelöst …" : z === "bereit" ? "Teilbetrag auslösen" : z === "wartet" ? `Ab ${uhr(p.naechsteAb)} Uhr` : "Gerade gesperrt"}</span>
          </button>
        ) : null}
        {z === "pausiert" && p.darfFortsetzen ? (
          <button type="button" className="bk-plan-hell" disabled={laeuft !== null} onClick={() => onFortsetzen(p)}>Fortsetzen</button>
        ) : null}
        {z === "konto" && p.darfKontoBestaetigen ? (
          <button type="button" className="bk-plan-hell" disabled={laeuft !== null} onClick={() => onKonto(p)}>
            <Zeichen n="schloss" g={14} /><span>Neues Konto mit TAN bestätigen</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

function TaktPlatte({ plaene, inhaber, versatz, laeuft, onAusloesen, onUhrNull, onFortsetzen, onKonto, onAnlegen }: {
  plaene: PlanZeile[]; inhaber: boolean; versatz: number; laeuft: string | null;
  onAusloesen: (p: PlanZeile) => void; onUhrNull: () => void; onFortsetzen: (p: PlanZeile) => void; onKonto: (p: PlanZeile) => void; onAnlegen: () => void;
}) {
  return (
    <section className="bk-plan-takt" aria-label="Takt der Auszahlungspläne" data-fiaon="plan-takt">
      <Guilloche className="bk-plan-band" linien={18} />
      {plaene.length === 0 ? (
        <div className="bk-plan-leer-takt">
          <span className="bk-plan-auge"><i className="bk-plan-punkt" aria-hidden="true" /><span>Auszahlungsplan</span></span>
          <strong>Es läuft gerade kein Auszahlungsplan.</strong>
          <span className="bk-plan-satz">
            {inhaber
              ? "Leg unten einen an — je Empfänger ein eigener Plan mit eigener Uhr, alle mit einer TAN."
              : "Den legt der Inhaber an. Sobald es einen gibt, steht er hier mit seiner Uhr."}
          </span>
          {inhaber ? (
            <div><button type="button" className="bk-plan-hauptknopf" onClick={onAnlegen}><Zeichen n="plus" g={16} /><span>Plan anlegen</span></button></div>
          ) : null}
        </div>
      ) : plaene.map((p) => (
        <TaktZeile key={p.id} p={p} versatz={versatz} laeuft={laeuft}
          onAusloesen={onAusloesen} onUhrNull={onUhrNull} onFortsetzen={onFortsetzen} onKonto={onKonto} />
      ))}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// NACH DEM AUSLÖSEN — bleibt stehen, bis man es schließt
// ═══════════════════════════════════════════════════════════════════════════
interface Ausgeloest {
  planId: number; planNummer: string; auftragId: number; nummer: string; betragCents: number; empfaengerName: string;
  teilNr: number; anzahl: number; schon: boolean;
}

function ErgebnisKarte({ x, lage, versatz, laeuft, onFreigeben, onZu }: {
  x: Ausgeloest; lage: PlanLage; versatz: number; laeuft: string | null; onFreigeben: (a: PlanAuftrag) => void; onZu: () => void;
}) {
  const zf = lage.zurFreigabe.find((a) => a.id === x.auftragId);
  const bb = lage.beiBuchhaltung.find((a) => a.id === x.auftragId);
  const aus = lage.ausgefuehrt.zeilen.find((a) => a.id === x.auftragId);
  const plan = lage.plaene.find((p) => p.id === x.planId);
  const inhaber = lage.istInhaber;
  return (
    <section className="bk-karte bk-plan-ergebnis" data-fiaon="plan-ergebnis" aria-live="polite">
      <div className="bk-plan-ergebnis-kopf">
        <span className="bk-plan-siegel" aria-hidden="true"><Zeichen n="haken" g={16} /></span>
        <div className="bk-plan-ergebnis-t">
          <strong><span className="bk-mono">{x.nummer}</span> · {geld(x.betragCents)} an {x.empfaengerName} ist angelegt.</strong>
          <span className="bk-leise">
            Teilbetrag {x.teilNr} von {x.anzahl} · {x.planNummer}
            {x.schon ? " · Das war ein zweiter Klick — es gibt nur diesen einen Auftrag." : ""}
          </span>
        </div>
        <button type="button" className="bk-meldung-zu" aria-label="Schließen" onClick={onZu}><Zeichen n="kreuz" g={14} /></button>
      </div>
      {zf ? (
        zf.darfFreigeben ? (
          <div className="bk-plan-ergebnis-tun">
            <Knopf art="primaer" zeichen="schloss" disabled={laeuft !== null} onClick={() => onFreigeben(zf)}>
              {inhaber ? "Selbst mit TAN freigeben" : "Jetzt mit TAN freigeben"}
            </Knopf>
            <span className="bk-leise">
              {inhaber ? "Oder die Geschäftsführung gibt frei."
                : plan?.hinweisAnInhaber ? "Oder der Inhaber gibt frei — er hat einen Hinweis bekommen." : "Oder der Inhaber gibt frei."}
            </span>
          </div>
        ) : <p className="bk-plan-ergebnis-satz">{zf.freigabeGrund ?? "Die Freigabe ist gerade nicht möglich."}</p>
      ) : bb ? (
        <p className="bk-plan-ergebnis-satz bk-gut-text">
          <Zeichen n="haken" g={14} /> Freigegeben — liegt bei der Buchhaltung{bb.externGesendetAm ? ` ${seitText(bb.externGesendetAm, versatz)}` : ""}. Ausgebucht wird mit ihrer Bestätigung.
        </p>
      ) : aus ? (
        <p className="bk-plan-ergebnis-satz bk-gut-text"><Zeichen n="haken" g={14} /> Ausgeführt — der Beleg steht unter „Ausgeführt“.</p>
      ) : (
        <p className="bk-plan-ergebnis-satz">Dieser Auftrag ist nicht mehr offen. Was mit ihm geschah, steht unten im Verlauf.</p>
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// JE EMPFÄNGER — Fortschritt, Konto, Altposten, Steuerung
// ═══════════════════════════════════════════════════════════════════════════
function PersonKarte({ p, inhaber, laeuft, hinweis, onHinweisZu, grundOffen, setGrundOffen, onPausieren, onFortsetzen, onBeenden, onKonto, onHinweisMail }: {
  p: PlanZeile; inhaber: boolean; laeuft: string | null; hinweis?: Hinweis; onHinweisZu: () => void;
  grundOffen: string | null; setGrundOffen: (s: string | null) => void;
  onPausieren: (p: PlanZeile, grund: string) => Promise<void>; onFortsetzen: (p: PlanZeile) => void;
  onBeenden: (p: PlanZeile, grund: string) => void; onKonto: (p: PlanZeile) => void; onHinweisMail: (p: PlanZeile) => void;
}) {
  const laeuftPlan = p.status === "aktiv" || p.status === "pausiert";
  const anteil = p.anspruchCents > 0 ? Math.min(100, Math.round((p.ausgefuehrt.cents / p.anspruchCents) * 100)) : 0;
  const letzter = p.anspruchCents - p.teilCents * (p.anzahlTeile - 1);
  const ausserhalb = altpostenZeilen(p.ausserhalb, "offen");
  const verrechnetZa = (p.altpostenDetail?.auftraege ?? []).map((o) => o.nummer);
  const steuerung = p.darfPausieren || p.darfFortsetzen || p.darfKontoBestaetigen || p.darfBeenden;
  return (
    <article className={`bk-karte bk-plan-person${laeuftPlan ? "" : " bk-plan-person-alt"}`} data-fiaon={`plan-person-${p.id}`}>
      <header className="bk-plan-person-kopf">
        <div className="bk-plan-person-wer">
          <span className="bk-plan-person-name">{p.empfaengerName}</span>
          <span className="bk-mono bk-leise">{p.nummer}</span>
        </div>
        <div className="bk-plan-chips">
          <Chip art={ZUSTAND[p.zustand].art}>{ZUSTAND[p.zustand].text}</Chip>
          {p.ichBinEmpfaenger ? <Chip art="tief" zeichen="person">Selbst Empfängerin</Chip> : null}
        </div>
      </header>

      <div className="bk-plan-anspruch-zeile">
        <span className="bk-plan-anspruch">{geld(p.anspruchCents)}</span>
        <span className="bk-leise">
          Anspruch · {letzter !== p.teilCents && p.anzahlTeile > 1
            ? `${p.anzahlTeile - 1} × ${geld(p.teilCents)} + 1 × ${geld(letzter)}`
            : `${p.anzahlTeile} × ${geld(p.teilCents)}`}
        </span>
      </div>
      <div className="bk-plan-hellbalken" role="img" aria-label={`${p.ausgefuehrt.anzahl} von ${p.anzahlTeile} Teilbeträgen ausgeführt`}>
        <i style={{ width: `${anteil}%` }} />
      </div>
      <div className="bk-plan-zahlen">
        <div><span>Ausgeführt</span><strong>{p.ausgefuehrt.anzahl} von {p.anzahlTeile}</strong><em>{geld(p.ausgefuehrt.cents)}</em></div>
        <div><span>Zur Freigabe</span><strong>{p.zurFreigabe.anzahl}</strong><em>{geld(p.zurFreigabe.cents)}</em></div>
        <div><span>Bei der Buchhaltung</span><strong>{p.beiBuchhaltung.anzahl}</strong><em>{geld(p.beiBuchhaltung.cents)}</em></div>
        <div><span>Noch offen</span><strong>{p.offen.anzahl}</strong><em>{geld(p.offen.cents)}</em></div>
      </div>

      <ul className="bk-plan-zeilen">
        <li>
          <span>Konto laut Plan</span>
          <span><span className="bk-mono">{p.ibanMasked ?? "—"}</span>{p.kontoBestaetigtAm ? ` · bestätigt am ${tag(p.kontoBestaetigtAm)}${p.kontoBestaetigtVonName ? ` von ${p.kontoBestaetigtVonName}` : ""}` : ""}</span>
        </li>
        {p.kontoArt === "geaendert" ? (
          <li className="bk-plan-zeile-warn">
            <span>Jetzt hinterlegt</span>
            <span><span className="bk-mono">{p.kontoAktuellMasked ?? "—"}</span> — Teilbeträge sind angehalten, bis der Inhaber das neue Konto mit TAN bestätigt.</span>
          </li>
        ) : null}
        <li><span>Takt</span><span>alle {p.abstandMin} Min. ein Teilbetrag · höchstens {p.maxOffen} unterwegs</span></li>
        <li>
          <span>Altposten</span>
          <span>
            {p.altposten === "verrechnet"
              ? (p.altpostenAnzahl > 0 || verrechnetZa.length > 0
                ? `beim Anlegen im Plan verrechnet: ${mehrzahl(p.altpostenAnzahl, "Posten", "Posten")} · ${geld(p.altpostenCents)}`
                : "beim Anlegen war nichts offen")
              : "zusätzlich — offene Altposten liefen beim Anlegen unverändert weiter"}
          </span>
        </li>
        {verrechnetZa.length ? (
          <li><span>Geschlossene Aufträge</span><span className="bk-mono">{verrechnetZa.join(", ")}</span></li>
        ) : null}
        {laeuftPlan ? (
          <li>
            <span>Außerhalb des Plans</span>
            <span>
              {ausserhalb.length
                ? <>{ausserhalb.join(" · ")} — das läuft ganz normal über „Auszahlungen“, nicht über diesen Plan.</>
                : "Außerhalb des Plans ist gerade nichts offen."}
            </span>
          </li>
        ) : null}
        {p.selbstfreigaben > 0 ? (
          <li><span>Selbstfreigaben</span><span>{mehrzahl(p.selbstfreigaben, "Teilbetrag", "Teilbeträge")} von der Empfängerin selbst mit TAN freigegeben</span></li>
        ) : null}
        <li><span>Angelegt</span><span>von {p.angelegtVonName} am {tag(p.angelegtAm)} (mit TAN){p.grund ? ` · ${p.grund}` : ""}</span></li>
        {!laeuftPlan || p.status === "pausiert" ? (p.sperrGrund ? <li><span>Stand</span><span>{p.sperrGrund}</span></li> : null) : null}
        {inhaber && p.darfHinweisSchalten ? (
          <li>
            <span>Hinweis-Mail</span>
            <span>
              {p.hinweisAnInhaber ? "an — nach jeder Auslösung durch die Geschäftsführung kommt „Bitte freigeben“." : "aus."}{" "}
              <button type="button" className="bk-link-knopf" disabled={laeuft !== null} onClick={() => onHinweisMail(p)}>
                {p.hinweisAnInhaber ? "Ausschalten" : "Einschalten"}
              </button>
            </span>
          </li>
        ) : null}
      </ul>

      <HinweisZeile h={hinweis} onZu={onHinweisZu} />
      {grundOffen === `pause-${p.id}` ? (
        <GrundEingabe id={`bk-plan-pause-${p.id}`} label={`Warum wird ${p.nummer} pausiert?`} knopf="Pausieren" art="neutral"
          onSenden={(g) => onPausieren(p, g)} onAbbrechen={() => setGrundOffen(null)} />
      ) : null}
      {grundOffen === `ende-${p.id}` ? (
        <GrundEingabe id={`bk-plan-ende-${p.id}`} label={`Warum wird ${p.nummer} beendet?`} knopf="Weiter zur TAN" art="warnung"
          hinweis="Eingereichte Teilbeträge werden zurückgezogen. Was schon bei der Buchhaltung liegt, bleibt dort, bis du es einzeln zurückrufst."
          onSenden={(g) => onBeenden(p, g)} onAbbrechen={() => setGrundOffen(null)} />
      ) : null}
      {steuerung ? (
        <footer className="bk-plan-steuer">
          {p.darfPausieren ? <Knopf klein disabled={laeuft !== null} onClick={() => setGrundOffen(`pause-${p.id}`)}>Pausieren</Knopf> : null}
          {p.darfFortsetzen ? <Knopf klein art="primaer" disabled={laeuft !== null} onClick={() => onFortsetzen(p)}>Fortsetzen</Knopf> : null}
          {p.darfKontoBestaetigen ? <Knopf klein art="primaer" zeichen="schloss" disabled={laeuft !== null} onClick={() => onKonto(p)}>Neues Konto bestätigen</Knopf> : null}
          <span className="bk-flex" />
          {p.darfBeenden ? <Knopf klein art="still" disabled={laeuft !== null} onClick={() => setGrundOffen(`ende-${p.id}`)}>Plan beenden</Knopf> : null}
        </footer>
      ) : null}
    </article>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SO FUNKTIONIERT DIE AUSZAHLUNG — die Anleitung zum Aufklappen
// ═══════════════════════════════════════════════════════════════════════════
function Anleitung({ buchhaltung }: { buchhaltung: string }) {
  return (
    <ol className="bk-plan-schritte">
      <li><div><strong>Auslösen.</strong> Steht in einer Zeile oben „Bereit“, drückst du dort „Teilbetrag auslösen“. Dabei entsteht genau ein Zahlungsauftrag. Empfänger, Betrag und Konto stehen fest im Plan — jeder Empfänger hat seinen eigenen Plan und seine eigene Uhr.</div></li>
      <li><div><strong>Warten.</strong> Danach ist der Knopf dieses Plans für die Wartezeit gesperrt (sie steht im Plan, meist 90 Minuten). Die Uhr zeigt, ab wann es weitergeht. Der Server zählt, nicht dein Browser. Die anderen Pläne laufen unabhängig weiter.</div></li>
      <li><div><strong>Freigeben.</strong> Drück „Jetzt mit TAN freigeben“. Die TAN kommt per Mail, gilt 5 Minuten und passt nur zu diesem Teilbetrag. Stimmt in der Mail etwas nicht, gibst du sie nicht ein und lehnst ab. Du kannst die Freigabe auch dem Inhaber überlassen.</div></li>
      <li><div><strong>Buchhaltung.</strong> Mit der Freigabe geht der Auftrag automatisch an die Buchhaltung (<span className="bk-mono">{buchhaltung}</span>). Sie überweist per SEPA und bestätigt über ihren Link. Die Bank-Referenz gibt sie an, wenn sie sie zur Hand hat — Pflicht ist sie nicht.</div></li>
      <li><div><strong>Beleg.</strong> Erst nach ihrer Bestätigung steht „Ausgeführt“ da. Der Durchführungsbeleg kommt per Mail an die Person, die freigegeben hat, und steht unter „Ausgeführt“.</div></li>
      <li><div><strong>Wenn etwas hakt.</strong> Liegt ein Auftrag länger als 2 Bankarbeitstage bei der Buchhaltung, drückst du „Erneut an die Buchhaltung“. Wirkt etwas falsch, drückst du „Pausieren“ (mit Grund) — dann steht der Plan still, bis der Inhaber fortsetzt. Nach 10 Minuten ohne Eingabe meldet dich das Banking ab. Jede Handlung steht im Verlauf.</div></li>
      <li><div><strong>Gut zu wissen.</strong> Beim Anlegen hat der Inhaber entschieden, ob offene Altposten des Empfängers (Vormerkungen, bestätigte Provisionen, angeforderte Auszahlungen) im Plan verrechnet wurden — das ist der Standard — oder zusätzlich bestehen blieben. Was gilt, steht bei jedem Empfänger. Neue Provisionen nach dem Anlegen laufen immer ganz normal über „Auszahlungen“.</div></li>
    </ol>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PLAN ANLEGEN — nur der Inhaber: Empfänger wählen (je Empfänger ein Plan), Vorschau mit Altposten, dann EINE TAN
// ═══════════════════════════════════════════════════════════════════════════
interface AnlageAntwort {
  plaene: { id: number; nummer: string; agentId: number; name: string; anzahlTeile: number; altpostenCents: number; altpostenAnzahl: number }[];
  zurueckgerufen: string[];
  hinweise: string[];
}

function PlanAnlegen({ offen, setOffen, kastenRef, onAngelegt }: {
  offen: boolean; setOffen: (o: boolean) => void; kastenRef: MutableRefObject<HTMLElement | null>; onAngelegt: () => void;
}) {
  const [daten, setDaten] = useState<{ kandidaten: PlanKandidat[]; vorgaben: PlanVorgaben; grenzen: PlanGrenzen } | null>(null);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [gewaehlt, setGewaehlt] = useState<Record<number, string>>({});
  const [teil, setTeil] = useState("");
  const [abstand, setAbstand] = useState("");
  const [maxOffen, setMaxOffen] = useState("");
  const [altposten, setAltposten] = useState<AltpostenModus>("verrechnet");
  const [hinweisMail, setHinweisMail] = useState(true);
  const [grund, setGrund] = useState("");
  const [vorschau, setVorschau] = useState<PlanVorschau | null>(null);
  const [vorschauFuer, setVorschauFuer] = useState<string | null>(null);
  const [pruefe, setPruefe] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [tanFuer, setTanFuer] = useState<PlanEingabe | null>(null);
  const [erfolg, setErfolg] = useState<AnlageAntwort | null>(null);
  const vorgabenGesetzt = useRef(false);

  const kandidatenLaden = useCallback(async () => {
    setLaedt(true); setLadeFehler(null);
    try {
      const j = await mitZeitgrenze(ruf<{ kandidaten: PlanKandidat[]; vorgaben: PlanVorgaben; grenzen: PlanGrenzen }>("/buchhaltung/auszahlungsplan/kandidaten"));
      setDaten({ kandidaten: j.kandidaten, vorgaben: j.vorgaben, grenzen: j.grenzen });
      // Die Vorgaben kommen vom Server — einmal eintragen; danach gilt, was der Inhaber eingibt.
      if (!vorgabenGesetzt.current) {
        vorgabenGesetzt.current = true;
        setTeil((j.vorgaben.teilCents / 100).toFixed(2).replace(".", ","));
        setAbstand(String(j.vorgaben.abstandMin));
        setMaxOffen(String(j.vorgaben.maxOffen));
        setAltposten(j.vorgaben.altposten);
        setHinweisMail(j.vorgaben.hinweisAnInhaber);
      }
    } catch (e) {
      setLadeFehler(fehlerText(e, "Die Empfängerliste konnte nicht geladen werden."));
    } finally { setLaedt(false); }
  }, []);
  useEffect(() => { if (offen && !daten && !laedt && !ladeFehler) void kandidatenLaden(); }, [offen, daten, laedt, ladeFehler, kandidatenLaden]);

  /** Schließen behält die Eingaben, lädt beim nächsten Öffnen aber Empfänger und Altposten frisch. */
  const schliessen = () => { setOffen(false); setDaten(null); setVorschau(null); setVorschauFuer(null); setFehler(null); setLadeFehler(null); };

  // Die Eingabe genau so, wie sie an den Server geht — sortiert, damit „hat sich etwas geändert?“ eindeutig ist.
  const { eingabe, probleme } = useMemo(() => {
    const p: string[] = [];
    if (!daten) return { eingabe: null as PlanEingabe | null, probleme: p };
    const g = daten.grenzen;
    const ids = Object.keys(gewaehlt).map(Number).filter((id) => daten.kandidaten.some((k) => k.agentId === id && k.auswaehlbar)).sort((a, b) => a - b);
    if (ids.length < g.empfaenger.min) p.push("Mindestens einen Empfänger wählen.");
    if (ids.length > g.empfaenger.max) p.push(`Höchstens ${g.empfaenger.max} Empfänger auf einmal.`);
    const teilCents = centsAus(teil);
    if (!Number.isFinite(teilCents) || teilCents < g.teilCents.min || teilCents > g.teilCents.max) {
      p.push(`Teilbetrag zwischen ${geld(g.teilCents.min)} und ${geld(g.teilCents.max)}.`);
    }
    const empfaenger = ids.map((id) => {
      const name = daten.kandidaten.find((k) => k.agentId === id)?.name ?? `#${id}`;
      const cents = centsAus(gewaehlt[id] ?? "");
      if (!Number.isFinite(cents)) p.push(`Anspruch für ${name} fehlt.`);
      else if (cents < g.anspruchCents.min || cents > g.anspruchCents.max) p.push(`Anspruch für ${name} zwischen ${geld(g.anspruchCents.min)} und ${geld(g.anspruchCents.max)}.`);
      else if (Number.isFinite(teilCents) && teilCents > 0 && Math.ceil(cents / teilCents) > g.teile.max) p.push(`Für ${name} wären es mehr als ${g.teile.max} Teilbeträge — bitte den Teilbetrag erhöhen.`);
      return { agentId: id, anspruchCents: cents };
    });
    const abstandMin = Number(abstand);
    if (!Number.isInteger(abstandMin) || abstandMin < g.abstandMin.min || abstandMin > g.abstandMin.max) p.push(`Abstand zwischen ${g.abstandMin.min} und ${g.abstandMin.max} Minuten.`);
    const maxOffenN = Number(maxOffen);
    if (!Number.isInteger(maxOffenN) || maxOffenN < g.maxOffen.min || maxOffenN > g.maxOffen.max) p.push(`Höchstens unterwegs: zwischen ${g.maxOffen.min} und ${g.maxOffen.max}.`);
    const grundSauber = grund.replace(/\s+/g, " ").trim();
    if (grundSauber.length < g.grund.min || grundSauber.length > g.grund.max) p.push(`Grund mit ${g.grund.min} bis ${g.grund.max} Zeichen.`);
    if (p.length) return { eingabe: null as PlanEingabe | null, probleme: p };
    return {
      eingabe: { empfaenger, teilCents, abstandMin, maxOffen: maxOffenN, altposten, hinweisAnInhaber: hinweisMail, grund: grundSauber } as PlanEingabe,
      probleme: p,
    };
  }, [daten, gewaehlt, teil, abstand, maxOffen, altposten, hinweisMail, grund]);

  const schluessel = eingabe ? JSON.stringify(eingabe) : "";
  const vorschauPasst = !!vorschau && !!eingabe && vorschauFuer === schluessel;

  const vorschauLaden = async (ein: PlanEingabe) => {
    setPruefe(true); setFehler(null);
    try {
      const j = await mitZeitgrenze(ruf<{ vorschau: PlanVorschau }>("/buchhaltung/auszahlungsplan/neu/vorschau", { body: ein }));
      setVorschau(j.vorschau); setVorschauFuer(JSON.stringify(ein));
    } catch (e) {
      setFehler(fehlerText(e, "Die Vorschau konnte nicht geladen werden."));
    } finally { setPruefe(false); }
  };

  const umschalten = (k: PlanKandidat) => {
    if (!k.auswaehlbar) return;
    setGewaehlt((g) => {
      const n = { ...g };
      if (k.agentId in n) delete n[k.agentId]; else n[k.agentId] = "";
      return n;
    });
  };

  const zuruecksetzen = () => {
    setGewaehlt({}); setGrund(""); setVorschau(null); setVorschauFuer(null); setFehler(null);
    setDaten(null); // beim nächsten Öffnen frisch: Altposten und laufende Pläne haben sich geändert
    vorgabenGesetzt.current = false; setTeil(""); setAbstand(""); setMaxOffen("");
  };

  return (
    <section className="bk-karte bk-plan-verwaltung" ref={(el) => { kastenRef.current = el; }} id="bk-plan-anlegen" data-fiaon="plan-anlegen">
      <header className="bk-karte-kopf">
        <h2>Plan anlegen</h2>
        <span className="bk-leise">nur Inhaber · eine TAN für alle gewählten Empfänger</span>
      </header>

      {erfolg ? (
        <Meldung art="gut" onZu={() => setErfolg(null)}>
          {erfolg.plaene.length === 1 ? "Angelegt: " : `${erfolg.plaene.length} Pläne angelegt: `}
          {erfolg.plaene.map((p) => `${p.nummer} (${p.name}, ${mehrzahl(p.anzahlTeile, "Teilbetrag", "Teilbeträge")}${p.altpostenAnzahl ? `, ${mehrzahl(p.altpostenAnzahl, "Altposten", "Altposten")} · ${geld(p.altpostenCents)} verrechnet` : ""})`).join(" · ")}.
          {erfolg.zurueckgerufen.length ? ` Bei der Buchhaltung zurückgerufen: ${erfolg.zurueckgerufen.join(", ")}.` : ""}
          {" "}Die Pläne stehen oben in der Takt-Platte; der erste Teilbetrag kann sofort ausgelöst werden.
        </Meldung>
      ) : null}
      {erfolg?.hinweise.map((h) => <Meldung key={h} art="warn">{h}</Meldung>)}

      {!offen ? (
        <div className="bk-knopfreihe bk-plan-anlegen-zu">
          <Knopf art="primaer" zeichen="plus" onClick={() => setOffen(true)}>Plan anlegen</Knopf>
          <span className="bk-leise">Je Empfänger ein eigener Plan mit eigener Uhr. Vor der TAN siehst du je Empfänger, welche Altposten verrechnet werden.</span>
        </div>
      ) : !daten ? (
        <div className="bk-plan-anlegen-laden">
          {ladeFehler ? (
            <Meldung art="fehler">{ladeFehler} <button type="button" className="bk-link-knopf" onClick={() => void kandidatenLaden()}>Erneut versuchen</button></Meldung>
          ) : <Laden zeilen={4} />}
          <div className="bk-knopfreihe"><Knopf art="still" onClick={schliessen}>Schließen</Knopf></div>
        </div>
      ) : (
        <div className="bk-plan-formular">
          <div className="bk-feld bk-breit">
            <label id="bk-plan-wahl-l">Empfänger — je Empfänger ein eigener Plan</label>
            <ul className="bk-plan-wahl" aria-labelledby="bk-plan-wahl-l">
              {daten.kandidaten.length === 0 ? <li className="aus"><span className="bk-leise">Es gibt keine aktiven Mitarbeiter mit Bankverbindung.</span></li> : null}
              {daten.kandidaten.map((k) => {
                const an = k.agentId in gewaehlt;
                const id = `bk-plan-anspruch-${k.agentId}`;
                return (
                  <li key={k.agentId} className={`${an ? "an" : ""}${k.auswaehlbar ? "" : " aus"}`}>
                    <label className="bk-plan-wahl-kopf">
                      <input type="checkbox" checked={an} disabled={!k.auswaehlbar} onChange={() => umschalten(k)} />
                      <span className="bk-plan-wahl-name">
                        <strong>{k.name}</strong>
                        <span className="bk-mono bk-leise">{k.ibanMasked ?? "keine IBAN hinterlegt"}</span>
                      </span>
                      <span className="bk-leise bk-plan-wahl-alt">
                        {k.altposten ? (hatAltposten(k.altposten) ? `offen: ${mehrzahl(k.altposten.anzahl, "Posten", "Posten")} · ${geld(k.altposten.cents)}` : "nichts offen") : ""}
                      </span>
                    </label>
                    {!k.auswaehlbar && k.grund ? <span className="bk-feld-h">{k.grund}</span> : null}
                    {an ? (
                      <Feld id={id} l="Anspruch" hinweis="Der zugesagte Gesamtbetrag für diese Person — er wird in Teilbeträge geteilt.">
                        <div className="bk-betrag-feld">
                          <input id={id} inputMode="decimal" autoComplete="off" value={gewaehlt[k.agentId] ?? ""} placeholder="0,00"
                            onChange={(e) => setGewaehlt((g) => ({ ...g, [k.agentId]: e.target.value }))} />
                          <span>EUR</span>
                        </div>
                      </Feld>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="bk-gitter">
            <Feld id="bk-plan-teil" l="Teilbetrag" hinweis="Je Überweisung. Der letzte Teil ist kleiner, wenn der Anspruch nicht aufgeht.">
              <div className="bk-betrag-feld">
                <input id="bk-plan-teil" inputMode="decimal" autoComplete="off" value={teil} onChange={(e) => setTeil(e.target.value)} />
                <span>EUR</span>
              </div>
            </Feld>
            <Feld id="bk-plan-abstand" l="Abstand in Minuten" hinweis="Wartezeit je Plan zwischen zwei Auslösungen.">
              <input id="bk-plan-abstand" inputMode="numeric" autoComplete="off" value={abstand} onChange={(e) => setAbstand(e.target.value.replace(/[^0-9]/g, ""))} />
            </Feld>
            <Feld id="bk-plan-max" l="Höchstens unterwegs" hinweis="Stau-Grenze je Plan: so viele Teilbeträge dürfen gleichzeitig bei Freigabe oder Buchhaltung liegen.">
              <input id="bk-plan-max" inputMode="numeric" autoComplete="off" value={maxOffen} onChange={(e) => setMaxOffen(e.target.value.replace(/[^0-9]/g, ""))} />
            </Feld>
          </div>

          <div className="bk-feld bk-breit">
            <label id="bk-plan-alt-l">Offene Altposten der Empfänger</label>
            <div className="bk-segment bk-plan-segment" role="radiogroup" aria-labelledby="bk-plan-alt-l">
              <button type="button" role="radio" aria-checked={altposten === "verrechnet"} className={altposten === "verrechnet" ? "aktiv" : ""} onClick={() => setAltposten("verrechnet")}>Im Plan verrechnen (Standard)</button>
              <button type="button" role="radio" aria-checked={altposten === "zusaetzlich"} className={altposten === "zusaetzlich" ? "aktiv" : ""} onClick={() => setAltposten("zusaetzlich")}>Zusätzlich zahlen</button>
            </div>
            <span className="bk-feld-h">
              {altposten === "verrechnet"
                ? "Der Anspruch enthält alles, was beim Empfänger jetzt offen ist. Diese Posten werden beim Anlegen geschlossen — nichts wird gelöscht, alles mit Grund und Protokoll. Aufträge bei der Buchhaltung werden zurückgerufen. Neue Provisionen danach laufen normal."
                : "Der Plan kommt zusätzlich. Offene Altposten bleiben unberührt und laufen normal weiter."}
            </span>
          </div>

          <div className="bk-feld bk-breit">
            <label className="bk-inline bk-plan-haken">
              <input type="checkbox" checked={hinweisMail} onChange={(e) => setHinweisMail(e.target.checked)} />
              <span>Nach jeder Auslösung durch die Geschäftsführung eine Mail „Bitte freigeben“ an mich</span>
            </label>
          </div>

          <Feld id="bk-plan-grund" l="Grund" breit hinweis={`Steht im Plan und im Protokoll · ${grund.trim().length} von ${daten.grenzen.grund.max} Zeichen`}>
            <input id="bk-plan-grund" value={grund} maxLength={daten.grenzen.grund.max} autoComplete="off" onChange={(e) => setGrund(e.target.value)} />
          </Feld>

          {probleme.length ? (
            <div className="bk-plan-probleme" aria-live="polite"><span>Noch offen, bevor die Vorschau geht:</span><ul>{probleme.map((p) => <li key={p}>{p}</li>)}</ul></div>
          ) : null}
          {fehler ? <Meldung art="fehler" onZu={() => setFehler(null)}>{fehler}</Meldung> : null}

          {vorschau ? <VorschauBlock v={vorschau} veraltet={!vorschauPasst} /> : null}

          <div className="bk-form-fuss">
            <Knopf art="still" onClick={schliessen}>Schließen</Knopf>
            <div className="bk-knopfreihe bk-eng">
              <Knopf disabled={!eingabe || pruefe} onClick={() => { if (eingabe) void vorschauLaden(eingabe); }}>
                {pruefe ? "Prüfe …" : vorschauPasst ? "Vorschau neu laden" : "Vorschau prüfen"}
              </Knopf>
              <Knopf art="primaer" zeichen="schloss" disabled={!vorschauPasst || !vorschau || vorschau.fehler.length > 0 || pruefe}
                onClick={() => { if (eingabe) setTanFuer(eingabe); }}>
                Mit TAN anlegen
              </Knopf>
            </div>
          </div>
          <p className="bk-feld-h bk-plan-fuss-satz">
            {!eingabe ? "Erst alle Angaben ausfüllen, dann die Vorschau prüfen."
              : !vorschau ? "Vor der TAN: „Vorschau prüfen“ zeigt je Empfänger die Teilbeträge und genau die Altposten, die verrechnet werden."
              : !vorschauPasst ? "Die Eingabe hat sich seit der Vorschau geändert — bitte die Vorschau neu prüfen."
              : vorschau.fehler.length ? "Erst die Hinweise in der Vorschau lösen."
              : "Die TAN-Mail nennt alle Pläne und die Summe der verrechneten Altposten — vergleiche sie mit der Vorschau."}
          </p>
        </div>
      )}

      {tanFuer ? (
        <TanDialog key="plan-anlegen" offen titel="Auszahlungsplan anlegen" knopf="Anlegen"
          anfordern={async () => {
            const j = await ruf<{ an: string; vorschau: PlanVorschau }>("/buchhaltung/auszahlungsplan/neu/tan", { body: tanFuer });
            // Was die TAN bindet, steht jetzt auch auf dem Bildschirm (hat sich ein Altposten bewegt, sieht man es hier).
            setVorschau(j.vorschau); setVorschauFuer(JSON.stringify(tanFuer));
            return { an: j.an, beschreibung: j.vorschau.beschreibung };
          }}
          bestaetigen={async (t) => {
            try {
              const j = await ruf<AnlageAntwort>("/buchhaltung/auszahlungsplan/neu", { body: { ...tanFuer, tan: t } });
              setErfolg(j);
            } catch (e) {
              if (e instanceof BankFehler && (e.code === "ALTPOSTEN_GEAENDERT" || e.code === "KONTO_GEAENDERT")) void vorschauLaden(tanFuer);
              throw e;
            }
          }}
          onZu={() => setTanFuer(null)}
          onFertig={() => { setTanFuer(null); zuruecksetzen(); setOffen(false); onAngelegt(); }} />
      ) : null}
    </section>
  );
}

/** Die Vorschau VOR der TAN — je Empfänger Teile, Konto und genau die Altposten, die verrechnet werden. */
function VorschauBlock({ v, veraltet }: { v: PlanVorschau; veraltet: boolean }) {
  const verrechnet = v.altposten === "verrechnet";
  return (
    <div className={`bk-plan-vorschau${veraltet ? " veraltet" : ""}`} data-fiaon="plan-vorschau" aria-live="polite">
      <div className="bk-plan-vorschau-kopf">
        <strong>Vorschau</strong>
        {veraltet ? <Chip art="warn">veraltet — bitte neu prüfen</Chip> : <Chip art="info">so wird angelegt</Chip>}
      </div>
      {v.empfaenger.map((e) => {
        const zeilen = altpostenZeilen(e.altposten, verrechnet ? "vorschau" : "offen");
        return (
          <div key={e.agentId} className="bk-plan-vorschau-person">
            <div className="bk-plan-vorschau-wer">
              <strong>{e.name}</strong>
              <span className="bk-leise">Konto <span className="bk-mono">{e.ibanMasked ?? "—"}</span></span>
            </div>
            <div className="bk-plan-vorschau-teile">
              {geld(e.anspruchCents)} = {e.letzterTeilCents !== v.teilCents && e.anzahlTeile > 1
                ? `${e.anzahlTeile - 1} × ${geld(v.teilCents)} + 1 × ${geld(e.letzterTeilCents)}`
                : `${e.anzahlTeile} × ${geld(v.teilCents)}`}
              <span className="bk-leise"> · frühestens fertig in {mehrzahl(e.fruehestensTage, "Tag", "Tagen")}, wenn jede Wartezeit sofort genutzt wird</span>
            </div>
            {e.fehler ? <Meldung art="fehler">{e.fehler}</Meldung> : null}
            {e.altposten ? (
              <div className="bk-plan-alt">
                {verrechnet ? (
                  hatAltposten(e.altposten) ? (
                    <>
                      <strong>Wird im Plan verrechnet: {mehrzahl(e.altposten.anzahl, "Posten", "Posten")} · {geld(e.altposten.cents)}</strong>
                      <ul>{zeilen.map((z) => <li key={z}>{z}</li>)}</ul>
                    </>
                  ) : <span>Keine offenen Altposten — es wird nichts verrechnet.</span>
                ) : (
                  hatAltposten(e.altposten) ? (
                    <>
                      <strong>Bleibt bestehen und läuft normal weiter: {mehrzahl(e.altposten.anzahl, "Posten", "Posten")} · {geld(e.altposten.cents)}</strong>
                      <ul>{zeilen.map((z) => <li key={z}>{z}</li>)}</ul>
                    </>
                  ) : <span>Keine offenen Altposten.</span>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
      <div className="bk-plan-vorschau-summe">
        <span>{mehrzahl(v.empfaenger.length, "Plan", "Pläne")} · {mehrzahl(v.anzahlTeile, "Teilbetrag", "Teilbeträge")} · {geld(v.summeCents)}</span>
        <span>je Plan alle {v.abstandMin} Min. ein Teilbetrag · höchstens {v.maxOffen} unterwegs</span>
        {verrechnet ? <span>Verrechnete Altposten zusammen: {mehrzahl(v.altpostenAnzahl, "Posten", "Posten")} · {geld(v.altpostenCents)}</span> : <span>Altposten bleiben bestehen.</span>}
        {v.zurueckgerufen.length ? (
          <span>Bei der Buchhaltung zurückgerufen: <span className="bk-mono">{v.zurueckgerufen.join(", ")}</span> — sie bekommt eine Mail „Bitte NICHT ausführen“ und wird gebeten, mit der Bank-Referenz zu antworten, falls schon überwiesen.</span>
        ) : null}
      </div>
      {v.fehler.length ? <Meldung art="fehler">{v.fehler.join(" ")}</Meldung> : null}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DER REITER
// ═══════════════════════════════════════════════════════════════════════════
type TanFall =
  | { art: "freigabe"; a: PlanAuftrag }
  | { art: "ende"; plan: PlanZeile; grund: string }
  | { art: "konto"; plan: PlanZeile };

interface AusloesenAntwort {
  schon: boolean; auftrag: Auftrag; plan: { id: number; nummer: string }; teil: { nr: number; anzahl: number; betragCents: number }; naechsteAb: string;
}

export default function Auszahlungsplan({ fokusAuftrag = null, onNeu }: {
  /** Aus dem Hinweis-Link (…?reiter=auszahlungsplan&auftrag=ID): diese Zeile ansteuern und — wenn erlaubt — die Freigabe öffnen. */
  fokusAuftrag?: number | null;
  /** Lädt die Lage der Hülle neu (Zähler am Menüpunkt, „Zu tun“). */
  onNeu: () => void;
}) {
  // AGENTS.md: alle Haken oben, vor dem ersten return.
  const [lage, setLage] = useState<PlanLage | null>(null);
  const [versatz, setVersatz] = useState(0);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [langsam, setLangsam] = useState(false);
  const [laedt, setLaedt] = useState(false);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [hinweise, setHinweise] = useState<Record<string, Hinweis>>({});
  const [ausgeloest, setAusgeloest] = useState<Ausgeloest[]>([]);
  const [tanFall, setTanFall] = useState<TanFall | null>(null);
  const [grundOffen, setGrundOffen] = useState<string | null>(null);
  const [fokusId, setFokusId] = useState<number | null>(null);
  const [erledigtOffen, setErledigtOffen] = useState(false);
  const [verlaufOffen, setVerlaufOffen] = useState(false);
  const [anleitungOffen, setAnleitungOffen] = useState(false);
  const [anlegenOffen, setAnlegenOffen] = useState(false);
  const anfrage = useRef(0);
  const seite = useRef(0);
  const letzteUhrLadung = useRef(0);
  const fokusErledigt = useRef(false);
  const tanOffen = useRef(false);
  const onNeuRef = useRef(onNeu);
  onNeuRef.current = onNeu;
  const rundgangStart = useRef<(() => void) | null>(null);
  const anlegenKasten = useRef<HTMLElement | null>(null);

  const sage = useCallback((schluessel: string, art: MeldungArt, text: ReactNode) => {
    setHinweise((h) => ({ ...h, [schluessel]: { art, text } }));
  }, []);
  const vergiss = useCallback((schluessel: string) => {
    setHinweise((h) => {
      if (!(schluessel in h)) return h;
      const n = { ...h };
      delete n[schluessel];
      return n;
    });
  }, []);

  const laden = useCallback(async (neueSeite?: number) => {
    if (typeof neueSeite === "number") seite.current = Math.max(0, neueSeite);
    const nr = ++anfrage.current;
    setLaedt(true);
    const grenze = window.setTimeout(() => { if (nr === anfrage.current) setLangsam(true); }, ZEITGRENZE_MS);
    try {
      const j = await ruf<PlanLage>(`/buchhaltung/auszahlungsplan?seite=${seite.current}`);
      if (nr !== anfrage.current) return;
      const v = Date.parse(j.jetzt) - Date.now();
      setLage(j); setVersatz(Number.isFinite(v) ? v : 0); setLadeFehler(null); setLangsam(false);
    } catch (e) {
      if (nr !== anfrage.current) return;
      setLadeFehler(fehlerText(e, "Der Auszahlungsplan konnte nicht geladen werden."));
    } finally {
      window.clearTimeout(grenze);
      if (nr === anfrage.current) setLaedt(false);
    }
  }, []);
  const nachAktion = useCallback(async () => { await laden(); onNeuRef.current(); }, [laden]);
  const uhrAbgelaufen = useCallback(() => {
    if (Date.now() - letzteUhrLadung.current < 10_000) return;
    letzteUhrLadung.current = Date.now();
    void nachAktion();
  }, [nachAktion]);

  useEffect(() => { void laden(); }, [laden]);
  useEffect(() => { tanOffen.current = tanFall !== null; }, [tanFall]);
  useEffect(() => {
    // Neuer Stand, wenn der Reiter wieder sichtbar wird, und alle zwei Minuten — nie über einem offenen TAN-Dialog.
    const auffrischen = () => { if (document.visibilityState === "visible" && !tanOffen.current) void laden(); };
    const takt = window.setInterval(auffrischen, AUFFRISCHEN_MS);
    document.addEventListener("visibilitychange", auffrischen);
    return () => { window.clearInterval(takt); document.removeEventListener("visibilitychange", auffrischen); };
  }, [laden]);
  useEffect(() => {
    if (!lage || !fokusAuftrag || fokusErledigt.current) return;
    fokusErledigt.current = true;
    const zf = lage.zurFreigabe.find((a) => a.id === fokusAuftrag);
    const bb = lage.beiBuchhaltung.find((a) => a.id === fokusAuftrag);
    const aus = lage.ausgefuehrt.zeilen.find((a) => a.id === fokusAuftrag);
    const a = zf ?? bb ?? aus;
    if (!a) {
      sage("global", "info", "Der Auftrag aus dem Link ist nicht mehr offen — was mit ihm geschah, steht unten im Verlauf.");
      return;
    }
    setFokusId(a.id);
    if (aus) setErledigtOffen(true);
    hinrollen(`bk-plan-auftrag-${a.id}`);
    if (zf?.darfFreigeben) setTanFall({ art: "freigabe", a: zf });
  }, [lage, fokusAuftrag, sage]);

  // ── Aktionen ───────────────────────────────────────────────────────────
  const ausloesen = async (p: PlanZeile) => {
    const k = `takt-${p.id}`;
    setLaeuft(`ausloesen-${p.id}`); vergiss(k);
    try {
      const j = await ruf<AusloesenAntwort>(`/buchhaltung/auszahlungsplan/${p.id}/ausloesen`, { body: {} });
      await laden();
      setAusgeloest((liste) => [{
        planId: p.id, planNummer: j.plan.nummer, auftragId: j.auftrag.id, nummer: j.auftrag.nummer, betragCents: j.auftrag.betragCents,
        empfaengerName: p.empfaengerName, teilNr: j.teil.nr, anzahl: j.teil.anzahl, schon: j.schon,
      }, ...liste.filter((x) => x.planId !== p.id)]);
      onNeuRef.current();
    } catch (e) {
      if (e instanceof BankFehler && e.code === "ZU_FRUEH" && e.naechsteAb) sage(k, "warn", `${p.nummer}: Der nächste Teilbetrag geht ab ${uhr(e.naechsteAb)} Uhr.`);
      else sage(k, "fehler", `${p.nummer}: ${fehlerText(e, "Der Teilbetrag konnte nicht ausgelöst werden.")}`);
      void nachAktion();
    } finally { setLaeuft(null); }
  };

  /** Eine Handlung an einem Teilbetrag — die Meldung steht im Abschnitt, in dem gehandelt wurde. */
  const auftragTun = async (a: PlanAuftrag, abschnitt: string, pfad: string, body: Record<string, unknown>, erfolg: (j: any) => Hinweis) => {
    setLaeuft(`${pfad}-${a.id}`); vergiss(abschnitt);
    try {
      const j = await ruf<any>(`/buchhaltung/auftrag/${a.id}/${pfad}`, { body });
      const m = erfolg(j);
      sage(abschnitt, m.art, m.text);
      setGrundOffen(null);
    } catch (e) {
      sage(abschnitt, "fehler", `${a.nummer}: ${fehlerText(e, "Das ging nicht durch.")}`);
    } finally {
      setLaeuft(null);
      void nachAktion();
    }
  };

  /** Steuerung eines Plans (pausieren, fortsetzen, Hinweis-Mail). */
  const planTun = async (p: PlanZeile, pfad: "pause" | "weiter" | "hinweis", body: Record<string, unknown>, erfolg: string, schluessel = `plan-${p.id}`) => {
    setLaeuft(`${pfad}-${p.id}`); vergiss(schluessel);
    try {
      await ruf(`/buchhaltung/auszahlungsplan/${p.id}/${pfad}`, { body });
      sage(schluessel, "gut", erfolg);
      setGrundOffen(null);
    } catch (e) {
      sage(schluessel, "fehler", `${p.nummer}: ${fehlerText(e, "Das ging nicht durch.")}`);
    } finally {
      setLaeuft(null);
      void nachAktion();
    }
  };

  const oeffneAnlegen = () => {
    setAnlegenOffen(true);
    window.setTimeout(() => anlegenKasten.current?.scrollIntoView({ behavior: reduziert() ? "auto" : "smooth", block: "start" }), 60);
  };

  /** Was der TAN-Dialog je Fall anfordert und bestätigt — die Routen prüfen jede Regel selbst noch einmal. */
  const tanDaten = (f: TanFall) => {
    if (f.art === "freigabe") {
      const a = f.a;
      return {
        schluessel: `freigabe-${a.id}`, titel: `Freigabe ${a.nummer} · Teil ${a.teilNr}/${a.anzahlTeile}`, knopf: "Freigeben",
        anfordern: () => ruf<{ an: string; beschreibung: string }>(`/buchhaltung/auftrag/${a.id}/tan`, { body: {} }),
        bestaetigen: async (t: string) => {
          const j = await ruf<{ auftrag: Auftrag }>(`/buchhaltung/auftrag/${a.id}/freigeben`, { body: { tan: t } });
          if (j.auftrag?.externGesendetAm) sage("freigabe", "gut", `${a.nummer} ist freigegeben und an die Buchhaltung gegangen. Ausgebucht wird erst mit ihrer Bestätigung.`);
          else sage("freigabe", "warn", `${a.nummer} ist freigegeben, aber noch nicht bei der Buchhaltung angekommen. Bitte unter „Bei der Buchhaltung“ auf „Erneut an die Buchhaltung“ drücken.`);
        },
      };
    }
    if (f.art === "ende") {
      const p = f.plan, grund = f.grund;
      return {
        schluessel: `ende-${p.id}`, titel: `${p.nummer} beenden`, knopf: "Beenden",
        anfordern: () => ruf<{ an: string; beschreibung: string }>(`/buchhaltung/auszahlungsplan/${p.id}/ende/tan`, { body: {} }),
        bestaetigen: async (t: string) => {
          const j = await ruf<{ zurueckgezogen: string[]; beiBuchhaltung: { id: number; nummer: string; betragCents: number }[] }>(
            `/buchhaltung/auszahlungsplan/${p.id}/ende`, { body: { grund, tan: t } });
          sage(`plan-${p.id}`, j.beiBuchhaltung.length ? "warn" : "gut",
            `${p.nummer} ist beendet.${j.zurueckgezogen.length ? ` Zurückgezogen: ${j.zurueckgezogen.join(", ")}.` : ""}`
            + `${j.beiBuchhaltung.length ? ` Noch bei der Buchhaltung: ${j.beiBuchhaltung.map((x) => x.nummer).join(", ")} — bei Bedarf unter „Bei der Buchhaltung“ einzeln zurückrufen.` : ""}`);
        },
      };
    }
    const p = f.plan;
    return {
      schluessel: `konto-${p.id}`, titel: `Neues Konto für ${p.nummer}`, knopf: "Konto übernehmen",
      anfordern: () => ruf<{ an: string; beschreibung: string }>(`/buchhaltung/auszahlungsplan/${p.id}/konto/tan`, { body: {} }),
      bestaetigen: async (t: string) => {
        const j = await ruf<{ ibanMasked: string; unterwegs: number }>(`/buchhaltung/auszahlungsplan/${p.id}/konto`, { body: { tan: t } });
        sage(`takt-${p.id}`, "gut", `${p.nummer}: Neues Konto übernommen — künftige Teilbeträge gehen auf ${j.ibanMasked}.`
          + `${j.unterwegs ? ` ${mehrzahl(j.unterwegs, "Teilbetrag ist", "Teilbeträge sind")} schon unterwegs und behalten das bisherige Konto.` : ""}`);
      },
    };
  };

  // ── Laden, Fehler ──────────────────────────────────────────────────────
  if (!lage) {
    return (
      <div className="bk-seite bk-plan" data-fiaon="auszahlungsplan">
        {ladeFehler ? (
          <Meldung art="fehler">{ladeFehler} <button type="button" className="bk-link-knopf" onClick={() => void laden()}>Erneut versuchen</button></Meldung>
        ) : null}
        {!ladeFehler && langsam ? (
          <Meldung art="warn">Der Auszahlungsplan antwortet gerade langsam. <button type="button" className="bk-link-knopf" onClick={() => void laden()}>Erneut versuchen</button></Meldung>
        ) : null}
        {!ladeFehler ? <Laden zeilen={8} /> : null}
      </div>
    );
  }

  const inhaber = lage.istInhaber;
  const laufend = lage.plaene.filter((p) => p.status === "aktiv" || p.status === "pausiert");
  const andere = lage.plaene.filter((p) => p.status !== "aktiv" && p.status !== "pausiert");
  const summe = (l: PlanAuftrag[]) => l.reduce((s, a) => s + a.betragCents, 0);
  const seiten = Math.max(1, Math.ceil(lage.ausgefuehrt.gesamt / Math.max(1, lage.ausgefuehrt.proSeite)));
  const td = tanFall ? tanDaten(tanFall) : null;

  const reiheKlasse = (a: PlanAuftrag) => `bk-plan-reihe${a.id === fokusId ? " bk-fokus" : ""}`;
  const teilZeile = (a: PlanAuftrag) => `Teilbetrag ${a.teilNr} von ${a.anzahlTeile} · ${a.planNummer}`;

  return (
    <div className="bk-seite bk-plan" data-fiaon="auszahlungsplan">
      <div className="bk-plan-kopf">
        <button type="button" className="bk-plan-chip" data-fiaon="plan-rundgang" onClick={() => rundgangStart.current?.()}>
          <Zeichen n="info" g={14} /><span>So funktioniert’s</span>
        </button>
        <button type="button" className="bk-plan-chip" onClick={() => { setAnleitungOffen(true); hinrollen("bk-plan-anleitung"); }}>
          <Zeichen n="dokument" g={14} /><span>Anleitung lesen</span>
        </button>
        <span className="bk-flex" />
        <span className="bk-leise bk-plan-stand">Stand {uhr(lage.jetzt)} Uhr</span>
        <button type="button" className="bk-link-knopf" disabled={laedt} onClick={() => void nachAktion()}>{laedt ? "Lädt …" : "Aktualisieren"}</button>
      </div>

      {ladeFehler ? <Meldung art="fehler" onZu={() => setLadeFehler(null)}>Neu laden ging nicht: {ladeFehler} Angezeigt ist der Stand von {uhr(lage.jetzt)} Uhr.</Meldung> : null}
      {langsam && !ladeFehler ? <Meldung art="warn">Der Auszahlungsplan antwortet gerade langsam — angezeigt ist der Stand von {uhr(lage.jetzt)} Uhr.</Meldung> : null}
      <HinweisZeile h={hinweise.global} onZu={() => vergiss("global")} />

      <TaktPlatte plaene={laufend} inhaber={inhaber} versatz={versatz} laeuft={laeuft}
        onAusloesen={(p) => void ausloesen(p)} onUhrNull={uhrAbgelaufen}
        onFortsetzen={(p) => void planTun(p, "weiter", {}, `${p.nummer} läuft wieder.`, `takt-${p.id}`)}
        onKonto={(p) => setTanFall({ art: "konto", plan: p })}
        onAnlegen={oeffneAnlegen} />

      {/* Je Plan die Meldung zum Auslösen — auch für einen Plan, der dabei gerade fertig geworden ist. */}
      {lage.plaene.map((p) => (hinweise[`takt-${p.id}`] ? <HinweisZeile key={p.id} h={hinweise[`takt-${p.id}`]} onZu={() => vergiss(`takt-${p.id}`)} /> : null))}
      {ausgeloest.map((x) => (
        <ErgebnisKarte key={x.planId} x={x} lage={lage} versatz={versatz} laeuft={laeuft}
          onFreigeben={(a) => setTanFall({ art: "freigabe", a })}
          onZu={() => setAusgeloest((l) => l.filter((y) => y.planId !== x.planId))} />
      ))}

      {/* ── Zur Freigabe ── */}
      <section className="bk-karte bk-plan-freigabe" data-fiaon="plan-freigabe">
        <header className="bk-karte-kopf">
          <h2>Zur Freigabe</h2>
          <span className="bk-leise">{lage.zurFreigabe.length ? `${lage.zurFreigabe.length} · ${geld(summe(lage.zurFreigabe))}` : "nichts offen"}</span>
        </header>
        <HinweisZeile h={hinweise.freigabe} onZu={() => vergiss("freigabe")} />
        {lage.zurFreigabe.length === 0 ? (
          <p className="bk-plan-leer">Nichts wartet auf Freigabe. Nach dem Auslösen steht der Teilbetrag hier — freigegeben wird immer mit TAN.</p>
        ) : (
          <div className="bk-plan-liste">
            {lage.zurFreigabe.map((a) => (
              <div key={a.id} id={`bk-plan-auftrag-${a.id}`} className={reiheKlasse(a)}>
                <div className="bk-plan-reihe-t">
                  <strong><span className="bk-mono">{a.nummer}</span> · {geld(a.betragCents)} an {a.empfaengerName}</strong>
                  <span className="bk-leise">
                    {teilZeile(a)} · ausgelöst {a.ausgeloestAm ? `${zeit(a.ausgeloestAm)} Uhr` : "—"}{a.ausgeloestVonName ? ` von ${a.ausgeloestVonName}` : ""}
                  </span>
                  {!a.darfFreigeben && a.freigabeGrund ? <span className="bk-plan-grundtext">{a.freigabeGrund}</span> : null}
                </div>
                <div className="bk-plan-reihe-k">
                  {a.darfAblehnen ? <Knopf klein disabled={laeuft !== null} onClick={() => setGrundOffen(`ablehnen-${a.id}`)}>Ablehnen</Knopf> : null}
                  {a.darfFreigeben ? (
                    <Knopf klein art="primaer" zeichen="schloss" disabled={laeuft !== null} onClick={() => setTanFall({ art: "freigabe", a })}>
                      {inhaber ? "Selbst mit TAN freigeben" : "Mit TAN freigeben"}
                    </Knopf>
                  ) : null}
                </div>
                {grundOffen === `ablehnen-${a.id}` ? (
                  <div className="bk-plan-reihe-voll">
                    <GrundEingabe id={`bk-plan-ablehnen-${a.id}`} label={`Warum wird ${a.nummer} abgelehnt?`} knopf="Ablehnen"
                      hinweis="Der Teilbetrag geht zurück in den Plan; die Wartezeit läuft trotzdem weiter."
                      onSenden={(g) => auftragTun(a, "freigabe", "ablehnen", { notiz: g },
                        () => ({ art: "gut", text: `${a.nummer} ist abgelehnt. Der Teilbetrag geht zurück in den Plan.` }))}
                      onAbbrechen={() => setGrundOffen(null)} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Bei der Buchhaltung — immer sichtbar, auch leer ── */}
      <section className="bk-karte bk-plan-buchhaltung" data-fiaon="plan-buchhaltung">
        <header className="bk-karte-kopf">
          <h2>Bei der Buchhaltung</h2>
          <span className="bk-leise">{lage.beiBuchhaltung.length ? `${lage.beiBuchhaltung.length} · ${geld(summe(lage.beiBuchhaltung))}` : "nichts offen"}</span>
        </header>
        <HinweisZeile h={hinweise.buchhaltung} onZu={() => vergiss("buchhaltung")} />
        {lage.beiBuchhaltung.length === 0 ? (
          <p className="bk-plan-leer">Nichts liegt bei der Buchhaltung. Jede Freigabe geht automatisch an <span className="bk-mono">{lage.buchhaltung}</span>; erst ihre Bestätigung bucht aus.</p>
        ) : (
          <div className="bk-plan-liste">
            {lage.beiBuchhaltung.map((a) => (
              <div key={a.id} id={`bk-plan-auftrag-${a.id}`} className={reiheKlasse(a)}>
                <div className="bk-plan-reihe-t">
                  <strong>
                    {a.ueberfaellig ? <i className="bk-plan-warnpunkt" aria-hidden="true" /> : null}
                    <span className="bk-mono">{a.nummer}</span> · {geld(a.betragCents)} an {a.empfaengerName}
                  </strong>
                  <span className="bk-leise">
                    {teilZeile(a)} · {a.beiBuchhaltungSeit ? `bei der Buchhaltung ${seitText(a.beiBuchhaltungSeit, versatz)}` : "noch nicht übermittelt"}
                    {a.entschiedenAm ? ` · freigegeben ${zeit(a.entschiedenAm)} Uhr${a.entschiedenVon === lage.ich.email ? " von dir" : ""}` : ""}
                    {a.freigabeArt === "einzel" ? " (Einzelzeichnung)" : a.freigabeArt === "vier_augen" ? " (vier Augen)" : ""}
                    {a.selbstfreigabe ? " · Selbstfreigabe der Empfängerin" : ""}
                  </span>
                  {a.ueberfaellig ? <span className="bk-plan-grundtext">Länger als 2 Bankarbeitstage offen — erneut an die Buchhaltung senden oder dort nachfragen.</span> : null}
                  {!a.externGesendetAm ? <span className="bk-plan-grundtext">Freigegeben, aber noch nicht bei der Buchhaltung angekommen.</span> : null}
                </div>
                <div className="bk-plan-reihe-k">
                  {a.darfErneutSenden ? (
                    <Knopf klein disabled={laeuft !== null}
                      onClick={() => void auftragTun(a, "buchhaltung", "an-buchhaltung", {},
                        () => ({ art: "gut", text: `${a.nummer} ist ${a.externGesendetAm ? "erneut " : ""}an die Buchhaltung gegangen — ein früherer Link gilt nicht mehr.` }))}>
                      {laeuft === `an-buchhaltung-${a.id}` ? "Sende …" : a.externGesendetAm ? "Erneut an die Buchhaltung" : "Jetzt an die Buchhaltung"}
                    </Knopf>
                  ) : null}
                  {a.darfZurueckrufen ? <Knopf klein art="still" disabled={laeuft !== null} onClick={() => setGrundOffen(`zurueckrufen-${a.id}`)}>Zurückrufen</Knopf> : null}
                </div>
                {grundOffen === `zurueckrufen-${a.id}` ? (
                  <div className="bk-plan-reihe-voll">
                    <GrundEingabe id={`bk-plan-rueckruf-${a.id}`} label={`Warum wird ${a.nummer} zurückgerufen?`} knopf="Zurückrufen"
                      hinweis="Der Link der Buchhaltung wird ungültig, sie bekommt „Bitte NICHT ausführen“. Der Teilbetrag geht zurück in den Plan."
                      onSenden={(g) => auftragTun(a, "buchhaltung", "zurueckrufen", { grund: g }, (j) => (j?.mail === false
                        ? { art: "warn", text: j?.hinweis || `${a.nummer} ist zurückgerufen, aber die Mail an die Buchhaltung ging nicht raus — bitte direkt Bescheid geben.` }
                        : { art: "gut", text: `${a.nummer} ist zurückgerufen: Der Link der Buchhaltung ist ungültig, die Mail „Bitte NICHT ausführen“ ist raus. Der Teilbetrag geht zurück in den Plan.` }))}
                      onAbbrechen={() => setGrundOffen(null)} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Je Empfänger ── */}
      <section className="bk-plan-leute" data-fiaon="plan-leute" aria-label="Je Empfänger">
        <h2 className="bk-plan-titel">Je Empfänger</h2>
        {lage.plaene.length === 0 ? (
          <div className="bk-karte"><p className="bk-plan-leer">Noch kein Auszahlungsplan. {inhaber ? "Unten unter „Plan anlegen“ geht es los." : "Den legt der Inhaber an."}</p></div>
        ) : (
          <div className="bk-plan-leute-gitter">
            {laufend.concat(andere).map((p) => (
              <PersonKarte key={p.id} p={p} inhaber={inhaber} laeuft={laeuft}
                hinweis={hinweise[`plan-${p.id}`]} onHinweisZu={() => vergiss(`plan-${p.id}`)}
                grundOffen={grundOffen} setGrundOffen={setGrundOffen}
                onPausieren={(q, g) => planTun(q, "pause", { grund: g }, `${q.nummer} ist pausiert. Bis der Inhaber fortsetzt, wird nichts ausgelöst und nichts freigegeben.`)}
                onFortsetzen={(q) => void planTun(q, "weiter", {}, `${q.nummer} läuft wieder.`)}
                onBeenden={(q, g) => { setGrundOffen(null); setTanFall({ art: "ende", plan: q, grund: g }); }}
                onKonto={(q) => setTanFall({ art: "konto", plan: q })}
                onHinweisMail={(q) => void planTun(q, "hinweis", { an: !q.hinweisAnInhaber }, `Hinweis-Mail für ${q.nummer} ${q.hinweisAnInhaber ? "ausgeschaltet" : "eingeschaltet"}.`)} />
            ))}
          </div>
        )}
      </section>

      {/* ── Ausgeführt ── */}
      <section className="bk-karte bk-plan-erledigt" data-fiaon="plan-erledigt">
        <Aufklapp id="bk-plan-erledigt-inhalt" titel="Ausgeführt" offen={erledigtOffen} onUm={() => setErledigtOffen((o) => !o)}
          neben={`${mehrzahl(lage.ausgefuehrt.gesamt, "Teilbetrag", "Teilbeträge")} · Durchführungsbelege`}>
          <HinweisZeile h={hinweise.erledigt} onZu={() => vergiss("erledigt")} />
          <div className="bk-knopfreihe bk-eng bk-plan-erledigt-kopf">
            <KnopfLink href="/api/fiaon/buchhaltung/auszahlungsjournal.pdf" zeichen="pdf" klein art="still">Auszahlungsjournal</KnopfLink>
          </div>
          {lage.ausgefuehrt.zeilen.length === 0 ? (
            <p className="bk-plan-leer">Noch kein Teilbetrag ausgeführt. Er steht hier, sobald die Buchhaltung die Überweisung bestätigt hat.</p>
          ) : (
            <div className="bk-plan-liste">
              {lage.ausgefuehrt.zeilen.map((a) => (
                <div key={a.id} id={`bk-plan-auftrag-${a.id}`} className={reiheKlasse(a)}>
                  <div className="bk-plan-reihe-t">
                    <strong><span className="bk-mono">{a.nummer}</span> · {geld(a.betragCents)} an {a.empfaengerName}</strong>
                    <span className="bk-leise">{teilZeile(a)} · überwiesen am {tag(a.externWertAm ?? a.ausgefuehrtAm)}{a.externBestaetigtAm ? ` · bestätigt ${zeit(a.externBestaetigtAm)} Uhr` : ""}</span>
                    <span className="bk-leise">
                      {a.externBankReferenz ? <>Bank-Referenz <span className="bk-mono">{a.externBankReferenz}</span></> : "ohne Bank-Referenz der Buchhaltung"}
                      {a.bankReferenz ? <> · FIAON-Referenz <span className="bk-mono">{a.bankReferenz}</span></> : null}
                      {a.selbstfreigabe ? " · Selbstfreigabe" : ""}
                    </span>
                  </div>
                  <div className="bk-plan-reihe-k">
                    <KnopfLink href={`/api/fiaon/buchhaltung/auftrag/${a.id}/bestaetigung.pdf`} zeichen="pdf" klein>Durchführungsbeleg</KnopfLink>
                    <Knopf klein art="still" disabled={laeuft !== null}
                      onClick={() => void auftragTun(a, "erledigt", "beleg-senden", {},
                        () => ({ art: "gut", text: `Der Durchführungsbeleg zu ${a.nummer} ist erneut an die Person gegangen, die freigegeben hat.` }))}>
                      {laeuft === `beleg-senden-${a.id}` ? "Sende …" : "Beleg erneut senden"}
                    </Knopf>
                  </div>
                </div>
              ))}
            </div>
          )}
          {seiten > 1 ? (
            <div className="bk-knopfreihe bk-plan-blaettern">
              <Knopf klein disabled={lage.ausgefuehrt.seite <= 0 || laedt} onClick={() => void laden(lage.ausgefuehrt.seite - 1)}>Neuere</Knopf>
              <span className="bk-leise">Seite {lage.ausgefuehrt.seite + 1} von {seiten}</span>
              <Knopf klein disabled={lage.ausgefuehrt.seite + 1 >= seiten || laedt} onClick={() => void laden(lage.ausgefuehrt.seite + 1)}>Ältere</Knopf>
            </div>
          ) : null}
        </Aufklapp>
      </section>

      {/* ── Verlauf ── */}
      <section className="bk-karte bk-plan-verlauf" data-fiaon="plan-verlauf">
        <Aufklapp id="bk-plan-verlauf-inhalt" titel="Verlauf" offen={verlaufOffen} onUm={() => setVerlaufOffen((o) => !o)}
          neben={lage.verlauf.length ? `die letzten ${lage.verlauf.length} Auslösungen` : "noch keine Auslösung"}>
          {lage.verlauf.length === 0 ? <p className="bk-plan-leer">Noch nichts ausgelöst.</p> : (
            <ol className="bk-plan-verlauf-liste">
              {lage.verlauf.map((t) => (
                <li key={t.id}>
                  <span className="bk-mono bk-plan-verlauf-zeit">{zeit(t.am)}</span>
                  <span className="bk-plan-verlauf-was">
                    {t.vonName} · {t.planNummer}{t.teilNr ? ` · Teil ${t.teilNr}` : ""}{t.auftragNummer ? <> · <span className="bk-mono">{t.auftragNummer}</span></> : null}
                  </span>
                  <Chip art={TAKT_ART[t.ergebnis]}>{t.ergebnisText}</Chip>
                </li>
              ))}
            </ol>
          )}
        </Aufklapp>
      </section>

      {/* ── So funktioniert die Auszahlung ── */}
      <section className="bk-karte bk-plan-anleitung" id="bk-plan-anleitung" data-fiaon="plan-anleitung">
        <Aufklapp id="bk-plan-anleitung-inhalt" titel="So funktioniert die Auszahlung" offen={anleitungOffen} onUm={() => setAnleitungOffen((o) => !o)}
          neben="sieben kurze Schritte">
          <Anleitung buchhaltung={lage.buchhaltung} />
          <div className="bk-knopfreihe">
            <Knopf klein zeichen="info" onClick={() => rundgangStart.current?.()}>Rundgang starten</Knopf>
          </div>
        </Aufklapp>
      </section>

      {inhaber ? (
        <PlanAnlegen offen={anlegenOffen} setOffen={setAnlegenOffen} kastenRef={anlegenKasten}
          onAngelegt={() => { setAusgeloest([]); void nachAktion(); }} />
      ) : null}

      {tanFall && td ? (
        <TanDialog key={td.schluessel} offen titel={td.titel} knopf={td.knopf}
          anfordern={td.anfordern} bestaetigen={td.bestaetigen}
          onZu={() => setTanFall(null)}
          onFertig={() => { setTanFall(null); void nachAktion(); }} />
      ) : null}

      {/* Rundgang erst mit Daten: Er erklärt die echte Seite, nicht das Ladebild. Kein fester Knopf — Start über den Chip oben. */}
      <Rundgang raum="auszahlungsplan" titel="Auszahlungsplan" schritte={RUNDGANG_AUSZAHLUNGSPLAN} knopf="keiner" startRef={rundgangStart} />
    </div>
  );
}
