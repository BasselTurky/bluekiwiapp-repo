const express = require("express");
const app = express();
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");

const argon2 = require("argon2");
const emailValidator = require("deep-email-validator");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const request = require("request");
const multer = require("multer");
const rateLimit = require("express-rate-limit");

const { OAuth2Client } = require("google-auth-library");

const clientId = process.env.GOOGLE_CLIENT_ID;

const client = new OAuth2Client(clientId);

const pool = require("./database");
const {
  createVerificationEmail,
} = require("./functions/createVerificationEmail");
const { createOtpEmail } = require("./functions/createOtpEmail");
const { createResetPassEmail } = require("./functions/createResetPassEmail");
const {
  createGoogleUniqePassEmail,
} = require("./functions/createGoogleUniqePassEmail");
// Environment variables
const port = process.env.SERVER_PORT;

const server_email = process.env.SERVER_EMAIL;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  cors({
    origin: "*",
  })
);
// app.use(express.static(path.join(__dirname, "public")));
app.set("view-engine", "ejs");

app.get("/auth", (req, res) => {
  res.send(`Hello, this is authentication server running on port ${port}`);
});

app.listen(port, () => console.log(`Server running on port ${port}`));

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

//....................................nodemailer setup.....................................

// const transporter = nodemailer.createTransport({
//   host: "smtp.gmail.com",
//   port: 465,
//   auth: {
//     user: "bluekiwiapp@gmail.com",
//     pass: "neli ljrj vpya lyhy",
//   },
//   secure: true,
// });
const transporter = nodemailer.createTransport({
  host: "smtp-mail.outlook.com",
  port: 587, // SMTP port
  secure: false, // Use TLS
  auth: {
    user: "bluekiwiappSMTP01@outlook.com", // Your Outlook account
    pass: "owjzkqpoguenmkbc", // Your Outlook password or app password
  },
});

// const transporter = nodemailer.createTransport({
//   // service: "Hotmail",
//   name: "smtp-gmail.outlook.com",
//   host: "smtp-mail.outlook.com",
//   // port: 587,
//   auth: {
//     user: process.env.SERVER_EMAIL,
//     pass: process.env.TRANSPORTER_EMAIL_PASS,
//   },
//   tls: {
//     rejectUnauthorized: false,
//   },
// });
// app.get("/auth/delete-form-view", (req, res) => {
//   res.sendFile(path.join(__dirname, "public", "index.html"));
// });
app.use(
  "/auth/delete-form-view",
  express.static(path.join(__dirname, "public"))
);

app.post("/auth/delete-form", async (req, res) => {
  try {
    console.log(req.body);
    res.send("Form data received successfully!");
  } catch (error) {
    console.log(error);
    res.send("Form data not received");
  }
  // get the data
});
// used - Register

async function getRandomAvailableDiscriminator(name) {
  const query = `
  SELECT discriminator FROM users WHERE name = ?
  `;

  const [rows] = await pool.execute(query, [name]);
  const discriminatorsInDatabase = rows.map((row) => row.discriminator);

  const allDiscriminators = Array.from({ length: 9999 }, (_, i) => i + 1);
  const takenDiscriminators = new Set(discriminatorsInDatabase); // Result from SQL query
  const availableArray = allDiscriminators.filter(
    (d) => !takenDiscriminators.has(d)
  );

  if (availableArray.length === 0) {
    console.log("No discriminators available, user must select a new name.");
    return {
      success: false,
    };
  } else {
    const randomDiscriminator =
      availableArray[Math.floor(Math.random() * availableArray.length)];
    console.log("Random available discriminator:", randomDiscriminator);
    return {
      success: true,
      discriminator: randomDiscriminator,
    };
  }
}

function generateDiscriminator(length = 6) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

function createBasename(firstname, lastname) {
  function capitalizeName(name) {
    const lowerCaseName = name.toLowerCase();
    return lowerCaseName.charAt(0).toUpperCase() + lowerCaseName.slice(1);
  }

  const capitalizedFirstname = capitalizeName(firstname);
  const shortenedLastname =
    lastname.charAt(0).toUpperCase() + lastname.charAt(1).toLowerCase();
  const basename = capitalizedFirstname + "-" + shortenedLastname;

  return basename;
}

