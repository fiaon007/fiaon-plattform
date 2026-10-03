// ═══════════════════════════════════════════════════════════════════════════
// FIAON BANKING — Umsätze (E-228)
//
// Jede Zeile kommt aus genau einer Quelle: der Bank (Eingänge), den
// Auszahlungen an Mitarbeiter oder dem Kassenbuch. Das steht an jeder Zeile —
// ein Umsatz ohne Herkunft ist eine Behauptung.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from "react";
import { ruf, type Auftrag, type HandfallArt, type Ich, type NachholVorschlag, type NachholZeile, type Umsatz, type UmsatzArt } from "./api";
import { geld, geldVz, heute, initialen, tag, tagesKopf, zeit, zahl } from "./format";
import { Chip, Dialog, Knopf, KnopfLink, Kopierfeld, Laden, Leer, Meldung, Schublade, Zeichen, useEntprellt, type ChipArt } from "./ui";

export const ART_TEXT: Record<UmsatzArt, string> = {
  kunde: "Kundenzahlung", offen: "Eingang ohne Zuordnung", sonstiges: "Sonstiger Eingang",
  auszahlung: "Auszahlung an Mitarbeiter", ueberweisung: "Überweisung", einlage: "Einlage",
  eingang: "Eingang (erfasst)", ausgabe: "Ausgabe (erfasst)", korrektur: "Korrekturbuchung",
};

const HERKUNFT: Record<UmsatzArt, string> = {
  kunde: "Bank", offen: "Bank", sonstiges: "Bank", auszahlung: "Auszahlung", ueberweisung: "Zahlungsverkehr",
  einlage: "Von Hand", eingang: "Von Hand", ausgabe: "Von Hand", korrektur: "Von Hand",
};

function zustandsChip(u: Umsatz): { art: ChipArt; text: string } | null {
  if (u.storniert) return { art: "still", text: "Storniert" };
  if (u.schwebend) return { art: "info", text: "Unterwegs" };
  if (u.art === "offen") return { art: "warn", text: "Nicht zugeordnet" };
  if (u.art === "auszahlung") return { art: "tief", text: "Auszahlung" };
  if (u.art === "ueberweisung") return { art: "tief", text: "Überweisung" };
  if (u.art === "einlage") return { art: "gut", text: "Einlage" };
  if (u.art === "korrektur") return { art: "warn", text: "Korrektur" };
  if (u.art === "sonstiges") return { art: "still", text: "Sonstiges" };
  if (u.art === "eingang" || u.art === "ausgabe") return { art: "still", text: "Von Hand" };
  return null;
}

const ART_ZEICHEN: Partial<Record<UmsatzArt, string>> = {
  auszahlung: "team", ueberweisung: "senden", einlage: "bank", korrektur: "waage", eingang: "rein", ausgabe: "raus", sonstiges: "karte",
};

export function UmsatzZeile({ u, onWahl, kontoZeigen }: { u: Umsatz; onWahl: (u: Umsatz) => void; kontoZeigen?: boolean }) {
  const chip = zustandsChip(u);
  const zeichen = ART_ZEICHEN[u.art];
  return (
    <button type="button" className={`bk-umsatz${u.storniert ? " bk-storniert" : ""}`} onClick={() => onWahl(u)}>
      <span className={`bk-avatar bk-av-${u.cents < 0 ? "aus" : "ein"}`} aria-hidden="true">
        {zeichen ? <Zeichen n={zeichen} g={16} /> : initialen(u.gegenpartei)}
      </span>
      <span className="bk-u-mitte">
        <span className="bk-u-name">
          {u.gegenpartei}
          {u.kunde && u.kunde.toLowerCase() !== u.gegenpartei.toLowerCase() ? <em> · für {u.kunde}</em> : null}
        </span>
        <span className="bk-u-zweck">
          {u.zweck || ART_TEXT[u.art]}
          {u.referenz && !(u.zweck || "").includes(u.referenz) ? <span className="bk-mono"> · {u.referenz}</span> : null}
        </span>
      </span>
      <span className="bk-u-chips">
        {kontoZeigen && u.konto === "wise" ? <Chip art="still">Wise</Chip> : null}
        {chip ? <Chip art={chip.art}>{chip.text}</Chip> : null}
      </span>
      <span className="bk-u-rechts">
        <span className={`bk-u-betrag ${u.cents < 0 ? "bk-minus" : "bk-plus"}`}>{geldVz(u.cents)}</span>
        {u.saldoNach != null ? <span className="bk-u-saldo">Saldo {zahl(u.saldoNach)}</span> : null}
      </span>
    </button>
  );
}

/** Gruppiert nach Tag, wie in einer Banking-App: Kopf mit Tagessumme. */
export function UmsatzListe({ zeilen, onWahl, kontoZeigen }: { zeilen: Umsatz[]; onWahl: (u: Umsatz) => void; kontoZeigen?: boolean }) {
  const tage = useMemo(() => {
    const karte = new Map<string, Umsatz[]>();
    for (const u of zeilen) karte.set(u.tag, [...(karte.get(u.tag) || []), u]);
    return Array.from(karte.entries());
  }, [zeilen]);
  return (
    <div className="bk-umsatzliste">
      {tage.map(([t, liste]) => {
        const summe = liste.filter((u) => !u.storniert).reduce((s, u) => s + u.cents, 0);
        return (
          <section key={t} className="bk-tag">
            <header className="bk-tag-kopf">
              <span>{tagesKopf(t)}</span>
              <span className={summe < 0 ? "bk-minus" : "bk-leise"}>{geldVz(summe)}</span>
            </header>
            {liste.map((u) => <UmsatzZeile key={u.uid} u={u} onWahl={onWahl} kontoZeigen={kontoZeigen} />)}
          </section>
        );
      })}
    </div>
  );
}

// ── Liegengebliebene Eingänge buchen (01.10.2026) ───────────────────────────
// Der Eingang liegt im Bankbuch, aber keine Buchung hat ihn je angefasst (E-235:
// Referenz ohne Strich, Regel B: Rate ohne Nummer). Der Server rechnet die
// Trockenprobe vor — Ziel, Regel, Betrag, welche Provision vorgemerkt wird, welche
// Mail der Kunde bekommt — und erst dann bucht der Inhaber mit einem Klick über
// denselben Weg wie jede andere Zahlung. Was nicht buchbar ist, zeigt den Grund
// und keinen Knopf.
const REGEL_TEXT: Record<string, string> = {
  erstzahlung: "Erstzahlung — Bestellung wird bezahlt, Kunde freigeschaltet",
  rate: "Monatsrate mit Nummer",
  regel_b: "Regel B — älteste offene Rate (Referenz ohne Ratennummer)",
};

