// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — RUHETAGE DER GARANTIEFRIST IM KAPITAL-ANGEBOT (Register E-512, 13.11.2026)
//
// Justin: „wenn wir auf Behörden warten, darf das NICHT in unsere Geld-zurück-Garantie fallen … wir warten ja oft auf den
// Kunden“. Vorher war der Knopf „Frist ruhen“ beim Kapital-Angebot gesperrt (KAPITAL_SPERRGRUND) — die Leitung konnte
// Ruhezeiten nur von Hand in den Verlauf schreiben, das Fristende blieb stehen (Stand 13.11.: überall 0 Ruhetage).
//
// Jetzt: Ruhetage mit Grund, Beginn und Ende eintragen; das Fristende rückt um genau diese Tage. Welche Gründe gelten,
// sagt der WORTLAUT des jeweiligen Vertrags — nie mehr, als der Kunde angenommen hat:
//   · Fassung A/B (Firmen, Ziffer 4 Abs. 5): Unterlagen nach Ziffer 7 stehen aus · vorgelegtes Angebot nicht angenommen.
//   · Fassung C vor E-512 (Ziffer 4 Abs. 5/6): Tage über der Unterlagenfrist der Bank (Ziffer 7 Abs. 2) · Angebot liegt
//     zur Annahme vor · bis der Reisepass vorliegt (nur mit datenVomKunden).
//   · Fassung C ab E-512: erbetene Mitwirkung (Bitte in Textform bis Eingang) · Antrag bei Behörde oder Register
//     (Einreichung bis Bescheid) · höhere Gewalt · Angebot liegt vor · Reisepass (mit datenVomKunden).
// Die offene Vergütung zählt hier nicht: Die Frist beginnt ohnehin erst mit der Zahlung (kapitalGarantieFrist).
//
// Gezählt wird kundenfreundlich: vom Beginn bis zum Tag VOR dem Eingang bzw. Bescheid; läuft es noch, bis heute
// einschließlich. Was eine frühere Eintragung schon gezählt hat (letzter gezählter Tag im Verlauf, `ruhenBis`), zählt nie
// doppelt — auch nicht über Gründe hinweg (Ziffer 4: „Überschneiden sich Ruhenszeiten, zählt jeder Tag einmal“).
// ═══════════════════════════════════════════════════════════════════════════

export type KapitalRuhenGrund = "unterlagen7" | "bankunterlagen" | "mitwirkung" | "behoerde" | "hoeheregewalt" | "angebot" | "reisepass";

export const KAPITAL_RUHEN_GRUENDE: Readonly<Record<KapitalRuhenGrund, { label: string; hinweis: string }>> = {
  unterlagen7: { label: "Unterlagen nach Ziffer 7 stehen aus", hinweis: "Beginn = Tag, ab dem die Unterlage fehlte; Ende = Tag des Eingangs (zählt nicht mehr mit)." },
  bankunterlagen: { label: "Frist der Bank für Unterlagen überschritten (Ziffer 7 Abs. 2)", hinweis: "Nur die Tage NACH Ablauf der Unterlagenfrist der Bank: Beginn = erster Tag nach der Frist, Ende = Tag des Eingangs." },
  mitwirkung: { label: "Wir warten auf den Kunden (erbetene Unterlage, Angabe, Unterschrift, Antwort)", hinweis: "Beginn = Tag der Bitte in Textform (Mail, Portal); Ende = Tag des Eingangs (zählt nicht mehr mit)." },
  behoerde: { label: "Antrag bei Behörde oder Register läuft (Eintragung, EIN, ITIN)", hinweis: "Beginn = Tag der Einreichung; Ende = Tag, an dem der Bescheid bei uns vorliegt (zählt nicht mehr mit)." },
  hoeheregewalt: { label: "Höhere Gewalt (z. B. Stillstand der US-Bundesbehörden)", hinweis: "Beginn und Ende des Ereignisses; im Text Quelle nennen (Meldung, Datum)." },
  angebot: { label: "Finanzierungsangebot zu den Vertragsbedingungen liegt zur Annahme vor", hinweis: "Beginn = Tag, an dem das Angebot dem Kunden vorlag; Ende = Annahme. Fassung C: Lehnt der Kunde ab oder lässt er es verfallen, entfällt die Garantie — dann nicht hier, sondern Justin." },
  reisepass: { label: "Reisepass liegt noch nicht vor (Ziffer 4 Abs. 6)", hinweis: "Beginn = Annahme bzw. Fristbeginn; Ende = Eingang des Reisepasses." },
};

/** Welche Gründe trägt der Wortlaut dieses Vertrags? Rein. */
export function kapitalRuhenGruende(ein: { fassungC: boolean; ruhenErweitert: boolean; datenVomKunden: boolean }): KapitalRuhenGrund[] {
  if (!ein.fassungC) return ["unterlagen7", "angebot"];
  const pass: KapitalRuhenGrund[] = ein.datenVomKunden ? ["reisepass"] : [];
  return ein.ruhenErweitert ? ["mitwirkung", "behoerde", "hoeheregewalt", "angebot", ...pass] : ["bankunterlagen", "angebot", ...pass];
}

