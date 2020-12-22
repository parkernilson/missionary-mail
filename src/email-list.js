const fs = require('fs')
const path = require('path')

const emailListPath = path.join(process.env.PWD, 'data/email-list.txt')

const {
    addItemToListFile,
    removeItemFromListFile,
    getItemArrayFromListFile,
    getCommaListFromArray
} = require('./list-file')

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
    return addItemToListFile(email, emailListPath)
}

/**
 * Remove an email from the mailing list
 */
function removeEmailFromList(email) {
    return removeItemFromListFile(email, emailListPath)
}

function getEmailList() {
    return getItemArrayFromListFile(emailListPath)
}

module.exports = {
    getEmailList,
    addEmailToList,
    removeEmailFromList,
    getSendingListFromEmailArray
}