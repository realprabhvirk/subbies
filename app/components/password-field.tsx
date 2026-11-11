"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

import { fieldClasses, type FieldSize } from "./input";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { fieldSize?: FieldSize };

/** Password input with a show/hide toggle. */
export function PasswordField({ className = "", fieldSize = "md", ...props }: Props) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={show ? "text" : "password"}
        // Same field treatment as every other input, plus room for the toggle.
        className={fieldClasses(false, `pr-12 ${className}`, fieldSize)}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex min-w-11 items-center justify-center rounded-r-md px-3.5 text-ink-muted transition-colors hover:text-ink"
      >
        {show ? (
          <EyeOff className="h-4.5 w-4.5" strokeWidth={2} />
        ) : (
          <Eye className="h-4.5 w-4.5" strokeWidth={2} />
        )}
      </button>
    </div>
  );
}
