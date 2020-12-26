const fs = require('fs')

const express = require('express')
const basicAuth = require('express-basic-auth')
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
    getEmailList, 
    getSendingListFromEmailArray, 
    sendConfirmationEmail,
    attemptVerifyEmail
} = require('./src/email-list')
const { getEmailFromConfirmationCode, generateConfirmationCode } = require('./src/confirmation-code')
const { sendEmail } = require('./src/send-email')

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


// Set up middleware
const staticOptions = {
  dotfiles: 'ignore',
  etag: false,
  extensions: ['htm', 'html'],
  index: false,
  maxAge: '1d',
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


// TODO: bug test case sensitivity
// TODO: bug test data persistence between boots
// TODO: bug test restarting droplet

// TODO: add a header (with navigation or some way to get to home)

function validateEmail(email) {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    return re.test(String(email).toLowerCase())
}

app.post('/admin', basicAuth({
    users: { 'parkernilson': 'ImASnake8421' }
}), async (req, res) => {
    const emails = getEmailArrayFromListOfEmails(req.body.emails)
    const action = req.body.action

    try {
        if (emails.length > 0) {
            for (let email of emails) {
                if (action === "add-emails") {
                    const commandResult = await addEmailToList(email)
                    const result = commandResult.result

                    if (!result.ok) {
                        throw new Error(`An unexpected error occurred while trying to add the email ${email} to the list.`)
                    }
                } else if (action === "remove-emails") {
                    const commandResult = await removeEmailFromList(email)
                    const result = commandResult.result

                    if (!result.ok) {
                        throw new Error(`An unexpected error occurred while trying to remove the email ${email} from the list.`)
                    }
                }
            }
        }
    } catch (error) {
        req.flash("Error", error)
        return res.redirect('/admin')
    }

    // if we reach this point, the operation was successful
    // send an email to inform me of the new mailing list
    try {
        const emails = await getEmailList({ verified: true })
        const newSendingList = getSendingListFromEmailArray(emails)
        await sendEmail({
            to: "parker.nilson@misisonary.org",
            subject: "The mailing list has been updated by admin dashboard",
            text: newSendingList !== "" ? 
                `The new mailing list: ${newSendingList}`
                : 'The mailing list is now empty.'
        })
    } catch (error) {
        req.flash("error", error)
        return res.redirect('/admin')
    }
})

app.get('/admin', basicAuth({
    users: { 'parkernilson': 'ImASnake8421' }
}), (req, res) => {
    return res.render('admin-dashboard')
})

app.post('/mailing-list/sign-up', async (req, res) => {
    const email = req.body.email.toLowerCase()

    if (!email || !validateEmail(email)) {
        req.flash('error', 'You did not enter a valid email address.')
        return res.redirect('/')
    }

    let emails;
    try {
        emails = await getEmailList()
    } catch(error) {
        // a 5xx error, because the email list could not be retrieved
        console.error(error)
        req.flash('error', 'An unexpected error occurred while retrieving the mailing list. Please try again later.')
        return res.redirect('/')
    }

    if (emails.includes(email)) {
        // 409 Conflict error, because the email already exists
        req.flash('error', 'That email is already on the mailing list.')
        return res.redirect('/')
    }
    
    let writeResult;
    try {
        const commandResult = await addEmailToList(email)
        writeResult = commandResult.result
    } catch (error) {
        // a 5xx error occurred while writing the email to the list
        console.error(error)
        req.flash('error', 'An unexpected error occurred while trying to write that email to the list. Please try again later.')
        return res.redirect('/')
    }

    if (writeResult.ok) {
        // send confirmation email to new email
        if (process.env.ENV === "production") {
            sendConfirmationEmail(email)
                .catch(error => console.error(error))
        }

        const confirmationCode = encodeURIComponent(generateConfirmationCode(email))
        console.log(`Successfully added unverified email ${email} to list with verification code: ${confirmationCode}`)

        // tell the user that they have been added to the list
        return res.render('confirmation-sent')
    } else {
        console.error("Error: result was not ok after attempting to write new email to database")
        req.flash("error", "An unexpected error occurred while trying to write that email to the list. Please try again later.")
        return res.redirect('/')
    }
})

app.post('/mailing-list/remove-email', async (req, res) => {
    const email = req.body.email.toLowerCase()

    let emails
    try {
        emails = await getEmailList()
    } catch (error) {
        console.error(error)
        req.flash('error', 'An unexpected error occurred while retrieving the mailing list. Please try again later.')
        return res.redirect('/')
    }

    if (!emails.includes(email)) {
        req.flash('error', 'That email could not be found in the current mailing list.')
        return res.redirect('/unsubscribe')
    }

    let removeResult
    try {
        commandResult = await removeEmailFromList(email)
        removeResult = commandResult.result
    } catch (error) {
        console.error(error)
        req.flash('error', 'An unexpected error occurred while trying to remove that email from the mailing list. Please try again later.')
        return res.redirect('/unsubscribe')
    }

    if (!removeResult.ok) {
        req.flash('error', 'An unexpected error occurred while trying to remove that email from the mailing list. Please try again later.')
        return res.redirect('/unsubscribe')
    }

    const newEmailList = emails.filter(e => e.verified && e !== email)
    
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

    let verificationResult
    try {
        commandResult = await attemptVerifyEmail(emailToVerify)
        verificationResult = commandResult.result
    } catch (error) {
        console.error(error)
        req.flash('error', 'An unexpected error occurred while trying to verify your email. Please try again later.')
        return res.redirect('/')
    }

    if (!verificationResult.ok) {
        req.flash('error', 'An unexpected error occurred while trying to verify your email. Please try again later.')
        return res.redirect('/')
    }

    if (verificationResult.nModified < 1) {
        req.flash('error', 'That verification code is invalid.')
        return res.redirect('/')
    }

    // retrieve all verified emails from the database
    let newEmailList, newSendingList
    try {
        newEmailList = await getEmailList({ verified: true })
        newSendingList = getSendingListFromEmailArray(newEmailList)
    } catch (error) {
        return console.error(error)
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

app.get('/unsubscribe', (req, res) => {
    res.render('unsubscribe', { messages: req.flash('error') })
})

app.get('/', (req, res) => {
    res.render('home', { messages: req.flash('error') })
})

app.listen(8080, '0.0.0.0', () => {
    console.log('Parker\'s mail server is listening on port 8080...')
})
