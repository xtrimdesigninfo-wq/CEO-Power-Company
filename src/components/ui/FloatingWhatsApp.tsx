import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquareText,
  Wrench,
  ShoppingBag,
  Receipt,
  ChevronRight,
  Search,
  X,
  Copy,
  Check,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react';
import {
  WHATSAPP_SUPPORT_OPTIONS,
  WhatsAppSupportTopicId,
  WhatsAppSupportOption,
  WhatsAppContainerTheme,
  WHATSAPP_THEME_STORAGE_KEY,
  normalizeWhatsAppTheme,
  toggleWhatsAppTheme,
  buildSupportInquiryMessage,
  buildSupportDeepLink,
  hasPendingCartOrder,
  getQuickReplyTemplates,
  toggleQuickReplySelection,
  resolveQuickReplyPhrases,
  filterWhatsAppSupportOptions,
  getNextSupportOptionIndex,
  isWhatsAppShortcutEvent,
  getSupportOptionStaggerClass,
  getFabSpringState,
  formatWhatsAppDisplay,
  openWhatsAppChat,
} from '../../lib/whatsapp';
import { safeStorage } from '../../lib/storage';
import { useCompanySettings } from '../../hooks/useCompanySettings';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';
import { useToast } from './Toast';

const TOPIC_META: Record<
  WhatsAppSupportTopicId,
  {
    icon: React.ComponentType<{ className?: string }>;
    badgeClass: string;
  }
> = {
  technical_support: {
    icon: Wrench,
    badgeClass:
      'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/65 dark:text-sky-300 dark:border-sky-800/60',
  },
  sales_inquiry: {
    icon: ShoppingBag,
    badgeClass:
      'bg-emerald-50 text-[#187004] border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700/60',
  },
  billing_help: {
    icon: Receipt,
    badgeClass:
      'bg-orange-50 text-orange-700 border-orange-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60',
  },
};

