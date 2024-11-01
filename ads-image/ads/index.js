const express = require("express");
const path = require("path");
const app = express();

// Define a route for `app-ads.txt`
app.get("/app-ads.txt", (req, res) => {
  res.sendFile(path.join(__dirname, "public/add-ads.txt")); // Update the path accordingly
});

const port = process.env.SERVER_PORT;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
