module.exports = {
  route: '/status',
  get: (request, response) => response.json({ healthy: true })
}