const TAG = /^\d{4}-\d{2}-\d{2}$/;
function plus(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
function tagText(iso: string): string { return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`; }

/**
 * Die Ruhetage einer Eintragung — gerechnet, nicht getippt. `bis` = Tag des Eingangs/Bescheids (zählt nicht mehr mit) oder
 * null (läuft noch: bis heute einschließlich). Vor dem Fristbeginn ruht nichts; `bisher` = letzter schon gezählter Tag. Rein.
 */
export function kapitalRuhenRechnen(ein: { von: string; bis: string | null; heute: string; fristBeginn: string; bisher: string | null }):
  { ok: true; von: string; bisGezaehlt: string; tage: number; offen: boolean } | { ok: false; error: string } {
  if (!TAG.test(ein.von) || ein.von > ein.heute) return { ok: false, error: "Beginn der Ruhezeit als Datum (nicht in der Zukunft)." };
  if (ein.bis !== null && (!TAG.test(ein.bis) || ein.bis > ein.heute)) return { ok: false, error: "Ende (Tag des Eingangs oder Bescheids) als Datum, nicht in der Zukunft — oder leer lassen, wenn es noch läuft." };
  if (ein.bis !== null && ein.bis <= ein.von) return { ok: false, error: "Das Ende liegt nicht nach dem Beginn — es ergibt sich kein Ruhetag." };
  const ende = ein.bis !== null ? plus(ein.bis, -1) : ein.heute;
  let von = ein.von < ein.fristBeginn ? ein.fristBeginn : ein.von;
  if (ein.bisher && plus(ein.bisher, 1) > von) von = plus(ein.bisher, 1);
  const tage = Math.round((new Date(`${ende}T12:00:00Z`).getTime() - new Date(`${von}T12:00:00Z`).getTime()) / 864e5) + 1;
  if (tage < 1) {
    return { ok: false, error: ein.bisher && ein.bisher >= ende ? `Bis ${tagText(ein.bisher)} sind die Ruhetage schon gezählt — es kommt kein Tag dazu.` : `Vor dem Fristbeginn (${tagText(ein.fristBeginn)}) ruht nichts — es kommt kein Tag dazu.` };
  }
  if (tage > 120) return { ok: false, error: "Mehr als 120 Ruhetage in einer Eintragung — bitte erst mit Justin klären." };
  return { ok: true, von, bisGezaehlt: ende, tage, offen: ein.bis === null };
}

/** Der Satz für den Verlauf — mit Grund, Zeitraum und neuem Fristende. Rein. */
export function kapitalRuhenVermerk(ein: { grund: KapitalRuhenGrund; von: string; bisGezaehlt: string; tage: number; offen: boolean; text: string; fristEndeNeu: string }): string {
  return `Garantiefrist ruhte vom ${tagText(ein.von)} bis ${tagText(ein.bisGezaehlt)} (${ein.tage} ${ein.tage === 1 ? "Tag" : "Tage"}${ein.offen ? ", läuft noch — später fortsetzen" : ""}) — ${KAPITAL_RUHEN_GRUENDE[ein.grund].label}: ${ein.text} — neues Fristende ${tagText(ein.fristEndeNeu)}`;
}

/** Was das Chefbüro zum Knopf „Ruhetage eintragen“ braucht — erlaubte Gründe, Frist, schon gezählte Tage, Sperrgrund. Rein. */
export function kapitalRuhenLage(ein: {
  fassungC: boolean; ruhenErweitert: boolean; datenVomKunden: boolean; status: string;
  fristBeginn: string | null; fristEnde: string | null; hemmungTage: number; garantieErfuellt: boolean; erstattung: boolean; verlauf: unknown[];
}): { gruende: { key: KapitalRuhenGrund; label: string; hinweis: string }[]; fristBeginn: string | null; fristEnde: string | null; hemmungTage: number; bisher: string | null; sperre: string | null; erweitert: boolean } {
  const bisher = (Array.isArray(ein.verlauf) ? ein.verlauf : [])
    .map((v) => (v && typeof (v as { ruhenBis?: unknown }).ruhenBis === "string" ? String((v as { ruhenBis: string }).ruhenBis) : null))
    .filter((x): x is string => !!x && TAG.test(x)).sort().pop() ?? null;
  const sperre = ein.status !== "angenommen" ? "Erst nach der Annahme."
    : !ein.fristBeginn || !ein.fristEnde ? "Die Garantiefrist läuft noch nicht — sie beginnt mit der Zahlung."
    : ein.garantieErfuellt || ein.erstattung ? "Nach erfüllter Garantie oder vorgemerktem Garantiefall gibt es keine Frist mehr."
    : null;
  const gruende = kapitalRuhenGruende(ein).map((key) => ({ key, ...KAPITAL_RUHEN_GRUENDE[key] }));
  return { gruende, fristBeginn: ein.fristBeginn, fristEnde: ein.fristEnde, hemmungTage: Math.max(0, Number(ein.hemmungTage) || 0), bisher, sperre, erweitert: ein.fassungC && ein.ruhenErweitert };
}
