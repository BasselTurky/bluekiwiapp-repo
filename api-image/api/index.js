require("dotenv").config({ path: "./.env" });
const path = require("path");
const express = require("express");
const app = express();
const server = require("http").createServer(app);
const uuid = require("uuid");
const jwt = require("jsonwebtoken");
const argon2 = require("argon2");
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

const x = 5;
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
  res.send(`Hello, this is api server on port ${port} wa7wa7 OMN`);
});

app.post("/api/save-coin", async (req, res) => {
  // get device ID from req, get Device ID from DB
  // Compare the two IDs
  // if false return different user | force logout
  // if true save 1 coin in DB, response success

  try {
    let token = req.body.token;

    let check_result = await check_device_id_from_token(token);
    if (check_result.boolean) {
      let email = check_result.email;

      // get current coins
      let queryCoins = await pool.query(
        `SELECT coins FROM users WHERE email = '${email}'`
      );
      let result = Object.values(JSON.parse(JSON.stringify(queryCoins)));

      let db_coins = result[0].coins;
      // save coin
      let new_coins_amount = db_coins + 2;

      await pool.query(
        `UPDATE users SET coins = '${new_coins_amount}' WHERE email = '${email}'`
      );

      return res.send({ type: "success" });
    } else {
      return res.send({ type: "wrong-device" });
    }
  } catch (error) {
    console.log(error);
    return res.send({ type: "error", message: "ErrorID: E034" });
  }
});

