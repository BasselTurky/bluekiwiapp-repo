require("dotenv").config({ path: "./.env" });
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  connectionLimit: 20,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  connectTimeout: 10000,
});

// Example function to test connection and query
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("Database Connected!");
    connection.release();
  } catch (err) {
    if (err.code === "PROTOCOL_CONNECTION_LOST") {
      console.error("Database connection was closed.");
    } else if (err.code === "ER_CON_COUNT_ERROR") {
      console.error("Database has too many connections.");
    } else if (err.code === "ECONNREFUSED") {
      console.error("Database connection was refused.");
    } else {
      console.error("Database connection error:", err.message);
    }
  }
}

// Call the test function
testConnection();

module.exports = pool;
