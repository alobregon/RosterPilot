import type { DraftStrategy } from './types';

/**
 * Current validation-preset opening preference for the user's league.
 * Slots 1-2 start Hero RB so an elite anchor RB can be taken first; other
 * slots start Balanced. The live strategy selector can override this at any time.
 */
export function defaultStrategyForDraftSlot(draftSlot: number): DraftStrategy {
  return draftSlot <= 2 ? 'HERO_RB' : 'BALANCED';
}

/**
 * Follow automatic slot defaults only while the current strategy still matches
 * the previous slot's default. Explicit user-selected strategies are preserved.
 */
export function strategyAfterSlotChange(
  currentStrategy: DraftStrategy | undefined,
  previousSlot: number,
  nextSlot: number,
): DraftStrategy {
  const previousDefault = defaultStrategyForDraftSlot(previousSlot);
  if (currentStrategy == null || currentStrategy === previousDefault) {
    return defaultStrategyForDraftSlot(nextSlot);
  }
  return currentStrategy;
}
