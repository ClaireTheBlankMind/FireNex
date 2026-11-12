export default function StatusBadge({ status }) {
  const normalized = status.toLowerCase().replaceAll(" ", "-");

  return (
    <span className={`status-badge status-${normalized}`}>
      <span className="badge-dot" />
      {status}
    </span>
  );
}