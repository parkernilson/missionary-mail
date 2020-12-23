const fs = require('fs')
const path = require('path')

const dataDir = path.join(process.env.PWD, 'data');

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir)
}

const emailListFilepath = path.join(dataDir, 'email-list.txt')
if (!fs.existsSync(emailListFilepath)) {
    fs.writeFileSync(emailListFilepath, "")
}

const requestsToJoinFilepath = path.join(dataDir, 'join-requests.txt')
if (!fs.existsSync(requestsToJoinFilepath)) {
    fs.writeFileSync(requestsToJoinFilepath, "")
}