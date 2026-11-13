const MailGen = require("mailgen");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const cryptoRandomString = require("crypto-random-string");

// Serialises a value as a JavaScript expression that is safe to place inside
// an inline <script>. JSON.stringify alone is not enough: "</script>" would
// close the tag, and U+2028/U+2029 are line terminators in older JS engines.
module.exports.serializeForScript = function(value){
	return JSON.stringify(value === undefined ? null : value)
		.replace(/</g, "\\u003c")
		.replace(/>/g, "\\u003e")
		.replace(/&/g, "\\u0026")
		.replace(/\u2028/g, "\\u2028")
		.replace(/\u2029/g, "\\u2029");
};

// Remember-me and reset tokens are stored as SHA-256 hashes; the raw token
// only ever goes to the user (cookie or email link).
module.exports.hashToken = function(token){
	return crypto.createHash("sha256").update(String(token)).digest("hex");
};

const mailTransport = nodemailer.createTransport({
	port: 465,
	host: process.env.MAILER_HOST,
	auth: {
		user: process.env.MAILER_USERNAME,
		pass: process.env.MAILER_PASSWORD
	}
});

module.exports.generatePasswordResetEmail = function(user, resetToken){
    const mailGenerator = new MailGen({
        theme: process.env.PASSWORD_RESET_MAIL_THEME || "cerberus",
        product: {
            // Th produce's name is an empty string so the app name doesn't 
            // show up at the top of the mail
            name: " ",
            link: process.env.SITE_URL,
            logo: `${process.env.SITE_URL}/logo-120.png`,
            copyright: `© ${new Date().getFullYear()} <a href="${process.env.SITE_URL}">${String(process.env.APP_NAME).toUpperCase()}</a>.<br />All rights reserved.`
        }
    });
	const email = {
		body: {
            name: user.name,
            signature: false,
			intro: [
				"You have received this email because a password reset request for your account was received.",
				`Do note that this link will be valid for the next ${Number(process.env.RESET_TOKEN_EXPIRY) || 6} hours.`
			],
			action: {
				instructions: "Click below to reset your password:",
				button: {
                    fallback: true,
					color: "#ca0a1c",
					text: "Reset your password",
					link: `${process.env.SITE_URL}/reset-password/${encodeURIComponent(resetToken)}`
				}
			},
			outro:
				"If you did not request a password reset, no further action is required on your part."
		}
	};
	return [mailGenerator.generate(email), mailGenerator.generatePlaintext(email)];
}

module.exports.sendEmail = async function(to, subject, html, text){
	const mailOptions = {
		to,
		html,
		text,
		subject,
		from: process.env.MAILER_ADDRESS,
	};
	await mailTransport.sendMail(mailOptions);
};

module.exports.generateRandomString = function(length){
    length = Number(length)|| 20;
    return cryptoRandomString({ length })
}