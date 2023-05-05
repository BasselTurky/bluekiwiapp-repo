// at 00:00 UTC everyday
console.log("job is running");
// connect to database
const pool = require("./database");
async function testDB() {
  const result = await pool.query(`SELECT * FROM giveaways WHERE id = 3`);

  console.log(result);
}
try {
  // select active giveaway row
  testDB();
} catch (error) {
  console.log(error);
  console.log("job is running again");
}

// check if total participants > or < 1000
// if total < 1000 : do nothing
// if total >= 1000 :
// get array of all participants
// select a random winner
// update users table : set a user as winner where uid === selected winner
// assign the reward value e.g. $20
// set active giveaway as ended
// start a new giveaway
