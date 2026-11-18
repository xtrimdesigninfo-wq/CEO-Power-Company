import { formatNaira, isMobileDevice } from './utils';
import { OrderItem, Profile } from '../types';

export const DEFAULT_WHATSAPP_NUMBER = '2347066449882';

/**
 * Normalizes a WhatsApp phone number to digits-only international format (e.g. 2347066449882).
 * Converts 11-digit Nigerian local numbers starting with 0 (e.g. 07066449882) to 2347066449882.
 */
export function normalizeWhatsAppNumber(input: string | null | undefined): string {
  const digits = (input || '').replace(/[^0-9]/g, '');
  if (!digits) return DEFAULT_WHATSAPP_NUMBER;
  if (digits.length === 11 && digits.startsWith('0')) {
    return `234${digits.slice(1)}`;
  }
  return digits;
}

/**
 * Formats a normalized WhatsApp number for human display (e.g. +234 706 644 9882).
 */
export function formatWhatsAppDisplay(input: string | null | undefined): string {
  const digits = normalizeWhatsAppNumber(input);
  if (digits.startsWith('234') && digits.length === 13) {
    return `+234 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  return `+${digits}`;
}

export interface BuildWhatsAppOrderMessageParams {
  ref: string;
  reseller: Profile;
  items: OrderItem[];
  total: number;
  note?: string | null;
}

/**
 * Builds the exact required WhatsApp order message
 */
export function buildWhatsAppOrderMessage({
  ref,
  reseller,
  items,
  total,
  note,
}: BuildWhatsAppOrderMessageParams): string {
  const lines: string[] = [];

  lines.push(`NEW RESELLER ORDER - ${ref}`);
  lines.push(`Reseller: ${reseller.full_name} (${reseller.business_name || 'Individual'})`);
  lines.push(`Phone: ${reseller.phone} | ${reseller.city}, ${reseller.state}`);
  lines.push('');

  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.name}`);
    lines.push(`   Qty: ${item.qty} x ${formatNaira(item.unit_price)} = ${formatNaira(item.line_total)}`);
  });

  lines.push('');
  lines.push(`TOTAL: ${formatNaira(total)}`);
  if (note && note.trim().length > 0) {
    lines.push(`Note: ${note.trim()}`);
  }
  lines.push('Sent from CEO Power Reseller Portal');

  return lines.join('\n');
}

/**
 * Builds a shareable WhatsApp deep-link URL (`https://wa.me/<number>?text=...`).
 */
