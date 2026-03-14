'use client';

import { useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { usePassport } from '@/hooks/usePassport';
import { GetStartedLayout } from '@/components/get-started/GetStartedLayout';
import { StageDiscover } from '@/components/get-started/StageDiscover';
import { StagePrepare } from '@/components/get-started/StagePrepare';
import { StageConnect } from '@/components/get-started/StageConnect';
import { StageDelegate } from '@/components/get-started/StageDelegate';
import type { GovernancePassport } from '@/lib/passport';

export default function GetStartedPage() {
  const { passport, loaded, update } = usePassport();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Handle ?stage= query param for deep-linking (e.g., from match results)
  useEffect(() => {
    if (!loaded || !passport) return;
    const stageParam = searchParams.get('stage');
    if (stageParam) {
      const stage = parseInt(stageParam, 10) as 1 | 2 | 3 | 4;
      if ([1, 2, 3, 4].includes(stage) && stage !== passport.stage) {
        // Only allow jumping to a stage the user has reached or earlier
        const currentNum = passport.stage === 'complete' ? 5 : passport.stage;
        if (stage <= currentNum) {
          update({ stage });
        }
      }
    }
  }, [loaded, passport, searchParams, update]);

  // Handle "exploring" exit — redirect to /governance
  const handlePrepareComplete = useCallback(
    (walletPath: GovernancePassport['walletPath']) => {
      if (walletPath === 'exploring') {
        update({ walletPath, walletReady: false });
        router.push('/governance');
        return;
      }
      update({
        stage: 3,
        walletPath,
        walletReady: true,
      });
    },
    [update, router],
  );

  const handleDiscoverComplete = useCallback(
    (data: {
      alignment: GovernancePassport['alignment'];
      matchedDrepId?: string;
      matchedDrepName?: string;
      matchScore?: number;
    }) => {
      update({
        stage: 2,
        alignment: data.alignment,
        matchedDrepId: data.matchedDrepId,
        matchedDrepName: data.matchedDrepName,
        matchScore: data.matchScore,
      });
    },
    [update],
  );

  const handleConnectComplete = useCallback(() => {
    update({
      stage: 4,
      connectedAt: new Date().toISOString(),
    });
  }, [update]);

  const handleDelegateComplete = useCallback(() => {
    update({
      stage: 'complete',
      delegatedAt: new Date().toISOString(),
    });
  }, [update]);

  const handleStageClick = useCallback(
    (stage: 1 | 2 | 3 | 4) => {
      update({ stage });
    },
    [update],
  );

  // Loading state
  if (!loaded || !passport) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const currentStage = passport.stage;

  return (
    <GetStartedLayout passport={passport} onStageClick={handleStageClick}>
      {currentStage === 1 && (
        <StageDiscover passport={passport} onComplete={handleDiscoverComplete} />
      )}
      {currentStage === 2 && (
        <StagePrepare passport={passport} onComplete={handlePrepareComplete} />
      )}
      {currentStage === 3 && (
        <StageConnect
          passport={passport}
          onComplete={handleConnectComplete}
          onGoBack={() => update({ stage: 2 })}
        />
      )}
      {(currentStage === 4 || currentStage === 'complete') && (
        <StageDelegate passport={passport} onComplete={handleDelegateComplete} />
      )}
    </GetStartedLayout>
  );
}
