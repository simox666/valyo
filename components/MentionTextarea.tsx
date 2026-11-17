"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Avatar } from "./Avatar";

// Autocomplétion des mentions : taper « @ » dans le champ propose ses contacts
// (abonnements et abonnés ; dans un salon, ses membres). Flèches pour choisir,
// Entrée ou Tab pour insérer, Échap pour fermer. Le champ reste un textarea
// ordinaire : sans JavaScript ou si l'API échoue, on tape son @pseudo à la main.

export type Contact = { handle: string; displayName: string; avatarId: string | null; isAgent: boolean };

/** « @ » en début de mot (pas un e-mail, pas /m/@x), suivi d'un début de pseudo. */
const TRIGGER = /(?:^|[^\w@/])@([a-zA-Z0-9_]{0,24})$/;

type Props = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  value: string;
  onValueChange: (next: string) => void;
  /** Salon : les suggestions se limitent à ses membres (seuls notifiables). */
  room?: string;
  containerClassName?: string;
  ref?: React.Ref<HTMLTextAreaElement>;
};

export function MentionTextarea({ value, onValueChange, room, containerClassName = "", onKeyDown, onBlur, ref, ...props }: Props) {
  const listId = useId();
  const area = useRef<HTMLTextAreaElement | null>(null);
  const cache = useRef(new Map<string, Contact[]>());
  const [menu, setMenu] = useState<{ prefix: string; start: number; end: number; up: boolean } | null>(null);
  const [items, setItems] = useState<Contact[]>([]);
  const [index, setIndex] = useState(0);

  function detect() {
    const el = area.current;
    if (!el || el.selectionStart !== el.selectionEnd) return setMenu(null);
    const caret = el.selectionStart;
    const m = TRIGGER.exec(el.value.slice(0, caret));
    if (!m) return setMenu(null);
    // Vers le haut si la place manque sous le champ (ex. composeur d'un salon, en bas d'écran).
    const up = el.getBoundingClientRect().bottom + 280 > window.innerHeight;
    setMenu({ prefix: m[1].toLowerCase(), start: caret - m[1].length - 1, end: caret, up });
  }

  useEffect(() => {
    if (!menu) return;
    const key = `${room ?? ""}|${menu.prefix}`;
    const known = cache.current.get(key);
    if (known) {
      setItems(known);
      setIndex(0);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: menu.prefix });
        if (room) params.set("room", room);
        const res = await fetch(`/api/me/contacts?${params}`, { cache: "no-store" });
        const data = (await res.json()) as { contacts?: Contact[] };
        if (!res.ok || !Array.isArray(data.contacts)) return;
        cache.current.set(key, data.contacts);
        setItems(data.contacts);
        setIndex(0);
      } catch {
        /* champ utilisable sans suggestions */
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [menu?.prefix, room]); // eslint-disable-line react-hooks/exhaustive-deps

  function insert(contact: Contact) {
    if (!menu) return;
    const before = value.slice(0, menu.start);
    const after = value.slice(menu.end);
    const inserted = `@${contact.handle}${after.startsWith(" ") || after.startsWith("\n") ? "" : " "}`;
    onValueChange(before + inserted + after);
    setMenu(null);
    const caret = before.length + inserted.length;
    requestAnimationFrame(() => {
      const el = area.current;
      if (el) {
        el.focus();
        el.setSelectionRange(caret, caret);
      }
    });
  }

  const open = Boolean(menu) && items.length > 0;
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (open && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => (i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insert(items[index]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMenu(null);
        return;
      }
    }
    onKeyDown?.(e);
  }

  return (
    <div className={`relative ${containerClassName}`}>
      <textarea
        {...props}
        ref={(el) => {
          area.current = el;
          if (typeof ref === "function") ref(el);
          else if (ref) ref.current = el;
        }}
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          detect();
        }}
        onSelect={detect}
        onKeyDown={handleKeyDown}
        onBlur={(e) => {
          setMenu(null);
          onBlur?.(e);
        }}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${index}` : undefined}
      />
      {open && (
        <ul id={listId} role="listbox" aria-label="Mentionner un contact"
          className={`absolute left-0 z-20 max-h-64 w-full max-w-xs overflow-y-auto rounded-xl border border-line bg-white py-1 shadow-lg ${menu?.up ? "bottom-full mb-1" : "top-full mt-1"}`}>
          {items.map((c, i) => (
            <li key={c.handle} id={`${listId}-${i}`} role="option" aria-selected={i === index}>
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault() /* garder le focus dans le champ */}
                onClick={() => insert(c)}
                onMouseEnter={() => setIndex(i)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${i === index ? "bg-accent-soft" : ""}`}
              >
                <Avatar name={c.displayName} seed={c.handle} size="xs" imageId={c.avatarId} agent={c.isAgent} />
                <span className="min-w-0 truncate font-semibold">{c.displayName}</span>
                <span className="truncate text-xs text-muted">@{c.handle}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
