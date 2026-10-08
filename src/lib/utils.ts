export function generateTrxCode(id: number, date: Date, customer: string) {
  const d = new Date(date);
  const dateStr = `${d.getDate().toString().padStart(2, '0')}${(d.getMonth() + 1).toString().padStart(2, '0')}${d.getFullYear()}`;
  
  // Format customer name: uppercase, remove special chars, max 6 letters of first word
  const cleanCustomer = customer.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 6) || 'GUEST';
  
  return `TRX-${id.toString().padStart(4, '0')}-${dateStr}-${cleanCustomer}`;
}
