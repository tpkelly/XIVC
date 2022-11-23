const auth = require('../auth.js')
const fetch = require('node-fetch');
const admin = require('firebase-admin');

const db = admin.firestore();

var get = (request, response) => {
  auth.getHeaderInfo(request)
    .then(header => {
      fetch('https://discord.com/api/users/@me/guilds', auth.getAuth(request))
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
};

module.exports = {
  route: '/profile',
  get: get,
  authenticated: true
}