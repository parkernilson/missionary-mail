const fs = require('fs')
const path = require('path')

const AES = require('crypto-js/aes')

const { getDB, getRecipientsCollection } = require('./db')
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
 * Get the list of recipients from the database
 */
function getRecipientList(filter) {
    return getRecipientsCollection()
        .then(recipientsCollection => {
            return recipientsCollection.find(filter)
        })
        .then(cursor => cursor.toArray())
}

/**
 * Add a new email to the mailing list
 */
async function addEmailToList(email, verified) {
    const formattedEmail = email.trim().toLowerCase()
    return Promise.all([
        getRecipientList(),
        getRecipientsCollection()
    ]).then(([allRecipients, recipientsCollection]) => {
        if (!allRecipients.find(r => r.email === formattedEmail)) {
            return recipientsCollection.insertOne({
                email: formattedEmail,
                verified: verified || false
            })
        } else {
            throw new Error(`Email ${formattedEmail} already exists in the database.`)
        }
    })
}

/**
 * Remove the recipient with the given email address from the database
 */
function removeEmailFromList(email) {
    const formattedEmail = email.trim().toLowerCase()
    return getRecipientsCollection()
        .then(recipientsCollection => {
            return recipientsCollection.deleteOne({ email })
        })
}

/**
 * Send a verification email to the given email address
 */
function sendConfirmationEmail(email) {
    const formattedEmail = email.trim().toLowerCase()
    return sendEmail({
        to: formattedEmail,
        subject: "Please Confirm Email for Elder Nilson's Mailing List.",
        text: `You have requested to be added to Elder Nilson's Mailing List!
Before I can send you any emails, you will need to click the following link to confirm your email:

https://mail.parkernilson.com/mailing-list/verify-email/${encodeURIComponent(generateConfirmationCode(formattedEmail))}`
    })
}

/**
 * Attempt to verify the recipient with the given email address
 */
function attemptVerifyEmail(email) {
    const formattedEmail = email.trim().toLowerCase()
    return getRecipientsCollection()
        .then(recipientsCollection => {
            return recipientsCollection.updateOne({
                email: {
                    $eq: formattedEmail
                }
            }, {
                $set: {
                    "verified": true
                }
            })
        })
}

module.exports = {
    getRecipientList,
    addEmailToList,
    removeEmailFromList,
    getSendingListFromEmailArray,
    sendConfirmationEmail,
    attemptVerifyEmail,
    getEmailArrayFromListOfEmails
}