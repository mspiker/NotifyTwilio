const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const users = [];

exports.register = async (req, res) => {
  const { customerId, firstName, lastName, email, password } = req.body;
  if (!customerId || !firstName || !lastName || !email || !password) {
     return res.render('auth/register', { error: 'All fields are required.', user: null });
  }
  if (users.find(u => u.email === email)) {
     return res.render('auth/register', { error: 'Email already registered.', user: null });
  }
  const hashedPassword = await argon2.hash(password);
  users.push({ customerId, firstName, lastName, email, password: hashedPassword });
  res.redirect('/login');
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) {
     return res.render('auth/login', { error: 'Invalid email or password.', user: null });
  }
  const match = await argon2.verify(user.password, password);
  if (!match) {
     return res.render('auth/login', { error: 'Invalid email or password.', user: null });
  }
  // Issue JWT
  const token = jwt.sign({ email: user.email, customerId: user.customerId, firstName: user.firstName, lastName: user.lastName }, process.env.JWT_SECRET || 'jwtsecret', { expiresIn: '2h' });
  res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'strict' });
  res.redirect('/');
};

exports.logout = (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
};

exports.ensureAuthenticated = (req, res, next) => {
  const token = req.cookies && req.cookies.token;
  if (!token) return res.redirect('/login');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jwtsecret');
    req.user = {
      email: decoded.email,
      customerId: decoded.customerId,
      firstName: decoded.firstName,
      lastName: decoded.lastName
    };
    return next();
  } catch (err) {
    res.clearCookie('token');
    return res.redirect('/login');
  }
};