async function createUsername(basename) {
  // Step 1: Fetch existing discriminators from the database
  const [rows] = await pool.execute(
    `SELECT discriminator FROM users WHERE basename = ?`,
    [basename]
  );

  // Step 2: Convert discriminators to a Set for quick lookup
  const existingDiscriminators = new Set(rows.map((row) => row.discriminator));

  let attempts = 50;

  // Step 3: Generate unique discriminator
  while (attempts > 0) {
    const discriminator = generateDiscriminator(6);

    if (!existingDiscriminators.has(discriminator)) {
      const username = `${basename}#${discriminator}`;

      return { username, discriminator }; // Success
    }

    attempts--;
  }

  throw new Error("Unable to generate a unique username. Please try again.");
}

// add rate limiter : to do

app.post("/auth/signup-data", async (req, res) => {
  const { firstname, lastname, email, password } = req.body;
  console.log("firstname: ", firstname);
  console.log("lastname: ", lastname);

  try {
    // Validate email
    const emailValidationResults = await emailValidator.validate({
      email: email,
      validateSMTP: false,
    });

    if (!emailValidationResults.valid) {
      return res.status(400).json({ message: "Invalid email address." });
    }

    // Check if email already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: "Email is already taken." });
    }

    // Generate base name and username
    const basename = createBasename(firstname, lastname);
    console.log("basename: ", basename);

    const { username, discriminator } = createUsername(basename);

    // Hash the password
    const hashedPassword = await argon2.hash(password);
    console.log("username: ", username);

    // Create user object
    const newUser = {
      firstname,
      lastname,
      basename,
      discriminator,
      username,
      email,
      password: hashedPassword,
    };

    // Generate JWT for email verification
    const token = jwt.sign({ data: newUser }, process.env.JWT_SECRET, {
      expiresIn: 600, // 10 minutes
    });
    // console.log(transporter);

    // Construct verification email
    const verificationUrl = `https://bluekiwiapp.com/auth/verify/${token}`;
    const mailOptions = {
      from: `bluekiwiappSMTP01@outlook.com`,
      // from: `Blue Kiwi <info@bluekiwiapp.com>`,
      to: email,
      subject: "Verification email",
      html: createVerificationEmail(verificationUrl),
    };

    // Send verification email
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Email sending failed:", error);
        return res.status(500).json({
          message: "Error sending verification email. Please try again later.",
        });
      }

      return res.status(200).json({
        message: `Verification email sent to: ${email}. Please check your inbox.`,
      });
    });
  } catch (error) {
    console.error("Error during signup:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

app.get("/auth/verify/:token", async (req, res) => {
  try {
    // Verify JWT token
    const decoded = jwt.verify(req.params.token, process.env.JWT_SECRET);

    const {
      firstname,
      lastname,
      basename,
      discriminator,
      username,
      email,
      password,
    } = decoded.data;

    // Check if the user is already verified
    const userCheckQuery = `SELECT * FROM users WHERE email = ?`;
    const [existingUser] = await pool.query(userCheckQuery, [email]);

    if (existingUser.length > 0) {
      console.log("Already verified");
      return res.render("verified.ejs");
    }

    // Insert new user into the database
    const insertUserQuery = `
      INSERT INTO users (firstname, lastname, basename, discriminator, username, email, password)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await pool.query(insertUserQuery, [
      firstname,
      lastname,
      basename,
      discriminator,
      username,
      email,
      password,
    ]);

    console.log("User successfully verified and added to the database.");
    return res.render("verified.ejs");
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      console.error("Verification link expired:", error.message);
      return res.send(
        "<h1>Verification link expired, please register again</h1>"
      );
    }

    console.error("Error during verification:", error.message);
    return res.send(
      "<h1>An error occurred during verification. Please try again later.</h1>"
    );
  }
});

async function findUser(email) {
  const query = `
  SELECT * FROM users WHERE email = ?
  `;

  const [rows] = await pool.execute(query, [email]);

  if (rows) {
    return rows[0];
  } else {
    return null;
  }
}

async function validPassword(user, password) {
  return await argon2.verify(user.password, password);
}

function generateAccessToken(user) {
  return jwt.sign(
    { username: user.username, email: user.email },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "15m" }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { username: user.username, email: user.email },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" }
  );
}

async function storeRefreshTokenInDB(refreshToken, email) {
  const query = `
  UPDATE users SET refreshToken = ? WHERE email = ?
  `;

  const [rows] = await pool.execute(query, [refreshToken, email]);

  if (rows.affectedRows > 0) {
    return;
  } else {
    throw new Error("Failed to store refresh token");
  }
}

app.post("/auth/login-data", async (req, res) => {
  const { email, password } = req.body;

  console.log("got email and password", email, " ", password);

  // Get email from database if available
  try {
    const user = await findUser(email);

    if (!user || !(await validPassword(user, password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    console.log("all good");

    // Create access token
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // store refresh token for user with email = email

    // TODO encrypt token before storing it

    // #region Encryption and Decryption Functions
    /*
      npm install crypto

      const ENCRYPTION_KEY = process.env.REFRESH_TOKEN_ENCRYPTION_KEY;  // Must be 32 bytes
      const IV_LENGTH = 16; // For AES, this is always 16

      const crypto = require('crypto');

      function encryptToken(token) {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
        let encrypted = cipher.update(token);

        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
      }

      function decryptToken(encryptedToken) {
        let parts = encryptedToken.split(':');
        let iv = Buffer.from(parts.shift(), 'hex');
        let encryptedText = Buffer.from(parts.join(':'), 'hex');
        let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
        let decrypted = decipher.update(encryptedText);
      
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
      }
    */
    // #endregion

    await storeRefreshTokenInDB(refreshToken, email);
    console.log(`
      sending tokens to user:

      ${accessToken},

      ${refreshToken}
      `);

    return res.status(200).send({ accessToken, refreshToken });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ----

app.post("/auth/logErrors", async (req, res) => {
  const error = req.body.error;
  console.log("FrontEnd Error: ", error);
});

async function findUserByEmail(email) {
  const query = `SELECT * FROM users WHERE email = ?`;
  const [rows] = await pool.execute(query, [email]);
  return rows.length > 0 ? rows[0] : null;
}

async function findUserByGoogleId(googleId) {
  const query = `SELECT * FROM users WHERE googleid = ?`;
  const [rows] = await pool.execute(query, [googleId]);
  return rows.length > 0 ? rows[0] : null;
}
// TODO HERE

async function updateGoogleIdForUser(email, googleId) {
  const query = `UPDATE users SET googleid = ? WHERE email = ?`;
  await pool.execute(query, [googleId, email]);
}

function splitName(fullname) {
  const [firstname, lastname] = fullname.split(" ");
  return { firstname, lastname };
}
// TODO
function createBasenameForGoogle(firstname, lastname) {
  const adjectives = [
    "Awesome",
    "Bright",
    "Cheerful",
    "Clever",
    "Creative",
    "Delightful",
    "Energetic",
    "Friendly",
    "Happy",
    "Incredible",
    "Joyful",
    "Kind",
    "Lively",
    "Magical",
    "Nice",
    "Optimistic",
    "Playful",
    "Radiant",
    "Smart",
    "Sunny",
    "Talented",
    "Unique",
    "Vibrant",
    "Warm",
    "Zesty",
  ];

  const nouns = [
    "Star",
    "Sunshine",
    "Rainbow",
    "Butterfly",
    "Kitten",
    "Puppy",
    "Flower",
    "Gem",
    "Cloud",
    "Dream",
    "Wave",
    "Peach",
    "Tree",
    "Meadow",
    "River",
    "Moon",
    "Lighthouse",
    "Forest",
    "Spark",
    "Wish",
    "Petal",
    "Blossom",
    "Ocean",
    "Dove",
    "Aurora",
  ];

  function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  function cleanAndProcessName(name, isFirstname) {
    const cleanedName = name.replace(/[^a-zA-Z]/g, ""); // Remove non-alphabetical characters
    if (cleanedName.length === 0) {
      return isFirstname
        ? getRandomElement(adjectives)
        : getRandomElement(nouns);
    }
    return (
      cleanedName.charAt(0).toUpperCase() + cleanedName.slice(1).toLowerCase()
    );
  }

  const processedFirstname = cleanAndProcessName(firstname, true);
  const processedLastname = cleanAndProcessName(lastname, false);
  const processedLastnameLastChar = processedLastname.charAt(0);
  const basename = `${processedFirstname}-${processedLastnameLastChar}`;
  return { basename, processedFirstname, processedLastname };
}

async function createUserWithGoogleId({ fullname, email, googleId }) {
  // const { uniqueId, discriminator } = await generateUniqueId(name);

  const { firstname, lastname } = splitName(fullname);
  const { basename, newFirstname, newLastname } = createBasenameForGoogle(
    firstname,
    lastname
  );

  const { username, discriminator } = createUsername(basename);

  // const basename = createBasename(firstname, lastname);
  // const { username, discriminator } = createUsername(basename);

  const uniqePassword = generatePassword();
  const hashedPassword = await argon2.hash(uniqePassword, 10);

  const query = `INSERT INTO users (firstname, lastname, basename, discriminator, username, email, password, googleId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  await pool.execute(query, [
    newFirstname,
    newLastname,
    basename,
    discriminator,
    username,
    email,
    hashedPassword,
    googleId,
  ]);

  const mailOptions = {
    // "invite.me.application@hotmail.com"
    from: `"Blue Kiwi App" <${process.env.SERVER_EMAIL}>`,
    to: email,
    subject: "Your Access Password",
    html: createGoogleUniqePassEmail(uniqePassword),
  };

  transporter.sendMail(mailOptions, function (error, info) {});
}

app.post("/auth/sign-google-idToken", async (req, res) => {
  try {
    const idToken = req.body.idToken;

    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: clientId,
    });

    const payload = ticket.getPayload();
    const googleId = payload.sub;
    const email = payload.email;
    const fullname = payload.name;

    let user = await findUserByGoogleId(googleId);
    if (!user) {
      user = await findUserByEmail(email);

      if (!user) {
        await createUserWithGoogleId({ fullname, email, googleId });
        user = await findUserByEmail(email);
      } else if (user.email === email && !user.googleId) {
        await updateGoogleIdForUser(email, googleId);
      } else if (user.email === email && user.googleId !== googleId) {
        return res.status(400).json({
          message:
            "This email is already linked to a different Google account. Please use the correct account.",
        });
      }
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    await storeRefreshTokenInDB(refreshToken, user.email);

    return res.status(200).json({ accessToken, refreshToken });
  } catch (error) {
    console.error("Google sign-in error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/auth/refreshToken", async (req, res) => {
  const refreshToken = req.body.refreshToken;

  if (!refreshToken) {
    return res.status(400).json({ message: "No refresh token provided" });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    const query = `SELECT refreshToken FROM users WHERE email = ?`;

    const [rows] = await pool.execute(query, [decoded.email]);

    if (!rows.length || rows[0].refreshToken !== refreshToken) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }
    const user = { username: decoded.username, email: decoded.email };
    const accessToken = generateAccessToken(user);
    //TODO
    return res.status(200).json({ accessToken });
  } catch (error) {
    console.error("Refresh token verification failed", error);
    return res
      .status(403)
      .json({ message: "Refresh token is invalid or expired" });
  }
});

app.post(`/auth/verify-otp`, async (req, res) => {
  let otp_token = req.body.otp_token;
  let otpInput = req.body.otpInput;
  let device_id = req.body.device_id;

  try {
    jwt.verify(otp_token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        console.log(err, "line 312");
        return res.send({ type: "expired", message: "Code expired." });
      }

      let decoded_otp = decoded.otp;
      let email = decoded.email;
      let uid = decoded.uid;

      if (decoded_otp === otpInput) {
        // verified

        await pool.query(
          `UPDATE users  SET device_id = '${device_id}' WHERE email = '${email}'`
        );

        const token = jwt.sign(
          { email: email, device_id: device_id, uid: uid },
          process.env.JWT_SECRET,
          {
            expiresIn: 2592000,
          }
        );

        return res.send({ type: "verified", token: token });
      } else {
        // try again
        return res.send({ type: "failed", message: "Try again." });
      }
    });
  } catch (error) {
    console.log(error);
    return res.send({ type: "error", message: "ErrorID: E010" });
  }
});

// If user has session:
// check session token

app.post("/auth/check-token", async (req, res) => {
  // check if token expired or wrong device
  try {
    let token = req.body.token;
    let check_result = await checkToken(token);

    if (check_result.boolean) {
      return res.json("pass");
    } else {
      return res.json("error");
    }
  } catch (error) {
    return res.json("error");
  }
});

// Create refresh token

app.post("/auth/refresh-token", async (req, res) => {
  try {
    let token = req.body.token;
    let check_result = await checkToken(token);

    if (check_result.boolean) {
      let email = check_result.email;
      let uid = check_result.uid;

      const token = jwt.sign(
        { email: email, uid: uid },
        process.env.JWT_SECRET,
        {
          expiresIn: 2592000,
        }
      );

      return res.send({ type: "pass", token: token });
    } else {
      return res.send({ type: "expired", message: "Session expired." });
    }
  } catch (error) {
    return res.send({ type: "error", message: "Session expired." });
  }
});

app.post("/auth/reset-password-data", async (req, res) => {
  try {
    const email = req.body.email;

    const result = await pool.query(
      `SELECT email FROM users WHERE email = '${email}'`
    );

    let resultArray = Object.values(JSON.parse(JSON.stringify(result)));

    if (!resultArray.length) {
      return res.send({ type: "error", message: "Email doesn't exist" });
    } else {
      var obj = { email: email };

      const token = jwt.sign({ data: obj }, process.env.JWT_SECRET, {
        expiresIn: 600,
      });
      let url = `https://bluekiwiapp.com/auth/new-password/${token}`;
      const mailOptions = {
        from: process.env.SERVER_EMAIL,
        to: email,
        subject: "Reset password",
        html: createResetPassEmail(url),
      };

      transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
          console.log(error);
          return res.send({
            type: "error",
            message: "ErrorID: E018",
          });
        } else {
          return res.send({
            type: "success",
            message: `Email sent to: ${email}, please check all mails`,
          });
        }
      });
    }
  } catch (error) {
    console.log("Error line 459: ", error);
    return res.send({ type: "error", message: "ErrorID: E017" });
  }
});

app.get("/auth/new-password/:token", (req, res) => {
  try {
    jwt.verify(req.params.token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.send(
          "<h1>Verification link expired, please register again</h1>"
        );
      } else {
        return res.render("newPassword.ejs", {
          email: decoded.data.email,
          message: "Enter your new password.",
        });
      }
    });
  } catch (error) {
    console.log("Error L482: ", error);
    return res.send("<h1>Something went wrong!</h1>");
  }
});

