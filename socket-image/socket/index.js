const http = require("http");
const express = require("express");
const app = express();
// const server = require("http").createServer(app);
const socketIo = require("socket.io");

const jwt = require("jsonwebtoken");
const pool = require("./database");
// const pool = require("./databasePromise");
const cors = require("cors");
const argon2 = require("argon2");
const { OAuth2Client } = require("google-auth-library");

const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const cloudflateAccountId = "4bec7228ebef0487360976eb286b92a9";
const accessKeyId = "a212e7bf9e6bda07da48b800d3f2177d";
const secretAccessKey =
  "292046a823deca5a6ccaa8b1df162df03da19270c2f106a3c135c5520629e7fd";
const s3Client = new S3Client({
  region: "auto", // Cloudflare R2 uses "auto" for the region
  endpoint: `https://${cloudflateAccountId}.r2.cloudflarestorage.com`, // Replace with your Cloudflare account ID
  credentials: {
    accessKeyId: accessKeyId, // Your R2 access key
    secretAccessKey: secretAccessKey, // Your R2 secret key
  },
});

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

async function generateSignedUrl(bucketName, objectKey, expiresIn = 86400) {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
  });

  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
  return signedUrl;
}

const server = http.createServer(app);
const io = socketIo(server);
// app.get("/socket", (req, res) => {
//   res.send("hello");
// });

var allUsers = {}; // currently online, inside the app

// var allUser = { youser@gmail.com : { socket : UUID }}

// io.use((socket, next) => {
//   const accessToken = socket.handshake.auth.accessToken;
//   console.log("access token got from client: ", accessToken);

//   if (!accessToken) {
//     socket.emit("toasts", { type: "error", message: "Authentication error" });
//     socket.disconnect(true);
//     return;
//     // return next(new Error("Authentication error: Token missing."));
//   }

//   jwt.verify(
//     accessToken,
//     process.env.ACCESS_TOKEN_SECRET,
//     async (err, decoded) => {
//       if (err || !decoded) {
//         console.log(err);

//         socket.emit("toasts", {
//           type: "error",
//           message: "Authentication error",
//         });
//         socket.disconnect(true);
//         return;
//         // return next(new Error("Authentication error: Invalid token."));
//       }
//       // Attach user information to the socket for further use
//       socket.user = decoded;
//       console.log("decoded");
//       // username, email
//       try {
//         const email = socket.user.email;

//         // Check if the user is already connected
//         if (allUsers[email]) {
//           console.log(allUsers);

//           // Disconnect older socket
//           const olderSocketID = allUsers[email].socket;
//           const olderSocket = io.sockets.sockets.get(olderSocketID);
//           if (olderSocket) {
//             olderSocket.emit("force-disconnect");
//           }
//           console.log("allUsers");
//         }

//         // Overwrite the older socket
//         allUsers[email] = { socket: socket.id };

//         // Fetch user data from the database
//         const userInfo = await fetchUserFromDB(email);
//         console.log("userInfo");

//         if (userInfo) {
//           console.log("User info:", userInfo);
//           // Emit user info to the frontend
//           socket.emit("userInfo", userInfo);

//           next(); // Proceed after successful authentication and data fetching
//         } else {
//           console.log("disconnect");

//           socket.disconnect(true);
//         }
//       } catch (error) {
//         console.error("Authentication error ", error);
//         socket.emit("toasts", {
//           type: "error",
//           message: "Authentication error",
//         });
//         socket.disconnect(true);
//       }

//       // next();
//     }
//   );
// });

