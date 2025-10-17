// ...existing code...

// Place this after app is defined

const express = require('express');
const fileUpload = require('express-fileupload');
const { parse } = require('csv-parse');
const fs = require('fs');
const { stringify } = require('csv-stringify/sync');
const path = require('path');
const dotenv = require('dotenv');
const twilio = require('twilio');
const sgMail = require('@sendgrid/mail');

dotenv.config();

const app = express();
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());

app.post('/clear', (req, res) => {
  contacts = [];
  lastResultsCsv = null;
  pendingMessage = null;
  pendingMethod = null;
  res.redirect('/');
});

let contacts = [];
let lastResultsCsv = null;


// Store message and method temporarily for confirmation
let pendingMessage = null;
let pendingMethod = null;

app.get('/', (req, res) => {
  res.render('index', { contacts, message: null, error: null });
});

app.post('/confirm', (req, res) => {
  const { message, method } = req.body;
  if (!contacts.length) {
    return res.render('index', { contacts, message: null, error: 'No contacts uploaded.' });
  }
  if (!message) {
    return res.render('index', { contacts, message: null, error: 'Message cannot be empty.' });
  }
  pendingMessage = message;
  pendingMethod = method;
  res.render('confirm', { contacts, message, method, error: null, testResult: null });
});

app.post('/test', async (req, res) => {
  const { testPhone } = req.body;
  if (!pendingMessage || !pendingMethod) {
    return res.render('index', { contacts, message: null, error: 'No message to test.' });
  }
  if (!testPhone) {
    return res.render('confirm', { contacts, message: pendingMessage, method: pendingMethod, error: 'Please enter a phone number.' });
  }
  // Use the first contact for personalization
  const contact = contacts[0] || { firstName: '', lastName: '' };
  function personalize(msg, contact) {
    return msg
      .replace(/_firstname/gi, contact.firstName)
      .replace(/_lastname/gi, contact.lastName);
  }
  const personalizedMessage = personalize(pendingMessage, contact);
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  try {
    await client.messages.create({
      body: personalizedMessage,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: testPhone
    });
    res.render('confirm', { contacts, message: pendingMessage, method: pendingMethod, error: null, testResult: `Test SMS sent to ${testPhone}` });
  } catch (e) {
    res.render('confirm', { contacts, message: pendingMessage, method: pendingMethod, error: 'Failed to send test SMS.', testResult: null });
  }
});

app.post('/upload', (req, res) => {
  if (!req.files || !req.files.csvfile) {
    return res.render('index', { contacts, message: null, error: 'No file uploaded.' });
  }
  const csvfile = req.files.csvfile;
  parse(csvfile.data.toString(), { columns: true, trim: true }, (err, records) => {
    if (err) {
      return res.render('index', { contacts, message: null, error: 'Invalid CSV format.' });
    }
    // Flexible header mapping
    const headerMap = {
      firstName: ['firstName', 'firstname', 'First Name', 'first_name'],
      lastName: ['lastName', 'lastname', 'Last Name', 'last_name'],
      phone: ['phone', 'Phone', 'phoneNumber', 'phone_number', 'mobile'],
      email: ['email', 'Email', 'emailAddress', 'email_address']
    };
    // Find actual column names in the first record
    const sample = records[0] || {};
    function findCol(possibles) {
      return Object.keys(sample).find(k => possibles.includes(k));
    }
    const fNameCol = findCol(headerMap.firstName);
    const lNameCol = findCol(headerMap.lastName);
    const phoneCol = findCol(headerMap.phone);
    const emailCol = findCol(headerMap.email);
    if (!fNameCol || !lNameCol || !phoneCol || !emailCol) {
      return res.render('index', { contacts, message: null, error: 'CSV must contain columns for first name, last name, phone, and email.' });
    }
    contacts = records.map(r => ({
      firstName: r[fNameCol],
      lastName: r[lNameCol],
      phone: r[phoneCol],
      email: r[emailCol]
    }));
    res.render('index', { contacts, message: 'CSV uploaded successfully.', error: null });
  });
});

app.post('/send', async (req, res) => {
  const { message, method } = req.body;
  if (!contacts.length) {
    return res.render('index', { contacts, message: null, error: 'No contacts uploaded.' });
  }
  if (!message) {
    return res.render('index', { contacts, message: null, error: 'Message cannot be empty.' });
  }
  let sendResults = [];
  let resultsForCsv = [];
    // Helper to personalize message
    function personalize(msg, contact) {
      return msg
        .replace(/_firstname/gi, contact.firstName)
        .replace(/_lastname/gi, contact.lastName);
    }

  // Send messages: SMS
  if (method === 'sms') {
    // Clear pending message after sending
    pendingMessage = null;
    pendingMethod = null;
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

    // Send messages: Email
  } else if (method === 'email') {
    // Clear pending message after sending
    pendingMessage = null;
    pendingMethod = null;
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

  // Generate CSV with results
  const csvData = stringify(resultsForCsv, { header: true });
  lastResultsCsv = csvData;
  res.render('index', { contacts, message: sendResults.join('\n'), error: null, resultsAvailable: true });
});


app.get('/results.csv', (req, res) => {
  if (!lastResultsCsv) {
    return res.status(404).send('No results available.');
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="results.csv"');
  res.send(lastResultsCsv);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
