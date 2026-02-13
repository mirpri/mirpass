package db

import (
	"database/sql"
	"fmt"
	"log"
	"mirpass-backend/config"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
)

var cfg mysql.Config

var database *sql.DB

func loadConfig() {
	cfg = mysql.Config{
		User:                 config.AppConfig.DBUser,
		Passwd:               config.AppConfig.DBPassword,
		Net:                  "tcp",
		Addr:                 config.AppConfig.DBAddr,
		DBName:               config.AppConfig.DBName,
		AllowNativePasswords: true,
		ParseTime:            true,
		Loc:                  time.UTC,
		Params: map[string]string{
			"time_zone": "'+00:00'",
		},
	}
}

func InitDB() error {
	inicfg := cfg
	inicfg.DBName = ""
	adminConn, err := sql.Open("mysql", inicfg.FormatDSN())
	if err != nil {
		return fmt.Errorf("open admin connection: %w", err)
	}
	defer adminConn.Close()

	// Create the database if it doesn't exist
	if _, err = adminConn.Exec(fmt.Sprintf("CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", cfg.DBName)); err != nil {
		return fmt.Errorf("create database: %w", err)
	}

	// Use the new database
	if _, err = adminConn.Exec("USE `" + cfg.DBName + "`"); err != nil {
		return fmt.Errorf("select database: %w", err)
	}

	// Create users table
	if _, err = adminConn.Exec(`CREATE TABLE IF NOT EXISTS users (
	       username VARCHAR(255) PRIMARY KEY,
	       email VARCHAR(255) NOT NULL UNIQUE,
	       password_hash VARCHAR(255) NOT NULL,
	       nickname VARCHAR(255) DEFAULT NULL,
	       avatar_url VARCHAR(511) DEFAULT NULL,
	       is_verified BOOLEAN DEFAULT FALSE,
	       last_login TIMESTAMP NULL,
	       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	   )`); err != nil {
		return fmt.Errorf("create users table: %w", err)
	}

	// Create verifications table
	if _, err = adminConn.Exec(`CREATE TABLE IF NOT EXISTS verifications (
	       id INT AUTO_INCREMENT PRIMARY KEY,
	       username VARCHAR(255) NOT NULL,
	       token VARCHAR(255) NOT NULL,
		   task VARCHAR(50) NOT NULL DEFAULT 'register',
		   detail TEXT DEFAULT NULL,
	       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		   expires_at TIMESTAMP NOT NULL,
	       FOREIGN KEY (username) REFERENCES users(username)
	   )`); err != nil {
		return fmt.Errorf("create verifications table: %w", err)
	}

	// Create admins table
	if _, err = adminConn.Exec(`CREATE TABLE IF NOT EXISTS admins (
	       id INT AUTO_INCREMENT PRIMARY KEY,
	       username VARCHAR(255) NOT NULL,
		   app VARCHAR(255) NOT NULL DEFAULT 'system',
	       role ENUM('admin', 'root') NOT NULL,
	       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
           UNIQUE KEY user_app (username, app),
           FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
	   )`); err != nil {
		return fmt.Errorf("create admins table: %w", err)
	}

	// Create Application table
	if _, err = adminConn.Exec(`CREATE TABLE IF NOT EXISTS applications (
	       id VARCHAR(127) PRIMARY KEY,
	       name VARCHAR(255) NOT NULL UNIQUE,
	       description TEXT DEFAULT NULL,
		   logo_url VARCHAR(511) DEFAULT NULL,
		   suspend_until TIMESTAMP NULL,
	       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	   )`); err != nil {
		return fmt.Errorf("create applications table: %w", err)
	}

	// Create trusted_uris table
	if _, err = adminConn.Exec(`CREATE TABLE IF NOT EXISTS trusted_uris (
	       id INT AUTO_INCREMENT PRIMARY KEY,
	       app_id VARCHAR(127) NOT NULL,
	       name VARCHAR(255) DEFAULT NULL,
	       uri VARCHAR(512) NOT NULL,
	       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	       FOREIGN KEY (app_id) REFERENCES applications(id) ON DELETE CASCADE
	   )`); err != nil {
		return fmt.Errorf("create trusted_uris table: %w", err)
	}

	// Backward compatibility for old schemas without name column
	if _, err = adminConn.Exec("ALTER TABLE trusted_uris ADD COLUMN name VARCHAR(255) DEFAULT NULL"); err != nil {
		if !strings.Contains(strings.ToLower(err.Error()), "duplicate column") {
			return fmt.Errorf("alter trusted_uris add name: %w", err)
		}
	}

	// Create OAuth2 sessions table
	if _, err = adminConn.Exec(`CREATE TABLE IF NOT EXISTS oauth_sessions (
			session_id        VARCHAR(128) PRIMARY KEY,
			client_id         VARCHAR(64)  NOT NULL,
			username           VARCHAR(64),
			flow_type         ENUM('authorization_code', 'device_code') NOT NULL,

			-- Device Code Flow
			device_code       VARCHAR(128),
			user_code         VARCHAR(32),
			last_poll          DATETIME DEFAULT CURRENT_TIMESTAMP,

			-- PKCE / Auth Code
			code_challenge    VARCHAR(256),
			code_challenge_method ENUM('S256', 'plain'),
			redirect_uri      VARCHAR(512),
			auth_code         VARCHAR(128),
			state			 VARCHAR(50),

			status            ENUM(
								'pending',
								'authorized',
								'consumed',
								'denied',
								'expired'
								) NOT NULL,
			expires_at        DATETIME DEFAULT ADDDATE(CURRENT_TIMESTAMP, INTERVAL 15 MINUTE),
			created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		);`); err != nil {
		return fmt.Errorf("create oauth_sessions table: %w", err)
	}

	// Create login history table
	_, err = adminConn.Exec(`CREATE TABLE IF NOT EXISTS history (
		id INT AUTO_INCREMENT PRIMARY KEY,
		username VARCHAR(255) NOT NULL,
		app_id VARCHAR(127) NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE,
		FOREIGN KEY (app_id) REFERENCES applications(id) ON DELETE CASCADE
	)`)
	if err != nil {
		return fmt.Errorf("create history table: %w", err)
	}

	// Create blobs table
	_, err = adminConn.Exec(`CREATE TABLE IF NOT EXISTS blobs (
		id VARCHAR(64) PRIMARY KEY,
		data MEDIUMBLOB NOT NULL,
		content_type VARCHAR(50) NOT NULL,
		size INT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	)`)
	if err != nil {
		return fmt.Errorf("create blobs table: %w", err)
	}

	return nil
}

func ConnectDB() {
	loadConfig()

	// Ensure DB and tables exist
	if err := InitDB(); err != nil {
		log.Fatal("DB init failed: ", err)
	}

	// Connect to target database
	db, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		log.Fatal("Error opening database: ", err)
	}

	if err = db.Ping(); err != nil {
		log.Fatal("Error pinging database: ", err)
	}

	if err = runMigration(db); err != nil {
		log.Fatal("Error running migrations: ", err)
	}

	log.Println("Successfully connected to the database")
	database = db
}
