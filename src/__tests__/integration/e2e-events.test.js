import { OpenFeature, ProviderEvents } from '@openfeature/web-sdk';
import { SplitFactory, InLocalStorage } from '@splitsoftware/splitio-browserjs';
import fetchMock from 'jest-fetch-mock';

import { OpenFeatureSplitProvider } from '../../lib/js-split-provider';

import splitChangesMock1 from '../mocks/splitchanges.since.-1.json';
import membershipsEmmanuel from '../mocks/memberships.emmanuel@split.io.json';
import membershipsEmiliano from '../mocks/memberships.emiliano@split.io.json';

// This is an end-to-end integration test that uses real clients (no mocks)
describe('OpenFeature Split Provider - E2E Integration Tests', () => {
  const baseConfig = {
    core: {
      authorizationKey: 'key',
      key: 'emmanuel@split.io'
    },
    scheduler: {
      featuresRefreshRate: 3000,
      segmentsRefreshRate: 3000,
      impressionsRefreshRate: 3000
    },
    startup: {
      requestTimeoutBeforeReady: 10,
      eventsFirstPushWindow: 3000
    },
    urls: {
      sdk: 'https://sdk.baseurl/readinessSuite1',
      events: 'https://events.baseurl/readinessSuite1'
    },
    streamingEnabled: false,
  };

  // Set up before all tests
  beforeAll(async () => {
    fetchMock.enableMocks();   
    fetchMock.mockIf(() => true, async req => {
      if (req.url.includes('/splitChanges')) return { status: 200, body: JSON.stringify(splitChangesMock1) };
      if (req.url.includes('/memberships/emmanuel')) return { status: 200, body: JSON.stringify(membershipsEmmanuel) };
      if (req.url.includes('/testImpressions')) return { status: 200 };
    });

  });
  
  // Clean up after tests
  afterEach(async () => {
    await OpenFeature.clearProviders();
    await OpenFeature.clearHandlers();
    await OpenFeature.close();
  });

  describe('Readiness events', () => {
  
    test('should emit Stale event when split sdk is ready from cache', async () => {
      const config = {
        ...baseConfig,
        storage: InLocalStorage({
          prefix: 'readyFromCache_1'
        }),
      };

      const splitFactory = SplitFactory(config);
      const client = OpenFeature.getClient('readyFromCache');
      await new Promise((resolve, reject) => {
        client.addHandler(ProviderEvents.Stale, () => {
          const splitClient = splitFactory.client();
          // should have emitted ready from cache
          try {
            expect(splitClient.__getStatus().isReadyFromCache).toBe(true);
            resolve();
          } catch {
            reject('should be ready');
          }
        });

        const provider = new OpenFeatureSplitProvider(splitFactory);
        OpenFeature.setProvider(provider);
      });
    });

    test('should emit Ready event when split sdk is ready', async () => {
      const splitFactory = SplitFactory(baseConfig);
      const provider = new OpenFeatureSplitProvider(splitFactory);
      OpenFeature.setProvider(provider);
      const client = OpenFeature.getClient();
      await new Promise((resolve, reject) => {
        client.addHandler(ProviderEvents.Stale, () => {
          reject('should not emit stale');
        });
        client.addHandler(ProviderEvents.Ready, () => {
          const splitClient = splitFactory.client();
          try {
            // should have emitted ready
            expect(splitClient.__getStatus().isReady).toBe(true);
            resolve();
          } catch {
            reject('should be ready');
          }
        });
      });
    });

    test('should emit ready after timeout', async () => {
      fetchMock.mockIf(() => true, async req => {
        if (req.url.includes('/splitChanges')) return { status: 200, body: JSON.stringify(splitChangesMock1) };
        if (req.url.includes('/memberships/emmanuel')) return { status: 200, body: JSON.stringify(membershipsEmmanuel) };
        if (req.url.includes('/testImpressions')) return { status: 200 };
      });

      const config = {
        ...baseConfig,
        scheduler: {
          featuresRefreshRate: 3,
          segmentsRefreshRate: 0.25,
        },
        startup: {
          readyTimeout: 0.2,
          requestTimeoutBeforeReady: 0.1,
          retriesOnFailureBeforeReady: 10
        },
      };
      const splitFactory = SplitFactory(config);
      const client = OpenFeature.getClient();

      await new Promise((resolve, reject) => {

        client.addHandler(ProviderEvents.Stale, () => {
          reject('should not emit stale');
        });
        
        client.addHandler(ProviderEvents.Ready, () => {

          // initialize a new client and make it time out
          OpenFeature.setContext({targetingKey: 'emiliano@split.io'});
          client.addHandler(ProviderEvents.Error, () => {

            // new client timed out, when ready should emit Configuration Changed event
            client.addHandler(ProviderEvents.ConfigurationChanged, async () => {
              const details = await client.getStringDetails('developers', 'default');
              expect(details.value).toBe('on');
              expect(details.flagKey).toBe('developers');
              expect(details.reason).toBe('TARGETING_MATCH');
              expect(details.variant).toBe('on');
              expect(details.flagMetadata.config).toBe('{"color":"blue"}');
              resolve();
            });
            
            // add timed out client membership to get it ready
            fetchMock.mockIf(() => true, async req => {
              if (req.url.includes('/splitChanges')) return { status: 200, body: JSON.stringify(splitChangesMock1) };
              if (req.url.includes('/memberships/emmanuel')) return { status: 200, body: JSON.stringify(membershipsEmmanuel) };
              if (req.url.includes('/memberships/emiliano')) return { status: 200, body: JSON.stringify(membershipsEmiliano) };
              if (req.url.includes('/testImpressions')) return { status: 200 };
            });
          });
        });

        const provider = new OpenFeatureSplitProvider(splitFactory);
        OpenFeature.setProvider(provider);
      });
    });

    test('should emit Error event when split sdk timed out', async () => {
      // disable fetch mocks to force time out
      fetchMock.disableMocks();

      const config = {
        ...baseConfig,
        startup: {
          readyTimeout: 1,
          requestTimeoutBeforeReady: 1,
          retriesOnFailureBeforeReady: 1
        },
      };
      const splitFactory = SplitFactory(config);
      const client = OpenFeature.getClient('timedOut');

      await new Promise((resolve, reject) => {
        client.addHandler(ProviderEvents.Stale, () => {
          reject('should not emit stale');
        });
        client.addHandler(ProviderEvents.Ready, () => {
          reject('should not emit ready');
        });
        client.addHandler(ProviderEvents.Error, () => {
          const splitClient = splitFactory.client();
          // should have emitted ready from cache
          const clientStatus = splitClient.__getStatus();
          try {
            expect(clientStatus.hasTimedout && !clientStatus.isReady).toBe(true);
            resolve();
          } catch {
            reject('should time out');
          }
        });

        const provider = new OpenFeatureSplitProvider(splitFactory);
        OpenFeature.setProvider(provider);
      });
    });
  });
});
