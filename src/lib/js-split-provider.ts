/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  EvaluationContext,
  Provider,
  ResolutionDetails,
  ParseError,
  FlagNotFoundError,
  JsonValue,
  StandardResolutionReasons,
  Logger,
  ProviderEvents,
  OpenFeatureEventEmitter,
  TrackingEventDetails,
} from "@openfeature/web-sdk";
import type SplitIO from "@splitsoftware/splitio-browserjs/types/splitio";

type Consumer = {
  key: string | undefined;
  attributes: SplitIO.Attributes;
};

const CONTROL_VALUE_ERROR_MESSAGE = "Received the 'control' value from Split.";
const CONTROL_TREATMENT = 'control';

export class OpenFeatureSplitProvider implements Provider {
  metadata = {
    name: "split",
  };
  private client: SplitIO.IBrowserClient;
  private factory: SplitIO.IBrowserSDK;
  private trafficType: string;
  public readonly events = new OpenFeatureEventEmitter();

  onContextChange(oldContext: EvaluationContext, newContext: EvaluationContext): Promise<void> {
    const { targetingKey: oldTargetingKey } = oldContext;
    const { targetingKey: newTargetingKey, trafficType: newTrafficType } = newContext;

    this.trafficType = newTrafficType && newTrafficType !== this.trafficType ? newTrafficType as string : this.trafficType ;
    if (newTargetingKey && newTargetingKey !== oldTargetingKey) {
      this.client = this.factory.client(newTargetingKey);
      return new Promise((resolve, reject) => {
        this.client.on(this.client.Event.SDK_READY, () => resolve());
        this.client.on(this.client.Event.SDK_READY_TIMED_OUT, () => reject(new Error('Split SDK timed out')));
      });
    }
    return Promise.resolve();
  }

  constructor(splitFactory: SplitIO.IBrowserSDK) {
    // Asume 'user' as default traffic type'
    this.trafficType = 'user';
    this.factory = splitFactory
    this.client = splitFactory.client();
    this.client.on(this.client.Event.SDK_UPDATE, () => {
      this.events.emit(ProviderEvents.ConfigurationChanged)
    });

    const onSdkReady = () => {
      console.log(`${this.metadata.name} provider initialized`);
      this.events.emit(ProviderEvents.Ready)
    };

    const onSdkTimedOut = () => {
      console.log(`${this.metadata.name} provider couldn't initialize`);
      this.events.emit(ProviderEvents.Error);
    };

    const clientStatus = (this.client as any).__getStatus();
    if (clientStatus.isReady) {
      onSdkReady();
      return;
    } 
    if (clientStatus.hasTimedout || clientStatus.isTimedOut) {
      onSdkTimedOut();
      return;
    }
    this.client.on(this.client.Event.SDK_READY, onSdkReady);
    this.client.on(this.client.Event.SDK_READY_TIMED_OUT, onSdkTimedOut);
  }

  resolveBooleanEvaluation(
    flagKey: string,
    _: boolean,
    context: EvaluationContext,
    _logger: Logger
  ): ResolutionDetails<boolean> {
    const details = this.evaluateTreatment(
      flagKey,
      this.transformContext(context),
    );

    const treatment = details.value.toLowerCase();

    if ( treatment === 'on' || treatment === 'true' ) {
      return { ...details, value: true };
    }

    if ( treatment === 'off' || treatment === 'false' ) {
      return { ...details, value: false };
    }

    throw new ParseError(`Invalid boolean value for ${treatment}`);
  }

  resolveStringEvaluation(
    flagKey: string,
    _: string,
    context: EvaluationContext,
    _logger: Logger
  ): ResolutionDetails<string> {
    const details = this.evaluateTreatment(
      flagKey,
      this.transformContext(context),
    );
    return details;
  }

  resolveNumberEvaluation(
    flagKey: string,
    _: number,
    context: EvaluationContext,
    _logger: Logger
  ): ResolutionDetails<number> {
    const details = this.evaluateTreatment(
      flagKey,
      this.transformContext(context),
    );
    return { ...details, value: this.parseValidNumber(details.value) };
  }

  resolveObjectEvaluation<U extends JsonValue>(
    flagKey: string,
    _: U,
    context: EvaluationContext,
    _logger: Logger
  ): ResolutionDetails<U> {
    const details = this.evaluateTreatment(
      flagKey,
      this.transformContext(context)
    );
    return { ...details, value: this.parseValidJsonObject(details.value) };
  }

  private evaluateTreatment(
    flagKey: string,
    consumer: Consumer
  ): ResolutionDetails<string> {
    if (flagKey == null || flagKey === '') {
      throw new FlagNotFoundError(
        'flagKey must be a non-empty string'
      );
    }
    const treatment: SplitIO.TreatmentWithConfig = this.client.getTreatmentWithConfig(
      flagKey,
      consumer.attributes
    );
    const {treatment: value, config} = treatment

    if (value === CONTROL_TREATMENT) {
      throw new FlagNotFoundError(CONTROL_VALUE_ERROR_MESSAGE);
    }
    const flagMetadata = { config: config ? config : '' };
    const details: ResolutionDetails<string> = {
      value: value,
      variant: value,
      flagMetadata: flagMetadata,
      reason: StandardResolutionReasons.TARGETING_MATCH,
    };
    return details;
  }

  track(
    trackingEventName: string,
    _: EvaluationContext,
    details: TrackingEventDetails
  ): void {

    // eventName is always required
    if (trackingEventName == null || trackingEventName === '')
      throw new ParseError('Missing eventName, required to track');

    let value;
    let properties: SplitIO.Properties = {};
    if (details != null) {
      if (details.value != null) {
        value = details.value;
      }
      if (details.properties != null) {
        properties = details.properties as SplitIO.Properties;
      }
    } 

    this.client.track(this.trafficType, trackingEventName, value, properties);
  }

  async onClose?(): Promise<void> {
    return this.client.destroy();
  }

  //Transform the context into an object useful for the Split API, an key string with arbitrary Split "Attributes".
  private transformContext(context: EvaluationContext): Consumer {
    const { targetingKey, ...attributes } = context;
    return {
      key: targetingKey,
      // Stringify context objects include date.
      attributes: JSON.parse(JSON.stringify(attributes)),
    };
  }

  private parseValidNumber(stringValue: string | undefined) {
    if (stringValue === undefined) {
      throw new ParseError(`Invalid 'undefined' value.`);
    }
    const result = Number.parseFloat(stringValue);
    if (Number.isNaN(result)) {
      throw new ParseError(`Invalid numeric value ${stringValue}`);
    }
    return result;
  }

  private parseValidJsonObject<T extends JsonValue>(
    stringValue: string | undefined
  ): T {
    if (stringValue === undefined) {
      throw new ParseError(`Invalid 'undefined' JSON value.`);
    }
    // we may want to allow the parsing to be customized.
    try {
      const value = JSON.parse(stringValue);
      if (typeof value !== "object") {
        throw new ParseError(
          `Flag value ${stringValue} had unexpected type ${typeof value}, expected "object"`
        );
      }
      return value;
    } catch (err) {
      throw new ParseError(`Error parsing ${stringValue} as JSON, ${err}`);
    }
  }
}
