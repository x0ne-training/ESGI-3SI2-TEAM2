const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weather')
        .setDescription('Affiche la météo actuelle d\'une ville')
        .addStringOption(option =>
            option.setName('ville')
                .setDescription('Nom de la ville')
                .setRequired(true)),
    emoji: '🌤️',
    async execute(interaction) {
        const city = interaction.options.getString('ville');
        
        try {
            await interaction.deferReply();
            
            // Using OpenWeatherMap API (free tier)
            const API_KEY = process.env.OPENWEATHER_API_KEY;
            if (!API_KEY) {
                console.error('OPENWEATHER_API_KEY environment variable is not set.');
                await interaction.editReply('❌ La clé API OpenWeatherMap est manquante. Contactez l\'administrateur.');
                return;
            }
            const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric&lang=fr`;
            
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
            
            const embed = new EmbedBuilder()
                .setColor(0x00AE86)
                .setTitle(`🌤️ Météo à ${data.name}, ${data.sys.country}`)
                .setDescription(`${getWeatherEmoji(data.weather[0].id)} ${data.weather[0].description.charAt(0).toUpperCase() + data.weather[0].description.slice(1)}`)
                .addFields(
                    { name: '🌡️ Température', value: `${Math.round(data.main.temp)}°C`, inline: true },
                    { name: '🌡️ Ressenti', value: `${Math.round(data.main.feels_like)}°C`, inline: true },
                    { name: '💧 Humidité', value: `${data.main.humidity}%`, inline: true },
                    { name: '💨 Vent', value: `${Math.round(data.wind.speed * 3.6)} km/h`, inline: true },
                    { name: '👁️ Visibilité', value: `${data.visibility / 1000} km`, inline: true },
                    { name: '🔽 Pression', value: `${data.main.pressure} hPa`, inline: true }
                )
                .setFooter({ 
                    text: `Données météo • ${new Date().toLocaleString('fr-FR')}`, 
                    iconURL: interaction.client.user.displayAvatarURL() 
                })
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Weather API Error:', error.message);
            
            if (error.response?.status === 404) {
                await interaction.editReply('❌ Ville non trouvée. Vérifiez l\'orthographe du nom de la ville.');
            } else if (error.response?.status === 401) {
                await interaction.editReply('❌ Erreur d\'authentification API. Contactez l\'administrateur.');
            } else {
                await interaction.editReply('❌ Erreur lors de la récupération des données météo. Veuillez réessayer plus tard.');
            }
        }
    },
};
