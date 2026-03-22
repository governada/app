'use client';

/**
 * usePlayback — shared playback engine for the Observatory.
 *
 * Manages epoch timeline position, play/pause, speed, and compare mode.
 * All three instrument panels subscribe to this state and animate accordingly.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { PlaybackState, PlaybackSpeed } from './types';

const DEFAULT_PLAYBACK_DURATION_MS = 30_000; // 30s per epoch at 1x

interface UsePlaybackOptions {
  /** Current epoch number */
  currentEpoch: number;
  /** Callback when playback position changes (0-1) */
  onPositionChange?: (position: number) => void;
}

export function usePlayback({ currentEpoch, onPositionChange }: UsePlaybackOptions) {
  const [state, setState] = useState<PlaybackState>({
    epoch: currentEpoch,
    position: 1, // Start at "now" (end of epoch)
    isPlaying: false,
    speed: 1,
    isLive: true,
    compareEpoch: null,
  });

  const rafRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);

  // Animation loop
  useEffect(() => {
    if (!state.isPlaying) return;

    const durationMs = DEFAULT_PLAYBACK_DURATION_MS / state.speed;

    const tick = (now: number) => {
      if (!lastTickRef.current) lastTickRef.current = now;
      const elapsed = now - lastTickRef.current;
      const delta = elapsed / durationMs;

      setState((prev) => {
        const newPosition = Math.min(prev.position + delta, 1);
        const done = newPosition >= 1;
        onPositionChange?.(newPosition);
        return {
          ...prev,
          position: done ? 1 : newPosition,
          isPlaying: !done,
          isLive: done && prev.epoch === currentEpoch,
        };
      });

      lastTickRef.current = now;
      if (!rafRef.current) return; // Cancelled
      rafRef.current = requestAnimationFrame(tick);
    };

    lastTickRef.current = 0;
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [state.isPlaying, state.speed, currentEpoch, onPositionChange]);

  const play = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isPlaying: true,
      // If at end, restart from beginning
      position: prev.position >= 1 ? 0 : prev.position,
      isLive: false,
    }));
  }, []);

  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: false }));
  }, []);

  const togglePlay = useCallback(() => {
    setState((prev) => {
      if (prev.isPlaying) return { ...prev, isPlaying: false };
      return {
        ...prev,
        isPlaying: true,
        position: prev.position >= 1 ? 0 : prev.position,
        isLive: false,
      };
    });
  }, []);

  const seek = useCallback(
    (position: number) => {
      const clamped = Math.max(0, Math.min(1, position));
      setState((prev) => ({
        ...prev,
        position: clamped,
        isLive: clamped >= 1 && prev.epoch === currentEpoch,
      }));
      onPositionChange?.(clamped);
    },
    [currentEpoch, onPositionChange],
  );

  const setSpeed = useCallback((speed: PlaybackSpeed) => {
    setState((prev) => ({ ...prev, speed }));
  }, []);

  const setEpoch = useCallback(
    (epoch: number) => {
      setState((prev) => ({
        ...prev,
        epoch,
        position: epoch === currentEpoch ? 1 : 0,
        isPlaying: false,
        isLive: epoch === currentEpoch,
      }));
    },
    [currentEpoch],
  );

  const goLive = useCallback(() => {
    setState({
      epoch: currentEpoch,
      position: 1,
      isPlaying: false,
      speed: state.speed,
      isLive: true,
      compareEpoch: null,
    });
  }, [currentEpoch, state.speed]);

  const setCompareEpoch = useCallback((epoch: number | null) => {
    setState((prev) => ({ ...prev, compareEpoch: epoch }));
  }, []);

  return {
    state,
    play,
    pause,
    togglePlay,
    seek,
    setSpeed,
    setEpoch,
    goLive,
    setCompareEpoch,
  };
}
