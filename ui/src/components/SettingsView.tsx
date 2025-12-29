import { useAppStore } from "../store";

interface SettingsViewProps {
  onSave: () => void;
}

export function SettingsView({ onSave }: SettingsViewProps) {
  const { config, setConfig } = useAppStore();

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
            onChange={(e) => setConfig({ ...config, msa_client_id: e.target.value })}
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
            onChange={(e) => setConfig({ ...config, msa_client_secret: e.target.value })}
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
