import React from 'react';

/**
 * UiButton — Unified button component
 * Variants: primary, secondary, outline, ghost, danger
 * Sizes: sm, md (default), lg
 */
const UiButton = ({
  children,
  variant = 'primary',
  size,
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  iconOnly = false,
  className = '',
  ...props
}) => {
  const classes = [
    'ui-btn',
    `ui-btn--${variant}`,
    size && `ui-btn--${size}`,
    iconOnly && 'ui-btn--icon',
    className
  ].filter(Boolean).join(' ');

  return (
    <button className={classes} disabled={disabled || loading} {...props}>
      {loading ? (
        <span className="material-icons-outlined ui-btn-spinner">hourglass_empty</span>
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <span className="material-icons-outlined ui-btn-icon">
              {icon}
            </span>
          )}
          {!iconOnly && children}
          {icon && iconPosition === 'right' && (
            <span className="material-icons-outlined ui-btn-icon">
              {icon}
            </span>
          )}
        </>
      )}
    </button>
  );
};

export default UiButton;
