const express = require("express");
const app = express();

const bodyParser = require("body-parser");
const cors = require("cors");

const argon2 = require("argon2");
const emailValidator = require("deep-email-validator");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const request = require("request");
const multer = require("multer");
const rateLimit = require("express-rate-limit");

const pool = require("./database");
const {
  createVerificationEmail,
} = require("./functions/createVerificationEmail");
const { createOtpEmail } = require("./functions/createOtpEmail");
const { createResetPassEmail } = require("./functions/createResetPassEmail");
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

// used - Register

// add rate limiter : to do
app.post("/auth/register-data", async (req, res) => {
  try {
    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;
    // const paypal = req.body.paypal;

    // check if email is valid
    let email_validation_results = await emailValidator.validate({
      email: email,
      validateSMTP: false,
    });

    if (!email_validation_results.valid) {
      return res.send({ type: "error", message: "Email is invalid" });
    }

    // Check if email already exists

    const results = await pool.query(
      `SELECT email FROM users WHERE email = '${email}'`
    );

    if (results.length) {
      return res.send({ type: "error", message: "Email is already taken" });
    }

    // hash the password
    const hashedPassword = await argon2.hash(password, 10);

    var newUserMysql = {
      name: name,
      email: email,
      password: hashedPassword,
      // paypal: paypal,
    };
    // Create token to be sent in verification email

    const token = jwt.sign({ data: newUserMysql }, process.env.JWT_SECRET, {
      expiresIn: 600,
    });

    // Email form
    let url = `https://bluekiwiapp.com/auth/verify/${token}`;
    const mailOptions = {
      // "invite.me.application@hotmail.com"
      from: process.env.SERVER_EMAIL,
      to: email,
      subject: "Verification email",
      html: createVerificationEmail(url),
    };

    try {
      transporter.sendMail(mailOptions, function (error, info) {
        return res.send({
          type: "success",
          message: `Email sent to: ${email} , please check all mails`,
        });
      });
    } catch (error) {
      console.log(error);
      return res.send({
        type: "error",
        message: "ErrorID: E014",
      });
    }
  } catch (error) {
    console.log(error);
    return res.send({
      type: "error",
      message: "ErrorID: E013",
    });
  }
  // get the data
});

app.get("/auth/verify/:token", async (req, res) => {
  jwt.verify(req.params.token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.send(
        "<h1>Verification link expired, please register again</h1>"
      );
    } else {
      let name = decoded.data.name;
      let email = decoded.data.email;
      let password = decoded.data.password;
      // let paypal = decoded.data.paypal;

      const result = await pool.query(
        `SELECT * FROM users WHERE email = '${email}'`
      );

      if (result.length) {
        // edit
        console.log("Already verified");
        // return res.send({ type: "info", message: "Verified." });
        return res.render("verified.ejs");
      } else {
        // insert data in database
        try {
          let set = new Set(Array.from({ length: 9999 }, (_, i) => i + 1));

          const discriminatorQuery = await pool.query(
            `SELECT discriminator FROM users WHERE name = '${name}'`
          );

          if (discriminatorQuery.length) {
          }

          const discriminatorResult = Object.values(
            JSON.parse(JSON.stringify(discriminatorQuery))
          ); // array of objects
          // currently 1 user > 4445 > [{discriminator: 4445}]

          const discriminatorArray = discriminatorResult.map(
            (result) => result.discriminator
          );

          if (discriminatorArray.length > 0) {
            for (let i = 0; i < discriminatorArray.length; i++) {
              set.delete(discriminatorArray[i]);
            }
          }

          // check if discriminatorArray has 4445
          // console.log('first check',discriminatorArray.includes(4445));

          console.log("second check", set.has(4445));

          // select random number from Set

          const availableDiscriminators = Array.from(set);
          const randomIndex = Math.floor(
            Math.random() * availableDiscriminators.length
          );
          const randomNumber = availableDiscriminators[randomIndex];
          const paddedNumber = randomNumber.toString().padStart(4, "0");

          const uniqueId = name + "#" + paddedNumber;

          const queryResult = await pool.query(
            `INSERT INTO users (name, discriminator, uid, email, password) VALUES ('${name}',${paddedNumber}',${uniqueId}','${email}','${password}')`
          );

          const result = Object.values(JSON.parse(JSON.stringify(queryResult)));

          console.log(result);

          return res.render("verified.ejs");
        } catch (error) {
          console.log(error);
          console.log("Database Error");

          return res.send("<h1>Error</h1>");
        }
      }
    }
  });
});

