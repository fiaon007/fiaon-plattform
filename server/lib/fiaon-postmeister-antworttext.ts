// ═══════════════════════════════════════════════════════════════════════════
// DIE FERTIGE NACHRICHT — Anrede, Text, Gruß, HTML im Haus-CI (02.09.2026)
//
// JUSTIN: „der Agent muss auch in unseren HTML antworten, schreiben".
//
// Das Modell schreibt nur den Kern. Anrede und Gruß setzt der Server:
//   · Die ANREDE kommt aus der Person (`fiaon_persons.anrede`) — am 02.09.
//     nannte derselbe Automat dieselbe Person einmal „Herr" und einmal „Frau".
//     Ist sie unbekannt, wird sie EINMAL bestimmt und gespeichert; im Zweifel
//     bleibt es bei „Guten Tag Vorname Nachname" — richtig für jeden.
//   · Der GRUSS gehört zum Postfach, nicht zur Laune des Modells.
//
// Das HTML nutzt dasselbe Gerüst wie jede FIAON-Mail (Kopf, Typografie,
// Fußzeile, Pflichtangaben) — mit einem Knopf, wenn es einen nächsten Schritt
// mit Adresse gibt.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { mailHtml, mailText, type MailBaustein } from "../mail/geruest";
import type { NaechsterSchritt } from "@shared/fiaon-postmeister-typen";

/** Vornamen, bei denen die Anrede eindeutig ist. Alles andere bleibt neutral. */
const WEIBLICH = /^(anna|maria|julia|sabine|petra|claudia|andrea|susanne|monika|katrin|katharina|christina|christine|sandra|nicole|stefanie|melanie|jessica|jasmin|laura|lisa|lena|sarah|sara|nadine|tanja|silke|birgit|gabriele|gaby|heike|kerstin|martina|manuela|marion|ute|ulrike|angelika|barbara|beate|bettina|brigitte|carmen|daniela|denise|diana|doris|elke|erika|eva|franziska|gisela|hannelore|helga|ingrid|irene|iris|karin|kathrin|kristin|marlene|michaela|natalie|nina|patricia|rebecca|regina|renate|rita|ruth|simone|sonja|sylvia|tamara|theresa|vanessa|verena|veronika|victoria|viktoria|waltraud|yvonne|magdalena|teodora|verica|mirjana|milena|snezana|dragana|jelena|olga|elena|irina|natalia|svetlana|halina)$/i;
const MAENNLICH = /^(michael|thomas|andreas|peter|klaus|wolfgang|stefan|stephan|jürgen|juergen|christian|frank|uwe|martin|dieter|manfred|matthias|markus|marcus|bernd|joachim|alexander|daniel|sebastian|tobias|jan|jens|kai|lars|marcel|nico|patrick|rene|robert|sven|torsten|thorsten|ralf|rainer|reiner|norbert|helmut|horst|gerhard|günther|guenther|hans|heinz|herbert|karl|kurt|otto|rudolf|siegfried|walter|werner|willi|adem|ahmet|mehmet|mustafa|ali|hasan|ibrahim|dirk|dennis|erik|felix|florian|gregor|henry|jonas|julian|leon|lukas|maximilian|moritz|nikolas|oliver|philipp|simon|tim|tom|vitor|milan|nikola|goran|zoran|ivan|marko|petar|stefan)$/i;

// ═══════════════════════════════════════════════════════════════════════════
// DIE SPRACHE DES RAHMENS (02.09.2026)
//
// Justin am 02.09.: „auf englische Mails antwortet er Deutsch und super
// schlecht." Beide Hälften stimmten, und die zweite lag hier: Selbst wenn das
// Modell sauber auf Englisch schrieb, setzte der Server „Guten Tag Herr
// Smith," davor, „Rechnung ansehen und bezahlen" auf den Knopf und einen
// deutschen Gruß darunter. Ein englischer Text in einem deutschen Rahmen —
// das liest sich schlimmer als eine durchgehend deutsche Mail.
//
// Deshalb reist die Sprache jetzt bis in die letzte Zeile mit. Wo eine
// Sprache fehlt, gilt Deutsch — das ist der häufige Fall und ein sicherer.
// ═══════════════════════════════════════════════════════════════════════════

