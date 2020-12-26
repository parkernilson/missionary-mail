const fs = require('fs')
const path = require('path')

const AES = require('crypto-js/aes')

const { getDB } = require('./db')
const { sendEmail } = require('./send-email')
const { generateConfirmationCode } = require('./confirmation-code')

/**
 * Given a string list of emails e.g. "parker@gmail.com, steve@mail.net, gary@gmail.com"
 * get an array of the emails it lists
 */
function getEmailArrayFromListOfEmails(listOfEmails) {
    if (listOfEmails.length === 0) {
        return []
    } else {
        return listOfEmails.split(", ")
    }
}

/**
 * Get a comma separated list of items from an array
 * e.g. 'a, b, c'
 */
function getCommaListFromArray(arr) {
    return arr.reduce((acc, cur, i) => {
        return acc + (i > 0 ? `, ${cur}` : `${cur}`)
    }, "")
}

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
                email: email.toLowerCase(),
                verified: false
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
            return recipients.deleteMany({
                email: {
                    $eq: email.toLowerCase()
                }
            })
        })
}

/**
 * Get an array of emails to send the missionary mail to
 */
function getEmailList(filter) {
    return getDB()
        // get all of the recipient documents on the email list
        .then(db => {
            const recipientsCollection = db.collection('recipients')
            return recipientsCollection.find(filter)
        })
        .then(cursor => {
            return cursor.toArray()
        })
        // map to the email field of each document
        .then(documents => {
            return documents.map(doc => doc.email)
        })
}


function sendConfirmationEmail(email) {
    return sendEmail({
        to: email,
        subject: "Please Confirm Email for Elder Nilson's Mailing List.",
        text: `You have requested to be added to Elder Nilson's Mailing List!
Before I can send you any emails, you will need to click the following link to confirm your email:

https://mail.parkernilson.com/mailing-list/verify-email/${encodeURIComponent(generateConfirmationCode(email))}`
    })
}

function attemptVerifyEmail(email) {
    return getDB()
        .then(db => {
            const recipients = db.collection('recipients')

            return recipients.updateOne({
                email: {
                    $eq: email.toLowerCase()
                }
            }, {
                $set: {
                    "verified": true
                }
            })
        })
}

module.exports = {
    getEmailList,
    addEmailToList,
    removeEmailFromList,
    getSendingListFromEmailArray,
    sendConfirmationEmail,
    attemptVerifyEmail,
    getEmailArrayFromListOfEmails
}