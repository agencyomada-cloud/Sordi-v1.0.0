import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { RiLoader4Line as Loader2 } from "@remixicon/react";

export interface DeleteConfirmationModalProps {
  open?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  title?: string;
  description?: React.ReactNode;
  itemIdentifier?: string;
  itemName?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function DeleteConfirmationModal({
  open,
  isOpen,
  onOpenChange,
  onClose,
  title = "Supprimer cet élément ?",
  description,
  itemIdentifier,
  itemName,
  confirmLabel = "Supprimer",
  cancelLabel = "Annuler",
  isLoading = false,
  onConfirm,
}: DeleteConfirmationModalProps) {
  const isModalOpen = open ?? isOpen ?? false;

  const handleClose = () => {
    if (isLoading) return;
    if (onOpenChange) onOpenChange(false);
    if (onClose) onClose();
  };

  const identifier = itemIdentifier || itemName;

  useEffect(() => {
    if (!isModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      } else if (e.key === "Enter" && !isLoading) {
        e.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, isLoading, onConfirm]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isModalOpen && (
        <motion.div
          key="delete-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-[2px] select-none"
          onClick={handleClose}
        >
          <motion.div
            key="delete-modal-sheet"
            initial={{ opacity: 0, scale: 0.97, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 2 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 p-5 shadow-2xl space-y-3"
          >
            <div className="space-y-1.5 text-left">
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                {title}
              </h3>

              {identifier && (
                <div>
                  <div className="my-1 px-2.5 py-1.5 rounded-lg bg-slate-100/80 border border-slate-200/60 font-mono text-xs font-semibold text-slate-800 inline-flex items-center gap-2 max-w-full truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                    <span className="truncate">{identifier}</span>
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-500 leading-relaxed pt-0.5">
                {description || "Cette action est irréversible."}
              </p>
            </div>

            <div className="flex justify-end items-center gap-2 pt-2">
              <button
                type="button"
                disabled={isLoading}
                onClick={handleClose}
                className="h-8 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg active:scale-[0.97] transition-all duration-75 disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={(e) => {
                  e.preventDefault();
                  onConfirm();
                }}
                className="h-8 px-3.5 py-1.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 active:scale-[0.97] rounded-lg shadow-sm transition-all duration-75 flex items-center gap-1.5 disabled:opacity-50"
              >
                {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isLoading ? "Suppression..." : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
