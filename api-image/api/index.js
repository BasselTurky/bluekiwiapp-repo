require("dotenv").config({ path: "./.env" });
const path = require("path");
const express = require("express");
const app = express();
const server = require("http").createServer(app);
const uuid = require("uuid");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const rateLimit = require("express-rate-limit");

const port = process.env.SERVER_PORT;

const server_email = process.env.SERVER_EMAIL;

const pool = require("./database");
const { createEmailHtmlForUser } = require("./functions/createHtml");
const {
  createTransactionEmail,
} = require("./functions/createTransactionEmail");
const { createCollectionTable } = require("./functions/createCollectionTable");

/* Middleware*/
app.use(bodyParser.json());

app.use(bodyParser.urlencoded({ extended: true }));

// Cors for cross origin allowance
const cors = require("cors");
app.use(
  cors({
    origin: "*",
  })
);

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min window
  max: 15, // start blocking after 6 requests
  message: "Too many login attempts from this IP, please try again after 10min",
});

const createAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 7, // start blocking after 7 requests
  message:
    "Too many accounts created from this IP, please try again after an hour",
});

const transporter = nodemailer.createTransport({
  // service: "Hotmail",
  name: "smtp-mail.outlook.com",
  host: "smtp-mail.outlook.com",
  // port: 587,
  auth: {
    user: process.env.SERVER_EMAIL,
    pass: process.env.TRANSPORTER_EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

app.listen(port, () => console.log(`Server running on port ${port}`));

// app.use("/images", express.static(__dirname + "/my-uploads"));

// app.use(express.json({ limit: "4mb" }));

app.get("/api", (req, res) => {
  res.send(`Hello, this is api server on port ${port}`);
});

app.post("/api/save-coin", async (req, res) => {
  try {
    // get device ID from req, get Device ID from DB
    // Compare the two IDs
    // if false return different user | force logout
    // if true save 1 coin in DB, response success
    //
    const email = req.body.email;
    const device_id = req.body.device_id;

    const device_id_query = await pool.query(
      `SELECT device_id FROM users WHERE email = '${email}'`
    );
    const result = Object.values(JSON.parse(JSON.stringify(device_id_query)));

    const db_device_id = result[0].device_id;

    if (device_id !== db_device_id) {
      console.log("Wrong device");
      return res.send({ type: "wrong-device" });
    } else {
      // get current coins
      let queryCoins = await pool.query(
        `SELECT coins FROM users WHERE email = '${email}'`
      );
      let result = Object.values(JSON.parse(JSON.stringify(queryCoins)));

      let db_coins = result[0].coins;
      // save coin
      let new_coins_amount = db_coins + 1;

      await pool.query(
        `UPDATE users SET coins = '${new_coins_amount}' WHERE email = '${email}'`
      );

      return res.send({ type: "success" });
    }
  } catch (error) {
    console.log(error);
    return res.send({ type: "error", message: "Something went wrong!" });
  }
});

app.post("/api/process-collect", async (req, res) => {
  try {
    let email = req.body.email;
    let current_device_id = req.body.current_device_id;
    let paypal = req.body.paypal;
    let coins_state = req.body.coins;
    let next_transaction_date = req.body.time + 120000; //172800000; // plus 48 hours

    console.log(email, current_device_id);
    let queryCoins = await pool.query(
      `SELECT coins FROM users WHERE email = '${email}'`
    );

    let result = Object.values(JSON.parse(JSON.stringify(queryCoins)));

    let db_coins = result[0].coins;

    if (!(await check_device_id(email, current_device_id))) {
      return res.send({ type: "wrong-device" });
    } else if (db_coins !== coins_state) {
      const result = await pool.query(
        `SELECT * FROM users WHERE email = '${email}'`
      );

      return res.send({
        type: "coins-error",
        message: "Wrong data",
        userInfo: result[0],
      });
      // update user Coins
    } else {
      // send email to me: include user Email, DeviceID, PayPal, Coins
      const myMailOptions = {
        from: process.env.SERVER_EMAIL,
        to: "basselturky101@gmail.com",
        subject: "Transaction Info",
        html: createCollectionTable(email, current_device_id, paypal, db_coins),
        // createTransactionEmail(
        //   email,
        //   current_device_id,
        //   paypal,
        //   db_coins
        // ),
      };

      transporter.sendMail(myMailOptions, function (error, info) {
        if (error) {
          console.log(error);
          return res.send({
            type: "error",
            message: "Couldnt complete the process",
          });
        }
      });

      // reset coins in db, add next_transaction_date
      await pool.query(
        `UPDATE users SET coins = 0, next_transaction_date = '${next_transaction_date}' WHERE email = '${email}'`
      );

      // update userData, coins
      const result = await pool.query(
        `SELECT * FROM users WHERE email = '${email}'`
      );

      // Inform the user

      setTimeout(() => {
        const userMailOptions = {
          from: process.env.SERVER_EMAIL,
          to: email,
          subject: "Transaction Info",
          html: createEmailHtmlForUser(db_coins, paypal),
        };

        transporter.sendMail(userMailOptions, function (error, info) {
          if (error) {
            console.log(error);
            return res.send({
              type: "error",
              message: "Couldnt complete the process",
            });
          }
        });
      }, 2000);

      return res.send({
        type: "success",
        message: "Process complete",
        userInfo: result[0],
      });
    }
  } catch (error) {
    console.log(error);
    return res.send({ type: "error", message: "Something went wrong!" });
  }
});

async function check_device_id(email, device_id) {
  // get current device id

  let fetch_current_device_id = await pool.query(
    `SELECT device_id FROM users WHERE email = '${email}'`
  );

  let result = Object.values(
    JSON.parse(JSON.stringify(fetch_current_device_id))
  );

  let current_device_id = result[0].device_id;

  if (current_device_id === device_id) {
    // same user
    return true;
  } else {
    // someone else
    return false;
  }
}
