const fetch = require('node-fetch');
const clientId = process.env.xivc_clientId
const clientSecret = process.env.xivc_clientSecret

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

function token(host, code, response) {
  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('grant_type', 'authorization_code');
  params.append('code', code);
  params.append('redirect_uri', `https://${host}/login`);

  return fetch('https://discord.com/api/v10/oauth2/token', { method: 'POST', body: params, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
    .then(result => result.json())
    .then(res => {
      if (res.access_token) {
          response.cookie('oauth', res.access_token, { maxAge: res.expires_in, httpOnly: true, secure: true });
          response.cookie('tokenType', res.token_type, { maxAge: res.expires_in, httpOnly: true, secure: true });
          response.cookie('refreshToken', res.refresh_token, { maxAge: 60*60*4*1000, httpOnly: true, secure: true });
      }
      else {
        throw res.error
      }
    })
}

function refresh(request, response) {
  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', request.cookies['refreshToken']);

  return fetch('https://discord.com/api/v10/oauth2/token', { method: 'POST', body: params, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
    .then(result => result.json())
    .then(res => {
      if (res.access_token) {
          response.cookie('oauth', res.access_token, { maxAge: res.expires_in, httpOnly: true, secure: true });
          response.cookie('tokenType', res.token_type, { maxAge: res.expires_in, httpOnly: true, secure: true });
          
          // Allow the cookies to be passed to the next stage after the middleware
          request.cookies['oauth'] = res.access_token;
          request.cookies['tokenType'] = res.token_type;
      }
      else {
        throw res.error
      }
    })
}

function middleware(request, response, next) {
  // Auth is valid and current
  if (request.cookies['oauth']) {
    return next();
  }
  
  if (!request.cookies['refreshToken']) {
    // No auth at all
    return response.redirect('/');
  }

  // Auth expired, but we have a refresh token
  refresh(request, response)
    .then(() => next())
    .catch(err => {
      console.log(err);
      response.redirect('/')
    });
}

module.exports = {
  getAuth: getAuth,
  getHeaderInfo: getHeaderInfo,
  middleware: middleware,
  token: token,
  refresh: refresh
}