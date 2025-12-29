import React, { useEffect, useMemo, useState, useCallback } from "react";
import ReactDOM from "react-dom";
import clsx from "clsx";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open as dialogOpen } from "@tauri-apps/plugin-dialog";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";

type ContentRef = {
  name: string;
  hash: string;
  version?: string | null;
  source?: string | null;
  file_name?: string | null;
};

type Loader = {
  type: string;
  version: string;
};

type Runtime = {
  java?: string | null;
  memory?: string | null;
  args: string[];
};

type Profile = {
  id: string;
  mcVersion: string;
  loader?: Loader | null;
  mods: ContentRef[];
  resourcepacks: ContentRef[];
  shaderpacks: ContentRef[];
  runtime: Runtime;
};

type Account = {
  uuid: string;
  username: string;
  xuid?: string | null;
};

type Accounts = {
  active?: string | null;
  accounts: Account[];
};

type Config = {
  msa_client_id?: string | null;
  msa_client_secret?: string | null;
};

type DeviceCode = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  message: string;
  expires_in: number;
  interval: number;
};

type LaunchPlan = {
  instance_dir: string;
  java_exec: string;
  jvm_args: string[];
  classpath: string;
  main_class: string;
  game_args: string[];
};

type DiffResult = {
  only_a: string[];
  only_b: string[];
  both: string[];
};

const NO_DRAG_SELECTOR = [
  "button",
  "input",
  "select",
  "textarea",
  "a",
  "label",
  "[role='button']",
  "[contenteditable='true']",
  "[data-tauri-drag-region='false']",
  ".modal",
  ".modal-backdrop",
  ".no-drag"
].join(",");

type LaunchEvent = {
  stage: string;
  message?: string | null;
};

type ManifestVersion = {
  id: string;
  type: string;
  releaseTime?: string;
};

type ContentTab = "mods" | "resourcepacks" | "shaderpacks";
type SidebarView = "profiles" | "accounts" | "settings";

type ModalType =
  | "create"
  | "clone"
  | "diff"
  | "json"
  | "add-content"
  | "prepare"
  | "device-code";

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: "danger" | "default";
  onConfirm: () => void | Promise<void>;
};

