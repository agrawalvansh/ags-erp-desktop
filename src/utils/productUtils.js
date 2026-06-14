// src/utils/productUtils.js
// Centralized product utility functions shared between Invoice and PriceList modules

/**
 * Extract the trailing number from an ID string like "AGS-C-12", "E-1015", "QS-5", "O-C-3".
 * Returns the number, or Infinity if no number is found (so non-numeric IDs sort last).
 */
export const extractTrailingNumber = (id) => {
    if (!id) return Infinity;
    const m = id.match(/(\d+)$/);
    return m ? parseInt(m[1], 10) : Infinity;
};

/**
 * Natural compare for ID strings. Extracts the trailing numeric part and
 * compares numerically so "AGS-C-2" sorts before "AGS-C-10".
 * @param {string} a
 * @param {string} b
 * @returns {number} negative if a < b, positive if a > b, 0 if equal
 */
export const naturalCompare = (a, b) => {
    return extractTrailingNumber(a) - extractTrailingNumber(b);
};

const slugify = (str) => {
    if (!str) return '';
    return str
        .toLowerCase()
        .trim()
        .replace(/\//g, '-')    // Replace forward slashes with hyphens
        .replace(/\s+/g, '-');  // Replace spaces with hyphens
};

/**
 * Normalize a product code to standard format (lowercase, hyphens, no spaces)
 * This handles inconsistent codes like "Sami 1 No." vs "sami-1-no."
 * @param {string} code - Product code to normalize
 * @returns {string} - Normalized code
 */
export const normalizeProductCode = (code) => {
    if (!code) return '';
    return code
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')    // Replace spaces with hyphens
        .replace(/\.+$/g, '');    // Remove trailing dots
};

/**
 * Generate a product code from name and size
 * Format: ProductName-Size (with spaces replaced by hyphens)
 * @param {string} name - Product name
 * @param {string} size - Product size (optional)
 * @returns {string} - Generated product code
 */
export const generateProductCode = (name, size) => {
    if (!name) return '';

    const productSlug = slugify(name);
    const sizeSlug = size ? slugify(size) : '';

    return sizeSlug ? `${productSlug}-${sizeSlug}` : productSlug;
};

/**
 * Capitalize first letter of each word
 * @param {string} str - The string to capitalize
 * @returns {string} - Capitalized string
 */
export const capitalizeWords = (str) => {
    if (!str) return '';
    return str.replace(/\b\w/g, (char) => char.toUpperCase());
};

/**
 * Allowed packing types - strict list, no custom values allowed
 * These values must be used exactly as defined
 */
export const ALLOWED_PACKING_TYPES = [
    'Pc',
    'Kg',
    'Dz',
    'Box',
    'Kodi',
    'Theli',
    'Packet',
    'Set'
];

/**
 * Default packing type
 */
export const DEFAULT_PACKING_TYPE = 'Pc';

/**
 * Check if a product with the given code exists in the products list
 * Uses normalized code comparison to handle inconsistent formats
 * @param {string} code - Product code to check
 * @param {Array} allProducts - List of all products
 * @param {string} excludeCode - Code to exclude from check (for edit mode)
 * @returns {boolean} - True if code exists
 */
export const productCodeExists = (code, allProducts, excludeCode = null) => {
    if (!code || !allProducts) return false;
    const normalizedCode = normalizeProductCode(code);
    const normalizedExclude = excludeCode ? normalizeProductCode(excludeCode) : null;

    return allProducts.some(p => {
        const normalizedProductCode = normalizeProductCode(p.code);
        return normalizedProductCode === normalizedCode &&
            (!normalizedExclude || normalizedProductCode !== normalizedExclude);
    });
};

/**
 * Find a product by code (uses normalized comparison)
 * @param {string} code - Product code to find
 * @param {Array} products - List of products
 * @returns {Object|null} - Found product or null
 */
export const findProductByCode = (code, products) => {
    if (!code || !products) return null;
    const normalizedCode = normalizeProductCode(code);
    return products.find(p => normalizeProductCode(p.code) === normalizedCode) || null;
};

/**
 * Find a product by name and size combination
 * Also checks by normalized product code to handle inconsistent formats
 * @param {string} name - Product name
 * @param {string} size - Product size
 * @param {Array} products - List of products
 * @returns {Object|null} - Found product or null
 */
export const findProductByNameAndSize = (name, size, products) => {
    if (!name || !products) return null;
    const normalizedName = name.toLowerCase().trim();
    const normalizedSize = (size || '').toLowerCase().trim();

    // First try exact name+size match
    let found = products.find(p => {
        const pName = (p.name || '').toLowerCase().trim();
        const pSize = (p.size || '').toLowerCase().trim();
        return pName === normalizedName && pSize === normalizedSize;
    });

    if (found) return found;

    // Also try matching by normalized product code
    // This handles cases where product was created with inconsistent format
    const expectedCode = generateProductCode(name, size);
    found = products.find(p => normalizeProductCode(p.code) === expectedCode);

    return found || null;
};

/**
 * Extracts a numeric sort key from a size string.
 *
 * Handles these cases:
 *   All-zero strings ("0", "00", "000", "0000"):
 *     More zeros = smaller size = more negative key
 *     "0000" → -4,  "000" → -3,  "00" → -2,  "0" → -1
 *
 *   Fractions ("1/2 Kg"):
 *     Parsed as decimal → 0.5
 *
 *   Normal integers ("1 No", "10 Kg", "500g"):
 *     Parsed as integer → 1, 10, 500
 *
 *   Decimal numbers ("1.5 Kg"):
 *     Parsed as float → 1.5
 *
 *   No number found ("Large", "Small", null, ""):
 *     Returns Infinity → sorts to end of list
 */
export const extractNumericFromSize = (size) => {
  if (!size) return Infinity

  const str = size.trim()
  if (!str) return Infinity

  // Handle fractions first: "1/2 Kg" → 0.5
  const fractionMatch = str.match(/^(\d+)\/(\d+)/)
  if (fractionMatch) {
    const numerator   = parseInt(fractionMatch[1], 10)
    const denominator = parseInt(fractionMatch[2], 10)
    if (denominator !== 0) return numerator / denominator
  }

  // Extract the leading digit string (e.g. "0000" from "0000 No", "500" from "500g")
  const digitMatch = str.match(/^(\d+)/)
  if (!digitMatch) return Infinity  // no leading digits → "Large", "Small" etc.

  const digitStr = digitMatch[1]

  // All-zero string: "0", "00", "000", "0000"
  // More zeros = smaller size
  // Sort key: -(number of digits) so "0000"→-4 < "000"→-3 < "00"→-2 < "0"→-1
  if (/^0+$/.test(digitStr)) {
    return -digitStr.length
  }

  // Decimal number: "1.5 Kg" — check for decimal point after the leading digits
  const decimalMatch = str.match(/^(\d+\.\d+)/)
  if (decimalMatch) {
    return parseFloat(decimalMatch[1])
  }

  // Normal integer: "1", "10", "500", "4000"
  return parseInt(digitStr, 10)
}

/**
 * Sorts products by name A→Z, then by size ascending (smallest first).
 *
 * Size order example for products with the same name:
 *   0000 No → 000 No → 00 No → 0 No → 1 No → 2 No → 3 No → 4 No → 10 No → 40 No
 *
 * @param {Array}  products  - array of product objects
 * @param {string} nameKey   - key for the name field (default: 'name')
 * @param {string} sizeKey   - key for the size field (default: 'size')
 * @returns {Array} new sorted array (does not mutate the original)
 */
export const sortProducts = (products, nameKey = 'name', sizeKey = 'size') => {
  if (!products || !Array.isArray(products)) return []

  return [...products].sort((a, b) => {
    // Level 1: name A → Z
    const nameA = (a[nameKey] || '').toLowerCase()
    const nameB = (b[nameKey] || '').toLowerCase()
    const nameCmp = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' })
    if (nameCmp !== 0) return nameCmp

    // Level 2: size ascending (smallest first)
    const keyA = extractNumericFromSize(a[sizeKey])
    const keyB = extractNumericFromSize(b[sizeKey])
    return keyA - keyB
  })
}