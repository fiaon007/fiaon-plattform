/**
 * ============================================================================
 * ARAS CLIENT PORTAL - Authentication Routes
 * ============================================================================
 * Separate auth system for client portals (e.g., Leadely)
 * Completely isolated from main platform auth
 * ============================================================================
 */

import { Router, Request, Response, NextFunction } from 'express';
import { createHmac, timingSafeEqual, scryptSync, randomBytes, createHash } from 'crypto';
import { logPortalAudit } from './portal-calls';

const router = Router();

// ============================================================================
// TYPES
// ============================================================================

// STEP 14: Portal Permission Types
export type PortalPermission = 
  | 'calls.read'
  | 'calls.write'      // notes/review/star/tag
  | 'analysis.run'     // single analyze + bulk
  | 'export.csv'
  | 'export.pdf'
  | 'audit.read'
  | 'views.manage';    // saved views (client-only flag)

export type PortalRole = 'CEO' | 'Marketing' | 'ReadOnly' | string;

interface PortalUser {
  portalKey: string;
  username: string;
  password?: string;       // DEPRECATED: use passwordHash
  passwordHash?: string;   // scrypt$N=16384$r=8$p=1$salt=<b64>$hash=<b64>
  displayName: string;
  role: PortalRole;
  permissions?: PortalPermission[];  // STEP 14: Optional explicit permissions
}

// STEP 14: Role-based permission defaults
const ROLE_PERMISSIONS: Record<string, PortalPermission[]> = {
  CEO: [
    'calls.read', 'calls.write', 'analysis.run', 
    'export.csv', 'export.pdf', 'audit.read', 'views.manage'
  ],
  Marketing: [
    'calls.read', 'calls.write', 'analysis.run',
    'export.csv', 'export.pdf', 'views.manage'
    // NO audit.read
  ],
  ReadOnly: [
    'calls.read', 'export.pdf', 'views.manage'
  ]
};

const DEFAULT_PERMISSIONS: PortalPermission[] = ['calls.read', 'views.manage'];

/**
 * Resolve permissions for a user based on explicit permissions or role defaults.
 */
export function resolvePermissions(user: PortalUser): PortalPermission[] {
  // If explicit permissions provided, use them
  if (user.permissions && user.permissions.length > 0) {
    return user.permissions;
  }
  
  // Map by role
  const rolePerms = ROLE_PERMISSIONS[user.role];
  if (rolePerms) {
    return rolePerms;
  }
  
  // Fallback for unknown roles
  return DEFAULT_PERMISSIONS;
}

// ============================================================================
// STEP 10: PASSWORD HASHING (scrypt, Node crypto)
// ============================================================================

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

/**
 * Hash a portal password using scrypt.
 * Format: scrypt$N=16384$r=8$p=1$salt=<base64>$hash=<base64>
 * Use this to generate hashes for .env (run once locally).
 */
