import type {
  AnalyticsIntentGraphReport,
  AnalyticsIntentGraphValidationMessage,
  AnalyticsIntentGraphValidationResult,
} from "./analyticsIntentGraphTypes";

const addMessage = (
  messages: AnalyticsIntentGraphValidationMessage[],
  severity: AnalyticsIntentGraphValidationMessage["severity"],
  message: string,
) => {
  messages.push({ severity, message });
};

export const validateAnalyticsIntentGraph = (
  graph: AnalyticsIntentGraphReport,
): AnalyticsIntentGraphValidationResult => {
  const messages: AnalyticsIntentGraphValidationMessage[] = [];
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const edgeIds = new Set<string>();

  graph.edges.forEach((edge) => {
    if (edgeIds.has(edge.id)) addMessage(messages, "error", `Duplicate graph edge id: ${edge.id}.`);
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.sourceNodeId)) addMessage(messages, "error", `Missing source node: ${edge.sourceNodeId}.`);
    if (!nodeIds.has(edge.targetNodeId)) addMessage(messages, "error", `Missing target node: ${edge.targetNodeId}.`);
  });

  if (graph.nodes.length === 0) addMessage(messages, "warning", "Analytics intent graph has no nodes.");
  if (graph.edges.length === 0) addMessage(messages, "warning", "Analytics intent graph has no edges.");

  return {
    valid: messages.every((message) => message.severity !== "error"),
    messages,
  };
};
