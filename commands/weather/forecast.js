const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('forecast')
        .setDescription('Affiche les prévisions météo sur 5 jours d\'une ville')
        .addStringOption(option =>
            option.setName('ville')
                .setDescription('Nom de la ville')
                .setRequired(true)),
    async execute(interaction) {
        const city = interaction.options.getString('ville');
        
        try {
            await interaction.deferReply();
            
            // Using OpenWeatherMap API (free tier)
            const API_KEY = process.env.OPENWEATHER_API_KEY || 'demo_key';
            const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric&lang=fr`;
            
            const response = await axios.get(url);
            const data = response.data;
            
            // Get weather emoji based on weather condition
            const getWeatherEmoji = (weatherId) => {
                if (weatherId >= 200 && weatherId < 300) return '⛈️'; // Thunderstorm
                if (weatherId >= 300 && weatherId < 400) return '🌧️'; // Drizzle
                if (weatherId >= 500 && weatherId < 600) return '🌧️'; // Rain
                if (weatherId >= 600 && weatherId < 700) return '❄️'; // Snow
                if (weatherId >= 700 && weatherId < 800) return '🌫️'; // Atmosphere
                if (weatherId === 800) return '☀️'; // Clear
                if (weatherId >= 801 && weatherId < 900) return '☁️'; // Clouds
                return '🌤️'; // Default
            };
            
            // Group forecasts by day and get daily summaries
            const dailyForecasts = {};
            data.list.forEach(forecast => {
                const date = new Date(forecast.dt * 1000).toLocaleDateString('fr-FR', { 
                    weekday: 'long', 
                    day: 'numeric', 
                    month: 'short' 
                });
                
                if (!dailyForecasts[date]) {
                    dailyForecasts[date] = {
                        temps: [],
                        weather: forecast.weather[0],
                        humidity: [],
                        wind: []
                    };
                }
                
                dailyForecasts[date].temps.push(forecast.main.temp);
                dailyForecasts[date].humidity.push(forecast.main.humidity);
                dailyForecasts[date].wind.push(forecast.wind.speed);
            });
            
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`📅 Prévisions météo - ${data.city.name}, ${data.city.country}`)
                .setDescription('Prévisions sur 5 jours (données toutes les 3h)')
                .setFooter({ 
                    text: `Données météo • ${new Date().toLocaleString('fr-FR')}`, 
                    iconURL: interaction.client.user.displayAvatarURL() 
                })
                .setTimestamp();
            
            // Add daily forecasts (limit to 5 days)
            const days = Object.keys(dailyForecasts).slice(0, 5);
            days.forEach(date => {
                const dayData = dailyForecasts[date];
                const minTemp = Math.round(Math.min(...dayData.temps));
                const maxTemp = Math.round(Math.max(...dayData.temps));
                const avgHumidity = Math.round(dayData.humidity.reduce((a, b) => a + b, 0) / dayData.humidity.length);
                const avgWind = Math.round((dayData.wind.reduce((a, b) => a + b, 0) / dayData.wind.length) * 3.6);
                
                embed.addFields({
                    name: `${getWeatherEmoji(dayData.weather.id)} ${date}`,
                    value: `**${minTemp}°C** - **${maxTemp}°C**\n💧 ${avgHumidity}% • 💨 ${avgWind} km/h`,
                    inline: true
                });
            });
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Forecast API Error:', error.message);
            
            if (error.response?.status === 404) {
                await interaction.editReply('❌ Ville non trouvée. Vérifiez l\'orthographe du nom de la ville.');
            } else if (error.response?.status === 401) {
                await interaction.editReply('❌ Erreur d\'authentification API. Contactez l\'administrateur.');
            } else {
                await interaction.editReply('❌ Erreur lors de la récupération des prévisions météo. Veuillez réessayer plus tard.');
            }
        }
    },
};
