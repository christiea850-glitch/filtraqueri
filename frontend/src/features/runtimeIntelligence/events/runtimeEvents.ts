export type RuntimeEventType =
  | "created"
  | "derived"
  | "replayed"
  | "dismissed"
  | "approved"
  | "rejected"
  | "superseded"
  | (string & {});

export type RuntimeEvent = {
  eventId: string;
  type: RuntimeEventType;
  createdAt: string;
  actorType: "system" | "user" | "future_agent" | (string & {});
  nodeId: string | null;
  artifactId: string | null;
  summary: string;
  immutable: true;
  metadataOnly: true;
};

export type RuntimeEventReference = {
  eventId: string;
  type: RuntimeEventType;
  label: string;
};
