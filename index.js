const fs = require('fs')

const express = require('express')
const basicAuth = require('express-basic-auth')
const session = require('express-session')
const flash = require('connect-flash')
const cookieParser = require('cookie-parser')
const nodemailer = require('nodemailer')
const path = require('path')
const app = express()

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

function validateEmail(email) {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    return re.test(String(email).toLowerCase())
}

// TODO: add a kill switch to shut off server

app.post('/incoming-mail', basicAuth({
    users: { 'eldernilson': 'GBHinckley!!8181' }
}), (req, res) => {
    // console.log(req.body)

    // TODO: handle email commands here

    // read email addresses from file into an array,
    fs.readFile(path.join(__dirname, 'data/email-list.txt'), 'utf8', (err, data) => {
        const recipients = data.split('\n').filter(v => v!=="")

        if (err) return res.sendStatus(500)

        transport.sendMail({
            from: 'Elder Nilson <mail@parkernilson.com>',
            to: "parker.todd.nilson@gmail.com",
            subject: "A test email",
            text: req.body.plain,
            html: req.body.html
        }).then(value => {
            res.sendStatus(200)
        }).catch(error => {
            res.sendStatus(500)
        })

    })

})

app.post('/sign-up', (req, res) => {

    // TODO: whenever the list changes, send an email to parker.nilson@missionary.org with the updated list, so I can always have an updated list

    const email = req.body.email
    if (email && validateEmail(email)) {
        // TODO: parse the email to make sure it is an email

        fs.readFile(path.join(__dirname, 'data/email-list.txt'), 'utf8', (err, data) => {
            if (err) {
                req.flash('error', 'An unexpected error occurred on the server. Please try again later.')
                return res.redirect('/')
            }

            if (!data.includes(`${req.body.email}\n`)) {
                data = `${data}${req.body.email}\n`
                fs.writeFile(path.join(__dirname, 'data/email-list.txt'), data, () => { 
                    return res.render('successfully-added')
                })
            } else {
                req.flash('error', 'You have already been added to the mailing list.')
                return res.redirect('/')
            }

        })

    } else {
        req.flash('error', 'You did not enter a valid email address.')
        return res.redirect('/')
    }

})

app.post('/remove-email', (req, res) => {
    fs.readFile(path.join(__dirname, 'data/email-list.txt'), "utf8", (err, data) => {
        if (err) {
            req.flash('error', 'An unexpected error occurred on the server. Please try again later.')
            return res.redirect('/unsubscribe')
        }

        if (!data.includes(`${req.body.email}\n`)) {
            req.flash('error', 'That email could not be found in my email list')
            return res.redirect('/unsubscribe')
        }

        const newData = data.replace(`${req.body.email}\n`, '')
        fs.writeFile(path.join(__dirname, 'data/email-list.txt'), newData, () => {
            return res.render('goodbye')
        })
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