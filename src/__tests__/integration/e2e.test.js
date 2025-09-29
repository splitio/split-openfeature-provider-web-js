import { OpenFeature, ProviderEvents } from '@openfeature/web-sdk';
import { SplitFactory } from '@splitsoftware/splitio-browserjs';
import fetchMock from 'jest-fetch-mock';

import { OpenFeatureSplitProvider } from '../../lib/js-split-provider';

import splitChangesMock1 from '../mocks/splitchanges.since.-1.json';
import membershipsEmmanuel from '../mocks/memberships.emmanuel@split.io.json'
import membershipsEmiliano from '../mocks/memberships.emiliano@split.io.json'
import membershipsNicolas from '../mocks/memberships.nicolas@split.io.json'

// This is an end-to-end integration test that uses real clients (no mocks)
describe('OpenFeature Split Provider - E2E Integration Tests', () => {
  let client;

  // Set up before all tests
  beforeAll(async () => {
    fetchMock.enableMocks();   
    fetchMock.mockIf(() => true, async req => {
      if (req.url.includes('/splitChanges')) return { status: 200, body: JSON.stringify(splitChangesMock1) }
      if (req.url.includes('/memberships/emmanuel')) return { status: 200, body: JSON.stringify(membershipsEmmanuel) }
      if (req.url.includes('/memberships/emiliano')) return { status: 200, body: JSON.stringify(membershipsEmiliano) }
      if (req.url.includes('/memberships/nicolas')) return { status: 200, body: JSON.stringify(membershipsNicolas) }
      if (req.url.includes('/testImpressions')) return { status: 200 }
    });

    const config = {
      core: {
        authorizationKey: 'key',
        key:'emmanuel@split.io'
      },
      urls: {
        sdk: 'https://sdk.baseurl/readinessSuite1',
        events: 'https://events.baseurl/readinessSuite1'
      }
    }

    const splitFactory = SplitFactory(config);
    const provider = new OpenFeatureSplitProvider(splitFactory);
    await OpenFeature.setProviderAndWait(provider);

    client = OpenFeature.getClient('integration-test');
  })

  // Clean up after all tests
  afterAll(async () => {
    await OpenFeature.close()
  });

  describe('Readiness events', () => {
    test('should emit openfeature client ready', async () => {
      await new Promise((resolve) => {
        client.addHandler(ProviderEvents.Ready, (eventDetails) => {
          expect(eventDetails).toEqual({ clientName: 'integration-test', domain: 'integration-test', providerName: 'split' })
          resolve();
        });
      });
    })
  })

  describe('Boolean evaluations', () => {

    test('should correctly evaluate a boolean flag that is ON', async () => {
      let result = client.getBooleanValue('splitters', false);
      expect(result).toBe(true);
      await OpenFeature.setContext({ targetingKey: "emiliano@split.io" });
      result = client.getBooleanValue('splitters', false);
      expect(result).toBe(false);
    });

    test('should correctly evaluate a boolean flag that is OFF', async () => {
      const result = await client.getBooleanValue('always_off', true);
      expect(result).toBe(false);
    });

    test('should return details for boolean flag evaluation with attributes', async () => {

      // If `group` attribute has `value_without_config` value, it should return off treatment without config
      await OpenFeature.setContext({trafficType: 'user', group: 'value_without_config'});
      let details = await client.getBooleanDetails('split_with_config', false);
      expect(details.value).toBe(false);
      expect(details.flagKey).toBe('split_with_config');
      expect(details.reason).toBe('TARGETING_MATCH');
      expect(details.variant).toBe('off');
      expect(details.flagMetadata.config).toBe('');

      // If `group` attribute isn't present, it should return om treatment with configs
      await OpenFeature.setContext({trafficType: 'user'});
      details = await client.getBooleanDetails('split_with_config', false);
      expect(details.value).toBe(true);
      expect(details.flagKey).toBe('split_with_config');
      expect(details.reason).toBe('TARGETING_MATCH');
      expect(details.variant).toBe('on');
      expect(details.flagMetadata.config).toBe('{"color":"brown","dimensions":{"height":12,"width":14},"text":{"inner":"click me"}}');
    });
  });

  describe('String evaluations', () => {
    test('should correctly evaluate a string flag', async () => {
      await OpenFeature.setContext({targetingKey: 'emmanuel@split.io', trafficType: 'account'});
      const result = client.getStringValue('blacklist', 'default');
      expect(result).toBe('not_allowed');
    });

    test('should return details for string flag evaluation', async () => {
      let details = await client.getStringDetails('developers', 'default');
      expect(details.value).toBe('off');
      expect(details.flagKey).toBe('developers');
      expect(details.reason).toBe('TARGETING_MATCH');
      expect(details.variant).toBe('off');
      expect(details.flagMetadata.config).toBe('');

      await OpenFeature.setContext({targetingKey: 'emiliano@split.io', trafficType: 'account'});
      details = await client.getStringDetails('developers', 'default');
      expect(details.value).toBe('on');
      expect(details.flagKey).toBe('developers');
      expect(details.reason).toBe('TARGETING_MATCH');
      expect(details.variant).toBe('on');
      expect(details.flagMetadata.config).toBe('{"color":"blue"}');
    });
  });

  describe('Number evaluations', () => {
    test('should correctly evaluate a number flag', async () => {
      const result = await client.getNumberValue('qc_team', 0);
      expect(result).toBe(20);
    });

    test('should return details for number flag evaluation', async () => {
      const details = await client.getNumberDetails('qc_team', 0);
      expect(details.value).toBe(20);
      expect(details.flagKey).toBe('qc_team');
      expect(details.reason).toBe('TARGETING_MATCH');
      expect(details.variant).toBe('20');
      expect(details.flagMetadata.config).toBe('{"color":"red"}');
    });
  });

  describe('Object evaluations', () => {
    test('should correctly evaluate an object flag', async () => {
      await OpenFeature.setContext({targetingKey: 'nicolas@split.io', trafficType: 'account'});
      const result = await client.getObjectValue('whitelist', {ke:true});
      expect(result).toEqual({ allowed: true });
    });

    test('should return details for object flag evaluation', async () => {
      const details = await client.getObjectDetails('whitelist', {});
      expect(details.value).toEqual({ allowed: true });
      expect(details.flagKey).toBe('whitelist');
      expect(details.reason).toBe('TARGETING_MATCH');
      expect(details.variant).toBe('{"allowed":true}');
      expect(details.flagMetadata.config).toBe('{"color":"green"}');
    });
  });
});
