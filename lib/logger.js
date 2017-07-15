function Logger(level) {
  this.level = parseInt(level) || 7;
  this.log = function log(level, label, msg, argument) {
      if(this.level > level) {
        process.emit(label, argument);

        if(label) {
          label += ': ';
        }
        console.log(`%s %s`, label, msg); // eslint-disable-line
      }
  }
  this.code = function code() {
      this.log(1, '', Array.prototype.join.call(arguments, ','), arguments);
  }
  this.info = function info() {
      this.log(2, 'info', Array.prototype.join.call(arguments, ','), arguments);
  }
  this.miss = function miss() {
      this.log(3, 'miss', Array.prototype.join.call(arguments, ','), arguments)
  }
  this.hit = function hit() {
    this.log(4, 'hit', Array.prototype.join.call(arguments, ','), arguments)
  }
  this.cached = function cached() {
      this.log(5, 'cached', Array.prototype.join.call(arguments, ','), arguments)
  }
  this.request = function request() {
      this.log(6, 'request', Array.prototype.join.call(arguments, ','), arguments)
  }
  this.sync = function sync() {
      this.log(7, 'sync', Array.prototype.join.call(arguments, ','), arguments)
  }
  this.warn = function warn() {
      this.log(8, 'warn', Array.prototype.join.call(arguments, ','), arguments)
  }
  this.error = function error() {
      this.log(9, 'error', Array.prototype.join.call(arguments, ','), arguments)
  }
}
Logger.getLevel = function getLevel(level) {
  if(level) level = level.toLowerCaseString();
  const map = {
    '': 1,
    'info': 2,
    'miss': 3,
    'hit': 4,
    'cached': 5,
    'request': 6,
    'sync': 7,
    'warn': 8,
    'error': 9
  }
  return map[level] || 9;
}
module.exports = Logger;
