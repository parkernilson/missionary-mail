const fs = require('fs')

const express = require('express')
const basicAuth = require('express-basic-auth')
const session = require('express-session')
const flash = require('connect-flash')
const cookieParser = require('cookie-parser')
const nodemailer = require('nodemailer')
const path = require('path')
const app = express()

const { addEmailToList, removeEmailFromList, getEmailList, getSendingListFromEmailArray } = require('./src/email-list')

app.use(cookieParser('fab29sjkdafb2%%'));
app.use(session({cookie: { maxAge: 60000 }}));
app.use(flash());

app.set('view engine', 'pug')
app.set('views')

require('./src/setup-data')

// set up mail transport
const transport = nodemailer.createTransport({
    host: 'smtp.cloudmta.net',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
        user: "7ca731b2f948c506",
        pass: "KrymdLx4Vpr1A77iC3tQVgLa"
    },
    logger: true
});

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

// TODO: add a rate limiter
// TODO: validate email address before adding to the txt or before removing
    /* 
        NOTE: I believe an easy way to do this in a reasonably effective way
        would be to send an email with a link that has a hashed version of the
        email to add, then when the user goes to the link, the email gets added to the list.
    */
// TODO: send a confirmation email
// TODO: add a header (with navigation or some way to get to home)

function validateEmail(email) {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    return re.test(String(email).toLowerCase())
}

app.post('/incoming-mail', basicAuth({
    users: { 'eldernilson': 'GBHinckley!!8181' }
}), (req, res) => {

    // TODO: handle email commands here

})

app.post('/sign-up', (req, res) => {
    const email = req.body.email
    if (email && validateEmail(email)) {
        getEmailList()
            .then(emails => {
                if (!emails.includes(email)) {
                    addEmailToList(email).then((newEmails) => {
                        // Successfully added the email to the list
                        const newSendingList = getSendingListFromEmailArray(newEmails)

                        // send an email to notify me that my mailing list has changed
                        if (process.env.ENV === "production") {
                            transport.sendMail({
                                from: "Missionary Mail Bot <mailbot@parkernilson.com>",
                                to: "parker.todd.nilson@gmail.com",
                                subject: "Somebody Joined The Mailing List!",
                                text: newSendingList !== "" ? 
                                    `The new mailing list: ${newSendingList}`
                                    : 'The mailing list is now empty.'
                            }).catch(error => console.error)
                        }


                        // tell the user that they have been added to the list
                        res.render('successfully-added')
                    }).catch(error => {
                        // a 5xx error occurred while writing the email to the list
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
                req.flash('error', 'An unexpected error occurred while retrieving the mailing list. Please try again later.')
                return res.redirect('/')
            })

    } else {
        req.flash('error', 'You did not enter a valid email address.')
        return res.redirect('/')
    }
})

app.post('/remove-email', (req, res) => {
    const email = req.body.email

    getEmailList()
        .then(emails => {
            if (!emails.includes(email)) {
                req.flash('error', 'That email could not be found in the current mailing list.')
                res.redirect('/unsubscribe')
            } else {
                removeEmailFromList(email)
                    .then((newEmails) => {
                        // successfully removed the email
                        
                        const newSendingList = getSendingListFromEmailArray(newEmails)

                        // send an email to notify me that my mailing list has changed
                        if (process.env.ENV === "production") {
                            transport.sendMail({
                                from: "Missionary Mail Bot <mailbot@parkernilson.com>",
                                to: "parker.todd.nilson@gmail.com",
                                subject: "Somebody Was Removed From Mailing List!",
                                text: newSendingList !== "" ? 
                                    `The new mailing list: ${newSendingList}`
                                    : 'The mailing list is now empty.'
                            }).catch(error => console.error)
                        }

                        // inform the user that they have been removed from the list
                        res.render('goodbye')
                    })
                    .catch(error => {
                        req.flash('error', 'An unexpected error occurred while trying to remove that email from the mailing list. Please try again later.')
                        res.redirect('/unsubscribe')
                    })
            }
        })
        .catch(error => {
            req.flash('error', 'An unexpected error occurred while retrieving the mailing list. Please try again later.')
            return res.redirect('/')
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
