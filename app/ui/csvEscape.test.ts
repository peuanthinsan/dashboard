import { describe, it, expect } from 'vitest';
import { escapeCsvField } from './csvEscape';

describe('escapeCsvField', () => {
  it('wraps fields containing carriage return in quotes', () => {
    expect(escapeCsvField('a\rb')).toBe('"a\rb"');
  });

  it('prefixes leading equals with tab to reduce spreadsheet formula injection', () => {
    expect(escapeCsvField('=1+1')).toBe('\t=1+1');
  });

  it('prefixes leading plus, minus, and at-sign', () => {
    expect(escapeCsvField('+123')).toBe('\t+123');
    expect(escapeCsvField('-42')).toBe('\t-42');
    expect(escapeCsvField('@ref')).toBe('\t@ref');
  });

  it('quotes comma-containing fields and escapes embedded double quotes', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it('applies formula guard before quoting when both apply', () => {
    expect(escapeCsvField('=a,b')).toBe('"\t=a,b"');
  });
});
