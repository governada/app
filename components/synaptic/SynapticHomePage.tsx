'use client';

/**
 * SynapticHomePage — The Synaptic Brief authenticated homepage.
 *
 * Full-viewport volumetric constellation with a Seneca briefing panel.
 * Globe is non-interactive (Seneca controls camera). The briefing panel
 * auto-streams a personalized governance narrative on arrival, with
 * entity mentions triggering globe reactions (node pulses, camera drift).
 */

import { useRef, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { useUserConstellationNode } from '@/hooks/useUserConstellationNode';
import { useConstellationProposals } from '@/hooks/useConstellationProposals';
import { useSenecaGlobeBridge, type GlobeCommand } from '@/hooks/useSenecaGlobeBridge';
import type { GlobeStreamCommand } from '@/lib/intelligence/streamAdvisor';
import type { ConstellationRef } from '@/components/GovernanceConstellation';
import type { ConstellationNode3D } from '@/lib/constellation/types';
import { SynapticBriefPanel } from './SynapticBriefPanel';

const ConstellationScene = dynamic(
  () => import('@/components/ConstellationScene').then((m) => ({ default: m.ConstellationScene })),
  { ssr: false },
);

const GlobeTooltip = dynamic(
  () => import('@/components/governada/GlobeTooltip').then((m) => ({ default: m.GlobeTooltip })),
  { ssr: false },
);

export function SynapticHomePage() {
  const globeRef = useRef<ConstellationRef>(null);
  const bridge = useSenecaGlobeBridge(globeRef);

  // Globe data
  const { userNode, delegationBond } = useUserConstellationNode();
  const { proposalNodes } = useConstellationProposals();

  // Tooltip state
  const [hoveredNode, setHoveredNode] = useState<ConstellationNode3D | null>(null);
  const [hoverScreenPos, setHoverScreenPos] = useState<{ x: number; y: number } | null>(null);

  // -------------------------------------------------------------------------
  // Globe command handler — bridge stream commands to globe imperative API
  // -------------------------------------------------------------------------
  const handleGlobeCommand = useCallback(
    (command: GlobeStreamCommand) => {
      if (!command.cmd) return;

      // Map stream command format to bridge command format
      const bridgeCmd: GlobeCommand =
        command.cmd === 'flyTo' && command.target
          ? { type: 'flyTo', nodeId: command.target }
          : command.cmd === 'pulse' && command.target
            ? { type: 'pulse', nodeId: command.target }
            : command.cmd === 'highlight' && command.alignment
              ? {
                  type: 'highlight',
                  alignment: command.alignment,
                  threshold: command.threshold ?? 120,
                }
              : command.cmd === 'reset'
                ? { type: 'reset' }
                : { type: 'clear' };

      bridge.executeGlobeCommand(bridgeCmd);
    },
    [bridge],
  );

  // -------------------------------------------------------------------------
  // Hover handlers (globe tooltips)
  // -------------------------------------------------------------------------
  const handleNodeHover = useCallback((node: ConstellationNode3D | null) => {
    setHoveredNode(node);
  }, []);

  const handleNodeHoverScreen = useCallback(
    (node: ConstellationNode3D | null, pos: { x: number; y: number } | null) => {
      setHoveredNode(node);
      setHoverScreenPos(pos);
    },
    [],
  );

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden" style={{ background: '#0a0b14' }}>
      {/* Full-viewport globe — non-interactive, Seneca-controlled */}
      <ConstellationScene
        ref={globeRef}
        interactive={false}
        breathing
        className="h-full"
        userNode={userNode}
        proposalNodes={proposalNodes}
        delegationBond={delegationBond}
        onNodeHover={handleNodeHover}
        onNodeHoverScreen={handleNodeHoverScreen}
      />

      {/* Cursor-following tooltip */}
      <GlobeTooltip node={hoveredNode} screenPos={hoverScreenPos} />

      {/* Seneca briefing panel — bottom-left */}
      <SynapticBriefPanel onGlobeCommand={handleGlobeCommand} />
    </div>
  );
}
