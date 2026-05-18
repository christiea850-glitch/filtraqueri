export type S5DetailPatternPreviewFact = {
  readonly label: string;
  readonly value: string;
};

export type S5DetailPatternPreviewAction = {
  readonly label: string;
  readonly description: string;
};

export type S5DetailPatternPreviewProps = {
  readonly title?: string;
  readonly sourceContext?: string;
  readonly backTarget?: string;
  readonly keyFacts?: ReadonlyArray<S5DetailPatternPreviewFact>;
  readonly primaryBody?: string;
  readonly relatedActions?: ReadonlyArray<S5DetailPatternPreviewAction>;
  readonly preservedContextNote?: string;
  readonly onBack?: () => void;
};

const defaultFacts: ReadonlyArray<S5DetailPatternPreviewFact> = [
  { label: "Route kind", value: "detail" },
  { label: "Depth", value: "3 of 4" },
  { label: "Status", value: "Skeleton only" },
];

const defaultActions: ReadonlyArray<S5DetailPatternPreviewAction> = [
  {
    label: "Future results detail",
    description: "A later phase can reuse this structure for Results insight drilldowns.",
  },
  {
    label: "Future dataset detail",
    description: "A later phase can reuse this structure for Dataset intelligence drilldowns.",
  },
];

function S5DetailPatternPreview({
  title = "S5 Detail Pattern Preview",
  sourceContext = "S5 navigation skeleton",
  backTarget = "Originating surface",
  keyFacts = defaultFacts,
  primaryBody = "This detail-page proof defines structure only. No dashboard content has been extracted.",
  relatedActions = defaultActions,
  preservedContextNote = "Future back behavior must preserve dataset, session, workbook, mode, filters, pagination, exports, result state, and expanded panels.",
  onBack,
}: S5DetailPatternPreviewProps) {
  return (
    <section className="standalone-panel" aria-label="S5 detail pattern preview">
      <div>
        <p className="section-label">Detail page proof</p>
        <h2>{title}</h2>
        <p>{sourceContext}</p>
      </div>

      <div className="workspace-actions">
        <button type="button" className="secondary-button" onClick={onBack} disabled={!onBack}>
          Back to {backTarget}
        </button>
      </div>

      <div className="results-review-facts" aria-label="Detail key facts">
        {keyFacts.map((fact) => (
          <span key={`${fact.label}:${fact.value}`}>
            <small>{fact.label}</small>
            <strong>{fact.value}</strong>
          </span>
        ))}
      </div>

      <div>
        <p>{primaryBody}</p>
        <small>{preservedContextNote}</small>
      </div>

      <div className="investigation-prompt-row" aria-label="Related detail actions">
        <span>Related actions</span>
        {relatedActions.map((action) => (
          <small key={action.label} title={action.description}>
            {action.label}
          </small>
        ))}
      </div>
    </section>
  );
}

export default S5DetailPatternPreview;