interface Rahmenworte {
  grussNeutral: (name: string) => string;
  grussHerr: (name: string) => string;
  grussFrau: (name: string) => string;
  knopf: Record<string, string>;
  abschied: string;
}

const RAHMEN: Record<string, Rahmenworte> = {
  de: {
    grussNeutral: (n) => `Guten Tag${n ? ` ${n}` : ""},`,
    grussHerr: (n) => `Guten Tag Herr ${n},`,
    grussFrau: (n) => `Guten Tag Frau ${n},`,
    knopf: { zahlung: "Rechnung ansehen und bezahlen", termin: "Termin wählen", startgespraech: "Startgespräch buchen", bereich: "Zu meinem Bereich", unterlagen: "Unterlagen hochladen", antrag: "Antrag starten", angebot: "Angebot ansehen", weiter: "Weiter" },
    abschied: "Freundliche Grüße",
  },
  en: {
    grussNeutral: (n) => `Dear${n ? ` ${n}` : " Sir or Madam"},`,
    grussHerr: (n) => `Dear Mr ${n},`,
    grussFrau: (n) => `Dear Ms ${n},`,
    knopf: { zahlung: "View and pay invoice", termin: "Choose an appointment", startgespraech: "Book your first consultation", bereich: "Go to my account", unterlagen: "Upload documents", antrag: "Start application", angebot: "View offer", weiter: "Continue" },
    abschied: "Kind regards",
  },
  fr: {
    grussNeutral: (n) => `Bonjour${n ? ` ${n}` : ""},`,
    grussHerr: (n) => `Bonjour Monsieur ${n},`,
    grussFrau: (n) => `Bonjour Madame ${n},`,
    knopf: { zahlung: "Consulter et payer la facture", termin: "Choisir un rendez-vous", startgespraech: "Réserver le premier entretien", bereich: "Accéder à mon espace", unterlagen: "Envoyer les documents", antrag: "Commencer la demande", angebot: "Voir l'offre", weiter: "Continuer" },
    abschied: "Cordialement",
  },
  es: {
    grussNeutral: (n) => `Buenos días${n ? ` ${n}` : ""},`,
    grussHerr: (n) => `Estimado Sr. ${n}:`,
    grussFrau: (n) => `Estimada Sra. ${n}:`,
    knopf: { zahlung: "Ver y pagar la factura", termin: "Elegir una cita", startgespraech: "Reservar la primera consulta", bereich: "Ir a mi área", unterlagen: "Subir documentos", antrag: "Iniciar la solicitud", angebot: "Ver la oferta", weiter: "Continuar" },
    abschied: "Un cordial saludo",
  },
  it: {
    grussNeutral: (n) => `Buongiorno${n ? ` ${n}` : ""},`,
    grussHerr: (n) => `Gentile Sig. ${n},`,
    grussFrau: (n) => `Gentile Sig.ra ${n},`,
    knopf: { zahlung: "Vedi e paga la fattura", termin: "Scegli un appuntamento", startgespraech: "Prenota il primo colloquio", bereich: "Vai alla mia area", unterlagen: "Carica i documenti", antrag: "Avvia la richiesta", angebot: "Vedi l'offerta", weiter: "Continua" },
    abschied: "Cordiali saluti",
  },
  nl: {
    grussNeutral: (n) => `Goedendag${n ? ` ${n}` : ""},`,
    grussHerr: (n) => `Geachte heer ${n},`,
    grussFrau: (n) => `Geachte mevrouw ${n},`,
    knopf: { zahlung: "Factuur bekijken en betalen", termin: "Afspraak kiezen", startgespraech: "Eerste gesprek boeken", bereich: "Naar mijn omgeving", unterlagen: "Documenten uploaden", antrag: "Aanvraag starten", angebot: "Aanbod bekijken", weiter: "Verder" },
    abschied: "Met vriendelijke groet",
  },
  pl: {
    grussNeutral: (n) => `Dzień dobry${n ? ` ${n}` : ""},`,
    grussHerr: (n) => `Szanowny Panie ${n},`,
    grussFrau: (n) => `Szanowna Pani ${n},`,
    knopf: { zahlung: "Zobacz i opłać fakturę", termin: "Wybierz termin", startgespraech: "Umów pierwszą rozmowę", bereich: "Przejdź do mojego konta", unterlagen: "Prześlij dokumenty", antrag: "Rozpocznij wniosek", angebot: "Zobacz ofertę", weiter: "Dalej" },
    abschied: "Z poważaniem",
  },
  ro: {
    grussNeutral: (n) => `Bună ziua${n ? ` ${n}` : ""},`,
    grussHerr: (n) => `Stimate domn ${n},`,
    grussFrau: (n) => `Stimată doamnă ${n},`,
    knopf: { zahlung: "Vezi și plătește factura", termin: "Alege o programare", startgespraech: "Rezervă prima discuție", bereich: "Spre contul meu", unterlagen: "Încarcă documentele", antrag: "Începe cererea", angebot: "Vezi oferta", weiter: "Continuă" },
    abschied: "Cu stimă",
  },
  tr: {
    grussNeutral: (n) => `İyi günler${n ? ` ${n}` : ""},`,
    grussHerr: (n) => `Sayın ${n} Bey,`,
    grussFrau: (n) => `Sayın ${n} Hanım,`,
    knopf: { zahlung: "Faturayı görüntüle ve öde", termin: "Randevu seç", startgespraech: "İlk görüşmeyi ayarla", bereich: "Hesabıma git", unterlagen: "Belge yükle", antrag: "Başvuruyu başlat", angebot: "Teklifi gör", weiter: "Devam" },
    abschied: "Saygılarımızla",
  },
  bg: {
    grussNeutral: (n) => `Добър ден${n ? ` ${n}` : ""},`,
    grussHerr: (n) => `Уважаеми господин ${n},`,
    grussFrau: (n) => `Уважаема госпожо ${n},`,
    knopf: { zahlung: "Вижте и платете фактурата", termin: "Изберете час", startgespraech: "Запишете първи разговор", bereich: "Към моя профил", unterlagen: "Качете документи", antrag: "Започнете заявка", angebot: "Вижте офертата", weiter: "Напред" },
    abschied: "С уважение",
  },
  ru: {
    grussNeutral: (n) => `Добрый день${n ? ` ${n}` : ""},`,
    grussHerr: (n) => `Уважаемый господин ${n},`,
    grussFrau: (n) => `Уважаемая госпожа ${n},`,
    knopf: { zahlung: "Посмотреть и оплатить счёт", termin: "Выбрать время", startgespraech: "Записаться на первую беседу", bereich: "В личный кабинет", unterlagen: "Загрузить документы", antrag: "Начать заявку", angebot: "Посмотреть предложение", weiter: "Далее" },
    abschied: "С уважением",
  },
};

