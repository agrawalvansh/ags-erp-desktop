// src/utils/productUtils.js
// Centralized product utility functions shared between Invoice and PriceList modules

/**
 * Slugify a string: lowercase, trim, replace spaces with hyphens
 * @param {string} str - The string to slugify
 * @returns {string} - Slugified string
 */
export const slugify = (str) => {
    if (!str) return '';
    return str
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-'); // Replace spaces with hyphens
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
 * Check if a packing type is valid
 * @param {string} type - Packing type to check
 * @returns {boolean} - True if valid
 */
export const isValidPackingType = (type) => {
    if (!type) return false;
    return ALLOWED_PACKING_TYPES.includes(type);
};

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
 * Create a product payload for the API
 * @param {Object} params - Product parameters
 * @returns {Object} - Product payload for API
 */
export const createProductPayload = ({ name, size, packingType, costPrice, sellingPrice }) => {
    const code = generateProductCode(name, size);

    return {
        code,
        name,
        size: size || '',
        packing_type: packingType || DEFAULT_PACKING_TYPE,
        cost_price: Number(costPrice) || 0,
        selling_price: Number(sellingPrice) || 0
    };
};

/**
 * Extract numeric value from a size string (e.g., "1 No" -> 1, "10 Kg" -> 10)
 * @param {string} size - Size string
 * @returns {number} - Extracted number, or Infinity if no number found
 */
export const extractNumericFromSize = (size) => {
    if (!size) return Infinity; // Products without size go to the end

    // Match numbers (including decimals) at the start or anywhere in the string
    const match = size.match(/(\d+\.?\d*)/);
    if (match) {
        return parseFloat(match[1]);
    }
    return Infinity;
};

/**
 * Sort products by name (A-Z) and then by numeric size value
 * This ensures "Sami 1 No", "Sami 2 No", "Sami 10 No" are in correct order
 * @param {Array} products - Array of products to sort
 * @param {string} nameKey - Key for product name (default: 'name')
 * @param {string} sizeKey - Key for product size (default: 'size')
 * @returns {Array} - Sorted products
 */
export const sortProducts = (products, nameKey = 'name', sizeKey = 'size') => {
    if (!products || !Array.isArray(products)) return [];

    return [...products].sort((a, b) => {
        // Primary sort: Product name (case-insensitive, A-Z)
        const nameA = (a[nameKey] || '').toLowerCase();
        const nameB = (b[nameKey] || '').toLowerCase();

        const nameComparison = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });

        if (nameComparison !== 0) {
            return nameComparison;
        }

        // Secondary sort: Numeric value from size (ascending)
        const numA = extractNumericFromSize(a[sizeKey]);
        const numB = extractNumericFromSize(b[sizeKey]);

        return numA - numB;
    });
};
