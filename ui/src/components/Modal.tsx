import ReactDOM from "react-dom";
import clsx from "clsx";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  large?: boolean;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, large, children }: ModalProps) {
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
