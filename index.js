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


// TODO: add a header (with navigation or some way to get to home)
// TODO: switch to async functions
// TODO: send emails to the correct emails
// TODO: check result.ok after each database operation before accepting new state

function validateEmail(email) {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    return re.test(String(email).toLowerCase())
}

app.post('/incoming-mail', basicAuth({
    users: { 'eldernilson': 'GBHinckley!!8181' }
}), (req, res) => {

    // TODO: handle email commands here

})

// BUG the new file list functions are not working (specifically getEmailList). Fix these

app.post('/mailing-list/sign-up', (req, res) => {
    const email = req.body.email
    if (email && validateEmail(email)) {
        getEmailList()
            .then(emails => {
                if (!emails.includes(email)) {
                    addEmailToList(email).then(async result => {

                        // send confirmation email to new email
                        if (process.env.ENV === "production") {
                            sendConfirmationEmail(email)
                                .catch(error => console.error(error))
                        } else {
                            const confirmationCode = encodeURIComponent(generateConfirmationCode(email))
                            console.log(`added email ${email} to list with verification code: ${confirmationCode}`)
                        }

                        // tell the user that they have been added to the list
                        res.render('confirmation-sent')
                    }).catch(error => {
                        // a 5xx error occurred while writing the email to the list
                        console.error(error)
                        req.flash('error', 'An unexpected error occurred while trying to write that email to the list. Please try again later.')
                        res.redirect('/')
                    })
                } else {
                    // 409 Conflict error, because the email already exists
                    req.flash('error', 'That email is already on the mailing list.')
                    res.redirect('/')
                }
            }).catch(error => {
                // a 5xx error, because the email list could not be retrieved
                console.error(error)
                req.flash('error', 'An unexpected error occurred while retrieving the mailing list. Please try again later.')
                return res.redirect('/')
            })

    } else {
        req.flash('error', 'You did not enter a valid email address.')
        return res.redirect('/')
    }
})

app.post('/mailing-list/remove-email', (req, res) => {
    const email = req.body.email

    getEmailList()
        .then(emails => {
            if (!emails.includes(email)) {
                req.flash('error', 'That email could not be found in the current mailing list.')
                res.redirect('/unsubscribe')
            } else {
                removeEmailFromList(email)
                    .then(result => {
                        // successfully removed the email
                        const newEmailList = emails.filter(e => e !== email)
                        
                        const newSendingList = getSendingListFromEmailArray(newEmailList)
                        console.log(newSendingList)

                        // send an email to notify me that my mailing list has changed
                        if (process.env.ENV === "production") {
                            // notify me that the mailing list has changed
                            sendEmail({
                                to: "parker.todd.nilson@gmail.com",
                                subject: "Somebody Was Removed From Mailing List!",
                                text: newSendingList !== "" ? 
                                    `The new mailing list: ${newSendingList}`
                                    : 'The mailing list is now empty.'
                            }).catch(error => console.error(error))
                        }

                        // inform the user that they have been removed from the list
                        res.render('goodbye')
                    })
                    .catch(error => {
                        console.error(error)
                        req.flash('error', 'An unexpected error occurred while trying to remove that email from the mailing list. Please try again later.')
                        res.redirect('/unsubscribe')
                    })
            }
        })
        .catch(error => {
            console.error(error)
            req.flash('error', 'An unexpected error occurred while retrieving the mailing list. Please try again later.')
            return res.redirect('/')
        })
})

// TODO: implement email verification for join and remove
app.get('/mailing-list/verify-email/:confirmationCode', async (req, res) => {
    const confirmationCode = decodeURIComponent(req.params.confirmationCode)
    const emailToVerify = getEmailFromConfirmationCode(confirmationCode)

    attemptVerifyEmail(emailToVerify)
        .then(async commandResult => {
            const { result } = commandResult
            if (result.ok && result.nModified < 1) {
                req.flash('error', 'That verification code is invalid.')
                res.redirect('/')
            } else {
                // notify me that the mailing list has changed

                // retrieve all verified emails from the database
                const newEmailList = await getEmailList()
                const newSendingList = getSendingListFromEmailArray(newEmailList)

                if (process.env.ENV === "production") {
                    sendEmail({
                        to: "parker.todd.nilson@gmail.com",
                        subject: "Somebody Joined The Mailing List!",
                        text: newSendingList !== "" ? 
                            `The new mailing list: ${newSendingList}`
                            : 'The mailing list is now empty.'
                    }).catch(error => console.error(error))
                } else {
                    console.log(`Successfully verified email ${emailToVerify}.`)
                    console.log(`New sending list: ${newSendingList}`)
                }

                res.render('email-confirmed')
            }
        })
        .catch(error => {
            console.error(error)
            req.flash('error', 'An unexpected error occurred while trying to verify your email. Please try again later.')
            res.redirect('/')
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
