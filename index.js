const fs = require('fs')

const express = require('express')
const AES = require('crypto-js/aes')
const rateLimit = require('express-rate-limit')
const basicAuth = require('express-basic-auth')
const session = require('express-session')
const flash = require('connect-flash')
const cookieParser = require('cookie-parser')
const path = require('path')
const app = express()

// load the db
require('./src/db')
const { 
    addEmailToList, 
    removeEmailFromList, 
    getRecipientList,
    getSendingListFromEmailArray, 
    sendConfirmationEmail,
    attemptVerifyEmail,
    getEmailArrayFromListOfEmails
} = require('./src/email-list')
const { getEmailFromConfirmationCode, generateConfirmationCode } = require('./src/confirmation-code')
const { sendEmail } = require('./src/send-email')
const { verify } = require('crypto')
const { getDB } = require('./src/db')

app.use(cookieParser('fab29sjkdafb2%%'));
app.use(session({
    cookie: { maxAge: 60000 },
    resave: false,
    saveUninitialized: false,
    secret: "20dans23lkdmabsk"
}));
app.use(flash());

app.set('view engine', 'pug')
app.set('views')

const ADMIN_PASSWORD = "ImASnake8421"

// Set up middleware
const staticOptions = {
  dotfiles: 'ignore',
  etag: false,
  extensions: ['htm', 'html'],
  index: false,
  maxAge: '1h',
  redirect: false,
  setHeaders: function (res, path, stat) {
    res.set('x-timestamp', Date.now())
  }
}
app.use(express.static('public', staticOptions))
app.use(express.json())
app.use(express.urlencoded({extended: true}))

// API Rate limiter
const mailingListLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 30
});
app.use('/mailing-list/', mailingListLimiter)

const adminDashboardLimiter = rateLimit({
    windowMs: 30 * 60 * 1000,
    max: 30
})
app.use('/admin/', adminDashboardLimiter)

function validateEmail(email) {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    return re.test(String(email).trim().toLowerCase())
}

app.post('/admin', async (req, res) => {
    const payloadEmails = getEmailArrayFromListOfEmails(req.body.emails.toLowerCase())
    const action = req.body.action
    const password = req.query.password

    if (password !== ADMIN_PASSWORD) {
        req.flash("error", "That password was incorrect.")
        console.error("Warning: User tried to access an admin command with improper credentials.")
        return res.redirect('/admin')
    }

    let allRecipients;
    try {
        allRecipients = await getRecipientList()
    } catch (error) {
        console.error(error)
        req.flash("error", "An unexpected error occurred while trying to retrieve the emails from the mailing list.")
        return res.redirect(`/admin?password=${password}`)
    }

    try {
        if (payloadEmails.length > 0) {
            for (let email of payloadEmails) {

                // check to see if there is a recipient for that email address already in the database
                const recipient = allRecipients.find(r => r.email === email)

                if (action === "add-emails") {
                    if (recipient) {
                        if (!recipient.verified) {
                            const verifyResult = (await attemptVerifyEmail(email)).result
                            if (!verifyResult.ok) throw new Error(`Result was not ok after trying to verify email ${email}.`)
                        }

                        // if the email is already present and verified, continue the loop
                        continue;
                    }

                    // add the email as already verified
                    const addEmailResult = (await addEmailToList(email, true)).result
                    if (!addEmailResult.ok) {
                        throw new Error(`An unexpected error occurred while trying to add the email ${email} to the list.`)
                    }
                } else if (action === "remove-emails") {
                    if (!recipient) {
                        // if the email to remove is not in the database, then skip this email in the loop
                        continue;
                    }

                    const removeEmailResult = (await removeEmailFromList(email)).result

                    if (!removeEmailResult.ok) {
                        throw new Error(`An unexpected error occurred while trying to remove the email ${email} from the list.`)
                    }
                }
            }
        }
    } catch (error) {
        console.error(error)
        req.flash("error", error)
        return res.redirect(`/admin?password=${password}`)
    }

    // if we reach this point, the operation was successful
    // send an email to inform me of the new mailing list
    try {
        const verifiedEmails = (await getRecipientList({ verified: true })).map(r => r.email)
        const newSendingList = getSendingListFromEmailArray(verifiedEmails)
        if (process.env.ENV === "production") {
            await sendEmail({
                to: "parker.nilson@missionary.org",
                subject: "The mailing list has been updated by admin dashboard",
                text: newSendingList !== "" ? 
                    `The new mailing list: ${newSendingList}`
                    : 'The mailing list is now empty.'
            }).catch(error => console.error(error))
        }

        console.log(`Admin command successful. New sending list ${newSendingList}`)
    } catch (error) {
        console.error(error)
        req.flash("error", error)
        return res.redirect(`/admin?password=${password}`)
    }

    return res.redirect(`/admin?password=${password}`)
})

