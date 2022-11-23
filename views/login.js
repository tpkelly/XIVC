const auth = require('../auth.js');

var get = (request, response) => {
  var code = request.query.code
  auth.token(request.headers['host'], code, response)
    .then(() => response.redirect('/'))
    .catch(err => {
      console.log(err);
      response.redirect('/')
    });
};

module.exports = {
  route: '/login',
  get: get
}