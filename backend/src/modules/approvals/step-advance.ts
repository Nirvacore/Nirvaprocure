/**
 * Decides what an approval instance transitions to given the current step
 * and the decision the approver just made.
 *
 * Extracted from ApprovalsService so the branch logic is unit-testable
 * without a DB. Inputs are pure data; outputs describe the side effects
 * the service should perform.
 */
export type StepAdvanceOutcome =
  | { kind: 'advance';  nextStep: number }
  | { kind: 'approved' }
  | { kind: 'rejected' };

export function advanceStep(opts: {
  decision: 'approved' | 'rejected';
  currentStep: number;
  /** Lowest step_no greater than current, or null if there isn't one. */
  nextStepNo: number | null;
}): StepAdvanceOutcome {
  if (opts.decision === 'rejected') return { kind: 'rejected' };
  if (opts.nextStepNo == null)      return { kind: 'approved' };
  return { kind: 'advance', nextStep: opts.nextStepNo };
}