app.post("/auth/login-data", async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  const date = req.body.date;
  const device_id = req.body.device_id;

  // Get email from database if available
  try {
    const queryResults = await pool.query(
      `SELECT * FROM users WHERE email = '${email}'`
    );

    const results = Object.values(JSON.parse(JSON.stringify(queryResults)));

    if (!results.length) {
      return res.send({
        type: "error",
        message: "Incorrect email or password.",
      });
    }
    // get user object
    const user = results[0];

    if (!(await argon2.verify(user.password, password))) {
      return res.send({
        type: "error",
        message: "Incorrect email or password.",
      });
    }

    // Create token

    const token = jwt.sign(
      { email: email, device_id: device_id },
      process.env.JWT_SECRET,
      {
        expiresIn: 2592000,
      }
    );

    // If device id = null : fresh login

    if (user.device_id === null) {
      await pool.query(
        `UPDATE users  SET device_id = '${device_id}' WHERE email = '${email}'`
      );

      return res.send({ type: "success", token: token });
    }

    // Check device id: if true -> same user | if false different user

    if (!(await check_device_id(email, device_id))) {
      //generate OTP
      let one_time_password = verification_code(6);

      // put it into token to be sent to user frontend and stored in SecureStore

      const otp_token = jwt.sign(
        { otp: one_time_password, email: email },
        process.env.JWT_SECRET,
        {
          expiresIn: 600,
        }
      );

      const mailOptions = {
        from: process.env.SERVER_EMAIL,
        to: email,
        subject: "Confirmation code",
        html: createOtpEmail(one_time_password),
      };

      transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
          console.log(error);
        } else {
          console.log("Warning email sent to: ", email, " at: ", date);
        }
      });

      return res.send({ type: "verify", otp_token: otp_token, email: email });
    }

    // if everything is fine and not first time login:

    // await pool.query(
    //     `UPDATE users  SET device_id = '${device_id}' WHERE email = '${email}'`
    //   );

    return res.send({ type: "success", token: token });
  } catch (error) {
    console.log(error);
    return res.send({ type: "error", message: "ErrorID: E007" });
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

      if (decoded_otp === otpInput) {
        // verified

        await pool.query(
          `UPDATE users  SET device_id = '${device_id}' WHERE email = '${email}'`
        );

        const token = jwt.sign(
          { email: email, device_id: device_id },
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
  let token = req.body.token;
  let check_result = await check_device_id_from_token(token);

  if (check_result.boolean) {
    return res.json("pass");
  } else {
    return res.json("error");
  }
});

// Create refresh token

app.post("/auth/refresh-token", async (req, res) => {
  let token = req.body.token;
  let check_result = await check_device_id_from_token(token);

  if (check_result.boolean) {
    let email = check_result.email;
    let device_id = check_result.device_id;

    const token = jwt.sign(
      { email: email, device_id: device_id },
      process.env.JWT_SECRET,
      {
        expiresIn: 2592000,
      }
    );

    return res.send({ type: "pass", token: token });
  } else {
    return res.send({ type: "expired", message: "Session expired." });
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
    let check_result = await check_device_id_from_token(token);
    console.log(check_result);
    if (check_result.boolean) {
      let email = check_result.email;
      const result = await pool.query(
        `SELECT name, email, device_id, coins FROM users WHERE email = '${email}'`
      );

      return res.send({ type: "success", userInfo: result[0] });
    } else {
      return res.send({ type: "wrong-device" });
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

async function check_device_id_from_token(token) {
  try {
    let decoded = jwt.verify(token, process.env.JWT_SECRET);
    // , async (err, decoded) => {
    // if (err) {
    //   return { boolean: false };
    // }

    let email = decoded.email;
    let device_id = decoded.device_id;

    const db_device_id_query = await pool.query(
      `SELECT * FROM users WHERE email ='${email}'`
    );

    const results = Object.values(
      JSON.parse(JSON.stringify(db_device_id_query))
    );

    const db_device_id = results[0].device_id;

    if (device_id === db_device_id) {
      return { boolean: true, email: email, device_id: device_id };
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
