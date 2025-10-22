const { parse } = require('csv-parse');

// Flexible header mapping
const headerMap = {
  firstName: ['firstName', 'firstname', 'First Name', 'first_name'],
  lastName: ['lastName', 'lastname', 'Last Name', 'last_name'],
  phone: ['phone', 'Phone', 'phoneNumber', 'phone_number', 'mobile'],
  email: ['email', 'Email', 'emailAddress', 'email_address']
};

function findCol(sample, possibles) {
  return Object.keys(sample).find(k => possibles.includes(k));
}

exports.handleUpload = (req, res, contacts) => {
  if (!req.files || !req.files.csvfile) {
    return res.render('index', { contacts, message: null, error: 'No file uploaded.', title: 'NotifyTwilio', user: req.user });
  }
  const csvfile = req.files.csvfile;
  parse(csvfile.data.toString(), { columns: true, trim: true }, (err, records) => {
    if (err) {
      return res.render('index', { contacts, message: null, error: 'Invalid CSV format.', title: 'NotifyTwilio', user: req.user });
    }
    const sample = records[0] || {};
    const fNameCol = findCol(sample, headerMap.firstName);
    const lNameCol = findCol(sample, headerMap.lastName);
    const phoneCol = findCol(sample, headerMap.phone);
    const emailCol = findCol(sample, headerMap.email);
    if (!fNameCol || !lNameCol || !phoneCol || !emailCol) {
      return res.render('index', { contacts, message: null, error: 'CSV must contain columns for first name, last name, phone, and email.', title: 'NotifyTwilio', user: req.user });
    }
    const newContacts = records.map(r => ({
      firstName: r[fNameCol],
      lastName: r[lNameCol],
      phone: r[phoneCol],
      email: r[emailCol]
    }));
    contacts.length = 0;
    newContacts.forEach(c => contacts.push(c));
    res.render('index', { contacts, message: 'CSV uploaded successfully.', error: null, title: 'NotifyTwilio', user: req.user });
  });
};