/** Die Worte für eine Sprache — Deutsch, wo wir eine Sprache nicht führen. */
export function rahmenFuer(sprache: string | null | undefined): Rahmenworte {
  return RAHMEN[String(sprache || "de").slice(0, 2).toLowerCase()] ?? RAHMEN.de;
}

export async function anredeBestimmen(
  personId: number | null,
  vorname: string | null,
  nachname: string | null,
  sprache?: string | null,
): Promise<{ zeile: string; gespeichert: boolean }> {
  const w = rahmenFuer(sprache);
  const vor = String(vorname || "").trim();
  const nach = String(nachname || "").trim();
  const neutral = w.grussNeutral([vor, nach].filter(Boolean).join(" "));
  if (!personId) return { zeile: neutral, gespeichert: false };

  const [p] = (await sqlPool`SELECT anrede FROM fiaon_persons WHERE id = ${personId} LIMIT 1`) as any[];
  const bekannt = String(p?.anrede || "").trim();
  if (bekannt === "Herr") return { zeile: w.grussHerr(nach || vor), gespeichert: true };
  if (bekannt === "Frau") return { zeile: w.grussFrau(nach || vor), gespeichert: true };
  if (bekannt === "neutral") return { zeile: neutral, gespeichert: true };

  // Einmal bestimmen, dann für immer behalten.
  const anrede = WEIBLICH.test(vor) ? "Frau" : MAENNLICH.test(vor) ? "Herr" : "neutral";
  await sqlPool`
    UPDATE fiaon_persons SET anrede = ${anrede}, anrede_quelle = 'vornamensliste', updated_at = NOW()
     WHERE id = ${personId} AND anrede IS NULL
  `.catch(() => {});
  return {
    zeile: anrede === "Frau" ? w.grussFrau(nach || vor) : anrede === "Herr" ? w.grussHerr(nach || vor) : neutral,
    gespeichert: true,
  };
}

