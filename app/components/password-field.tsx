"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

import { fieldClasses } from "./input";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/** Password input with a show/hide toggle. */
export function PasswordField({ className = "", ...props }: Props) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={show ? "text" : "password"}
        // Same field treatment as every other input, plus room for the toggle.
        className={fieldClasses(false, `pr-10 ${className}`)}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex items-center rounded-r-md px-3 text-ink-subtle transition-colors hover:text-ink"
      >
        {show ? (
          <EyeOff className="h-4 w-4" strokeWidth={2} />
        ) : (
          <Eye className="h-4 w-4" strokeWidth={2} />
        )}
      </button>
    </div>
  );
}
