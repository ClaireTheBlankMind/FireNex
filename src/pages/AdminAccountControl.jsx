
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Users,
  UserCheck,
  UserRoundCheck,
  Clock3,
  Search,
  RefreshCw,
  ShieldCheck,
  Mail,
  CalendarDays,
  CheckCircle2,
  XCircle,
  Trash2,
} from "lucide-react";

import { supabase } from "../lib/supabase.js";
import "./AdminPages.css";

export default function AdminAccountControl({ profile }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [accountAction, setAccountAction] = useState(null);
  const [confirmingAction, setConfirmingAction] = useState(false);

  const isSuperadmin =
    profile?.role === "superadmin" &&
    profile?.active === true;

  // LOAD ADMIN ACCOUNTS
  const loadAccounts = useCallback(async () => {
    if (!isSuperadmin) {
      setAccounts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: queryError } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, active, created_at")
        .eq("role", "admin")
        .order("created_at", { ascending: false });

      if (queryError) {
        throw queryError;
      }

      setAccounts(data ?? []);
    } catch (err) {
      console.error("Load admin accounts error:", err);

      setError(
        err.message || "Unable to load admin accounts."
      );

      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [isSuperadmin]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // ACTIVATE OR DEACTIVATE ADMIN ACCOUNT
  async function changeActivation(account, nextActive) {
    if (typeof nextActive !== "boolean") {
      setError("Invalid account activation status.");
      return;
    }

    setBusyId(account.id);
    setError("");
    setNotice("");

    try {
      const { error: rpcError } = await supabase.rpc(
        "set_admin_account_active",
        {
          p_target_user_id: account.id,
          p_active: Boolean(nextActive),
        }
      );

      if (rpcError) {
        throw rpcError;
      }

      setNotice(
        `${account.full_name || account.email || "The account"} has been ${
          nextActive ? "activated" : "deactivated"
        }.`
      );

      await loadAccounts();
    } catch (err) {
      console.error("Admin account activation error:", err);

      setError(
        err.message || "Unable to update this account."
      );

      throw err;
    } finally {
      setBusyId("");
    }
  }

  // DELETE ADMIN ACCOUNT THROUGH EDGE FUNCTION
  async function deleteAccount(account) {
    setBusyId(account.id);
    setError("");
    setNotice("");

    try {
      const { error: deleteError } =
        await supabase.functions.invoke(
          "delete-admin-account",
          {
            body: {
              target_user_id: account.id,
            },
          }
        );

      if (deleteError) {
        throw deleteError;
      }

      setNotice(
        `${account.full_name || account.email || "The account"} was deleted successfully.`
      );

      await loadAccounts();
    } catch (err) {
      console.error("Delete admin account error:", err);

      setError(
        err.message ||
          "Unable to delete this account. Check the server-side deletion function."
      );

      throw err;
    } finally {
      setBusyId("");
    }
  }

  // ACCOUNT STATISTICS
  const stats = useMemo(() => ({
    total: accounts.length,

    pending: accounts.filter(
      (account) => !account.active
    ).length,

    active: accounts.filter(
      (account) => account.active
    ).length,
  }), [accounts]);

  // SEARCH AND FILTER
  const visibleAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return accounts.filter((account) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "pending" && !account.active) ||
        (filter === "active" && account.active);

      const matchesSearch =
        !query ||
        (account.full_name || "")
          .toLowerCase()
          .includes(query) ||
        (account.email || "")
          .toLowerCase()
          .includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [accounts, filter, search]);

  // ACCESS CONTROL
  if (!isSuperadmin) {
    return (
      <section className="admin-page">
        <div className="admin-access-denied">
          <ShieldCheck size={36} />
          <h2>Access restricted</h2>
          <p>
            Only an active Superadmin can manage accounts.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-page">

      {/* PAGE TOOLBAR */}
      <div className="admin-page-toolbar">
        <button
          className="admin-button admin-button-secondary admin-refresh"
          type="button"
          onClick={loadAccounts}
          disabled={loading || Boolean(busyId)}
        >
          <RefreshCw
            size={16}
            className={loading ? "admin-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {/* ACCOUNT STATISTICS */}
      <div className="admin-stat-grid">

        <article className="admin-stat-card stat-total">
          <div className="admin-stat-top">
            <span>Total admin accounts</span>
            <span className="admin-stat-icon">
              <Users size={20} />
            </span>
          </div>

          <strong>{stats.total}</strong>
          <small>Registered administrator accounts</small>
        </article>

        <article className="admin-stat-card stat-pending">
          <div className="admin-stat-top">
            <span>Pending approval</span>
            <span className="admin-stat-icon">
              <Clock3 size={20} />
            </span>
          </div>

          <strong>{stats.pending}</strong>
          <small>Accounts awaiting activation</small>
        </article>

        <article className="admin-stat-card stat-active">
          <div className="admin-stat-top">
            <span>Active accounts</span>
            <span className="admin-stat-icon">
              <UserCheck size={20} />
            </span>
          </div>

          <strong>{stats.active}</strong>
          <small>Accounts currently enabled</small>
        </article>

      </div>

      {/* ADMIN DIRECTORY */}
      <div className="admin-panel">

        <div className="admin-panel-heading">
          <div>
            <h2>Administrator directory</h2>
            <p>
              Review account details and manage access status.
            </p>
          </div>

          <span className="admin-count-badge">
            {visibleAccounts.length} accounts
          </span>
        </div>

        {/* SEARCH AND FILTER */}
        <div className="admin-toolbar">

          <div className="admin-search">
            <Search size={18} />

            <input
              type="search"
              placeholder="Search by name or email..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              aria-label="Search admin accounts"
            />
          </div>

          <div
            className="admin-filter-tabs"
            aria-label="Account status filter"
          >
            {[
              {
                id: "pending",
                label: "Pending",
                count: stats.pending,
              },
              {
                id: "active",
                label: "Active",
                count: stats.active,
              },
              {
                id: "all",
                label: "All accounts",
                count: stats.total,
              },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                className={
                  filter === item.id ? "selected" : ""
                }
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
                <span>{item.count}</span>
              </button>
            ))}
          </div>

        </div>

        {/* ALERTS */}
        {error && (
          <div
            className="admin-alert admin-alert-error"
            role="alert"
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            className="admin-alert admin-alert-success"
            role="status"
          >
            {notice}
          </div>
        )}

        {/* LOADING */}
        {loading ? (
          <div className="admin-state">
            <RefreshCw
              size={25}
              className="admin-spin"
            />

            <strong>Loading admin accounts</strong>

            <p>
              Please wait while account records are retrieved.
            </p>
          </div>

        ) : visibleAccounts.length === 0 ? (

          /* EMPTY STATE */
          <div className="admin-state">
            <UserRoundCheck size={34} />

            <strong>No accounts found</strong>

            <p>
              {search
                ? "Try a different name or email search."
                : filter === "pending"
                  ? "There are no accounts waiting for approval."
                  : "No accounts match this filter."}
            </p>
          </div>

        ) : (

          /* ADMIN TABLE */
          <div className="admin-table-scroll">
            <table className="admin-data-table">

              <thead>
                <tr>
                  <th>Administrator</th>
                  <th>Role</th>
                  <th>Registration date</th>
                  <th>Account status</th>
                  <th className="admin-action-column">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {visibleAccounts.map((account) => (

                  <tr key={account.id}>

                    {/* ADMINISTRATOR */}
                    <td>
                      <div className="admin-person">

                        <span className="admin-avatar">
                          {(account.full_name || "B")
                            .trim()
                            .charAt(0)
                            .toUpperCase()}
                        </span>

                        <span className="admin-person-copy">
                          <strong>
                            {account.full_name || "BFP Personnel"}
                          </strong>

                          <span>
                            <Mail size={13} />
                            {account.email || "Email unavailable"}
                          </span>
                        </span>

                      </div>
                    </td>

                    {/* ROLE */}
                    <td>
                      <span className="admin-role-badge">
                        Admin
                      </span>
                    </td>

                    {/* REGISTRATION DATE */}
                    <td>
                      <span className="admin-date">
                        <CalendarDays size={14} />

                        {account.created_at
                          ? new Date(
                              account.created_at
                            ).toLocaleDateString()
                          : "—"}
                      </span>
                    </td>

                    {/* ACCOUNT STATUS */}
                    <td>
                      <span
                        className={`admin-status ${
                          account.active
                            ? "status-active"
                            : "status-pending"
                        }`}
                      >
                        {account.active ? (
                          <CheckCircle2 size={14} />
                        ) : (
                          <Clock3 size={14} />
                        )}

                        {account.active
                          ? "Active"
                          : "Pending approval"}
                      </span>
                    </td>

                    {/* ACTIONS */}
                    <td>
                      <div className="admin-account-actions">

                        <button
                          className={`admin-button ${
                            account.active
                              ? "admin-button-danger"
                              : "admin-button-primary"
                          }`}
                          type="button"
                          disabled={Boolean(busyId)}
                          onClick={() =>
                            setAccountAction({
                              account,
                              type: account.active
                                ? "deactivate"
                                : "activate",
                            })
                          }
                        >
                          {account.active ? (
                            <>
                              <XCircle size={14} />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={14} />
                              Approve account
                            </>
                          )}
                        </button>

                        <button
                          className="admin-button admin-button-danger"
                          type="button"
                          disabled={Boolean(busyId)}
                          onClick={() =>
                            setAccountAction({
                              account,
                              type: "delete",
                            })
                          }
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>

                      </div>
                    </td>

                  </tr>

                ))}
              </tbody>

            </table>
          </div>
        )}

        {/* PANEL FOOTER */}
        <div className="admin-panel-footer">
          <span>
            <ShieldCheck size={15} />
            Superadmin account management
          </span>

          <span>
            Showing up to {stats.total} registered admin accounts
          </span>
        </div>

      </div>

      {/* CONFIRMATION MODAL */}
      {accountAction && (
        <div
          className="activation-modal-overlay"
          onClick={() => {
            if (!confirmingAction) {
              setAccountAction(null);
            }
          }}
        >
          <div
            className="activation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-action-title"
            onClick={(event) => event.stopPropagation()}
          >

            {/* MODAL ICON */}
            <div
              className={`activation-modal-icon ${
                accountAction.type === "delete"
                  ? "activation-modal-icon-danger"
                  : accountAction.type === "deactivate"
                    ? "activation-modal-icon-warning"
                    : ""
              }`}
            >
              {accountAction.type === "delete" ? (
                <Trash2 size={30} />
              ) : accountAction.type === "deactivate" ? (
                <XCircle size={30} />
              ) : (
                <ShieldCheck size={30} />
              )}
            </div>

            {/* MODAL TITLE */}
            <h2 id="account-action-title">
              {accountAction.type === "delete"
                ? "Delete this account?"
                : accountAction.type === "deactivate"
                  ? "Deactivate this account?"
                  : "Activate this account?"}
            </h2>

            {/* MODAL DESCRIPTION */}
            <p>
              {accountAction.type === "delete" ? (
                <>
                  You are about to permanently delete{" "}
                  <strong>
                    {accountAction.account.full_name ||
                      accountAction.account.email}
                  </strong>
                  . This action may affect related records and
                  cannot be undone without a backup.
                </>
              ) : accountAction.type === "deactivate" ? (
                <>
                  Are you sure you want to deactivate{" "}
                  <strong>
                    {accountAction.account.full_name ||
                      accountAction.account.email}
                  </strong>
                  ? The account will no longer be permitted to
                  access FireNex once access is properly enforced.
                </>
              ) : (
                <>
                  Are you sure you want to activate{" "}
                  <strong>
                    {accountAction.account.full_name ||
                      accountAction.account.email}
                  </strong>
                  ? This account will be permitted to access
                  FireNex.
                </>
              )}
            </p>

            {/* MODAL BUTTONS */}
            <div className="activation-modal-actions">

              <button
                type="button"
                className="firenex-button firenex-button-secondary"
                disabled={confirmingAction}
                onClick={() => setAccountAction(null)}
              >
                Cancel
              </button>

              <button
                type="button"
                className={`firenex-button ${
                  accountAction.type === "activate"
                    ? "activation-confirm-button"
                    : "firenex-button-danger"
                }`}
                disabled={
                  confirmingAction || Boolean(busyId)
                }
                onClick={async () => {
                  setConfirmingAction(true);

                  try {
                    if (accountAction.type === "delete") {
                      await deleteAccount(
                        accountAction.account
                      );
                    } else {
                      const nextActive =
                        accountAction.type === "activate";

                      await changeActivation(
                        accountAction.account,
                        nextActive
                      );
                    }

                    setAccountAction(null);
                  } catch (err) {
                    // Keep the modal open if the operation fails.
                    console.error(
                      "Account action failed:",
                      err
                    );
                  } finally {
                    setConfirmingAction(false);
                  }
                }}
              >
                {confirmingAction
                  ? "Processing..."
                  : accountAction.type === "delete"
                    ? "Confirm Delete"
                    : accountAction.type === "deactivate"
                      ? "Confirm Deactivation"
                      : "Confirm Activation"}
              </button>

            </div>

          </div>
        </div>
      )}

    </section>
  );
}