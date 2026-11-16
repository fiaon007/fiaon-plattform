// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — EINMAL-REPARATUR DER FIRMEN-KARTE #34: DIE VORPRÜFUNG (E-487 Nachtrag, 16.11.2026)
//
// ── DER FALL ──────────────────────────────────────────────────────────────────
// Vor E-487 (09.11.) legte der Eingang drei verschiedene Menschen über das Firmenfeld „Selbständig“ auf EINE Karte (#34):
// die Global-Anfragen #61 (Kartenkopf, Person 13850), #68 und #77. Folgen: „nicht erreicht“ auf #34 traf die Person von #61,
// der Stand von #61 („hat schon ein Gespräch – kein Anruf-Auftrag“) galt für alle, Daniels Aufträge zu #68/#77 öffneten #34.
// Personen wurden NICHT zusammengelegt (#68 hat keine Person; #77 hat seine eigene, 13859, mit eigener Karte #52).
//
// ── WAS DIE REPARATUR TUT (server/lib/fiaon-firmenkarte-reparatur.ts) ────────────────────────────────────────────
// Genau die beiden fremden Gruppen dieser Karte trennen — mit dem geprüften Schreibweg des Laufs firmen_trennen
// (gruppeTrennen: je Gruppe EINE Transaktion, Protokoll mit Rückweg in fiaon_firmen_trennung, Zeile „Getrennt: …“ auf
// beiden Karten, nichts wird gelöscht). #68 → eine eigene, neue Karte; #77 → seine vorhandene Karte #52. #61 bleibt auf #34.
// Unabhängig vom Schalter „firmen_trennen“ (bleibt trocken) — nur „aus“ hält auch sie an.
//
// ── DIE VORPRÜFUNG (rein, hier) ───────────────────────────────────────────────
// Sie läuft NUR, wenn der Zustand noch genau der erwartete ist: Kopf = Person 13850 mit Mail oder Nummer von #61, die drei
// Anfragen echt und verschieden, der Planer sieht auf #34 nur #61 als eigen und genau die Gruppen [#68] und [#77], das Ziel
// von #77 ist #52 (Person 13859, Mail oder Nummer von #77), #68 hat keine Karte. Eine Gruppe, die schon im Protokoll steht,
// gilt als erledigt (ein abgebrochener Durchgang setzt fort). Jede Abweichung: nichts tun, Marke mit Grund, Meldung.
//
// Repo öffentlich: hier nur Kennungen, keine Namen, Mails oder Nummern.
// ═══════════════════════════════════════════════════════════════════════════
import { trennKandidat, trennSchluessel, zusammengehoerig, mailForm, nummer9, type TrennModus, type TrennKontakt } from "./fiaon-firmen-trennen";

export interface ReparaturGruppeSoll {
  anfrageIds: readonly number[];
  /** Die vorhandene Karte dieser Person — null = eine neue Karte. */
  ziel: number | null;
  /** Die Person der vorhandenen Ziel-Karte. */
  zielPerson?: number | null;
}

export interface ReparaturSoll {
  /** Marke in fiaon_settings — steht sie, läuft nichts mehr. */
  marke: string;
  quelleId: number;
  eigeneAnfrage: number;
  eigenePerson: number;
  gruppen: readonly ReparaturGruppeSoll[];
}

/** Der erwartete Zustand in der Produktion (gemessen 16.11.2026, Trockenprobe des Laufs firmen_trennen: Plan [#68 → neu, #77 → #52]). */
export const REPARATUR_KARTE_34: ReparaturSoll = {
  marke: "firmen_trennen_reparatur_34",
  quelleId: 34,
  eigeneAnfrage: 61,
  eigenePerson: 13850,
  gruppen: [
    { anfrageIds: [68], ziel: null },
    { anfrageIds: [77], ziel: 52, zielPerson: 13859 },
  ],
};

export interface ReparaturKarte {
  id: number; firma: string | null; ansprechpartner: string | null; person_id: number | null; email: string | null; telefon: string | null;
}
export interface ReparaturAnfrage {
  id: number; art: string | null; ist_test: boolean | null; email: string | null; telefon: string | null; name: string | null; person_id?: number | null;
}

