const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dns = require('dns');
const { URL } = require('url');
require('dotenv').config();

const Url = require('./models/url');

const app = express();

// Middleware
app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use('/public', express.static(`${process.cwd()}/public`));

// MongoDB Connection
const mongoURI = process.env.MONGO_URI;
if (!mongoURI) {
  console.error("❌ MONGO_URI is missing from .env");
  process.exit(1);
}

mongoose.connect(mongoURI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/views/index.html');
});

// POST route - create short URL
let counter = 1;

app.post('/api/shorturl', async (req, res) => {
  const original_url = req.body.url;

  if (!original_url || typeof original_url !== 'string') {
    return res.json({ error: 'invalid url' });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(original_url);
  } catch (err) {
    return res.json({ error: 'invalid url' });
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return res.json({ error: 'invalid url' });
  }

  dns.lookup(parsedUrl.hostname, async (err) => {
    if (err) return res.json({ error: 'invalid url' });

    const url = new Url({ original_url, short_url: counter++ });
    await url.save();
    res.json({ original_url: url.original_url, short_url: url.short_url });
  });
});

// GET route - redirect
app.get('/api/shorturl/:short_url', async (req, res) => {
  const short_url = parseInt(req.params.short_url);

  if (isNaN(short_url)) {
    return res.json({ error: 'Invalid short URL' });
  }

  const entry = await Url.findOne({ short_url });
  if (entry) {
    return res.redirect(entry.original_url);
  } else {
    res.json({ error: 'No short URL found for given input' });
  }
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
