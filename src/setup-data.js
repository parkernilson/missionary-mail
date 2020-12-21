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