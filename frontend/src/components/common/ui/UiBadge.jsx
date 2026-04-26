import React from 'react';

/**
 * UiBadge — Unified status/role indicator
 * Variants: success, warning, danger, info, neutral, accent,
 *           admin, gerente, cajero, operador, repartidor
 */
const UiBadge = ({
  children,
  variant = 'neutral',
  icon,
  className = '',
  ...props
}) => {
  const classes = [
    'ui-badge',
    `ui-badge--${variant}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <span className={classes} {...props}>
      {icon && <span className="ui-badge-icon">{icon}</span>}
      {children}
    </span>
  );
};

export default UiBadge;