io.use((socket, next) => {
  const accessToken = socket.handshake.auth.accessToken;
  console.log("Access token received from client: ", accessToken);

  if (!accessToken) {
    return next(new Error("Authentication error: Token missing."));
  }

  jwt.verify(
    accessToken,
    process.env.ACCESS_TOKEN_SECRET,
    async (err, decoded) => {
      if (err || !decoded) {
        console.error("JWT verification error:", err);
        return next(new Error("Authentication error: Invalid token."));
      }

      // Attach user information to the socket for further use
      socket.user = decoded;
      console.log("Decoded token:", decoded);

      try {
        const email = socket.user.email;

        // Check if the user is already connected
        if (allUsers[email]) {
          // console.log("Existing user detected:", allUsers);

          // Disconnect older socket
          const olderSocketID = allUsers[email].socket;
          const olderSocket = io.sockets.sockets.get(olderSocketID);
          if (olderSocket) {
            olderSocket.emit("force-disconnect");
          }
          console.log("Older socket disconnected for user:", email);
        }

        // Overwrite the older socket
        allUsers[email] = { socket: socket.id };

        // Fetch user data from the database
        const userInfo = await fetchUserFromDB(email);
        console.log("Fetched user info:", userInfo);

        if (userInfo) {
          // Emit user info to the frontend
          socket.emit("userInfo", userInfo);

          next(); // Proceed after successful authentication and data fetching
        } else {
          console.error("User not found in database, disconnecting...");
          return next(new Error("Authentication error: User not found."));
        }
      } catch (error) {
        console.error("Error during authentication process:", error);
        return next(new Error("Authentication error: Internal server error."));
      }
    }
  );
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

  // socket.on("add-user", async () => {
  //   try {
  //     // const decoded = decodingToken(token);
  //     // if (decoded) {
  //     // const email = decoded.email;
  //     const email = socket.user.email;

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
  //     const userQuery = `
  //     SELECT firstname,,lastname, email, username, coins FROM users WHERE email = ?
  //     `;
  //     const [rows, fields] = await pool.execute(userQuery, [email]);

  //     // const result = await pool.query(
  //     //   `SELECT name, email, uid, coins FROM users WHERE email = '${email}'`
  //     // );
  //     console.log("rows: ", rows);
  //     if (rows.length) {
  //       console.log("user itself: ", rows[0]);
  //       socket.emit("userInfo", rows[0]);
  //     }

  //     // }
  //   } catch (error) {
  //     console.error("add-user database error", error);
  //   }
  // });

  //   socket.on("get-user-giveaway-history", async () => {
  //     const email = socket.user.email;

  //     // const historyQuery = `
  //     //   SELECT p.winner,p.received, g.id, g.date, g.reward_value_usd, g.status,g.type
  //     //   FROM participants p
  //     //   JOIN users u ON p.userUid = u.uid
  //     //   JOIN giveaways g ON p.giveawayId = g.id
  //     //   WHERE u.email = ?
  //     //   ORDER BY g.id DESC;
  //     // `;
  //     const historyQuery = `
  // SELECT
  //     g.id AS giveawayId,
  //     g.date,
  //     g.type,
  //     g.reward_value_usd,
  //     p.winner,
  //     p.received,
  //     (
  //         SELECT JSON_ARRAYAGG(
  //             JSON_OBJECT(
  //                 'userId', p.userUid,
  //                 'joinDate', p.date,
  //                 'winner', p.winner,
  //                 'received', p.received
  //             )
  //         )
  //         FROM participants p
  //         WHERE p.giveawayId = g.id AND p.winner = 1
  //     ) AS winners,
  //     (
  //         SELECT COUNT(*)
  //         FROM participants p_all
  //         WHERE p_all.giveawayId = g.id
  //     ) AS totalParticipants
  // FROM
  //     giveaways g
  // JOIN participants p ON g.id = p.giveawayId
  // JOIN users u ON p.userUid = u.uid
  // WHERE
  //     g.status = 'ended'
  //     AND u.email = ?
  // ORDER BY
  //     g.date ASC;
  //     `;
  //     const [rows, fields] = await pool.execute(historyQuery, [email]);
  //     console.log("history query: ", rows);
  //     // const history_query = await pool.query(`

  //     //   SELECT p.winner,p.received, g.*
  //     //   FROM participants p
  //     //   JOIN users u ON p.userUid = u.uid
  //     //   JOIN giveaways g ON p.giveawayId = g.id
  //     //   WHERE u.email = '${email}'
  //     //   ORDER BY g.id DESC;

  //     // `);

  //     socket.emit("giveaway-history", rows);
  //   });

  socket.on("get-history-giveaways", async (eventType, offset) => {
    try {
      const email = socket.user.email;
      const historyGiveaways = await getHistoryGiveaways(email, offset);
      if (historyGiveaways.length) {
        socket.emit("history-giveaways", eventType, historyGiveaways);
      }
    } catch (error) {
      socket.emit("toasts", { type: "error", message: "Failed to fetch data" });
      console.log(`Failed to fetch giveaway history: ,${error}`);
    }
  });

  // socket.on('get-rest-of-history-giveaways', async(offset)=>{
  //   const email = socket.user.email

  //   const historyGiveaways = getHistoryGiveaways(email, offset)

  //   socket.emit('add-history-giveaway' , historyGiveaways)
  // })

  // socket.on("get-giveaways-info", async () => {
  //   // get list of participants in active giveaway
  //   // aka data in active giveaway table
  //   const giveawayXQuery = `
  //   SELECT
  //       id,date,status,type
  //   FROM
  //       giveaways g
  //   WHERE
  //       g.status = 'active' AND g.type = 'x';
  //   `;
  //   const [gXRows, gXFields] = await pool.execute(giveawayXQuery);
  //   const giveawayXRow = gXRows[0];

  //   // TODO select the rest of the participants not all

  //   //     const query = `
  //   //   SELECT
  //   //       p.userUid,
  //   //       p.date
  //   //   FROM
  //   //       participants p
  //   //   WHERE
  //   //       p.giveawayId = ?
  //   //   ORDER BY
  //   //       p.date ASC
  //   //   LIMIT ?, ?
  //   // `;

  //   const participantsXQuery = `
  //     SELECT
  //         p.userUid,
  //         p.date
  //     FROM
  //         participants p
  //     INNER JOIN
  //         giveaways g ON p.giveawayId = g.id
  //     WHERE
  //         g.status = 'active'
  //         AND g.type = 'x'
  //     ORDER BY
  //         p.date DESC;`;
  //   const [pXRows, pXFields] = await pool.execute(participantsXQuery);

  //   // console.log("first row ", rows[0]);

  //   // const giveaway_x_query = await pool.query(`
  //   //   SELECT
  //   //       g.id,
  //   //       u.uid,
  //   //       p.date
  //   //   FROM
  //   //       participants p
  //   //   INNER JOIN
  //   //       users u ON p.id = u.id
  //   //   INNER JOIN
  //   //       giveaways g ON p.giveawayId = g.id
  //   //   WHERE
  //   //       g.status = 'active'
  //   //       AND g.type = 'x'
  //   //   ORDER BY
  //   //       p.date DESC;
  //   // `);

  //   // const giveaway_x_query_result = Object.values(
  //   //   JSON.parse(JSON.stringify(giveaway_x_query))
  //   // )[0];
  //   // console.log("normal q ", giveaway_x_query_result);
  //   // if (rows.length) {
  //   //   giveaway_x_id = rows[0].id;
  //   //   console.log("giveaway_x_id ", giveaway_x_id);
  //   // } else {
  //   //   console.log("rows length = ", rows.length);
  //   // }
  //   const giveawayZQuery = `
  //   SELECT
  //       id,date,status,type
  //   FROM
  //       giveaways g
  //   WHERE
  //       g.status = 'active' AND g.type = 'z';
  //   `;
  //   const [zGRows, zGFields] = await pool.execute(giveawayZQuery);
  //   const giveawayZRow = zGRows[0];

  //   const participantsZQuery = `
  //   SELECT
  //       p.userUid,
  //       p.date
  //   FROM
  //       participants p
  //   INNER JOIN
  //       giveaways g ON p.giveawayId = g.id
  //   WHERE
  //       g.status = 'active'
  //       AND g.type = 'z'
  //   ORDER BY
  //       p.date DESC;
  //   `;

  //   const [zPRows, zPFields] = await pool.execute(participantsZQuery);

  //   // if (zRows.length) {
  //   //   giveaway_z_id = zRows[0].id;
  //   //   console.log("giveaway_z_id ", giveaway_z_id);
  //   // } else {
  //   //   console.log("zRows length = ", zRows.length);
  //   // }

  //   //   const giveaway_z_query = await pool.query(`
  //   //   SELECT
  //   //       g.id,
  //   //       u.uid,
  //   //       p.date
  //   //   FROM
  //   //       participants p
  //   //   INNER JOIN
  //   //       users u ON p.id = u.id
  //   //   INNER JOIN
  //   //       giveaways g ON p.giveawayId = g.id
  //   //   WHERE
  //   //       g.status = 'active'
  //   //       AND g.type = 'z'
  //   //   ORDER BY
  //   //       p.date DESC;
  //   // `);
  //   //   console.log(giveaway_z_query);
  //   //   const giveaway_z_query_result = Object.values(
  //   //     JSON.parse(JSON.stringify(giveaway_z_query))
  //   //   )[0];
  //   //   console.log(giveaway_z_query_result);
  //   // const giveaway_z_id = giveaway_z_query_result.id;

  //   const giveaway_x_data = {
  //     info: giveawayXRow,
  //     type: "x",
  //     participants: pXRows,
  //   };
  //   const giveaway_z_data = {
  //     info: giveawayZRow,
  //     type: "z",
  //     participants: zPRows,
  //   };

  //   socket.emit("giveawayInfo", giveaway_x_data, giveaway_z_data);
  // });

  socket.on("get-active-giveaway", async (type) => {
    try {
      const activeGiveaway = await getActiveGiveaway(type);
      const activeGiveawayId = activeGiveaway.id;
      const userUid = socket.user.username;
      const isUserAParticipant = await checkIfUserExistsInParticipants(
        userUid,
        activeGiveawayId
      );
      const giveawayObject = {
        giveaway: activeGiveaway,
        isParticipant: isUserAParticipant ? true : false,
      };
      socket.emit(`active-giveaway`, giveawayObject, type);
    } catch (error) {
      socket.emit("toasts", { type: "error", message: "Failed to fetch data" });
      console.log(`Failed to fetch active giveaway ${type}: ${error}`);
    }
  });

  socket.on("check-giveawayId", async (giveawayId, type) => {
    // check if id is current active giveaway id
    try {
      const exists = await checkIfGiveawayExixts(giveawayId, type);
      if (!exists) {
        const activeGiveaway = await getActiveGiveaway(type);
        const activeGiveawayId = activeGiveaway.id;
        const userUid = socket.user.username;
        const isUserAParticipant = await checkIfUserExistsInParticipants(
          userUid,
          activeGiveawayId
        );
        const giveawayObject = {
          giveaway: activeGiveaway,
          isParticipant: isUserAParticipant ? true : false,
        };
        socket.emit(`active-giveaway`, giveawayObject, type);
      }
    } catch (error) {
      socket.emit("toasts", { type: "error", message: "Failed to fetch data" });
      console.log(
        `Failed to fetch active giveaway ${type} after check: ${error}`
      );
    }
  });

  socket.on("get-all-participants", async (type) => {
    // get participants in giveaway with type: type
    try {
      const participantsObject = await getAllParticipants(type);
      socket.emit(`all-participants-giveaway`, participantsObject, type);
    } catch (error) {
      socket.emit("toasts", { type: "error", message: "Failed to fetch data" });
      console.log(`Failed to fetch all participants: ${error}`);
    }
  });

  socket.on(
    "get-current-participants",
    async (totalParticipants, giveawayId, type) => {
      // check if giveaway exists
      try {
        const exists = await checkIfGiveawayExixts(giveawayId, type);
        if (exists) {
          const currentParticipants = await getCurrentParticipants(
            totalParticipants,
            type
          );
          console.log(
            "currentParticipants.length : ",
            currentParticipants.length
          );

          if (currentParticipants.length) {
            socket.emit(`participant-joined`, currentParticipants, type);
          }
        } else {
          // send all participants in new active giveaway
          const participantsObject = await getAllParticipants(type);
          // and get active giveawayId
          socket.emit(`all-participants-giveaway`, participantsObject, type);
        }
      } catch (error) {
        socket.emit("toasts", {
          type: "error",
          message: "Failed to fetch data",
        });
        console.log(`Failed to fetch current participants ${error}`);
      }
    }
  );

  // socket.on("join-giveaway", async (giveawayId, giveawayType) => {
  //   try {
  //     const email = socket.user.email;
  //     const userUid = socket.user.uid;
  //     const consumedCoins = 10;

  //     const isActive = await checkActiveGiveaway(giveawayId);

  //     if (isActive === 1) {

  //       const userExists = checkIfUserExistsInParticipants(userUid, giveawayId)

  //       if(!userExists){

  //         console.log('user exists');

  //         return
  //       }

  //       const result = await checkCoins(email, consumedCoins);
  //       // check coins
  //       if (result) {
  //         if (result.type === "update") {
  //           // coins ok , consumed and updated
  //           // add user to participants, then notify all
  //           const query = `
  //           INSERT INTO participants (giveawayId, userUid) VALUES (?, ?);
  //         `;
  //           const [insertResult] = await pool.execute(query, [
  //             giveawayId,
  //             userUid,
  //           ]);

  //           if (insertResult.affectedRows > 0) {
  //             console.log(
  //               `Successfully inserted ${userUid} into participants.`
  //             );

  //             const historyQuery = `
  //             SELECT p.winner,p.received, g.id, g.date, g.reward_value_usd, g.status,g.type, g.winnerUid
  //             FROM participants p
  //             JOIN users u ON p.userUid = u.uid
  //             JOIN giveaways g ON p.giveawayId = g.id
  //             WHERE u.email = ?
  //             ORDER BY g.id DESC;
  //           `;
  //             const [rows, fields] = await pool.execute(historyQuery, [email]);
  //             console.log("history query: ", rows);

  //             socket.emit("giveaway-history", rows);

  //             const insertedId = insertResult.insertId;
  //             const selectQuery = `
  //             SELECT userUid,date FROM participants WHERE id = ?
  //             `;
  //             const [participantRow, participantField] = await pool.execute(
  //               selectQuery,
  //               [insertedId]
  //             );
  //             // Handle success, emit events, etc.
  //             // notify all
  //             if (participantRow[0]) {
  //               const participantInfo = participantRow[0];
  //               io.emit(
  //                 "participant-joined",
  //                 participantInfo,
  //                 giveawayId,
  //                 giveawayType
  //               );
  //             } else {
  //               console.log(`Didn't find participant / ${participantRow}`);
  //             }
  //           } else {
  //             console.log(
  //               `User ${userUid}/giveaway:${giveawayId} not found or insert did not occur`
  //             );
  //             // Handle case where no rows were updated
  //           }
  //         } else if (result.type === "failed") {
  //           // not enough coins
  //           socket.emit("toasts", {
  //             type: "error",
  //             message: "Not enough coins.",
  //           });
  //         }
  //       } else {
  //         throw new Error("Check coins error");
  //       }
  //     } else if (isActive === 0) {
  //       socket.emit("toasts", { type: "error", message: "Giveaway ended." });
  //     }

  //     // socket.emit("toasts", { type: "error", message: "Not enough coins." });
  //   } catch (error) {
  //     console.log(error);
  //     socket.emit("toasts", { type: "error", message: "Join failed." });
  //   }
  // });

  socket.on("join-giveaway", async (giveawayId, giveawayType) => {
    try {
      const email = socket.user.email;
      const userUid = socket.user.username;
      const consumedCoins = 10;

      // Check if the giveaway is active
      const isActive = await checkActiveGiveaway(giveawayId);
      if (isActive === 0) {
        socket.emit("toasts", { type: "error", message: "Giveaway ended." });
        return;
      }

      // Check if the user already exists in the participants
      const userExists = await checkIfUserExistsInParticipants(
        userUid,
        giveawayId
      );
      if (userExists) {
        console.log("User already exists in participants.");
        return;
      }

      // Check if the user has enough coins
      const result = await checkCoins(email, consumedCoins);
      if (!result) {
        throw new Error("Check coins error");
      }

      if (result.type === "failed") {
        socket.emit("toasts", { type: "error", message: "Not enough coins." });
        return;
      }

      // Insert user into participants and notify all
      if (result.type === "update") {
        const query = `
          INSERT INTO participants (giveawayId, userUid) VALUES (?, ?);
        `;
        const [insertResult] = await pool.execute(query, [giveawayId, userUid]);

        if (insertResult.affectedRows > 0) {
          console.log(`Successfully inserted ${userUid} into participants.`);

          // Fetch and emit giveaway history
          const historyQuery = `
            SELECT p.winner, p.received, g.id, g.date, g.reward_value_usd, g.status, g.type, g.winnerUid
            FROM participants p
            JOIN users u ON p.userUid = u.username
            JOIN giveaways g ON p.giveawayId = g.id
            WHERE u.email = ?
            ORDER BY g.id DESC;
          `;
          const [rows] = await pool.execute(historyQuery, [email]);
          socket.emit("giveaway-history", rows);

          // Fetch and emit participant info
          const insertedId = insertResult.insertId;
          const selectQuery = `
            SELECT userUid, date, giveawayId FROM participants WHERE id = ?
          `;
          const [participantRow] = await pool.execute(selectQuery, [
            insertedId,
          ]);

          if (participantRow[0]) {
            const participantInfo = participantRow[0];
            io.emit("participant-joined", participantInfo, giveawayType);
            socket.emit("user-joined-giveaway", giveawayType);
            // TODO also sent notice to this socket
            // that he joined on -user-joined-giveaway-
            // and add him to this active giveaway state
          } else {
            console.log(`Didn't find participant with ID: ${insertedId}`);
          }
        } else {
          console.log(
            `Failed to insert participant: ${userUid} into giveaway: ${giveawayId}`
          );
        }
      }
    } catch (error) {
      console.log(error);
      socket.emit("toasts", { type: "error", message: "Join failed." });
    }
  });

  const claimRewardSchema = {
    giveawayId: { type: "number", required: true },
    selectedGift: {
      type: "string",
      required: true,
      allowedValues: [
        "PayPal",
        "Payeer",
        "Amazon Gift Card",
        "Google Play Gift Card",
      ],
    },
    details: { type: "string", required: true }, // We'll handle specific validation in the handler
  };

  socket.on("claim-reward", async (giveawayId, selectedGift, details) => {
    const payload = { giveawayId, selectedGift, details };

    // Validate payload structure
    const isValidStructure = verifyPayload(payload, claimRewardSchema);

    if (!isValidStructure) {
      socket.emit("toasts", {
        type: "error",
        message: "Invalid input structure.",
      });
      return;
    }

    let isValid = false;
    // verify input
    const payeerIdRegex = /^P\d{6,12}$/;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    switch (selectedGift) {
      case "Payeer":
        isValid = payeerIdRegex.test(details);
        break;
      case "PayPal":
      case "Amazon Gift Card":
      case "Google Play Gift Card":
        isValid = emailRegex.test(details);
        break;
      default:
        isValid = false;
        break;
    }

    if (!isValid) {
      // toast error
      socket.emit("toasts", {
        type: "error",
        message: `Invalid input.`,
      });
      return;
    }

    try {
      const email = socket.user.email;
      const userUid = socket.user.username;

      const success = await updateClaimedGiveawayDetails(
        selectedGift,
        details,
        userUid,
        giveawayId
      );
      // update database
      if (success) {
        socket.emit("toasts", {
          type: "success",
          message: "Reward claimed successfully!",
        });

        const payload = {
          giveawayId: giveawayId,
          key: "inProgress",
          value: true,
        };

        socket.emit("reward-claimed", payload);
      } else {
        console.log("Failed to claim reward.");
        socket.emit("toasts", {
          type: "error",
          message: "Failed to claim reward.",
        });
      }
    } catch (error) {
      console.log(error);
      socket.emit("toasts", {
        type: "error",
        message: "An unexpected error.",
      });
    }
  });

  socket.on("update-password", async (data, callback) => {
    try {
      const { currentPassword, newPassword } = data;
      const email = socket.user.email;
      const userUid = socket.user.username;

      const [rows] = await pool.execute(
        "SELECT password FROM users WHERE email = ? AND username = ?",
        [email, userUid]
      );

      if (rows.length === 0) {
        // User not found
        return callback({
          type: "error",
          message: "Something went wrong!",
        });
      }

      // verifiy password
      const currentHash = rows[0].password;
      const isPasswordCorrect = await argon2.verify(
        currentHash,
        currentPassword
      );
      // handle verification errors
      if (!isPasswordCorrect) {
        return callback({
          type: "wrong-password",
          message: "Incorrect password.",
        });
      }

      // Verify that the new password is not the same as the current password
      const isNewPasswordSame = await argon2.verify(currentHash, newPassword);
      if (isNewPasswordSame) {
        return callback({
          type: "error",
          message: "New password cannot be the same as the current password.",
        });
      }

      // Hash the new password
      const newHash = await argon2.hash(newPassword);

      // Update the password in the database
      const [updateResult] = await pool.execute(
        "UPDATE users SET password = ? WHERE email = ? AND username = ?",
        [newHash, email, userUid]
      );

      if (updateResult.affectedRows === 0) {
        // Update failed (unlikely but possible)
        return callback({
          type: "error",
          message: "Password update failed. Please try again.",
        });
      }
      // Emit a success response
      return callback({
        type: "success",
        message: "Password updated successfully.",
      });
    } catch (error) {
      console.error("Error in update-password:", error);

      // Log the error (optional)
      // Emit a generic error message
      return callback({
        type: "error",
        message: "An unexpected error occurred. Please try again.",
      });
    }
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

  //
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
    console.log("inside daily wallpapers");
    try {
      var today = new Date().toISOString().split("T")[0];
      const query = `SELECT * FROM wallpapers WHERE date(date) = ?`;
      const [rows] = await pool.execute(query, [today]);

      console.log(rows); // Check if rows contain the correct data

      const results = [];

      for (const row of rows) {
        const img_link = row.img_link;
        const average_color = row.average_color;
        console.log(img_link);

        // Apply your function to the img_link (replace `yourFunction` with your actual function)
        const signedUrl = await generateSignedUrl("wallpapers", img_link);

        // Create an object with the processed image and average_color
        const resultObject = {
          wallpaper_id: row.wallpaper_id,
          date: row.date,
          img_link: signedUrl, // Result of your function
          average_color: average_color, // Include the average_color
          downloads: row.downloads,
        };

        // Add the object to the results array
        results.push(resultObject);
      }

      socket.emit("daily-wallpapers", { result: results, date: today });
    } catch (error) {
      console.log("daily wallpaper error:");

      console.log(error);
    }
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
      console.log("coins:");

      console.log(gained_coins);
      console.log(user.coins);

      let db_coins = user.coins;
      // save coin
      console.log(db_coins);

      let new_coins_amount = db_coins + gained_coins;
      console.log(new_coins_amount);

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

async function checkCoins(email, consumedCoins) {
  try {
    const userDataQuery = `
  SELECT * FROM users WHERE email = ?
  `;
    const [userRows, userFields] = await pool.execute(userDataQuery, [email]);
    const user = userRows[0];

    if (user.coins >= consumedCoins) {
      const newCoinsAmount = user.coins - consumedCoins;

      const updateQuery = `
    UPDATE users SET coins = ? WHERE email = ?
    `;
      const [updateRows, updateFields] = await pool.execute(updateQuery, [
        newCoinsAmount,
        email,
      ]);

      if (updateRows.affectedRows > 0) {
        console.log(`Successfully updated coins for user with email ${email}`);

        return {
          type: "update",
          user: user,
          newCoinsAmount: newCoinsAmount,
        };
        // Handle success, emit events, etc.
      } else {
        console.log(
          `User with email ${email} not found or update did not occur`
        );
        // Handle case where no rows were updated
        return null;
      }
    } else {
      return {
        type: "failed",
        user: user,
      };
    }
  } catch (error) {
    console.log(error);
    return null;
  }
}

// async function consumeCoins(email, consumedCoins, userCoins) {
//   try {
//     const newCoinsAmount = userCoins - consumedCoins;

//     const updateQuery = `
//   UPDATE users SET coins = ? WHERE email = ?
//   `;
//     const [updateRows, updateFields] = await pool.execute(updateQuery, [
//       newCoinsAmount,
//       email,
//     ]);

//     if (updateRows.affectedRows > 0) {
//       console.log(`Successfully updated coins for user with email ${email}`);
//       result.update = true;
//       result.user = user;
//       result.newCoinsAmount = newCoinsAmount;

//       return {};
//       // Handle success, emit events, etc.
//     } else {
//       console.log(`User with email ${email} not found or update did not occur`);
//       // Handle case where no rows were updated
//       return {};
//     }
//   } catch (error) {}
// }

async function checkActiveGiveaway(giveawayId) {
  // do something
  try {
    const query = `
  SELECT EXISTS(SELECT 1 FROM giveaways WHERE id = ? AND status = 'active') AS isActive;
  `;

    const [rows, fields] = await pool.execute(query, [giveawayId]);

    if (rows[0]) {
      return rows[0].isActive;
    }
  } catch (error) {
    console.log(error);
  }
}

async function checkIfUserExistsInParticipants(userUid, giveawayId) {
  try {
    const query = `
    SELECT 
    EXISTS (
        SELECT 
            1
        FROM 
            participants
        WHERE 
            userUid = ?
            AND giveawayId = ?
    ) AS user_exists;
    `;

    const [rows, fields] = await pool.execute(query, [userUid, giveawayId]);

    if (rows[0]) {
      return rows[0].user_exists;
    }
  } catch (error) {
    console.log(error);
    console.error("Error checking if user exists in participants: ", error);
  }
}

async function getActiveGiveaway(type) {
  try {
    const query = `
      SELECT
          id, date, status, type
      FROM
          giveaways g
      WHERE
          g.status = 'active' AND g.type = ?;
    `;

    const [rows, fields] = await pool.execute(query, [type]);
    const giveawayRow = rows[0];

    return giveawayRow; // Return the fetched row
  } catch (error) {
    console.error("Error fetching active giveaway: ", error);
    throw error; // Re-throw the error if you want to handle it further up the call stack
  }
}
// TODO
async function checkIfUserIsParticipant(giveawayId, userUid) {
  try {
    const query = `
    SELECT 
    EXISTS (
        SELECT 1
        FROM participants p
        WHERE p.giveawayId = ? 
          AND p.userUid = ?
    ) AS isParticipant;
    `;

    const [rows, fields] = await pool.execute(query, [giveawayId, userUid]);
    return rows[0].isParticipant;
  } catch (error) {
    console.error("Error checking if user is participant: ", error);
    throw error;
  }
}

async function checkIfGiveawayExixts(giveawayId, type) {
  try {
    const query = `
      SELECT EXISTS(
      SELECT 1 
      FROM giveaways
      WHERE id = ? 
        AND status = 'active' 
        AND type = ?
      ) AS exist;
    `;
    const [rows, fields] = await pool.execute(query, [giveawayId, type]);

    return rows[0];
  } catch (error) {
    console.error("Error checking if giveaway exists: ", error);
    throw error;
  }
}

async function getAllParticipants(type) {
  try {
    const query = `
      SELECT 
        p.userUid,
        p.date
      FROM 
        participants p
      JOIN 
        giveaways g ON p.giveawayId = g.id
      WHERE 
        g.status = 'active' 
      AND g.type = ?;
    `;

    const [rows, fields] = await pool.execute(query, [type]);

    const giveawayId = await getActiveGiveaway(type);

    return {
      participants: rows,
      giveawayId: giveawayId,
    };
  } catch (error) {
    console.error(
      "Error fetching all participants in active giveaway: ",
      error
    );
    throw error;
  }
}

async function getCurrentParticipants(totalParticipants, type) {
  try {
    const offsetValue = parseInt(totalParticipants, 10) || 0;
    const query = `
      SELECT 
        p.userUid,
        p.date
      FROM 
        participants p
      JOIN 
        giveaways g ON p.giveawayId = g.id
      WHERE 
        g.status = 'active' 
        AND g.type = ?
      ORDER BY 
        p.date ASC
      LIMIT 100000000 OFFSET ${offsetValue};
      `;

    const [rows, fields] = await pool.execute(query, [type]);

    return rows;
  } catch (error) {
    console.error(
      "Error fetching current participants in active giveaway: ",
      error
    );
    throw error;
  }
}

async function getHistoryGiveaways(email, offset) {
  // console.log("this is offset from client: ", offset, typeof offset);
  // console.log(
  //   "this is new new offset from client: ",
  //   parseInt(offset, 10),
  //   typeof parseInt(offset, 10)
  // );

  try {
    const offsetValue = parseInt(offset, 10) || 0;

    const query = `
    SELECT 
    g.id AS giveawayId,
    g.date,
    g.type,
    g.reward_value_usd,
    p.winner,
    p.received,
    p.inProgress,
      (
          SELECT JSON_ARRAYAGG(
              JSON_OBJECT(
                  'id', p.id,
                  'userId', p.userUid,
                  'joinDate', p.date,
                  'winner', p.winner,
                  'received', p.received
              )
          )
          FROM participants p
          WHERE p.giveawayId = g.id AND p.winner = 1
      ) AS winners,
      (
          SELECT COUNT(*) 
          FROM participants p_all
          WHERE p_all.giveawayId = g.id
      ) AS totalParticipants
    FROM 
        giveaways g
    JOIN participants p ON g.id = p.giveawayId
    JOIN users u ON p.userUid = u.username
    WHERE 
        g.status = 'ended'
        AND u.email = ?
    ORDER BY 
        g.date ASC  
    LIMIT 100000000 OFFSET ${offsetValue};  
    `;
    console.log("console: ", email, typeof email, offsetValue);

    const [rows, fields] = await pool.execute(query, [email]);
    return rows;
  } catch (error) {
    console.error("Error fetching history giveaways: ", error);
    throw error;
  }
}

async function updateClaimedGiveawayDetails(
  selectedGift,
  details,
  userUid,
  giveawayId
) {
  try {
    const query = `
  UPDATE participants 
       SET inProgress = true, 
           selectedGift = ?, 
           details = ? 
       WHERE userUid = ? 
         AND giveawayId = ?
  `;
    const [rows, fields] = await pool.execute(query, [
      selectedGift,
      details,
      userUid,
      giveawayId,
    ]);

    if (rows.affectedRows > 0) {
      return true; // Update was successful
    } else {
      return false; // No rows were updated
    }
  } catch (error) {
    console.error("Error updating claimed giveaway details: ", error);
    throw error;
  }
}

async function fetchUserFromDB(email) {
  try {
    const query = `
  SELECT firstname,lastname, email, username, coins FROM users WHERE email = ?
  `;
    const [rows] = await pool.execute(query, [email]);
    return rows[0];
  } catch (error) {
    console.error("Error fetching user data: ", error);
    throw error;
  }
}

// General verification function
function verifyPayload(payload, schema) {
  if (payload === undefined) {
    console.error("Payload is undefined.");
    return false;
  }

  // Iterate through the schema keys to validate the corresponding values in the payload
  for (const key in schema) {
    if (!schema.hasOwnProperty(key)) continue;

    const rule = schema[key];
    const value = payload[key];

    // Check if the value is missing
    if (rule.required && value === undefined) {
      console.error(`Missing required key: ${key}`);
      return false;
    }

    // Check the type
    if (value !== undefined && typeof value !== rule.type) {
      console.error(
        `Invalid type for key: ${key}. Expected ${
          rule.type
        }, got ${typeof value}`
      );
      return false;
    }

    // Perform any additional validation for specific types
    if (rule.allowedValues && !rule.allowedValues.includes(value)) {
      console.error(
        `Invalid value for key: ${key}. Allowed values: ${rule.allowedValues.join(
          ", "
        )}`
      );
      return false;
    }

    // Add any other validation checks based on the rule
    if (rule.type === "string") {
      // Check string length
      if (rule.minLength && value.length < rule.minLength) {
        console.error(
          `String for key: ${key} is too short. Minimum length: ${rule.minLength}`
        );
        return false;
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        console.error(
          `String for key: ${key} is too long. Maximum length: ${rule.maxLength}`
        );
        return false;
      }
    }

    if (rule.type === "number") {
      if (rule.min !== undefined && value < rule.min) {
        console.error(
          `Value for key: ${key} is too low. Minimum value: ${rule.min}`
        );
        return false;
      }
      if (rule.max !== undefined && value > rule.max) {
        console.error(
          `Value for key: ${key} is too high. Maximum value: ${rule.max}`
        );
        return false;
      }
    }

    // For example: range for numbers, regex for strings, etc.
    if (rule.regex && !rule.regex.test(value)) {
      console.error(`Invalid format for key: ${key}. Value: ${value}`);
      return false;
    }
  }
  return true; // If everything passes, return true
}
