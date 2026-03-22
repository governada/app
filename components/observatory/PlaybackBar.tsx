'use client';

/**
 * PlaybackBar — epoch timeline scrubber shared across all Observatory panels.
 *
 * Shows current epoch, play/pause, speed control, scrubber, and "Live" indicator.
 * The playback bar is the unifying interaction that makes the Observatory feel alive.
 */

import { useCallback, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Play, Pause, RotateCcw, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlaybackState, PlaybackSpeed } from '@/lib/observatory/types';

interface PlaybackBarProps {
  state: PlaybackState;
  onTogglePlay: () => void;
  onSeek: (position: number) => void;
  onSetSpeed: (speed: PlaybackSpeed) => void;
  onGoLive: () => void;
  className?: string;
}

const SPEED_OPTIONS: PlaybackSpeed[] = [0.5, 1, 2, 4];

export function PlaybackBar({
  state,
  onTogglePlay,
  onSeek,
  onSetSpeed,
  onGoLive,
  className,
}: PlaybackBarProps) {
  const prefersReducedMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);

  const handleTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const position = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      onSeek(position);
    },
    [onSeek],
  );

  const handleTrackDrag = useCallback(
    (_e: React.PointerEvent<HTMLDivElement>) => {
      const track = trackRef.current;
      if (!track) return;

      const move = (ev: PointerEvent) => {
        const rect = track.getBoundingClientRect();
        const position = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
        onSeek(position);
      };

      const up = () => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
      };

      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    },
    [onSeek],
  );

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-2 bg-card/80 backdrop-blur-xl border-b border-border/20 rounded-t-xl',
        className,
      )}
    >
      {/* Play/Pause */}
      <button
        onClick={onTogglePlay}
        className="shrink-0 w-8 h-8 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
        aria-label={state.isPlaying ? 'Pause' : 'Play'}
      >
        {state.isPlaying ? (
          <Pause className="w-3.5 h-3.5 text-primary" />
        ) : state.position >= 1 ? (
          <RotateCcw className="w-3.5 h-3.5 text-primary" />
        ) : (
          <Play className="w-3.5 h-3.5 text-primary ml-0.5" />
        )}
      </button>

      {/* Epoch label */}
      <span className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
        Epoch {state.epoch}
      </span>

      {/* Scrubber track */}
      <div
        ref={trackRef}
        className="flex-1 h-8 flex items-center cursor-pointer group"
        onClick={handleTrackClick}
        onPointerDown={handleTrackDrag}
        role="slider"
        aria-label="Epoch timeline"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(state.position * 100)}
      >
        <div className="w-full h-1 bg-border/30 rounded-full relative overflow-hidden">
          {/* Filled portion */}
          <motion.div
            className="absolute inset-y-0 left-0 bg-primary/60 rounded-full"
            style={{ width: `${state.position * 100}%` }}
            animate={prefersReducedMotion ? undefined : { width: `${state.position * 100}%` }}
            transition={{ duration: 0.05 }}
          />
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary shadow-sm shadow-primary/30 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${state.position * 100}% - 6px)` }}
          />
        </div>
      </div>

      {/* Speed selector */}
      <div className="shrink-0 flex items-center gap-0.5">
        {SPEED_OPTIONS.map((speed) => (
          <button
            key={speed}
            onClick={() => onSetSpeed(speed)}
            className={cn(
              'px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors',
              state.speed === speed
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground/50 hover:text-muted-foreground',
            )}
          >
            {speed}x
          </button>
        ))}
      </div>

      {/* Live indicator */}
      <button
        onClick={onGoLive}
        className={cn(
          'shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-colors',
          state.isLive
            ? 'bg-emerald-500/15 text-emerald-500'
            : 'bg-muted/50 text-muted-foreground hover:text-foreground',
        )}
      >
        <Radio
          className={cn('w-2.5 h-2.5', state.isLive && !prefersReducedMotion && 'animate-pulse')}
        />
        Live
      </button>
    </div>
  );
}
