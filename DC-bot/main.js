const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent 
    ] 
});

const linkedAccounts = {};

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', message => {
    if (message.author.bot) return;

    if (message.content.startsWith('!link')) {
        const args = message.content.split(' ');
        if (args.length === 2) {
            const mcId = args[1];  // Minecraft-ID
            const userId = message.author.id;
            linkedAccounts[userId] = mcId;  // Verknüpfung speichern
            message.channel.send(`Dein Minecraft-Account (${mcId}) wurde erfolgreich verknüpft.`);
        } else {
            message.channel.send('Bitte benutze den Befehl wie folgt: !link <Minecraft-ID>');
        }
    }

    if (message.content === '!checklink') {
        const userId = message.author.id;
        if (linkedAccounts[userId]) {
            message.channel.send(`Dein Account ist mit der Minecraft-ID ${linkedAccounts[userId]} verknüpft.`);
        } else {
            message.channel.send('Dein Account ist nicht verknüpft.');
        }
    }

    if (message.content === '!verify') {
        message.channel.send('Verification process started!');
    }
});

client.login(process.env.BOT_TOKEN);
