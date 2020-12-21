const fs = require('fs')
const path = require('path')

const emailListPath = path.join(process.env.PWD, 'data/email-list.txt')

function getSendingListFromEmailArray(emailArray) {
    return emailArray.reduce((acc, currentValue, i) => {
        return acc + (i > 0 ? `, ${currentValue}` : `${currentValue}`)
    }, "")
}

/**
 * Get an array of emails from the mailing list
 */
function getEmailList() {
    return new Promise((resolve, reject) => {
        fs.readFile(emailListPath, 'utf8', (err, data) => {
            if (err) {
                reject(err)
            } else {
                const emails = data === "" ? [] : data.split('\n')
                resolve(emails)
            }
        })
    })
}

function addEmailToList(email, req, res) {
    return new Promise((resolve, reject) => {
        getEmailList().then(emails => {
            if (!emails.includes(email)) {
                const append = emails.length > 0 ? `\n${email}` : `${email}`
                fs.appendFile(emailListPath, append, (err) => {
                    if (err) {
                        reject(err)
                    } else {
                        resolve([...emails, email])
                    }
                })
            }
        }).catch(error => {
            reject(error)
        })
    })
}

function removeEmailFromList(email, req, res) {
    return new Promise((resolve, reject) => {
        fs.readFile(emailListPath, 'utf8', (err, data) => {
            data = data.replace(`\n${email}`, '')
            data = data.replace(`${email}`, '')

            fs.writeFile(emailListPath, data, (err) => {
                if (err) {
                    reject(err)
                } else {
                    resolve()
                }
            })
        })
    })
}

module.exports = {
    addEmailToList,
    removeEmailFromList,
    getEmailList,
    getSendingListFromEmailArray
}