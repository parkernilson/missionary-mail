const MongoClient = require('mongodb').MongoClient
const url = 'mongodb://db:27017'
const dbname = 'missionary-mail'

let db;

const loadDB = () => new Promise((resolve, reject) => {
    MongoClient.connect(url, {
        useUnifiedTopology: true
    }, (err, client) => {
        if (err) return reject(err)

        const db = client.db(dbname)

        return resolve(db)
    })
})

/**
 * Get the db instance, and if it isn't loaded load it.
 * @returns {Promise} a promise which resolves to the db instance
 */
function getDB() {
    return db ? Promise.resolve(db) : loadDB()
}

module.exports = {
    getDB
}