function istBankEingang(u: Umsatz): boolean {
  return u.uid.startsWith("bank:") && u.cents > 0 && !u.verbucht && !u.schwebend && !u.storniert;
}

/** Die Trockenprobe als Liste — in der Schublade und im Bestätigungsfenster dieselbe. */
export function Trockenprobe({ z, kompakt }: { z: NachholZeile; kompakt?: boolean }) {
  return (
    <dl className="bk-dl bk-probe">
      <dt>Ziel</dt><dd className="bk-mono">{z.ziel ?? "—"}{z.kunde ? <span className="bk-leise"> · {z.kunde}</span> : null}</dd>
      <dt>Regel</dt><dd>{z.regel ? REGEL_TEXT[z.regel] ?? z.regel : "—"}{z.rateNr != null ? ` · Rate ${z.rateNr}` : ""}</dd>
      <dt>Betrag</dt><dd>{z.dazu?.length && z.summeCents ? `${geld(z.summeCents)} (Sammelzahlung aus ${z.dazu.length + 1} Eingängen) per ${tag(z.buchDatum ?? z.datum)}` : `${geld(z.betragCents)} am ${tag(z.datum)}`}</dd>
      {!kompakt && z.deckung ? <><dt>Deckung</dt><dd className="bk-leise">{z.deckung}</dd></> : null}
      <dt>Provision</dt><dd>{z.provision.length ? z.provision.map((p, i) => <div key={i}>{p}</div>) : "keine"}</dd>
      {!kompakt ? <><dt>Kunde bekommt</dt><dd>{z.mails.length ? z.mails.map((m, i) => <div key={i}>{m}</div>) : "keine Mail"}</dd></> : null}
      {z.hinweise.length ? <><dt>Hinweis</dt><dd className="bk-probe-hinweis">{z.hinweise.map((h, i) => <div key={i}>{h}</div>)}</dd></> : null}
    </dl>
  );
}

