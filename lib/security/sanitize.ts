// Sanitasi input string untuk mencegah XSS & injection
export function sanitizeInput(str: string): string {
  if (!str) return '';
  return str
    .replace(/[<>]/g, '') // Hilangkan kurung siku HTML tag
    .trim();
}
