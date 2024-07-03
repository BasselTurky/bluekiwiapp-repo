const http = require("http");
const express = require("express");
const app = express();
// const server = require("http").createServer(app);
const socketIo = require("socket.io");

const jwt = require("jsonwebtoken");
const pool = require("./database");
// const pool = require("./databasePromise");
const cors = require("cors");

const { OAuth2Client } = require("google-auth-library");

const clientId = process.env.GOOGLE_CLIENT_ID; // Replace with your Google client ID
const jwt_secret = process.env.JWT_SECRET; // Replace with your JWT secret key

const client = new OAuth2Client(clientId);

// const verifyGoogleToken = async (googleIdToken) => {
//   try {
//     const ticket = await client.verifyIdToken({
//       idToken: googleIdToken,
//       audience: clientId,
//     });

//     const payload = ticket.getPayload();
//     const userId = payload.sub;
//     const email = payload.email;
//     const name = payload.name;
//     console.log(
//       "🚀 ~ file: index.js:27 ~ verifyGoogleToken ~ :",
//       userId,
//       " ",
//       email,
//       " ",
//       name
//     );
//     // You can extract other user information as needed
//     return { userId, email, name };
//   } catch (error) {
//     console.error("Error verifying Google token:", error);
//     // throw new Error("Invalid Google token");
//   }
// };

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

io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    const errorMessage = "Authentication error: Token missing.";
    console.error(errorMessage);
    socket.emit("authentication_error", { message: errorMessage });
    socket.disconnect(true);
    return;
    // return next(new Error("Authentication error: Token missing."));
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      const errorMessage = "Authentication error: Invalid token.";
      console.error(errorMessage);
      socket.emit("authentication_error", { message: errorMessage });
      socket.disconnect(true);
      return;
      // return next(new Error("Authentication error: Invalid token."));
    }
    console.log("🚀 ~ file: index.js:69 ~ jwt.verify ~ decoded:", decoded);

    // Attach user information to the socket for further use
    socket.user = decoded;
    next();
  });
});

