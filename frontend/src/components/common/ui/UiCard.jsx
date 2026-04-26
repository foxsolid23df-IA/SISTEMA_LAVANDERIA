import React from 'react';

/**
 * UiCard — Unified card container
 * Props: interactive (hover lift), flush (no body padding)
 */
const UiCard = ({ children, interactive = false, className = '', ...props }) => {
  const classes = [
    'ui-card',
    interactive && 'ui-card--interactive',
    className
  ].filter(Boolean).join(' ');

  return <div className={classes} {...props}>{children}</div>;
};

const UiCardHeader = ({ children, title, subtitle, actions, className = '' }) => (
  <div className={`ui-card__header ${className}`}>
    <div>
      {title && <h3 className="ui-card__title">{title}</h3>}
      {subtitle && <p className="ui-card__subtitle">{subtitle}</p>}
      {children}
    </div>
    {actions && <div className="ui-flex ui-gap-2 ui-items-center">{actions}</div>}
  </div>
);

const UiCardBody = ({ children, flush = false, className = '' }) => (
  <div className={`${flush ? 'ui-card__body--flush' : 'ui-card__body'} ${className}`}>
    {children}
  </div>
);

const UiCardFooter = ({ children, className = '' }) => (
  <div className={`ui-card__footer ${className}`}>
    {children}
  </div>
);

UiCard.Header = UiCardHeader;
UiCard.Body = UiCardBody;
UiCard.Footer = UiCardFooter;

export default UiCard;
