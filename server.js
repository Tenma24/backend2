require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API 
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const NEWS_API_KEY = process.env.NEWS_API_KEY;


app.get('/api/weather', async (req, res) => {
  try {
    const city = req.query.city || 'Astana';
    
    console.log(`  Fetching weather for: ${city}`);
    
    // OpenWeather API
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_API_KEY}&units=metric`;
    
    const weatherResponse = await axios.get(weatherUrl);
    const data = weatherResponse.data;
    
    const weatherData = {
      success: true,
      city: data.name,
      temperature: data.main.temp,
      feelsLike: data.main.feels_like,
      description: data.weather[0].description,
      icon: data.weather[0].icon,
      coordinates: {
        lat: data.coord.lat,
        lon: data.coord.lon
      },
      windSpeed: data.wind.speed,
      countryCode: data.sys.country,
      humidity: data.main.humidity,
      pressure: data.main.pressure,
      rainVolume: data.rain ? data.rain['3h'] || 0 : 0,
      timestamp: new Date().toISOString()
    };
    
    console.log(' Weather data fetched successfully');
    res.json(weatherData);
    
  } catch (error) {
    console.error(' Weather API Error:', error.message);
    
    if (error.response?.status === 404) {
      res.status(404).json({
        success: false,
        message: 'City not found. Please check the city name.'
      });
    } else if (error.response?.status === 401) {
      res.status(401).json({
        success: false,
        message: 'Invalid API key. Please check your Weather API key.'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch weather data',
        error: error.message
      });
    }
  }
});

app.get('/api/news', async (req, res) => {
  try {
    const city = req.query.city || 'Astana';
    const country = req.query.country || '';
    
    console.log(` Fetching news for: ${city}`);
    
    if (!NEWS_API_KEY || NEWS_API_KEY === 'your_news_api_key_here') {
      console.log('  News API key not configured');
      return res.json({
        success: true,
        totalResults: 0,
        articles: []
      });
    }
    
    let articles = [];
    
    // Method 1: Try top headlines by country
    try {
      const countryCode = getCountryCode(country);
      if (countryCode) {
        const countryUrl = `https://newsapi.org/v2/top-headlines?country=${countryCode}&pageSize=10&apiKey=${NEWS_API_KEY}`;
        console.log(` Trying country news: ${countryCode}`);
        const response = await axios.get(countryUrl, { timeout: 5000 });
        articles = response.data.articles || [];
      }
    } catch (err) {
      console.log('  Country news failed:', err.message);
    }
    
    // Method 2: If no country results, try general tech/business news
    if (articles.length === 0) {
      try {
        const generalUrl = `https://newsapi.org/v2/top-headlines?category=technology&language=en&pageSize=10&apiKey=${NEWS_API_KEY}`;
        console.log(' Trying general tech news');
        const response = await axios.get(generalUrl, { timeout: 5000 });
        articles = response.data.articles || [];
      } catch (err) {
        console.log('  General news failed:', err.message);
      }
    }
    
    const newsData = {
      success: true,
      totalResults: articles.length,
      articles: articles.slice(0, 5).map(article => ({
        title: article.title || 'No title',
        description: article.description || 'No description available',
        url: article.url || '#',
        source: article.source?.name || 'Unknown',
        publishedAt: article.publishedAt || new Date().toISOString(),
        image: article.urlToImage || null
      }))
    };
    
    console.log(` News data fetched: ${newsData.articles.length} articles`);
    res.json(newsData);
    
  } catch (error) {
    console.error(' News API Error:', error.response?.data || error.message);
    
    res.json({
      success: true,
      totalResults: 0,
      articles: []
    });
  }
});

function getCountryCode(country) {
  const countryCodes = {
    'US': 'us', 'USA': 'us', 'United States': 'us',
    'GB': 'gb', 'UK': 'gb', 'United Kingdom': 'gb',
    'KZ': 'us', 'Kazakhstan': 'us', 
    'RU': 'ru', 'Russia': 'ru',
    'CN': 'cn', 'China': 'cn',
    'JP': 'jp', 'Japan': 'jp',
    'IN': 'in', 'India': 'in',
    'FR': 'fr', 'France': 'fr',
    'DE': 'de', 'Germany': 'de',
    'IT': 'it', 'Italy': 'it',
    'CA': 'ca', 'Canada': 'ca',
    'AU': 'au', 'Australia': 'au'
  };
  return countryCodes[country] || 'us';
}


app.get('/api/all', async (req, res) => {
  try {
    const city = req.query.city || 'Astana';
    
    console.log(` Fetching all data for: ${city}`);
    
    let weatherData = null;
    let newsData = null;
    
    try {
      const weatherResponse = await axios.get(
        `http://localhost:${PORT}/api/weather?city=${encodeURIComponent(city)}`,
        { timeout: 10000 }
      );
      weatherData = weatherResponse.data;
    } catch (error) {
      console.error('  Weather fetch failed:', error.message);
      throw new Error('Weather data unavailable');
    }
    
    try {
      const newsResponse = await axios.get(
        `http://localhost:${PORT}/api/news?city=${encodeURIComponent(city)}&country=${weatherData.countryCode || ''}`,
        { timeout: 10000 }
      );
      newsData = newsResponse.data;
    } catch (error) {
      console.error('  News fetch failed, using empty data:', error.message);
      newsData = {
        success: true,
        totalResults: 0,
        articles: []
      };
    }
    
    res.json({
      success: true,
      weather: weatherData,
      news: newsData
    });
    
  } catch (error) {
    console.error(' Combined API Error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch data'
    });
  }
});


app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    status: 'Server is running',
    timestamp: new Date().toISOString(),
    apis: {
      weather: WEATHER_API_KEY ? 'Configured' : 'Missing',
      news: NEWS_API_KEY ? 'Configured' : 'Missing'
    }
  });
});


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`

 Server running on: http://localhost:${PORT}
 API Endpoints:
   GET /api/weather?city=CityName  - Weather data
   GET /api/news?city=CityName     - News articles
   GET /api/all?city=CityName      - Combined data
   GET /api/status                 - Server status

 API Keys Status:
   Weather API: ${WEATHER_API_KEY ? ' Configured' : ' Missing'}
   News API:    ${NEWS_API_KEY ? ' Configured' : ' Missing'}

 Open http://localhost:${PORT} in your browser
  `);
});