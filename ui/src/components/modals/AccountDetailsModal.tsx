import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Modal } from "../Modal";
import { SkinViewer } from "../SkinViewer";
import { Field } from "../Field";
import type { AccountInfo, Cape } from "../../types";

interface AccountDetailsModalProps {
  open: boolean;
  accountId: string | null;
  onClose: () => void;
}

export function AccountDetailsModal({ open: isOpen, accountId, onClose }: AccountDetailsModalProps) {
  const [info, setInfo] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"skin" | "cape">("skin");
  const [uploading, setUploading] = useState(false);
  const [skinVariant, setSkinVariant] = useState<"classic" | "slim">("classic");
  const [skinUrl, setSkinUrl] = useState("");

  const loadAccountInfo = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await invoke<AccountInfo>("get_account_info_cmd", { id: accountId });
      setInfo(data);
      // Set variant from current skin
      if (data.active_skin?.variant) {
        setSkinVariant(data.active_skin.variant as "classic" | "slim");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (isOpen && accountId) {
      void loadAccountInfo();
    }
  }, [isOpen, accountId, loadAccountInfo]);

  const handleUploadSkin = async () => {
    if (!accountId) return;

    const file = await open({
      filters: [{ name: "PNG Image", extensions: ["png"] }],
      multiple: false,
    });

    if (!file) return;

    setUploading(true);
    try {
      await invoke("upload_skin_cmd", {
        id: accountId,
        path: file,
        variant: skinVariant,
      });
      await loadAccountInfo();
    } catch (err) {
      setError(String(err));
    } finally {
      setUploading(false);
    }
  };

  const handleSetSkinUrl = async () => {
    if (!accountId || !skinUrl.trim()) return;

    setUploading(true);
    try {
      await invoke("set_skin_url_cmd", {
        id: accountId,
        url: skinUrl.trim(),
        variant: skinVariant,
      });
      await loadAccountInfo();
      setSkinUrl("");
    } catch (err) {
      setError(String(err));
    } finally {
      setUploading(false);
    }
  };

  const handleResetSkin = async () => {
    if (!accountId) return;

    setUploading(true);
    try {
      await invoke("reset_skin_cmd", { id: accountId });
      await loadAccountInfo();
    } catch (err) {
      setError(String(err));
    } finally {
      setUploading(false);
    }
  };

  const handleSetCape = async (capeId: string) => {
    if (!accountId) return;

    setUploading(true);
    try {
      await invoke("set_cape_cmd", { id: accountId, capeId });
      await loadAccountInfo();
    } catch (err) {
      setError(String(err));
    } finally {
      setUploading(false);
    }
  };

  const handleHideCape = async () => {
    if (!accountId) return;

    setUploading(true);
    try {
      await invoke("hide_cape_cmd", { id: accountId });
      await loadAccountInfo();
    } catch (err) {
      setError(String(err));
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal open={isOpen} onClose={onClose} className="modal-lg">
      <h2 className="modal-title">{info?.name ?? "Account"}</h2>

      {loading && (
        <div style={{ textAlign: "center", padding: 40 }}>
          <div className="skin-viewer-loading" />
          <p style={{ marginTop: 16, color: "var(--text-secondary)" }}>Loading account info...</p>
        </div>
      )}

      {error && !loading && (
        <div
          style={{
            background: "rgba(248, 113, 113, 0.1)",
            border: "1px solid rgba(248, 113, 113, 0.2)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
          }}
        >
          <p style={{ color: "var(--accent-danger)", margin: 0, fontSize: 14 }}>{error}</p>
        </div>
      )}

      {info && !loading && (
        <div style={{ display: "flex", gap: 32 }}>
          {/* 3D Skin Viewer */}
          <div style={{ flexShrink: 0 }}>
            <SkinViewer
              skinUrl={info.active_skin?.url ?? `https://crafatar.com/skins/${info.id}?overlay`}
              capeUrl={info.active_cape?.url}
              width={200}
              height={320}
              animation="idle"
            />
          </div>

          {/* Controls */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Tab switcher */}
            <div className="content-tabs" style={{ marginBottom: 20 }}>
              <button
                className={`content-tab ${tab === "skin" ? "active" : ""}`}
                onClick={() => setTab("skin")}
              >
                Skin
              </button>
              <button
                className={`content-tab ${tab === "cape" ? "active" : ""}`}
                onClick={() => setTab("cape")}
              >
                Capes
                {info.capes.length > 0 && (
                  <span className="count">{info.capes.length}</span>
                )}
              </button>
            </div>

            {tab === "skin" && (
              <div>
                {/* Variant selector */}
                <Field label="Skin Variant">
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className={`btn btn-secondary btn-sm ${skinVariant === "classic" ? "active" : ""}`}
                      onClick={() => setSkinVariant("classic")}
                      style={{
                        background: skinVariant === "classic" ? "rgba(124, 199, 255, 0.15)" : undefined,
                        borderColor: skinVariant === "classic" ? "rgba(124, 199, 255, 0.3)" : undefined,
                      }}
                    >
                      Classic (Steve)
                    </button>
                    <button
                      className={`btn btn-secondary btn-sm ${skinVariant === "slim" ? "active" : ""}`}
                      onClick={() => setSkinVariant("slim")}
                      style={{
                        background: skinVariant === "slim" ? "rgba(124, 199, 255, 0.15)" : undefined,
                        borderColor: skinVariant === "slim" ? "rgba(124, 199, 255, 0.3)" : undefined,
                      }}
                    >
                      Slim (Alex)
                    </button>
                  </div>
                </Field>

                {/* Upload skin */}
                <div style={{ marginTop: 16 }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleUploadSkin}
                    disabled={uploading}
                    style={{ width: "100%" }}
                  >
                    {uploading ? "Uploading..." : "Upload Skin File"}
                  </button>
                </div>

                {/* Set from URL */}
                <div style={{ marginTop: 16 }}>
                  <Field label="Or set from URL">
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="text"
                        className="input"
                        placeholder="https://..."
                        value={skinUrl}
                        onChange={(e) => setSkinUrl(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button
                        className="btn btn-secondary"
                        onClick={handleSetSkinUrl}
                        disabled={!skinUrl.trim() || uploading}
                      >
                        Set
                      </button>
                    </div>
                  </Field>
                </div>

                {/* Reset skin */}
                <div style={{ marginTop: 24 }}>
                  <button
                    className="btn btn-ghost"
                    onClick={handleResetSkin}
                    disabled={uploading}
                    style={{ color: "var(--text-muted)" }}
                  >
                    Reset to default skin
                  </button>
                </div>
              </div>
            )}

            {tab === "cape" && (
              <div>
                {info.capes.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: 32,
                      color: "var(--text-secondary)",
                    }}
                  >
                    <p>No capes available for this account.</p>
                    <p style={{ fontSize: 12, marginTop: 8, color: "var(--text-muted)" }}>
                      Capes are obtained through Minecraft events, purchases, or promotions.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {info.capes.map((cape: Cape) => (
                      <div
                        key={cape.id}
                        className="content-item"
                        style={{
                          background:
                            cape.state === "ACTIVE"
                              ? "rgba(124, 199, 255, 0.1)"
                              : undefined,
                          borderColor:
                            cape.state === "ACTIVE"
                              ? "rgba(124, 199, 255, 0.2)"
                              : undefined,
                        }}
                      >
                        <div className="content-item-info">
                          <h5>{cape.alias ?? cape.id}</h5>
                          {cape.state === "ACTIVE" && (
                            <p style={{ color: "var(--accent-primary)" }}>Currently active</p>
                          )}
                        </div>
                        <div className="content-item-actions" style={{ opacity: 1 }}>
                          {cape.state === "ACTIVE" ? (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={handleHideCape}
                              disabled={uploading}
                            >
                              Hide
                            </button>
                          ) : (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleSetCape(cape.id)}
                              disabled={uploading}
                            >
                              Equip
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