/** Bestätigung vor dem Klick: erst sehen, dann buchen. */
function BuchenDialog({ z, offen, laeuft, onZu, onBuchen }: { z: NachholZeile | null; offen: boolean; laeuft: boolean; onZu: () => void; onBuchen: () => void }) {
  return (
    <Dialog offen={offen && !!z} titel="Jetzt buchen?" onZu={onZu}>
      {z ? (
        <div className="bk-probe-dialog">
          <p className="bk-leise">Der Eingang geht durch denselben Buchungsweg wie jede andere Zahlung. Provision wird nach dem Schalter im Chefbüro vorgemerkt, nicht gebucht.</p>
          <Trockenprobe z={z} />
          <div className="bk-knopfreihe bk-rechts">
            <Knopf art="still" onClick={onZu} disabled={laeuft}>Abbrechen</Knopf>
            <Knopf art="primaer" zeichen="haken" onClick={onBuchen} disabled={laeuft}>{laeuft ? "Bucht …" : `${geld(z.betragCents)} auf ${z.ziel ?? "—"} buchen`}</Knopf>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

async function eingangBuchen(z: NachholZeile): Promise<{ grund: string; aufgabe: string | null }> {
  const j = await ruf<{ ergebnis: { gebucht: boolean; grund: string }; aufgabe: string | null }>(`/buchhaltung/nachholen/bank:${z.id}/buchen`, {
    body: { erwartet: { regel: z.regel, ziel: z.ziel, rateId: z.rateId } },
  });
  if (!j.ergebnis?.gebucht) throw new Error(j.ergebnis?.grund || "Nicht gebucht.");
  return { grund: j.ergebnis.grund, aufgabe: j.aufgabe ?? null };
}

// ── E-277 (02.10.2026): Jeder Handfall mit einem Klick ──────────────────────
// Justin: „Ok buche alle Zahlungen den Kunden richtig zu die gerade nicht gebucht wurden,
// erkenne sie anhand des Namens, Verwendungszweck oder was auch immer, buche alle und lass
// kein über." Der Server schlägt je Eingang EIN Ziel vor (Referenz, auch mit Tippfehler,
// Name, Belegnotiz, Betrag, Datum). Der Inhaber sieht Vorschlag und Grund, prüft im Dialog
// trocken nach und bestätigt: „So buchen" (der eine Weg), „Nur zuordnen" (Geld schon auf
// anderem Weg gebucht — keine zweite Buchung) oder „Aufgabe anlegen" (Teil-/Über-/Rückzahlung).
const HANDFALL_TEXT: Record<HandfallArt, string> = {
  erstzahlung: "Erstzahlung", rate: "Monatsrate", nur_zuordnen: "Nur zuordnen — schon gebucht", teilzahlung: "Teilzahlung",
  ueberzahlung: "Überzahlung", rueckzahlung_noetig: "Rückzahlung nötig", unbekannt: "Unbekannt",
};
const SICHERHEIT_CHIP: Record<NachholVorschlag["sicherheit"], ChipArt> = { sicher: "gut", wahrscheinlich: "info", unklar: "warn" };

/** Vorschlag + Grund — in der Liste und in der Schublade derselbe Kasten. */
export function VorschlagKasten({ v }: { v: NachholVorschlag }) {
  return (
    <div className="bk-vorschlag">
      <div className="bk-vorschlag-kopf">
        <Chip art={SICHERHEIT_CHIP[v.sicherheit]}>{v.sicherheit}</Chip>
        <Chip art="still">{HANDFALL_TEXT[v.art]}</Chip>
        <span><strong>Vorschlag:</strong> {v.text}</span>
      </div>
      {v.gruende.length ? <div className="bk-vorschlag-grund bk-leise">Grund: {v.gruende.join(" + ")}</div> : null}
      {v.hinweise.length ? <div className="bk-probe-hinweis">{v.hinweise.map((h, i) => <div key={i}>{h}</div>)}</div> : null}
    </div>
  );
}

type HandfallModus = "buchen" | "zuordnen" | "aufgabe";
interface HandfallAuftrag { z: NachholZeile; modus: HandfallModus | "anders"; ziel: string; dazu: number[] }

/** Der Erwartungs-Stempel: was der Mensch gesehen hat — weicht der Server ab, bucht er nicht. */
function erwartungAus(p: NachholZeile, modus: HandfallModus) {
  return modus === "zuordnen" ? { ziel: p.ziel, rateId: p.rateId } : { regel: p.regel, ziel: p.ziel, rateId: p.rateId };
}

/** Prüfen und bestätigen: erst trocken, dann der Klick. Auch für ein selbst getipptes Ziel. */
function HandfallDialog({ auftrag, onZu, onFertig }: { auftrag: HandfallAuftrag | null; onZu: () => void; onFertig: (meldung: string) => void }) {
  const [modus, setModus] = useState<HandfallModus | "anders">("buchen");
  const [ziel, setZiel] = useState("");
  const [probe, setProbe] = useState<NachholZeile | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  // E-278 (03.10.2026), Justin: „Konchenko-Sperre im Code reparieren und dann buchen mach ALLE fertig“ —
  // zwei Haken für „Als Buchung prüfen“: Kündigungs-/Kulanz-Storno erst zurücknehmen, Doppelzahlung an
  // der Rückwärtssperre mit dem heutigen Datum verrechnen. Vorgabe aus; ein Haken macht die Probe ungültig.
  const [stornoZurueck, setStornoZurueck] = useState(false);
  const [heuteVerrechnen, setHeuteVerrechnen] = useState(false);
  const z = auftrag?.z ?? null;
  const dazu = auftrag?.dazu ?? [];
  const optionen = { stornoZuruecknehmen: stornoZurueck, verrechnungHeute: heuteVerrechnen };

  const pruefen = useCallback(async (m: HandfallModus, zielText: string, opt: { stornoZuruecknehmen: boolean; verrechnungHeute: boolean } = { stornoZuruecknehmen: false, verrechnungHeute: false }) => {
    if (!z) return;
    setModus(m); setProbe(null); setFehler(null);
    if (m === "aufgabe") return;
    setLaeuft(true);
    try {
      const j = await ruf<{ zeile: NachholZeile }>(`/buchhaltung/nachholen/bank:${z.id}/trocken`, {
        body: m === "zuordnen" ? { ziel: zielText, modus: "zuordnen" } : { ziel: zielText, dazu: m === "buchen" && zielText === auftrag?.ziel ? dazu : [], ...opt },
      });
      setProbe(j.zeile);
    } catch (e: any) { setFehler(e.message); } finally { setLaeuft(false); }
  }, [z, dazu, auftrag?.ziel]);

  useEffect(() => {
    if (!auftrag) return;
    setZiel(auftrag.ziel); setProbe(null); setFehler(null);
    setStornoZurueck(false); setHeuteVerrechnen(false);
    if (auftrag.modus === "anders") { setModus("anders"); return; }
    void pruefen(auftrag.modus, auftrag.ziel);
  }, [auftrag]); // eslint-disable-line react-hooks/exhaustive-deps

  const ausfuehren = async () => {
    if (!z) return;
    setLaeuft(true); setFehler(null);
    try {
      if (modus === "aufgabe") {
        const j = await ruf<{ aufgabe: string | null }>(`/buchhaltung/nachholen/bank:${z.id}/aufgabe`, { body: {} });
        onFertig(`Aufgabe angelegt${j.aufgabe ? ` — ${j.aufgabe}` : ""}. Der Eingang bleibt unverbucht stehen.`);
      } else if (modus === "zuordnen" && probe) {
        await ruf(`/buchhaltung/nachholen/bank:${z.id}/zuordnen`, { body: { ziel, erwartet: erwartungAus(probe, "zuordnen") } });
        onFertig(`Zugeordnet: ${geld(z.betragCents)} → ${probe.ziel} (${probe.kunde ?? "—"}) — keine zweite Buchung.`);
      } else if (modus === "buchen" && probe) {
        const j = await ruf<{ ergebnis: { gebucht: boolean; grund: string }; aufgabe: string | null }>(`/buchhaltung/nachholen/bank:${z.id}/buchen`, {
          body: { ziel, dazu: probe.dazu ?? [], erwartet: erwartungAus(probe, "buchen"), ...optionen },
        });
        if (!j.ergebnis?.gebucht) throw new Error(j.ergebnis?.grund || "Nicht gebucht.");
        onFertig(`Gebucht: ${geld(probe.summeCents ?? z.betragCents)} auf ${probe.ziel} — ${j.ergebnis.grund}${j.aufgabe ? ` · ${j.aufgabe}` : ""}.`);
      }
    } catch (e: any) { setFehler(e.message); } finally { setLaeuft(false); }
  };

  const titel = modus === "zuordnen" ? "Nur zuordnen?" : modus === "aufgabe" ? "Aufgabe anlegen?" : modus === "anders" ? "Anderes Ziel" : "So buchen?";
  const bereit = modus === "aufgabe" || (!!probe && (modus === "zuordnen" ? !!probe.zuordenbar : modus === "buchen" ? probe.buchen : false));
  return (
    <Dialog offen={!!auftrag} titel={titel} onZu={onZu} breit>
      {z ? (
        <div className="bk-probe-dialog">
          <p className="bk-leise">
            Eingang #{z.id}: {geld(z.betragCents)} am {tag(z.datum)}{z.absender ? ` von ${z.absender}` : ""} · Zweck „{z.zweck || "—"}“
          </p>
          <div className="bk-ziel-eingabe">
            <input value={ziel} onChange={(e) => setZiel(e.target.value)} placeholder="FIAON-XXXXXX oder FIAON-XXXXXX-N" aria-label="Ziel (Bestell- oder Ratenreferenz)" />
            <Knopf klein onClick={() => void pruefen("buchen", ziel, optionen)} disabled={laeuft || !ziel.trim()}>Als Buchung prüfen</Knopf>
            <Knopf klein art="still" onClick={() => void pruefen("zuordnen", ziel)} disabled={laeuft || !ziel.trim()}>Als „Nur zuordnen“ prüfen</Knopf>
          </div>
          {modus === "anders" || modus === "buchen" ? (
            <div className="bk-knopfreihe bk-eng">
              <label className="bk-inline bk-leise">
                <input type="checkbox" checked={stornoZurueck} disabled={laeuft}
                  onChange={(e) => { setStornoZurueck(e.target.checked); setProbe(null); if (modus === "buchen") setModus("anders"); }} />
                Storno zurücknehmen
              </label>
              <label className="bk-inline bk-leise">
                <input type="checkbox" checked={heuteVerrechnen} disabled={laeuft}
                  onChange={(e) => { setHeuteVerrechnen(e.target.checked); setProbe(null); if (modus === "buchen") setModus("anders"); }} />
                mit heutigem Datum verrechnen
              </label>
            </div>
          ) : null}
          {modus === "zuordnen" ? <p className="bk-leise">„Nur zuordnen“ bucht nichts: Das Geld gehört zu einer Rate, die schon als bezahlt gebucht ist. Die Zeile im Bankbuch bekommt ihren Haken, die Rate den Beleg, die Akte einen Satz — keine Mail, keine Provision, keine neue Rate.</p> : null}
          {modus === "buchen" ? <p className="bk-leise">Derselbe Buchungsweg wie jede andere Zahlung. Provision wird nach dem Schalter im Chefbüro vorgemerkt, nicht gebucht.</p> : null}
          {modus === "aufgabe" && auftrag?.z.vorschlag ? (
            <>
              <VorschlagKasten v={auftrag.z.vorschlag} />
              <p className="bk-leise">Gebucht wird nichts. {auftrag.z.vorschlag.art === "teilzahlung" ? "Der Betreuer klärt den Rest mit dem Kunden; kommt er, bucht das Bankbuch beide Eingänge zusammen." : "Die Zahlungsstelle entscheidet: erstatten oder mit einer offenen Forderung verrechnen („Anderes Ziel“)."}</p>
            </>
          ) : null}
          {laeuft && !probe ? <Laden zeilen={3} /> : null}
          {probe && modus !== "aufgabe" ? (
            <>
              <Trockenprobe z={probe} />
              {modus === "zuordnen" && probe.deckung ? <p className="bk-leise">{probe.deckung}</p> : null}
              {!bereit ? <Meldung art="warn">Nicht möglich: {probe.unklar ?? probe.ergebnis}</Meldung> : null}
            </>
          ) : null}
          {fehler ? <Meldung art="fehler">{fehler}</Meldung> : null}
          <div className="bk-knopfreihe bk-rechts">
            <Knopf art="still" onClick={onZu} disabled={laeuft}>Abbrechen</Knopf>
            {modus !== "anders" ? (
              <Knopf art="primaer" zeichen="haken" onClick={() => void ausfuehren()} disabled={laeuft || !bereit}>
                {laeuft ? "Läuft …" : modus === "zuordnen" ? `${geld(z.betragCents)} zuordnen` : modus === "aufgabe" ? "Aufgabe anlegen" : `${geld(probe?.summeCents ?? z.betragCents)} auf ${probe?.ziel ?? "—"} buchen`}
              </Knopf>
            ) : null}
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

/** Die Knöpfe zu einem Vorschlag — nur der Inhaber; „Anderes Ziel" immer. */
function HandfallKnoepfe({ z, inhaber, gesperrt, onWahl }: { z: NachholZeile; inhaber: boolean; gesperrt: boolean; onWahl: (a: HandfallAuftrag) => void }) {
  const v = z.vorschlag;
  if (!inhaber) return <p className="bk-leise">Buchen und zuordnen kann nur der Inhaber.</p>;
  return (
    <div className="bk-knopfreihe bk-eng">
      {v?.aktion === "buchen" && v.mitZiel && v.ziel ? <Knopf art="primaer" zeichen="haken" klein disabled={gesperrt} onClick={() => onWahl({ z, modus: "buchen", ziel: v.ziel!, dazu: v.dazu })}>So buchen</Knopf> : null}
      {v?.aktion === "zuordnen" && v.ziel ? <Knopf art="primaer" zeichen="haken" klein disabled={gesperrt} onClick={() => onWahl({ z, modus: "zuordnen", ziel: v.ziel!, dazu: [] })}>Nur zuordnen</Knopf> : null}
      {v?.aktion === "aufgabe" ? <Knopf art="warnung" klein disabled={gesperrt} onClick={() => onWahl({ z, modus: "aufgabe", ziel: v.ziel ?? "", dazu: [] })}>Aufgabe anlegen</Knopf> : null}
      <Knopf art="still" klein disabled={gesperrt} onClick={() => onWahl({ z, modus: "anders", ziel: v?.ziel ?? z.ziel ?? "", dazu: [] })}>Anderes Ziel …</Knopf>
    </div>
  );
}

/** Was „Alle sicheren ausführen" schickt — nur sichere Vorschläge mit Knopf, je mit Erwartung. */
function sichererAuftrag(z: NachholZeile): { id: number; modus: HandfallModus; ziel: string | null; dazu: number[]; erwartet: any; text: string } | null {
  if (z.buchen) return { id: z.id, modus: "buchen", ziel: null, dazu: [], erwartet: { regel: z.regel, ziel: z.ziel, rateId: z.rateId }, text: `${geld(z.betragCents)} → ${z.ziel} (${z.regel === "erstzahlung" ? "Erstzahlung" : `Rate ${z.rateNr ?? "?"}`})` };
  const v = z.vorschlag;
  if (!v || v.sicherheit !== "sicher" || !v.ziel || !v.mitZiel) return null;
  if (!v.erwartet) return null;
  if (v.aktion === "zuordnen") return { id: z.id, modus: "zuordnen", ziel: v.ziel, dazu: [], erwartet: v.erwartet, text: `${geld(z.betragCents)} nur zuordnen → ${v.ziel} (${v.kunde ?? "—"})` };
  if (v.aktion === "buchen") {
    return {
      id: z.id, modus: "buchen", ziel: v.ziel, dazu: v.dazu, erwartet: v.erwartet,
      text: `${geld(z.betragCents)}${v.dazu.length ? ` + Sammel ${v.dazu.map((d) => `#${d}`).join(", ")}` : ""} buchen → ${v.erwartet.ziel ?? v.ziel} (${v.kunde ?? "—"})`,
    };
  }
  return null;
}

/**
 * Der Kasten über der Umsatzliste: „N Eingänge warten auf Buchung" → „Alle prüfen"
 * lädt jede Trockenprobe, dann je Zeile „Jetzt buchen" (nur Inhaber) oder der Grund.
 */
export function NachholPanel({ ich, anzahl, cents, gesamtAnzahl = 0, onGebucht }: { ich: Ich; anzahl: number; cents: number; gesamtAnzahl?: number; onGebucht: () => void }) {
  const [liste, setListe] = useState<NachholZeile[] | null>(null);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [wahl, setWahl] = useState<NachholZeile | null>(null);
  const [handfall, setHandfall] = useState<HandfallAuftrag | null>(null);
  // Vorgabe: der geprüfte Zeitraum seit 24.09. — ältere Eingänge (seit 15.08., E-277) nur auf Wunsch,
  // damit „Alle buchen" nie Zeilen mitnimmt, die niemand angesehen hat.
  const [aeltere, setAeltere] = useState(false);
  const inhaber = ich.rolle === "inhaber";

  const pruefen = async (mitAelteren = aeltere) => {
    setLaeuft("pruefen"); setFehler(null);
    try { const j = await ruf<{ zeilen: NachholZeile[] }>(`/buchhaltung/nachholen${mitAelteren ? "?seit=aeltere" : ""}`); setListe(j.zeilen); }
    catch (e: any) { setFehler(e.message); } finally { setLaeuft(null); }
  };
  const buchen = async (z: NachholZeile) => {
    setLaeuft(`b${z.id}`); setFehler(null);
    try {
      const r = await eingangBuchen(z);
      setMeldung(`Gebucht: ${geld(z.betragCents)} auf ${z.ziel} — ${r.grund}${r.aufgabe ? ` · ${r.aufgabe}` : ""}.`);
      setWahl(null); onGebucht(); await pruefen();
    } catch (e: any) { setFehler(e.message); } finally { setLaeuft(null); }
  };
  const alleBuchen = async () => {
    const frei = (liste || []).filter((z) => z.buchen);
    if (!frei.length) return;
    const text = frei.map((z) => `· ${geld(z.betragCents)} → ${z.ziel} (${z.regel === "erstzahlung" ? "Erstzahlung" : `Rate ${z.rateNr ?? "?"}`})${z.hinweise.length ? " — Hinweis beachten" : ""}`).join("\n");
    if (!window.confirm(`${frei.length} Eingänge jetzt buchen (${geld(frei.reduce((s, z) => s + z.betragCents, 0))})?\n\n${text}\n\nEiner nach dem anderen, Abbruch beim ersten Fehlschlag. Provision wird vorgemerkt, nicht gebucht.`)) return;
    setLaeuft("alle"); setFehler(null);
    try {
      const j = await ruf<{ gebucht: number; abgebrochen: boolean; schritte: { id: number; gebucht: boolean; grund: string }[] }>("/buchhaltung/nachholen/alle-buchen", { body: { ids: frei.map((z) => z.id) } });
      const kaputt = j.schritte.find((x) => !x.gebucht);
      setMeldung(`${j.gebucht} von ${frei.length} gebucht.${kaputt ? ` Abbruch bei #${kaputt.id}: ${kaputt.grund}` : ""}`);
      onGebucht(); await pruefen();
    } catch (e: any) { setFehler(e.message); } finally { setLaeuft(null); }
  };
  // E-277: alle SICHEREN Vorschläge (und die buchbaren) nacheinander — jeder mit seiner Erwartung.
  const sichereAusfuehren = async () => {
    const auftraege = (liste || []).map(sichererAuftrag).filter((x): x is NonNullable<ReturnType<typeof sichererAuftrag>> => !!x);
    if (!auftraege.length) return;
    const text = auftraege.map((a) => `· #${a.id} ${a.text}`).join("\n");
    if (!window.confirm(`${auftraege.length} sichere Vorschläge jetzt ausführen?\n\n${text}\n\nEiner nach dem anderen über denselben Weg wie der Einzelklick, Abbruch beim ersten Fehlschlag. „Nur zuordnen“ bucht nichts. Provision wird vorgemerkt, nicht gebucht.`)) return;
    setLaeuft("sicher"); setFehler(null);
    try {
      const j = await ruf<{ gebucht: number; abgebrochen: boolean; schritte: { id: number; gebucht: boolean; grund: string }[] }>("/buchhaltung/nachholen/alle-buchen", {
        body: { auftraege: auftraege.map(({ text: _t, ...a }) => a) },
      });
      const kaputt = j.schritte.find((x) => !x.gebucht);
      setMeldung(`${j.gebucht} von ${auftraege.length} erledigt.${kaputt ? ` Abbruch bei #${kaputt.id}: ${kaputt.grund}` : ""}`);
      onGebucht(); await pruefen();
    } catch (e: any) { setFehler(e.message); } finally { setLaeuft(null); }
  };

  if (!anzahl && !gesamtAnzahl && !liste) return null;
  const buchbar = (liste || []).filter((z) => z.buchen);
  const sichere = (liste || []).map(sichererAuftrag).filter(Boolean).length;
  const mitVorschlag = (liste || []).filter((z) => !z.buchen && z.vorschlag && z.vorschlag.art !== "unbekannt").length;
  return (
    <section className="bk-nachholen" aria-label="Liegengebliebene Eingänge">
      <header className="bk-nachholen-kopf">
        <div>
          <div className="bk-block-titel">Eingänge ohne Buchung</div>
          <p className="bk-leise">
            {liste
              ? `${liste.length} geprüft · ${buchbar.length} buchbar (${geld(buchbar.reduce((s, z) => s + z.betragCents, 0))}) · ${mitVorschlag} mit Vorschlag · ${sichere} sicher · ${liste.length - buchbar.length - mitVorschlag} ohne Vorschlag`
              : `${anzahl} Eingänge über ${geld(cents)} liegen seit dem 24.09. im Bankbuch${gesamtAnzahl > anzahl ? ` (seit 15.08.: ${gesamtAnzahl})` : ""}, ohne dass eine Buchung sie angefasst hat. „Alle prüfen“ rechnet jede Zeile trocken vor und schlägt je Eingang ein Ziel vor — gebucht wird erst nach deinem Klick.`}
          </p>
        </div>
        <div className="bk-knopfreihe bk-eng">
          <Knopf zeichen="suche" klein onClick={() => void pruefen()} disabled={!!laeuft}>{laeuft === "pruefen" ? "Prüft …" : liste ? "Erneut prüfen" : `Alle ${anzahl} prüfen`}</Knopf>
          {!aeltere && gesamtAnzahl > anzahl ? <Knopf art="still" klein onClick={() => { setAeltere(true); void pruefen(true); }} disabled={!!laeuft}>Ältere einbeziehen (seit 15.08.)</Knopf> : null}
          {inhaber && buchbar.length > 1 ? (
            <Knopf art="primaer" zeichen="haken" klein onClick={() => void alleBuchen()} disabled={!!laeuft}>{laeuft === "alle" ? "Bucht …" : `Alle ${buchbar.length} buchen`}</Knopf>
          ) : null}
          {inhaber && sichere > 1 ? (
            <Knopf art="primaer" zeichen="haken" klein onClick={() => void sichereAusfuehren()} disabled={!!laeuft}>{laeuft === "sicher" ? "Läuft …" : `Alle ${sichere} sicheren ausführen`}</Knopf>
          ) : null}
        </div>
      </header>
      {fehler ? <Meldung art="fehler" onZu={() => setFehler(null)}>{fehler}</Meldung> : null}
      {meldung ? <Meldung art="gut" onZu={() => setMeldung(null)}>{meldung}</Meldung> : null}
      {liste && liste.length === 0 ? <Meldung art="gut">Nichts liegt mehr — alle Eingänge sind gebucht oder unterwegs.</Meldung> : null}
      {liste && liste.length > 0 ? (
        <div className="bk-nachholen-liste">
          {liste.map((z) => (
            <article key={z.id} className={`bk-nachholen-zeile${z.buchen ? " buchbar" : ""}`}>
              <div className="bk-nz-kopf">
                <span className="bk-nz-datum">{tag(z.datum)}</span>
                <span className="bk-nz-betrag bk-plus">{geld(z.betragCents)}</span>
                <span className="bk-nz-zweck">{z.absender ? <strong>{z.absender}</strong> : null} <span className="bk-mono">{z.zweck ?? z.zweckRef ?? "—"}</span></span>
                <span className="bk-nz-nr bk-leise">#{z.id}</span>
              </div>
              {z.buchen ? (
                <>
                  <Trockenprobe z={z} kompakt />
                  {inhaber ? (
                    <div className="bk-knopfreihe bk-eng">
                      <Knopf art="primaer" zeichen="haken" klein onClick={() => setWahl(z)} disabled={!!laeuft}>{laeuft === `b${z.id}` ? "Bucht …" : "Jetzt buchen"}</Knopf>
                    </div>
                  ) : <p className="bk-leise">Buchen kann nur der Inhaber.</p>}
                </>
              ) : (
                <>
                  {z.vorschlag ? <VorschlagKasten v={z.vorschlag} /> : null}
                  <p className="bk-leise bk-nz-grund">Trockenprobe ohne Ziel: {z.unklar ?? z.ergebnis}{z.ziel ? <span className="bk-mono"> · {z.ziel}</span> : null}</p>
                  <HandfallKnoepfe z={z} inhaber={inhaber} gesperrt={!!laeuft} onWahl={setHandfall} />
                </>
              )}
            </article>
          ))}
        </div>
      ) : null}
      <BuchenDialog z={wahl} offen={!!wahl} laeuft={!!laeuft} onZu={() => setWahl(null)} onBuchen={() => { if (wahl) void buchen(wahl); }} />
      <HandfallDialog auftrag={handfall} onZu={() => setHandfall(null)} onFertig={(m) => { setHandfall(null); setMeldung(m); onGebucht(); void pruefen(); }} />
    </section>
  );
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function UmsatzDetail({ uid, onZu, ich, onGebucht }: { uid: string | null; onZu: () => void; ich?: Ich; onGebucht?: () => void }) {
  const [daten, setDaten] = useState<{ umsatz: Umsatz; auftrag: Auftrag | null } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [probe, setProbe] = useState<{ zeile: NachholZeile | null; fehler: string | null } | null>(null);
  const [frage, setFrage] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [gebucht, setGebucht] = useState<string | null>(null);
  const [handfall, setHandfall] = useState<HandfallAuftrag | null>(null);
  useEffect(() => {
    if (!uid) return;
    setDaten(null); setFehler(null); setProbe(null); setFrage(false); setGebucht(null); setHandfall(null);
    ruf<{ umsatz: Umsatz; auftrag: Auftrag | null }>(`/buchhaltung/umsatz/${encodeURIComponent(uid)}`)
      .then((j) => {
        setDaten(j);
        // Ein Bankeingang ohne Buchung: gleich die Trockenprobe dazu — der Mensch sieht, was ein Klick täte.
        if (istBankEingang(j.umsatz)) {
          ruf<{ zeile: NachholZeile }>(`/buchhaltung/nachholen/${encodeURIComponent(uid)}/trocken`, { body: {} })
            .then((p) => setProbe({ zeile: p.zeile, fehler: null }))
            .catch((e) => setProbe({ zeile: null, fehler: e.message }));
        }
      }).catch((e) => setFehler(e.message));
  }, [uid]);
  const u = daten?.umsatz;
  const z = probe?.zeile ?? null;
  const buchen = async () => {
    if (!z) return;
    setLaeuft(true);
    try {
      const r = await eingangBuchen(z);
      setGebucht(`Gebucht — ${r.grund}${r.aufgabe ? ` · ${r.aufgabe}` : ""}.`);
      setFrage(false); setProbe(null);
      onGebucht?.();
    } catch (e: any) { setFehler(e.message); setFrage(false); } finally { setLaeuft(false); }
  };
  return (
    <Schublade offen={!!uid} onZu={onZu} titel={u ? ART_TEXT[u.art] : "Umsatz"}>
      {fehler ? <Meldung art="fehler">{fehler}</Meldung> : !u ? <Laden zeilen={6} /> : (
        <div className="bk-detail">
          <div className="bk-detail-betrag">
            <span className={u.cents < 0 ? "bk-minus" : "bk-plus"}>{geldVz(u.cents)}</span>
            <small>{tag(u.tag)} · {u.konto === "wise" ? "Altkonto Wise" : "Geschäftskonto"}</small>
          </div>
          <dl className="bk-dl">
            <dt>{u.cents < 0 ? "Empfänger" : "Absender"}</dt><dd>{u.gegenpartei}</dd>
            {u.kunde ? <><dt>Zugeordneter Kunde</dt><dd>{u.kunde}</dd></> : null}
            <dt>Verwendungszweck</dt><dd>{u.zweck || "—"}</dd>
            {u.referenz ? <><dt>Referenz</dt><dd className="bk-mono">{u.referenz}</dd></> : null}
            <dt>Herkunft</dt><dd>{HERKUNFT[u.art]}{u.erfasstVon ? ` · erfasst von ${u.erfasstVon.split("@")[0]}` : ""}</dd>
            <dt>Beleg</dt><dd className="bk-mono">{u.beleg || "—"}</dd>
            <dt>Stand</dt><dd>{u.storniert ? "Storniert" : u.schwebend ? "Unterwegs — noch nicht gutgeschrieben" : u.art === "offen" ? "Eingegangen, keiner Bestellung zugeordnet" : "Gebucht"}</dd>
            {u.saldoNach != null ? <><dt>Saldo danach</dt><dd>{geld(u.saldoNach)} <span className="bk-leise">laut Buch</span></dd></> : null}
            {u.notiz ? <><dt>Vermerk</dt><dd className="bk-leise">{u.notiz}</dd></> : null}
          </dl>
          {daten?.auftrag ? (
            <div className="bk-detail-block">
              <div className="bk-block-titel">Zahlungsauftrag {daten.auftrag.nummer}</div>
              <Kopierfeld l="IBAN" w={daten.auftrag.iban.replace(/(.{4})/g, "$1 ").trim()} />
              {daten.auftrag.bankReferenz ? <Kopierfeld l="Bankreferenz" w={daten.auftrag.bankReferenz} /> : null}
            </div>
          ) : null}
          {gebucht ? <Meldung art="gut">{gebucht}</Meldung> : null}
          {istBankEingang(u) && !gebucht ? (
            <div className="bk-detail-block">
              <div className="bk-block-titel">Trockenprobe — was ein Klick buchen würde</div>
              {!probe ? <Laden zeilen={3} /> : probe.fehler ? <Meldung art="fehler">{probe.fehler}</Meldung> : z ? (
                <>
                  <Trockenprobe z={z} />
                  {z.buchen ? (
                    ich?.rolle === "inhaber"
                      ? <div className="bk-knopfreihe"><Knopf art="primaer" zeichen="haken" onClick={() => setFrage(true)} disabled={laeuft}>Jetzt buchen</Knopf></div>
                      : <p className="bk-leise">Buchbar — buchen kann nur der Inhaber.</p>
                  ) : (
                    <>
                      {/* E-277: Vorschlag und Knöpfe auch hier — derselbe Weg wie im Kasten „Eingänge ohne Buchung“. */}
                      {z.vorschlag ? <VorschlagKasten v={z.vorschlag} /> : null}
                      <p className="bk-leise">Ohne Ziel: {z.unklar ?? z.ergebnis}.</p>
                      <HandfallKnoepfe z={z} inhaber={ich?.rolle === "inhaber"} gesperrt={laeuft} onWahl={setHandfall} />
                    </>
                  )}
                </>
              ) : null}
            </div>
          ) : null}
          <BuchenDialog z={z} offen={frage} laeuft={laeuft} onZu={() => setFrage(false)} onBuchen={() => void buchen()} />
          <HandfallDialog auftrag={handfall} onZu={() => setHandfall(null)} onFertig={(m) => { setHandfall(null); setGebucht(m); setProbe(null); onGebucht?.(); }} />
          <div className="bk-knopfreihe">
            {u.auftragId ? <KnopfLink href={`/api/fiaon/buchhaltung/auftrag/${u.auftragId}/bestaetigung.pdf`} zeichen="pdf">Zahlungsbestätigung</KnopfLink> : null}
            {u.auszahlungId ? <KnopfLink href={`/api/fiaon/buchhaltung/auszahlung/${u.auszahlungId}/beleg.pdf`} zeichen="pdf">Auszahlungsbeleg</KnopfLink> : null}
            {u.abrechnungId ? <KnopfLink href={`/api/fiaon/buchhaltung/abrechnung/${u.abrechnungId}.pdf`} zeichen="dokument">Abrechnung</KnopfLink> : null}
            {u.art === "offen" ? <KnopfLink href="/chef/zahlungen" zeichen="rechts" neu={false}>Zur Zahlungszentrale</KnopfLink> : null}
          </div>
        </div>
      )}
    </Schublade>
  );
}

// ── Die Seite ───────────────────────────────────────────────────────────────
type Zeitraum = "monat" | "vormonat" | "90" | "alles" | "frei";

function zeitraumGrenzen(z: Zeitraum, von: string, bis: string): { von: string | null; bis: string | null } {
  const h = heute();
  const [j, m] = h.split("-").map(Number);
  if (z === "monat") return { von: `${h.slice(0, 7)}-01`, bis: null };
  if (z === "vormonat") {
    const vj = m === 1 ? j - 1 : j, vm = m === 1 ? 12 : m - 1;
    const letzter = new Date(Date.UTC(vj, vm, 0)).getUTCDate();
    const p = `${vj}-${String(vm).padStart(2, "0")}`;
    return { von: `${p}-01`, bis: `${p}-${letzter}` };
  }
  if (z === "90") return { von: new Date(Date.now() - 90 * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }), bis: null };
  if (z === "frei") return { von: von || null, bis: bis || null };
  return { von: null, bis: null };
}

export default function Umsaetze({ vorfilter, ich, nachholen, onGebucht }: {
  vorfilter?: { arten?: UmsatzArt[]; konto?: string };
  ich?: Ich;
  nachholen?: { anzahl: number; cents: number; gesamtAnzahl?: number };
  onGebucht?: () => void;
}) {
  const [konto, setKonto] = useState<string>(vorfilter?.konto ?? "alle");
  const [richtung, setRichtung] = useState<"alle" | "ein" | "aus">("alle");
  const [art, setArt] = useState<string>(vorfilter?.arten?.join(",") ?? "");
  const [zr, setZr] = useState<Zeitraum>("alles");
  const [von, setVon] = useState(""); const [bis, setBis] = useState("");
  const [q, setQ] = useState("");
  const suche = useEntprellt(q, 250);
  const [zeilen, setZeilen] = useState<Umsatz[] | null>(null);
  const [summe, setSumme] = useState<{ gesamt: number; einCents: number; ausCents: number } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [mehrLaeuft, setMehrLaeuft] = useState(false);
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);

  const parameter = useMemo(() => {
    const g = zeitraumGrenzen(zr, von, bis);
    const p = new URLSearchParams();
    if (konto !== "alle") p.set("konto", konto);
    if (richtung !== "alle") p.set("richtung", richtung);
    if (art) p.set("arten", art);
    if (g.von) p.set("von", g.von);
    if (g.bis) p.set("bis", g.bis);
    if (suche.trim()) p.set("q", suche.trim());
    return p;
  }, [konto, richtung, art, zr, von, bis, suche]);

  const laden = useCallback(async (offset = 0) => {
    const p = new URLSearchParams(parameter);
    p.set("limit", "80"); p.set("offset", String(offset));
    const j = await ruf<{ zeilen: Umsatz[]; gesamt: number; einCents: number; ausCents: number }>(`/buchhaltung/umsaetze?${p}`);
    return j;
  }, [parameter]);

  useEffect(() => {
    let weg = false;
    setZeilen(null); setFehler(null);
    laden(0).then((j) => { if (!weg) { setZeilen(j.zeilen); setSumme({ gesamt: j.gesamt, einCents: j.einCents, ausCents: j.ausCents }); } })
      .catch((e) => { if (!weg) setFehler(e.message); });
    return () => { weg = true; };
  }, [laden]);

  const mehr = async () => {
    if (!zeilen) return;
    setMehrLaeuft(true);
    try { const j = await laden(zeilen.length); setZeilen([...zeilen, ...j.zeilen]); }
    catch (e: any) { setFehler(e.message); } finally { setMehrLaeuft(false); }
  };
  const [neuLaden, setNeuLaden] = useState(0);
  useEffect(() => {
    if (!neuLaden) return;
    laden(0).then((j) => { setZeilen(j.zeilen); setSumme({ gesamt: j.gesamt, einCents: j.einCents, ausCents: j.ausCents }); }).catch((e) => setFehler(e.message));
  }, [neuLaden, laden]);
  const nachBuchung = () => { setNeuLaden((n) => n + 1); onGebucht?.(); };

  return (
    <div className="bk-seite">
      {ich && nachholen ? <NachholPanel ich={ich} anzahl={nachholen.anzahl} cents={nachholen.cents} gesamtAnzahl={nachholen.gesamtAnzahl ?? 0} onGebucht={nachBuchung} /> : null}
      <div className="bk-filter" role="search">
        <div className="bk-such">
          <Zeichen n="suche" g={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, Referenz, Zweck oder Betrag" aria-label="Umsätze durchsuchen" />
          {q ? <button type="button" aria-label="Suche leeren" onClick={() => setQ("")}><Zeichen n="kreuz" g={14} /></button> : null}
        </div>
        <div className="bk-segment" role="tablist" aria-label="Konto">
          {[["alle", "Alle Konten"], ["geschaeft", "Geschäftskonto"], ["wise", "Altkonto Wise"]].map(([w, t]) => (
            <button key={w} type="button" role="tab" aria-selected={konto === w} className={konto === w ? "aktiv" : ""} onClick={() => setKonto(w)}>{t}</button>
          ))}
        </div>
        <div className="bk-segment" role="tablist" aria-label="Richtung">
          {[["alle", "Alle"], ["ein", "Eingänge"], ["aus", "Ausgänge"]].map(([w, t]) => (
            <button key={w} type="button" role="tab" aria-selected={richtung === w} className={richtung === w ? "aktiv" : ""} onClick={() => setRichtung(w as any)}>{t}</button>
          ))}
        </div>
        <select className="bk-auswahl" value={art} onChange={(e) => setArt(e.target.value)} aria-label="Art">
          <option value="">Alle Arten</option>
          <option value="kunde">Kundenzahlungen</option>
          <option value="offen">Nicht zugeordnet</option>
          <option value="auszahlung">Auszahlungen Mitarbeiter</option>
          <option value="ueberweisung">Überweisungen</option>
          <option value="einlage,eingang,ausgabe,korrektur">Von Hand erfasst</option>
          <option value="sonstiges">Sonstige Eingänge</option>
        </select>
        <select className="bk-auswahl" value={zr} onChange={(e) => setZr(e.target.value as Zeitraum)} aria-label="Zeitraum">
          <option value="alles">Gesamter Zeitraum</option>
          <option value="monat">Dieser Monat</option>
          <option value="vormonat">Letzter Monat</option>
          <option value="90">Letzte 90 Tage</option>
          <option value="frei">Eigener Zeitraum …</option>
        </select>
        {zr === "frei" ? (
          <span className="bk-zeitraum">
            <input type="date" value={von} onChange={(e) => setVon(e.target.value)} aria-label="Von" />
            <span>–</span>
            <input type="date" value={bis} onChange={(e) => setBis(e.target.value)} aria-label="Bis" />
          </span>
        ) : null}
      </div>

      <div className="bk-summenzeile">
        <span>{summe ? `${summe.gesamt} Umsätze` : " "}</span>
        {summe ? <span>Eingänge <strong className="bk-plus">{geld(summe.einCents)}</strong></span> : null}
        {summe ? <span>Ausgänge <strong>{geld(summe.ausCents)}</strong></span> : null}
        <span className="bk-summen-rechts">
          <KnopfLink href={`/api/fiaon/buchhaltung/umsaetze.csv?${parameter}`} zeichen="herunter" klein neu={false}>CSV für die Steuerberatung</KnopfLink>
        </span>
      </div>

      {fehler ? <Meldung art="fehler">{fehler}</Meldung> : null}
      {!zeilen ? <Laden zeilen={10} /> : zeilen.length === 0 ? (
        <Leer titel="Keine Umsätze" text="In diesem Filter gibt es nichts. Zeitraum oder Suche ändern." />
      ) : (
        <>
          <UmsatzListe zeilen={zeilen} onWahl={(u) => setGewaehlt(u.uid)} kontoZeigen={konto === "alle"} />
          {summe && zeilen.length < summe.gesamt ? (
            <div className="bk-mehr">
              <Knopf onClick={() => void mehr()} disabled={mehrLaeuft}>{mehrLaeuft ? "Lade …" : `Weitere laden (${summe.gesamt - zeilen.length})`}</Knopf>
            </div>
          ) : null}
        </>
      )}
      <UmsatzDetail uid={gewaehlt} onZu={() => setGewaehlt(null)} ich={ich} onGebucht={nachBuchung} />
      <p className="bk-fussnote">Zuletzt geladen {zeit(new Date().toISOString())} · Eingänge aus dem Abruf der Bank, Auszahlungen und Buchungen aus dem Zahlungsverkehr der FIAON LTD.</p>
    </div>
  );
}
