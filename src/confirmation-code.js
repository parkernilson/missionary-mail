const CryptoJS = require('crypto-js')
const AES = CryptoJS.AES

const CONFIRMATION_ENCRYPTION_KEY = "dfan20xkj2n"

function generateConfirmationCode(email) {
    return AES.encrypt(email.toLowerCase(), CONFIRMATION_ENCRYPTION_KEY)
}

function getEmailFromConfirmationCode(confirmationCode) {
    return AES.decrypt(confirmationCode, CONFIRMATION_ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8)
}

module.exports = {
    generateConfirmationCode,
    getEmailFromConfirmationCode,
    CONFIRMATION_ENCRYPTION_KEY
}