export interface ReparaturLage {
  /** Wert der Marke (null = nie gelaufen). */
  marke: string | null;
  modus: TrennModus;
  quelle: ReparaturKarte | null;
  anfragen: readonly ReparaturAnfrage[];
  /** Was der Planer (kartenPlanen) für die Quelle sieht, mit dem Ziel je Gruppe (zielSuchen) — null = die Karte ist kein Kandidat. */
  plan: { eigene: readonly number[]; gruppen: readonly { schluessel: string; anfrageIds: readonly number[]; ziel: number | null }[] } | null;
  /** Die erwarteten vorhandenen Ziel-Karten (so, wie sie heute aussehen). */
  zielKarten: readonly ReparaturKarte[];
  /** Protokollzeilen der erwarteten Gruppen (fiaon_firmen_trennung), falls schon getrennt. */
  protokoll: readonly { schluessel: string; ziel_firma_id: number | null }[];
}

export type ReparaturUrteil =
  | { tun: "trennen"; schluessel: string[] }
  | { tun: "nichts"; status: "schon_gelaufen" | "aus" | "erledigt" | "abweichung"; grund: string; markeSetzen: boolean };

const sortiert = (ids: readonly number[]): number[] => Array.from(ids).map(Number).sort((x, y) => x - y);
const gleicheIds = (a: readonly number[], b: readonly number[]): boolean => JSON.stringify(sortiert(a)) === JSON.stringify(sortiert(b));
const kontaktVon = (a: ReparaturAnfrage): TrennKontakt => ({ personIds: [a.person_id ?? null], email: a.email, telefon: a.telefon, name: a.name });

/** Mail ODER Nummer (letzte 9 Ziffern) gleich — beide nicht leer. Rein. */
function gleicheAdresse(k: { email: string | null; telefon: string | null }, a: { email: string | null; telefon: string | null }): boolean {
  const m = mailForm(k.email);
  const n = nummer9(k.telefon);
  return (!!m && m === mailForm(a.email)) || (!!n && n === nummer9(a.telefon));
}

/** Die Schlüssel der erwarteten Gruppen (wie der Lauf sie ins Protokoll schreibt). Rein. */
export function reparaturSchluessel(soll: ReparaturSoll): string[] {
  return soll.gruppen.map((g) => trennSchluessel(soll.quelleId, g.anfrageIds));
}

/**
 * Darf die Einmal-Reparatur jetzt trennen — und welche Gruppen? Jede Abweichung vom erwarteten Zustand = nichts tun (mit Grund,
 * Marke setzen: einmal geprüft, einmal gemeldet). Rein — Prüfstand scripts/pruef-firmenkarte-platzhalter.ts.
 */
