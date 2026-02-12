
import React from 'react';
import { getStatusStyle } from '../../utils/styleHelpers';
import { useTranslation } from '../../services/translations';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const { t } = useTranslation();
  const styles = getStatusStyle(status);

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${styles} ${className}`}>
      {t(`status.${status}`) || status}
    </span>
  );
};
