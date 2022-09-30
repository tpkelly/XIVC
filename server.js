const express = require('express');
const cookieParser = require("cookie-parser");
const fetch = require('node-fetch');

const { port, clientId, clientSecret } = require('./config.json');

const app = express();
app.use(cookieParser());
app.set('view engine', 'pug');

app.get('/', (request, response) => {
  if (!request.cookies['oauth']) {
    response.render('index', { loggedin: false })
    return;
  }
  
  fetch('https://discord.com/api/users/@me/guilds', {
      headers: {
        authorization: `${request.cookies['tokenType']} ${request.cookies['oauth']}`,
      },
    })
    .then(result => result.json())
    .then(res => {
      var servers = res.reduce((output, guild) => {
        // Only look for guilds with "Manage Server" permission
        if (guild.permissions & 32) {
          output.push(`${guild.id}: ${guild.name}`);
        }
        
        return output;
      }, []);
      
      response.render('index', { loggedin: true, servers: servers })
    })
    .catch(console.error);
});

app.get('/login', (request, response) => {
  var code = request.query.code
  response.cookie('code', code);
  
  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('grant_type', 'authorization_code');
  params.append('code', code);
  params.append('redirect_uri', 'http://localhost:55555/login');

  fetch('https://discord.com/api/v10/oauth2/token', { method: 'POST', body: params, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
    .then(result => result.json())
    .then(res => {
      if (res.access_token) {
          response.cookie('oauth', res.access_token, { expire: Date.now() + res.expires_in });
          response.cookie('tokenType', res.token_type, { expire: Date.now() + res.expires_in });
      }
      else {
        console.log(res)
      }
      response.redirect('/');
    })
    .catch(console.error)
});

app.listen(port, () => console.log(`App listening at http://localhost:${port}`));