const fs = require('fs')
const path = require('path')

const { getDB } = require('./db')

const emailListPath = path.join(process.env.PWD, 'data/email-list.txt')

/**
 * Get a list of emails that can be copied into the sending
 * line of an email from an array of emails
 */
function getSendingListFromEmailArray(emailArray) {
    return getCommaListFromArray(emailArray)
}

/**
 * Add an email to the mailing list
 */
function addEmailToList(email) {
    return getDB()
        .then(db => {
            const recipients = db.collection('recipients')
            const newRecipient = {
                email
            }
            return recipients.insertOne(newRecipient)
        })
}

/**
 * Remove an email from the mailing list
 */
function removeEmailFromList(email) {
    return getDB()
        .then(db => {
            const recipients = db.collection('recipients')
            return recipients.deleteOne({
                email: {
                    $eq: email
                }
            })
        })
}

/**
 * Get an array of emails to send the missionary mail to
 */
function getEmailList() {
    return getDB()
        // get all of the recipient documents on the email list
        .then(db => {
            const recipientsCollection = db.collection('recipients')
            return recipientsCollection.find()
        })
        // map to the email field of each document
        .then(documents => {
            return documents.map(doc => doc.email)
        })
}

module.exports = {
    getEmailList,
    addEmailToList,
    removeEmailFromList,
    getSendingListFromEmailArray
}