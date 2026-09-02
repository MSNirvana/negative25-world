import { describe, expect, it } from 'vitest';
import { reconcileExpandedBatchKeys } from './admin-photo-batch-expansion';

describe('reconcileExpandedBatchKeys', () => {
  it('expands only the first batch when there is no existing state', () => {
    expect([...reconcileExpandedBatchKeys(new Set(), [{ key: 'first' }, { key: 'second' }])]).toEqual(['first']);
  });

  it('preserves visible user choices and drops batches removed by filtering', () => {
    expect([...reconcileExpandedBatchKeys(new Set(['second', 'missing']), [{ key: 'first' }, { key: 'second' }])]).toEqual(['second']);
  });

  it('opens the first remaining batch when filtering hides every expanded batch', () => {
    expect([...reconcileExpandedBatchKeys(new Set(['missing']), [{ key: 'first' }, { key: 'second' }])]).toEqual(['first']);
  });
});
