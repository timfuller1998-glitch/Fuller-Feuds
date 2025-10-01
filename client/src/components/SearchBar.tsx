import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchBarProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
  className?: string;
  value?: string;
}

export default function SearchBar({ 
  onSearch, 
  placeholder = "Search debate topics...", 
  className = "",
  value: externalValue
}: SearchBarProps) {
  const [query, setQuery] = useState(externalValue || "");

  // Sync internal state with external value (for controlled usage)
  useEffect(() => {
    if (externalValue !== undefined) {
      setQuery(externalValue);
    }
  }, [externalValue]);

  const handleSearch = (value: string) => {
    setQuery(value);
    onSearch?.(value);
    console.log('Search triggered with query:', value);
  };

  return (
    <div className={`relative w-full max-w-2xl ${className}`}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder={placeholder}
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        className="pl-10 h-12 text-base"
        data-testid="input-search"
      />
    </div>
  );
}