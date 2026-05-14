type CompactStatGridItem = {
  label: string;
  value: string;
};

type CompactStatGridProps = {
  items: CompactStatGridItem[];
  label: string;
};

function CompactStatGrid({ items, label }: CompactStatGridProps) {
  return (
    <div className="compact-stat-grid" aria-label={label}>
      {items.map((item) => (
        <span key={item.label}>
          <small>{item.label}</small>
          <strong>{item.value}</strong>
        </span>
      ))}
    </div>
  );
}

export default CompactStatGrid;
export type { CompactStatGridItem };
