const logger = new (require('./logger'))();
const responseTime = require('response-time');

module.exports.request = (req, res, next) => {
  const _responseTime = responseTime((req, res, time) => {
    logger.request(req.method, req.originalUrl, res.statusCode, req._contentLength, time);
  });
  _responseTime(req, res, next);
}
