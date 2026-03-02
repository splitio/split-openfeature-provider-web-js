/* eslint-disable @typescript-eslint/no-unused-vars */
import { FlagNotFoundError, StandardResolutionReasons } from '@openfeature/web-sdk';
import { evaluateTreatment } from '../lib/evaluation';
import { CONTROL_TREATMENT } from '../lib/types';

describe('evaluation', () => {
  describe('evaluateTreatment', () => {
    let mockClient;

    beforeEach(() => {
      mockClient = {
        getTreatmentWithConfig: jest.fn((flagKey, attributes) => ({
          treatment: 'v1',
          config: '{"x":1}',
        })),
      };
    });

    test('returns resolution details with value, variant, flagMetadata, reason', () => {
      const consumer = { targetingKey: 'u1', trafficType: 'user', attributes: {} };
      const result = evaluateTreatment(mockClient, 'my-flag', consumer);

      expect(result.value).toBe('v1');
      expect(result.variant).toBe('v1');
      expect(result.flagMetadata).toEqual({ config: '{"x":1}' });
      expect(result.reason).toBe(StandardResolutionReasons.TARGETING_MATCH);
      expect(mockClient.getTreatmentWithConfig).toHaveBeenCalledWith('my-flag', {});
    });

    test('calls getTreatmentWithConfig with consumer attributes', () => {
      const consumer = {
        targetingKey: 'u1',
        trafficType: 'account',
        attributes: { region: 'eu', plan: 'pro' },
      };
      evaluateTreatment(mockClient, 'flag', consumer);
      expect(mockClient.getTreatmentWithConfig).toHaveBeenCalledWith('flag', {
        region: 'eu',
        plan: 'pro',
      });
    });

    test('uses empty string for config when config is falsy', () => {
      mockClient.getTreatmentWithConfig.mockReturnValue({ treatment: 'on', config: null });
      const result = evaluateTreatment(mockClient, 'f', {
        targetingKey: undefined,
        trafficType: 'user',
        attributes: {},
      });
      expect(result.flagMetadata.config).toBe('');
    });

    test('throws FlagNotFoundError when flagKey is null', () => {
      const consumer = { targetingKey: 'u1', trafficType: 'user', attributes: {} };
      expect(() => evaluateTreatment(mockClient, null, consumer)).toThrow(FlagNotFoundError);
      expect(() => evaluateTreatment(mockClient, null, consumer)).toThrow(
        /flagKey must be a non-empty string/
      );
    });

    test('throws FlagNotFoundError when flagKey is empty string', () => {
      const consumer = { targetingKey: 'u1', trafficType: 'user', attributes: {} };
      expect(() => evaluateTreatment(mockClient, '', consumer)).toThrow(FlagNotFoundError);
    });

    test('throws FlagNotFoundError when treatment is control', () => {
      mockClient.getTreatmentWithConfig.mockReturnValue({
        treatment: CONTROL_TREATMENT,
        config: '',
      });
      const consumer = { targetingKey: 'u1', trafficType: 'user', attributes: {} };
      expect(() => evaluateTreatment(mockClient, 'flag', consumer)).toThrow(FlagNotFoundError);
      expect(() => evaluateTreatment(mockClient, 'flag', consumer)).toThrow(/control/);
    });
  });
});
