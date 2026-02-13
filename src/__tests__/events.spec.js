import { ProviderEvents } from '@openfeature/web-sdk';
import {
  attachSplitReadyHandlers,
  attachSplitUpdateHandler,
} from '../lib/events';

describe('events', () => {
  const providerName = 'split';

  describe('attachSplitReadyHandlers', () => {
    test('calls onSdkReady immediately when client is already ready (no SdkReadyMetadata)', () => {
      const onSdkReady = jest.fn();
      const onSdkTimedOut = jest.fn();
      const emit = jest.fn();
      const client = {
        __getStatus: () => ({ isReady: true, isReadyFromCache: false, hasTimedout: false }),
        on: jest.fn(),
        Event: {
          SDK_READY: 'SDK_READY',
          SDK_READY_FROM_CACHE: 'SDK_READY_FROM_CACHE',
          SDK_READY_TIMED_OUT: 'SDK_READY_TIMED_OUT',
        },
      };
      const eventsEmitter = { emit };

      attachSplitReadyHandlers(client, eventsEmitter, { onSdkReady, onSdkTimedOut }, providerName);

      expect(emit).toHaveBeenCalledWith(ProviderEvents.Ready, {
        providerName,
        metadata: {},
      });
      expect(onSdkReady).toHaveBeenCalledTimes(1);
      expect(onSdkTimedOut).not.toHaveBeenCalled();
      expect(client.on).not.toHaveBeenCalled();
    });

    test('calls onSdkReadyFromCache and onSdkTimedOut when ready from cache and timed out', () => {
      const onSdkReady = jest.fn();
      const onSdkTimedOut = jest.fn();
      const emit = jest.fn();
      const client = {
        __getStatus: () => ({ isReady: false, isReadyFromCache: true, hasTimedout: true }),
        on: jest.fn(() => ({})),
        Event: {
          SDK_READY: 'SDK_READY',
          SDK_READY_FROM_CACHE: 'SDK_READY_FROM_CACHE',
          SDK_READY_TIMED_OUT: 'SDK_READY_TIMED_OUT',
        },
      };
      const eventsEmitter = { emit };

      attachSplitReadyHandlers(client, eventsEmitter, { onSdkReady, onSdkTimedOut }, providerName);

      expect(emit).toHaveBeenCalledWith(ProviderEvents.Stale, {
        message: 'Split ready from cache',
      });
      expect(onSdkTimedOut).toHaveBeenCalled();
    });

    test('registers SDK_READY and on fire emits Ready with Split SdkReadyMetadata', () => {
      const onSdkReady = jest.fn();
      const onSdkTimedOut = jest.fn();
      const emit = jest.fn();
      let sdkReadyCallback;
      const client = {
        __getStatus: () => ({ isReady: false, isReadyFromCache: false, hasTimedout: false }),
        on: jest.fn((event, callback) => {
          if (event === 'SDK_READY') sdkReadyCallback = callback;
          return {};
        }),
        Event: {
          SDK_READY: 'SDK_READY',
          SDK_READY_FROM_CACHE: 'SDK_READY_FROM_CACHE',
          SDK_READY_TIMED_OUT: 'SDK_READY_TIMED_OUT',
        },
      };
      const eventsEmitter = { emit };

      attachSplitReadyHandlers(client, eventsEmitter, { onSdkReady, onSdkTimedOut }, providerName);

      expect(client.on).toHaveBeenCalledWith('SDK_READY', expect.any(Function));
      const sdkReadyMetadata = { initialCacheLoad: false, lastUpdateTimestamp: 1234567890 };
      sdkReadyCallback(sdkReadyMetadata);
      expect(emit).toHaveBeenCalledWith(ProviderEvents.Ready, {
        providerName,
        metadata: { initialCacheLoad: false, lastUpdateTimestamp: 1234567890 },
      });
      expect(emit.mock.calls[0][1].metadata).toHaveProperty('initialCacheLoad');
      expect(onSdkReady).toHaveBeenCalled();
    });

    test('Ready metadata omits lastUpdateTimestamp when undefined (initialCacheLoad true)', () => {
      const emit = jest.fn();
      let sdkReadyCallback;
      const client = {
        __getStatus: () => ({ isReady: false, isReadyFromCache: false, hasTimedout: false }),
        on: jest.fn((event, callback) => {
          if (event === 'SDK_READY') sdkReadyCallback = callback;
          return {};
        }),
        Event: {
          SDK_READY: 'SDK_READY',
          SDK_READY_FROM_CACHE: 'SDK_READY_FROM_CACHE',
          SDK_READY_TIMED_OUT: 'SDK_READY_TIMED_OUT',
        },
      };
      attachSplitReadyHandlers(client, { emit }, { onSdkReady: () => {}, onSdkTimedOut: () => {} }, providerName);
      sdkReadyCallback({ initialCacheLoad: true });
      expect(emit.mock.calls[0][1].metadata).toEqual({ initialCacheLoad: true });
      expect(emit.mock.calls[0][1].metadata).not.toHaveProperty('lastUpdateTimestamp');
    });
  });

  describe('attachSplitUpdateHandler', () => {
    test('registers SDK_UPDATE listener', () => {
      const emit = jest.fn();
      let updateCallback;
      const client = {
        on: jest.fn((event, callback) => {
          if (event === 'SDK_UPDATE') updateCallback = callback;
          return {};
        }),
        Event: { SDK_UPDATE: 'SDK_UPDATE' },
      };
      const eventsEmitter = { emit };

      attachSplitUpdateHandler(client, eventsEmitter, providerName);

      expect(client.on).toHaveBeenCalledWith('SDK_UPDATE', expect.any(Function));

      updateCallback({ type: 'FLAGS_UPDATE', names: ['flag-a', 'flag-b'] });

      expect(emit).toHaveBeenCalledWith(ProviderEvents.ConfigurationChanged, {
        providerName,
        metadata: { type: 'FLAGS_UPDATE' },
        flagsChanged: ['flag-a', 'flag-b'],
      });
    });

    test('emits with only providerName when updateMetadata is undefined', () => {
      const emit = jest.fn();
      let updateCallback;
      const client = {
        on: jest.fn((event, callback) => {
          if (event === 'SDK_UPDATE') updateCallback = callback;
          return {};
        }),
        Event: { SDK_UPDATE: 'SDK_UPDATE' },
      };
      const eventsEmitter = { emit };

      attachSplitUpdateHandler(client, eventsEmitter, providerName);
      updateCallback(undefined);

      expect(emit).toHaveBeenCalledWith(ProviderEvents.ConfigurationChanged, {
        providerName,
      });
    });

    test('emits metadata without flagsChanged when type is not FLAGS_UPDATE', () => {
      const emit = jest.fn();
      let updateCallback;
      const client = {
        on: jest.fn((event, callback) => {
          if (event === 'SDK_UPDATE') updateCallback = callback;
          return {};
        }),
        Event: { SDK_UPDATE: 'SDK_UPDATE' },
      };
      const eventsEmitter = { emit };

      attachSplitUpdateHandler(client, eventsEmitter, providerName);
      updateCallback({ type: 'SPLIT_KILL', names: ['x'] });

      expect(emit).toHaveBeenCalledWith(ProviderEvents.ConfigurationChanged, {
        providerName,
        metadata: { type: 'SPLIT_KILL' },
      });
    });
  });
});
