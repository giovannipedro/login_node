const bcrypt = require("bcrypt");
const express = require("express");
const session = require("express-session");
const bodyparser = require("body-parser");
const cors = require("cors");
const port = 3000;
const url =
  "mongodb+srv://giojs:neQM619EWPVgNoVi@cluster0.76in5wx.mongodb.net/?retryWrites=true&w=majority"; // Vervang door je eigen MongoDB-URL
const dbName = "DbLogin"; // Vervang door de naam van je database
const app = express();

app.use(
  session({
    secret: "secrey_katje_miauw", // Geheime sleutel voor sessies, vervang dit met een sterkere sleutel in productie
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Zet dit op true als je HTTPS gebruikt
  })
);

app.set("view engine", "ejs");

const { MongoClient } = require("mongodb");

app.use(cors());
// Middleware voor het verwerken van JSON-verzoeken
app.use(express.json());

app.use(express.urlencoded({ extended: true })); // Voor formuliergegevens

// encryption

const saltRounds = 10;

async function connectToDatabase() {
  const client = new MongoClient(url, { useUnifiedTopology: true });

  try {
    await client.connect();
    console.log("Verbonden met MongoDB");
    return client.db(dbName);
  } catch (error) {
    console.error("Fout bij verbinden met MongoDB:", error);
    throw error;
  }
}

app.get("/", (req, res) => {
  if (req.session.username) {
    res.redirect("/welcome");
  } else {
    res.render("login", { error: req.query.error });
  }
});

app.get("/register", (req, res) => {
  res.render("register", { error: req.query.error });
});

app.get("/welcome", (req, res) => {
  // Controleren of de gebruiker is ingelogd
  if (req.session.username) {
    res.render("welcome", { username: req.session.username });
  } else {
    res.redirect("/");
  }
});

// U
app.post("/register", async function (req, res) {
  const userName = req.body.username;
  const password = req.body.password;
  const password2 = req.body.password2;

  if (password === password2 && password !== null && password2 !== null) {
    bcrypt.genSalt(saltRounds, function (err, salt) {
      bcrypt.hash(password, salt, async function (err, hash) {
        // returns hash
        try {
          const db = await connectToDatabase();
          const usersCollection = db.collection("users");

          const NewUser = {
            username: userName,
            password: hash,
            aantal_logins: 0,
            lastLogin: Date.now()
          };

          console.log(
            "er is een nieuwe gebruiker gestuurd naar de database " +
              userName +
              "" +
              password
          );

          const result = await usersCollection.insertOne(NewUser);

          if (result.insertedId) {
            const user = await usersCollection.findOne({
              _id: result.insertedId
            });
            console.log("user succesvol toegevoegd aan de database; ", user);
            res.redirect("/");
          } else {
            console.error("user toevoegen aan de database mislukt.");
          }
        } catch (error) {
          console.error(
            "Fout bij toevoegen van de user aan de database:",
            error
          );
        }
      });
    });
  } else {
    console.log(
      "het wachtwoord en het herhaalde wachtwoord zijn niet gelijk of een van de 2 is niet ingevuld"
    );
  }

  console.log(userName, password);
});
app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    res.redirect("/"); // will always fire after session is destroyed
  });
});
app.post("/login-users", async (req, res) => {
  // Implementeer je inloglogica hier

  try {
    const db = await connectToDatabase();
    const usersCollection = db.collection("users");
    const username = req.body.username;
    const password = req.body.password;

    const user = await usersCollection.findOne({ username: username });

    if (user && (await bcrypt.compare(password, user.password))) {
      // Inloggen gelukt
      req.session.username = username; //bij succes opslaan in sessie

      const date = new Date();

      let day = date.getDate();
      let month = date.getMonth() + 1;
      let year = date.getFullYear();
      let currentDate = `${day}-${month}-${year}`;

      const hours = date.getHours();
      const minutes = date.getMinutes();
      const seconds = date.getSeconds();
      const currentTime = `${hours}:${minutes}:${seconds}`;

      const result = await usersCollection.updateOne(
        { username },
        {
          $inc: { aantal_logins: 1 }, // Verhoog het aantal_logins met 1
          $set: { lastLogin: currentDate + "" + currentTime } // Stel lastLogin in op het huidige tijdstip
        }
      );
      if (result.modifiedCount > 0) {
        console.log("Gebruikersinformatie bijgewerkt.");
        res.redirect("/welcome");
      } else {
        console.log("Gebruiker niet bijgewerkt.");
        res.redirect("/?error=Er is iets misgegaan bij het inloggen.");
      }
    } else {
      // Inloggen mislukt, stuur foutmelding terug naar de login-pagina
      res.redirect("/?error=Ongeldige gebruikersnaam of wachtwoord");
    }
  } catch (err) {
    console.error("Fout bij het inloggen:", err);
    res.status(500).json({ message: "Serverfout bij het inloggen" });
  }
});

// Start de server
app.listen(port, () => {
  console.log(`De server luistert op poort ${port}`);
});
