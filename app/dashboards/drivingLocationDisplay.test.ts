import { describe, expect, it } from 'vitest';
import {
  DRIVING_LOCATION_REFERENCE_ADDRESS,
  packAddressSegmentsIntoLines,
} from './drivingLocationDisplay';

describe('driving location column width', () => {
  /** Geist text-xs at max-w-[20rem] fits ~47 characters per line. */
  const maxCharsPerLineAt20Rem = 47;

  it('fits the reference address in at most three lines', () => {
    const lines = packAddressSegmentsIntoLines(
      DRIVING_LOCATION_REFERENCE_ADDRESS,
      maxCharsPerLineAt20Rem,
    );
    expect(lines).toHaveLength(3);
    expect(lines[2]).toBe('Chang Wat Prachuap Khiri Khan,Thailand,77000');
  });
});
