/**
 * ============================================================================
 * STEP 15: ARAS CLIENT PORTAL - Help Center Page
 * ============================================================================
 * In-portal help documentation with accordions and contact support
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { 
  ChevronDown, ChevronLeft, Mail, ExternalLink,
  CheckCircle2, Star, Phone, Tag, Zap, FileDown, Shield, HelpCircle
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface PortalBranding {
  mode: 'white_label' | 'co_branded';
  productName: string;
  showPoweredBy: boolean;
  accent: string;
  supportEmail?: string;
}

interface PortalCopy {
  welcomeSubtitle: string;
}

interface PortalSession {
  portalKey: string;
  displayName: string;
  role: string;
  permissions: string[];
  ui: {
    portalTitle: string;
    branding: PortalBranding;
    copy: PortalCopy;
  };
}

// ============================================================================
// ACCORDION COMPONENT
// ============================================================================

interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
}

function AccordionItem({ title, children, defaultOpen = false, icon }: AccordionItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div 
      className="rounded-xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon && <span className="text-[#FE9100]">{icon}</span>}
          <span className="font-medium text-white">{title}</span>
        </div>
        <ChevronDown 
          className={`w-5 h-5 text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="px-4 pb-4 text-sm text-white/70 leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HELP CENTER PAGE
// ============================================================================

export default function PortalHelpCenter() {
  const { portalKey } = useParams<{ portalKey: string }>();
  const [, setLocation] = useLocation();
  
  // Fetch session
  const { data: session, isLoading, error } = useQuery<PortalSession>({
    queryKey: ['portal-session', portalKey],
    queryFn: async () => {
      const res = await fetch('/api/portal/me', { credentials: 'include' });
      if (res.status === 401) {
        throw new Error('UNAUTHORIZED');
      }
      if (!res.ok) throw new Error('Failed to fetch session');
      return res.json();
    },
    retry: false
  });
  
  // Redirect to login if unauthorized
  useEffect(() => {
    if (error?.message === 'UNAUTHORIZED') {
      setLocation(`/portal/${portalKey}/login`);
    }
  }, [error, setLocation, portalKey]);
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#FE9100] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!session) {
    return null;
  }
  
  const productName = session.ui.branding?.productName || 'Call Intelligence';
  const supportEmail = session.ui.branding?.supportEmail;
  
  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <header 
        className="sticky top-0 z-30 border-b border-white/5"
        style={{ background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(20px)' }}
      >
        <div className="max-w-[980px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <Link 
              to={`/portal/${portalKey}`}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors text-white/60 hover:text-white"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 
                className="text-xl sm:text-2xl font-bold text-white"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                {productName} Hilfe
              </h1>
              <p className="text-sm text-white/50 mt-0.5">
                Anleitungen und Tipps für Ihr Portal
              </p>
            </div>
          </div>
        </div>
      </header>
      
      {/* Content */}
      <main className="max-w-[980px] mx-auto px-4 sm:px-6 py-8">
        <div className="space-y-4">
          
          {/* Getting Started */}
          <AccordionItem 
            title="Erste Schritte" 
            icon={<CheckCircle2 className="w-5 h-5" />}
            defaultOpen
          >
            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#FE9100]/20 text-[#FE9100] text-xs font-bold flex items-center justify-center">1</span>
                <p><strong>Dashboard öffnen:</strong> Nach dem Login sehen Sie alle Ihre Gespräche auf einen Blick.</p>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#FE9100]/20 text-[#FE9100] text-xs font-bold flex items-center justify-center">2</span>
                <p><strong>Tab "Needs Review" prüfen:</strong> Beginnen Sie mit ungeprüften Gesprächen für maximale Effizienz.</p>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#FE9100]/20 text-[#FE9100] text-xs font-bold flex items-center justify-center">3</span>
                <p><strong>Gespräch analysieren:</strong> Klicken Sie auf ein Gespräch und starten Sie die Analyse für detaillierte Insights.</p>
              </div>
            </div>
          </AccordionItem>
          
          {/* Tabs & Counts */}
          <AccordionItem 
            title="Tabs & Filter" 
            icon={<Tag className="w-5 h-5" />}
          >
            <div className="space-y-2">
              <p><strong>All:</strong> Alle Gespräche im gewählten Zeitraum.</p>
              <p><strong>Needs Review:</strong> Noch nicht geprüfte Gespräche – Ihr Startpunkt.</p>
              <p><strong>Starred:</strong> Von Ihnen markierte wichtige Gespräche.</p>
              <p><strong>High Signal:</strong> Gespräche mit hoher Abschlusswahrscheinlichkeit (Score ≥70).</p>
              <p><strong>Failed:</strong> Fehlgeschlagene oder abgebrochene Gespräche.</p>
              <p><strong>Appointments:</strong> Gespräche mit vereinbartem Termin.</p>
              <p><strong>Callbacks:</strong> Gespräche mit Rückrufwunsch.</p>
              <p><strong>Follow-up:</strong> Gespräche, die Nachverfolgung benötigen.</p>
            </div>
          </AccordionItem>
          
          {/* Review Workflow */}
          <AccordionItem 
            title="Review-Workflow" 
            icon={<Star className="w-5 h-5" />}
          >
            <div className="space-y-2">
              <p><strong>Notizen:</strong> Fügen Sie interne Notizen zu jedem Gespräch hinzu. Diese sind nur für Ihr Team sichtbar.</p>
              <p><strong>Reviewed:</strong> Markieren Sie ein Gespräch als geprüft, um es aus "Needs Review" zu entfernen.</p>
              <p><strong>Star:</strong> Markieren Sie wichtige Gespräche für schnellen Zugriff.</p>
              <p><strong>Outcome Tags:</strong> Klassifizieren Sie das Ergebnis (Termin, Rückruf, Follow-up, etc.).</p>
            </div>
          </AccordionItem>
          
          {/* Next Actions */}
          <AccordionItem 
            title="Next Actions" 
            icon={<Phone className="w-5 h-5" />}
          >
            <div className="space-y-2">
              <p>Im Gespräch-Detail finden Sie empfohlene nächste Schritte basierend auf der Analyse.</p>
              <p><strong>Copy Kit:</strong> Nutzen Sie die Kopier-Buttons für:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Direktlink zum Gespräch</li>
                <li>Vorgefertigte Follow-up Nachricht</li>
                <li>Zusammenfassung für CRM/E-Mail</li>
              </ul>
            </div>
          </AccordionItem>
          
          {/* Bulk Analyze */}
          <AccordionItem 
            title="Bulk Analyse (20)" 
            icon={<Zap className="w-5 h-5" />}
          >
            <div className="space-y-2">
              <p>Die Bulk-Analyse verarbeitet bis zu 20 Gespräche nacheinander.</p>
              <p><strong>Wichtig:</strong> Dies ist kein Massen-Durchlauf – jedes Gespräch wird einzeln analysiert mit kurzer Pause dazwischen.</p>
              <p>Sie können den Vorgang jederzeit abbrechen. Bereits analysierte Gespräche behalten ihre Analyse.</p>
            </div>
          </AccordionItem>
          
          {/* Exports */}
          <AccordionItem 
            title="Exports" 
            icon={<FileDown className="w-5 h-5" />}
          >
            <div className="space-y-2">
              <p><strong>CSV Export:</strong> Exportiert alle gefilterten Gespräche als CSV-Datei für Excel oder Google Sheets.</p>
              <p><strong>PDF Report:</strong> Öffnet einen druckoptimierten Report. Im Druckdialog wählen Sie "Als PDF speichern".</p>
              <p>Beide Exports respektieren Ihre aktuellen Filter (Zeitraum, Tab, Suche).</p>
            </div>
          </AccordionItem>
          
          {/* Privacy & Masking */}
          <AccordionItem 
            title="Datenschutz & Maskierung" 
            icon={<Shield className="w-5 h-5" />}
          >
            <div className="space-y-2">
              <p><strong>Telefonnummern:</strong> In Exports und Logs werden Telefonnummern teilweise maskiert (letzte Ziffern sichtbar).</p>
              <p><strong>Transkripte:</strong> Gesprächsinhalte werden nie in Audit-Logs gespeichert.</p>
              <p><strong>DSGVO:</strong> Alle Daten werden gemäß EU-Datenschutzrichtlinien verarbeitet.</p>
            </div>
          </AccordionItem>
          
          {/* Support */}
          <AccordionItem 
            title="Support" 
            icon={<HelpCircle className="w-5 h-5" />}
          >
            <div className="space-y-3">
              <p>Bei Fragen oder Problemen stehen wir Ihnen gerne zur Verfügung.</p>
              {supportEmail ? (
                <a 
                  href={`mailto:${supportEmail}`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors"
                  style={{ background: 'linear-gradient(135deg, #FE9100 0%, #FF6B00 100%)' }}
                >
                  <Mail className="w-4 h-4" />
                  {supportEmail}
                </a>
              ) : (
                <p className="text-white/50">Kontaktieren Sie Ihren Ansprechpartner für Support.</p>
              )}
            </div>
          </AccordionItem>
          
        </div>
        
        {/* Back to Dashboard */}
        <div className="mt-8 text-center">
          <Link
            to={`/portal/${portalKey}`}
            className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Zurück zum Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
