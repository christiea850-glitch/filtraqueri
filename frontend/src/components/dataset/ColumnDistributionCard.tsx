import type { SchemaColumn } from "../../features/dataset/datasetTypes";

type ColumnDistributionCardProps = {
  column: SchemaColumn;
};

const formatNumber = (value: number) => {
  if (!Number.isFinite(value)) return "—";
  const absolute = Math.abs(value);
  if (absolute >= 10000 || (absolute >= 100 && Number.isInteger(value))) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  if (absolute >= 1) return value.toFixed(2);
  if (absolute === 0) return "0";
  return value.toFixed(3);
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="column-distribution-stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function FallbackCard() {
  return (
    <div className="column-distribution-card column-distribution-fallback">
      <p>Distribution data is not available for this column.</p>
    </div>
  );
}

function NumericCard({ column }: { column: SchemaColumn }) {
  const stats = column.numeric_stats;
  const buckets = column.histogram_buckets || [];
  const maxBucketCount = buckets.reduce((max, b) => Math.max(max, b.count), 0);

  if (!stats && buckets.length === 0) return <FallbackCard />;

  return (
    <div className="column-distribution-card column-distribution-numeric">
      {buckets.length > 0 && (
        <div className="column-distribution-histogram" aria-label="Distribution histogram">
          {buckets.map((bucket, index) => {
            const heightPercent = maxBucketCount > 0 ? (bucket.count / maxBucketCount) * 100 : 0;
            const safeHeight = Math.max(2, heightPercent);
            return (
              <div
                key={index}
                className="column-distribution-bucket"
                style={{ height: `${safeHeight}%` }}
                title={`${formatNumber(bucket.bucket_min)} – ${formatNumber(bucket.bucket_max)}: ${bucket.count.toLocaleString()}`}
              />
            );
          })}
        </div>
      )}
      <dl className="column-distribution-stats">
        {stats && (
          <>
            <Stat label="min" value={formatNumber(stats.min)} />
            <Stat label="median" value={formatNumber(stats.median)} />
            <Stat label="mean" value={formatNumber(stats.mean)} />
            <Stat label="max" value={formatNumber(stats.max)} />
            <Stat label="std" value={formatNumber(stats.std)} />
          </>
        )}
        <Stat label="missing" value={column.null_count.toLocaleString()} />
      </dl>
    </div>
  );
}

function CategoricalCard({ column }: { column: SchemaColumn }) {
  const topValues = column.top_values || [];
  if (topValues.length === 0) return <FallbackCard />;

  const maxCount = topValues.reduce((max, v) => Math.max(max, v.count), 0);

  return (
    <div className="column-distribution-card column-distribution-categorical">
      <div className="column-distribution-meta">
        <span>{column.unique_count.toLocaleString()} unique</span>
        <span>{column.null_count.toLocaleString()} missing</span>
      </div>
      <ul className="column-distribution-top-values">
        {topValues.map((entry) => {
          const widthPercent = maxCount > 0 ? (entry.count / maxCount) * 100 : 0;
          const displayValue = entry.value === "" ? "(empty)" : entry.value;
          return (
            <li key={`${entry.value}-${entry.count}`}>
              <div className="column-distribution-top-row">
                <span className="column-distribution-top-value" title={displayValue}>
                  {displayValue}
                </span>
                <span className="column-distribution-top-count">
                  {entry.count.toLocaleString()}
                </span>
              </div>
              <div className="column-distribution-top-bar-track" aria-hidden="true">
                <div
                  className="column-distribution-top-bar-fill"
                  style={{ width: `${Math.max(2, widthPercent)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DateCard({ column }: { column: SchemaColumn }) {
  const range = column.date_range;
  if (!range) return <FallbackCard />;

  return (
    <div className="column-distribution-card column-distribution-date">
      <dl className="column-distribution-stats">
        <Stat label="earliest" value={range.min} />
        <Stat label="latest" value={range.max} />
        <Stat label="missing" value={column.null_count.toLocaleString()} />
      </dl>
    </div>
  );
}

function TextCard({ column }: { column: SchemaColumn }) {
  const stats = column.text_length_stats;
  if (!stats) return <FallbackCard />;

  return (
    <div className="column-distribution-card column-distribution-text">
      <dl className="column-distribution-stats">
        <Stat label="min length" value={stats.min_length.toLocaleString()} />
        <Stat label="avg length" value={stats.avg_length.toFixed(1)} />
        <Stat label="max length" value={stats.max_length.toLocaleString()} />
        <Stat label="missing" value={column.null_count.toLocaleString()} />
      </dl>
    </div>
  );
}

function ColumnDistributionCard({ column }: ColumnDistributionCardProps) {
  switch (column.inferred_type) {
    case "numeric":
      return <NumericCard column={column} />;
    case "categorical":
    case "boolean":
      return <CategoricalCard column={column} />;
    case "date":
      return <DateCard column={column} />;
    case "text":
      return <TextCard column={column} />;
    default:
      return <FallbackCard />;
  }
}

export default ColumnDistributionCard;
