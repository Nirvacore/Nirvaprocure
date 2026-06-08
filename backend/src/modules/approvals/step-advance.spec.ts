import { advanceStep } from './step-advance';

describe('advanceStep', () => {
  it('rejection short-circuits even when more steps exist', () => {
    expect(advanceStep({ decision: 'rejected', currentStep: 1, nextStepNo: 2 }))
      .toEqual({ kind: 'rejected' });
  });

  it('approval at the final step finalizes the instance', () => {
    expect(advanceStep({ decision: 'approved', currentStep: 3, nextStepNo: null }))
      .toEqual({ kind: 'approved' });
  });

  it('approval mid-flow advances to the next step', () => {
    expect(advanceStep({ decision: 'approved', currentStep: 1, nextStepNo: 2 }))
      .toEqual({ kind: 'advance', nextStep: 2 });
  });

  it('respects sparse step numbering (e.g. 1, 3, 7)', () => {
    expect(advanceStep({ decision: 'approved', currentStep: 1, nextStepNo: 3 }))
      .toEqual({ kind: 'advance', nextStep: 3 });
    expect(advanceStep({ decision: 'approved', currentStep: 3, nextStepNo: 7 }))
      .toEqual({ kind: 'advance', nextStep: 7 });
  });
});
