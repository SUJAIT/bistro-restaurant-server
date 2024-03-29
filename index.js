const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
//TODO Secret Key Not Secure
const stripe = require("stripe")('sk_test_51OHSSeCuwyVl672ZbZf4s8L2D8pS3zL3AGZA4lE6r3Sfp2m61ab4J4Zia9c3jtciAazifbGSQ35FplIrTlAnNDue00keEmpDhl')
require('dotenv').config()
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

//middleware
app.use(cors());
app.use(express.json());

  //middleware jwt
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' })
  }

  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}
//middleware jwt end

// mongodb start


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lebrsrr.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();


    const usersCollection = client.db("myrestaurant").collection("users");
    const menuCollection = client.db("myrestaurant").collection("menu");
    const reviewCollection = client.db("myrestaurant").collection("reviews");
    const cartCollection = client.db("myrestaurant").collection("carts");
    const paymentCollection = client.db("myrestaurant").collection("payments");


    //client side theka data pata bo ja server site a playLoad hisaba data server site a set hoba.
    //JWT Api Create
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ token })
    })

//Admine Verify middleware....

const verifyAdmin = async(req,res,next) =>{
  const email = req.decoded.email;
  const query = {email:email}
  const user = await usersCollection.findOne(query);
  if(user?.role !== 'admin'){
    return res.status(403).send({error:true, message: 'forbidden message'})
  }
  next();
}




    //users api
    app.get('/users', verifyJWT,verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })

    // users information related api
    app.post('/users', async (req, res) => {
      const user = req.body;
      // Checked userCollection Email Present or Not 
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query)
      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }
      const result = await usersCollection.insertOne(user)
      res.send(result);
    })

    //Admin Create Api 
    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

//admin chacked database  Api 
app.get('/users/admin/:email', verifyJWT ,async (req,res)=>{
  const email = req.params.email;

  if(req.decoded.email !== email){
    res.send({admin: false})
  }

  const query = {email:email}
  const user = await usersCollection.findOne(query);
  const result = {admin: user?.role === 'admin'}
  res.send(result)
}) 
//

    //data read {menu}
    app.get('/menu', async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    })
    //
//Create Menu Data Post Api
app.post('/menu', verifyJWT, verifyAdmin, async(req,res)=>{
  const newItem = req.body;
  const result = await menuCollection.insertOne(newItem)
  res.send(result);
})
//

    //delete Admin MenageItems Api 
    app.delete('/menu/:id',verifyJWT,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query)
      res.send(result)
    })
//

    //data read {reviews}
    app.get('/reviews', async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result)
    })
//
    //cart collection API {data find and data taken}
    app.get('/carts', verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
//jwt
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) //  ( !== ) checks whether its two operands are not equal, returning a Boolean result.
      {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }
//

      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result)
    })
    //

    //cart collection
    app.post('/carts', async (req, res) => {
      const item = req.body;

      const result = await cartCollection.insertOne(item)
      res.send(result)
    })
//
    //delete User cart Items Api 
    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query)
      res.send(result)
    })
//
//Create Payment intent
app.post('/create-payment-intent',verifyJWT,async(req,res)=>{
  const {price} = req.body;
  const amount = price*100;
  const paymentIntent = await stripe.paymentIntents.create({
    amount:amount,
    currency:'usd',
   payment_method_types: [
    "card"
  ],
  })
  res.send({
    clientSecret: paymentIntent.client_secret,
  });
})
//
//Payment Related Api
app.post('/payments',async(req,res) =>{
  const payment = req.body;
  const insertResult = await paymentCollection.insertOne(payment);
  const query = {_id: {$in: payment.cartItems.map(id => new ObjectId(id))}}
  const deleteResult = await cartCollection.deleteMany(query)
  
  res.send({insertResult,deleteResult});
})



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// mongodb end


app.get('/', (req, res) => {
  res.send('boss is sitting')
})





app.listen(port, () => {
  console.log(`Bistro rastaurent is Running ${port}`);
})