import {
  EvaluationContext,
  Provider,
  ResolutionDetails,
  ParseError,
  FlagNotFoundError,
  JsonValue,
  TargetingKeyMissingError,
  StandardResolutionReasons,
  Logger,
} from "@openfeature/web-sdk";
import type SplitIO from "@splitsoftware/splitio/types/splitio";

export interface SplitProviderOptions {
  splitClient: SplitIO.IClient;
}

type Consumer = {
  key: string | undefined;
  attributes: SplitIO.Attributes;
};

const CONTROL_VALUE_ERROR_MESSAGE = "Received the 'control' value from Split.";

export class OpenFeatureSplitProvider implements Provider {
  metadata = {
    name: "split",
  };
  private initialized: Promise<void>;
  private client: SplitIO.IClient;

  constructor(options: SplitProviderOptions) {
    this.client = options.splitClient;

    // Create initialization promise
    this.initialized = new Promise<void>((resolve) => {

      const onSdkReady = () => {
        console.log(`${this.metadata.name} provider initialized`);
        resolve();
      };

      // If client is ready, resolve immediately
      if (this.isClientReady()) {
        onSdkReady();
      } else {
        this.client.on(this.client.Event.SDK_READY, onSdkReady);
      }
    }).catch((e) => {
      // In case of any issues, resolve the promise to prevent hanging
      console.warn(`${this.metadata.name} provider initialization error: ${e}`);
    });
  }
  
  // Safe method to check if client is ready
  private isClientReady(): boolean {
    return (this.client as any).__getStatus().isReady;
  }

  resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
    context: EvaluationContext,
    logger: Logger
  ): ResolutionDetails<boolean> {
    const details = this.evaluateTreatment(
      flagKey,
      this.transformContext(context),
      defaultValue.toString()
    );

    let value: boolean;
    switch (details.value as unknown) {
      case "on":
      case "true":
      case true:
        value = true;
        break;
      case "off":
      case "false":
      case false:
        value = false;
        break;
      case "control":
        throw new FlagNotFoundError(CONTROL_VALUE_ERROR_MESSAGE);
      default:
        throw new ParseError(`Invalid boolean value for ${details.value}`);
    }
    return { ...details, value };
  }

  resolveStringEvaluation(
    flagKey: string,
    defaultValue: string,
    context: EvaluationContext,
    logger: Logger
  ): ResolutionDetails<string> {
    const details = this.evaluateTreatment(
      flagKey,
      this.transformContext(context),
      defaultValue
    );
    if (details.value === "control") {
      throw new FlagNotFoundError(CONTROL_VALUE_ERROR_MESSAGE);
    }
    return details;
  }

  resolveNumberEvaluation(
    flagKey: string,
    defaultValue: number,
    context: EvaluationContext,
    logger: Logger
  ): ResolutionDetails<number> {
    const details = this.evaluateTreatment(
      flagKey,
      this.transformContext(context),
      defaultValue.toString()
    );
    return { ...details, value: this.parseValidNumber(details.value) };
  }

  resolveObjectEvaluation<U extends JsonValue>(
    flagKey: string,
    defaultValue: U,
    context: EvaluationContext,
    logger: Logger
  ): ResolutionDetails<U> {
    const details = this.evaluateTreatment(
      flagKey,
      this.transformContext(context),
      JSON.stringify(defaultValue)
    );
    return { ...details, value: this.parseValidJsonObject(details.value) };
  }

  private evaluateTreatment(
    flagKey: string,
    consumer: Consumer,
    defaultValue: string
  ): ResolutionDetails<string> {
    if (!consumer.key) {
      throw new TargetingKeyMissingError(
        "The Split provider requires a targeting key."
      );
    } else {
      // The SDK should be ready by now, but if not, return default value
      // Use our isClientReady helper to safely check
      if (!this.isClientReady()) {
        return {
          value: defaultValue,
          variant: defaultValue,
          reason: StandardResolutionReasons.DEFAULT
        };
      }
      const value = this.client.getTreatment(
        consumer.key,
        flagKey,
        consumer.attributes
      );
      // Create resolution details and add flagKey as additional property for tests
      const details: ResolutionDetails<string> = {
        value: value,
        variant: value,
        reason: StandardResolutionReasons.TARGETING_MATCH,
      };
      
      // Add flagKey for OpenFeature v1 compatibility, using assertion to avoid TypeScript errors
      (details as any).flagKey = flagKey;
      return details;
    }
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
