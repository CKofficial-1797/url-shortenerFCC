const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const dns = require('dns');
const urlParser = require('url');
require('dotenv').config();

const Url = require('./models/url'); // Ensure this file exists and exports the schema

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.use('/public', express.static(`${process.cwd()}/public`));

// MongoDB connection (Removed deprecated options)
mongoose.connect(process.env.MONGO_URI);

// Homepage (Make sure views/index.html exists or replace with text response)
app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/views/index.html'); // OR use res.send('Welcome...')
});

// POST - shorten URL
let counter = 1;

app.post('/api/shorturl', (req, res) => {
  const original_url = req.body.url;
  const hostname = urlParser.parse(original_url).hostname;

  dns.lookup(hostname, async (err) => {
    if (err) return res.json({ error: 'invalid url' });

    try {
      const url = new Url({ original_url, short_url: counter++ });
      await url.save();
      res.json({ original_url: url.original_url, short_url: url.short_url });
    } catch (error) {
      res.status(500).json({ error: 'Database error' });
    }
  });
});

// GET - redirect
app.get('/api/shorturl/:short_url', async (req, res) => {
  const short_url = parseInt(req.params.short_url);

  try {
    const entry = await Url.findOne({ short_url });

    if (entry) return res.redirect(entry.original_url);
    res.json({ error: 'No short URL found for given input' });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