export function buildWhatsAppDeepLink(phoneNumber: string, text: string): string {
  const cleanNumber = normalizeWhatsAppNumber(phoneNumber);
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(text)}`;
}

/**
 * Opens WhatsApp with the specified phone number and text
 * Uses window.location.href on mobile and window.open on desktop
 */
export function openWhatsAppChat(phoneNumber: string, text: string): void {
  const url = buildWhatsAppDeepLink(phoneNumber, text);

  if (typeof window !== 'undefined') {
    if (isMobileDevice()) {
      window.location.href = url;
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }
}

/**
 * Builds the "Ask about this product" WhatsApp message
 */
export function buildProductInquiryMessage(productName: string, sku?: string | null): string {
  return `Hello CEO Power Company, I have an inquiry about "${productName}"${sku ? ` (SKU: ${sku})` : ''} on the reseller portal.`;
}

/**
 * Helper message for Admin to send login details to Reseller via WhatsApp
 */
export function buildResellerWelcomeMessage(
  resellerName: string,
  username: string,
  tempPassword?: string,
  email?: string | null
): string {
  const parts = [
    `Hello ${resellerName}, your CEO Power Company Reseller Portal account has been activated!`,
    '',
    `Login URL: ${typeof window !== 'undefined' ? window.location.origin : 'https://portal.ceopowercompany.org'}/login`,
    `Username: ${username}`,
  ];
  if (email) {
    parts.push(`Email: ${email}`);
  }
  if (tempPassword) {
    parts.push(`Temporary Password: ${tempPassword}`);
  }
  parts.push('');
  parts.push('Log in to view wholesale partner prices and place orders directly. Power Without Limits!');
  return parts.join('\n');
}

/**
 * Helper message for Super Admin to send login details to Staff Admin via WhatsApp
 */
export function buildStaffWelcomeMessage(
  staffName: string,
  username: string,
  tempPassword: string,
  presetLabel?: string | null
): string {
  const parts = [
    `Hello ${staffName}, your CEO Power Company Staff Admin access${presetLabel ? ` (${presetLabel})` : ''} is ready.`,
    '',
    `Admin Console URL: ${typeof window !== 'undefined' ? window.location.origin : 'https://portal.ceopowercompany.org'}/admin/login`,
    `Username: ${username}`,
    `Password: ${tempPassword}`,
    '',
    'Keep these credentials secure.',
  ];
  return parts.join('\n');
}

export type WhatsAppSupportTopicId = 'technical_support' | 'sales_inquiry' | 'billing_help';

export interface WhatsAppSupportOption {
  id: WhatsAppSupportTopicId;
  label: string;
  description: string;
  department: string;
}

export const WHATSAPP_SUPPORT_OPTIONS: WhatsAppSupportOption[] = [
  {
    id: 'technical_support',
    label: 'Technical Support',
    description: 'System sizing, inverter wiring specs & warranty help',
    department: 'Technical Support Team',
  },
  {
    id: 'sales_inquiry',
    label: 'Sales Inquiry',
    description: 'Wholesale pricing, MOQ tiers & stock availability',
    department: 'Wholesale Sales Desk',
  },
  {
    id: 'billing_help',
    label: 'Billing Help',
    description: 'Invoices, bank transfer verification & statements',
    department: 'Accounts & Billing Desk',
  },
];

export interface WhatsAppQuickReplyTemplate {
  id: string;
  label: string;
  phrase: string;
  isSuggested?: boolean;
}

export const SUPPORT_STATUS_QUICK_REPLY_TEMPLATE: WhatsAppQuickReplyTemplate = {
  id: 'support_status',
  label: 'Check order status',
  phrase: 'Could you please help me check my pending order status and cart allocation?',
  isSuggested: true,
};

export const WHATSAPP_QUICK_REPLY_TEMPLATES: WhatsAppQuickReplyTemplate[] = [
  {
    id: 'urgent_dispatch',
    label: 'Urgent dispatch',
    phrase: 'Please treat as urgent — we need same-day Onitsha dispatch.',
  },
  {
    id: 'bulk_quote',
    label: 'Bulk / MOQ quote',
    phrase: 'Kindly share current bulk pricing and MOQ discount tiers.',
  },
  {
    id: 'spec_sheet',
    label: 'Datasheet & warranty',
    phrase: 'Please send the product datasheet and warranty terms.',
  },
  {
    id: 'payment_confirm',
    label: 'Confirm transfer',
    phrase: 'I have made a bank transfer and would like payment confirmation.',
  },
  {
    id: 'callback',
    label: 'Request call back',
    phrase: 'Please call me back at your earliest convenience.',
  },
];

/**
 * Returns true when the cart contains at least one pending item with positive quantity.
 */
export function hasPendingCartOrder(
  items: Array<{ quantity?: number }> | null | undefined
): boolean {
  return Array.isArray(items) && items.some(item => (item?.quantity ?? 1) > 0);
}

/**
 * Returns Quick Reply templates, automatically prepending the Support Status template
 * ('Check order status') as the first option when the user has a pending order in their cart.
 */
export function getQuickReplyTemplates(
  hasPendingOrder: boolean
): WhatsAppQuickReplyTemplate[] {
  return hasPendingOrder
    ? [SUPPORT_STATUS_QUICK_REPLY_TEMPLATE, ...WHATSAPP_QUICK_REPLY_TEMPLATES]
    : WHATSAPP_QUICK_REPLY_TEMPLATES;
}

/**
 * Toggles a quick-reply template ID in a selection list while preserving order.
 */
export function toggleQuickReplySelection(
  selectedIds: string[],
  templateId: string
): string[] {
  return selectedIds.includes(templateId)
    ? selectedIds.filter(id => id !== templateId)
    : [...selectedIds, templateId];
}

/**
 * Resolves selected template IDs into deduplicated follow-up phrases in canonical order.
 */
export function resolveQuickReplyPhrases(
  selectedIds: string[],
  templates: WhatsAppQuickReplyTemplate[] = WHATSAPP_QUICK_REPLY_TEMPLATES
): string[] {
  if (!selectedIds || selectedIds.length === 0) return [];
  const selectedSet = new Set(selectedIds);
  return templates
    .filter(t => selectedSet.has(t.id))
    .map(t => t.phrase.trim())
    .filter(Boolean);
}

/**
 * Builds a tailored pre-filled WhatsApp message based on the selected support topic
 * and optional Quick Reply follow-up phrases.
 */
export function buildSupportInquiryMessage(
  topicId: WhatsAppSupportTopicId,
  partnerName?: string | null,
  quickReplyPhrases?: string[] | null
): string {
  const option =
    WHATSAPP_SUPPORT_OPTIONS.find(o => o.id === topicId) || WHATSAPP_SUPPORT_OPTIONS[1];
  const partnerSuffix =
    partnerName && partnerName.trim().length > 0 ? ` from ${partnerName.trim()}` : '';

  let baseMessage: string;
  switch (option.id) {
    case 'technical_support':
      baseMessage = `Hello CEO Power Company ${option.department}, I am reaching out${partnerSuffix} for Technical Support regarding product specifications, installation sizing, or warranty assistance.`;
      break;
    case 'billing_help':
      baseMessage = `Hello CEO Power Company ${option.department}, I am reaching out${partnerSuffix} for Billing Help regarding an invoice, bank transfer confirmation, or account balance.`;
      break;
    case 'sales_inquiry':
    default:
      baseMessage = `Hello CEO Power Company ${option.department}, I am reaching out${partnerSuffix} with a Sales Inquiry regarding wholesale pricing, minimum order quantities, or incoming stock.`;
      break;
  }

  const cleanedPhrases = Array.from(
    new Set((quickReplyPhrases || []).map(p => p.trim()).filter(Boolean))
  );

  if (cleanedPhrases.length === 0) {
    return baseMessage;
  }

  return `${baseMessage}\n\n${cleanedPhrases.join(' ')}`;
}

/**
 * Builds the full WhatsApp deep-link URL for a specific support department topic
 * and optional Quick Reply follow-up phrases.
 */
export function buildSupportDeepLink(
  phoneNumber: string,
  topicId: WhatsAppSupportTopicId,
  partnerName?: string | null,
  quickReplyPhrases?: string[] | null
): string {
  const message = buildSupportInquiryMessage(topicId, partnerName, quickReplyPhrases);
  return buildWhatsAppDeepLink(phoneNumber, message);
}

/**
 * Filters WhatsApp support options by matching whitespace-separated query tokens
 * against each option's label, description, and department name.
 */
export function filterWhatsAppSupportOptions(
  query: string,
  options: WhatsAppSupportOption[] = WHATSAPP_SUPPORT_OPTIONS
): WhatsAppSupportOption[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return options;
  const tokens = normalized.split(/\s+/).filter(Boolean);

  return options.filter((option) => {
    const haystack = `${option.label} ${option.description} ${option.department}`.toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
}

export type MenuNavKey = 'ArrowDown' | 'ArrowUp' | 'Home' | 'End';

/**
 * Computes the next highlighted support option index for keyboard navigation
 * with cyclic wrapping on ArrowDown / ArrowUp.
 */
export function getNextSupportOptionIndex(
  currentIndex: number,
  key: MenuNavKey,
  optionCount: number
): number {
  if (optionCount <= 0) return -1;

  switch (key) {
    case 'ArrowDown':
      if (currentIndex < 0 || currentIndex >= optionCount - 1) return 0;
      return currentIndex + 1;
    case 'ArrowUp':
      if (currentIndex <= 0) return optionCount - 1;
      return currentIndex - 1;
    case 'Home':
      return 0;
    case 'End':
      return optionCount - 1;
  }
}

export interface ShortcutKeyInput {
  key: string;
  code?: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  targetTagName?: string | null;
  isContentEditable?: boolean;
}

/**
 * Returns true when a keydown event represents the global "Shift + /" shortcut
 * outside of editable form controls (input, textarea, select, contentEditable).
 */
export function isWhatsAppShortcutEvent({
  key,
  code,
  shiftKey,
  ctrlKey,
  metaKey,
  altKey,
  targetTagName,
  isContentEditable,
}: ShortcutKeyInput): boolean {
  if (ctrlKey || metaKey || altKey) return false;
  if (isContentEditable) return false;

  const tag = (targetTagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return false;
  }

  return Boolean(shiftKey) && (key === '?' || key === '/' || code === 'Slash');
}

export type FabSpringState = 'idle' | 'opening' | 'closing';

/**
 * Returns the CSS stagger delay class for a WhatsApp support option card index.
 */
export function getSupportOptionStaggerClass(index: number): string {
  const clamped = Math.max(0, Math.min(Math.floor(index), 3));
  return `wa-option-delay-${clamped}`;
}

/**
 * Resolves the floating WhatsApp button's spring animation state based on open/close transitions.
 */
export function getFabSpringState(isOpen: boolean, hasInteracted: boolean): FabSpringState {
  if (!hasInteracted) return 'idle';
  return isOpen ? 'opening' : 'closing';
}

export type WhatsAppContainerTheme = 'dark' | 'light';

export const DEFAULT_WHATSAPP_THEME: WhatsAppContainerTheme = 'dark';
export const WHATSAPP_THEME_STORAGE_KEY = 'ceo_power_whatsapp_theme';

/**
 * Normalizes persisted or raw theme values to a valid WhatsAppContainerTheme,
 * defaulting to deep emerald & charcoal dark mode.
 */
export function normalizeWhatsAppTheme(raw: unknown): WhatsAppContainerTheme {
  if (raw === 'light' || raw === 'dark') return raw;
  return DEFAULT_WHATSAPP_THEME;
}

/**
 * Toggles between dark and light themes for the FloatingWhatsApp container.
 */
export function toggleWhatsAppTheme(current: WhatsAppContainerTheme): WhatsAppContainerTheme {
  return current === 'dark' ? 'light' : 'dark';
}



