exports.handleConfirm = (req, res, contacts, pending) => {
  const { message, method } = req.body;
  if (!contacts.length) {
    return res.render('index', { contacts, message: null, error: 'No contacts uploaded.' });
  }
  if (!message) {
    return res.render('index', { contacts, message: null, error: 'Message cannot be empty.' });
  }
  pending.message = message;
  pending.method = method;
  res.render('confirm', { contacts, message, method, error: null, testResult: null });
};
