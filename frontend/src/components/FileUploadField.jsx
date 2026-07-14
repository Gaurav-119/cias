export default function FileUploadField({
  label,
  hint,
  accept = 'image/*,.pdf',
  required = false,
  file,
  onChange,
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-white/90">
        {label}
        {required && ' *'}
      </label>
      <label className="block cursor-pointer rounded-xl border-2 border-dashed border-white/40 bg-white px-4 py-5 text-center transition hover:border-brand">
        <input
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] || null)}
        />
        <p className="text-sm font-semibold text-ink">
          {file ? file.name : 'Click to upload'}
        </p>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </label>
      {file && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="mt-2 text-xs text-red-300 hover:text-red-200"
        >
          Remove file
        </button>
      )}
    </div>
  );
}
