import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type {
  Profile,
  Accounts,
  Config,
  ContentTab,
  SidebarView,
  ModalType,
  ConfirmState,
  Toast,
  LaunchEvent,
  LaunchPlan,
  DeviceCode,
  DiffResult,
  ManifestVersion,
} from "../types";

interface AppState {
  // Core data
  profiles: string[];
  profile: Profile | null;
  selectedProfileId: string | null;
  accounts: Accounts | null;
  selectedAccountId: string | null;
  config: Config | null;

  // UI state
  profileFilter: string;
  activeTab: ContentTab;
  sidebarView: SidebarView;
  activeModal: ModalType | null;
  toast: Toast | null;
  launchStatus: LaunchEvent | null;
  isWorking: boolean;
  confirmState: ConfirmState | null;
  debugDrag: boolean;

  // Modal-specific state
  plan: LaunchPlan | null;
  deviceCode: DeviceCode | null;
  devicePending: boolean;
  diffResult: DiffResult | null;

  // Minecraft versions
  mcVersions: ManifestVersion[];
  mcVersionLoading: boolean;
  loaderVersions: string[];
  loaderLoading: boolean;

  // Actions
  setProfiles: (profiles: string[]) => void;
  setProfile: (profile: Profile | null) => void;
  setSelectedProfileId: (id: string | null) => void;
  setAccounts: (accounts: Accounts | null) => void;
  setSelectedAccountId: (id: string | null) => void;
  setConfig: (config: Config | null) => void;
  setProfileFilter: (filter: string) => void;
  setActiveTab: (tab: ContentTab) => void;
  setSidebarView: (view: SidebarView) => void;
  setActiveModal: (modal: ModalType | null) => void;
  setToast: (toast: Toast | null) => void;
  setLaunchStatus: (status: LaunchEvent | null) => void;
  setIsWorking: (working: boolean) => void;
  setConfirmState: (state: ConfirmState | null) => void;
  setDebugDrag: (debug: boolean) => void;
  setPlan: (plan: LaunchPlan | null) => void;
  setDeviceCode: (code: DeviceCode | null) => void;
  setDevicePending: (pending: boolean) => void;
  setDiffResult: (result: DiffResult | null) => void;
  setMcVersions: (versions: ManifestVersion[]) => void;
  setMcVersionLoading: (loading: boolean) => void;
  setLoaderVersions: (versions: string[]) => void;
  setLoaderLoading: (loading: boolean) => void;

  // Async actions
  loadProfiles: () => Promise<void>;
  loadProfile: (id: string) => Promise<void>;
  loadAccounts: () => Promise<void>;
  loadConfig: () => Promise<void>;
  notify: (title: string, detail?: string) => void;
  runAction: (action: () => Promise<void>) => Promise<void>;

  // Computed helpers
  getActiveAccount: () => import("../types").Account | null;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  profiles: [],
  profile: null,
  selectedProfileId: null,
  accounts: null,
  selectedAccountId: null,
  config: null,
  profileFilter: "",
  activeTab: "mods",
  sidebarView: "profiles",
  activeModal: null,
  toast: null,
  launchStatus: null,
  isWorking: false,
  confirmState: null,
  debugDrag: false,
  plan: null,
  deviceCode: null,
  devicePending: false,
  diffResult: null,
  mcVersions: [],
  mcVersionLoading: false,
  loaderVersions: [],
  loaderLoading: false,

  // Simple setters
  setProfiles: (profiles) => set({ profiles }),
  setProfile: (profile) => set({ profile }),
  setSelectedProfileId: (selectedProfileId) => set({ selectedProfileId }),
  setAccounts: (accounts) => set({ accounts }),
  setSelectedAccountId: (selectedAccountId) => set({ selectedAccountId }),
  setConfig: (config) => set({ config }),
  setProfileFilter: (profileFilter) => set({ profileFilter }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setSidebarView: (sidebarView) => set({ sidebarView }),
  setActiveModal: (activeModal) => set({ activeModal }),
  setToast: (toast) => set({ toast }),
  setLaunchStatus: (launchStatus) => set({ launchStatus }),
  setIsWorking: (isWorking) => set({ isWorking }),
  setConfirmState: (confirmState) => set({ confirmState }),
  setDebugDrag: (debugDrag) => set({ debugDrag }),
  setPlan: (plan) => set({ plan }),
  setDeviceCode: (deviceCode) => set({ deviceCode }),
  setDevicePending: (devicePending) => set({ devicePending }),
  setDiffResult: (diffResult) => set({ diffResult }),
  setMcVersions: (mcVersions) => set({ mcVersions }),
  setMcVersionLoading: (mcVersionLoading) => set({ mcVersionLoading }),
  setLoaderVersions: (loaderVersions) => set({ loaderVersions }),
  setLoaderLoading: (loaderLoading) => set({ loaderLoading }),

  // Async actions
  loadProfiles: async () => {
    try {
      const list = await invoke<string[]>("list_profiles_cmd");
      set({ profiles: list });
      const { selectedProfileId } = get();
      if (!selectedProfileId && list.length > 0) {
        set({ selectedProfileId: list[0] });
      }
    } catch (err) {
      get().notify("Failed to load profiles", String(err));
    }
  },

  loadProfile: async (id: string) => {
    try {
      const data = await invoke<Profile>("load_profile_cmd", { id });
      set({ profile: data });
    } catch (err) {
      get().notify("Failed to load profile", String(err));
    }
  },

  loadAccounts: async () => {
    try {
      const data = await invoke<Accounts>("list_accounts_cmd");
      set({ accounts: data });
      const { selectedAccountId } = get();
      if (!selectedAccountId) {
        set({ selectedAccountId: data.active ?? data.accounts[0]?.uuid ?? null });
      }
    } catch (err) {
      get().notify("Failed to load accounts", String(err));
    }
  },

  loadConfig: async () => {
    try {
      const data = await invoke<Config>("get_config_cmd");
      set({ config: data });
    } catch (err) {
      get().notify("Failed to load config", String(err));
    }
  },

  notify: (title: string, detail?: string) => {
    set({ toast: { title, detail } });
    setTimeout(() => set({ toast: null }), 3800);
  },

  runAction: async (action: () => Promise<void>) => {
    set({ isWorking: true });
    try {
      await action();
    } catch (err) {
      get().notify("Action failed", String(err));
    } finally {
      set({ isWorking: false });
    }
  },

  // Computed helper
  getActiveAccount: () => {
    const { accounts, selectedAccountId } = get();
    if (!accounts) return null;
    const id = selectedAccountId ?? accounts.active ?? null;
    return accounts.accounts.find((account) => account.uuid === id) ?? null;
  },
}));
