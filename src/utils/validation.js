export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhone(phone) {
  // Allow + and digits, 7-20 chars
  const phoneRegex = /^[+]?[0-9]{7,20}$/;
  return phoneRegex.test(phone);
}

export function validateMatricule(matricule) {
  // Alphanumeric, 3-50 chars
  return typeof matricule === 'string' && matricule.length >= 3 && matricule.length <= 50;
}

export function validatePassword(password) {
  // At least 6 chars
  return typeof password === 'string' && password.length >= 6;
}

export function validateString(str, minLen = 1, maxLen = 500) {
  return typeof str === 'string' && str.length >= minLen && str.length <= maxLen;
}

export function validateEnum(value, allowedValues) {
  return allowedValues.includes(value);
}

export function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/[<>]/g, '');
}
