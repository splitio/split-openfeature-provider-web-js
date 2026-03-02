import type { EvaluationContext } from "@openfeature/web-sdk";
import type { Consumer } from "./types";

/**
 * Transform OpenFeature evaluation context into a consumer object for the Split API.
 */
export function transformContext(
  context: EvaluationContext,
  defaultTrafficType: string
): Consumer {
  const { targetingKey, trafficType: ttVal, ...attributes } = context;
  const trafficType =
    ttVal != null && typeof ttVal === 'string' && ttVal.trim() !== ''
      ? ttVal
      : defaultTrafficType;
  return {
    targetingKey,
    trafficType,
    attributes: JSON.parse(JSON.stringify(attributes)),
  };
}