function App() {
  const [profiles, setProfiles] = useState<string[]>([]);
  const [profileFilter, setProfileFilter] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accounts, setAccounts] = useState<Accounts | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [activeTab, setActiveTab] = useState<ContentTab>("mods");
  const [sidebarView, setSidebarView] = useState<SidebarView>("profiles");
  const [activeModal, setActiveModal] = useState<ModalType | null>(null);
  const [toast, setToast] = useState<{ title: string; detail?: string } | null>(null);
  const [launchStatus, setLaunchStatus] = useState<LaunchEvent | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [debugDrag, setDebugDrag] = useState(false);
  const isOnline = useOnline();

  const [createForm, setCreateForm] = useState({
    id: "",
    mcVersion: "",
    loaderType: "",
    loaderVersion: "",
    java: "",
    memory: "",
    args: ""
  });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [mcVersions, setMcVersions] = useState<ManifestVersion[]>([]);
  const [mcVersionLoading, setMcVersionLoading] = useState(false);
  const [loaderVersions, setLoaderVersions] = useState<string[]>([]);
  const [loaderLoading, setLoaderLoading] = useState(false);

  const [cloneForm, setCloneForm] = useState({ src: "", dst: "" });
  const [cloneErrors, setCloneErrors] = useState<Record<string, string>>({});

  const [diffForm, setDiffForm] = useState({ a: "", b: "" });
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [diffErrors, setDiffErrors] = useState<Record<string, string>>({});

  const [contentForm, setContentForm] = useState({ input: "", url: "", name: "", version: "" });
  const [contentKind, setContentKind] = useState<ContentTab>("mods");
  const [contentErrors, setContentErrors] = useState<Record<string, string>>({});

  const [deviceCode, setDeviceCode] = useState<DeviceCode | null>(null);
  const [devicePending, setDevicePending] = useState(false);

  const [plan, setPlan] = useState<LaunchPlan | null>(null);

  const filteredProfiles = useMemo(() => {
    const query = profileFilter.trim().toLowerCase();
    if (!query) return profiles;
    return profiles.filter((id) => id.toLowerCase().includes(query));
  }, [profiles, profileFilter]);

  const visibleVersions = useMemo(() => {
    return mcVersions.filter((entry) => showSnapshots || entry.type === "release");
  }, [mcVersions, showSnapshots]);

  const latestRelease = useMemo(() => {
    return mcVersions.find((entry) => entry.type === "release")?.id;
  }, [mcVersions]);

  const activeAccount = useMemo(() => {
    if (!accounts) return null;
    const id = selectedAccountId ?? accounts.active ?? null;
    return accounts.accounts.find((account) => account.uuid === id) ?? null;
  }, [accounts, selectedAccountId]);

  const contentItems = useMemo(() => {
    if (!profile) return [] as ContentRef[];
    if (activeTab === "mods") return profile.mods;
    if (activeTab === "resourcepacks") return profile.resourcepacks;
    return profile.shaderpacks;
  }, [profile, activeTab]);

  const contentCounts = useMemo(() => {
    if (!profile) return { mods: 0, resourcepacks: 0, shaderpacks: 0 };
    return {
      mods: profile.mods.length,
      resourcepacks: profile.resourcepacks.length,
      shaderpacks: profile.shaderpacks.length
    };
  }, [profile]);

  useEffect(() => {
    void loadInitial();
  }, []);

  useEffect(() => {
    if (!selectedProfileId) {
      setProfile(null);
      return;
    }
    void loadProfile(selectedProfileId);
  }, [selectedProfileId]);

  useEffect(() => {
    const unlisten = listen<LaunchEvent>("launch-status", (event) => {
      setLaunchStatus(event.payload);
      if (event.payload.stage === "error") {
        notify("Launch failed", event.payload.message ?? "Unknown error");
      }
      if (event.payload.stage === "done") {
        setTimeout(() => setLaunchStatus(null), 2500);
      }
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      // Debug mode toggle: Cmd+Shift+D
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        setDebugDrag((prev) => !prev);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        openCreateModal();
        return;
      }
      if (event.key === "Escape") {
        if (confirmState) {
          setConfirmState(null);
          return;
        }
        if (activeModal) {
          setActiveModal(null);
          return;
        }
      }
      if (event.key === "Enter" && activeModal) {
        if (confirmState) {
          event.preventDefault();
          void confirmState.onConfirm();
          return;
        }
        if (activeModal === "create") {
          event.preventDefault();
          void handleCreateProfile();
        } else if (activeModal === "clone") {
          event.preventDefault();
          void handleCloneProfile();
        } else if (activeModal === "add-content") {
          event.preventDefault();
          void handleAddContent();
        } else if (activeModal === "device-code" && deviceCode && !devicePending) {
          event.preventDefault();
          void handleFinishDeviceCode();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeModal, confirmState, deviceCode, devicePending]);

  // Window dragging via Tauri's startDragging API
  // This is needed because data-tauri-drag-region has known issues in Tauri 2.x on macOS
  useEffect(() => {
    const handleMouseDown = async (e: MouseEvent) => {
      // Only handle primary (left) mouse button
      if (e.button !== 0) return;

      const target = e.target as HTMLElement;

      // Check if the click is on the titlebar drag region or an element with data-tauri-drag-region
      const dragRegion = target.closest(".titlebar-drag-region, [data-tauri-drag-region='true'], .drag-region");
      if (!dragRegion) return;

      // Don't drag if clicking on an interactive element
      if (target.closest(NO_DRAG_SELECTOR)) return;

      // Prevent default to avoid text selection during drag
      e.preventDefault();

      try {
        const appWindow = getCurrentWindow();
        if (e.detail === 2) {
          // Double-click to toggle maximize
          const isMaximized = await appWindow.isMaximized();
          if (isMaximized) {
            await appWindow.unmaximize();
          } else {
            await appWindow.maximize();
          }
        } else {
          // Single click - start dragging
          await appWindow.startDragging();
        }
      } catch (err) {
        // Silently ignore errors (e.g., when running in browser during dev)
        console.debug("Window drag not available:", err);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  const loadInitial = async () => {
    await Promise.all([loadProfiles(), loadAccounts(), loadConfig()]);
  };

  const fetchMinecraftVersions = async () => {
    setMcVersionLoading(true);
    try {
      const resp = await fetch("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json");
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const list = (data.versions ?? []).map((entry: any) => ({
        id: String(entry.id),
        type: String(entry.type),
        releaseTime: entry.releaseTime
      })) as ManifestVersion[];
      setMcVersions(list);
      if (!createForm.mcVersion && data.latest?.release) {
        setCreateForm((prev) => ({ ...prev, mcVersion: data.latest.release }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMcVersionLoading(false);
    }
  };

  const fetchLoaderVersions = async () => {
    setLoaderLoading(true);
    try {
      const resp = await fetch("https://meta.fabricmc.net/v2/versions/loader");
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const versions = (data ?? [])
        .map((entry: any) => entry?.loader?.version)
        .filter((v: string | undefined) => !!v) as string[];
      setLoaderVersions(Array.from(new Set(versions)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoaderLoading(false);
    }
  };

  const loadProfiles = async () => {
    try {
      const list = await invoke<string[]>("list_profiles_cmd");
      setProfiles(list);
      if (!selectedProfileId && list.length > 0) {
        setSelectedProfileId(list[0]);
      }
    } catch (err) {
      notify("Failed to load profiles", String(err));
    }
  };

  const loadProfile = async (id: string) => {
    try {
      const data = await invoke<Profile>("load_profile_cmd", { id });
      setProfile(data);
    } catch (err) {
      notify("Failed to load profile", String(err));
    }
  };

  const loadAccounts = async () => {
    try {
      const data = await invoke<Accounts>("list_accounts_cmd");
      setAccounts(data);
      if (!selectedAccountId) {
        setSelectedAccountId(data.active ?? data.accounts[0]?.uuid ?? null);
      }
    } catch (err) {
      notify("Failed to load accounts", String(err));
    }
  };

  const loadConfig = async () => {
    try {
      const data = await invoke<Config>("get_config_cmd");
      setConfig(data);
    } catch (err) {
      notify("Failed to load config", String(err));
    }
  };

  const notify = (title: string, detail?: string) => {
    setToast({ title, detail });
    setTimeout(() => setToast(null), 3800);
  };

  const runAction = async (action: () => Promise<void>) => {
    setIsWorking(true);
    try {
      await action();
    } catch (err) {
      notify("Action failed", String(err));
    } finally {
      setIsWorking(false);
    }
  };

  const openCreateModal = () => {
    setCreateForm({ id: "", mcVersion: "", loaderType: "", loaderVersion: "", java: "", memory: "", args: "" });
    setCreateErrors({});
    setActiveModal("create");
    if (mcVersions.length === 0) void fetchMinecraftVersions();
  };

  const openCloneModal = () => {
    setCloneForm({ src: selectedProfileId ?? "", dst: "" });
    setCloneErrors({});
    setActiveModal("clone");
  };

  const openDiffModal = () => {
    setDiffForm({ a: selectedProfileId ?? "", b: "" });
    setDiffResult(null);
    setDiffErrors({});
    setActiveModal("diff");
  };

  const openAddContentModal = (kind: ContentTab) => {
    setContentForm({ input: "", url: "", name: "", version: "" });
    setContentKind(kind);
    setContentErrors({});
    setActiveModal("add-content");
  };

  const openDeviceCodeModal = () => {
    setDeviceCode(null);
    setDevicePending(false);
    setActiveModal("device-code");
  };

  useEffect(() => {
    if (activeModal === "create" && createForm.loaderType === "fabric" && loaderVersions.length === 0 && !loaderLoading) {
      void fetchLoaderVersions();
    }
  }, [activeModal, createForm.loaderType, loaderVersions.length, loaderLoading]);

  const handleCreateProfile = async () => {
    const errors: Record<string, string> = {};
    if (!createForm.id.trim()) errors.id = "Required";
    if (!createForm.mcVersion.trim()) errors.mcVersion = "Required";
    if (createForm.loaderType && !createForm.loaderVersion.trim()) errors.loaderVersion = "Required";
    setCreateErrors(errors);
    if (Object.keys(errors).length > 0) return;

    await runAction(async () => {
      const payload = {
        id: createForm.id.trim(),
        mc_version: createForm.mcVersion.trim(),
        loader_type: createForm.loaderType.trim() || null,
        loader_version: createForm.loaderVersion.trim() || null,
        java: createForm.java.trim() || null,
        memory: createForm.memory.trim() || null,
        args: createForm.args.trim() || null
      };
      await invoke<Profile>("create_profile_cmd", { input: payload });
      await loadProfiles();
      setSelectedProfileId(payload.id);
      setActiveModal(null);
    });
  };

  const handleCloneProfile = async () => {
    const errors: Record<string, string> = {};
    if (!cloneForm.src.trim()) errors.src = "Required";
    if (!cloneForm.dst.trim()) errors.dst = "Required";
    if (cloneForm.src === cloneForm.dst) errors.dst = "Must be different";
    setCloneErrors(errors);
    if (Object.keys(errors).length > 0) return;

    await runAction(async () => {
      await invoke("clone_profile_cmd", { src: cloneForm.src, dst: cloneForm.dst });
      await loadProfiles();
      setSelectedProfileId(cloneForm.dst);
      setActiveModal(null);
    });
  };

  const handleDiffProfiles = async () => {
    const errors: Record<string, string> = {};
    if (!diffForm.a) errors.a = "Required";
    if (!diffForm.b) errors.b = "Required";
    if (diffForm.a && diffForm.b && diffForm.a === diffForm.b) errors.b = "Pick different profile";
    setDiffErrors(errors);
    if (Object.keys(errors).length > 0) return;

    await runAction(async () => {
      const result = await invoke<DiffResult>("diff_profiles_cmd", { a: diffForm.a, b: diffForm.b });
      setDiffResult(result);
    });
  };

  const handleAddContent = async () => {
    if (!selectedProfileId) return;
    const inputValue = contentForm.input || contentForm.url;
    const errors: Record<string, string> = {};
    if (!inputValue) errors.input = "Pick a file or paste a URL";
    setContentErrors(errors);
    if (Object.keys(errors).length > 0) return;

    await runAction(async () => {
      const payload = {
        profile_id: selectedProfileId,
        input: inputValue,
        name: contentForm.name.trim() || null,
        version: contentForm.version.trim() || null
      };
      if (contentKind === "mods") await invoke("add_mod_cmd", payload);
      else if (contentKind === "resourcepacks") await invoke("add_resourcepack_cmd", payload);
      else await invoke("add_shaderpack_cmd", payload);
      await loadProfile(selectedProfileId);
      setActiveModal(null);
    });
  };

  const handleRemoveContent = (item: ContentRef) => {
    if (!selectedProfileId) return;
    setConfirmState({
      title: `Remove ${item.name}?`,
      message: "This removes it from the profile but keeps the stored file.",
      confirmLabel: "Remove",
      tone: "danger",
      onConfirm: async () => {
        setConfirmState(null);
        await runAction(async () => {
          const payload = { profile_id: selectedProfileId, target: item.hash };
          if (activeTab === "mods") await invoke("remove_mod_cmd", payload);
          else if (activeTab === "resourcepacks") await invoke("remove_resourcepack_cmd", payload);
          else await invoke("remove_shaderpack_cmd", payload);
          await loadProfile(selectedProfileId);
        });
      }
    });
  };

  const handleLaunch = async () => {
    if (!selectedProfileId || !activeAccount) {
      notify("No account", "Add an account first.");
      return;
    }
    await runAction(async () => {
      await invoke("launch_profile_cmd", {
        profile_id: selectedProfileId,
        account_id: activeAccount.uuid
      });
      setLaunchStatus({ stage: "queued" });
    });
  };

  const handlePrepare = async () => {
    if (!selectedProfileId || !activeAccount) {
      notify("No account", "Add an account first.");
      return;
    }
    await runAction(async () => {
      const planData = await invoke<LaunchPlan>("prepare_profile_cmd", {
        profile_id: selectedProfileId,
        account_id: activeAccount.uuid
      });
      setPlan(planData);
      setActiveModal("prepare");
    });
  };

  const handleOpenInstance = async () => {
    if (!selectedProfileId) return;
    const path = await invoke<string>("instance_path_cmd", { profile_id: selectedProfileId });
    await openPath(path);
  };

  const handleCopyCommand = async () => {
    if (!selectedProfileId) return;
    const command = `shard launch ${selectedProfileId}`;
    await navigator.clipboard.writeText(command);
    notify("Copied", command);
  };

  const handleFilePick = async () => {
    const selected = await dialogOpen({ multiple: false, directory: false });
    if (typeof selected === "string") {
      setContentForm((prev) => ({ ...prev, input: selected }));
    }
  };

  const handleRequestDeviceCode = async () => {
    await runAction(async () => {
      const data = await invoke<DeviceCode>("request_device_code_cmd", {
        client_id: config?.msa_client_id ?? null,
        client_secret: config?.msa_client_secret ?? null
      });
      setDeviceCode(data);
    });
  };

  const handleFinishDeviceCode = async () => {
    if (!deviceCode) return;
    setDevicePending(true);
    try {
      await invoke("finish_device_code_flow_cmd", {
        client_id: config?.msa_client_id ?? null,
        client_secret: config?.msa_client_secret ?? null,
        device: deviceCode
      });
      await loadAccounts();
      setActiveModal(null);
    } catch (err) {
      notify("Sign-in failed", String(err));
    } finally {
      setDevicePending(false);
    }
  };

  const handleSaveConfig = async () => {
    await runAction(async () => {
      const updated = await invoke<Config>("save_config_cmd", {
        client_id: config?.msa_client_id ?? null,
        client_secret: config?.msa_client_secret ?? null
      });
      setConfig(updated);
      notify("Settings saved");
    });
  };

  const handleRemoveAccount = (account: Account) => {
    setConfirmState({
      title: `Remove ${account.username}?`,
      message: "This account will be disconnected from Shard.",
      confirmLabel: "Remove",
      tone: "danger",
      onConfirm: async () => {
        setConfirmState(null);
        await runAction(async () => {
          await invoke("remove_account_cmd", { id: account.uuid });
          await loadAccounts();
        });
      }
    });
  };

  const formatSource = (source?: string | null) => {
    if (!source) return null;
    try {
      return new URL(source).host.replace(/^www\./, "");
    } catch {
      return source;
    }
  };

  return (
    <div className={clsx("app-root", debugDrag && "debug-drag")}>
      {/* Title bar drag region for window dragging */}
      <div className="titlebar-drag-region" />
      {/* Visual background for sidebar area in titlebar (pointer-events: none) */}
      <div className="sidebar-titlebar-bg" />

      {/* Offline Indicator */}
      {!isOnline && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: "var(--accent-danger)",
          zIndex: 100,
          opacity: 0.8
        }} title="You are offline" />
      )}

      <div className="app-layout drag-region">
      {/* Sidebar */}
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
          <button className="sidebar-item primary-action" onClick={openCreateModal} data-tauri-drag-region="false">
            <span>+ New profile</span>
            <span className="kbd" style={{ marginLeft: "auto" }}>⌘N</span>
          </button>
          <button className="sidebar-item" onClick={openCloneModal} data-tauri-drag-region="false" disabled={!profile}>
            Clone profile
          </button>
          <button className="sidebar-item" onClick={openDiffModal} data-tauri-drag-region="false">
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
            <button className="btn-secondary btn-sm w-full" onClick={openDeviceCodeModal} data-tauri-drag-region="false">
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

      {/* Main content */}
      <main className="main-content">
        <div className="content-area">
          {sidebarView === "profiles" && profile && <ProfileView
            key={profile.id}
            profile={profile}
            accounts={accounts}
            activeAccount={activeAccount}
            selectedAccountId={selectedAccountId}
            setSelectedAccountId={setSelectedAccountId}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            contentItems={contentItems}
            contentCounts={contentCounts}
            isWorking={isWorking}
            onLaunch={handleLaunch}
            onPrepare={handlePrepare}
            onOpenInstance={handleOpenInstance}
            onCopyCommand={handleCopyCommand}
            onShowJson={() => setActiveModal("json")}
            onAddContent={openAddContentModal}
            onRemoveContent={handleRemoveContent}
            formatSource={formatSource}
          />}

          {sidebarView === "profiles" && !profile && (
            <div className="empty-state">
              <h3>No profile selected</h3>
              <p>Create your first profile to start launching Minecraft.</p>
              <button className="btn-primary" onClick={openCreateModal}>Create profile</button>
            </div>
          )}

          {sidebarView === "accounts" && <AccountsView
            accounts={accounts}
            activeAccount={activeAccount}
            onSetActive={async (id) => {
              await runAction(async () => {
                await invoke("set_active_account_cmd", { id });
                await loadAccounts();
                setSelectedAccountId(id);
              });
            }}
            onRemove={handleRemoveAccount}
            onAdd={openDeviceCodeModal}
          />}

          {sidebarView === "settings" && <SettingsView
            config={config}
            setConfig={setConfig}
            onSave={handleSaveConfig}
          />}
        </div>
      </main>

      {/* Launch status bar */}
      {launchStatus && (
        <div className="launch-status">
          <div className="launch-status-dot" />
          <div className="launch-status-text">
            {launchStatus.stage}
            {launchStatus.message && ` — ${launchStatus.message}`}
          </div>
        </div>
      )}
      </div>

      {/* Modals */}
      <Modal open={activeModal === "create"} onClose={() => setActiveModal(null)} title="Create profile">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Profile ID" error={createErrors.id}>
            <input
              className={clsx("input", createErrors.id && "input-error")}
              value={createForm.id}
              onChange={(e) => setCreateForm({ ...createForm, id: e.target.value })}
              placeholder="my-modpack"
            />
          </Field>
          <Field label="Minecraft version" error={createErrors.mcVersion}>
            <select
              className={clsx("input", createErrors.mcVersion && "input-error")}
              value={createForm.mcVersion}
              onChange={(e) => setCreateForm({ ...createForm, mcVersion: e.target.value })}
            >
              <option value="">{mcVersionLoading ? "Loading…" : "Select version"}</option>
              {visibleVersions.map((v) => (
                <option key={v.id} value={v.id}>{v.id}{v.type === "snapshot" ? " (snapshot)" : ""}</option>
              ))}
            </select>
            <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
              <button type="button" className="link" onClick={() => setShowSnapshots(!showSnapshots)}>
                {showSnapshots ? "Hide snapshots" : "Show snapshots"}
              </button>
              {latestRelease && (
                <button type="button" className="link" onClick={() => setCreateForm((p) => ({ ...p, mcVersion: latestRelease }))}>
                  Use latest ({latestRelease})
                </button>
              )}
            </div>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Loader" error={createErrors.loaderType}>
              <select
                className="input"
                value={createForm.loaderType || "none"}
                onChange={(e) => setCreateForm((p) => ({
                  ...p,
                  loaderType: e.target.value === "none" ? "" : e.target.value,
                  loaderVersion: e.target.value === "none" ? "" : p.loaderVersion
                }))}
              >
                <option value="none">None (Vanilla)</option>
                <option value="fabric">Fabric</option>
              </select>
            </Field>
            <Field label="Loader version" error={createErrors.loaderVersion}>
              <select
                className={clsx("input", createErrors.loaderVersion && "input-error")}
                value={createForm.loaderVersion}
                onChange={(e) => setCreateForm({ ...createForm, loaderVersion: e.target.value })}
                disabled={!createForm.loaderType}
              >
                <option value="">{loaderLoading ? "Loading…" : "Select version"}</option>
                {loaderVersions.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Java path (optional)">
              <input className="input" value={createForm.java} onChange={(e) => setCreateForm({ ...createForm, java: e.target.value })} placeholder="/usr/bin/java" />
            </Field>
            <Field label="Memory (optional)">
              <input className="input" value={createForm.memory} onChange={(e) => setCreateForm({ ...createForm, memory: e.target.value })} placeholder="4G" />
            </Field>
          </div>
          <Field label="Extra JVM args (optional)">
            <input className="input" value={createForm.args} onChange={(e) => setCreateForm({ ...createForm, args: e.target.value })} placeholder="-Dfile.encoding=UTF-8" />
          </Field>
          <div className="modal-footer">
            <button className="btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
            <button className="btn-primary" onClick={handleCreateProfile}>Create</button>
          </div>
        </div>
      </Modal>

      <Modal open={activeModal === "clone"} onClose={() => setActiveModal(null)} title="Clone profile">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Source profile" error={cloneErrors.src}>
            <select className={clsx("input", cloneErrors.src && "input-error")} value={cloneForm.src} onChange={(e) => setCloneForm({ ...cloneForm, src: e.target.value })}>
              <option value="">Select profile</option>
              {profiles.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </Field>
          <Field label="New profile ID" error={cloneErrors.dst}>
            <input className={clsx("input", cloneErrors.dst && "input-error")} value={cloneForm.dst} onChange={(e) => setCloneForm({ ...cloneForm, dst: e.target.value })} placeholder="my-modpack-copy" />
          </Field>
          <div className="modal-footer">
            <button className="btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
            <button className="btn-primary" onClick={handleCloneProfile}>Clone</button>
          </div>
        </div>
      </Modal>

      <Modal open={activeModal === "diff"} onClose={() => setActiveModal(null)} title="Compare profiles" large>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Profile A" error={diffErrors.a}>
              <select className={clsx("input", diffErrors.a && "input-error")} value={diffForm.a} onChange={(e) => setDiffForm({ ...diffForm, a: e.target.value })}>
                <option value="">Select</option>
                {profiles.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            </Field>
            <Field label="Profile B" error={diffErrors.b}>
              <select className={clsx("input", diffErrors.b && "input-error")} value={diffForm.b} onChange={(e) => setDiffForm({ ...diffForm, b: e.target.value })}>
                <option value="">Select</option>
                {profiles.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            </Field>
          </div>
          <button className="btn-primary" onClick={handleDiffProfiles}>Compare</button>
          {diffResult && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 8 }}>
              <div>
                <div className="field-label">Only in A</div>
                {diffResult.only_a.length === 0 ? <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>—</div> : diffResult.only_a.map((n) => <div key={n} style={{ fontSize: 13 }}>{n}</div>)}
              </div>
              <div>
                <div className="field-label">Only in B</div>
                {diffResult.only_b.length === 0 ? <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>—</div> : diffResult.only_b.map((n) => <div key={n} style={{ fontSize: 13 }}>{n}</div>)}
              </div>
              <div>
                <div className="field-label">In both</div>
                {diffResult.both.length === 0 ? <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>—</div> : diffResult.both.map((n) => <div key={n} style={{ fontSize: 13 }}>{n}</div>)}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal open={activeModal === "json"} onClose={() => setActiveModal(null)} title="Profile JSON" large>
        <pre style={{ background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: 16, fontSize: 12, fontFamily: "var(--font-mono)", overflow: "auto", maxHeight: 400 }}>
          {profile ? JSON.stringify(profile, null, 2) : "No profile"}
        </pre>
      </Modal>

      <Modal open={activeModal === "add-content"} onClose={() => setActiveModal(null)} title={`Add ${contentKind === "mods" ? "mod" : contentKind === "resourcepacks" ? "resource pack" : "shader pack"}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <button className="btn-secondary" onClick={handleFilePick}>Choose file…</button>
          {contentForm.input && <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.6)", wordBreak: "break-all" }}>{contentForm.input}</div>}
          <Field label="Or paste a URL" error={contentErrors.input}>
            <input className={clsx("input", contentErrors.input && "input-error")} value={contentForm.url} onChange={(e) => setContentForm({ ...contentForm, url: e.target.value })} placeholder="https://modrinth.com/…" />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Name (optional)">
              <input className="input" value={contentForm.name} onChange={(e) => setContentForm({ ...contentForm, name: e.target.value })} />
            </Field>
            <Field label="Version (optional)">
              <input className="input" value={contentForm.version} onChange={(e) => setContentForm({ ...contentForm, version: e.target.value })} />
            </Field>
          </div>
          <div className="modal-footer">
            <button className="btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
            <button className="btn-primary" onClick={handleAddContent}>Add</button>
          </div>
        </div>
      </Modal>

      <Modal open={activeModal === "prepare"} onClose={() => setActiveModal(null)} title="Launch plan" large>
        {plan && (
          <div style={{ fontSize: 13, fontFamily: "var(--font-mono)", display: "flex", flexDirection: "column", gap: 8 }}>
            <div><span style={{ color: "rgba(255,255,255,0.5)" }}>instance:</span> {plan.instance_dir}</div>
            <div><span style={{ color: "rgba(255,255,255,0.5)" }}>java:</span> {plan.java_exec}</div>
            <div><span style={{ color: "rgba(255,255,255,0.5)" }}>main class:</span> {plan.main_class}</div>
            <div><span style={{ color: "rgba(255,255,255,0.5)" }}>jvm args:</span> {plan.jvm_args.join(" ")}</div>
            <div><span style={{ color: "rgba(255,255,255,0.5)" }}>game args:</span> {plan.game_args.join(" ")}</div>
          </div>
        )}
      </Modal>

      <Modal open={activeModal === "device-code"} onClose={() => setActiveModal(null)} title="Add Microsoft account">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!deviceCode ? (
            <>
              <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.6)" }}>
                Sign in with your Microsoft account to play Minecraft.
              </p>
              <button className="btn-primary" onClick={handleRequestDeviceCode}>Get sign-in code</button>
            </>
          ) : (
            <>
              <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: 20, textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Your code</div>
                <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: "0.1em", marginTop: 8 }}>{deviceCode.user_code}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 8 }}>{deviceCode.verification_uri}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => openUrl(deviceCode.verification_uri)}>Open browser</button>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => navigator.clipboard.writeText(deviceCode.user_code)}>Copy code</button>
              </div>
              <button className="btn-primary" onClick={handleFinishDeviceCode} disabled={devicePending}>
                {devicePending ? "Waiting…" : "I've signed in"}
              </button>
            </>
          )}
        </div>
      </Modal>

      {/* Confirm dialog */}
      {confirmState && (
        <div className="modal-backdrop" onClick={() => setConfirmState(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{confirmState.title}</h3>
            <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.6)" }}>{confirmState.message}</p>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmState(null)}>Cancel</button>
              <button className={confirmState.tone === "danger" ? "btn-danger" : "btn-primary"} onClick={confirmState.onConfirm}>
                {confirmState.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="toast">
          <div className="toast-title">{toast.title}</div>
          {toast.detail && <div className="toast-detail">{toast.detail}</div>}
        </div>
      )}
    </div>
  );
}

/* Profile View */
function ProfileView({
  profile,
  accounts,
  activeAccount,
  selectedAccountId,
  setSelectedAccountId,
  activeTab,
  setActiveTab,
  contentItems,
  contentCounts,
  isWorking,
  onLaunch,
  onPrepare,
  onOpenInstance,
  onCopyCommand,
  onShowJson,
  onAddContent,
  onRemoveContent,
  formatSource
}: {
  profile: Profile;
  accounts: Accounts | null;
  activeAccount: Account | null;
  selectedAccountId: string | null;
  setSelectedAccountId: (id: string | null) => void;
  activeTab: ContentTab;
  setActiveTab: (tab: ContentTab) => void;
  contentItems: ContentRef[];
  contentCounts: { mods: number; resourcepacks: number; shaderpacks: number };
  isWorking: boolean;
  onLaunch: () => void;
  onPrepare: () => void;
  onOpenInstance: () => void;
  onCopyCommand: () => void;
  onShowJson: () => void;
  onAddContent: (kind: ContentTab) => void;
  onRemoveContent: (item: ContentRef) => void;
  formatSource: (s?: string | null) => string | null;
}) {
  return (
    <div className="view-transition">
      <h1 className="page-title">{profile.id}</h1>

      {/* Profile details */}
      <div className="setting-row">
        <div className="setting-label">
          <h4>Minecraft version</h4>
          <p>Game version for this profile</p>
        </div>
        <div className="setting-control">
          <span style={{ fontSize: 14 }}>{profile.mcVersion}</span>
        </div>
      </div>

      <div className="setting-row">
        <div className="setting-label">
          <h4>Mod loader</h4>
          <p>Framework for loading mods</p>
        </div>
        <div className="setting-control">
          <span style={{ fontSize: 14 }}>{profile.loader ? `${profile.loader.type} ${profile.loader.version}` : "Vanilla"}</span>
        </div>
      </div>

      {profile.runtime.memory && (
        <div className="setting-row">
          <div className="setting-label">
            <h4>Memory</h4>
            <p>Allocated RAM for the game</p>
          </div>
          <div className="setting-control">
            <span style={{ fontSize: 14 }}>{profile.runtime.memory}</span>
          </div>
        </div>
      )}

      {profile.runtime.java && (
        <div className="setting-row">
          <div className="setting-label">
            <h4>Java</h4>
            <p>Custom Java runtime path</p>
          </div>
          <div className="setting-control">
            <span style={{ fontSize: 14, fontFamily: "var(--font-mono)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{profile.runtime.java}</span>
          </div>
        </div>
      )}

      {/* Launch row */}
      <div className="setting-row" style={{ paddingTop: 24, paddingBottom: 24, borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 8 }}>
        <div className="setting-label">
          <h4>Launch game</h4>
          <p>Select an account and start playing</p>
        </div>
        <div className="setting-control">
          <select
            className="select"
            value={activeAccount?.uuid ?? ""}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            style={{ minWidth: 140 }}
          >
            {accounts?.accounts.length ? (
              accounts.accounts.map((a) => <option key={a.uuid} value={a.uuid}>{a.username}</option>)
            ) : (
              <option value="">No accounts</option>
            )}
          </select>
          <button className="btn-primary" onClick={onLaunch} disabled={!activeAccount || isWorking}>
            Launch
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn-ghost btn-sm" onClick={onOpenInstance}>Open folder</button>
        <button className="btn-ghost btn-sm" onClick={onCopyCommand}>Copy CLI command</button>
        <button className="btn-ghost btn-sm" onClick={onPrepare}>View launch plan</button>
        <button className="btn-ghost btn-sm" onClick={onShowJson}>View JSON</button>
      </div>

      {/* Content section */}
      <div className="section-header" style={{ marginTop: 40 }}>
        <span>Content</span>
        <button className="link" style={{ fontSize: 12 }} onClick={() => onAddContent(activeTab)}>+ Add {activeTab === "mods" ? "mod" : activeTab === "resourcepacks" ? "resource pack" : "shader pack"}</button>
      </div>

      <div className="content-tabs">
        <button className={clsx("content-tab", activeTab === "mods" && "active")} onClick={() => setActiveTab("mods")}>
          Mods<span className="count">{contentCounts.mods}</span>
        </button>
        <button className={clsx("content-tab", activeTab === "resourcepacks" && "active")} onClick={() => setActiveTab("resourcepacks")}>
          Resource Packs<span className="count">{contentCounts.resourcepacks}</span>
        </button>
        <button className={clsx("content-tab", activeTab === "shaderpacks" && "active")} onClick={() => setActiveTab("shaderpacks")}>
          Shaders<span className="count">{contentCounts.shaderpacks}</span>
        </button>
      </div>

      {contentItems.length === 0 ? (
        <div className="empty-state">
          <h3>No {activeTab === "mods" ? "mods" : activeTab === "resourcepacks" ? "resource packs" : "shaders"} yet</h3>
          <p>Add your first one to get started.</p>
          <button className="btn-secondary btn-sm" onClick={() => onAddContent(activeTab)}>Add {activeTab === "mods" ? "mod" : activeTab === "resourcepacks" ? "resource pack" : "shader pack"}</button>
        </div>
      ) : (
        <div>
          {contentItems.map((item) => (
            <div key={item.hash} className="content-item">
              <div className="content-item-info">
                <h5>{item.name}</h5>
                <p>
                  {[
                    item.version && `v${item.version}`,
                    formatSource(item.source),
                    item.file_name
                  ].filter(Boolean).join(" · ") || item.hash.slice(0, 12)}
                </p>
              </div>
              <div className="content-item-actions">
                <button className="btn-ghost btn-sm" onClick={() => onRemoveContent(item)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Accounts View */
function AccountsView({
  accounts,
  activeAccount,
  onSetActive,
  onRemove,
  onAdd
}: {
  accounts: Accounts | null;
  activeAccount: Account | null;
  onSetActive: (id: string) => void;
  onRemove: (account: Account) => void;
  onAdd: () => void;
}) {
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

/* Settings View */
function SettingsView({
  config,
  setConfig,
  onSave
}: {
  config: Config | null;
  setConfig: React.Dispatch<React.SetStateAction<Config | null>>;
  onSave: () => void;
}) {
  return (
    <div className="view-transition">
      <h1 className="page-title">Settings</h1>

      <div className="setting-row">
        <div className="setting-label">
          <h4>Microsoft Client ID</h4>
          <p>Your Azure app client ID for authentication</p>
        </div>
        <div className="setting-control">
          <input
            className="input"
            style={{ width: 240 }}
            value={config?.msa_client_id ?? ""}
            onChange={(e) => setConfig((p) => ({ ...p, msa_client_id: e.target.value }))}
            placeholder="Enter client ID"
          />
        </div>
      </div>

      <div className="setting-row">
        <div className="setting-label">
          <h4>Microsoft Client Secret</h4>
          <p>Optional client secret for confidential apps</p>
        </div>
        <div className="setting-control">
          <input
            className="input"
            style={{ width: 240 }}
            type="password"
            value={config?.msa_client_secret ?? ""}
            onChange={(e) => setConfig((p) => ({ ...p, msa_client_secret: e.target.value }))}
            placeholder="Enter client secret"
          />
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <button className="btn-primary" onClick={onSave}>Save settings</button>
      </div>
    </div>
  );
}

/* Modal component */
function Modal({
  open,
  onClose,
  title,
  large,
  children
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  large?: boolean;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return ReactDOM.createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className={clsx("modal", large && "modal-lg")} onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{title}</h3>
        {children}
      </div>
    </div>,
    document.body
  );
}

/* Field component */
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}

function useOnline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  return isOnline;
}

export default App;
