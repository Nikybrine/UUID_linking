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
  host: "localhost",
  user: "Nick",
  password: "123",
  database: "test",
});

const sentMessages = new Set();
const pendingConfirmations = new Map(); // Map für die laufenden Bestätigungen

client.once("ready", () => {
  console.log("Discord Bot ist bereit!");
  checkDatabaseForPendingLinks();
});

function checkDatabaseForPendingLinks() {
  setInterval(() => {
    dbConnection.query(
      "SELECT uuid, discord_id FROM linked_accounts WHERE confirmed = 0",
      (error, results) => {
        if (error) {
          console.error("Fehler bei der Datenbankabfrage:", error);
          return;
        }

        if (results.length === 0) {
          console.log("Keine ausstehenden Verknüpfungen gefunden");
          return;
        }

        results.forEach((row) => {
          const discordUsername = row.discord_id;

          if (sentMessages.has(discordUsername)) return;

          console.log(`Verarbeite Verknüpfung für ${discordUsername}`);

          client.guilds.cache.forEach((guild) => {
            guild.members
              .fetch({ query: discordUsername, limit: 1 })
              .then((members) => {
                const member = members.first();
                if (member) {
                  member
                    .send(
                      `Bitte bestätige deine Verknüpfung zu deinem Minecraft-Account: ${row.uuid}. Antworte mit 'y' um die Verknüpfung abzuschließen.`
                    )
                    .then(() => {
                      console.log(`Bestätigungsanfrage an ${discordUsername} gesendet.`);
                      sentMessages.add(discordUsername);
                      pendingConfirmations.set(member.id, row.uuid); // UUID speichern
                    })
                    .catch((err) => {
                      console.error(`Fehler beim Senden der Nachricht an ${discordUsername}:`, err);
                    });
                } else {
                  console.log(`Benutzer ${discordUsername} nicht im Server gefunden`);
                }
              })
              .catch((err) => {
                console.error("Fehler beim Fetchen der Mitglieder:", err);
              });
          });
        });
      }
    );
  }, 15000);
}

client.on("messageCreate", (message) => {
  if (message.author.bot) return;
  if (message.content.toLowerCase() === "y") {
    const discordUserId = message.author.id; // Die ID des Nutzers
    const uuid = pendingConfirmations.get(discordUserId); // UUID abrufen

    if (uuid) {
      console.log(`Überprüfung für Username: ${message.author.username}`);

      dbConnection.query(
        "UPDATE linked_accounts SET confirmed = 1 WHERE discord_id = ?",
        [message.author.username.toLowerCase()],
        (error, results) => {
          if (error) {
            console.error("Fehler bei der Aktualisierung:", error);
            message.reply("Ein Fehler ist aufgetreten. Bitte versuche es später erneut.");
            return;
          }
          if (results.affectedRows > 0) {
            message.reply("Dein Minecraft-Account wurde erfolgreich bestätigt!");
            pendingConfirmations.delete(discordUserId); // UUID entfernen
            sentMessages.delete(message.author.username.toLowerCase());
          } else {
            console.log(`Keine Verknüpfung gefunden für Username: ${message.author.username}`);
            message.reply("Keine Verknüpfung gefunden, bitte versuche es erneut.");
          }
        }
      );
    } else {
      message.reply("Du hast keine Bestätigungsanfrage gesendet oder die Zeit ist abgelaufen.");
    }
  }
});


client.login(process.env.BOT_TOKEN);
