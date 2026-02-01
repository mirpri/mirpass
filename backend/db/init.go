package db

import (
	"database/sql"
	"fmt"
	"log"
	"mirpass-backend/config"

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
	}
}

func InitDB() error {
	inicfg := cfg
	inicfg.DBName = ""
	db, err := sql.Open("mysql", inicfg.FormatDSN())

	// Create the database if it doesn't exist
	_, err = db.Exec(fmt.Sprintf("CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", cfg.DBName))
	if err != nil {
		log.Fatal("Error creating database: ", err)
		return err
	}

	// Select the database
	_, err = db.Exec("USE " + cfg.DBName)
	if err != nil {
		log.Fatal("Error selecting database: ", err)
		return err
	}

	// Create users table
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS users (
	       id INT AUTO_INCREMENT PRIMARY KEY,
	       username VARCHAR(255) NOT NULL UNIQUE,
	       email VARCHAR(255) NOT NULL UNIQUE,
	       password_hash VARCHAR(255) NOT NULL,
	       is_verified BOOLEAN DEFAULT FALSE,
	       last_login TIMESTAMP NULL,
	       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       )`)
	if err != nil {
		log.Fatal("Error creating users table: ", err)
		return err
	}

	// Create verifications table
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS verifications (
	       id INT AUTO_INCREMENT PRIMARY KEY,
	       user_id INT NOT NULL,
	       token VARCHAR(255) NOT NULL,
	       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	       FOREIGN KEY (user_id) REFERENCES users(id)
       )`)
	if err != nil {
		log.Fatal("Error creating verifications table: ", err)
		return err
	}

	// Create admins table
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS admins (
	       id INT AUTO_INCREMENT PRIMARY KEY,
	       username VARCHAR(255) NOT NULL UNIQUE,
	       role VARCHAR(100) NOT NULL,
	       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       )`)
	if err != nil {
		log.Fatal("Error creating admins table: ", err)
		return err
	}

	return nil
}

func ConnectDB() {
	loadConfig()

	db, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		log.Fatal("Error opening database: ", err)
	}

	err = db.Ping()
	if err != nil {
		err = InitDB()
		if err != nil {
			log.Fatal("Error initializing database: ", err)
		}
	}

	log.Println("Successfully connected to the database")
	database = db
}
