const { Client, GatewayIntentBits } = require("discord.js");
require("dotenv").config();
const mysql = require("mysql2");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

const dbConnection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB,
});

const sentMessages = new Set();
const pendingConfirmations = new Map();

client.once("ready", () => {
  console.log("Discord Bot ist bereit!");
  checkDatabaseForPendingLinks();
});

async function sendConfirmationMessage(member, uuid) {
  try {
    await member.send(`Bitte bestätige deine Verknüpfung zu deinem Minecraft-Account: ${uuid}. Antworte mit 'y' um die Verknüpfung abzuschließen.`);
    sentMessages.add(member.user.username.toLowerCase());
    pendingConfirmations.set(member.id, uuid);
    console.log(`Bestätigungsanfrage an ${member.user.username} gesendet.`);
  } catch (err) {
    console.error(`Fehler beim Senden der Nachricht an ${member.user.username}:`, err);
  }
}

async function processPendingLinks() {
  const [results] = await dbConnection.promise().query("SELECT uuid, discord_id FROM linked_accounts WHERE confirmed = 0");
  if (results.length === 0) {
    console.log("Keine ausstehenden Verknüpfungen gefunden");
    return;
  }

  for (const row of results) {
    const discordUsername = row.discord_id.toLowerCase();
    if (sentMessages.has(discordUsername)) continue;

    console.log(`Verarbeite Verknüpfung für ${discordUsername}`);
    const guilds = client.guilds.cache;

    for (const guild of guilds.values()) {
      const members = await guild.members.fetch({ query: discordUsername, limit: 1 });
      const member = members.first();
      if (member) {
        await sendConfirmationMessage(member, row.uuid);
      } else {
        console.log(`Benutzer ${discordUsername} nicht im Server gefunden`);
      }
    }
  }
}

function checkDatabaseForPendingLinks() {
  setInterval(processPendingLinks, 15000);
}

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.content.toLowerCase() === "y") {
    const discordUserId = message.author.id;
    const uuid = pendingConfirmations.get(discordUserId);

    if (uuid) {
      console.log(`Überprüfung für Username: ${message.author.username}`);
      const [results] = await dbConnection.promise().query("UPDATE linked_accounts SET confirmed = 1 WHERE discord_id = ?", [message.author.username.toLowerCase()]);

      if (results.affectedRows > 0) {
        message.reply("Dein Minecraft-Account wurde erfolgreich bestätigt!");
        pendingConfirmations.delete(discordUserId);
        sentMessages.delete(message.author.username.toLowerCase());
      } else {
        console.log(`Keine Verknüpfung gefunden für Username: ${message.author.username}`);
        message.reply("Keine Verknüpfung gefunden, bitte versuche es erneut.");
      }
    } else {
      message.reply("Du hast keine Bestätigungsanfrage gesendet oder die Zeit ist abgelaufen.");
    }
  }
});

client.login(process.env.BOT_TOKEN);
