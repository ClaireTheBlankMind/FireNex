
import { ArrowLeft } from "lucide-react";

export default function AccountPageLayout({
  title,
  description,
  icon: Icon,
  children,
  onBack,
}) {
  return (
    <div className="account-page">
      <header className="account-page-heading">
        <div className="account-page-title-row">
          <div className="account-page-icon">
            {Icon ? <Icon size={25} /> : null}
          </div>

          <div className="account-page-heading-text">
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
        </div>

        <button
          type="button"
          className="account-back-button"
          onClick={
            onBack ||
            (() => {
              window.history.back();
            })
          }
        >
          <ArrowLeft size={17} />
          <span>Back to Dashboard</span>
        </button>
      </header>

      <main className="account-page-content">{children}</main>
    </div>
  );
}
