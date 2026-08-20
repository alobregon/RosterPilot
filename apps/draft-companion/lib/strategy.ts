import type { DraftStrategy } from './types';

/**
 * Current validation-preset opening preference for the user's league.
 * Slots 1-2 start Hero RB so an elite anchor RB can be taken first; other
 * slots start Balanced. The live strategy selector can override this at any time.
 */
export function defaultStrategyForDraftSlot(draftSlot: number): DraftStrategy {
  return draftSlot <= 2 ? 'HERO_RB' : 'BALANCED';
}
