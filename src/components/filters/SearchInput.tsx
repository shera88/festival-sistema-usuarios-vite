import { Search, X } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function SearchInput({ value, onChange, placeholder = 'Buscar...' }: Props) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-45" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-glass-border bg-glass-bg pl-9 pr-9 py-2 text-sm text-text-90 placeholder:text-text-45 focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan"
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Limpiar búsqueda"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-text-45 hover:text-text-90"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
