const nodemailer = require('nodemailer')

const { SMTP_USER, SMTP_PASS } = process.env

// set up mail transport
const transport = nodemailer.createTransport({
    host: 'smtp.cloudmta.net',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
    },
    logger: true
});

function sendEmail({ to, subject, text, html }) {
    return transport.sendMail({
        from: "Missionary Mail Bot <mailbot@parkernilson.com>",
        to,
        subject,
        text,
        html
    })
}

module.exports = {
    sendEmail
}