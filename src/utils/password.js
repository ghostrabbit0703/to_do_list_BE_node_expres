export const isValidPassword = (password, { min = 8, maxBytes = 72 } = {}) => {
  if (typeof password !== 'string') return false;

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const tooLong = Buffer.byteLength(password, 'utf8') > maxBytes;

  return password.length >= min && !tooLong && hasUpperCase && hasLowerCase && hasNumber && hasSymbol;
};