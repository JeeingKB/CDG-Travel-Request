
/**
 * Centralized formatting utilities to ensure consistency across the app.
 * Can be used in Dashboard, Forms, Lists, and Chat.
 */

// Format Currency (e.g., ฿ 1,000 or $ 50.00)
export const formatCurrency = (amount: number | undefined | null, currency: string = 'THB'): string => {
  if (amount === undefined || amount === null) return '0';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount).replace('THB', '฿'); // Custom replacement if you prefer symbols
};

// Format Date (e.g., 25 Jan 2024)
export const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString; // Return original if invalid
  
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

// Format Date with Time (e.g., 25 Jan 2024, 14:30)
export const formatDateTime = (dateString: string | undefined): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

// Truncate long text (e.g., "This is a very long..."")
export const truncateText = (text: string, maxLength: number = 30): string => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

// Generate Request ID Display (e.g., #...1234)
export const formatRequestId = (id: string): string => {
  if (!id) return '';
  // If ID is very long (UUID), show last 6 chars
  if (id.length > 10) return `#${id.slice(-6)}`;
  return id;
};
