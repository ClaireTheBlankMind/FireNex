export default function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "blue",
}) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${tone}`}>
        <Icon size={22} />
      </div>

      <div className="stat-content">
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{value}</strong>
        <span className="stat-detail">{detail}</span>
      </div>
    </article>
  );
}