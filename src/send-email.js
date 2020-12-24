const nodemailer = require('nodemailer')

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

function sendEmail({ to, subject, text, html }) {
    return transport.sendMail({
        from: "Missionary Mail Bot <parker.nilson@missionary.org>",
        to,
        subject,
        text,
        html
    })
}

module.exports = {
    sendEmail
}