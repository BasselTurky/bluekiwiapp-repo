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
  },
  null,
  true,
  "UTC"
);

// job.start();

async function process_giveaway() {
  try {
    // connect to database
    // select active giveaway row
    const queryResult = await pool.query(
      `SELECT * FROM giveaways WHERE status = 'active'`
    );
    const result = Object.values(JSON.parse(JSON.stringify(queryResult)));

    if (!result.length) {
      return;
    }

    const activeGiveaway = result[0]; // object {id:number, date:DATETIME, total_participants:number, winner-uid:string, reward_type:string, reward_value:string, optained:0, status:'active'}

    const total_participants = activeGiveaway.total_participants;
    // check if total participants > or < 1000

    // if total < 1000 : do nothing
    if (total_participants < 1000) {
      // do nothing and skip this day

      console.log(
        "I will do nothing today because total participants is ",
        total_participants,
        " and it's lower than 1000"
      );
      return;
    }

    // if total >= 1000 :
    if (total_participants >= 1000) {
      // get array of all participants
      const queryResult = await pool.query(`SELECT participants.*, users.uid
        FROM participants
        JOIN users ON participants.userId = users.id
        JOIN giveaways ON participants.giveawayId = giveaways.id
        WHERE giveaways.id = '${activeGiveaway.id}'
        `);

      const result = Object.values(JSON.parse(JSON.stringify(queryResult)));
      // [{id, giveawayId, userId, date, uid},{id, giveawayId, userId, date, uid},...]

      const uidArray = result.map((result) => result.uid);
      // select a random winner

      const randomIndex = Math.floor(Math.random() * uidArray.length);
      const randomWinnerUid = uidArray[randomIndex];

      // update users table : set a user as winner where uid === selected winner

      const updateUserQuery = await pool.query(
        `UPDATE users SET winner = ${activeGiveaway.id} WHERE uid = '${randomWinnerUid}'`
      );

      // update giveaways {active} set status to (ended), set wiiner-uid to (randomWinnerUid) and assign the reward_value_usd e.g. $20

      const rewardValueUSD = Math.floor(total_participants / 1000) * 10;

      const updateGiveawaysQuery = await pool.query(
        `UPDATE giveaways SET winner_uid = '${randomWinnerUid}', reward_value_usd = ${rewardValueUSD}, status = 'ended' WHERE status = 'active' AND id = ${activeGiveaway.id}`
      );

      // update users.available of all participants

      const updateUsersQuery = await pool.query(`
            UPDATE users SET available = FALSE
            WHERE id IN (
                SELECT p.userId
                FROM participants p
                JOIN giveaways g ON p.giveawayId = g.id
                WHERE g.id = ${activeGiveaway.id}
            );
      `);
      // exclude the winner from available False

      // start a new giveaway

      const startNewGiveawayQuery = await pool.query(
        `INSERT INTO giveaways VALUES ()`
      );

      return;
    }
  } catch (error) {
    console.log(error);
  }
}
