// ═══════════════════════════════════════════════════════════════════════════
// MARAS MAIL-ENTWÜRFE ALS ENTSCHEIDUNGSKARTEN (E-371, 15.10.2026)
//
// Justin: „Mara soll ALLES selbst machen können, nichts weitergeben an die
// Mitarbeiter … wenn sie eine Entscheidung braucht, dann soll ich es mit 1 Klick
// entscheiden können.“ Seit E-369 sendet Mara selbst, wo sie darf. Was übrig
// bleibt (Widerruf, Anwalt/Behörde, FIAON Global, eine Antwort, die ihre eigene
// Prüfung nicht besteht), war bis heute eine Aufgabe beim Betreuer. Jetzt ist es
// eine Karte in Mara › Entscheidungen (/chef/s/mara?reiter=entscheidungen):
//   · „Maras Antwort senden“ — derselbe Weg wie die Zentrale (entwurfSenden: frische
//     Prüfung, „veraltet“ → nicht gesendet);
//   · „Neu schreiben lassen“ — mit heutigem Stand (entwuerfeNeuSchreiben, E-119);
//   · „Selbst antworten“ — öffnet genau diese Mail im Postfach;
//   · „Nichts senden“ — ablegen, ohne zu antworten.
// Nur der ausdrückliche Rückrufwunsch bleibt beim Betreuer (er soll ja anrufen).
// Die Entwürfe von vor E-369 (bis 15.10. 11:07) stehen als EINE Sammelkarte da:
// „Alle neu schreiben lassen“ — Mara sendet, was sie jetzt selbst darf.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import {
  entscheidungAnlegen, entscheidungArt, werkzeugRegistrieren, detektorRegistrieren, ausfuehrErgebnis,
  type EntscheidungNeu, type EntscheidungBeleg,
} from "./fiaon-mara-entscheidungen";
import { GRUND_KURZ } from "@shared/fiaon-entwurf-frist";
import {
  AMPEL_GELB_KOPF, gelbKarteGrund, istAmpelGelbEntwurf, istAmpelGelbKarte, istAmpelRotEntwurf, mailAmpelGelbKarteGrund,
} from "@shared/fiaon-mara-ampel";

/** E-369 ging an diesem Zeitpunkt live — ältere Entwürfe kamen aus der alten Übergabe-Regel (Sammelkarte). */
export const KARTEN_AB = new Date("2026-10-15T09:07:21Z");
/** E-371: Ältere Kundenmails schreibt Mara nicht mehr neu — nach Wochen verwirrt eine Antwort mehr, als sie hilft. */
export const NEU_SCHREIBEN_TAGE = 30;
const nichtVor = () => new Date(Date.now() - NEU_SCHREIBEN_TAGE * 86_400_000);
/** Diesen Grund behält der Betreuer (er ruft an) — keine Karte. Wortgleich mit UEBERGABE_GRUND.ansprechpartner. */
const BETREUER_GRUND = "Kunde möchte mit seinem Ansprechpartner sprechen";

entscheidungArt("postmeister_entwurf", "Kundenmail", 75);
entscheidungArt("postmeister_altentwuerfe", "Alte Entwürfe", 65);

const kurz = (t: unknown, n: number) => {
  const s = String(t ?? "").replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};
