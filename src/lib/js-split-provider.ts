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
      // Check if we can access the ready() method safely
      try {
        // If client is ready, resolve immediately
        if (this.isClientReady()) {
          console.log(`${this.metadata.name} provider initialized`);
          resolve();
          return;
        }
        
        // Otherwise set up event listener for SDK_READY
        const onSdkReady = () => {
          console.log(`${this.metadata.name} provider initialized`);
          resolve();
        };
        
        // Bind to SDK_READY event
        // Handle web SDK event mechanism - use addListener which exists in web SDK
        if (typeof this.client.addListener === 'function') {
          // Use correct typing for web SDK's addListener 
          try {
            // @ts-ignore - Ignore type checking here as we're handling web SDK dynamically
            this.client.addListener({ event: 'SDK_READY', handler: onSdkReady });
          } catch (e) {
            console.warn(`${this.metadata.name} provider: Error adding listener`, e);
          }
        } else if (typeof this.client.on === 'function') {
          this.client.on('SDK_READY', onSdkReady);
        } else {
          // If no event mechanism is available, just resolve
          console.warn(`${this.metadata.name} provider: No event mechanism available`);
          resolve();
        }
      } catch (e) {
        // In case of any issues, resolve the promise to prevent hanging
        console.warn(`${this.metadata.name} provider initialization error: ${e}`);
        resolve();
      }
    });
  }
  
  // Safe method to check if client is ready
  private isClientReady(): boolean {
    try {
      // Make sure ready is a function and call it to get the boolean result
      return typeof this.client.ready === 'function' && Boolean(this.client.ready());
    } catch (e) {
      return false;
    }
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
        value = true;
        break;
      case "off":
        value = false;
        break;
      case "true":
        value = true;
        break;
      case "false":
        value = false;
        break;
      case true:
        value = true;
        break;
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
      const details: ResolutionDetails<string> = {
        value: value,
        variant: value,
        reason: StandardResolutionReasons.TARGETING_MATCH,
      };
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
