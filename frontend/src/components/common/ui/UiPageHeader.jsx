import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * UiPageHeader — Unified page header with optional back navigation.
 * Props: title, description, backTo (route), backLabel, actions (ReactNode)
 */
const UiPageHeader = ({
  title,
  description,
  backTo,
  backLabel = 'Regresar',
  actions,
  className = '',
}) => {
  const navigate = useNavigate();

  return (
    <div className={`ui-page-header ${className}`}>
      {backTo && (
        <div className="ui-page-header__nav">
          <button
            onClick={() => navigate(backTo)}
            className="ui-page-header__back"
          >
            <span className="material-icons-outlined">arrow_back</span>
            {backLabel}
          </button>
        </div>
      )}
      <div className="ui-flex ui-justify-between ui-items-center">
        <div className="ui-page-header__content">
          {title && <h1 className="ui-page-header__title">{title}</h1>}
          {description && <p className="ui-page-header__description">{description}</p>}
        </div>
        {actions && (
          <div className="ui-flex ui-gap-3 ui-items-center">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default UiPageHeader;
