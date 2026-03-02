/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  EvaluationContext,
  Provider,
  ResolutionDetails,
  ParseError,
  JsonValue,
  Logger,
  ProviderEvents,
  OpenFeatureEventEmitter,
  TrackingEventDetails,
} from "@openfeature/web-sdk";
import type SplitIO from "@splitsoftware/splitio-browserjs/types/splitio";

import { transformContext } from "./context";
import { attachSplitReadyHandlers, attachSplitUpdateHandler } from "./events";
import { evaluateTreatment } from "./evaluation";
import { parseBooleanTreatment, parseValidJsonObject, parseValidNumber } from "./parsers";

export class OpenFeatureSplitProvider implements Provider {
  metadata = { name: "split" };

  private client: SplitIO.IBrowserClient;
  private factory: SplitIO.IBrowserSDK;
  private trafficType: string;
  public events = new OpenFeatureEventEmitter();

  constructor(splitFactory: SplitIO.IBrowserSDK) {
    this.trafficType = 'user';
    this.factory = splitFactory;
    this.client = splitFactory.client();
  }

  async initialize(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      try {
        attachSplitReadyHandlers(
          this.client,
          this.events,
          { onSdkReady: resolve as () => void, onSdkTimedOut: reject },
          this.metadata.name
        );
        attachSplitUpdateHandler(this.client, this.events, this.metadata.name);
      } catch {
        reject();
      }
    });
  }

  onContextChange(oldContext: EvaluationContext, newContext: EvaluationContext): Promise<void> {
    const { targetingKey: oldTargetingKey } = oldContext;
    const { targetingKey: newTargetingKey, trafficType: newTrafficType } = newContext;

    this.trafficType =
      newTrafficType && newTrafficType !== this.trafficType
        ? (newTrafficType as string)
        : this.trafficType;

    if (newTargetingKey && newTargetingKey !== oldTargetingKey) {
      this.client = this.factory.client(newTargetingKey);
      return new Promise((resolve, reject) => {
        const emitContextChange = () => {
          this.events.emit(ProviderEvents.ConfigurationChanged);
          resolve();
        };
        attachSplitReadyHandlers(
          this.client,
          this.events,
          { onSdkReady: emitContextChange, onSdkTimedOut: reject },
          this.metadata.name
        );
        attachSplitUpdateHandler(this.client, this.events, this.metadata.name);
      });
    }
    return Promise.resolve();
  }

  resolveBooleanEvaluation(
    flagKey: string,
    _: boolean,
    context: EvaluationContext,
    _logger: Logger
  ): ResolutionDetails<boolean> {
    const details = evaluateTreatment(
      this.client,
      flagKey,
      transformContext(context, this.trafficType)
    );
    const value = parseBooleanTreatment(details.value);
    return { ...details, value };
  }

  resolveStringEvaluation(
    flagKey: string,
    _: string,
    context: EvaluationContext,
    _logger: Logger
  ): ResolutionDetails<string> {
    return evaluateTreatment(
      this.client,
      flagKey,
      transformContext(context, this.trafficType)
    );
  }

  resolveNumberEvaluation(
    flagKey: string,
    _: number,
    context: EvaluationContext,
    _logger: Logger
  ): ResolutionDetails<number> {
    const details = evaluateTreatment(
      this.client,
      flagKey,
      transformContext(context, this.trafficType)
    );
    return { ...details, value: parseValidNumber(details.value) };
  }

  resolveObjectEvaluation<U extends JsonValue>(
    flagKey: string,
    _: U,
    context: EvaluationContext,
    _logger: Logger
  ): ResolutionDetails<U> {
    const details = evaluateTreatment(
      this.client,
      flagKey,
      transformContext(context, this.trafficType)
    );
    return { ...details, value: parseValidJsonObject<U>(details.value) };
  }

  track(
    trackingEventName: string,
    context: EvaluationContext,
    details: TrackingEventDetails
  ): void {
    if (trackingEventName == null || trackingEventName === '') {
      throw new ParseError('Missing eventName, required to track');
    }
    const { trafficType } = transformContext(context, this.trafficType);
    let value: unknown;
    let properties: SplitIO.Properties = {};
    if (details != null) {
      if (details.value != null) value = details.value;
      if (details.properties != null) {
        properties = details.properties as SplitIO.Properties;
      }
    }
    this.client.track(trafficType, trackingEventName, value as number | undefined, properties);
  }

  async onClose?(): Promise<void> {
    return this.factory.destroy();
  }
}
