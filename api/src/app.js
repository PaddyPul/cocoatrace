require('express-async-errors');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const app = express();

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.WEB_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(require('./routes/auth'));
app.use(require('./routes/organizations'));
app.use(require('./routes/farms'));
app.use(require('./routes/certificates'));
app.use(require('./routes/batches'));
app.use(require('./routes/holdings'));
app.use(require('./routes/listings'));
app.use(require('./routes/contracts'));
app.use(require('./routes/shipments'));
app.use(require('./routes/payments'));
app.use(require('./routes/evidence'));
app.use(require('./routes/provenance'));
app.use(require('./routes/audit'));

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack || err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
