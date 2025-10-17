const twilio = require('twilio');
const sgMail = require('@sendgrid/mail');
const { stringify } = require('csv-stringify/sync');

function personalize(msg, contact) {
  return msg
    .replace(/_firstname/gi, contact.firstName)
    .replace(/_lastname/gi, contact.lastName);
}

exports.handleSend = async (req, res, contacts, pending, setResultsCsv) => {
  const { message, method } = req.body;
  if (!contacts.length) {
    return res.render('index', { contacts, message: null, error: 'No contacts uploaded.' });
  }
  if (!message) {
    return res.render('index', { contacts, message: null, error: 'Message cannot be empty.' });
  }
  let sendResults = [];
  let resultsForCsv = [];
  if (method === 'sms') {
    pending.message = null;
    pending.method = null;
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    for (const contact of contacts) {
      const personalizedMessage = personalize(message, contact);
      let resultMsg;
      try {
        await client.messages.create({
          body: personalizedMessage,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: contact.phone
        });
        resultMsg = 'SMS sent';
        sendResults.push(`SMS sent to ${contact.firstName} ${contact.lastName}`);
      } catch (e) {
        resultMsg = 'Failed to send SMS';
        sendResults.push(`Failed to send SMS to ${contact.firstName} ${contact.lastName}`);
      }
      resultsForCsv.push({ ...contact, result: resultMsg });
    }
  } else if (method === 'email') {
    pending.message = null;
    pending.method = null;
    for (const contact of contacts) {
      const personalizedMessage = personalize(message, contact);
      const msg = {
        to: contact.email,
        from: process.env.EMAIL_FROM,
        subject: 'Notification',
        text: personalizedMessage
      };
      let resultMsg;
      try {
        await sgMail.send(msg);
        resultMsg = 'Email sent';
        sendResults.push(`Email sent to ${contact.firstName} ${contact.lastName}`);
      } catch (e) {
        resultMsg = 'Failed to send email';
        sendResults.push(`Failed to send email to ${contact.firstName} ${contact.lastName}`);
      }
      resultsForCsv.push({ ...contact, result: resultMsg });
    }
  }
  const csvData = stringify(resultsForCsv, { header: true });
  setResultsCsv(csvData);
  res.render('index', { contacts, message: sendResults.join('\n'), error: null, resultsAvailable: true });
};
