import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Mail, Calendar, TrendingUp, Clock, RefreshCw, 
  Loader2, AlertCircle, CheckCircle2, XCircle, 
  PlayCircle, PauseCircle, Eye, ChevronLeft, ChevronRight,
  Zap, Send, Inbox, MailCheck, MailWarning
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

interface EmailStats {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
  todayCount: number;
  last7DaysCount: number;
  last30DaysCount: number;
  successRate: number;
  openRate: number;
  lastEmailAt: string | null;
  lastEmailRecipient: string | null;
  lastEmailSubject: string | null;
}

interface Email {
  id: number;
  recipient: string;
  recipientName: string | null;
  subject: string;
  status: string;
  workflowName: string | null;
  workflowId: string | null;
  sentAt: string;
  content: string | null;
  metadata: any;
}

interface Workflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EmailListResponse {
  data: Email[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function fetchEmailStats(): Promise<EmailStats> {
  const res = await fetch('/api/admin/n8n/emails/stats');
  if (!res.ok) throw new Error('Failed to fetch email stats');
  return res.json();
}

async function fetchEmails(page: number = 1, limit: number = 20): Promise<EmailListResponse> {
  const res = await fetch(`/api/admin/n8n/emails?page=${page}&limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch emails');
  return res.json();
}

async function fetchWorkflows() {
  const res = await fetch('/api/admin/n8n/workflows');
  if (!res.ok) throw new Error('Failed to fetch workflows');
  return res.json();
}

async function toggleWorkflow(workflowId: string, activate: boolean) {
  const endpoint = activate ? 'activate' : 'deactivate';
  const res = await fetch(`/api/admin/n8n/workflows/${workflowId}/${endpoint}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to ${endpoint} workflow`);
  return res.json();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return 'Nie';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Gerade eben';
  if (diffMins < 60) return `vor ${diffMins}m`;
  if (diffHours < 24) return `vor ${diffHours}h`;
  if (diffDays < 7) return `vor ${diffDays}d`;
  return date.toLocaleDateString('de-DE');
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  loading 
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string;
  icon: any;
  trend?: 'up' | 'down' | 'neutral';
  loading?: boolean;
}) {
  const trendColors = {
    up: 'text-green-500',
    down: 'text-red-500',
    neutral: 'text-gray-500'
  };

  return (
    <Card className="overflow-hidden border-orange-500/20 hover:border-orange-500/40 transition-colors">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            ) : (
              <p className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                {value}
              </p>
            )}
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
          <div className={cn(
            "p-3 rounded-lg bg-gradient-to-br from-orange-500/10 to-amber-500/10",
            "motion-safe:animate-pulse"
          )}>
            <Icon className="h-6 w-6 text-orange-500" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: any; icon: any; label: string }> = {
    sent: { variant: 'secondary', icon: Send, label: 'Gesendet' },
    delivered: { variant: 'default', icon: MailCheck, label: 'Zugestellt' },
    opened: { variant: 'default', icon: Eye, label: 'Geöffnet' },
    clicked: { variant: 'default', icon: CheckCircle2, label: 'Geklickt' },
    bounced: { variant: 'destructive', icon: MailWarning, label: 'Abgelehnt' },
    failed: { variant: 'destructive', icon: XCircle, label: 'Fehlgeschlagen' },
  };

  const config = variants[status] || variants.sent;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function EmailDetailModal({ 
  email, 
  open, 
  onClose 
}: { 
  email: Email | null; 
  open: boolean; 
  onClose: () => void;
}) {
  if (!open || !email) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-auto m-4">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle>{email.subject}</CardTitle>
              <CardDescription>
                {email.recipientName ? `${email.recipientName} (${email.recipient})` : email.recipient}
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <XCircle className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <StatusBadge status={email.status} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Gesendet</p>
              <p className="text-sm">{formatDateTime(email.sentAt)}</p>
            </div>
            {email.workflowName && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Workflow</p>
                <p className="text-sm">{email.workflowName}</p>
              </div>
            )}
            {email.workflowId && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Workflow ID</p>
                <p className="text-sm font-mono text-xs">{email.workflowId}</p>
              </div>
            )}
          </div>
          {email.content && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Inhalt</p>
              <div className="p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                {email.content}
              </div>
            </div>
          )}
          {email.metadata && Object.keys(email.metadata).length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Metadata</p>
              <pre className="p-4 bg-muted rounded-lg text-xs overflow-auto">
                {JSON.stringify(email.metadata, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function N8NEmailDashboard() {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Queries
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['n8n-stats'],
    queryFn: fetchEmailStats,
    refetchInterval: 30000, // Refresh every 30s
  });

  const { data: emailsData, isLoading: emailsLoading, error: emailsError } = useQuery({
    queryKey: ['n8n-emails', currentPage],
    queryFn: () => fetchEmails(currentPage, 20),
    refetchInterval: 30000,
  });

  const { data: workflowsData, isLoading: workflowsLoading } = useQuery({
    queryKey: ['n8n-workflows'],
    queryFn: fetchWorkflows,
    refetchInterval: 60000, // Refresh every 60s
  });

  // Mutations
  const toggleWorkflowMutation = useMutation({
    mutationFn: ({ id, activate }: { id: string; activate: boolean }) => 
      toggleWorkflow(id, activate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['n8n-workflows'] });
      toast({
        title: "Workflow aktualisiert",
        description: "Der Workflow-Status wurde erfolgreich geändert.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Workflow konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['n8n-stats'] });
    queryClient.invalidateQueries({ queryKey: ['n8n-emails'] });
    queryClient.invalidateQueries({ queryKey: ['n8n-workflows'] });
    toast({
      title: "Aktualisiert",
      description: "Daten werden neu geladen...",
    });
  };

  const mainWorkflow = workflowsData?.data?.[0];

  // Error States
  if (statsError || emailsError) {
    return (
      <Card className="border-red-500/20">
        <CardContent className="p-12 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Fehler beim Laden</h3>
          <p className="text-sm text-muted-foreground">
            {(statsError as Error)?.message || (emailsError as Error)?.message}
          </p>
          <Button onClick={handleRefresh} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Erneut versuchen
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
            N8N Email Automation
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Überwachung und Steuerung der automatisierten E-Mail-Workflows
          </p>
        </div>
        <Button 
          variant="outline" 
          size="icon"
          onClick={handleRefresh}
          className="motion-safe:hover:rotate-180 transition-transform duration-500"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Gesamt versendet"
          value={stats?.total || 0}
          icon={Mail}
          loading={statsLoading}
        />
        <StatCard
          title="Heute"
          value={stats?.todayCount || 0}
          icon={Calendar}
          loading={statsLoading}
        />
        <StatCard
          title="Letzte 7 Tage"
          value={stats?.last7DaysCount || 0}
          icon={TrendingUp}
          loading={statsLoading}
        />
        <StatCard
          title="Letzte E-Mail"
          value={formatRelativeTime(stats?.lastEmailAt || null)}
          subtitle={stats?.lastEmailRecipient || undefined}
          icon={Clock}
          loading={statsLoading}
        />
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Erfolgsrate"
          value={`${stats?.successRate || 0}%`}
          icon={CheckCircle2}
          trend="up"
          loading={statsLoading}
        />
        <StatCard
          title="Öffnungsrate"
          value={`${stats?.openRate || 0}%`}
          icon={Eye}
          trend="neutral"
          loading={statsLoading}
        />
        <StatCard
          title="Fehlgeschlagen"
          value={stats?.failed || 0}
          icon={XCircle}
          trend="down"
          loading={statsLoading}
        />
      </div>

      {/* Workflow Control */}
      {mainWorkflow && (
        <Card className="border-orange-500/20">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-orange-500" />
                  <CardTitle>Workflow: {mainWorkflow.name}</CardTitle>
                </div>
                <CardDescription>
                  Zuletzt aktualisiert: {formatDateTime(mainWorkflow.updatedAt)}
                </CardDescription>
              </div>
              <Badge variant={mainWorkflow.active ? "default" : "secondary"} className="gap-1">
                {mainWorkflow.active ? (
                  <>
                    <PlayCircle className="h-3 w-3" />
                    Aktiv
                  </>
                ) : (
                  <>
                    <PauseCircle className="h-3 w-3" />
                    Pausiert
                  </>
                )}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => toggleWorkflowMutation.mutate({
                id: mainWorkflow.id,
                activate: !mainWorkflow.active
              })}
              disabled={toggleWorkflowMutation.isPending}
              variant={mainWorkflow.active ? "destructive" : "default"}
              className="gap-2"
            >
              {toggleWorkflowMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mainWorkflow.active ? (
                <>
                  <PauseCircle className="h-4 w-4" />
                  Workflow pausieren
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4" />
                  Workflow aktivieren
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Email Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            Versendete E-Mails
          </CardTitle>
          <CardDescription>
            {emailsData?.pagination.total || 0} E-Mails insgesamt
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emailsLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
          ) : !emailsData?.data.length ? (
            <div className="text-center p-12">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Keine E-Mails gefunden</h3>
              <p className="text-sm text-muted-foreground">
                Es wurden noch keine E-Mails über N8N versendet.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empfänger</TableHead>
                      <TableHead>Betreff</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Gesendet</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emailsData.data.map((email) => (
                      <TableRow
                        key={email.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedEmail(email)}
                      >
                        <TableCell>
                          <div className="space-y-1">
                            {email.recipientName && (
                              <div className="font-medium">{email.recipientName}</div>
                            )}
                            <div className="text-sm text-muted-foreground">
                              {email.recipient}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-md truncate">
                          {email.subject}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={email.status} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateTime(email.sentAt)}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {emailsData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Seite {emailsData.pagination.page} von {emailsData.pagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={!emailsData.pagination.hasPrev}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Zurück
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => p + 1)}
                      disabled={!emailsData.pagination.hasNext}
                    >
                      Weiter
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Email Detail Modal */}
      <EmailDetailModal
        email={selectedEmail}
        open={!!selectedEmail}
        onClose={() => setSelectedEmail(null)}
      />
    </div>
  );
}
