const http = require("http");
const express = require("express");
const app = express();
// const server = require("http").createServer(app);
const socketIo = require("socket.io");

const jwt = require("jsonwebtoken");
const pool = require("./database");
const cors = require("cors");

const { OAuth2Client } = require("google-auth-library");

const YOUR_GOOGLE_CLIENT_ID =
  "525928726797-45m49p0kdbcspgsicp72cl6d67fcabk0.apps.googleusercontent.com"; // Replace with your Google client ID
const YOUR_JWT_SECRET = process.env.JWT_SECRET; // Replace with your JWT secret key

const client = new OAuth2Client(YOUR_GOOGLE_CLIENT_ID);

const verifyGoogleToken = async (clientId, googleIdToken) => {
  try {
    const ticket = await client.verifyIdToken({
      idToken: googleIdToken,
      audience: clientId,
    });

    const payload = ticket.getPayload();
    const userId = payload.sub;
    const email = payload.email;
    const name = payload.name;
    console.log(
      "🚀 ~ file: index.js:27 ~ verifyGoogleToken ~ :",
      userId,
      " ",
      email,
      " ",
      name
    );
    // You can extract other user information as needed
    // return { userId, email, name };
  } catch (error) {
    console.error("Error verifying Google token:", error);
    // throw new Error("Invalid Google token");
  }
};

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
          console.log(allUsers);
          // disconnect older socket
          const olderSocketID = allUsers[email].socket;
          const olderSocket = io.sockets.sockets.get(olderSocketID);
          if (olderSocket) {
            olderSocket.emit("force-disconnect");
          }
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

  socket.on("check-google-user", async (googleid, email, name) => {
    try {
      // check if googleid exists
      const check_googleid = await pool.query(
        `SELECT EXISTS (SELECT 1 FROM users WHERE googleid = ${googleid}) AS googleidExists`
      );
      console.log("check_googleid: ", check_googleid);
      if (!check_googleid[0].googleidExists) {
        // if not, check if email exists

        const check_email = await pool.query(
          `SELECT EXISTS (SELECT 1 FROM users WHERE email = '${email}') AS emailExists`
        );
        console.log("check_email: ", check_email);
        if (check_email[0].emailExists) {
          // if true, add googleid to this email

          await pool.query(
            `UPDATE users SET googleid = ${googleid} WHERE email = '${email}'`
          );
        } else {
          // if not, add new user
          let set = new Set(Array.from({ length: 9999 }, (_, i) => i + 1));
          // check if name exists
          const discriminatorQuery = await pool.query(
            `SELECT discriminator FROM users WHERE name = '${name}'`
          );
          const discriminatorResult = Object.values(
            JSON.parse(JSON.stringify(discriminatorQuery))
          ); // array of objects
          // extract discriminators from query
          const discriminatorArray = discriminatorResult.map(
            (result) => result.discriminator
          );
          // check if any discriminators are taken : for example Bassel#2224, Bassel#4852, Bassel#9983
          if (discriminatorArray.length > 0) {
            // delete existed discriminators from the Set
            for (let i = 0; i < discriminatorArray.length; i++) {
              set.delete(discriminatorArray[i]);
            }
          }
          // select random number from Set
          const availableDiscriminators = Array.from(set);
          // check if all discriminators are taken
          const randomIndex = Math.floor(
            Math.random() * availableDiscriminators.length
          );
          const randomNumber = availableDiscriminators[randomIndex];
          const paddedNumber = randomNumber.toString().padStart(4, "0");

          const uniqueId = name + "#" + paddedNumber;

          const queryResult = await pool.query(
            `INSERT INTO users (name, discriminator, uid, email, googleid) VALUES ('${name}','${paddedNumber}','${uniqueId}','${email}',${googleid})`
          );
        }
      }

      // select user and send it to frontend

      if (allUsers[email]) {
        console.log(allUsers);
        // disconnect older socket
        const olderSocketID = allUsers[email].socket;
        const olderSocket = io.sockets.sockets.get(olderSocketID);
        if (olderSocket) {
          olderSocket.emit("force-disconnect");
        }
      }
      // overwrite older socket
      allUsers[email] = { socket: socket.id };

      // send userinfo of {email} through the socket

      const result = await pool.query(
        `SELECT name, email, uid, coins FROM users WHERE email = '${email}' AND googleid = ${googleid}`
      );

      socket.emit("userInfo", result[0]);

      // emit full userData to "userInfo"
    } catch (error) {
      console.error(error);
    }
  });

  socket.on("account-delete", async (clientId, token) => {
    // decode token,

    verifyGoogleToken(clientId, token);
    // if (authType === "default") {
    //   let decoded = decodingToken(token);

    //   if (decoded) {
    //     // if verified:
    //     let email = decoded.email;

    //     socket.emit("force-disconnect");

    //     let result = await pool.query(
    //       `DELETE FROM users WHERE email = '${email}'`
    //     );
    //   }
    // }
    console.log("done");
  });
  // const queryResults = await pool.query(
  //   `SELECT password FROM users WHERE email = '${email}'`
  // );

  // const results = Object.values(JSON.parse(JSON.stringify(queryResults)));

  // const db_password = results[0].password;
  // check password:
  // if (await argon2.verify(db_password, passwordInput)) {
  // if password correct:

  // force logout

  // make delete query

  // return res.send({ type: "success" });
  // }
  // else {
  //   socket.emit("toasts", { type: "error", message: "Incorrect Password" });
  // }
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
      wallpaper_id_,
      email
    ) => {
      // let consumed_coins = req.body.consumed_coins;
      // let wallpaper_id = req.body.wallpaper_id;

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

  socket.on("save-coin", async (data, revenue) => {
    try {
      let email;
      let gained_coins;

      if (revenue.value >= 0.001 && revenue.value < 0.01) {
        gained_coins = Math.floor(revenue.value / 0.001);
      } else if (revenue.value >= 0.01) {
        gained_coins = 10;
      } else {
        gained_coins = 0; // or another default value if necessary
      }

      if (data.type === "default") {
        const decoded = decodingToken(data.token);
        if (decoded.email) {
          email = decoded.email;
        }
      } else if (data.type === "google") {
        email = data.email;
      }

      // get current coins
      let queryCoins = await pool.query(
        `SELECT coins FROM users WHERE email = '${email}'`
      );
      let result = Object.values(JSON.parse(JSON.stringify(queryCoins)));

      let db_coins = result[0].coins;
      // save coin
      let new_coins_amount = db_coins + gained_coins;

      await pool.query(
        `UPDATE users SET coins = '${new_coins_amount}' WHERE email = '${email}'`
      );

      socket.emit("coin-saved", new_coins_amount);
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