const json = <T>(v: unknown, vorgabe: T): T => {
  if (v == null) return vorgabe;
  if (typeof v === "string") { try { return JSON.parse(v) as T; } catch { return vorgabe; } }
  return v as T;
};
const tag = (v: unknown) => (v ? new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit" }).format(new Date(v as any)) : "");
const epoche = (v: unknown) => Math.floor(new Date((v ?? 0) as any).getTime() / 1000);

type Fall = "widerruf" | "rechtlich" | "global" | "unsicher" | "ampel" | "ampel_gelb";
/** Rein: Welche Art Entscheidung braucht dieser Entwurf? Aus dem Übergabegrund der Zeile. */
export function entwurfFall(begruendung: string | null | undefined): Fall {
  const g = String(begruendung ?? "");
  // E-406 B3: „Mails beantworten“ steht auf Rot — die Antwort wäre sauber, nur die Ampel hält sie an.
  if (istAmpelRotEntwurf(g)) return "ampel";
  if (/widerruf/i.test(g)) return "widerruf";
  if (/rechtlich|anwalt|beh(?:ö|oe)rde/i.test(g)) return "rechtlich";
  if (/global/i.test(g)) return "global";
  // E-406 B3 (Nachbesserung): Gelb, aber die 24-Stunden-Regel ließe den Entwurf liegen — eine normale Karte.
  if (istAmpelGelbKarte(g)) return "ampel_gelb";
  return "unsicher";
}

const TITEL: Record<Fall, string> = {
  widerruf: "Widerruf — Maras Antwort senden?",
  rechtlich: "Anwalt, Behörde oder Recht — Maras Antwort senden?",
  global: "FIAON Global — Kunde schreibt",
  unsicher: "Mara ist unsicher — Antwort ansehen",
  ampel: "Ampel rot — Maras Antwort senden?",
  ampel_gelb: "Ampel gelb — Maras Antwort senden?",
};
const SATZ: Record<Fall, string> = {
  widerruf: "Ob der Widerruf gilt und was mit bereits Gezahltem geschieht, entscheidest du. Maras Antwort sagt nichts zu.",
  rechtlich: "Rechtliches entscheidest du — Maras Antwort ist vorsichtig und sagt nichts zu.",
  global: "Global-Kunden beantwortet Mara nie selbst.",
  unsicher: "Ihre eigene Prüfung hat die Antwort angehalten.",
  ampel: "Mails beantwortet Mara gerade nur mit deinem Klick (Ampel rot im Steuerpult).",
  ampel_gelb: "Die Ampel steht auf Gelb — von selbst ginge diese Antwort aber nie raus, nur mit deinem Klick.",
};

/** Rein: die Karte zu einer Postfach-Zeile (fiaon_postmeister + Name). */
export function karteAusZeile(z: any): EntscheidungNeu {
  const id = Number(z.id);
  const grund = String(z.begruendung ?? "").replace(/^Übergabe an den Betreuer:\s*/, "").trim();
  const fall = entwurfFall(grund);
  const pruefung = json<{ fehlend?: string[] }>(z.pruefung, {});
  const maengel = Array.isArray(pruefung.fehlend) ? pruefung.fehlend.filter(Boolean).map(String) : [];
  const vorsicht = fall === "widerruf" || fall === "rechtlich";
  const belege: EntscheidungBeleg[] = [
    ...(z.empfangen_am || z.created_at ? [{ text: `Mail vom ${tag(z.empfangen_am ?? z.created_at)}` }] : []),
    ...(z.kundenlage ? [{ text: String(z.kundenlage).replace(/_/g, " ") }] : []),
    ...maengel.slice(0, 2).map((m) => ({ text: kurz(m, 90), ton: "warn" as const })),
    ...(z.text ? [{ art: "zitat" as const, name: "Kunde", text: kurz(z.text, 260) }] : []),
    ...(z.antwort ? [{ art: "zitat" as const, name: "Maras Antwort", text: kurz(z.antwort, 520) }] : []),
  ];
  return {
    schluessel: `postmeister:${id}:${epoche(z.entwurf_geprueft_am ?? z.created_at)}`,
    art: "postmeister_entwurf",
    personId: z.person_id != null ? Number(z.person_id) : null,
    ref: z.ref ?? null,
    titel: TITEL[fall],
    text: `„${kurz(z.betreff || "(ohne Betreff)", 90)}“ — ${SATZ[fall]}${grund && fall === "unsicher" ? ` (${kurz(grund, 140)})` : ""}${fall === "ampel_gelb" && gelbKarteGrund(grund) ? ` (${kurz(gelbKarteGrund(grund), 140)})` : ""}`,
    empfehlung: maengel.length ? "neu" : "senden",
    optionen: [
      { key: "senden", label: "Maras Antwort senden", werkzeug: "postmeister_entwurf_senden", args: { id }, ton: vorsicht ? "vorsicht" : "gut",
        titel: "Sendet Maras Antwort jetzt — vorher prüft die Plattform, ob sie noch stimmt." },
      { key: "neu", label: "Neu schreiben lassen", werkzeug: "postmeister_neu_schreiben", args: { id }, ton: "neutral",
        titel: "Mara schreibt mit dem heutigen Stand neu und sendet, wenn sie darf — sonst kommt die Mail wieder als Karte." },
      { key: "selbst", label: "Selbst antworten", werkzeug: "link", link: `/chef/s/postmeister?eintrag=${id}`, ton: "neutral",
        titel: "Öffnet genau diese Mail im Postfach." },
      { key: "nichts", label: "Nichts senden", werkzeug: "postmeister_verwerfen", args: { id }, ton: "neutral",
        titel: "Legt die Mail ab, ohne zu antworten." },
    ],
    belege,
  };
}

const ZEILE_SQL = `
  SELECT pm.id, pm.person_id, pm.ref, pm.betreff, pm.text, pm.antwort, pm.begruendung, pm.kundenlage, pm.pruefung,
         pm.empfangen_am, pm.created_at, pm.entwurf_geprueft_am
    FROM fiaon_postmeister pm
   WHERE pm.aktion = 'entwurf' AND pm.gesendet_am IS NULL`;

/** Die gelben Entwürfe — mit dem Merker der 24-Stunden-Regel (frist_ab, frist_neu_am) und den Flags fürs Urteil. */
const GELB_SQL = `
  SELECT pm.id, pm.person_id, pm.ref, pm.betreff, pm.text, pm.antwort, pm.begruendung, pm.kundenlage, pm.pruefung,
         pm.empfangen_am, pm.created_at, pm.entwurf_geprueft_am, pm.frist_ab, pm.frist_neu_am, pm.flags
    FROM fiaon_postmeister pm
   WHERE pm.aktion = 'entwurf' AND pm.gesendet_am IS NULL AND COALESCE(pm.begruendung, '') LIKE $1`;

/**
 * E-406 B3 (Nachbesserung, Prüfer-Fund): Gelbe Entwürfe, die die 24-Stunden-Regel liegen ließe (gelbLiegenLesen: schon
 * einmal neu geschrieben, inzwischen gesperrt, Kundenmail inzwischen zu alt …), sind DOCH eine Karte — mit dem Grund.
 * Die übrigen warten in „Mara heute“, bis die Regel sie sendet.
 */
async function gelbeAlsKarten(zeilen: any[]): Promise<EntscheidungNeu[]> {
  if (!zeilen.length) return [];
  const { gelbLiegenLesen, gelbZeileAus } = await import("./fiaon-postmeister-frist");
  const liegen = await gelbLiegenLesen(zeilen.map(gelbZeileAus));
  return zeilen
    .filter((z) => !!liegen.get(Number(z.id)))
    .map((z) => karteAusZeile({ ...z, begruendung: mailAmpelGelbKarteGrund(String(liegen.get(Number(z.id)))) }));
}

/**
 * Detektor: eine Karte je wartendem Entwurf seit E-369 (ohne Rückrufwunsch) — erledigt sich, sobald die Mail weg ist.
 * E-406 B3: Ein GELBER Entwurf (Ampel „Mails beantworten“ auf Gelb) ist keine Karte — er steht in „Mara heute“ im
 * Lagezimmer („Nicht senden“) und geht nach 24 Stunden über die 24-Stunden-Regel raus. Nachbesserung: außer die Regel
 * ließe ihn liegen — dann ist er doch eine Karte (gelbeAlsKarten).
 */
async function findeEntwuerfe(lauf: any): Promise<EntscheidungNeu[]> {
  const zeilen = (await lauf.unsafe(
    `${ZEILE_SQL} AND COALESCE(pm.entwurf_geprueft_am, pm.created_at) >= $1
       AND POSITION($2 IN COALESCE(pm.begruendung, '')) = 0
       AND COALESCE(pm.begruendung, '') NOT LIKE $3
     ORDER BY pm.id DESC LIMIT 150`, [KARTEN_AB, BETREUER_GRUND, `${AMPEL_GELB_KOPF}%`])) as any[];
  let gelb: EntscheidungNeu[] = [];
  try {
    const { postmeisterSchema } = await import("./fiaon-postmeister-schema");
    await postmeisterSchema();
    // Derselbe Deckel wie die 24-Stunden-Regel (fristZeilenLaden): Hänger dürfen sich nicht hinter einem kleinen LIMIT verstecken.
    gelb = await gelbeAlsKarten((await lauf.unsafe(`${GELB_SQL} ORDER BY pm.id DESC LIMIT 2000`, [`${AMPEL_GELB_KOPF}%`])) as any[]);
  } catch (e) {
    console.error("[POSTMEISTER] Gelbe Entwürfe als Karte:", String((e as Error)?.message ?? e).slice(0, 200));
  }
  return [...zeilen.map(karteAusZeile), ...gelb];
}

/** Detektor: EINE Sammelkarte für die Entwürfe aus der Zeit vor E-369. */
async function findeAltentwuerfe(lauf: any): Promise<EntscheidungNeu[]> {
  const [z] = (await lauf.unsafe(
    `SELECT COUNT(*)::int AS n, MIN(COALESCE(empfangen_am, created_at)) AS aeltester FROM fiaon_postmeister
      WHERE aktion IN ('entwurf', 'fehler') AND gesendet_am IS NULL AND gmail_id IS NOT NULL AND gmail_id <> ''
        AND COALESCE(entwurf_geprueft_am, created_at) < $1 AND COALESCE(empfangen_am, created_at) >= $2`, [KARTEN_AB, nichtVor()])) as any[];
  const n = Number(z?.n || 0);
  if (!n) return [];
  return [{
    schluessel: "postmeister_altentwuerfe:2026-10-15",
    art: "postmeister_altentwuerfe",
    titel: `${n} alte Kundenmails neu schreiben lassen`,
    text: `${n} Kundenmails der letzten ${NEU_SCHREIBEN_TAGE} Tage liegen noch als Entwurf aus der Zeit vor der neuen Regel (älteste vom ${tag(z.aeltester)}). Mara schreibt sie mit heutigem Stand neu: `
      + "Was sie selbst darf, sendet sie — mit einer kurzen Entschuldigung für die Verspätung. Wer seitdem noch einmal geschrieben hat, bekommt keine zweite Antwort. "
      + `Was eine Entscheidung braucht, kommt einzeln hierher. Dauer ca. ${Math.max(1, Math.ceil(n * 0.4))} Min.`,
    empfehlung: "neu",
    optionen: [
      { key: "neu", label: "Alle neu schreiben lassen", werkzeug: "postmeister_alle_neu", ton: "gut",
        titel: "Startet die Neubearbeitung (wie „Alle Entwürfe neu schreiben“ im Postfach)." },
      { key: "lassen", label: "So lassen", werkzeug: "nichts", ton: "neutral" },
    ],
    belege: [{ text: `${n} Entwürfe` }, ...(z.aeltester ? [{ text: `älteste ${tag(z.aeltester)}`, ton: "warn" as const }] : [])],
  }];
}

detektorRegistrieren({ art: "postmeister_entwurf", finden: findeEntwuerfe, erledigtText: "Hat sich erledigt — die Mail ist beantwortet, neu geschrieben oder abgelegt." });
detektorRegistrieren({ art: "postmeister_altentwuerfe", finden: findeAltentwuerfe, erledigtText: "Hat sich erledigt — keine alten Entwürfe mehr." });

/** Gleich nach dem Entwurf (lauf.ts): die Karte sofort anlegen, nicht erst beim nächsten Sammeln. Wirft nie. */
export async function postmeisterKarteJetzt(id: number): Promise<void> {
  try {
    const [z] = (await sqlPool.unsafe(`${ZEILE_SQL} AND pm.id = $1`, [Number(id)])) as any[];
    if (!z || String(z.begruendung ?? "").includes(BETREUER_GRUND)) return;
    if (istAmpelGelbEntwurf(z.begruendung)) {
      // E-406 B3 (Nachbesserung): Gelb ist nur dann keine Karte, wenn die 24-Stunden-Regel ihn später wirklich sendet.
      const [g] = (await sqlPool.unsafe(`${GELB_SQL} AND pm.id = $2`, [`${AMPEL_GELB_KOPF}%`, Number(id)])) as any[];
      for (const k of await gelbeAlsKarten(g ? [g] : [])) await entscheidungAnlegen(k);
      return;
    }
    await entscheidungAnlegen(karteAusZeile(z));
  } catch (e) {
    console.error("[POSTMEISTER] Entscheidungskarte:", String((e as Error)?.message ?? e).slice(0, 200));
  }
}

/** Steht die Zeile noch als Entwurf? (Sonst hat sich die Karte erledigt.) */
async function nochEntwurf(id: number, auch: string[] = []): Promise<any | null> {
  const [r] = (await sqlPool`SELECT id, aktion, gesendet_am, postfach, antwort_draft_id, person_id, ref FROM fiaon_postmeister WHERE id = ${id}`) as any[];
  if (!r || r.gesendet_am || !["entwurf", ...auch].includes(String(r.aktion))) return null;
  return r;
}

werkzeugRegistrieren("postmeister_entwurf_senden", async (args, k) => {
  const id = Number(args?.id);
  if (!(id > 0)) return ausfuehrErgebnis.fehler("Die Karte nennt keine Mail.");
  if (!(await nochEntwurf(id))) return ausfuehrErgebnis.vonSelbst("Diese Mail ist schon beantwortet oder abgelegt.");
  const { entwurfSenden } = await import("../routes/fiaon-postmeister-zentrale");
  const e = await entwurfSenden(id, null, {}, k.von);
  return e.ok
    ? ausfuehrErgebnis.erledigt(`Gesendet.${e.erledigt?.length ? ` ${e.erledigt.join(" · ")}` : ""}`)
    : ausfuehrErgebnis.fehler(`Nicht gesendet: ${e.grund}`);
});

werkzeugRegistrieren("postmeister_neu_schreiben", async (args) => {
  const id = Number(args?.id);
  if (!(id > 0)) return ausfuehrErgebnis.fehler("Die Karte nennt keine Mail.");
  if (!(await nochEntwurf(id, ["fehler"]))) return ausfuehrErgebnis.vonSelbst("Diese Mail ist schon beantwortet oder abgelegt.");
  const { entwuerfeNeuSchreiben } = await import("../routes/fiaon-postmeister-zentrale");
  const e = await entwuerfeNeuSchreiben({ ids: [id], parallel: 1 });
  if (!e.ok) return ausfuehrErgebnis.fehler(e.error);
  return ausfuehrErgebnis.erledigt("Mara schreibt neu — sie sendet selbst, wenn sie darf; sonst kommt die Mail als neue Karte.");
});

/**
 * „Nichts senden“: den wartenden Entwurf ablegen, den Gmail-Entwurf löschen, die Übergabe schließen. Derselbe Weg für
 * die Karte (postmeister_verwerfen) und für „Mara heute“ (E-406 B3, gelber Entwurf). false = schon gesendet/abgelegt.
 */
export async function entwurfVerwerfen(id: number, von: string): Promise<boolean> {
  const [r] = (await sqlPool`
    UPDATE fiaon_postmeister SET aktion = 'geordnet', naechster_versuch_am = NULL,
           begruendung = ${`Nicht beantwortet — Entscheidung ${von} (E-371)`.slice(0, 300)}, updated_at = NOW()
     WHERE id = ${id} AND aktion = 'entwurf' AND gesendet_am IS NULL
    RETURNING postfach, antwort_draft_id, person_id, ref`) as any[];
  if (!r) return false;
  if (r.antwort_draft_id) {
    const { entwurfLoeschen } = await import("./fiaon-gmail");
    await entwurfLoeschen(r.postfach, r.antwort_draft_id).catch(() => {});
  }
  const { uebergabeSchliessen } = await import("./fiaon-postmeister-lauf");
  await uebergabeSchliessen({ id, personId: r.person_id ?? null, ref: r.ref ?? null }, von, `Nicht beantwortet (Entscheidung ${von}), Mail #${id}.`).catch(() => false);
  return true;
}

werkzeugRegistrieren("postmeister_verwerfen", async (args, k) => {
  const id = Number(args?.id);
  if (!(id > 0)) return ausfuehrErgebnis.fehler("Die Karte nennt keine Mail.");
  if (!(await entwurfVerwerfen(id, k.von))) return ausfuehrErgebnis.vonSelbst("Diese Mail ist schon beantwortet oder abgelegt.");
  return ausfuehrErgebnis.erledigt("Abgelegt — keine Antwort.");
});

// ═══════════════════════════════════════════════════════════════════════════
// E-401 (6/6, 19.10.2026) — DER ALTBESTAND: „nicht mehr nötig“ ablegen? Justin entscheidet mit einem Klick.
// Der Probelauf (fristStand, fiaon-postmeister-frist.ts) zählt die alten Entwürfe (von vor der 24-Stunden-Regel), die
// nicht mehr nötig sind — der Kunde schrieb danach, Storno/Kündigung gebucht, Gespräch geführt, Zahlung gebucht.
// Die Karte steht nur, solange der Schalter AUS ist und es etwas abzulegen gibt; ein fester Schlüssel: einmal
// entschieden, kommt sie nicht wieder (der Schalter steht dann im Postfach). Abgelegt wird nur, gesendet nie.
// ═══════════════════════════════════════════════════════════════════════════
entscheidungArt("postmeister_altbestand", "Liegengebliebene Entwürfe", 64);
export const ALTBESTAND_KARTE = "postmeister_altbestand:e401";

/** Rein: die Karte aus dem Probelauf — null, wenn nichts abzulegen ist oder der Schalter schon an ist. */
export function altbestandKarte(s: {
  altbestandAblegen: boolean;
  altbestand: { gesamt: number; nichtMehrNoetig: number; jeGrund: Record<string, number>; offen: number; aeltester: string | null };
}, grundKurz: Record<string, string>): EntscheidungNeu | null {
  const a = s.altbestand;
  if (s.altbestandAblegen || !(a.nichtMehrNoetig > 0)) return null;
  const gruende = Object.entries(a.jeGrund).filter(([, n]) => n > 0).sort((x, y) => y[1] - x[1]);
  return {
    schluessel: ALTBESTAND_KARTE,
    art: "postmeister_altbestand",
    titel: `${a.nichtMehrNoetig} alte Entwürfe sind nicht mehr nötig — ablegen?`,
    text: `Mara hat die ${a.gesamt} Antwort-Entwürfe von vor der 24-Stunden-Regel geprüft (Probelauf, nichts verändert). `
      + `${a.nichtMehrNoetig} brauchen keine Antwort mehr — meist hat der Kunde danach noch einmal geschrieben und seine neuere Mail `
      + `trägt den Fall. ${a.offen} brauchen noch eine Antwort oder deine Entscheidung und bleiben liegen. `
      + "„Ablegen“ legt nur die nicht mehr nötigen ab — es geht KEINE Mail an Kunden — und schaltet die Ablage für den Altbestand an "
      + "(ausschalten im Postfach).",
    empfehlung: "ablegen",
    optionen: [
      { key: "ablegen", label: `${a.nichtMehrNoetig} ablegen`, werkzeug: "postmeister_altbestand_ablegen", ton: "gut",
        titel: "Legt die nicht mehr nötigen alten Entwürfe ab — ohne Mail an Kunden. Mit Grund in der Zeile und einem Vermerk in der Akte." },
      { key: "lassen", label: "So lassen", werkzeug: "nichts", ton: "neutral" },
    ],
    belege: [
      ...gruende.map(([g, n]) => ({ text: `${grundKurz[g] ?? g}: ${n}` })),
      { text: `${a.offen} bleiben`, ton: "warn" as const },
      ...(a.aeltester ? [{ text: `älteste ${tag(a.aeltester)}` }] : []),
    ],
  };
}

async function findeAltbestand(): Promise<EntscheidungNeu[]> {
  const { fristStand } = await import("./fiaon-postmeister-frist");
  const k = altbestandKarte(await fristStand(), GRUND_KURZ);
  return k ? [k] : [];
}
detektorRegistrieren({ art: "postmeister_altbestand", finden: findeAltbestand, erledigtText: "Hat sich erledigt — nichts mehr abzulegen, oder die Ablage ist schon an." });

werkzeugRegistrieren("postmeister_altbestand_ablegen", async () => {
  const { altbestandAblegenStarten } = await import("./fiaon-postmeister-frist");
  const r = await altbestandAblegenStarten();
  return ausfuehrErgebnis.erledigt(`Mara legt ${r.erwartet ? `${r.erwartet} ` : ""}alte Entwürfe ab, die nicht mehr nötig sind — keine Mail an Kunden. `
    + "Die Ablage für den Altbestand ist jetzt an (aus im Postfach).");
});

werkzeugRegistrieren("postmeister_alle_neu", async () => {
  const { entwuerfeNeuSchreiben } = await import("../routes/fiaon-postmeister-zentrale");
  const e = await entwuerfeNeuSchreiben({ nurVor: KARTEN_AB, nichtVor: nichtVor(), parallel: 2 });
  if (!e.ok) return ausfuehrErgebnis.fehler(e.error);
  if (!e.gestartet) return ausfuehrErgebnis.vonSelbst("Keine alten Entwürfe mehr.");
  return ausfuehrErgebnis.erledigt(`Mara schreibt ${e.gestartet} Mails neu${e.doppelteGeordnet ? ` (${e.doppelteGeordnet} doppelte im selben Faden abgelegt)` : ""} — `
    + "Fortschritt oben im Postfach (/chef/s/postmeister). Was eine Entscheidung braucht, kommt einzeln hierher.");
});
