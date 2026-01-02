/**
 * Shared Database Helper Functions
 * Promisified wrappers for sqlite3 callback-based methods
 */

/**
 * Creates promisified database helpers bound to a db instance
 * @param {Object} db - SQLite3 database instance
 * @returns {{ run: Function, get: Function, all: Function }}
 */
function createDbHelpers(db) {
    return {
        run(sql, params = []) {
            return new Promise((resolve, reject) => {
                db.run(sql, params, function (err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID, changes: this.changes });
                });
            });
        },

        get(sql, params = []) {
            return new Promise((resolve, reject) => {
                db.get(sql, params, (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        },

        all(sql, params = []) {
            return new Promise((resolve, reject) => {
                db.all(sql, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        }
    };
}

module.exports = { createDbHelpers };
