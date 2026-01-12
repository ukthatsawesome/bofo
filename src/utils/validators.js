/**
 * Centralized Validation Module
 * 
 * Provides consistent validation across the application.
 * All financial amounts use 2 decimal precision to avoid floating-point errors.
 */

/**
 * Validate and normalize monetary amount
 * @param {any} val - Value to validate
 * @param {boolean} allowNegative - Whether negative values are allowed (default: false)
 * @returns {number} Normalized amount with 2 decimal places
 * @throws {Error} If value is invalid
 */
function validateAmount(val, allowNegative = false) {
    const num = parseFloat(val);
    if (isNaN(num)) {
        throw new Error('Amount must be a valid number');
    }
    if (!allowNegative && num < 0) {
        throw new Error('Amount cannot be negative');
    }
    // Round to 2 decimal places to avoid floating-point precision issues
    return Math.round(num * 100) / 100;
}

/**
 * Validate required fields exist and are not empty
 * @param {Object} obj - Object to validate
 * @param {string[]} fields - Required field names
 * @throws {Error} If any required field is missing
 */
function validateRequired(obj, fields) {
    for (const field of fields) {
        const val = obj[field];
        if (val === undefined || val === null || val === '') {
            throw new Error(`${field} is required`);
        }
    }
}

/**
 * Validate value is in allowed set
 * @param {any} val - Value to check
 * @param {any[]} allowed - Allowed values
 * @param {string} fieldName - Field name for error message
 * @throws {Error} If value not in allowed set
 */
function validateEnum(val, allowed, fieldName) {
    if (!allowed.includes(val)) {
        throw new Error(`Invalid ${fieldName}: must be one of ${allowed.join(', ')}`);
    }
}

/**
 * Validate exchange rate
 * @param {any} val - Rate value
 * @returns {number} Validated rate
 * @throws {Error} If rate is invalid
 */
function validateRate(val) {
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) {
        throw new Error('Exchange rate must be a positive number');
    }
    return num;
}

/**
 * Validate date string format (YYYY-MM-DD)
 * @param {string} val - Date string
 * @param {string} fieldName - Field name for error message
 * @returns {string} Validated date string
 * @throws {Error} If date format is invalid
 */
function validateDate(val, fieldName = 'date') {
    if (!val) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        throw new Error(`Invalid ${fieldName}: use YYYY-MM-DD format`);
    }
    const d = new Date(val);
    if (isNaN(d.getTime())) {
        throw new Error(`Invalid ${fieldName}: not a valid date`);
    }
    return val;
}

/**
 * Validate field name is safe (alphanumeric + underscore only)
 * Prevents SQL injection via field names
 * @param {string} field - Field name
 * @returns {boolean} True if safe
 */
function isSafeFieldName(field) {
    return /^[a-z_][a-z0-9_]*$/i.test(field);
}

/**
 * Sanitize and validate a data object for database operations
 * @param {Object} data - Data to sanitize
 * @param {string[]} allowedFields - List of allowed field names
 * @returns {Object} Sanitized data with only allowed fields
 */
function sanitizeData(data, allowedFields) {
    const result = {};
    for (const field of allowedFields) {
        if (data.hasOwnProperty(field) && data[field] !== undefined) {
            result[field] = data[field];
        }
    }
    return result;
}

/**
 * Entity-specific validators
 */
const EntityValidators = {
    transaction: (data, isCreate = false) => {
        if (isCreate) {
            validateRequired(data, ['type', 'category', 'amount', 'start_date']);
        }
        if (data.type) {
            validateEnum(data.type, ['income', 'expense', 'transfer', 'asset', 'liability'], 'type');
        }
        if (data.amount !== undefined) {
            data.amount = validateAmount(data.amount);
        }
        if (data.frequency) {
            validateEnum(data.frequency, ['once', 'weekly', 'monthly', 'yearly'], 'frequency');
        }
        if (data.start_date) {
            data.start_date = validateDate(data.start_date, 'start_date');
        }
        if (data.end_date) {
            data.end_date = validateDate(data.end_date, 'end_date');
        }
        return data;
    },

    account: (data, isCreate = false) => {
        if (isCreate) {
            validateRequired(data, ['name', 'type']);
        }
        if (data.type) {
            validateEnum(data.type, ['bank', 'wallet', 'credit_card', 'loan', 'investment', 'other'], 'type');
        }
        if (data.balance !== undefined) {
            data.balance = validateAmount(data.balance, true); // Allow negative for liabilities
        }
        if (data.initial_balance !== undefined) {
            data.initial_balance = validateAmount(data.initial_balance, true);
        }
        return data;
    },

    category: (data, isCreate = false) => {
        if (isCreate) {
            validateRequired(data, ['type', 'name']);
        }
        if (data.type) {
            validateEnum(data.type, ['income', 'expense', 'transfer', 'asset', 'liability'], 'type');
        }
        return data;
    },

    budget: (data, isCreate = false) => {
        if (isCreate) {
            validateRequired(data, ['category', 'amount', 'start_date', 'end_date']);
        }
        if (data.amount !== undefined) {
            data.amount = validateAmount(data.amount);
        }
        if (data.period) {
            validateEnum(data.period, ['once', 'weekly', 'monthly', 'yearly'], 'period');
        }
        return data;
    },

    goal: (data, isCreate = false) => {
        if (isCreate) {
            validateRequired(data, ['name', 'target_amount']);
        }
        if (data.target_amount !== undefined) {
            data.target_amount = validateAmount(data.target_amount);
        }
        if (data.current_amount !== undefined) {
            data.current_amount = validateAmount(data.current_amount);
        }
        if (data.monthly_contribution !== undefined) {
            data.monthly_contribution = validateAmount(data.monthly_contribution);
        }
        return data;
    },

    recurringCharge: (data, isCreate = false) => {
        if (isCreate) {
            validateRequired(data, ['name', 'category', 'amount']);
        }
        if (data.amount !== undefined) {
            data.amount = validateAmount(data.amount);
        }
        if (data.frequency) {
            validateEnum(data.frequency, ['weekly', 'monthly', 'yearly'], 'frequency');
        }
        return data;
    },

    billType: (data, isCreate = false) => {
        if (isCreate) {
            validateRequired(data, ['name']);
        }
        if (data.cost_per_unit !== undefined) {
            data.cost_per_unit = validateAmount(data.cost_per_unit);
        }
        return data;
    },

    billReading: (data, isCreate = false) => {
        if (isCreate) {
            validateRequired(data, ['bill_type_id', 'date', 'units_used', 'total_cost']);
        }
        if (data.total_cost !== undefined) {
            data.total_cost = validateAmount(data.total_cost);
        }
        if (data.units_used !== undefined) {
            data.units_used = validateAmount(data.units_used);
        }
        return data;
    },

    exchangeRate: (data, isCreate = false) => {
        if (isCreate) {
            validateRequired(data, ['from_currency', 'to_currency', 'rate']);
        }
        if (data.rate !== undefined) {
            data.rate = validateRate(data.rate);
        }
        return data;
    }
};

module.exports = {
    validateAmount,
    validateRequired,
    validateEnum,
    validateRate,
    validateDate,
    isSafeFieldName,
    sanitizeData,
    EntityValidators
};
