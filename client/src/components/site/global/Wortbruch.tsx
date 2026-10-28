// Überschriften: Wörter mit Bindestrich („US-LLC“, „US-Gesellschaft“, „foreign-owned“) bleiben ab Tablet-Breite
// zusammen. Der harte Bindestrich ist sonst eine Umbruchstelle, und die Zeile endete auf „US-“ (Gegenprüfung 28.10.,
// /business/wissen/amazon-stripe-paypal-llc bei 1024 und 1280 px). Der Text bleibt Zeichen für Zeichen derselbe
// (Suchmaschinen, Kopieren); nur eine Spanne mit white-space: nowrap (global-apple.css, .fd-wort) liegt darum.
// Am Telefon bleibt der Umbruch erlaubt — ein langes Wort darf dort nie aus dem Bild laufen. Nur Wörter bis 20 Zeichen:
// Lange Zusammensetzungen („Umsatzsteuer-Identifikationsnummer“) dürfen am Bindestrich weiter brechen (Nachprüfung 28.10.).
import type { ReactNode } from "react";

export function ohneBindestrichBruch(text: string): ReactNode {
  if (!text.includes("-")) return text;
  return text.split(/(\S+-\S+)/).map((teil, i) => (i % 2 === 1 && teil.length <= 20 ? <span key={i} className="fd-wort">{teil}</span> : teil));
}
