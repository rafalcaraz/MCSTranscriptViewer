import { useState, useRef, useEffect } from "react";
import { useAadUserSearch } from "../../context/LookupsContext";
import type { AadUser } from "../../hooks/useLookups";

interface UserSearchProps {
  onUserSelect: (user: AadUser) => void;
  initialQuery?: string;
}

export function UserSearch({ onUserSelect, initialQuery = "" }: UserSearchProps) {
  const [query, setQuery] = useState(initialQuery);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searched, setSearched] = useState(false);
  const { results, loading, search } = useAadUserSearch();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 2) {
      setSearched(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      search(query);
      setSearched(true);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (user: AadUser) => {
    setQuery(`${user.displayname} (${user.mail})`);
    setShowDropdown(false);
    setSearched(false);
    onUserSelect(user);
  };

  const showResults = showDropdown && query.length >= 2;

  return (
    <div className="user-search" ref={containerRef}>
      <div className="filter-group" style={{ flex: 1, position: "relative" }}>
        <label>👤 Find by User</label>
        <input
          placeholder="Type a name or email..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => query.length >= 2 && setShowDropdown(true)}
        />
        {showResults && (
          <div className="user-dropdown">
            {loading && <div className="user-dropdown-item loading">Searching...</div>}
            {!loading && results.map((user) => (
              <div
                key={user.aaduserid}
                className="user-dropdown-item"
                onClick={() => handleSelect(user)}
              >
                <div className="user-name">{user.displayname}</div>
                <div className="user-detail">
                  {user.mail && <span>{user.mail}</span>}
                  {user.jobtitle && <span> · {user.jobtitle}</span>}
                </div>
              </div>
            ))}
            {!loading && searched && results.length === 0 && (
              <div className="user-dropdown-item loading">No users found</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
