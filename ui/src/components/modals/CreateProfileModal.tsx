import { useState, useEffect, useMemo } from "react";
import clsx from "clsx";
import { Modal } from "../Modal";
import { Field } from "../Field";
import { useAppStore } from "../../store";
import type { ManifestVersion } from "../../types";

interface CreateProfileModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (form: CreateProfileForm) => Promise<void>;
}

export interface CreateProfileForm {
  id: string;
  mcVersion: string;
  loaderType: string;
  loaderVersion: string;
  java: string;
  memory: string;
  args: string;
}

export function CreateProfileModal({ open, onClose, onSubmit }: CreateProfileModalProps) {
  const { mcVersions, mcVersionLoading, loaderVersions, loaderLoading, setMcVersions, setMcVersionLoading, setLoaderVersions, setLoaderLoading } = useAppStore();

  const [form, setForm] = useState<CreateProfileForm>({
    id: "",
    mcVersion: "",
    loaderType: "",
    loaderVersion: "",
    java: "",
    memory: "",
    args: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSnapshots, setShowSnapshots] = useState(false);

  const visibleVersions = useMemo(() => {
    return mcVersions.filter((entry) => showSnapshots || entry.type === "release");
  }, [mcVersions, showSnapshots]);

  const latestRelease = useMemo(() => {
    return mcVersions.find((entry) => entry.type === "release")?.id;
  }, [mcVersions]);

  useEffect(() => {
    if (open && mcVersions.length === 0) {
      fetchMinecraftVersions();
    }
  }, [open, mcVersions.length]);

  useEffect(() => {
    if (open && form.loaderType === "fabric" && loaderVersions.length === 0 && !loaderLoading) {
      fetchLoaderVersions();
    }
  }, [open, form.loaderType, loaderVersions.length, loaderLoading]);

  useEffect(() => {
    if (open) {
      setForm({ id: "", mcVersion: "", loaderType: "", loaderVersion: "", java: "", memory: "", args: "" });
      setErrors({});
    }
  }, [open]);

  const fetchMinecraftVersions = async () => {
    setMcVersionLoading(true);
    try {
      const resp = await fetch("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json");
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const list = (data.versions ?? []).map((entry: any) => ({
        id: String(entry.id),
        type: String(entry.type),
        releaseTime: entry.releaseTime,
      })) as ManifestVersion[];
      setMcVersions(list);
      if (!form.mcVersion && data.latest?.release) {
        setForm((prev) => ({ ...prev, mcVersion: data.latest.release }));
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

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.id.trim()) newErrors.id = "Required";
    if (!form.mcVersion.trim()) newErrors.mcVersion = "Required";
    if (form.loaderType && !form.loaderVersion.trim()) newErrors.loaderVersion = "Required";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    await onSubmit(form);
  };

  return (
    <Modal open={open} onClose={onClose} title="Create profile">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="Profile ID" error={errors.id}>
          <input
            className={clsx("input", errors.id && "input-error")}
            value={form.id}
            onChange={(e) => setForm({ ...form, id: e.target.value })}
            placeholder="my-modpack"
          />
        </Field>
        <Field label="Minecraft version" error={errors.mcVersion}>
          <select
            className={clsx("input", errors.mcVersion && "input-error")}
            value={form.mcVersion}
            onChange={(e) => setForm({ ...form, mcVersion: e.target.value })}
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
              <button type="button" className="link" onClick={() => setForm((p) => ({ ...p, mcVersion: latestRelease }))}>
                Use latest ({latestRelease})
              </button>
            )}
          </div>
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Loader" error={errors.loaderType}>
            <select
              className="input"
              value={form.loaderType || "none"}
              onChange={(e) => setForm((p) => ({
                ...p,
                loaderType: e.target.value === "none" ? "" : e.target.value,
                loaderVersion: e.target.value === "none" ? "" : p.loaderVersion,
              }))}
            >
              <option value="none">None (Vanilla)</option>
              <option value="fabric">Fabric</option>
            </select>
          </Field>
          <Field label="Loader version" error={errors.loaderVersion}>
            <select
              className={clsx("input", errors.loaderVersion && "input-error")}
              value={form.loaderVersion}
              onChange={(e) => setForm({ ...form, loaderVersion: e.target.value })}
              disabled={!form.loaderType}
            >
              <option value="">{loaderLoading ? "Loading…" : "Select version"}</option>
              {loaderVersions.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Java path (optional)">
            <input className="input" value={form.java} onChange={(e) => setForm({ ...form, java: e.target.value })} placeholder="/usr/bin/java" />
          </Field>
          <Field label="Memory (optional)">
            <input className="input" value={form.memory} onChange={(e) => setForm({ ...form, memory: e.target.value })} placeholder="4G" />
          </Field>
        </div>
        <Field label="Extra JVM args (optional)">
          <input className="input" value={form.args} onChange={(e) => setForm({ ...form, args: e.target.value })} placeholder="-Dfile.encoding=UTF-8" />
        </Field>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit}>Create</button>
        </div>
      </div>
    </Modal>
  );
}