app.post("/auth/reset-password", async (req, res) => {
  try {
    const email = req.body.email;
    const password = req.body.password;
    const hashedPassword = await argon2.hash(password, 10);

    const result = await pool.query(
      `UPDATE users SET password = '${hashedPassword}' WHERE email = '${email}'`
    );

    // req.flash("loginMessage", "Password updated.");
    return res.send("<h1>Password updated successfully</h1>");
    // edit
  } catch (error) {
    console.log("Error L504: ", error);
    return res.send("<h1>Something went wrong!</h1>");
  }
});

app.post("/auth/user", async (req, res) => {
  try {
    let token = req.body.token;
    let check_result = await checkToken(token);
    console.log(check_result);
    if (check_result.boolean) {
      let email = check_result.email;
      const result = await pool.query(
        `SELECT name, email, device_id, uid, coins FROM users WHERE email = '${email}'`
      );

      return res.send({ type: "success", userInfo: result[0] });
    } else {
      return res.send({ type: "expired" });
    }
  } catch (error) {
    console.log(error);

    return res.send({ type: "error", message: "ErrorID: E021" });
  }
});
// not required
// app.post("/auth/update-paypal", async (req, res) => {
//   try {
//     let current_device_id = req.body.current_device_id;
//     let email = req.body.email;
//     let paypal = req.body.paypal;
//     let password = req.body.password;