export function hashPortalPassword(plain: string): string {
  const salt = randomBytes(32);
  const hash = scryptSync(plain, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$N=${SCRYPT_N}$r=${SCRYPT_R}$p=${SCRYPT_P}$salt=${salt.toString('base64')}$hash=${hash.toString('base64')}`;
}

/**
 * Verify a password against a scrypt hash.
 * Uses constant-time comparison.
 */
function verifyPortalPassword(plain: string, passwordHash: string): boolean {
  try {
    const parts = passwordHash.split('$');
    if (parts[0] !== 'scrypt' || parts.length < 6) return false;
    
    // Parse params
    const params: Record<string, string> = {};
    for (let i = 1; i < parts.length; i++) {
      const [key, val] = parts[i].split('=');
      if (key && val) params[key] = val;
    }
    
    const N = parseInt(params['N'] || '16384', 10);
    const r = parseInt(params['r'] || '8', 10);
    const p = parseInt(params['p'] || '1', 10);
    const salt = Buffer.from(params['salt'] || '', 'base64');
    const storedHash = Buffer.from(params['hash'] || '', 'base64');
    
    if (salt.length === 0 || storedHash.length === 0) return false;
    
    const derivedHash = scryptSync(plain, salt, storedHash.length, { N, r, p });
    
    return timingSafeEqual(derivedHash, storedHash);
  } catch {
    return false;
  }
}

// ============================================================================
// STEP 10: BRUTE-FORCE PROTECTION (in-memory)
// ============================================================================

interface LoginAttempt {
  count: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

const loginAttempts = new Map<string, LoginAttempt>();

const BRUTE_FORCE_MAX_ATTEMPTS = 8;
const BRUTE_FORCE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const BRUTE_FORCE_LOCK_MS = 15 * 60 * 1000;   // 15 minutes

function getAttemptKey(ip: string, portalKey: string, username: string): string {
  return `${ip}:${portalKey}:${username}`;
}

function hashIp(ip: string): string {
  const secret = getSessionSecret();
  return createHash('sha256').update(ip + secret).digest('hex').slice(0, 16);
}

function checkBruteForce(ip: string, portalKey: string, username: string): { locked: boolean; remaining?: number } {
  const key = getAttemptKey(ip, portalKey, username);
  const now = Date.now();
  const attempt = loginAttempts.get(key);
  
  if (!attempt) return { locked: false };
  
  // Check if locked
  if (attempt.lockedUntil && now < attempt.lockedUntil) {
    return { locked: true, remaining: Math.ceil((attempt.lockedUntil - now) / 1000) };
  }
  
  // Reset if window expired
  if (now - attempt.firstAttempt > BRUTE_FORCE_WINDOW_MS) {
    loginAttempts.delete(key);
    return { locked: false };
  }
  
  return { locked: false };
}

function recordFailedAttempt(ip: string, portalKey: string, username: string): boolean {
  const key = getAttemptKey(ip, portalKey, username);
  const now = Date.now();
  let attempt = loginAttempts.get(key);
  
  if (!attempt || now - attempt.firstAttempt > BRUTE_FORCE_WINDOW_MS) {
    attempt = { count: 1, firstAttempt: now, lockedUntil: null };
  } else {
    attempt.count++;
  }
  
  // Check if should lock
  if (attempt.count >= BRUTE_FORCE_MAX_ATTEMPTS) {
    attempt.lockedUntil = now + BRUTE_FORCE_LOCK_MS;
    loginAttempts.set(key, attempt);
    return true; // locked
  }
  
  loginAttempts.set(key, attempt);
  return false;
}

function resetAttempts(ip: string, portalKey: string, username: string): void {
  const key = getAttemptKey(ip, portalKey, username);
  loginAttempts.delete(key);
}

// Cleanup old entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(loginAttempts.entries());
  for (let i = 0; i < entries.length; i++) {
    const [key, attempt] = entries[i];
    if (attempt.lockedUntil && now > attempt.lockedUntil) {
      loginAttempts.delete(key);
    } else if (now - attempt.firstAttempt > BRUTE_FORCE_WINDOW_MS * 2) {
      loginAttempts.delete(key);
    }
  }
}, 30 * 60 * 1000);

interface PortalBranding {
  mode: 'white_label' | 'co_branded';
  productName: string;
  showPoweredBy: boolean;
  accent: string;
  locationLabel?: string;
  supportLabel?: string;
  supportEmail?: string;
}

interface PortalCopy {
  welcomeTitle: string;
  welcomeSubtitle: string;
  packageExplainer: string;
  signalExplainerShort: string;
  signalExplainerLong: string;
  privacyNoteShort: string;
}

interface PortalInfoHints {
  signalScore: string;
  nextBestAction: string;
  riskFlags: string;
  exportCsv: string;
  pdfReport: string;
  autoAnalyze: string;
  insights: string;
  companyCard: string;
  packageCard: string;
}

interface PortalConfig {
  company: {
    name: string;
    ceo: string;
    email: string;
    addressLine: string;
    zipCity: string;
    vatId: string;
  };
  package: {
    includedCalls: number;
    label: string;
    notes: string;
  };
  ui: {
    portalTitle: string;
    tooltipMode: string;
    kpiFocus: string;
    branding?: Partial<PortalBranding>;
    copy?: Partial<PortalCopy>;
    infoHints?: Partial<PortalInfoHints>;
  };
  filter: {
    field: string;
    value: string;
  };
}

// Default values for white-label polish
const DEFAULT_BRANDING: PortalBranding = {
  mode: 'white_label',
  productName: 'Call Intelligence',
  showPoweredBy: false,
  accent: 'arasOrange',
  locationLabel: '',
  supportLabel: 'Support',
  supportEmail: ''
};

const DEFAULT_COPY: PortalCopy = {
  welcomeTitle: 'Willkommen',
  welcomeSubtitle: 'Übersicht Ihrer Voice-Agent Gespräche und Analysen.',
  packageExplainer: 'Jeder abgeschlossene Call zählt gegen Ihr Kontingent. Überschreitung wird nach Verbrauch abgerechnet.',
  signalExplainerShort: 'Der Signal Score zeigt die Abschlusswahrscheinlichkeit.',
  signalExplainerLong: 'Der Signal Score (0–100) bewertet automatisch die Gesprächsqualität und Abschlusswahrscheinlichkeit. Werte ≥70 gelten als "High Signal" – diese Leads verdienen priorisierte Nachverfolgung.',
  privacyNoteShort: 'Ihre Daten werden gemäß DSGVO verarbeitet und nicht an Dritte weitergegeben.'
};

const DEFAULT_INFO_HINTS: PortalInfoHints = {
  signalScore: 'Der Signal Score (0–100) bewertet automatisch die Gesprächsqualität. Werte ab 70 zeigen hohe Abschlusswahrscheinlichkeit.',
  nextBestAction: 'Die empfohlene nächste Aktion basiert auf dem Gesprächsverlauf und erkannten Signalen.',
  riskFlags: 'Risiko-Flags weisen auf potenzielle Einwände oder kritische Punkte im Gespräch hin.',
  exportCsv: 'Exportiert alle gefilterten Calls als CSV-Datei für Ihre eigene Auswertung.',
  pdfReport: 'Öffnet einen druckoptimierten Report. Im Druckdialog "Als PDF speichern" wählen.',
  autoAnalyze: 'Analysiert neue Calls automatisch beim Öffnen. Kann jederzeit deaktiviert werden.',
  insights: 'Trends und KPIs der letzten 14 Tage auf einen Blick.',
  companyCard: 'Ihre Firmendaten für Rechnungsstellung und Compliance.',
  packageCard: 'Übersicht Ihres gebuchten Call-Kontingents und aktueller Verbrauch.'
};

function applyConfigDefaults(config: PortalConfig, displayName: string): PortalConfig {
  return {
    ...config,
    ui: {
      ...config.ui,
      branding: { ...DEFAULT_BRANDING, ...config.ui.branding },
      copy: { 
        ...DEFAULT_COPY, 
        welcomeTitle: `Willkommen, ${displayName.split(' ')[0]}.`,
        ...config.ui.copy 
      },
      infoHints: { ...DEFAULT_INFO_HINTS, ...config.ui.infoHints }
    }
  };
}

// ============================================================================
// STEP 32: ENV CONFIG PARSERS + FAIL-CLOSED GUARD
// ============================================================================

// Global config state for fail-closed behavior
let portalConfigOk = false;
let portalConfigErrorCode: string | null = null;
let portalConfigErrorKeys: string[] = [];
let cachedUsers: PortalUser[] = [];
let cachedConfigs: Record<string, PortalConfig> = {};

/**
 * Validate user object has required fields
 */
function validateUser(user: unknown, index: number): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!user || typeof user !== 'object') return { valid: false, missing: ['object'] };
  const u = user as Record<string, unknown>;
  if (!u.portalKey || typeof u.portalKey !== 'string') missing.push(`users[${index}].portalKey`);
  if (!u.username || typeof u.username !== 'string') missing.push(`users[${index}].username`);
  if (!u.displayName || typeof u.displayName !== 'string') missing.push(`users[${index}].displayName`);
  if (!u.role || typeof u.role !== 'string') missing.push(`users[${index}].role`);
  if (!u.passwordHash && !u.password) missing.push(`users[${index}].passwordHash`);
  return { valid: missing.length === 0, missing };
}

/**
 * Validate config object has required fields
 */
function validateConfig(key: string, config: unknown): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!config || typeof config !== 'object') return { valid: false, missing: [`config.${key}`] };
  const c = config as Record<string, unknown>;
  if (!c.company || typeof c.company !== 'object') missing.push(`config.${key}.company`);
  if (!c.package || typeof c.package !== 'object') missing.push(`config.${key}.package`);
  if (!c.ui || typeof c.ui !== 'object') missing.push(`config.${key}.ui`);
  if (!c.filter || typeof c.filter !== 'object') missing.push(`config.${key}.filter`);
  else {
    const f = c.filter as Record<string, unknown>;
    if (!f.mode || typeof f.mode !== 'string') missing.push(`config.${key}.filter.mode`);
    if (!f.field || typeof f.field !== 'string') missing.push(`config.${key}.filter.field`);
    if (f.value === undefined || f.value === null) missing.push(`config.${key}.filter.value`);
  }
  return { valid: missing.length === 0, missing };
}

/**
 * Initialize portal config from ENV with strict validation.
 * Called once at startup. Sets fail-closed state if invalid.
 */
export function initPortalConfig(): { ok: boolean; errorCode: string | null; errorKeys: string[] } {
  const missingKeys: string[] = [];
  
  // Parse users
  const usersJson = process.env.CLIENT_PORTAL_USERS_JSON;
  if (!usersJson) {
    portalConfigOk = false;
    portalConfigErrorCode = 'USERS_MISSING';
    portalConfigErrorKeys = ['CLIENT_PORTAL_USERS_JSON'];
    console.error('[PORTAL-CONFIG] FAIL-CLOSED: CLIENT_PORTAL_USERS_JSON not configured');
    return { ok: false, errorCode: portalConfigErrorCode, errorKeys: portalConfigErrorKeys };
  }
  
  let parsedUsers: unknown[];
  try {
    parsedUsers = JSON.parse(usersJson);
    if (!Array.isArray(parsedUsers)) throw new Error('Not an array');
  } catch (e) {
    portalConfigOk = false;
    portalConfigErrorCode = 'USERS_PARSE_ERROR';
    portalConfigErrorKeys = ['CLIENT_PORTAL_USERS_JSON'];
    console.error('[PORTAL-CONFIG] FAIL-CLOSED: Failed to parse CLIENT_PORTAL_USERS_JSON');
    return { ok: false, errorCode: portalConfigErrorCode, errorKeys: portalConfigErrorKeys };
  }
  
  // Validate each user
  for (let i = 0; i < parsedUsers.length; i++) {
    const { valid, missing } = validateUser(parsedUsers[i], i);
    if (!valid) missingKeys.push(...missing);
  }
  
  // Parse configs
  const configJson = process.env.CLIENT_PORTAL_CONFIG_JSON;
  if (!configJson) {
    portalConfigOk = false;
    portalConfigErrorCode = 'CONFIG_MISSING';
    portalConfigErrorKeys = ['CLIENT_PORTAL_CONFIG_JSON'];
    console.error('[PORTAL-CONFIG] FAIL-CLOSED: CLIENT_PORTAL_CONFIG_JSON not configured');
    return { ok: false, errorCode: portalConfigErrorCode, errorKeys: portalConfigErrorKeys };
  }
  
  let parsedConfigs: Record<string, unknown>;
  try {
    parsedConfigs = JSON.parse(configJson);
    if (!parsedConfigs || typeof parsedConfigs !== 'object' || Array.isArray(parsedConfigs)) {
      throw new Error('Not an object');
    }
  } catch (e) {
    portalConfigOk = false;
    portalConfigErrorCode = 'CONFIG_PARSE_ERROR';
    portalConfigErrorKeys = ['CLIENT_PORTAL_CONFIG_JSON'];
    console.error('[PORTAL-CONFIG] FAIL-CLOSED: Failed to parse CLIENT_PORTAL_CONFIG_JSON');
    return { ok: false, errorCode: portalConfigErrorCode, errorKeys: portalConfigErrorKeys };
  }
  
  // Validate each config
  for (const [key, config] of Object.entries(parsedConfigs)) {
    const { valid, missing } = validateConfig(key, config);
    if (!valid) missingKeys.push(...missing);
  }
  
  // Check for validation errors
  if (missingKeys.length > 0) {
    portalConfigOk = false;
    portalConfigErrorCode = 'VALIDATION_ERROR';
    portalConfigErrorKeys = missingKeys;
    console.error('[PORTAL-CONFIG] FAIL-CLOSED: Validation errors:', missingKeys.join(', '));
    return { ok: false, errorCode: portalConfigErrorCode, errorKeys: missingKeys };
  }
  
  // All valid - cache the parsed values
  cachedUsers = parsedUsers as PortalUser[];
  cachedConfigs = parsedConfigs as Record<string, PortalConfig>;
  portalConfigOk = true;
  portalConfigErrorCode = null;
  portalConfigErrorKeys = [];
  
  console.log('[PORTAL-CONFIG] OK: Loaded', cachedUsers.length, 'users,', Object.keys(cachedConfigs).length, 'portals');
  return { ok: true, errorCode: null, errorKeys: [] };
}

/**
 * Get portal config status for health check
 */
export function getPortalConfigStatus(): { 
  ok: boolean; 
  errorCode: string | null; 
  portalCount: number;
  portals: string[];
} {
  return {
    ok: portalConfigOk,
    errorCode: portalConfigErrorCode,
    portalCount: Object.keys(cachedConfigs).length,
    portals: Object.keys(cachedConfigs)
  };
}

/**
 * Middleware to block all portal API requests if config is invalid (fail-closed)
 */
export function requirePortalConfigOk(req: Request, res: Response, next: NextFunction) {
  if (!portalConfigOk) {
    return res.status(503).json({ 
      error: 'PORTAL_NOT_READY', 
      message: 'Portal config incomplete.' 
    });
  }
  next();
}

function getPortalUsers(): PortalUser[] {
  if (!portalConfigOk) return [];
  return cachedUsers;
}

function getPortalConfigs(): Record<string, PortalConfig> {
  if (!portalConfigOk) return {};
  return cachedConfigs;
}

function getSessionSecret(): string {
  const secret = process.env.PORTAL_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    console.error('[PORTAL-AUTH] PORTAL_SESSION_SECRET must be at least 32 characters');
    return 'fallback_secret_do_not_use_in_production_32chars!';
  }
  return secret;
}

// ============================================================================
// SESSION HELPERS
// ============================================================================

interface PortalSession {
  portalKey: string;
  username: string;
  displayName: string;
  role: string;
  permissions: PortalPermission[];  // STEP 14: Permissions in session
  iat: number;
  exp: number;
  sid: string; // STEP 10: Session ID for rotation
}

function signSession(session: Omit<PortalSession, 'iat' | 'exp' | 'sid'>): string {
  const secret = getSessionSecret();
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + (7 * 24 * 60 * 60); // 7 days
  const sid = randomBytes(16).toString('base64url'); // STEP 10: Session ID
  
  const payload: PortalSession = { ...session, iat, exp, sid };
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  const hmac = createHmac('sha256', secret);
  hmac.update(payloadBase64);
  const signature = hmac.digest('base64url');
  
  return `${payloadBase64}.${signature}`;
}

function verifySession(token: string): PortalSession | null {
  const secret = getSessionSecret();
  const parts = token.split('.');
  
  if (parts.length !== 2) return null;
  
  const [payloadBase64, signature] = parts;
  
  // Verify signature
  const hmac = createHmac('sha256', secret);
  hmac.update(payloadBase64);
  const expectedSignature = hmac.digest('base64url');
  
  try {
    const sigBuffer = Buffer.from(signature, 'base64url');
    const expectedBuffer = Buffer.from(expectedSignature, 'base64url');
    
    if (sigBuffer.length !== expectedBuffer.length) return null;
    if (!timingSafeEqual(sigBuffer, expectedBuffer)) return null;
  } catch {
    return null;
  }
  
  // Parse payload
  try {
    const payload: PortalSession = JSON.parse(
      Buffer.from(payloadBase64, 'base64url').toString('utf-8')
    );
    
    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;
    
    return payload;
  } catch {
    return null;
  }
}

// ============================================================================
// MIDDLEWARE: requirePortalAuth
// ============================================================================

export function requirePortalAuth(req: Request, res: Response, next: NextFunction) {
  const cookieHeader = req.headers.cookie || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [key, ...val] = c.trim().split('=');
      return [key, val.join('=')];
    })
  );
  
  const token = cookies['aras_portal_session'];
  
  if (!token) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authentication required' });
  }
  
  const session = verifySession(token);
  
  if (!session) {
    return res.status(401).json({ error: 'INVALID_SESSION', message: 'Session invalid or expired' });
  }
  
  // Verify portal config exists
  const configs = getPortalConfigs();
  if (!configs[session.portalKey]) {
    return res.status(401).json({ error: 'PORTAL_NOT_FOUND', message: 'Portal configuration not found' });
  }
  
  // Attach session to request
  (req as any).portalSession = session;
  (req as any).portalConfig = configs[session.portalKey];
  
  next();
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/portal/health
 * STEP 32B: Health check endpoint (no auth required, no secrets)
 */
router.get('/health', (req: Request, res: Response) => {
  const status = getPortalConfigStatus();
  const response = {
    ok: status.ok,
    portalConfigOk: status.ok,
    portalCount: status.portalCount,
    portals: status.portals,
    build: {
      gitSha: process.env.RENDER_GIT_COMMIT?.slice(0, 7) || process.env.GIT_SHA?.slice(0, 7) || undefined,
      nodeEnv: process.env.NODE_ENV || 'development'
    },
    time: new Date().toISOString()
  };
  
  return res.status(status.ok ? 200 : 503).json(response);
});

/**
 * POST /api/portal/login
 * Authenticate portal user
 */
router.post('/login', (req: Request, res: Response) => {
  const { portalKey, username, password } = req.body;
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  
  if (!portalKey || !username || !password) {
    return res.status(400).json({ 
      ok: false, 
      message: 'Missing required fields' 
    });
  }
  
  // STEP 10: Check brute-force lock
  const bruteCheck = checkBruteForce(clientIp, portalKey, username);
  if (bruteCheck.locked) {
    return res.status(429).json({ 
      ok: false, 
      message: 'Too many attempts. Try again later.' 
    });
  }
  
  // Find user
  const users = getPortalUsers();
  const user = users.find(u => 
    u.portalKey === portalKey && 
    u.username === username
  );
  
  // Helper for failed login
  const handleFailedLogin = () => {
    const wasLocked = recordFailedAttempt(clientIp, portalKey, username);
    const ipHash = hashIp(clientIp);
    
    if (wasLocked) {
      logPortalAudit(portalKey, 'portal.login.locked', { ipHash });
      console.warn('[PORTAL-AUTH] Account locked due to brute-force:', { portalKey, username });
      return res.status(429).json({ 
        ok: false, 
        message: 'Too many attempts. Try again later.' 
      });
    }
    
    logPortalAudit(portalKey, 'portal.login.fail', { ipHash });
    return res.status(401).json({ 
      ok: false, 
      message: 'Invalid credentials' 
    });
  };
  
  if (!user) {
    return handleFailedLogin();
  }
  
  // STEP 10: Verify password (scrypt hash preferred, plaintext fallback with warning)
  let passwordValid = false;
  
  if (user.passwordHash) {
    // New format: scrypt hash
    passwordValid = verifyPortalPassword(password, user.passwordHash);
  } else if (user.password) {
    // DEPRECATED: Plaintext fallback (log warning once)
    console.warn('[PORTAL-AUTH] DEPRECATION WARNING: User uses plaintext password. Migrate to passwordHash:', { portalKey, username });
    try {
      const pwBuffer = Buffer.from(password);
      const storedBuffer = Buffer.from(user.password);
      passwordValid = pwBuffer.length === storedBuffer.length && timingSafeEqual(pwBuffer, storedBuffer);
    } catch {
      passwordValid = false;
    }
  }
  
  if (!passwordValid) {
    return handleFailedLogin();
  }
  
  // Verify portal config exists
  const configs = getPortalConfigs();
  if (!configs[portalKey]) {
    return res.status(401).json({ 
      ok: false, 
      message: 'Invalid credentials' 
    });
  }
  
  // STEP 10: Reset brute-force counter on success
  resetAttempts(clientIp, portalKey, username);
  
  // STEP 14: Resolve permissions for user
  const permissions = resolvePermissions(user);
  
  // Create session with new SID (rotation)
  const token = signSession({
    portalKey: user.portalKey,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    permissions
  });
  
  // STEP 10 + 22A: Set cookies with strict settings
  const isProduction = process.env.NODE_ENV === 'production';
  const maxAge = 7 * 24 * 60 * 60; // 7 days
  
  // Session cookie (HttpOnly - not readable by JS)
  const sessionCookie = [
    `aras_portal_session=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
    isProduction ? 'Secure' : ''
  ].filter(Boolean).join('; ');
  
  // STEP 22A: CSRF cookie (NOT HttpOnly - must be readable by JS for double-submit)
  const csrfToken = randomBytes(32).toString('base64url');
  const csrfCookie = [
    `aras_portal_csrf=${csrfToken}`,
    'Path=/',
    // NOT HttpOnly - client must read this
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
    isProduction ? 'Secure' : ''
  ].filter(Boolean).join('; ');
  
  res.setHeader('Set-Cookie', [sessionCookie, csrfCookie]);
  
  console.log('[PORTAL-AUTH] Login successful:', { 
    portalKey, 
    username: user.username, 
    displayName: user.displayName 
  });
  
  // Audit log
  logPortalAudit(portalKey, 'portal.login', { success: true });
  
  return res.json({ ok: true });
});