export function reparaturPruefen(l: ReparaturLage, soll: ReparaturSoll = REPARATUR_KARTE_34): ReparaturUrteil {
  const nichts = (status: "erledigt" | "abweichung", grund: string): ReparaturUrteil => ({ tun: "nichts", status, grund, markeSetzen: true });
  if (String(l.marke ?? "").trim()) return { tun: "nichts", status: "schon_gelaufen", grund: "Marke steht — die Reparatur ist schon gelaufen", markeSetzen: false };
  if (l.modus === "aus") return { tun: "nichts", status: "aus", grund: "Schalter firmen_trennen = aus", markeSetzen: false };

  const q = l.quelle;
  if (!q) return nichts("abweichung", `Karte #${soll.quelleId} fehlt`);

  // Die drei Anfragen: da, Global, kein Test.
  const fremdIds = soll.gruppen.flatMap((g) => Array.from(g.anfrageIds));
  const anfrage = (id: number) => l.anfragen.find((a) => Number(a.id) === id) ?? null;
  for (const id of [soll.eigeneAnfrage, ...fremdIds]) {
    const a = anfrage(id);
    if (!a) return nichts("abweichung", `Anfrage #${id} fehlt`);
    if (String(a.art ?? "") !== "global" || a.ist_test) return nichts("abweichung", `Anfrage #${id} ist keine echte Global-Anfrage (mehr)`);
  }
  const eigen = anfrage(soll.eigeneAnfrage)!;

  // Der Kopf gehört noch der Person der eigenen Anfrage.
  if (Number(q.person_id) !== soll.eigenePerson) return nichts("abweichung", `Karte #${soll.quelleId} trägt nicht mehr Person ${soll.eigenePerson}`);
  if (!gleicheAdresse(q, eigen)) return nichts("abweichung", `Kopf von Karte #${soll.quelleId} passt weder per Mail noch per Nummer zu Anfrage #${soll.eigeneAnfrage}`);

  // Die fremden Anfragen sind wirklich andere Menschen — untereinander und gegenüber dem Kopf.
  const kopf: TrennKontakt = { personIds: [q.person_id], email: q.email, telefon: q.telefon, name: q.ansprechpartner };
  const fremde = fremdIds.map((id) => anfrage(id)!);
  for (const a of fremde) {
    if (zusammengehoerig(kontaktVon(a), kopf) || zusammengehoerig(kontaktVon(a), kontaktVon(eigen))) {
      return nichts("abweichung", `Anfrage #${a.id} gehört (inzwischen) zur Person des Kartenkopfs — nichts zu trennen`);
    }
  }
  for (let i = 0; i < fremde.length; i++) for (let j = i + 1; j < fremde.length; j++) {
    if (zusammengehoerig(kontaktVon(fremde[i]), kontaktVon(fremde[j]))) return nichts("abweichung", `Anfragen #${fremde[i].id} und #${fremde[j].id} sind dieselbe Person`);
  }

  // Protokoll: welche Gruppe ist schon getrennt (und wohin)?
  const schluessel = reparaturSchluessel(soll);
  const prot = new Map(l.protokoll.map((p) => [String(p.schluessel), p.ziel_firma_id == null ? null : Number(p.ziel_firma_id)]));
  for (let i = 0; i < soll.gruppen.length; i++) {
    const g = soll.gruppen[i];
    if (!prot.has(schluessel[i]) || g.ziel == null) continue;
    if (prot.get(schluessel[i]) !== g.ziel) return nichts("abweichung", `Gruppe ${schluessel[i]} steht im Protokoll mit einem anderen Ziel als #${g.ziel}`);
  }

  // Der Plan: auf der Karte liegt nur noch die eigene Anfrage und genau die erwarteten Gruppen.
  if (!l.plan) {
    if (!trennKandidat(q.firma, q.ansprechpartner) && schluessel.every((s) => prot.has(s))) return nichts("erledigt", "alle Gruppen schon getrennt (Protokoll)");
    return nichts("abweichung", `Karte #${soll.quelleId} ist kein Trenn-Kandidat (mehr) — Firmenfeld verbindet`);
  }
  if (!gleicheIds(l.plan.eigene, [soll.eigeneAnfrage])) {
    return nichts("abweichung", `auf Karte #${soll.quelleId} liegen als eigen [${sortiert(l.plan.eigene).map((x) => `#${x}`).join(", ")}] statt nur #${soll.eigeneAnfrage}`);
  }
  const offen: string[] = [];
  for (const pg of l.plan.gruppen) {
    const i = soll.gruppen.findIndex((g) => gleicheIds(g.anfrageIds, pg.anfrageIds));
    if (i < 0) return nichts("abweichung", `unerwartete fremde Gruppe auf Karte #${soll.quelleId}: [${sortiert(pg.anfrageIds).map((x) => `#${x}`).join(", ")}]`);
    if (pg.schluessel !== schluessel[i]) return nichts("abweichung", `Schlüssel ${pg.schluessel} statt ${schluessel[i]}`);
  }
  for (let i = 0; i < soll.gruppen.length; i++) {
    const g = soll.gruppen[i];
    const pg = l.plan.gruppen.find((x) => gleicheIds(x.anfrageIds, g.anfrageIds));
    if (!pg) {
      if (prot.has(schluessel[i])) continue; // schon getrennt
      return nichts("abweichung", `Gruppe ${schluessel[i]} liegt weder auf der Karte noch im Protokoll`);
    }
    if (g.ziel == null) {
      if (pg.ziel != null) return nichts("abweichung", `für ${schluessel[i]} gibt es schon eine Karte (#${pg.ziel}) — erwartet: neue Karte`);
    } else {
      if (pg.ziel !== g.ziel) return nichts("abweichung", `Ziel für ${schluessel[i]} wäre ${pg.ziel == null ? "eine neue Karte" : `#${pg.ziel}`} statt #${g.ziel}`);
      const zk = l.zielKarten.find((k) => Number(k.id) === g.ziel);
      if (!zk) return nichts("abweichung", `Ziel-Karte #${g.ziel} fehlt`);
      if (g.zielPerson != null && Number(zk.person_id) !== g.zielPerson) return nichts("abweichung", `Ziel-Karte #${g.ziel} trägt nicht Person ${g.zielPerson}`);
      if (!g.anfrageIds.some((id) => gleicheAdresse(zk, anfrage(id)!))) return nichts("abweichung", `Ziel-Karte #${g.ziel} passt weder per Mail noch per Nummer zur Gruppe ${schluessel[i]}`);
    }
    offen.push(schluessel[i]);
  }
  if (!offen.length) return nichts("erledigt", "alle Gruppen schon getrennt (Protokoll)");
  return { tun: "trennen", schluessel: offen };
}