app.post('/mailing-list/sign-up', async (req, res) => {
    const email = req.body.email.trim().toLowerCase()

    if (!email) {
        req.flash('error', 'You did not enter an email. Please enter an email address and try again.')
        return res.redirect('/')
    }

    if (!email || !validateEmail(email)) {
        console.error(`Error: User tried to input an invalid email ${email}`)
        req.flash('error', `The email ${email} is not a valid email address. Please try again with a different address`)
        return res.redirect('/')
    }

    let allRecipients;
    try {
        allRecipients = await getRecipientList()
    } catch(error) {
        // a 5xx error, because the email list could not be retrieved
        console.error(error)
        req.flash('error', 'An unexpected error occurred while retrieving the mailing list. Please try again later.')
        return res.redirect('/')
    }

    if (allRecipients.find(r => r.email === email)) {
        // 409 Conflict error, because the email already exists
        req.flash('error', 'That email is already on the mailing list.')
        return res.redirect('/')
    }
    
    try {
        const commandResult = await addEmailToList(email)
        const writeResult = commandResult.result

        if (!writeResult.ok) throw new Error("The write result was not ok.")
    } catch (error) {
        // a 5xx error occurred while writing the email to the list
        console.error(error)
        req.flash('error', 'An unexpected error occurred while trying to write that email to the list. Please try again later.')
        return res.redirect('/')
    }

    // send confirmation email to new email
    if (process.env.ENV === "production") {
        sendConfirmationEmail(email)
            .catch(error => console.error(error))
    }

    const confirmationCode = encodeURIComponent(generateConfirmationCode(email))
    console.log(`Successfully added unverified email ${email} to list with verification code: ${confirmationCode}`)

    // tell the user that they have been added to the list
    return res.render('confirmation-sent')
})

app.post('/mailing-list/remove-email', async (req, res) => {
    const email = req.body.email.toLowerCase()

    let allRecipients
    try {
        allRecipients = await getRecipientList()
    } catch (error) {
        console.error(error)
        req.flash('error', 'An unexpected error occurred while retrieving the mailing list. Please try again later.')
        return res.redirect('/')
    }

    if (!allRecipients.find(r => r.email === email)) {
        req.flash('error', 'That email could not be found in the current mailing list.')
        return res.redirect('/unsubscribe')
    }

    let removeResult
    try {
        commandResult = await removeEmailFromList(email)
        removeResult = commandResult.result

        if (!removeResult.ok) throw new Error("The remove result was not ok.")
    } catch (error) {
        console.error(error)
        req.flash('error', 'An unexpected error occurred while trying to remove that email from the mailing list. Please try again later.')
        return res.redirect('/unsubscribe')
    }

    let newEmailList
    try {
        newEmailList = (await getRecipientList({ verified: true })).map(r => r.email)
    } catch (error) {
        console.error(error)
        req.flash('error', 'An unexpected error occurred while trying to retrieve the updated mailing list. Please try again later.')
        return res.redirect('/unsubscribe')
    }
    
    const newSendingList = getSendingListFromEmailArray(newEmailList)

    // send an email to notify me that my mailing list has changed
    if (process.env.ENV === "production") {
        // notify me that the mailing list has changed
        sendEmail({
            to: "parker.nilson@missionary.org",
            subject: "Somebody Was Removed From Mailing List!",
            text: newSendingList !== "" ? 
                `The new mailing list: ${newSendingList}`
                : 'The mailing list is now empty.'
        }).catch(error => console.error(error))
    }

    console.log(`Successfully removed email ${email} from the mailing list.`)
    console.log(`New sending list: ${newSendingList}`)

    // inform the user that they have been removed from the list
    return res.render('goodbye')
})

