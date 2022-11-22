const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const admin = require('firebase-admin');

const port = process.env.xivc_port || 8080
const clientId = process.env.xivc_clientId
const clientSecret = process.env.xivc_clientSecret
const botSecret = process.env.xivc_apiToken

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

const db = admin.firestore();

const app = express();
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/css', express.static('style'));
app.use('/img', express.static('img'));
app.set('view engine', 'pug');

app.get('/', (request, response) => {
  db.collection('meta').listDocuments()
    .then(async docs => {
      var servers = [];
      for (const doc of docs) {
        await doc.get().then(d => {
          servers.push({
            id: d.get('id'),
            name: d.get('name'),
            icon: d.get('icon') || 'img/discord.svg',
            memberCount: d.get('memberCount'),
            description: d.get('description'),
            categories: d.get('categories') || []
          });
        });
      }
     
      getHeaderInfo(request)
        .then(header => {
          response.render('index', { servers: servers, header: header })
        });
    })
});

app.get('/status', (request, response) => {
  return response.json({ healthy: true });
});

app.get('/profile', (request, response) => {
  if (!request.cookies['oauth']) {
      response.redirect('/');
    return;
  }

  getHeaderInfo(request)
    .then(header => {
      fetch('https://discord.com/api/users/@me/guilds', getAuth(request))
          .then(result => result.json())
          .then(async guilds => {
            var servers = guilds.reduce((output, guild) => {
              // Only look for guilds with "Manage Server" permission
              if (guild.permissions & 32) {
                output.push({
                  id: guild.id,
                  name: guild.name,
                  icon: (guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : 'img/discord.svg'),
                  managed: false
                });
              }
              
              return output;
            }, []);
            
            // Identify any that are already registered
            var serverIds = servers.map(s => s.id);
            var managedServers = [];
            while (serverIds.length > 0) {
              var matchedIds = await db.collection('meta')
                .where('id', 'in', serverIds.splice(0, 10))
                .get()
                .then(results => results.docs)
                .then(docs => docs.map(doc => doc.get('id')));
              managedServers = managedServers.concat(matchedIds);
            }

            for (var server of servers) {
              if (managedServers.includes(server.id)) {
                server.managed = true;
              }
            }
              
            // Prioritise any that we already have registered when displaying
            servers = servers.sort((a, b) => (a.managed < b.managed) ? 1 : -1)
            response.render('profile', { servers: servers, header: header })
      });
    })
    .catch(console.error);
});

app.get('/login', (request, response) => {
  var code = request.query.code
  response.cookie('code', code, { httpOnly: true, secure: true });
  
  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('grant_type', 'authorization_code');
  params.append('code', code);
  params.append('redirect_uri', `https://${request.headers['host']}/login`);

  fetch('https://discord.com/api/v10/oauth2/token', { method: 'POST', body: params, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
    .then(result => result.json())
    .then(res => {
      if (res.access_token) {
          response.cookie('oauth', res.access_token, { maxAge: res.expires_in, httpOnly: true, secure: true });
          response.cookie('tokenType', res.token_type, { maxAge: res.expires_in, httpOnly: true, secure: true });
      }
      else {
        console.log(res)
      }
      response.redirect('/');
    })
    .catch(console.error)
});

app.get('/manage/:serverId', (request, response) => {
  if (!request.cookies['oauth']) {
      response.redirect('/');
    return;
  }
 
  var serverId = request.params.serverId;
 
  // Check we are allowed to manage this server 
  getHeaderInfo(request)
    .then(header => {
      return fetch(`https://discord.com/api/users/@me/guilds?after=${serverId-1}&limit=1`, getAuth(request))
          .then(result => result.json())
          .then(guilds => {
            if (!Array.isArray(guilds)) {
              throw guilds;
            }
            
            var guild = guilds[0];
            if (guild.id !== serverId || guild.permissions & 32 == 0) { // Don't have manage permissions on this server
              return response.status(403).send('403 Forbidden'); // Custom error pages later?
            }
            
            db.collection('meta').doc(serverId).get()
              .then(doc => {
                if (!doc.exists) {
                  return response.status(404).send('404 Not Found');
                }
                
                response.render('manage', { server: doc.data(), header: header });
              });
      });
    })
    .catch(console.error);
});

app.post('/manage/:serverId', (request, response) => {
  if (!request.cookies['oauth']) {
      response.redirect('/');
    return;
  }
  
  var body = request.body;
  var serverId = request.params.serverId;
  var serverDocRef = db.collection('meta').doc(serverId);
  serverDocRef.get()
    .then(doc => {
      if (!doc.exists) {
        return;
      }
      
      serverDocRef.update({
        description: body.description,
        language: body.language,
        categories: body.categories ? body.categories.split(',') : [] });
    });
  
  response.redirect('#');
});

async function getHeaderInfo(request) {
  if (!request.cookies['oauth']) {
    return {
      redirectUrl: encodeURIComponent(`https://${request.headers['host']}/login`),
      clientId: clientId
    };
  }

  return fetch('https://discord.com/api/users/@me', getAuth(request))
    .then(result => result.json())
    .then(user => {
      return {
        profile: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`,
      };
    });
}

function getAuth(request) {
    return { headers:
    {
      authorization: `${request.cookies['tokenType']} ${request.cookies['oauth']}`,
    }
  };
}

app.listen(port, () => console.log(`App listening at http://localhost:${port}`));