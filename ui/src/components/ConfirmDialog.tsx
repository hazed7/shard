import type { ConfirmState } from "../types";

interface ConfirmDialogProps {
  state: ConfirmState;
  onClose: () => void;
}

export function ConfirmDialog({ state, onClose }: ConfirmDialogProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{state.title}</h3>
        <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.6)" }}>{state.message}</p>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className={state.tone === "danger" ? "btn-danger" : "btn-primary"} onClick={state.onConfirm}>
            {state.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
