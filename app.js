const express = require('express');
const fileUpload = require('express-fileupload');
const csvParse = require('csv-parse');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const twilio = require('twilio');
const nodemailer = require('nodemailer');

dotenv.config();

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());

let contacts = [];

app.get('/', (req, res) => {
  res.render('index', { contacts, message: null, error: null });
});

app.post('/upload', (req, res) => {
  if (!req.files || !req.files.csvfile) {
    return res.render('index', { contacts, message: null, error: 'No file uploaded.' });
  }
  const csvfile = req.files.csvfile;
  csvParse(csvfile.data.toString(), { columns: true, trim: true }, (err, records) => {
    if (err) {
      return res.render('index', { contacts, message: null, error: 'Invalid CSV format.' });
    }
    contacts = records;
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
  if (method === 'sms') {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    for (const contact of contacts) {
      try {
        await client.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: contact.phone
        });
        sendResults.push(`SMS sent to ${contact.firstName} ${contact.lastName}`);
      } catch (e) {
        sendResults.push(`Failed to send SMS to ${contact.firstName} ${contact.lastName}`);
      }
    }
  } else if (method === 'email') {
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    for (const contact of contacts) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_FROM,
          to: contact.email,
          subject: 'Notification',
          text: message
        });
        sendResults.push(`Email sent to ${contact.firstName} ${contact.lastName}`);
      } catch (e) {
        sendResults.push(`Failed to send email to ${contact.firstName} ${contact.lastName}`);
      }
    }
  }
  res.render('index', { contacts, message: sendResults.join('\n'), error: null });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
