/**
 * Utility to format currency values cleanly with Indian Rupee symbol (₹).
 * Handles numbers, strings, and undefined values safely.
 */
export const formatCurrency = (amount, options = {}) => {
  const num = Number(amount) || 0
  const decimals = options.decimals ?? 2
  const formatted = num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return `₹${formatted}`
}

export default formatCurrency
