require("dotenv").config({ path: "./.env" });
const util = require("util");
const mysql = require("mysql2");
const pool = mysql.createPool({
  connectionLimit: 20,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// DB_HOST=localhost
// DB_USER=root
// DB_PASS=password
// DB_NAME=inviteme

pool.getConnection((err, connection) => {
  try {
    console.log("here db");
    if (err) {
      if (err.code === "PROTOCOL_CONNECTION_LOST") {
        console.error("Database connection was closed.");
      }
      if (err.code === "ER_CON_COUNT_ERROR") {
        console.error("Database has too many connections.");
      }
      if (err.code === "ECONNREFUSED") {
        console.error("Database connection was refused.");
      }
    }
    console.log("here4");
    if (connection) {
      console.log("Database Connected!");
      console.log("here2");
      connection.release();
    }
    console.log("here3");
    return;
  } catch (error) {
    console.log("db err ", error);
  }
});

pool.query = util.promisify(pool.query);

module.exports = pool;
