const path = require('path')
const { addItemToListFile, getItemArrayFromListFile, removeItemFromListFile } = require('./list-file')

const CONFIRMATION_ENCRYPTION_KEY = "absk22mdj0wkj2n"

const joinRequestsPath = path.join(process.env.PWD, 'data/join-requests.txt')

function addJoinRequest(email) {
    return addItemToListFile(email, joinRequestsPath)
}

function getJoinRequests() {
    return getItemArrayFromListFile(joinRequestsPath)
}

function removeJoinRequest(email) {
    return removeItemFromListFile(email, joinRequestsPath)
}

module.exports = {
    CONFIRMATION_ENCRYPTION_KEY,
    getJoinRequests,
    addJoinRequest,
    removeJoinRequest
}