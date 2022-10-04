const express = require('express');
const cookieParser = require("cookie-parser");
const fetch = require('node-fetch');

const { port, clientId, clientSecret } = require('./config.json');

const app = express();
app.use(cookieParser());
app.use('/css', express.static('style'));
app.use('/img', express.static('img'));
app.set('view engine', 'pug');

app.get('/', (request, response) => {
  if (!request.cookies['oauth']) {
    response.render('index', { loggedin: false })
    return;
  }
  
  var authHeader = { headers:
    {
      authorization: `${request.cookies['tokenType']} ${request.cookies['oauth']}`,
    }
  };
  
  fetch('https://discord.com/api/users/@me', authHeader)
    .then(result => result.json())
    .then(user => {
      fetch('https://discord.com/api/users/@me/guilds', authHeader)
          .then(result => result.json())
          .then(guilds => {
            var servers = guilds.reduce((output, guild) => {
              // Only look for guilds with "Manage Server" permission
              if (guild.permissions & 32) {
                output.push({id: guild.id, name: guild.name, icon: `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` });
              }
              
              return output;
            }, []);
            response.render('index', { loggedin: true, servers: servers, profile: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`})
      });
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