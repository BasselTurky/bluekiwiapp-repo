const http = require("http");
const express = require("express");
const app = express();
// const server = require("http").createServer(app);
const socketIo = require("socket.io");

const cors = require("cors");
app.use(
  cors({
    origin: "*",
  })
);

const server = http.createServer(app);
const io = socketIo(server);
app.get("/socket", (req, res) => {
  res.send("hello");
});
io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("error", (error) => {
    console.error(error);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });

  // You can add more event handlers here for real-time interactions.
});

const port = 3004;
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
