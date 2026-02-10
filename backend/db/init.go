package db

import (
	"database/sql"
	"fmt"
	"log"
	"mirpass-backend/config"
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

	// Create App api_keys table
	if _, err = adminConn.Exec(`CREATE TABLE IF NOT EXISTS api_keys (
	       id INT AUTO_INCREMENT PRIMARY KEY,
	       app_id VARCHAR(127) NOT NULL,
	       key_hash VARCHAR(255) NOT NULL UNIQUE,
           name VARCHAR(255) DEFAULT NULL,
	       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	       FOREIGN KEY (app_id) REFERENCES applications(id) ON DELETE CASCADE
	   )`); err != nil {
		return fmt.Errorf("create api_keys table: %w", err)
	}

	// Create App login sessions table
	if _, err = adminConn.Exec(`CREATE TABLE IF NOT EXISTS login_sessions (
	       id INT AUTO_INCREMENT PRIMARY KEY,
	       username VARCHAR(255) DEFAULT NULL,
	       app_id VARCHAR(127) NOT NULL,
	       session_id VARCHAR(255) NOT NULL UNIQUE,
	       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		   login_at TIMESTAMP NULL,
	       expires_at TIMESTAMP NOT NULL,
		   auth_code VARCHAR(255) DEFAULT NULL,
		   state VARCHAR(50) DEFAULT 'pending',
		   poll_secret VARCHAR(255) DEFAULT NULL,
	       FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE,
	       FOREIGN KEY (app_id) REFERENCES applications(id) ON DELETE CASCADE
	   )`); err != nil {
		return fmt.Errorf("create login_sessions table: %w", err)
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
