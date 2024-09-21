package com.RockySMP.UUID.uUIDSync;

import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.UUID;

public class UUIDSync extends JavaPlugin {

    private Connection connection;

    @Override
    public void onEnable() {
        getLogger().info("Plugin wird aktiviert...");
        try {
            connectToDatabase();
            if (connection != null && !connection.isClosed()) {
                getLogger().info("Datenbankverbindung erfolgreich hergestellt.");
            } else {
                getLogger().severe("Verbindung zur Datenbank fehlgeschlagen!");
            }
        } catch (SQLException e) {
            getLogger().severe("Fehler bei der Datenbankverbindung: " + e.getMessage());
            e.printStackTrace();
            getServer().getPluginManager().disablePlugin(this);
        }
    }


    @Override
    public void onDisable() {
        getLogger().info("MC-Discord-Sync Plugin deaktiviert!");

        // Schließe die Datenbankverbindung
        try {
            if (connection != null && !connection.isClosed()) {
                connection.close();
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
    }

    private void connectToDatabase() throws SQLException {
        String host = getConfig().getString("database.host");
        int port = getConfig().getInt("database.port");
        String database = getConfig().getString("database.database");
        String username = getConfig().getString("database.username");
        String password = getConfig().getString("database.password");

        if (host == null || database == null || username == null || password == null) {
            getLogger().severe("Fehlende Datenbank-Konfigurationswerte in config.yml!");
            return;
        }

        String url = "jdbc:mysql://" + host + ":" + port + "/" + database + "?useSSL=false";
        getLogger().info("Verbindung zur Datenbank wird aufgebaut: " + url);

        try {
            connection = DriverManager.getConnection(url, username, password);
            getLogger().info("Datenbankverbindung erfolgreich hergestellt.");
        } catch (SQLException e) {
            getLogger().severe("Fehler beim Herstellen der Datenbankverbindung: " + e.getMessage());
            throw e;
        }
    }

    private void createTableIfNotExists() throws SQLException {
        String createTableSQL = "CREATE TABLE IF NOT EXISTS linked_accounts ("
                + "uuid VARCHAR(36) NOT NULL, "
                + "discord_id VARCHAR(50) NOT NULL, "
                + "verified BOOLEAN DEFAULT FALSE, "
                + "PRIMARY KEY (uuid));";
        try (PreparedStatement statement = connection.prepareStatement(createTableSQL)) {
            statement.executeUpdate();
        }
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (command.getName().equalsIgnoreCase("linkdiscord")) {
            return handleLinkDiscordCommand(sender, args);
        } else if (command.getName().equalsIgnoreCase("checklink")) {
            return handleCheckLinkCommand(sender);
        } else if (command.getName().equalsIgnoreCase("dbstatus")) {
            return handleDbStatusCommand(sender);
        }
        return false;
    }

    private boolean handleLinkDiscordCommand(CommandSender sender, String[] args) {
        if (sender instanceof Player) {
            Player player = (Player) sender;
            UUID playerUUID = player.getUniqueId();

            if (args.length == 1) {
                String discordId = args[0];

                try {
                    saveLinkToDatabase(playerUUID, discordId);
                    player.sendMessage("Dein Minecraft-Account wurde erfolgreich mit der Discord-ID " + discordId + " verknüpft.");
                } catch (SQLException e) {
                    e.printStackTrace();
                    player.sendMessage("Fehler beim Verknüpfen deines Accounts. Bitte versuche es später erneut.");
                }

                return true;
            } else {
                player.sendMessage("Bitte verwende: /linkdiscord <Discord ID>");
                return false;
            }
        } else {
            sender.sendMessage("Dieser Befehl kann nur von einem Spieler ausgeführt werden.");
        }
        return false;
    }

    private boolean handleCheckLinkCommand(CommandSender sender) {
        if (sender instanceof Player) {
            Player player = (Player) sender;
            UUID playerUUID = player.getUniqueId();

            try {
                String discordId = getDiscordIdFromDatabase(playerUUID);
                if (discordId != null) {
                    player.sendMessage("Dein Account ist mit der Discord-ID " + discordId + " verknüpft.");
                } else {
                    player.sendMessage("Dein Account ist nicht mit einem Discord-Account verknüpft.");
                }
            } catch (SQLException e) {
                e.printStackTrace();
                player.sendMessage("Fehler beim Überprüfen der Verknüpfung. Bitte versuche es später erneut.");
            }
            return true;
        }
        return false;
    }

    private boolean handleDbStatusCommand(CommandSender sender) {
        sender.sendMessage("dbStatus überürüfung..");
        if (connection != null) {
            try {
                if (!connection.isClosed()) {
                    sender.sendMessage("Datenbankverbindung: Aktiv");
                } else {
                    sender.sendMessage("Datenbankverbindung: Geschlossen");
                }
            } catch (SQLException e) {
                sender.sendMessage("Datenbankverbindung: Fehler beim Überprüfen");
                e.printStackTrace();
            }
        } else {
            sender.sendMessage("Datenbankverbindung: Nicht hergestellt");
        }
        return true;
    }

    private void saveLinkToDatabase(UUID uuid, String discordId) throws SQLException {
        String insertSQL = "REPLACE INTO linked_accounts (uuid, discord_id) VALUES (?, ?)";
        try (PreparedStatement statement = connection.prepareStatement(insertSQL)) {
            statement.setString(1, uuid.toString());
            statement.setString(2, discordId);
            statement.executeUpdate();
        }
    }

    private String getDiscordIdFromDatabase(UUID uuid) throws SQLException {
        if (connection == null || connection.isClosed()) {
            getLogger().severe("Keine Verbindung zur Datenbank verfügbar!");
            return null;
        }

        String selectSQL = "SELECT discord_id FROM linked_accounts WHERE uuid = ?";
        try (PreparedStatement statement = connection.prepareStatement(selectSQL)) {
            statement.setString(1, uuid.toString());
            try (ResultSet resultSet = statement.executeQuery()) {
                if (resultSet.next()) {
                    return resultSet.getString("discord_id");
                } else {
                    return null;
                }
            }
        }
    }
}
