import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { inputClass } from "./AuthLayout.js";

// Campo de senha com o olho para mostrar/ocultar (Briefs 6 e 7)
export function PasswordInput({
  id,
  value,
  onChange,
  hasError,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  hasError: boolean;
  autoComplete: "current-password" | "new-password";
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${id}-error` : undefined}
        className={`${inputClass(hasError)} pr-11`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        className="absolute inset-y-0 right-0 px-3 text-texto-suave hover:text-texto cursor-pointer"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
