import type SplitIO from "@splitsoftware/splitio-browserjs/types/splitio";

export type Consumer = {
  targetingKey: string | undefined;
  trafficType: string;
  attributes: SplitIO.Attributes;
};

export const CONTROL_TREATMENT = 'control';
export const CONTROL_VALUE_ERROR_MESSAGE = "Received the 'control' value from Split.";
