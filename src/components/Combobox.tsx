import { useMemo, useState } from 'react';
import { inputCls } from './ui';

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  large?: boolean;
}

/** A text box with a dropdown: tap to see every option, or type to narrow the list. Typing freely still works. */
export default function Combobox({ label, value, onChange, options, placeholder, large = false }: Props) {
  const [open, setOpen] = useState(false);
  const q = value.trim().toLowerCase();
  const shown = useMemo(() => (q ? options.filter((o) => o.toLowerCase().includes(q)) : options).slice(0, 80), [options, q]);

  const pick = (o: string) => {
    onChange(o);
    setOpen(false);
  };

  return (
    <div className="relative" onBlur={() => setTimeout(() => setOpen(false), 120)}>
      <div className="relative">
        <input
          className={`${inputCls} pr-20 ${large ? 'h-12 text-base' : ''}`}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          aria-label={label}
          role="combobox"
          aria-expanded={open}
          autoComplete="off"
        />
        <div className="absolute inset-y-0 right-0 flex items-center">
          {value && (
            <button type="button" aria-label={`Clear ${label}`} onMouseDown={(e) => e.preventDefault()} onClick={() => onChange('')} className="h-10 w-9 text-2xl leading-none text-slate-400">
              ×
            </button>
          )}
          <button type="button" aria-label={`Show ${label} list`} onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((o) => !o)} className="h-10 w-9 text-slate-500">
            <svg viewBox="0 0 20 20" className={`mx-auto h-5 w-5 transition ${open ? 'rotate-180' : ''}`} fill="currentColor" aria-hidden="true">
              <path d="M5.5 7.5 10 12l4.5-4.5-1.1-1.1L10 9.8 6.6 6.4z" />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <ul role="listbox" className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-300 bg-white shadow-lg">
          {shown.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">No match. Your typing is still used for the search.</li>}
          {shown.map((o) => (
            <li key={o} role="option" aria-selected={o.toLowerCase() === q}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)} className="block h-11 w-full truncate px-4 text-left text-base active:bg-slate-100">
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