//     const queryResults = await pool.query(
//       `SELECT * FROM users WHERE email = '${email}'`
//     );

//     const results = Object.values(JSON.parse(JSON.stringify(queryResults)));

//     let user = results[0];

//     if (!(await check_device_id(email, current_device_id))) {
//       // wrong device
//       return res.send({ type: "wrong-device" });
//       // force logout
//     } else if (!(await argon2.verify(user.password, password))) {
//       // wrong password
//       return res.send({ type: "wrong-password", message: "Wrong password!" });
//     } else {
//       // update paypal

//       await pool.query(
//         `UPDATE users SET paypal = '${paypal}' WHERE email = '${email}'`
//       );

//       const queryUserData = await pool.query(
//         `SELECT * FROM users WHERE email = '${email}'`
//       );

//       const result = Object.values(JSON.parse(JSON.stringify(queryUserData)));

//       let new_user_data = result[0];

//       return res.send({
//         type: "success",
//         message: "Paypal username updated",
//         userData: new_user_data,
//       });

//       // update userData state
//     }
//   } catch (error) {
//     console.log(error);

//     return res.send({ type: "error", message: "Something went wrong!" });
//   }
// });

app.post("/auth/update-password", async (req, res) => {
  try {
    // let email = req.body.email;
    // let current_device_id = req.body.current_device_id;
    let token = req.body.token;
    let currentPassword = req.body.currentPassword;
    let newPassword = req.body.newPassword;

    let check_result = await check_device_id_from_token(token);

    if (check_result.boolean) {
      let email = check_result.email;

      const queryResults = await pool.query(
        `SELECT * FROM users WHERE email = '${email}'`
      );

      const results = Object.values(JSON.parse(JSON.stringify(queryResults)));

      let user = results[0];

      if (!(await argon2.verify(user.password, currentPassword))) {
        // wrong password
        return res.send({ type: "wrong-password", message: "Wrong password!" });
      }

      const hashedPassword = await argon2.hash(newPassword, 10);

      await pool.query(
        `UPDATE users SET password = '${hashedPassword}' WHERE email = '${email}'`
      );

      return res.send({
        type: "success",
        message: "Password updated",
      });
    }
  } catch (error) {
    console.log(error);

    return res.send({ type: "error", message: "ErrorID: E031" });
  }
});