app.post("/api/download-wallpaper", async (req, res) => {
  try {
    let token = req.body.token;
    let consumed_coins = req.body.consumed_coins;
    let wallpaper_id = req.body.wallpaper_id;

    let check_result = await check_device_id_from_token(token);
    if (check_result.boolean) {
      let email = check_result.email;

      const user_data_query = await pool.query(
        `SELECT * FROM users WHERE email = '${email}'`
      );

      const user_data = Object.values(
        JSON.parse(JSON.stringify(user_data_query))
      )[0];

      if (user_data.coins >= consumed_coins) {
        const new_coins_amount = user_data.coins - consumed_coins;

        // consume coins
        await pool.query(`
        UPDATE users SET coins = ${new_coins_amount} WHERE email = '${email}'
        `);
        // update downloads number
        await pool.query(`
      UPDATE wallpapers SET downloads = downloads + 1 WHERE wallpaper_id = ${wallpaper_id}
      `);

        // to do: save log in database for every download (image id, user, date, coins before, coins after)

        return res.send({ type: "success", updated_coins: new_coins_amount });
      } else {
        return res.send({ type: "insufficient", message: "Not enough coins." });
      }
    } else {
      return res.send({ type: "wrong-device" });
    }
  } catch (error) {
    console.log(error);
    return res.send({ type: "error", message: "ErrorID: E045" });
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

app.post("/api/update-apis", async (req, res) => {
  try {
    // to do: get device_id from token
    let token = req.body.token;
    let check_result = await check_device_id_from_token(token);
    let api = req.body.api;
    let required_coins = req.body.required_coins;
    // get api
    // get amount of coins needed

    if (check_result.boolean) {
      let email = check_result.email;

      // get coins
      let total_coins_query = await pool.query(
        `SELECT coins FROM users WHERE email = '${email}'`
      );

      let results = Object.values(
        JSON.parse(JSON.stringify(total_coins_query))
      );

      let total_coins = results[0].coins;

      // if less than required amount return not enough coins
      if (total_coins < required_coins) {
        return res.send({ type: "not_enough", message: "Not enough coins" });
      } else {
        console.log(typeof total_coins, total_coins);
        console.log(typeof required_coins, required_coins);
        let updated_amount_of_coins = total_coins - required_coins;

        await pool.query(
          `UPDATE users SET coins = ${updated_amount_of_coins}, ${api} = true WHERE email ='${email}'`
        );

        // if more take coins and update api
        // return success to start animation
        return res.send({ type: "success" });
      }
    } else {
      return res.send({ type: "wrong-device" });
    }
  } catch (error) {
    console.log(error);
    return res.send({ type: "error", message: "ErroID: E025" });
  }
});

app.post("/api/get-daily-wallpapers", async (req, res) => {
  try {
    let token = req.body.token;
    let check_result = await check_device_id_from_token(token);
    if (check_result.boolean) {
      // get current date

      var date = new Date();
      var now_utc = Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds()
      );
      var date_string = new Date(now_utc).toISOString();
      var today = date_string.substring(0, 10);

      var day = today.substring(8);

      var start_of_the_month = today.substring(0, 8) + "01";
      var end_of_the_month = today.substring(0, 8) + "27";

      var number_of_wallpapers = 20;

      let query_result;

      if (Number(day) > 27) {
        query_result = await pool.query(
          `SELECT * FROM wallpapers WHERE date >= '${start_of_the_month}' AND date <= '${end_of_the_month}' ORDER BY downloads DESC LIMIT ${number_of_wallpapers}`
        );
      } else {
        query_result = await pool.query(
          `SELECT * FROM wallpapers WHERE date(date) = '${today}'`
        );
      }

      // const result = Object.values(JSON.parse(JSON.stringify(query_result)));

      return res.send({ type: "success", result: query_result, date: today });
    } else {
      return res.send({ type: "wrong-device" });
    }
  } catch (error) {
    console.log(error);
    return res.send({ type: "error", message: "ErrorID: E039" });
  }
});

app.post("/api/get-all-wallpapers", async (req, res) => {
  try {
    let token = req.body.token;
    let check_result = await check_device_id_from_token(token);
    if (check_result.boolean) {
      // get current month date

      var date = new Date();
      var now_utc = Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds()
      );
      var date_string = new Date(now_utc).toISOString();
      var this_month = date_string.substring(0, 8) + "01";

      const query_result = await pool.query(
        `SELECT * FROM wallpapers WHERE date(date) < '${this_month}'`
      );

      return res.send({
        type: "success",
        result: query_result,
        date: this_month,
      });
    } else {
      return res.send({ type: "wrong-device" });
    }
  } catch (error) {
    console.log(error);
    return res.send({ type: "error", message: "ErrorID: E052" });
  }
});

app.post("/api/check-winner", async (req, res) => {
  try {
    let token = req.body.token;
    let check_result = await check_device_id_from_token(token);
    if (check_result.boolean) {
      // check if user is a winner

      const email = check_result.email;
      const uid = check_result.uid;

      const isWinnerQuery = await pool.query(
        `SELECT id, name, uid, coins, winner_giveawayId, available FROM users WHERE email = '${email}'`
      );
      const isWinner = Object.values(
        JSON.parse(JSON.stringify(isWinnerQuery))[0]
      );

      try {
        const activeGiveawayQuery = await pool.query(
          `SELECT * FROM giveaways WHERE status = 'active'`
        );
        const activeGiveawayResult = Object.values(
          JSON.parse(JSON.stringify(activeGiveawayQuery))
        );

        if (!activeGiveawayResult.length) {
          // no active giveaway available
          return;
        }

        const activeGiveaway = activeGiveawayResult[0]; // object {id:number, date:DATETIME, total_participants:number, winner-uid:string, reward_type:string, reward_value:string, optained:0, status:'active'}

        // get array of all participants
        const participantsArrayQuery =
          await pool.query(`SELECT participants.*, users.uid
        FROM participants
        JOIN users ON participants.userId = users.id
        JOIN giveaways ON participants.giveawayId = giveaways.id
        WHERE giveaways.id = '${activeGiveaway.id}'
        `);

        const participantsArrayResult = Object.values(
          JSON.parse(JSON.stringify(participantsArrayQuery))
        );
        // [{id, giveawayId, userId, date, uid},{id, giveawayId, userId, date, uid},...]

        const uidArray = participantsArrayResult.map((result) => result.uid);
        const total_participants = uidArray.length;
        const rewardValueUSD = Math.floor(total_participants / 1000) * 10;
      } catch (error) {}

      console.log(isWinner);

      if (!isWinner) {
        //
      }

      return res.send({ type: "success", data: isWinner });
      // if (isWinner) {
      //   return res.send({
      //     type: "success",
      //     isWinner: isWinner, // true
      //   });
      // } else {
      // }
    } else {
      return res.send({ type: "wrong-device" });
    }
  } catch (error) {
    console.log(error);
    return res.send({ type: "error", message: "ErrorID: E060" });
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

async function check_device_id_from_token(token) {
  try {
    let decoded = jwt.verify(token, process.env.JWT_SECRET);
    // , async (err, decoded) => {
    // if (err) {
    //   return { boolean: false };
    // }

    let email = decoded.email;
    let device_id = decoded.device_id;
    let uid = decoded.uid;

    const db_device_id_query = await pool.query(
      `SELECT * FROM users WHERE email ='${email}'`
    );

    const results = Object.values(
      JSON.parse(JSON.stringify(db_device_id_query))
    );

    const db_device_id = results[0].device_id;

    if (device_id === db_device_id) {
      return { boolean: true, email: email, device_id: device_id, uid: uid };
    } else {
      return { boolean: false };
    }

    // });
  } catch (error) {
    console.log(error);

    return { boolean: false };
  }
}

// try {
//   const email = req.body.email;
//   const device_id = req.body.device_id;

//   const device_id_query = await pool.query(
//     `SELECT device_id FROM users WHERE email = '${email}'`
//   );
//   const result = Object.values(JSON.parse(JSON.stringify(device_id_query)));

//   const db_device_id = result[0].device_id;

//   if (device_id !== db_device_id) {
//     console.log("Wrong device");
//     return res.send({ type: "wrong-device" });
//   } else {

//   }
// } catch (error) {
//   console.log(error);
// }
