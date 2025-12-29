import { useAppStore } from "../store";
import type { Account } from "../types";

interface AccountsViewProps {
  onSetActive: (id: string) => void;
  onRemove: (account: Account) => void;
  onAdd: () => void;
}

export function AccountsView({ onSetActive, onRemove, onAdd }: AccountsViewProps) {
  const { accounts, getActiveAccount } = useAppStore();
  const activeAccount = getActiveAccount();

  return (
    <div className="view-transition">
      <h1 className="page-title">Accounts</h1>
      <p style={{ margin: "-24px 0 24px", fontSize: 14, color: "var(--text-secondary)" }}>
        Manage your Microsoft accounts for Minecraft.
      </p>

      {accounts?.accounts.map((account) => (
        <div key={account.uuid} className="setting-row">
          <div className="setting-label">
            <h4>{account.username}</h4>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{account.uuid}</p>
          </div>
          <div className="setting-control">
            {accounts.active === account.uuid ? (
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Active</span>
            ) : (
              <button className="btn-secondary btn-sm" onClick={() => onSetActive(account.uuid)}>Use</button>
            )}
            <button className="btn-ghost btn-sm" onClick={() => onRemove(account)}>Remove</button>
          </div>
        </div>
      ))}

      {(!accounts || accounts.accounts.length === 0) && (
        <div className="empty-state">
          <h3>No accounts</h3>
          <p>Add a Microsoft account to play Minecraft.</p>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <button className="btn-primary" onClick={onAdd}>Add account</button>
      </div>
    </div>
  );
}
