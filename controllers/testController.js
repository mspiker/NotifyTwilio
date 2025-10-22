const twilio = require('twilio');

function personalize(msg, contact) {
  return msg
    .replace(/_firstname/gi, contact.firstName)
    .replace(/_lastname/gi, contact.lastName);
}

exports.handleTest = async (req, res, contacts, pending) => {
  const { testPhone } = req.body;
  if (!pending.message || !pending.method) {
    return res.render('index', { contacts, message: null, error: 'No message to test.', user: req.user, title: 'NotifyTwilio' });
  }
  if (!testPhone) {
    return res.render('confirm', { contacts, message: pending.message, method: pending.method, error: 'Please enter a phone number.', user: req.user, title: 'Confirm Message' });
  }
  const contact = contacts[0] || { firstName: '', lastName: '' };
  const personalizedMessage = personalize(pending.message, contact);
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  try {
    await client.messages.create({
      body: personalizedMessage,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: testPhone
    });
  res.render('confirm', { contacts, message: pending.message, method: pending.method, error: null, testResult: `Test SMS sent to ${testPhone}`, user: req.user, title: 'Confirm Message' });
  } catch (e) {
  res.render('confirm', { contacts, message: pending.message, method: pending.method, error: 'Failed to send test SMS.', testResult: null, user: req.user, title: 'Confirm Message' });
  }
};
