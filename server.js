const express = require('express');
const cookieParser = require("cookie-parser");
const fetch = require('node-fetch');

const config = require('./config.json');
const port = process.env.xivc_port || config['port'] || 8080
const clientId = process.env.xivc_clientId || config['clientId']
const clientSecret = process.env.xivc_clientSecret || config['clientSecret']

const app = express();
app.use(cookieParser());
app.use('/css', express.static('style'));
app.use('/img', express.static('img'));
app.set('view engine', 'pug');

app.get('/', (request, response) => {
  var servers = [
    { name: 'FFXIV Europe', description: 'Community dedicated to users that play on European game worlds.', memberCount: 12345, categories: [ 'abc', 'def', 'ghi' ], icon: 'img/discord.svg' },
    { name: 'Fey\'s Temperance', description: 'Fey\'s Temperance is a hub for creativity and growth.', memberCount: 23456, categories: [ 'abc', 'def' ], icon: 'img/discord.svg' },
    { name: 'Eorzea Collection', description: 'Share your glamours and browse through collections.', memberCount: 34567, categories: [ 'def', 'ghi', 'jkl' ], icon: 'img/discord.svg' },
    { name: 'r/ffxiv', description: 'The official r/ffxiv Discord server, formerly called Reddit FFXIV.', memberCount: 45678, categories: [ 'abc', 'def', 'ghi' ], icon: 'img/discord.svg' }
  ];
  
  getHeaderInfo(request)
    .then(header => {
      response.render('index', { servers: servers, header: header })
    });  
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
          .then(guilds => {
            var servers = guilds.reduce((output, guild) => {
              // Only look for guilds with "Manage Server" permission
              if (guild.permissions & 32) {
                output.push({
                  id: guild.id,
                  name: guild.name,
                  icon: (guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : 'img/discord.svg'),
                });
              }
              
              return output;
            }, []);
            response.render('profile', { servers: servers, header: header })
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
  params.append('redirect_uri', `${request.protocol}://${request.headers['host']}/login`);

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

async function getHeaderInfo(request) {
  if (!request.cookies['oauth']) {
    return {
      redirectUrl: encodeURIComponent(`${request.protocol}://${request.headers['host']}/login`),
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