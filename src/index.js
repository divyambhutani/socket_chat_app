const path = require("path");
const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const Filter = require("bad-words");

const {
  generateMessage,
  generateLocationMessage,
} = require("./utils/messages");

const {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom,
} = require("./utils/users");
const app = express();
const server = http.createServer(app);
const io = socketio(server);

const port = process.env.PORT || 3000;
const publicDirectoryPath = path.join(__dirname, "../public");

app.use(express.static(publicDirectoryPath));

io.on("connection", (socket) => {
  // user joining a room
  socket.on("join", (options, callback) => {
    const { error, user } = addUser({ id: socket.id, ...options });

    if (error) {
      return callback(error);
    }

    socket.join(user.room);
    socket.emit("message", generateMessage("admin", "Welcome!"));
    socket.broadcast
      .to(user.room)
      .emit(
        "message",
        generateMessage("admin", `${user.username} has joined!`)
      );
    io.to(user.room).emit("roomData", {
      room: user.room,
      users: getUsersInRoom(user.room),
    });
    callback();
  });

  // user sending a message
  socket.on("sendMessage", (message, acknowledge) => {
    const filter = new Filter();
    if (filter.isProfane(message)) return acknowledge("Bad language used!");
    const user = getUser(socket.id);
    io.to(user.room).emit("message", generateMessage(user.username, message));
    acknowledge();
  });

  socket.on("sendLocation", (coords, acknowledge) => {
    const user = getUser(socket.id);
    io.to(user.room).emit(
      "locationMessage",
      generateLocationMessage(
        user.username,
        `https://www.google.com/maps?q=${coords.lattitude},${coords.longitude}`
      )
    );
    acknowledge();
  });

  // suppose a user disconnected then we use inbuilt event disconnect
  socket.on("disconnect", () => {
    const user = removeUser(socket.id);
    if (user) {
      io.to(user.room).emit(
        "message",
        generateMessage("admin", `${user.username} has left!!`)
      );

      io.to(user.room).emit("roomData", {
        room: user.room,
        users: getUsersInRoom(user.room),
      });
    }
  });
});

server.listen(port, () => {
  console.log("Server started at port " + port);
});

/**************************************
 * socket.emit() => for current user
 * socket.broadcast.emit() => everyone except current user
 * io.emit() => everyone
 **************************************/

// event acknowledgement (reciever can send to user)
