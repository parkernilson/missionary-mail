const MongoClient = require('mongodb').MongoClient
const url = 'mongodb://root:27hdKslik@db:27017'
const dbname = 'missionary-mail'

let db;

function loadDB() {
    return MongoClient.connect(url, {
        useUnifiedTopology: true
    }).then(client => {
        db = client.db(dbname)
        return db
    })
}

/**
 * Get the db instance, and if it isn't loaded load it.
 * @returns {Promise} a promise which resolves to the db instance
 */
function getDB() {
    return db ? Promise.resolve(db) : loadDB()
}

/**
 * Get the recipients collection from the database
 */
function getRecipientsCollection() {
    return getDB().then(db => {
        return db.collection('recipients')
    })
}

module.exports = {
    getDB,
    getRecipientsCollection
}