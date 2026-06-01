import React from 'react'

const CATEGORY_ICONS = {
  All: '&#9670;',
  Privacy: '&#128274;',
  Speed: '&#9889;',
  Storage: '&#128190;',
  Network: '&#127760;',
  Power: '&#9211;',
  Security: '&#128737;',
  Apps: '&#128745;',
  Display: '&#128444;',
  Audio: '&#128266;',
  Files: '&#128196;',
  Recovery: '&#127938;',
  Printers: '&#128438;',
  Productivity: '&#128203;',
  Gaming: '&#127918;',
  Time: '&#128336;',
  Boot: '&#9878;',
  Nuclear: '&#9762;',
  'Disk Ops': '&#128191;',
}

export default function Sidebar({ categories, selectedCategory, onSelectCategory, categoryCounts }) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Categories</span>
      </div>
      <nav className="sidebar-nav">
        {categories.map((cat) => {
          const count = categoryCounts[cat] || 0
          const isActive = cat === selectedCategory
          const icon = CATEGORY_ICONS[cat] || '&#9642;'
          return (
            <button
              key={cat}
              className={`sidebar-item${isActive ? ' sidebar-active' : ''}${count === 0 && cat !== 'All' ? ' sidebar-empty' : ''}`}
              onClick={() => onSelectCategory(cat)}
            >
              <span
                className="sidebar-icon"
                dangerouslySetInnerHTML={{ __html: icon }}
              />
              <span className="sidebar-label">{cat}</span>
              {count > 0 && (
                <span className="sidebar-count">{count}</span>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
