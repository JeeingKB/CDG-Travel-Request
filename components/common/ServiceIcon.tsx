
import React from 'react';
import { Plane, Hotel, Car, Shield, Ticket, HelpCircle } from 'lucide-react';
import { ServiceType } from '../../types';

interface ServiceIconProps {
  type: ServiceType | string;
  className?: string;
  size?: number;
}

export const ServiceIcon: React.FC<ServiceIconProps> = ({ type, className = '', size = 18 }) => {
  // Normalize type string just in case
  const upperType = type?.toUpperCase() || '';

  switch (upperType) {
    case 'FLIGHT': 
      return <Plane size={size} className={className} />;
    case 'HOTEL': 
      return <Hotel size={size} className={className} />;
    case 'CAR': 
      return <Car size={size} className={className} />;
    case 'INSURANCE': 
      return <Shield size={size} className={className} />;
    case 'EVENT': 
      return <Ticket size={size} className={className} />;
    default: 
      return <HelpCircle size={size} className={className} />;
  }
};