io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("error", (error) => {
    console.error(error);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });

  socket.on("disconnecting", () => {
    const email = socket.user.email;

    delete allUsers[email];
  });

  socket.on("add-user", async () => {
    try {
      // const decoded = decodingToken(token);
      // if (decoded) {
      // const email = decoded.email;
      const email = socket.user.email;

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
      const userQuery = `
      SELECT name, email, uid, coins FROM users WHERE email = ?
      `;
      console.log(`
      SELECT name, email, uid, coins FROM users WHERE email = '${email}'
      `);
      const [rows, fields] = await pool.execute(userQuery, [email]);

      // const result = await pool.query(
      //   `SELECT name, email, uid, coins FROM users WHERE email = '${email}'`
      // );
      console.log("rows: ", rows);
      if (rows.length) {
        console.log("user itself: ", rows[0]);
        socket.emit("userInfo", rows[0]);
      }

      // }
    } catch (error) {
      console.error("add-user database error", error);
    }
  });

  socket.on("get-user-giveaway-history", async () => {
    const email = socket.user.email;

    const historyQuery = `
      SELECT p.winner,p.received, g.*
      FROM participants p
      JOIN users u ON p.userUid = u.uid
      JOIN giveaways g ON p.giveawayId = g.id
      WHERE u.email = ?
      ORDER BY g.id DESC; 
    `;
    const [rows, fields] = await pool.execute(historyQuery, [email]);
    console.log("history query: ", rows);
    // const history_query = await pool.query(`

    //   SELECT p.winner,p.received, g.*
    //   FROM participants p
    //   JOIN users u ON p.userUid = u.uid
    //   JOIN giveaways g ON p.giveawayId = g.id
    //   WHERE u.email = '${email}'
    //   ORDER BY g.id DESC;

    // `);

    socket.emit("giveaway-history", rows);
  });

  socket.on("get-giveaways-info", async () => {
    // get list of participants in active giveaway
    // aka data in active giveaway table
    let giveaway_x_id = null;
    let giveaway_z_id = null;

    const xQuery = `
      SELECT
          g.id,
          u.uid,
          p.date
      FROM
          participants p
      INNER JOIN
          users u ON p.id = u.id
      INNER JOIN
          giveaways g ON p.giveawayId = g.id
      WHERE
          g.status = 'active'
          AND g.type = 'x'
      ORDER BY
          p.date DESC;`;
    const [rows, fields] = await pool.execute(xQuery);
    console.log("this is rows ", rows);
    // console.log("first row ", rows[0]);

    // const giveaway_x_query = await pool.query(`
    //   SELECT
    //       g.id,
    //       u.uid,
    //       p.date
    //   FROM
    //       participants p
    //   INNER JOIN
    //       users u ON p.id = u.id
    //   INNER JOIN
    //       giveaways g ON p.giveawayId = g.id
    //   WHERE
    //       g.status = 'active'
    //       AND g.type = 'x'
    //   ORDER BY
    //       p.date DESC;
    // `);

    // const giveaway_x_query_result = Object.values(
    //   JSON.parse(JSON.stringify(giveaway_x_query))
    // )[0];
    // console.log("normal q ", giveaway_x_query_result);
    if (rows.length) {
      giveaway_x_id = rows[0].id;
      console.log("giveaway_x_id ", giveaway_x_id);
    } else {
      console.log("rows length = ", rows.length);
    }

    const zQuery = `
    SELECT
        g.id,
        u.uid,
        p.date
    FROM
        participants p
    INNER JOIN
        users u ON p.id = u.id
    INNER JOIN
        giveaways g ON p.giveawayId = g.id
    WHERE
        g.status = 'active'
        AND g.type = 'z'
    ORDER BY
        p.date DESC;
    `;

    const [zRows, zFields] = await pool.execute(zQuery);
    if (zRows.length) {
      giveaway_z_id = zRows[0].id;
      console.log("giveaway_z_id ", giveaway_z_id);
    } else {
      console.log("zRows length = ", zRows.length);
    }

    //   const giveaway_z_query = await pool.query(`
    //   SELECT
    //       g.id,
    //       u.uid,
    //       p.date
    //   FROM
    //       participants p
    //   INNER JOIN
    //       users u ON p.id = u.id
    //   INNER JOIN
    //       giveaways g ON p.giveawayId = g.id
    //   WHERE
    //       g.status = 'active'
    //       AND g.type = 'z'
    //   ORDER BY
    //       p.date DESC;
    // `);
    //   console.log(giveaway_z_query);
    //   const giveaway_z_query_result = Object.values(
    //     JSON.parse(JSON.stringify(giveaway_z_query))
    //   )[0];
    //   console.log(giveaway_z_query_result);
    // const giveaway_z_id = giveaway_z_query_result.id;

    const giveaway_x_data = {
      id: giveaway_x_id,
      type: "x",
      participants: rows,
    };
    const giveaway_z_data = {
      id: giveaway_z_id,
      type: "z",
      participants: zRows,
    };

    socket.emit("giveawayInfo", giveaway_x_data, giveaway_z_data);
  });

  // socket.on("check-google-user", async (googleid, email, name) => {
  //   try {
  //     // check if googleid exists
  //     const check_googleid = await pool.query(
  //       `SELECT EXISTS (SELECT 1 FROM users WHERE googleid = ${googleid}) AS googleidExists`
  //     );
  //     console.log("check_googleid: ", check_googleid);
  //     if (!check_googleid[0].googleidExists) {
  //       // if not, check if email exists

  //       const check_email = await pool.query(
  //         `SELECT EXISTS (SELECT 1 FROM users WHERE email = '${email}') AS emailExists`
  //       );
  //       console.log("check_email: ", check_email);
  //       if (check_email[0].emailExists) {
  //         // if true, add googleid to this email

  //         // a user with registeredd account : has email/password
  //         // now add google id to this account
  //         await pool.query(
  //           `UPDATE users SET googleid = ${googleid} WHERE email = '${email}'`
  //         );
  //       } else {
  //         // new user, fisrt time login with GoogleSignin

  //         // if not, add new user
  //         let set = new Set(Array.from({ length: 9999 }, (_, i) => i + 1));
  //         // check if name exists
  //         const discriminatorQuery = await pool.query(
  //           `SELECT discriminator FROM users WHERE name = '${name}'`
  //         );
  //         const discriminatorResult = Object.values(
  //           JSON.parse(JSON.stringify(discriminatorQuery))
  //         ); // array of objects
  //         // extract discriminators from query
  //         const discriminatorArray = discriminatorResult.map(
  //           (result) => result.discriminator
  //         );
  //         // check if any discriminators are taken : for example Bassel#2224, Bassel#4852, Bassel#9983
  //         if (discriminatorArray.length > 0) {
  //           // delete existed discriminators from the Set
  //           for (let i = 0; i < discriminatorArray.length; i++) {
  //             set.delete(discriminatorArray[i]);
  //           }
  //         }
  //         // select random number from Set
  //         const availableDiscriminators = Array.from(set);
  //         // check if all discriminators are taken
  //         const randomIndex = Math.floor(
  //           Math.random() * availableDiscriminators.length
  //         );
  //         const randomNumber = availableDiscriminators[randomIndex];
  //         const paddedNumber = randomNumber.toString().padStart(4, "0");

  //         const uniqueId = name + "#" + paddedNumber;

  //         //TODO generate password, add this password to the account
  //         // and send it to the user in an email

  //         const queryResult = await pool.query(
  //           `INSERT INTO users (name, discriminator, uid, email, googleid) VALUES ('${name}','${paddedNumber}','${uniqueId}','${email}',${googleid})`
  //         );
  //       }
  //     }

  //     // select user and send it to frontend

  //     if (allUsers[email]) {
  //       console.log(allUsers);
  //       // disconnect older socket
  //       const olderSocketID = allUsers[email].socket;
  //       const olderSocket = io.sockets.sockets.get(olderSocketID);
  //       if (olderSocket) {
  //         olderSocket.emit("force-disconnect");
  //       }
  //     }
  //     // overwrite older socket
  //     allUsers[email] = { socket: socket.id };

  //     // send userinfo of {email} through the socket

  //     const result = await pool.query(
  //       `SELECT name, email, uid, coins FROM users WHERE email = '${email}' AND googleid = ${googleid}`
  //     );

  //     socket.emit("userInfo", result[0]);

  //     // emit full userData to "userInfo"
  //   } catch (error) {
  //     console.error(error);
  //   }
  // });

  socket.on("account-delete", async () => {
    try {
      const email = socket.user.email;

      socket.emit("force-disconnect");

      const query = `
      DELETE FROM users WHERE email = ?
      `;
      const [rows, fields] = await pool.execute(query, [email]);

      // let result = await pool.query(`DELETE FROM users WHERE email = '${email}'`);

      //   }
      // }
      if (rows.affectedRows > 0) {
        console.log(`Successfully deleted user with email ${email}`);
        // Emit success event or handle further logic if needed
      } else {
        console.log(`User with email ${email} not found or not deleted`);
        // Handle case where no user was deleted (optional)
      }
    } catch (error) {
      console.error("Error deleting user:", err.message);
      // Handle error appropriatel
    }
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
    // var date = new Date();
    // var now_utc = Date.UTC(
    //   date.getUTCFullYear(),
    //   date.getUTCMonth(),
    //   date.getUTCDate(),
    //   date.getUTCHours(),
    //   date.getUTCMinutes(),
    //   date.getUTCSeconds()
    // );
    // var date_string = new Date(now_utc).toISOString();
    // var this_month = date_string.substring(0, 8) + "01";

    var today = new Date().toISOString().split("T")[0];
    var this_month = today.substring(0, 8) + "01";
    const customDate = "2024-3-23";

    const query = `
    SELECT * FROM wallpapers WHERE date(date) < ?
    `;

    const [rows, fields] = await pool.execute(query, [customDate]);

    // const query_result = await pool.query(
    //   `SELECT * FROM wallpapers WHERE date(date) < '${customDate}'`
    // );

    socket.emit("all-wallpapers", { result: rows, date: customDate });
  });

  socket.on("get-daily-wallpapers", async () => {
    // var date = new Date();
    // var now_utc = Date.UTC(
    //   date.getUTCFullYear(),
    //   date.getUTCMonth(),
    //   date.getUTCDate(),
    //   date.getUTCHours(),
    //   date.getUTCMinutes(),
    //   date.getUTCSeconds()
    // );
    // var date_string = new Date(now_utc).toISOString();
    // var today = date_string.substring(0, 10);
    var today = new Date().toISOString().split("T")[0];

    var day = today.substring(8);

    var start_of_the_month = today.substring(0, 8) + "01";
    var end_of_the_month = today.substring(0, 8) + "27";

    var number_of_wallpapers = 20;

    let query_result;

    if (Number(day) > 27) {
      // query_result = await pool.query(
      //   `SELECT * FROM wallpapers WHERE date >= '${start_of_the_month}' AND date <= '${end_of_the_month}' ORDER BY downloads DESC LIMIT ${number_of_wallpapers}`
      // );

      const query = `
      SELECT * FROM wallpapers WHERE date >= ? AND date <= ? ORDER BY downloads DESC LIMIT ?
      `;

      query_result = await pool.execute(query, [
        start_of_the_month,
        end_of_the_month,
        number_of_wallpapers,
      ]);
    } else {
      // query_result = await pool.query(
      //   `SELECT * FROM wallpapers WHERE date(date) = '${today}'`
      // );

      const query = `
      SELECT * FROM wallpapers WHERE date(date) = ?
      `;
      query_result = await pool.execute(query, [today]);
    }

    socket.emit("daily-wallpapers", { result: query_result[0], date: today });
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
      // email
    ) => {
      // let consumed_coins = req.body.consumed_coins;
      // let wallpaper_id = req.body.wallpaper_id;
      const email = socket.user.email;

      const userDataQuery = `
      SELECT * FROM users WHERE email = ?
      `;
      const [userRows, userFields] = await pool.execute(userDataQuery, [email]);
      // const user_data_query = await pool.query(
      //   `SELECT * FROM users WHERE email = '${email}'`
      // );

      const user = userRows[0];

      // const user_data = Object.values(
      //   JSON.parse(JSON.stringify(user_data_query))
      // )[0];

      if (user.coins >= consumed_coins) {
        const new_coins_amount = user.coins - consumed_coins;

        // consume coins
        const updateQuery = `
        UPDATE users SET coins = ? WHERE email = ?
        `;
        const [updateRows, updateFields] = await pool.execute(updateQuery, [
          new_coins_amount,
          email,
        ]);

        if (updateRows.affectedRows > 0) {
          console.log(
            `Successfully updated coins for user with email ${email}`
          );
          // Handle success, emit events, etc.
        } else {
          console.log(
            `User with email ${email} not found or update did not occur`
          );
          // Handle case where no rows were updated
        }
        // await pool.query(`
        // UPDATE users SET coins = ${new_coins_amount} WHERE email = '${email}'
        // `);
        // update downloads number
        const query = `
        UPDATE wallpapers SET downloads = downloads + 1 WHERE wallpaper_id = ?
        `;
        const [rows, fields] = await pool.execute(query, [wallpaper_id]);

        if (rows.affectedRows > 0) {
          console.log(
            `Successfully updated downloads for wallpaper with ID ${wallpaper_id}`
          );
          // Handle success, emit events, etc.
        } else {
          console.log(
            `Wallpaper with ID ${wallpaper_id} not found or update did not occur`
          );
          // Handle case where no rows were updated
        }

        //   await pool.query(`
        // UPDATE wallpapers SET downloads = downloads + 1 WHERE wallpaper_id = ${wallpaper_id}
        // `);

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

  socket.on("save-coin", async (revenue) => {
    try {
      let email = socket.user.email;
      let gained_coins;

      if (revenue.value >= 0.001 && revenue.value < 0.01) {
        gained_coins = Math.floor(revenue.value / 0.001);
      } else if (revenue.value >= 0.01) {
        gained_coins = 10;
      } else {
        gained_coins = 0; // or another default value if necessary
      }

      // if (data.type === "default") {
      //   const decoded = decodingToken(data.token);
      //   if (decoded.email) {
      //     email = decoded.email;
      //   }
      // } else if (data.type === "google") {
      //   email = data.email;
      // }

      // get current coins
      const query = `
      SELECT coins FROM users WHERE email = ?
      `;
      const [rows, fields] = await pool.execute(query, [email]);

      // let queryCoins = await pool.query(
      //   `SELECT coins FROM users WHERE email = '${email}'`
      // );
      // let result = Object.values(JSON.parse(JSON.stringify(queryCoins)));
      const user = rows[0];
      let db_coins = user.coins;
      // save coin
      let new_coins_amount = db_coins + gained_coins;

      const updateQuery = `
      UPDATE users SET coins = ? WHERE email = ?
      `;
      const [updateRows, updateFields] = await pool.execute(updateQuery, [
        new_coins_amount,
        email,
      ]);
      // await pool.query(
      //   `UPDATE users SET coins = '${new_coins_amount}' WHERE email = '${email}'`
      // );

      socket.emit("coin-saved", new_coins_amount);
    } catch (error) {
      console.log(error);
    }
  });
});

// Error handler for authentication errors
// io.use((error, socket, next) => {
//   if (
//     error &&
//     error.message &&
//     error.message.startsWith("Authentication error")
//   ) {
//     console.error(
//       `Authentication error for socket ${socket.id}: ${error.message}`
//     );
//     socket.disconnect(true); // Disconnect the socket with an authentication error
//   }
//   next(error);
// });

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
