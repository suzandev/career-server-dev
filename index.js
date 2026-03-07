const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

// middleware

app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());

// ====== MongoDB URI ======
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.on5po.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const jobsCollection = client.db("career-server-dev").collection("jobs");
    const applicationsCollection = client
      .db("career-server-dev")
      .collection("applications");

    // Jwt token related api
    app.post("/jwt", async (req, res) => {
      const userData = req.body;

      const token = jwt.sign(userData, process.env.JWT_ACCESS_SECRET, {
        expiresIn: "1d",
      });

      res.cookie("token", token, {
        httpOnly: true,
        secure: false,
        sameSite: "strict",
      });

      res.send({ success: true, token });
    });

    // verify Token Middleware
    const verifyToken = (req, res, next) => {
      const token = req.cookies.token;

      if (!token) {
        return res.status(401).send({ message: "unauthorized access" });
      }

      jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }

        req.user = decoded;
        next();
      });
    };

    // job API
    app.get("/jobs", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.hr_email = email;
      }

      const cursor = jobsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // Specific data collect with id
    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });

    app.post("/jobs", async (req, res) => {
      const newJob = req.body;
      const result = await jobsCollection.insertOne(newJob);
      res.send(result);
    });

    // job applications related apis
    app.get("/applications", verifyToken, async (req, res) => {
      console.log("inside applications api", req.cookies);
      const email = req.query.email;

      const pipeline = [
        {
          $match: { applicant: email },
        },
        {
          $addFields: {
            jobIdObj: { $toObjectId: "$jobId" },
          },
        },
        {
          $lookup: {
            from: "jobs", // collection name
            localField: "jobIdObj",
            foreignField: "_id",
            as: "jobInfo",
          },
        },
        {
          $unwind: "$jobInfo",
        },
        {
          $project: {
            name: 1,
            phone: 1,
            resume: 1,
            coverLetter: 1,
            applicant: 1,
            jobId: 1,
            company: "$jobInfo.company",
            title: "$jobInfo.title",
            company_logo: "$jobInfo.company_logo",
          },
        },
      ];

      const result = await applicationsCollection.aggregate(pipeline).toArray();

      res.send(result);
    });

    app.post("/applications", async (req, res) => {
      const application = req.body;
      console.log(application);
      const result = await applicationsCollection.insertOne(application);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Career Server is Cocking");
});

app.listen(port, () => {
  console.log(`Career server Running On Port :, ${port}`);
});
