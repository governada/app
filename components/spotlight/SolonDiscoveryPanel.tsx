'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Send, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fadeInUp } from '@/lib/animations';
import { useAdvisor } from '@/hooks/useAdvisor';
import { SolonSuggestedPrompts } from './SolonSuggestedPrompts';
import type { SpotlightEntityType } from './types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface SolonDiscoveryPanelProps {
  entityType: SpotlightEntityType;
  entityCount: number;
  /** Called when Solon wants to curate the spotlight queue */
  onQueryResults?: (query: string) => void;
}

// ─── Entity Labels ────────────────────────────────────────────────────────────

const ENTITY_LABELS: Record<SpotlightEntityType, string> = {
  drep: 'representatives',
  spo: 'stake pools',
  proposal: 'proposals',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function SolonDiscoveryPanel({
  entityType,
  entityCount,
  onQueryResults,
}: SolonDiscoveryPanelProps) {
  const reducedMotion = useReducedMotion();
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, isStreaming, error, clearMessages } = useAdvisor({
    pageContext: `spotlight_discovery_${entityType}`,
  });

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || isStreaming) return;

    sendMessage(trimmed);
    setInputValue('');
    setIsExpanded(true);
    onQueryResults?.(trimmed);
  }, [inputValue, isStreaming, sendMessage, onQueryResults]);

  const handlePromptSelect = useCallback(
    (prompt: string) => {
      sendMessage(prompt);
      setIsExpanded(true);
      onQueryResults?.(prompt);
    },
    [sendMessage, onQueryResults],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleClear = useCallback(() => {
    clearMessages();
    setIsExpanded(false);
  }, [clearMessages]);

  const hasMessages = messages.length > 0;

  return (
    <motion.div
      className="overflow-hidden rounded-xl border border-primary/10 bg-card/40 backdrop-blur-md"
      variants={reducedMotion ? undefined : fadeInUp}
      initial={reducedMotion ? undefined : 'hidden'}
      animate="visible"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Solon avatar */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          S
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">
            Cardano has{' '}
            <span className="tabular-nums font-medium text-foreground">{entityCount}</span> active{' '}
            {ENTITY_LABELS[entityType]}.{' '}
            <span className="text-primary/80">What matters to you in governance?</span>
          </p>
        </div>

        {hasMessages && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Suggested prompts (only when no messages) */}
      {!hasMessages && (
        <div className="border-t border-border/10 px-4 py-3">
          <SolonSuggestedPrompts entityType={entityType} onSelect={handlePromptSelect} />
        </div>
      )}

      {/* Messages (expandable) */}
      <AnimatePresence>
        {isExpanded && hasMessages && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="max-h-60 space-y-3 overflow-y-auto border-t border-border/10 px-4 py-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    'text-sm',
                    msg.role === 'user' ? 'text-right text-primary/90' : 'text-muted-foreground',
                  )}
                >
                  {msg.role === 'user' ? (
                    <span className="inline-block rounded-lg bg-primary/10 px-3 py-1.5">
                      {msg.content}
                    </span>
                  ) : (
                    <span>
                      {msg.content}
                      {isStreaming && i === messages.length - 1 && (
                        <span className="ml-1 inline-flex gap-0.5">
                          <span className="animate-pulse">·</span>
                          <span className="animate-pulse" style={{ animationDelay: '0.15s' }}>
                            ·
                          </span>
                          <span className="animate-pulse" style={{ animationDelay: '0.3s' }}>
                            ·
                          </span>
                        </span>
                      )}
                    </span>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Clear button */}
            <div className="flex justify-end border-t border-border/10 px-4 py-2">
              <button
                onClick={handleClear}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="flex items-center gap-2 border-t border-border/10 px-4 py-2.5">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Ask about ${ENTITY_LABELS[entityType]}...`}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          disabled={isStreaming}
        />
        <button
          onClick={handleSend}
          disabled={!inputValue.trim() || isStreaming}
          className="shrink-0 rounded-lg bg-primary/10 p-2 text-primary transition-colors hover:bg-primary/20 disabled:opacity-30"
        >
          {isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="border-t border-red-500/20 bg-red-500/5 px-4 py-2 text-xs text-red-400">
          {error}
        </div>
      )}
    </motion.div>
  );
}
