import type { ResolutionDetails } from "@openfeature/web-sdk";
import { FlagNotFoundError, StandardResolutionReasons } from "@openfeature/web-sdk";
import type SplitIO from "@splitsoftware/splitio-browserjs/types/splitio";
import { CONTROL_TREATMENT, CONTROL_VALUE_ERROR_MESSAGE } from "./types";
import type { Consumer } from "./types";

/**
 * Evaluate a flag with the Split client and return string resolution details.
 */
export function evaluateTreatment(
  client: SplitIO.IBrowserClient,
  flagKey: string,
  consumer: Consumer
): ResolutionDetails<string> {
  if (flagKey == null || flagKey === '') {
    throw new FlagNotFoundError('flagKey must be a non-empty string');
  }
  const treatment: SplitIO.TreatmentWithConfig = client.getTreatmentWithConfig(
    flagKey,
    consumer.attributes
  );
  const { treatment: value, config } = treatment;

  if (value === CONTROL_TREATMENT) {
    throw new FlagNotFoundError(CONTROL_VALUE_ERROR_MESSAGE);
  }
  return {
    value,
    variant: value,
    flagMetadata: { config: config ? config : '' },
    reason: StandardResolutionReasons.TARGETING_MATCH,
  };
}
