/**
 * ARAS Contact Key System
 * Deterministic contact identification - no guessing
 * Priority: email > phone > company > name
 */

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type ContactKind = 'person' | 'company' | 'unknown';

export interface ContactRef {
  key: string;
  label: string;
  hint?: string;
  kind: ContactKind;
}

// ═══════════════════════════════════════════════════════════════
// SAFE HELPERS
// ═══════════════════════════════════════════════════════════════

function safeString(val: unknown): string | undefined {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

function normalizeForKey(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_@.+-]/g, '');
}

function normalizePhoneDigits(input: string): string {
  // Keep only digits and leading +
  const cleaned = input.replace(/[^\d+]/g, '');
  // Ensure + is only at start
  if (cleaned.startsWith('+')) {
    return '+' + cleaned.slice(1).replace(/\+/g, '');
  }
  return cleaned.replace(/\+/g, '');
}

function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const local = parts[0];
  const domain = parts[1];
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***@${domain}`;
}

function maskPhone(phone: string): string {
  if (phone.length <= 6) return phone;
  const last3 = phone.slice(-3);
  const prefix = phone.slice(0, 3);
  return `${prefix} *** ${last3}`;
}

// ═══════════════════════════════════════════════════════════════
// KEY NORMALIZATION
// ═══════════════════════════════════════════════════════════════

export function normalizeContactKey(input: string): string {
  return normalizeForKey(input);
}

// ═══════════════════════════════════════════════════════════════
// BUILD CONTACT REF FROM CALL
// ═══════════════════════════════════════════════════════════════

export function buildContactRefFromCall(call: any): ContactRef | null {
  if (!call || typeof call !== 'object') return null;

  // Priority 1: Email
  const email = safeString(call.email) || safeString(call.contactEmail);
  if (email && email.includes('@')) {
    return {
      key: `email:${normalizeForKey(email)}`,
      label: safeString(call.contactName) || safeString(call.name) || email.split('@')[0],
      hint: maskEmail(email),
      kind: 'person',
    };
  }

  // Priority 2: Phone
  const phone = safeString(call.phoneNumber) || safeString(call.to) || safeString(call.number) || safeString(call.phone);
  if (phone) {
    const normalizedPhone = normalizePhoneDigits(phone);
    if (normalizedPhone.length >= 6) {
      return {
        key: `phone:${normalizedPhone}`,
        label: safeString(call.contactName) || safeString(call.name) || normalizedPhone,
        hint: maskPhone(normalizedPhone),
        kind: 'person',
      };
    }
  }

  // Priority 3: Company
  const company = safeString(call.company) || safeString(call.org) || safeString(call.organization);
  if (company) {
    return {
      key: `company:${normalizeForKey(company)}`,
      label: company,
      kind: 'company',
    };
  }

  // Priority 4: Name (only if clearly a person name)
  const name = safeString(call.contactName) || safeString(call.name);
  if (name && name.length >= 2) {
    return {
      key: `name:${normalizeForKey(name)}`,
      label: name,
      kind: 'person',
    };
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
// BUILD CONTACT REF FROM SPACE SESSION
// ═══════════════════════════════════════════════════════════════

export function buildContactRefFromSpace(space: any): ContactRef | null {
  if (!space || typeof space !== 'object') return null;

  // Check metadata for contact info
  const metadata = space.metadata || {};
  const spaceSummary = metadata.spaceSummary?.full || metadata.spaceSummary || {};

  // Priority 1: Email from metadata or summary
  const email = safeString(metadata.email) || safeString(spaceSummary.email) || safeString(space.email);
  if (email && email.includes('@')) {
    return {
      key: `email:${normalizeForKey(email)}`,
      label: safeString(metadata.contactName) || safeString(spaceSummary.contactName) || email.split('@')[0],
      hint: maskEmail(email),
      kind: 'person',
    };
  }

  // Priority 2: Phone
  const phone = safeString(metadata.phone) || safeString(spaceSummary.phone) || safeString(space.phone);
  if (phone) {
    const normalizedPhone = normalizePhoneDigits(phone);
    if (normalizedPhone.length >= 6) {
      return {
        key: `phone:${normalizedPhone}`,
        label: safeString(metadata.contactName) || safeString(spaceSummary.contactName) || normalizedPhone,
        hint: maskPhone(normalizedPhone),
        kind: 'person',
      };
    }
  }

  // Priority 3: Company
  const company = safeString(metadata.company) || safeString(spaceSummary.company) || 
                  safeString(metadata.org) || safeString(space.company);
  if (company) {
    return {
      key: `company:${normalizeForKey(company)}`,
      label: company,
      kind: 'company',
    };
  }

  // Priority 4: Contact name from metadata
  const contactName = safeString(metadata.contactName) || safeString(spaceSummary.contactName);
  if (contactName && contactName.length >= 2) {
    return {
      key: `name:${normalizeForKey(contactName)}`,
      label: contactName,
      kind: 'person',
    };
  }

  // Priority 5: Session title if it looks like a person/company name
  const title = safeString(space.title);
  if (title && title.length >= 2 && !title.toLowerCase().includes('unbenannt') && !title.toLowerCase().includes('chat')) {
    // Only use title if it doesn't look like a generic session name
    const genericPatterns = /^(session|chat|gespräch|unterhaltung|new|neu)/i;
    if (!genericPatterns.test(title)) {
      return {
        key: `name:${normalizeForKey(title)}`,
        label: title,
        kind: 'unknown',
      };
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
// BUILD CONTACT REF FROM TASK
// ═══════════════════════════════════════════════════════════════

interface TaskLookup {
  callsById?: Map<string, any>;
  spacesById?: Map<string, any>;
}

export function buildContactRefFromTask(task: any, lookup?: TaskLookup): ContactRef | null {
  if (!task || typeof task !== 'object') return null;

  // If task has contactLabel or similar direct field
  const contactLabel = safeString(task.contactLabel) || safeString(task.contact);
  if (contactLabel) {
    // Try to determine if it's email/phone/name
    if (contactLabel.includes('@')) {
      return {
        key: `email:${normalizeForKey(contactLabel)}`,
        label: contactLabel.split('@')[0],
        hint: maskEmail(contactLabel),
        kind: 'person',
      };
    }
    const phoneTest = normalizePhoneDigits(contactLabel);
    if (phoneTest.length >= 6 && /^\+?\d+$/.test(phoneTest)) {
      return {
        key: `phone:${phoneTest}`,
        label: phoneTest,
        hint: maskPhone(phoneTest),
        kind: 'person',
      };
    }
    return {
      key: `name:${normalizeForKey(contactLabel)}`,
      label: contactLabel,
      kind: 'unknown',
    };
  }

  // Try to resolve from source
  const sourceType = safeString(task.sourceType);
  const sourceId = safeString(task.sourceId);

  if (sourceType && sourceId && lookup) {
    if (sourceType === 'call' && lookup.callsById) {
      const call = lookup.callsById.get(sourceId);
      if (call) return buildContactRefFromCall(call);
    }
    if (sourceType === 'space' && lookup.spacesById) {
      const space = lookup.spacesById.get(sourceId);
      if (space) return buildContactRefFromSpace(space);
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
// UTILITY: Extract contact key from any item
// ═══════════════════════════════════════════════════════════════

export function extractContactKey(item: any, sourceType: 'call' | 'space' | 'task', lookup?: TaskLookup): string | undefined {
  let ref: ContactRef | null = null;
  
  if (sourceType === 'call') {
    ref = buildContactRefFromCall(item);
  } else if (sourceType === 'space') {
    ref = buildContactRefFromSpace(item);
  } else if (sourceType === 'task') {
    ref = buildContactRefFromTask(item, lookup);
  }
  
  return ref?.key;
}