app.post("/auth/account-delete-request", async (req, res) => {
  try {
    let token = req.body.token;
    let password = req.body.password;
    let check_result = await check_device_id_from_token(token);
    if (check_result.boolean) {
      // check password

      let email = check_result.email;

      const queryResults = await pool.query(
        `SELECT password FROM users WHERE email = '${email}'`
      );

      const results = Object.values(JSON.parse(JSON.stringify(queryResults)));

      const db_password = results[0].password;

      if (!(await argon2.verify(db_password, password))) {
        return res.send({
          type: "incorrect",
          message: "Incorrect password.",
        });
      } else {
        let result = await pool.query(
          `DELETE FROM users WHERE email = '${email}'`
        );
        return res.send({ type: "success" });
      }

      // get current date
      // on client side:
      // wait for success response
      // force logout
      // to do
      // delete all data related to primary key email
    } else {
      return res.send({ type: "wrong-device" });
    }
  } catch (error) {
    console.log(error);
    return res.send({ type: "error", message: "ErrorID: E027" });
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
async function checkToken(token) {
  try {
    let decoded = jwt.verify(token, process.env.JWT_SECRET);
    let email = decoded.email;
    let uid = decoded.uid;
    return { boolean: true, email: email, uid: uid };
  } catch (error) {
    if (error.name === "JsonWebTokenError" && error.message === "jwt expired") {
      // Token has expired
      console.error("Token has expired");
      // You can handle the expiration as needed, such as forcing the user to log in again
    } else {
      // Other JWT verification errors
      console.error("JWT verification error:", error.message);
      // You can handle other JWT verification errors here.
    }
    return { boolean: false };
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

function verification_code(length) {
  var result = "";
  var characters = "0123456789";
  // var characters =
  //   "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

const verifyGoogleToken = async (googleIdToken) => {
  try {
    // const ticket = await client.verifyIdToken({
    //   idToken: googleIdToken,
    //   audience: clientId,
    // });
    let ticket;

    try {
      ticket = await client.verifyIdToken({
        idToken: googleIdToken,
        audience: clientId, // Replace YOUR_CLIENT_ID with your actual client ID
      });
    } catch (error) {
      if (error.message && error.message.includes("Token used too late")) {
        console.log("Google token expired. Please sign in again.");
        return res
          .status(401)
          .json({ error: "Google token expired. Please sign in again." });
      } else {
        throw error; // Re-throw the error for other types of errors
      }
    }

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
    return { userId, email, name };
  } catch (error) {
    console.error("Error verifying Google token:", error);
    // throw new Error("Invalid Google token");
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

function generatePassword() {
  const uppercaseLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercaseLetters = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "~`!@#$%^&*()_-+={[}]|:;\"'<,>.?/";

  const allCharacters = uppercaseLetters + lowercaseLetters + numbers;
  //  + symbols;

  let password = "";
  for (let i = 0; i < 16; i++) {
    const randomIndex = Math.floor(Math.random() * allCharacters.length);
    password += allCharacters.charAt(randomIndex);
  }

  return password;
}

// old check for token -----

// try {
//   let token = req.body.token;

//   jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
//     if (err) {
//       return res.json("expired");
//     }

//     let email = decoded.email;
//     let device_id = decoded.device_id;

//     const db_device_id_query = await pool.query(
//       `SELECT * FROM users WHERE email='${email}'`
//     );

//     const results = Object.values(
//       JSON.parse(JSON.stringify(db_device_id_query))
//     );

//     const db_device_id = results[0].device_id;

//     if (device_id === db_device_id) {
//       return res.json("pass");
//     } else {
//       return res.json("wrong-device");
//     }
//   });
// } catch (error) {
//   console.log(error);

//   return res.json("error");
// }

//-------------------

// old refresh token

// try {

//   jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
//     if (err) {
//       return res.send({ type: "expired", message: "Token expired." });
//     }

//     let email = decoded.email;
//     let device_id = decoded.device_id;

//     const token = jwt.sign(
//       { email: email, device_id: device_id },
//       process.env.JWT_SECRET,
//       {
//         expiresIn: 2592000,
//       }
//     );

//     return res.send({ type: "pass", token: token });
//   });
// } catch (error) {
//   console.log("Error line 399: ", error);
//   return res.send({ type: "error", message: "Something went wrong!" });
// }

// ----------------

// old auth/user

// try {
//   let token = req.body.token;

//   jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
//     if (err) {
//       return res.send({ type: "expired" });
//     } else {
//       let email = decoded.email;
//       let device_id = decoded.device_id;

//       if (!(await check_device_id(email, device_id))) {
//         return res.send({ type: "wrong-device" });
//       }

//       const result = await pool.query(
//         `SELECT name, email, device_id, coins, wallpaper_api, animated_api, image_api, cities_guide_api, tasks_note, giveaways FROM users WHERE email = '${email}'`
//       );

//       return res.send({ type: "success", userInfo: result[0] });
//     }
//   });
// } catch (error) {
//   console.log("Error L524 : ", error);
//   return res.send({ type: "error" });
// }

// old update password

// const queryResults = await pool.query(
//   `SELECT * FROM users WHERE email = '${email}'`
// );

// const results = Object.values(JSON.parse(JSON.stringify(queryResults)));

// let user = results[0];

// if (!(await check_device_id(email, current_device_id))) {
//   // wrong device
//   return res.send({ type: "wrong-device" });
//   // force logout
// } else if (!(await argon2.verify(user.password, currentPassword))) {
//   // wrong password
//   return res.send({ type: "wrong-password", message: "Wrong password!" });
// } else {

// }

// Checking if Google ID exists
// const googleIdExists = await checkIfExistsInDB('googleid', googleId, 'googleidExists');

// // Checking if Email exists
// const emailExists = await checkIfExistsInDB('email', email, 'emailExists');

// if(!googleIdExists){
//   //
// }
// if (!check_googleid[0].googleidExists) {
//   // if (!results.length) {
//   // if not, check if email exists

//   const check_email = await pool.query(
//     `SELECT EXISTS (SELECT 1 FROM users WHERE email = '${email}') AS emailExists`
//   );
//   console.log("check_email: ", check_email);
//   if (check_email[0].emailExists) {
//     // if true, add googleid to this email

//     // a user with registeredd account : has email/password
//     // now add google id to this account
//     await pool.query(
//       `UPDATE users SET googleid = ${googleid} WHERE email = '${email}'`
//     );
//   } else {
//     // new user, fisrt time login with GoogleSignin

//     // if not, add new user
//     let set = new Set(Array.from({ length: 9999 }, (_, i) => i + 1));
//     // check if name exists
//     const discriminatorQuery = await pool.query(
//       `SELECT discriminator FROM users WHERE name = '${name}'`
//     );
//     const discriminatorResult = Object.values(
//       JSON.parse(JSON.stringify(discriminatorQuery))
//     ); // array of objects
//     // extract discriminators from query
//     const discriminatorArray = discriminatorResult.map(
//       (result) => result.discriminator
//     );
//     // check if any discriminators are taken : for example Bassel#2224, Bassel#4852, Bassel#9983
//     if (discriminatorArray.length > 0) {
//       // delete existed discriminators from the Set
//       for (let i = 0; i < discriminatorArray.length; i++) {
//         set.delete(discriminatorArray[i]);
//       }
//     }
//     // select random number from Set
//     const availableDiscriminators = Array.from(set);
//     // check if all discriminators are taken
//     const randomIndex = Math.floor(
//       Math.random() * availableDiscriminators.length
//     );
//     const randomNumber = availableDiscriminators[randomIndex];
//     const paddedNumber = randomNumber.toString().padStart(4, "0");

//     const uniqueId = name + "#" + paddedNumber;

//
//     // and send it to the user in an email

//     const uniqePassword = generatePassword();
//     const hashedPassword = await argon2.hash(uniqePassword, 10);

//     const queryResult = await pool.query(
//       `INSERT INTO users (name, discriminator, uid, email, googleid, password) VALUES ('${name}','${paddedNumber}','${uniqueId}','${email}',${googleid},'${hashedPassword}')`
//     );

//     const mailOptions = {
//       // "invite.me.application@hotmail.com"
//       from: `"Blue Kiwi App" <${process.env.SERVER_EMAIL}>`,
//       to: email,
//       subject: "Your Access Password",
//       html: createGoogleUniqePassEmail(uniqePassword),
//     };

//     transporter.sendMail(mailOptions, function (error, info) {
//       // return res.send({
//       //   type: "success",
//       //   message: `Email sent to: ${email} , please check all mails`,
//       // });
//       console.log(info);
//     });
//   }
// }

//------------------------------------------------------------

// const fetchUidByEmail = await pool.query(
//   `SELECT uid FROM users WHERE email = '${email}'`
// );

// const results = Object.values(JSON.parse(JSON.stringify(fetchUidByEmail)));
// const user = results[0];

// const tokenObject = { email: email, googleid: googleid, uid: user.uid };

// // if not add new account
// const token = jwt.sign(tokenObject, process.env.JWT_SECRET, {
//   expiresIn: 2592000,
// });

// return res.status(200).send({ token: token });