export function FloatingWhatsApp() {
  const { settings } = useCompanySettings();
  const { profile } = useAuthStore();
  const cartItems = useCartStore(state => state.items);
  const { success: toastSuccess, error: toastError } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [copiedTopicId, setCopiedTopicId] = useState<WhatsAppSupportTopicId | null>(null);
  const [selectedQuickReplyIds, setSelectedQuickReplyIds] = useState<string[]>([]);
  const [theme, setTheme] = useState<WhatsAppContainerTheme>(() =>
    normalizeWhatsAppTheme(safeStorage.getItem(WHATSAPP_THEME_STORAGE_KEY))
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const toggleButtonRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const copyTimerRef = useRef<number | null>(null);

  const isDark = theme === 'dark';

  const handleToggleTheme = () => {
    setTheme(prev => {
      const next = toggleWhatsAppTheme(prev);
      safeStorage.setItem(WHATSAPP_THEME_STORAGE_KEY, next);
      return next;
    });
  };

  const filteredOptions = useMemo(
    () => filterWhatsAppSupportOptions(searchQuery, WHATSAPP_SUPPORT_OPTIONS),
    [searchQuery]
  );

  const hasPendingOrder = useMemo(
    () => hasPendingCartOrder(cartItems),
    [cartItems]
  );

  const quickReplyTemplates = useMemo(
    () => getQuickReplyTemplates(hasPendingOrder),
    [hasPendingOrder]
  );

  const selectedQuickReplyPhrases = useMemo(
    () => resolveQuickReplyPhrases(selectedQuickReplyIds, quickReplyTemplates),
    [selectedQuickReplyIds, quickReplyTemplates]
  );

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const openMenu = () => {
    setHasInteracted(true);
    setIsOpen(true);
  };

  const closeMenu = (restoreFocus = false) => {
    setHasInteracted(true);
    setIsOpen(false);
    setSearchQuery('');
    setActiveIndex(-1);
    setCopiedTopicId(null);
    setSelectedQuickReplyIds([]);
    if (restoreFocus) {
      requestAnimationFrame(() => toggleButtonRef.current?.focus());
    }
  };

  // Focus search field on open
  useEffect(() => {
    if (!isOpen) return;
    const raf = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [isOpen]);

  // Keep activeIndex valid when search query changes
  useEffect(() => {
    if (!isOpen) return;
    if (filteredOptions.length === 0) {
      setActiveIndex(-1);
    } else if (searchQuery.trim().length > 0) {
      setActiveIndex(0);
    } else {
      setActiveIndex(-1);
    }
  }, [searchQuery, filteredOptions.length, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeMenu(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu(true);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Global Shift + / shortcut to toggle the WhatsApp support menu
  useEffect(() => {
    const handleGlobalShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const triggered = isWhatsAppShortcutEvent({
        key: event.key,
        code: event.code,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        targetTagName: target?.tagName ?? null,
        isContentEditable: Boolean(target?.isContentEditable),
      });

      if (!triggered) return;

      event.preventDefault();
      if (isOpen) {
        closeMenu(true);
      } else {
        openMenu();
      }
    };

    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, [isOpen]);

  const handleSelectTopic = (topicId: WhatsAppSupportTopicId) => {
    const partnerLabel = profile?.business_name || profile?.full_name || null;
    const message = buildSupportInquiryMessage(topicId, partnerLabel, selectedQuickReplyPhrases);
    closeMenu(false);
    openWhatsAppChat(settings.whatsapp_number, message);
  };

  const handleCopySupportLink = async (option: WhatsAppSupportOption) => {
    const partnerLabel = profile?.business_name || profile?.full_name || null;
    const deepLink = buildSupportDeepLink(
      settings.whatsapp_number,
      option.id,
      partnerLabel,
      selectedQuickReplyPhrases
    );

    let copied = false;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(deepLink);
        copied = true;
      } catch {
        copied = false;
      }
    }

    if (!copied && typeof document !== 'undefined') {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = deepLink;
        textarea.setAttribute('readonly', '');
        textarea.className = 'sr-only';
        document.body.appendChild(textarea);
        textarea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        copied = false;
      }
    }

    if (copied) {
      setCopiedTopicId(option.id);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedTopicId(prev => (prev === option.id ? null : prev));
      }, 2200);
      toastSuccess(`Copied ${option.label} support link to clipboard.`);
    } else {
      toastError('Unable to copy support link automatically.');
    }
  };

  const moveHighlight = (key: 'ArrowDown' | 'ArrowUp' | 'Home' | 'End') => {
    const nextIdx = getNextSupportOptionIndex(activeIndex, key, filteredOptions.length);
    if (nextIdx >= 0) {
      setActiveIndex(nextIdx);
      optionRefs.current[nextIdx]?.focus();
    }
  };

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (filteredOptions.length === 0) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveHighlight(event.key);
      return;
    }

    const isSearchFocused = document.activeElement === searchInputRef.current;

    if (!isSearchFocused && (event.key === 'Home' || event.key === 'End')) {
      event.preventDefault();
      moveHighlight(event.key);
      return;
    }

    if (event.key === 'Enter' && isSearchFocused && activeIndex >= 0) {
      event.preventDefault();
      const targetOption = filteredOptions[activeIndex];
      if (targetOption) {
        handleSelectTopic(targetOption.id);
      }
    }
  };

  const activeOptionId =
    activeIndex >= 0 && filteredOptions[activeIndex]
      ? `whatsapp-option-${filteredOptions[activeIndex].id}`
      : undefined;

  const fabSpringState = getFabSpringState(isOpen, hasInteracted);

  return (
    <div
      ref={containerRef}
      data-testid="floating-whatsapp-container"
      data-theme={theme}
      className={`fixed right-4 sm:right-6 bottom-20 md:bottom-6 z-40 flex flex-col items-end gap-3 ${
        isDark ? 'dark' : ''
      }`}
    >
      {/* Expandable WhatsApp Topic Menu */}
      {isOpen && (
        <div
          id="whatsapp-support-menu"
          role="menu"
          aria-label="WhatsApp support topics"
          onKeyDown={handleMenuKeyDown}
          className="wa-menu-enter w-[calc(100vw-2rem)] max-w-[368px] bg-white dark:bg-[#121614] rounded-2xl border border-slate-200/90 dark:border-emerald-900/55 shadow-2xl shadow-slate-900/15 dark:shadow-black/65 overflow-hidden transition-colors"
        >
          {/* Header with Search Filter */}
          <div className="bg-[#0e3e03] dark:bg-[#072617] text-white dark:text-emerald-50 px-4 pt-3.5 pb-3.5 space-y-3 border-b border-transparent dark:border-emerald-800/45">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-300 dark:text-emerald-400">
                  WhatsApp Direct Desk
                </p>
                <h3 className="text-sm font-bold font-heading text-white dark:text-emerald-50 tracking-[0.01em] mt-0.5">
                  How can our team assist you?
                </h3>
                <p className="text-[11px] text-emerald-100/80 dark:text-emerald-200/75 font-mono mt-0.5">
                  {formatWhatsAppDisplay(settings.whatsapp_number)}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleToggleTheme}
                  aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                  aria-pressed={isDark}
                  title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                  data-testid="whatsapp-theme-toggle"
                  className="p-1.5 rounded-lg text-emerald-100/80 dark:text-emerald-200/80 hover:text-white dark:hover:text-emerald-50 hover:bg-white/10 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => closeMenu(true)}
                  aria-label="Close WhatsApp menu"
                  className="p-1.5 rounded-lg text-emerald-100/80 dark:text-emerald-200/80 hover:text-white dark:hover:text-emerald-50 hover:bg-white/10 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="relative">
              <label htmlFor="whatsapp-support-search" className="sr-only">
                Filter support options
              </label>
              <Search className="w-3.5 h-3.5 text-emerald-200/80 dark:text-emerald-400/75 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                id="whatsapp-support-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search support options..."
                aria-label="Search support options"
                aria-activedescendant={activeOptionId}
                className="w-full rounded-xl bg-white/10 dark:bg-[#0E1714] border border-emerald-400/25 dark:border-emerald-800/60 pl-8.5 pr-8 py-2 text-xs text-white dark:text-emerald-50 placeholder:text-emerald-100/60 dark:placeholder:text-emerald-200/45 focus:bg-white/15 dark:focus:bg-[#111D19] focus:border-emerald-300/60 dark:focus:border-emerald-500/60 focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Clear search filter"
                  className="p-1 rounded-md text-emerald-200/80 dark:text-emerald-300/75 hover:text-white dark:hover:text-emerald-50 hover:bg-white/10 dark:hover:bg-emerald-900/50 absolute right-1.5 top-1/2 -translate-y-1/2 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Body: Topic Options + Quick Reply Templates */}
          <div className="wa-menu-scroll max-h-[calc(100vh-14.5rem)] overflow-y-auto">
            {/* Topic Options */}
            <div className="p-2 divide-y divide-slate-100/80 dark:divide-white/[0.06]">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option, index) => {
                  const meta = TOPIC_META[option.id];
                  const Icon = meta.icon;
                  const isHighlighted = index === activeIndex;
                  const isCopied = copiedTopicId === option.id;
                  return (
                    <div
                      key={option.id}
                      data-stagger-index={index}
                      className={`wa-option-card ${getSupportOptionStaggerClass(index)} flex items-stretch gap-1.5 p-1.5 rounded-xl transition-colors ${
                        isHighlighted
                          ? 'bg-emerald-50/90 dark:bg-[#0C291C] ring-2 ring-[#187004] dark:ring-emerald-500/70 ring-inset'
                          : 'hover:bg-slate-50 dark:hover:bg-[#18211C]'
                      }`}
                    >
                      <button
                        id={`whatsapp-option-${option.id}`}
                        ref={(el) => {
                          optionRefs.current[index] = el;
                        }}
                        type="button"
                        role="menuitem"
                        data-active={isHighlighted ? 'true' : 'false'}
                        onMouseEnter={() => setActiveIndex(index)}
                        onFocus={() => setActiveIndex(index)}
                        onClick={() => handleSelectTopic(option.id)}
                        className="flex-1 min-w-0 flex items-center gap-2.5 p-1.5 rounded-lg text-left group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#187004] dark:focus-visible:ring-emerald-400"
                      >
                        <div
                          className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${meta.badgeClass}`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span
                            className={`block text-sm font-bold font-heading tracking-[0.01em] transition-colors ${
                              isHighlighted
                                ? 'text-[#187004] dark:text-emerald-300'
                                : 'text-slate-900 dark:text-zinc-100 group-hover:text-[#187004] dark:group-hover:text-emerald-300'
                            }`}
                          >
                            {option.label}
                          </span>
                          <span className="block text-xs text-slate-500 dark:text-zinc-400 leading-snug mt-0.5">
                            {option.description}
                          </span>
                        </div>
                        <ChevronRight
                          className={`w-4 h-4 transition-all shrink-0 ${
                            isHighlighted
                              ? 'text-[#187004] dark:text-emerald-300 translate-x-0.5'
                              : 'text-slate-400 dark:text-zinc-500 group-hover:text-[#187004] dark:group-hover:text-emerald-300 group-hover:translate-x-0.5'
                          }`}
                        />
                      </button>

                      <div className="flex items-center border-l border-slate-200/70 dark:border-white/[0.08] pl-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopySupportLink(option)}
                          aria-label={`Copy support link for ${option.label}`}
                          title={`Copy support link for ${option.label}`}
                          data-testid={`copy-support-link-${option.id}`}
                          className={`min-w-[58px] min-h-[44px] px-2 py-1.5 rounded-lg flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#187004] dark:focus-visible:ring-emerald-400 ${
                            isCopied
                              ? 'bg-emerald-100 dark:bg-emerald-950/85 text-[#187004] dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-600/60'
                              : 'bg-white/80 dark:bg-[#181D1A] hover:bg-amber-50 dark:hover:bg-[#1E2622] text-slate-600 dark:text-zinc-300 hover:text-amber-800 dark:hover:text-emerald-200 border border-slate-200/80 dark:border-white/[0.09] hover:border-amber-200 dark:hover:border-emerald-700/50'
                          }`}
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#187004] dark:text-emerald-300" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy link</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-6 px-4 text-center">
                  <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                    No support options match &ldquo;{searchQuery.trim()}&rdquo;
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-400 mt-1">
                    Try keywords like technical, pricing, or billing.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="mt-3 inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold text-[#187004] dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 border border-transparent dark:border-emerald-800/60 transition-colors cursor-pointer"
                  >
                    Reset search
                  </button>
                </div>
              )}
            </div>

            {/* Quick Reply Templates */}
            {filteredOptions.length > 0 && (
              <div
                className="wa-quick-reply-enter px-3.5 py-3 border-t border-slate-100 dark:border-white/[0.07] bg-slate-50/40 dark:bg-[#161B18] space-y-2"
                aria-label="Quick Reply templates"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#F5A623] dark:text-amber-400 shrink-0" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-200">
                      Quick Reply
                    </span>
                    {selectedQuickReplyIds.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-[#187004] dark:text-emerald-300 border border-transparent dark:border-emerald-700/50 text-[10px] font-extrabold tabular-nums">
                        {selectedQuickReplyIds.length}
                      </span>
                    )}
                  </div>
                  {selectedQuickReplyIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedQuickReplyIds([])}
                      className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-100 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5" data-testid="quick-reply-list">
                  {quickReplyTemplates.map(template => {
                    const isSelected = selectedQuickReplyIds.includes(template.id);
                    const isSuggested = Boolean(template.isSuggested);
                    return (
                      <button
                        key={template.id}
                        type="button"
                        aria-pressed={isSelected}
                        data-template-id={template.id}
                        data-suggested={isSuggested ? 'true' : undefined}
                        title={template.phrase}
                        onClick={() =>
                          setSelectedQuickReplyIds(prev =>
                            toggleQuickReplySelection(prev, template.id)
                          )
                        }
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#187004] dark:focus-visible:ring-emerald-400 ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-[#0C2D1F] text-[#187004] dark:text-emerald-200 border-[#187004]/50 dark:border-emerald-500/60 ring-1 ring-[#187004]/20 dark:ring-emerald-500/30'
                            : isSuggested
                              ? 'bg-amber-50/90 dark:bg-amber-950/45 text-amber-900 dark:text-amber-200 border-amber-300/90 dark:border-amber-700/55 hover:bg-amber-100/80 dark:hover:bg-amber-950/75 hover:border-amber-400 dark:hover:border-amber-600/70'
                              : 'bg-white dark:bg-[#1D2320] text-slate-600 dark:text-zinc-300 border-slate-200/90 dark:border-white/[0.09] hover:bg-slate-50 dark:hover:bg-[#232B27] hover:border-slate-300 dark:hover:border-emerald-700/45 hover:text-slate-900 dark:hover:text-zinc-100'
                        }`}
                      >
                        {isSelected ? (
                          <Check className="w-3 h-3 text-[#187004] dark:text-emerald-300 shrink-0" />
                        ) : isSuggested ? (
                          <Sparkles className="w-3 h-3 text-[#F5A623] dark:text-amber-400 shrink-0" />
                        ) : null}
                        <span>{template.label}</span>
                        {isSuggested && (
                          <span className="ml-0.5 px-1 py-0.5 rounded bg-amber-200/70 dark:bg-amber-900/65 text-amber-950 dark:text-amber-200 text-[9px] font-extrabold uppercase tracking-wider">
                            Support Status
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {selectedQuickReplyPhrases.length > 0 && (
                  <div
                    data-testid="quick-reply-preview"
                    className="p-2 rounded-lg bg-amber-50/80 dark:bg-[#0B2218] border border-amber-200/80 dark:border-emerald-800/55 text-[11px] text-amber-950 dark:text-zinc-200 leading-snug"
                  >
                    <span className="font-bold text-amber-800 dark:text-emerald-300">
                      Appended phrase:{' '}
                    </span>
                    <span>{selectedQuickReplyPhrases.join(' ')}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {filteredOptions.length > 0 && (
            <div className="px-4 py-2 bg-slate-50/80 dark:bg-[#0E1210] border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-[10px] text-slate-500 dark:text-zinc-400 font-medium">
              <span>↑↓ Navigate options</span>
              <span>Enter Select · Esc Close</span>
            </div>
          )}
        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        ref={toggleButtonRef}
        type="button"
        onClick={() => (isOpen ? closeMenu(false) : openMenu())}
        aria-expanded={isOpen}
        aria-controls="whatsapp-support-menu"
        aria-haspopup="menu"
        aria-keyshortcuts="Shift+/"
        data-state={isOpen ? 'open' : 'closed'}
        data-spring-state={fabSpringState}
        title={isOpen ? 'Close WhatsApp support menu (Esc)' : 'Open WhatsApp support menu (Shift + /)'}
        aria-label={isOpen ? 'Close WhatsApp support menu' : 'Open WhatsApp support options'}
        className={`wa-fab-spring group relative flex items-center gap-2.5 px-4 py-3 text-white dark:text-emerald-50 font-bold rounded-full shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#25D366] dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-[#121614] cursor-pointer ${
          fabSpringState === 'opening'
            ? 'wa-fab-spring-open'
            : fabSpringState === 'closing'
              ? 'wa-fab-spring-close'
              : ''
        } ${
          isOpen
            ? 'bg-[#0e3e03] hover:bg-[#135903] dark:bg-[#171E1B] dark:hover:bg-[#1E2723] dark:border dark:border-emerald-700/55 shadow-slate-900/25 dark:shadow-black/60'
            : 'bg-[#25D366] hover:bg-[#1EBE5D] dark:bg-[#0D3B26] dark:hover:bg-[#114B30] dark:border dark:border-emerald-500/40 shadow-green-900/20 dark:shadow-black/50 hover:shadow-xl'
        }`}
      >
        {isOpen ? (
          <span key="open" className="wa-fab-content-enter inline-flex items-center gap-2.5">
            <X className="w-5 h-5" />
            <span className="text-sm font-semibold tracking-wide">Close Menu</span>
          </span>
        ) : (
          <span key="closed" className="wa-fab-content-enter inline-flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white dark:bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white dark:bg-emerald-300" />
            </span>
            <MessageSquareText className="w-5 h-5 fill-white/20 dark:fill-emerald-400/20" />
            <span className="text-sm font-semibold tracking-wide">WhatsApp Support</span>
            <kbd
              aria-hidden="true"
              className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md bg-black/15 dark:bg-black/35 text-[10px] font-mono font-bold text-white/95 dark:text-emerald-200/90"
            >
              Shift+/
            </kbd>
          </span>
        )}
      </button>
    </div>
  );
}

