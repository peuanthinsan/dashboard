import { describe, expect, it } from 'vitest';
import {
  getMultiSelectTriggerText,
  getNextMultiSelectSelection,
} from './MultiSelect';

describe('getNextMultiSelectSelection', () => {
  it('keeps a sole option explicitly selected', () => {
    expect(getNextMultiSelectSelection([], '00-0055')).toEqual(['00-0055']);
  });

  it('clears a sole option when it is toggled off', () => {
    expect(getNextMultiSelectSelection(['00-0055'], '00-0055')).toEqual([]);
  });

  it('keeps every explicitly selected option checked', () => {
    expect(getNextMultiSelectSelection(['00-0055'], '00-0099')).toEqual(['00-0055', '00-0099']);
  });

  it('removes only the option that was toggled off', () => {
    expect(getNextMultiSelectSelection(['00-0055', '00-0099'], '00-0055')).toEqual(['00-0099']);
  });
});

describe('getMultiSelectTriggerText', () => {
  it('names a single selected option', () => {
    expect(getMultiSelectTriggerText(['00-0055'], 'vehicles', 'All vehicles')).toBe('00-0055');
  });

  it('keeps the all and multi-selection summaries', () => {
    expect(getMultiSelectTriggerText([], 'vehicles', 'All vehicles')).toBe('All vehicles');
    expect(getMultiSelectTriggerText(['00-0055', '00-0099'], 'vehicles', 'All vehicles')).toBe('2 vehicles');
  });
});
