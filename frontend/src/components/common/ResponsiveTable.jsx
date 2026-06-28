import { useState } from 'react'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import './ResponsiveTable.css'

export function ResponsiveTable({ data, columns, keyField, onRowClick }) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const isTablet = useMediaQuery('(max-width: 1023px)')
  const [expandedRows, setExpandedRows] = useState(new Set())

  const toggleRow = (id) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (!isMobile && !isTablet) {
    return (
      <div className="rtable-wrapper">
        <table className="rtable">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={String(col.key)}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={String(row[keyField])}
                onClick={() => onRowClick?.(row)}
                className={onRowClick ? 'rtable-row-clickable' : ''}
              >
                {columns.map((col) => (
                  <td key={String(col.key)}>
                    {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const visibleCols = columns.filter((c) =>
    isMobile ? c.priority === 'high' : c.priority !== 'low'
  )
  const hiddenCols = columns.filter((c) =>
    isMobile ? c.priority !== 'high' : c.priority === 'low'
  )

  return (
    <div className="rtable-card-list">
      {data.map((row) => {
        const id = String(row[keyField])
        const isExpanded = expandedRows.has(id)

        return (
          <div
            key={id}
            className={`rtable-card ${isExpanded ? 'rtable-card-expanded' : ''}`}
            onClick={() => onRowClick?.(row)}
          >
            <div
              className="rtable-card-main"
              onClick={(e) => {
                if (hiddenCols.length > 0) {
                  e.stopPropagation()
                  toggleRow(id)
                }
              }}
            >
              {visibleCols.map((col) => (
                <div key={String(col.key)} className="rtable-card-field">
                  <span className="rtable-card-label">{col.label}</span>
                  <span className="rtable-card-value">
                    {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}
                  </span>
                </div>
              ))}
              {hiddenCols.length > 0 && (
                <span className="rtable-expand-icon">{isExpanded ? '▲' : '▼'}</span>
              )}
            </div>

            {isExpanded && (
              <div className="rtable-card-details">
                {hiddenCols.map((col) => (
                  <div key={String(col.key)} className="rtable-card-field">
                    <span className="rtable-card-label">{col.label}</span>
                    <span className="rtable-card-value">
                      {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
