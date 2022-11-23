const auth = require('../auth.js')
const fetch = require('node-fetch');
const admin = require('firebase-admin');

const db = admin.firestore();

var get = (request, response) => {
  var serverId = request.params.serverId;
 
  // Check we are allowed to manage this server 
  auth.getHeaderInfo(request)
    .then(header => {
      return fetch(`https://discord.com/api/users/@me/guilds?after=${serverId-1}&limit=1`, auth.getAuth(request))
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
};

var post = (request, response) => {
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
        categories: body.categories || [] });
    });
  
  response.redirect('#');
};

module.exports = {
  route: '/manage/:serverId',
  get: get,
  post: post,
  authenticated: true
}