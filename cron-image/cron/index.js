const express = require("express");
const app = express();

const bodyParser = require("body-parser");
const cors = require("cors");

const argon2 = require("argon2");
const jwt = require("jsonwebtoken");

const CronJob = require("cron").CronJob;
const pool = require("./database");

const port = process.env.SERVER_PORT;
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  cors({
    origin: "*",
  })
);

app.listen(port, () => console.log(`Server running on port ${port}`));

const job = new CronJob(
  "* * * * *",
  () => {
    // Your code to be executed at 00:00 UTC every day goes here
    console.log("every minute new");

    // at 00:00 UTC everyday
    // connect to database
    // select active giveaway row
    // check if total participants > or < 1000
    // if total < 1000 : do nothing
    // if total >= 1000 :
    // get array of all participants
    // select a random winner
    // update users table : set a user as winner where uid === selected winner
    // assign the reward value e.g. $20
    // set active giveaway as ended
    // start a new giveaway
  },
  null,
  true,
  "UTC"
);

job.start();
