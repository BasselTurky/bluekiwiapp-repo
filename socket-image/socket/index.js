const http = require("http");
const express = require("express");
const app = express();
// const server = require("http").createServer(app);
const socketIo = require("socket.io");

const jwt = require("jsonwebtoken");
const pool = require("./database");
const cors = require("cors");
app.use(
  cors({
    origin: "*",
  })
);

const server = http.createServer(app);
const io = socketIo(server);
// app.get("/socket", (req, res) => {
//   res.send("hello");
// });

var allUsers = {}; // currently online, inside the app

// var allUser = { youser@gmail.com : { socket : UUID }}

io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("error", (error) => {
    console.error(error);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });

  socket.on("add-user", async (token) => {
    try {
      const decoded = decodingToken(token);
      if (decoded) {
        const email = decoded.email;

        if (allUsers[email]) {
          // disconnect older socket
          const olderSocketID = allUsers[email].socket;
          const olderSocket = io.sockets.sockets.get(olderSocketID);
          olderSocket.emit("force-disconnect");
        }
        // overwrite older socket
        allUsers[email] = { socket: socket.id };

        // send userinfo of {email} through the socket

        const result = await pool.query(
          `SELECT name, email, uid, coins FROM users WHERE email = '${email}'`
        );

        socket.emit("userInfo", result[0]);
      }
    } catch (error) {
      console.error("add-user database error", error);
    }
  });

  socket.on("account-delete", async (token, passwordInput) => {
    // decode token,

    let decoded = decodingToken(token);
    if (decoded) {
      // if verified:
      let email = decoded.email;

      const queryResults = await pool.query(
        `SELECT password FROM users WHERE email = '${email}'`
      );

      const results = Object.values(JSON.parse(JSON.stringify(queryResults)));

      const db_password = results[0].password;
      // check password:
      if (await argon2.verify(db_password, password)) {
        // if password correct:

        // force logout
        socket.emit("force-disconnect");
        // make delete query
        let result = await pool.query(
          `DELETE FROM users WHERE email = '${email}'`
        );
        return res.send({ type: "success" });
      } else {
        socket.emit("toasts", { type: "error", message: "Incorrect Password" });
      }
    }
  });

  socket.on("get-all-wallpapers", async () => {
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

    socket.emit("all-wallpapers", { result: query_result, date: this_month });
  });

  socket.on("get-daily-wallpapers", async () => {
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

    socket.emit("daily-wallpapers", { result: query_result, date: today });
  });

  socket.on(
    "download-wallpaper",
    async (
      consumed_coins,
      wallpaper_id,
      type,
      item,
      year,
      month,
      wallpaper_id_
    ) => {
      // let consumed_coins = req.body.consumed_coins;
      // let wallpaper_id = req.body.wallpaper_id;

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

        socket.emit(
          "start-download",
          new_coins_amount,
          type,
          item,
          year,
          month,
          wallpaper_id_
        );
      } else {
        socket.emit("toasts", { type: "error", message: "Not enough coins." });
      }
      // to do: save log in database for every download (image id, user, date, coins before, coins after)
    }
  );

  socket.on("save-coin", async (token) => {
    try {
      const decoded = decodingToken(token);
      if (decoded.email) {
        let email = decoded.email;

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

        socket.emit("coin-saved");
      }
    } catch (error) {
      console.log(error);
    }
  });
});

// const port = 3004;
const port = process.env.SERVER_PORT;
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

function decodingToken(token) {
  try {
    let decoded = jwt.verify(token, process.env.JWT_SECRET);

    return { email: decoded.email };
  } catch (error) {
    // If an error occurs during verification, you can handle it here.
    if (error.name === "TokenExpiredError") {
      // Handle token expiration error
      console.error("Token has expired.");
    } else if (error.name === "JsonWebTokenError") {
      // Handle other JWT-related errors
      console.error("JWT verification failed:", error.message);
    } else {
      // Handle other unexpected errors
      console.error("An unexpected error occurred:", error.message);
    }
  }
}
