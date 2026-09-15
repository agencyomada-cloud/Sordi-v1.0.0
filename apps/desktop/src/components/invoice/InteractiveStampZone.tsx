import React, { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface InteractiveStampZoneProps {
  settings: any;
  invoice?: any;
  stampSize?: number;
  onStampSizeChange?: (size: number) => void;
  onStampSizeCommit?: (size: number) => void;
  className?: string;
  showTitle?: boolean;
  /** Overrides the "Cachet et Signature" text shown both above the stamp
   *  (when showTitle) and inside the empty placeholder box — a bon de
   *  livraison passes its own "...du Client (Bon pour accord et
   *  réception)" wording here (see useEditableInvoiceLogic's stampLabel). */
  label?: string;
}

export function InteractiveStampZone({
  settings,
  invoice,
  stampSize,
  onStampSizeChange,
  onStampSizeCommit,
  className,
  showTitle = true,
  label = "Cachet et Signature",
}: InteractiveStampZoneProps) {
  const [isSelected, setIsSelected] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const cachetSize = Math.max(
    80,
    Math.min(
      350,
      stampSize ?? (invoice?.stamp_size ? Number(invoice.stamp_size) : (settings?.stamp_size ? Number(settings.stamp_size) : 180))
    )
  );

  const companyStampUrl = settings?.stamp_data || settings?.signature_data || "";
  const hasStamp = Boolean(settings?.stamp_data);
  const hasSignature = Boolean(settings?.signature_data);

  // Click outside to deselect
  useEffect(() => {
    if (!isSelected) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsSelected(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSelected]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative group inline-flex flex-col items-center justify-center select-none",
        className
      )}
      style={{ minWidth: `${Math.max(cachetSize, 120)}px` }}
    >
      {/* Contextual Floating Mini Toolbar */}
      {onStampSizeChange && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "stamp-resizer absolute -top-12 right-0 z-30 print:hidden",
            "transition-all duration-150",
            "bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-[0_8px_24px_-4px_rgba(0,0,0,0.08)] rounded-full px-3.5 py-1.5 flex items-center gap-3 select-none",
            /* Invisible bridge to bridge any gap between toolbar and stamp */
            "before:absolute before:-bottom-4 before:left-0 before:w-full before:h-4 before:content-['']",
            isSelected
              ? "opacity-100 pointer-events-auto ring-1 ring-blue-500/20"
              : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
          )}
        >
          <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Taille</span>
          <input
            type="range"
            min="80"
            max="350"
            step="5"
            value={cachetSize}
            onChange={(e) => {
              e.stopPropagation();
              onStampSizeChange(Number(e.target.value));
            }}
            onMouseUp={(e) => {
              onStampSizeCommit?.(Number((e.target as HTMLInputElement).value));
            }}
            onTouchEnd={(e) => {
              onStampSizeCommit?.(Number((e.target as HTMLInputElement).value));
            }}
            className="w-24 h-1 bg-slate-200 rounded-lg appearance-none accent-blue-600 cursor-pointer"
          />
          <span className="text-[11px] font-mono font-semibold text-slate-600 min-w-[38px]">
            {Math.round(cachetSize)}px
          </span>
        </div>
      )}

      {/* Title Label */}
      {showTitle && (
        <div className="text-[7.5pt] text-gray-400 uppercase tracking-wide mb-1 text-center font-medium">
          {label}
        </div>
      )}

      {/* Stamp Container & Rendering */}
      <div
        onClick={() => {
          if (onStampSizeChange) {
            setIsSelected((prev) => !prev);
          }
        }}
        className={cn(
          "relative flex items-center justify-center cursor-pointer transition-all duration-150",
          isSelected && "ring-2 ring-blue-500/50 rounded-lg p-1 bg-blue-50/20"
        )}
      >
        {companyStampUrl ? (
          <>
            <img
              src={companyStampUrl}
              alt="Cachet et Signature"
              style={{
                width: `${cachetSize}px`,
                height: "auto",
                maxWidth: "350px",
                minWidth: "80px",
              }}
              className="object-contain transition-all duration-75 select-none -rotate-1"
            />

            {/* If both stamp and signature are present, overlay signature on top */}
            {hasStamp && hasSignature && (
              <img
                src={settings.signature_data}
                alt="Signature"
                style={{
                  height: `${Math.round(cachetSize * 0.45)}px`,
                  maxWidth: `${cachetSize}px`,
                }}
                className="absolute z-10 object-contain pointer-events-none select-none mix-blend-multiply"
              />
            )}
          </>
        ) : (
          <div
            style={{ width: `${cachetSize}px`, minHeight: "60px" }}
            className="flex items-center justify-center border border-dashed border-gray-300 rounded-lg p-2 text-center"
          >
            <span className="text-[9pt] text-gray-400 uppercase tracking-wide">
              {label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
