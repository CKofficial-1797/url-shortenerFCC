const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const dns = require('dns');
const urlParser = require('url');
require('dotenv').config();

const app = express();

// MongoDB model
const UrlSchema = new mongoose.Schema({
  original_url: { type: String, required: true },
  short_url: { type: Number, required: true, unique: true }
});
const Url = mongoose.model('Url', UrlSchema);

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.use('/public', express.static(`${process.cwd()}/public`));

// Connect to MongoDB
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error("Error: MONGO_URI not defined in environment variables");
  process.exit(1);
}
mongoose.connect(mongoUri);

// Serve homepage
app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Helper to get next short_url number
async function getNextShortUrl() {
  const lastEntry = await Url.findOne({}).sort({ short_url: -1 });
  return lastEntry ? lastEntry.short_url + 1 : 1;
}

// POST endpoint to create short URL
app.post('/api/shorturl', async (req, res) => {
  let original_url = req.body.url;

  // Basic URL format check: must start with http:// or https://
  if (!original_url || !original_url.match(/^https?:\/\/.+/i)) {
    return res.json({ error: 'invalid url' });
  }

  // Parse hostname for DNS lookup
  const hostname = urlParser.parse(original_url).hostname;

  dns.lookup(hostname, async (err) => {
    if (err) {
      return res.json({ error: 'invalid url' });
    } else {
      try {
        // Check if URL already exists in DB to avoid duplicates
        let existing = await Url.findOne({ original_url });
        if (existing) {
          return res.json({ original_url: existing.original_url, short_url: existing.short_url });
        }

        // Get next short_url number
        const shortUrlNum = await getNextShortUrl();

        // Save new URL document
        const newUrl = new Url({ original_url, short_url: shortUrlNum });
        await newUrl.save();

        res.json({ original_url: newUrl.original_url, short_url: newUrl.short_url });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
      }
    }
  });
});

// GET endpoint to redirect short_url to original URL
app.get('/api/shorturl/:short_url', async (req, res) => {
  const short_url = parseInt(req.params.short_url);

  if (isNaN(short_url)) {
    return res.json({ error: 'Wrong format' });
  }

  try {
    const entry = await Url.findOne({ short_url });
    if (entry) {
      return res.redirect(entry.original_url);
    } else {
      return res.json({ error: 'No short URL found for given input' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
