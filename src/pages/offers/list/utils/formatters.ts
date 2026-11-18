// Creating an Intl formatter is far slower than using one, and the grid
// formats every visible cell on each render, so both are created once.
const currency = new Intl.NumberFormat('en-ES', { style: 'currency', currency: 'EUR' });
const date = new Intl.DateTimeFormat();

export function formatCurrency(value: number): string {
  return currency.format(value);
}

export function formatDate(value: string | number | Date | null | undefined): string {
  return value ? date.format(new Date(value)) : '';
}
