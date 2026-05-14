type MetadataRowProps = {
  label: string;
  value: string;
};

function MetadataRow({ label, value }: MetadataRowProps) {
  return (
    <span className="metadata-row">
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

export default MetadataRow;