/**
 * POST /api/portal/logout
 * Clear session cookie AND csrf cookie
 */
router.post('/logout', (_req: Request, res: Response) => {
  // STEP 22C: Clear both session and CSRF cookies
  const sessionClear = [
    'aras_portal_session=',
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0'
  ].join('; ');
  
  const csrfClear = [
    'aras_portal_csrf=',
    'Path=/',
    'SameSite=Lax',
    'Max-Age=0'
  ].join('; ');
  
  res.setHeader('Set-Cookie', [sessionClear, csrfClear]);
  
  return res.json({ ok: true });
});

/**
 * GET /api/portal/me
 * Get current session info + portal config (with defaults applied)
 */
router.get('/me', requirePortalAuth, (req: Request, res: Response) => {
  const session = (req as any).portalSession as PortalSession;
  const config = (req as any).portalConfig as PortalConfig;
  
  // Apply defaults for white-label polish
  const enrichedConfig = applyConfigDefaults(config, session.displayName);
  
  return res.json({
    portalKey: session.portalKey,
    displayName: session.displayName,
    role: session.role,
    permissions: session.permissions,  // STEP 14: Include permissions
    company: enrichedConfig.company,
    package: enrichedConfig.package,
    ui: enrichedConfig.ui
  });
});

// ============================================================================
// STEP 14C: Permission Enforcement Middleware
// ============================================================================

