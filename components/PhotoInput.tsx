"use client";

import { useRef } from "react";

export default function PhotoInput({
  label,
  capture,
  variant = "primary",
  disabled,
  onSelect,
}: {
  label: string;
  capture?: boolean;
  variant?: "primary" | "secondary" | "text";
  disabled?: boolean;
  onSelect: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const className =
    variant === "primary"
      ? "block w-full rounded-2xl bg-accent text-white py-4 font-semibold disabled:opacity-50"
      : variant === "secondary"
        ? "block w-full rounded-2xl border border-line text-ink py-[15px] font-semibold disabled:opacity-50"
        : "text-sm text-neutral-500 underline disabled:opacity-50";

  return (
    <>
      <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()} className={className}>
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={capture ? "environment" : undefined}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelect(file);
          e.target.value = "";
        }}
      />
    </>
  );
}
