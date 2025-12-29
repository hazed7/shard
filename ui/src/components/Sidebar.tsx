import clsx from "clsx";
import { useAppStore } from "../store";
import type { SidebarView } from "../types";

interface SidebarProps {
  onCreateProfile: () => void;
  onCloneProfile: () => void;
  onDiffProfiles: () => void;
  onAddAccount: () => void;
}

export function Sidebar({
  onCreateProfile,
  onCloneProfile,
  onDiffProfiles,
  onAddAccount,
}: SidebarProps) {
  const {
    profiles,
    profile,
    selectedProfileId,
    setSelectedProfileId,
    profileFilter,
    setProfileFilter,
    sidebarView,
    setSidebarView,
    getActiveAccount,
  } = useAppStore();

  const activeAccount = getActiveAccount();

  const filteredProfiles = (() => {
    const query = profileFilter.trim().toLowerCase();
    if (!query) return profiles;
    return profiles.filter((id) => id.toLowerCase().includes(query));
  })();

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-header">Profiles</div>
      </div>
      <div className="sidebar-search">
        <input
          value={profileFilter}
          onChange={(e) => setProfileFilter(e.target.value)}
          placeholder="Search…"
          data-tauri-drag-region="false"
        />
      </div>
      <div className="profile-list">
        {filteredProfiles.map((id) => (
          <button
            key={id}
            className={clsx("sidebar-item", selectedProfileId === id && "active")}
            onClick={() => {
              setSelectedProfileId(id);
              setSidebarView("profiles");
            }}
            data-tauri-drag-region="false"
          >
            <span>{id}</span>
            {selectedProfileId === id && <span className="indicator" />}
          </button>
        ))}
        {filteredProfiles.length === 0 && (
          <div style={{ padding: "8px 12px", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            No profiles
          </div>
        )}
      </div>

      <div className="sidebar-divider" />

      <div className="sidebar-section">
        <button className="sidebar-item primary-action" onClick={onCreateProfile} data-tauri-drag-region="false">
          <span>+ New profile</span>
          <span className="kbd" style={{ marginLeft: "auto" }}>⌘N</span>
        </button>
        <button className="sidebar-item" onClick={onCloneProfile} data-tauri-drag-region="false" disabled={!profile}>
          Clone profile
        </button>
        <button className="sidebar-item" onClick={onDiffProfiles} data-tauri-drag-region="false">
          Compare profiles
        </button>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-header" style={{ padding: "0 0 8px" }}>Account</div>
        {activeAccount ? (
          <div className="account-badge">
            <div className="account-badge-avatar">{activeAccount.username.charAt(0).toUpperCase()}</div>
            <div className="account-badge-info">
              <div className="account-badge-name">{activeAccount.username}</div>
              <div className="account-badge-uuid">{activeAccount.uuid.slice(0, 8)}…</div>
            </div>
          </div>
        ) : (
          <button className="btn-secondary btn-sm w-full" onClick={onAddAccount} data-tauri-drag-region="false">
            Add account
          </button>
        )}
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button
            className={clsx("sidebar-item", sidebarView === "accounts" && "active")}
            style={{ flex: 1, justifyContent: "center" }}
            onClick={() => setSidebarView("accounts")}
            data-tauri-drag-region="false"
          >
            Accounts
          </button>
          <button
            className={clsx("sidebar-item", sidebarView === "settings" && "active")}
            style={{ flex: 1, justifyContent: "center" }}
            onClick={() => setSidebarView("settings")}
            data-tauri-drag-region="false"
          >
            Settings
          </button>
        </div>
      </div>
    </aside>
  );
}
