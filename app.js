// ...existing code...

// Place this after app is defined

const express = require('express');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const uploadController = require('./controllers/uploadController');
const sendController = require('./controllers/sendController');
const confirmController = require('./controllers/confirmController');
const testController = require('./controllers/testController');
const path = require('path');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const twilio = require('twilio');
const sgMail = require('@sendgrid/mail');

dotenv.config();

const app = express();
app.use(cookieParser());
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
let pending = { message: null, method: null };

const authController = require('./controllers/authController');

app.get('/', authController.ensureAuthenticated, (req, res) => {
  res.render('index', { contacts, message: null, error: null, title: 'NotifyTwilio', user: req.user });
});

app.post('/confirm', authController.ensureAuthenticated, (req, res) => {
  confirmController.handleConfirm(req, res, contacts, pending);
});

app.post('/test', authController.ensureAuthenticated, (req, res) => {
  testController.handleTest(req, res, contacts, pending);
});

app.get('/confirm', authController.ensureAuthenticated, (req, res) => {
  res.render('confirm', { error: null, user: req.user });
});
app.post('/upload', authController.ensureAuthenticated, (req, res) => {
  uploadController.handleUpload(req, res, contacts);
});

app.post('/send', authController.ensureAuthenticated, (req, res) => {
  sendController.handleSend(req, res, contacts, pending, csv => { lastResultsCsv = csv; });
});


app.get('/results.csv', authController.ensureAuthenticated, (req, res) => {
  if (!lastResultsCsv) {
    return res.status(404).send('No results available.');
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="results.csv"');
  res.send(lastResultsCsv);
});

// Auth routes
app.get('/login', (req, res) => {
  res.render('auth/login', { error: null, user: req.user || null });
});
app.post('/login', authController.login);
app.get('/register', (req, res) => {
  res.render('auth/register', { error: null, user: req.user || null });
});
app.post('/register', authController.register);
app.get('/logout', authController.logout);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
