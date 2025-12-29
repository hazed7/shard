export type ContentRef = {
  name: string;
  hash: string;
  version?: string | null;
  source?: string | null;
  file_name?: string | null;
};

export type Loader = {
  type: string;
  version: string;
};

export type Runtime = {
  java?: string | null;
  memory?: string | null;
  args: string[];
};

export type Profile = {
  id: string;
  mcVersion: string;
  loader?: Loader | null;
  mods: ContentRef[];
  resourcepacks: ContentRef[];
  shaderpacks: ContentRef[];
  runtime: Runtime;
};

export type Account = {
  uuid: string;
  username: string;
  xuid?: string | null;
};

export type Accounts = {
  active?: string | null;
  accounts: Account[];
};

export type Config = {
  msa_client_id?: string | null;
  msa_client_secret?: string | null;
};

export type DeviceCode = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  message: string;
  expires_in: number;
  interval: number;
};

export type LaunchPlan = {
  instance_dir: string;
  java_exec: string;
  jvm_args: string[];
  classpath: string;
  main_class: string;
  game_args: string[];
};

export type DiffResult = {
  only_a: string[];
  only_b: string[];
  both: string[];
};

export type LaunchEvent = {
  stage: string;
  message?: string | null;
};

export type ManifestVersion = {
  id: string;
  type: string;
  releaseTime?: string;
};

export type ContentTab = "mods" | "resourcepacks" | "shaderpacks";
export type SidebarView = "profiles" | "accounts" | "settings";

export type ModalType =
  | "create"
  | "clone"
  | "diff"
  | "json"
  | "add-content"
  | "prepare"
  | "device-code";

export type ConfirmState = {
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: "danger" | "default";
  onConfirm: () => void | Promise<void>;
};

export type Toast = {
  title: string;
  detail?: string;
};