export interface FertigeAntwort { text: string; html: string }

/**
 * Setzt die Nachricht zusammen. `kern` ist der Text des Modells — ohne Anrede
 * und ohne Gruß.
 */
export function antwortBauen(ein: {
  anrede: string;
  kern: string;
  gruss: string;
  schritt?: NaechsterSchritt | null;
  betreff: string;
  /** Sprache der Kundenmail. Steuert Knopftext und Abschiedsformel. */
  sprache?: string | null;
}): FertigeAntwort {
  const w = rahmenFuer(ein.sprache);
  const absaetze = String(ein.kern || "")
    .split(/\n{2,}/)
    .map((a) => a.trim().replace(/\n/g, " "))
    .filter(Boolean);

  // Der Gruß des Postfachs ist deutsch. Schreibt der Kunde in einer anderen
  // Sprache, wäre er der letzte deutsche Fremdkörper — dann nehmen wir die
  // Abschiedsformel dieser Sprache und behalten nur die Unterschrift.
  const gruss = fremdsprachig(ein.sprache)
    ? [w.abschied, unterschrift(ein.gruss)].filter(Boolean).join("\n")
    : ein.gruss;

  const baustein: MailBaustein = {
    betreff: ein.betreff,
    preheader: absaetze[0]?.slice(0, 110) ?? "",
    titel: "",
    absaetze: [ein.anrede, ...absaetze],
    knopf: ein.schritt?.url ? { text: knopfText(ein.schritt, w), url: ein.schritt.url } : undefined,
    persoenlich: true,
  };

  const html = mailHtml(baustein);
  const text = [ein.anrede, "", ...absaetze, "", ein.schritt?.url ? `${knopfText(ein.schritt, w)}: ${ein.schritt.url}` : "", "", gruss]
    .filter((z, i, a) => !(z === "" && a[i - 1] === "")).join("\n");
  return { text, html };
}

function fremdsprachig(sprache: string | null | undefined): boolean {
  const k = String(sprache || "de").slice(0, 2).toLowerCase();
  return k !== "de" && !!RAHMEN[k];
}

/**
 * Aus „Freundliche Grüße\nIhr FIAON Welcome-Team" bleibt der Name des Teams.
 *
 * 02.09.2026: Im ersten bulgarischen Entwurf stand unter „С уважение" noch
 * „Ihr FIAON Welcome-Team". Der Firmenname soll bleiben — „Ihr" ist deutsch
 * und hat in einer bulgarischen Mail nichts verloren. Der besitzanzeigende
 * Anfang fällt deshalb weg, der Name bleibt stehen.
 */
function unterschrift(gruss: string): string {
  const zeilen = String(gruss || "").split("\n").map((z) => z.trim()).filter(Boolean);
  if (zeilen.length < 2) return "";
  return zeilen.slice(1).join("\n").replace(/^(Ihr|Ihre|Euer|Eure)\s+/i, "");
}

function knopfText(s: NaechsterSchritt, w: Rahmenworte): string {
  return w.knopf[s.art] ?? w.knopf.weiter;
}
