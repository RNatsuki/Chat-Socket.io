const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const path = require("path");
const { Sequelize, DataTypes } = require("sequelize");
require("dotenv/config");
// Crear la aplicación Express
const app = express();
const server = http.createServer(app);

// Configurar el middleware para recibir datos en formato JSON
app.use(express.json());

// Configuración de la conexión a la base de datos
const sequelize = new Sequelize(
  process.env.MYSQL_DATABASE ?? "chat",
  process.env.MYSQL_USERNAME ?? "root",
  process.env.MYSQL_PASSWORD,
  {
    host: "localhost",
    dialect: "mysql", // Cambiar al dialecto correspondiente a tu base de datos (mysql, postgres, sqlite, etc.)
  }
);

// Definición del modelo de Usuario
const Usuario = sequelize.define(
  "Usuario",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    timestamps: false,
  }
);

// Definición del modelo de Mensaje
const Mensaje = sequelize.define("Mensaje", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  contenido: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  fechaEnvio: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW,
  },
});

// Relaciones entre las tablas
Usuario.hasMany(Mensaje);
Mensaje.belongsTo(Usuario);

// Configurar Socket.IO
const io = socketIO(server);

// Manejar conexiones de socket
io.on("connection", (socket) => {
  console.log("Nuevo usuario conectado");

  // Manejar mensajes entrantes
  socket.on("message", async (message) => {
    console.log("Mensaje recibido:", message);

    try {
      // Crear el mensaje en la base de datos
      const usuario = await Usuario.findOne({
        where: { username: message.sender },
      });

      if (!usuario) {
        throw new Error("Usuario no encontrado");
      }

      await Mensaje.create({
        contenido: message.message,
        fechaEnvio: new Date(),
        UsuarioId: usuario.id,
      });

      // Enviar el mensaje a todos los clientes conectados
      io.emit("message", message);
    } catch (error) {
      console.error("Error al guardar el mensaje:", error);
    }
  });

  // Manejar desconexiones
  socket.on("disconnect", () => {
    console.log("Usuario desconectado");
  });
});

//Ruta para enviar el archivo login.html que contiene el login

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "client", "login.html"));
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Buscar al usuario en la base de datos
    const usuario = await Usuario.findOne({
      where: { username: username },
    });

    if (!usuario) {
      return res.status(401).json({ error: "Usuario no encontrado" });
    }

    // Verificar la contraseña del usuario
    if (password !== usuario.password) {
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    // Autenticación exitosa
    return res.status(200).json({ message: "Autenticación exitosa" });
  } catch (error) {
    console.error("Error al autenticar al usuario:", error);
    return res.status(500).json({ error: "Error al autenticar al usuario" });
  }
});

// Ruta para enviar el archivo index.html que contiene el cliente de chat
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "client", "index.html"));
});

// Ruta para obtener todos los mensajes
app.get("/messages", async (req, res) => {
  try {
    // Obtener todos los mensajes de la base de datos
    const mensajes = await Mensaje.findAll({
      include: {
        model: Usuario,
        attributes: ["nombre", "username"],
      },
      order: [["fechaEnvio", "ASC"]],
    });

    // Responder con los mensajes
    res.json(mensajes);
  } catch (error) {
    console.error("Error al obtener los mensajes:", error);
    res.status(500).json({ error: "Error al obtener los mensajes" });
  }
});

// ...

// Sincronizar las tablas con la base de datos
sequelize
  .sync({ alter: true })
  .then(() => {
    console.log("Tablas sincronizadas correctamente");
  })
  .catch((error) => {
    console.error("Error al sincronizar las tablas:", error);
  });

// Iniciar el servidor
const port = 3000;
server.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`);
});
