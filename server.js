const admin = require('firebase-admin');

const firebase = {
  type: "service_account",
  project_id: "xivc-db",
  private_key_id: process.env.xivc_firebase_key_id,
  private_key: process.env.xivc_firebase_key.replaceAll('\\n', '\n'),
  client_email: process.env.xivc_firebase_client_email,
  client_id: process.env.xivc_firebase_client_id,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.xivc_firebase_cert_url
};
admin.initializeApp({
  credential: admin.credential.cert(firebase)
});

const port = process.env.xivc_port || 8080
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const auth = require('./auth.js');

const app = express();
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/css', express.static('style'));
app.use('/img', express.static('img'));
app.set('view engine', 'pug');

const router = express.Router()

// Register routes from files in /views/
const routeFiles = fs.readdirSync('./views').filter(file => file.endsWith('.js'));
for (const file of routeFiles) {
  const route = require(`./views/${file}`);
  
  if (route.get) {
    if (route.authenticated) {
      router.get(route.route, auth.middleware, route.get);
    } else {    
      router.get(route.route, route.get);
    }
  }
  
  if (route.post) {
    if (route.authenticated) {
      router.post(route.route, auth.middleware, route.post);
    } else {
      router.post(route.route, route.post);
    }
  }
}

app.use('/', router);
app.listen(port, () => console.log(`App listening at http://localhost:${port}`));