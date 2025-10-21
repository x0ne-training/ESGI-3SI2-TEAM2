# 🌤️ Weather Commands

This module provides weather functionality for the Discord bot.

## Commands

### `/weather <ville>`
Displays current weather conditions for a specified city.

**Features:**
- Current temperature and "feels like" temperature
- Weather description with emoji
- Humidity percentage
- Wind speed in km/h
- Visibility in kilometers
- Atmospheric pressure

### `/forecast <ville>`
Displays 5-day weather forecast for a specified city.

**Features:**
- Daily temperature ranges (min/max)
- Weather conditions with emojis
- Average humidity and wind speed per day
- Data updated every 3 hours

## Setup

1. **Get OpenWeatherMap API Key:**
   - Go to [OpenWeatherMap](https://openweathermap.org/api)
   - Sign up for a free account
   - Generate an API key

2. **Configure Environment:**
   - Add your API key to your `.env` file:
   ```
   OPENWEATHER_API_KEY=your_api_key_here
   ```

3. **Deploy Commands:**
   - Run `npm run deploy` to register the new slash commands

## API Usage

The commands use the OpenWeatherMap API:
- **Current Weather:** `/data/2.5/weather`
- **5-Day Forecast:** `/data/2.5/forecast`

Both endpoints use metric units and French language for responses.

## Error Handling

The commands handle common errors:
- **404:** City not found
- **401:** Invalid API key
- **Network errors:** Connection issues

## Dependencies

- `axios`: HTTP client for API requests
- `discord.js`: Discord bot framework
