import React, { useRef } from 'react'

export default function SearchBar({ value, onChange, resultCount }) {
  const inputRef = useRef(null)

  return (
    <div className="search-wrapper">
      <div className="search-inner">
        <span className="search-icon">&#128269;</span>
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Type your problem or what you want..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
        {value && (
          <button
            className="search-clear"
            onClick={() => {
              onChange('')
              inputRef.current?.focus()
            }}
            title="Clear search"
          >
            &#10005;
          </button>
        )}
      </div>
      {value && (
        <div className="search-count">
          {resultCount === 0
            ? 'No results'
            : `${resultCount} command${resultCount !== 1 ? 's' : ''}`}
        </div>
      )}
    </div>
  )
}
