const auth = require('../auth.js')
const admin = require('firebase-admin');
const db = admin.firestore();

var get = (request, response) => {
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
     
      auth.getHeaderInfo(request)
        .then(header => {
          response.render('index', { servers: servers, header: header })
        });
    })
};

module.exports = {
  route: '/',
  get: get
}