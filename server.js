const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const dns = require('dns');
const urlParser = require('url');
require('dotenv').config();

const Url = require('./models/url');
const app = express();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.use('/public', express.static(`${process.cwd()}/public`));

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/views/index.html');
});

let counter = 1;

app.post('/api/shorturl', (req, res) => {
  const original_url = req.body.url;

  // Check if URL exists and is a string
  if (!original_url || typeof original_url !== 'string') {
    return res.json({ error: 'invalid url' });
  }

  // Check if URL starts with http:// or https://
  if (!/^https?:\/\/.+/i.test(original_url)) {
    return res.json({ error: 'invalid url' });
  }

  // Parse hostname from URL
  let hostname;
  try {
    hostname = urlParser.parse(original_url).hostname;
  } catch (err) {
    return res.json({ error: 'invalid url' });
  }

  if (!hostname) {
    return res.json({ error: 'invalid url' });
  }

  // DNS lookup to check if hostname exists
  dns.lookup(hostname, async (err) => {
    if (err) return res.json({ error: 'invalid url' });

    // Save to DB with incremental short_url
    try {
      const existing = await Url.findOne({ original_url });
      if (existing) {
        // If already exists, return existing short_url
        return res.json({ original_url: existing.original_url, short_url: existing.short_url });
      }

      const url = new Url({ original_url, short_url: counter++ });
      await url.save();

      res.json({ original_url: url.original_url, short_url: url.short_url });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });
});

app.get('/api/shorturl/:short_url', async (req, res) => {
  const short_url = parseInt(req.params.short_url);

  if (isNaN(short_url)) {
    return res.json({ error: 'Wrong format' });
  }

  const entry = await Url.findOne({ short_url });

  if (entry) return res.redirect(entry.original_url);
  res.json({ error: 'No short URL found for given input' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
