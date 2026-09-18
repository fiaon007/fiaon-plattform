// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — STANDORTE UND PARTNER (19.09.2026, E-191)
// London · Zürich · Miami. Angaben aus shared/fiaon-global-partner.ts
// (Register geprüft am 19.09.2026). Die Verbindung über den Gründer steht
// offen auf der Seite — eine Kanzlei nennt ihre verbundenen Gesellschaften.
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_ROLLEN } from "../fiaon-global";
import { GLOBAL_STANDORTE, GLOBAL_VERBUNDEN } from "../fiaon-global-partner";
import type { GlobalSeite } from "./typen";

export const PARTNER_SEITE: GlobalSeite = {
  pfad: "/business/partner",
  art: "partner",
  seo: {
    titel: "Standorte und Partner: London, Zürich, Miami — FIAON Global",
    beschreibung: "FIAON LTD in London, Schwarzott Capital Partners AG in Zürich, Schwarzott Global LLC in Miami: wer Ihr Vertragspartner ist und wer vor Ort arbeitet.",
  },
  stand: "2026-09-19",
  kennung: "FG · 18",
  auge: "Wissen · Standorte und Partner",
  h1: "London, Zürich, Miami.",
  h1b: "Drei Standorte, ein Vertragspartner.",
  lead: "Ihr Vertrag kommt mit der FIAON LTD in London zustande. In Zürich begleitet die Schwarzott Capital Partners AG die Kapital-Etappe, in Miami arbeitet die Schwarzott Global LLC als unser Team vor Ort. Dazu kommen Steuerberater, US-CPA und Anwälte aus unserem Partnernetz — auf Ihr Mandat.",
  ziffern: [
    { wert: "London", label: "FIAON LTD — Vertrag, Rechnung, Ansprechpartner" },
    { wert: "Zürich", label: "Schwarzott Capital Partners AG — Kapital-Etappe" },
    { wert: "Miami", label: "Schwarzott Global LLC — Team vor Ort" },
  ],
  blick: [
    ["Vertragspartner", "FIAON LTD, 128 City Road, London · Companies House No. 17318250"],
    ["Zürich", "Schwarzott Capital Partners AG, Schifflände 26 · UID CHE-102.119.428"],
    ["Miami", "Schwarzott Global LLC, 3119 Coral Way, Suite 200"],
    ["Partnernetz", "Steuerberater, US-CPA und Anwälte — auf Ihr Mandat, Honorare trägt FIAON"],
    ["Verbunden", "Über unseren Gründer Justin Schwarzott"],
    ["Keine Bank", "Keine der Gesellschaften vergibt oder vermittelt Kredite"],
  ],
  kurz: "FIAON Global arbeitet von drei Standorten aus: Die FIAON LTD in London ist Ihr Vertragspartner, die Schwarzott Capital Partners AG in Zürich begleitet die Kapital-Etappe, die Schwarzott Global LLC in Miami nimmt als unser Team vor Ort Termine wahr. Alle drei Gesellschaften sind über unseren Gründer Justin Schwarzott verbunden. Keine von ihnen ist eine Bank oder vergibt Kredite.",
  bloecke: [
    { typ: "standorte", id: "standorte", h2: "Die drei Standorte", lead: "Wer Ihr Vertragspartner ist, wer für Sie vor Ort arbeitet und wer die Kapital-Etappe begleitet." },
    {
      typ: "karten", id: "aufgaben", h2: "Wer was tut", spalten: 3,
      karten: GLOBAL_STANDORTE.map((o) => ({ tag: o.stadt, titel: o.gesellschaft, text: `${o.rolle}. ${o.aufgaben.map((a) => a.charAt(0).toUpperCase() + a.slice(1)).join(". ")}.` })),
    },
    {
      typ: "text", id: "netz", h2: "Das Partnernetz",
      absaetze: [
        GLOBAL_ROLLEN.de.partner,
        "Steuerberater, US-CPA und Anwälte arbeiten auf Ihr eigenes Mandat, weil Steuer- und Rechtsfragen nur beantworten darf, wer dafür zugelassen ist. FIAON koordiniert, bereitet vor und trägt die Honorare für die Leistungen Ihres Pakets.",
      ],
    },
    {
      typ: "hinweis", id: "offen", h2: "Offen gesagt",
      punkte: [
        GLOBAL_VERBUNDEN,
        GLOBAL_ROLLEN.de.fiaon,
        "Keine der drei Gesellschaften ist eine Bank, vergibt Kredite oder vermittelt sie. Über Konto, Karte, Rahmen und Darlehen entscheidet allein das jeweilige Institut.",
      ],
    },
  ],
  fragen: [
    { f: "Wer ist mein Vertragspartner bei FIAON Global?", a: "Die FIAON LTD, 128 City Road, London, eingetragen im Companies House (England and Wales) unter der Nummer 17318250. Vertrag und Rechnung kommen von ihr." },
    { f: "Was macht die Schwarzott Global LLC in Miami?", a: "Sie ist unser Team vor Ort: Sie nimmt Termine bei Behörden und Instituten wahr, reicht Unterlagen ein, holt Dokumente ab und richtet den Auftakt des Pakets Global VIP aus." },
    { f: "Was macht die Schwarzott Capital Partners AG in Zürich?", a: "Sie begleitet die Kapital-Etappe mit Kennzahlen und Unterlagen für Finanzierungsgespräche und ist Ansprechpartner für Unternehmen aus der Schweiz. Sie ist eine Beteiligungs- und Investmentgesellschaft, keine Bank." },
    { f: "Sind die Partner unabhängig von FIAON?", a: "Nein. Die Schwarzott Capital Partners AG und die Schwarzott Global LLC sind mit FIAON über unseren Gründer Justin Schwarzott verbunden. Wir sagen das offen, weil es für Ihre Entscheidung zählt." },
  ],
  weiter: ["/business/miami", "/business/aus-der-schweiz", "/business/firmenkarten-kapital", "/business/us-firmengruendung"],
  quellen: [
    { titel: "Companies House — FIAON LTD", url: "https://find-and-update.company-information.service.gov.uk/company/17318250" },
    { titel: "Zefix — Schwarzott Capital Partners AG", url: "https://www.zefix.ch/de/search/entity/list/firm/304048" },
  ],
};
