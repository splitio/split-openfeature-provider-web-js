/* eslint-disable @typescript-eslint/no-explicit-any */
import { ProviderEvents } from "@openfeature/web-sdk";
import type { EventDetails, EventMetadata, OpenFeatureEventEmitter } from "@openfeature/web-sdk";
import type SplitIO from "@splitsoftware/splitio-browserjs/types/splitio";

/**
 * Split SDK emits SDK_READY with SdkReadyMetadata:
 * - initialCacheLoad: boolean — true when fresh install / no cache, false when ready from cache
 * - lastUpdateTimestamp?: number — ms since epoch when cache was last updated (undefined if initialCacheLoad is true)
 */

export type ReadyCallbacks = {
  onSdkReady: () => void;
  onSdkTimedOut: () => void;
};

/** Map Split SdkReadyMetadata to OpenFeature EventMetadata (string | boolean | number). */
function toReadyEventMetadata(sdkReadyMetadata: SplitIO.SdkReadyMetadata): EventMetadata {
  const meta: EventMetadata = {
    initialCacheLoad: sdkReadyMetadata.initialCacheLoad,
  };
  if (sdkReadyMetadata.lastUpdateTimestamp != null) {
    meta.lastUpdateTimestamp = sdkReadyMetadata.lastUpdateTimestamp;
  }
  return meta;
}

/**
 * Emit OpenFeature ProviderEvents.Ready with Split SDK ready metadata, then invoke the callback.
 * When sdkReadyMetadata is provided (from SDK_READY event), use it; otherwise emit with empty metadata (e.g. when already ready).
 */
function emitReadyWithSplitMetadata(
  eventsEmitter: OpenFeatureEventEmitter,
  providerName: string,
  onSdkReady: () => void,
  sdkReadyMetadata?: SplitIO.SdkReadyMetadata
): void {
  const readyDetails: EventDetails = {
    providerName,
    metadata: sdkReadyMetadata ? toReadyEventMetadata(sdkReadyMetadata) : {},
  };
  eventsEmitter.emit(ProviderEvents.Ready, readyDetails);
  onSdkReady();
}

/**
 * Attach Split SDK event listeners and resolve/reject the ready promise based on client status.
 * When the Split SDK becomes ready, emits ProviderEvents.Ready with Split ready metadata before resolving.
 */
export function attachSplitReadyHandlers(
  client: SplitIO.IBrowserClient,
  eventsEmitter: OpenFeatureEventEmitter,
  callbacks: ReadyCallbacks,
  providerName: string
): void {
  const { onSdkReady, onSdkTimedOut } = callbacks;

  const onSdkReadyFromCache = () => {
    eventsEmitter.emit(ProviderEvents.Stale, { message: 'Split ready from cache' });
  };

  const clientStatus = (client as any).__getStatus();
  if (clientStatus.isReady) {
    emitReadyWithSplitMetadata(eventsEmitter, providerName, onSdkReady);
    return;
  }

  if (clientStatus.isReadyFromCache) {
    onSdkReadyFromCache();
  } else {
    client.on(client.Event.SDK_READY_FROM_CACHE, onSdkReadyFromCache);
  }

  if (clientStatus.hasTimedout) {
    onSdkTimedOut();
  } else {
    client.on(client.Event.SDK_READY_TIMED_OUT, onSdkTimedOut);
  }
  client.on(client.Event.SDK_READY, (sdkReadyMetadata: SplitIO.SdkReadyMetadata) => {
    emitReadyWithSplitMetadata(eventsEmitter, providerName, onSdkReady, sdkReadyMetadata);
  });
}

/**
 * Subscribe to Split SDK_UPDATE and emit OpenFeature ConfigurationChanged with details.
 */
export function attachSplitUpdateHandler(
  client: SplitIO.IBrowserClient,
  eventsEmitter: OpenFeatureEventEmitter,
  providerName: string
): void {
  client.on(client.Event.SDK_UPDATE, (updateMetadata: SplitIO.SdkUpdateMetadata) => {
    let eventDetails: EventDetails = { providerName };
    if (updateMetadata) {
      eventDetails = {
        ...eventDetails,
        eventMetadata: {
          type: updateMetadata.type,
          names: JSON.stringify(updateMetadata.names),
        },
      };
      if (updateMetadata.type === 'FLAGS_UPDATE') {
        eventDetails = { ...eventDetails, flagsChanged: updateMetadata.names };
      }
    }
    eventsEmitter.emit(ProviderEvents.ConfigurationChanged, eventDetails);
  });
}
