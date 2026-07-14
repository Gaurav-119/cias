import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Searchable single-select dropdown (no free-text commit — must pick an option).
 */
export default function SearchableSelect({
  options = [],
  value,
  onChange,
  disabled = false,
  loading = false,
  placeholder = 'Select…',
  loadingText = 'Loading…',
  emptyText = 'No options available',
  className = 'input',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);

  const selected = useMemo(
    () => options.find((o) => String(o.id) === String(value)),
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) setQuery(selected?.name || '');
  }, [open, selected]);

  useEffect(() => {
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (option) => {
    onChange(option.id);
    setQuery(option.name);
    setOpen(false);
  };

  const isDisabled = disabled || loading;

  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        className={className}
        disabled={isDisabled}
        placeholder={loading ? loadingText : placeholder}
        value={loading ? '' : (open ? query : (selected?.name || ''))}
        readOnly={isDisabled}
        onFocus={() => {
          if (!isDisabled) {
            setOpen(true);
            setQuery('');
          }
        }}
        onChange={(e) => {
          if (!isDisabled) {
            setOpen(true);
            setQuery(e.target.value);
          }
        }}
        autoComplete="off"
      />
      {loading && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
          {loadingText}
        </span>
      )}

      {open && !isDisabled && (
        <ul className="absolute z-30 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 text-sm text-ink shadow-lg">
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-slate-400">{emptyText}</li>
          )}
          {filtered.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                className={`block w-full px-3 py-2 text-left hover:bg-brand/10 ${
                  String(option.id) === String(value) ? 'bg-brand/15 font-semibold text-brand' : ''
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(option);
                }}
              >
                {option.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