// TODO: implement email verification for join and remove
app.get('/mailing-list/verify-email/:confirmationCode', async (req, res) => {
    const confirmationCode = decodeURIComponent(req.params.confirmationCode)
    const emailToVerify = getEmailFromConfirmationCode(confirmationCode)

    let allRecipients
    try {
        allRecipients = await getRecipientList()
    } catch (error) {
        console.error(error)
        req.flash('error', 'An unexpected error occurred while trying to get the current email list. Please try again later.')
        return res.redirect('/')
    }

    const found = allRecipients.find(r => r.email === emailToVerify)

    if (!found) {
        console.error(`Error: Attempted to verify email ${emailToVerify}, but it did not exist in the database.`)
        req.flash('error', `The email for that confirmation code did not exist in the database. Please try to submit your email again.`)
        return res.redirect('/')
    } else if (found && found.verified) {
        return res.render('email-confirmed')
    }

    let verificationResult
    try {
        verificationResult = (await attemptVerifyEmail(emailToVerify)).result
        if (!verificationResult.ok) throw new Error("The verification result was not ok.")
    } catch (error) {
        console.error(error)
        req.flash('error', 'An unexpected error occurred while trying to verify your email. Please try again later.')
        return res.redirect('/')
    }

    // retrieve all verified emails from the database
    let newEmailList, newSendingList
    try {
        newEmailList = (await getRecipientList({ verified: true })).map(r => r.email)
        newSendingList = getSendingListFromEmailArray(newEmailList)
    } catch (error) {
        console.error(error)
        req.flash('error', 'There was an unexpected error while retrieving the updated email list. Please try again later.')
        return res.redirect('/')
    }

    if (process.env.ENV === "production") {
        sendEmail({
            to: "parker.nilson@missionary.org",
            subject: "Somebody Joined The Mailing List!",
            text: newSendingList !== "" ? 
                `The new mailing list: ${newSendingList}`
                : 'The mailing list is now empty.'
        }).catch(error => console.error(error))
    }

    console.log(`Successfully verified email ${emailToVerify}.`)
    console.log(`New sending list: ${newSendingList}`)

    return res.render('email-confirmed')
})

app.get('/admin', async (req, res) => {
    const attemptedPassword = req.query.password
    if (attemptedPassword !== ADMIN_PASSWORD) {
        return res.sendStatus(401)
    }

    let allRecipients
    try {
        allRecipients = await getRecipientList()
    } catch (error) {
        console.error(error)
        req.flash("error", error)
    }

    const verifiedEmailList = allRecipients && allRecipients.length > 0 ? allRecipients.filter(r => r.verified).map(r => r.email) : undefined
    const unverifiedEmailList = allRecipients && allRecipients.length > 0 ? allRecipients.filter(r => !r.verified).map(r => r.email) : undefined

    res.render('admin-dashboard', { 
        messages: req.flash('error'),
        verifiedEmailList: getSendingListFromEmailArray(verifiedEmailList),
        unverifiedEmailList: getSendingListFromEmailArray(unverifiedEmailList),
        password: attemptedPassword
    })
})

app.get('/unsubscribe', (req, res) => {
    res.render('unsubscribe', { messages: req.flash('error') })
})

app.get('/', (req, res) => {
    res.render('home', { messages: req.flash('error') })
})

app.listen(8080, '0.0.0.0', () => {
    console.log('Parker\'s mail server is listening on port 8080...')
})