/**
 * Middleware factory to require a specific portal permission.
 * Returns 403 with neutral message if permission is missing.
 */
export function requirePortalPermission(permission: PortalPermission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const session = (req as any).portalSession as PortalSession | undefined;
    
    if (!session) {
      return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authentication required' });
    }
    
    const hasPermission = session.permissions?.includes(permission);
    
    if (!hasPermission) {
      // Audit log (safe: no sensitive data)
      logPortalAudit(session.portalKey, 'portal.auth.denied', { 
        feature: permission.split('.')[0]  // e.g., 'export' from 'export.csv'
      });
      
      // Neutral error message (no permission leakage)
      return res.status(403).json({ 
        error: 'FORBIDDEN', 
        message: 'Not authorized.' 
      });
    }
    
    next();
  };
}

// ============================================================================
// STEP 22A: CSRF-lite Middleware (Double Submit Cookie)
// ============================================================================

/**
 * Middleware to verify CSRF token for state-changing requests.
 * Uses Double Submit Cookie pattern:
 * - Client reads `aras_portal_csrf` cookie (not HttpOnly)
 * - Client sends it as `x-portal-csrf` header
 * - Server compares header === cookie
 * 
 * Apply to: PATCH, POST, DELETE on portal data endpoints (not login/logout)
 */
export function requirePortalCsrf(req: Request, res: Response, next: NextFunction) {
  // Parse cookies
  const cookieHeader = req.headers.cookie || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [key, ...val] = c.trim().split('=');
      return [key, val.join('=')];
    })
  );
  
  const csrfCookie = cookies['aras_portal_csrf'];
  const csrfHeader = req.headers['x-portal-csrf'] as string | undefined;
  
  // Both must be present and match
  if (!csrfCookie || !csrfHeader) {
    return res.status(403).json({ 
      error: 'FORBIDDEN', 
      message: 'Not authorized.' 
    });
  }
  
  // Constant-time comparison to prevent timing attacks
  try {
    const cookieBuffer = Buffer.from(csrfCookie);
    const headerBuffer = Buffer.from(csrfHeader);
    
    if (cookieBuffer.length !== headerBuffer.length || !timingSafeEqual(cookieBuffer, headerBuffer)) {
      return res.status(403).json({ 
        error: 'FORBIDDEN', 
        message: 'Not authorized.' 
      });
    }
  } catch {
    return res.status(403).json({ 
      error: 'FORBIDDEN', 
      message: 'Not authorized.' 
    });
  }
  
  next();
}

export default router;
