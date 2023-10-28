const http = require("http");
const express = require("express");
const app = express();
// const server = require("http").createServer(app);
const socketIo = require("socket.io");
const port = process.env.SERVER_PORT;
const cors = require("cors");
app.use(cors({ origin: "*" }));
const pool = require("./database");

const server = http.createServer(app);
const io = socketIo(server);

io.origins("*:*");

io.on("connection", (socket) => {
  console.log("A user connected ", socket.id);

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });

  // You can add more event handlers here for real-time interactions.
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
