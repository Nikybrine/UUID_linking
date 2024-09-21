const { Client, GatewayIntentBits } = require('discord.js');
const { configDotenv } = require('dotenv');
const mysql = require('mysql2');


const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages] 
});

// MySQL connection setup
const dbConnection = mysql.createConnection({
    host: 'localhost',
    user: 'Nick',
    password: '123',
    database: 'test'
});


client.once('ready', () => {
    console.log('Discord Bot ist bereit!');
    checkDatabaseForPendingLinks();
});


function checkDatabaseForPendingLinks() {
    setInterval(() => {

        dbConnection.query("SELECT uuid, discord_id FROM linked_accounts WHERE confirmed = 0", (error, results) => {
            if (error) throw error;

            results.forEach(row => {
                const discordId = row.discord_id;
                const playerUUID = row.uuid;
                client.users.fetch(discordId)
                    .then(user => {
                        user.send(`Bitte bestätige deine Verknüpfung zu deinem Minecraft-Account: ${playerUUID}. Antworte mit "bestätigen" um die Verknüpfung abzuschließen.`)
                            .then(() => {
                                console.log(`Bestätigungsanfrage an Discord-ID ${discordId} gesendet.`);
                            })
                            .catch(err => {
                                console.error(`Fehler beim Senden der Nachricht an ${discordId}:`, err);
                            });
                    })
                    .catch(err => {
                        console.error(`Discord-ID ${discordId} nicht gefunden:`, err);
                    });
            });
        });
    }, 30000);
}

client.on('messageCreate', message => {
    if (message.channel.type === 'DM') {
        const discordId = message.author.id;

        if (message.content.toLowerCase() === 'bestätigen') {
            dbConnection.query("UPDATE linked_accounts SET confirmed = 1 WHERE discord_id = ?", [discordId], (error, results) => {
                if (error) throw error;

                if (results.affectedRows > 0) {
                    message.reply('Dein Minecraft-Account wurde erfolgreich bestätigt!');
                } else {
                    message.reply('Keine Verknüpfung gefunden, bitte versuche es erneut.');
                }
            });
        }
    }
});


client.login("MTI4NjY5NTg2MTMyOTQ2NTM5NQ.GudBU1.W174FcjMnzyAZcOA0AHb_LKVm_MsjC3VuEiQho");
