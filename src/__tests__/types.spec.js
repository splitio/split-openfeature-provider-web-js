/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  CONTROL_TREATMENT,
  CONTROL_VALUE_ERROR_MESSAGE,
} from '../lib/types';

describe('types', () => {
  test('CONTROL_TREATMENT is "control"', () => {
    expect(CONTROL_TREATMENT).toBe('control');
  });

  test('CONTROL_VALUE_ERROR_MESSAGE mentions control', () => {
    expect(CONTROL_VALUE_ERROR_MESSAGE).toContain('control');
    expect(CONTROL_VALUE_ERROR_MESSAGE).toBe("Received the 'control' value from Split.");
  });
});
