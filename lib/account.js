const ethUtil = require('ethereumjs-util')
const rlp = require('rlp')

var Account = module.exports = function(data) {

  //Define Properties
  var fields = [{
    name: 'nonce',
    noZero: true,
    default: new Buffer([])
  }, {
    name: 'balance',
    default: new Buffer([])
  }, {
    name: 'stateRoot',
    length: 32,
    default: ethUtil.SHA3_RLP
  }, {
    name: 'codeHash',
    length: 32,
    default: ethUtil.SHA3_NULL
  }]

  ethUtil.defineProperties(this, fields, data)
}

Account.prototype.serialize = function() {
  if (this.balance.toString('hex') === '00') {
    this.balance = null
  }
  return rlp.encode(this.raw)
}

Account.prototype.isContract = function(address) {
  var result = this.codeHash.toString('hex') !== ethUtil.SHA3_NULL
  if (address)
    result |= this.isPrecompiled(address)

  return result
}

Account.isPrecompiled = Account.prototype.isPrecompiled = function(address) {
  var a = ethUtil.unpad(ethUtil.unpad(address))
  return a.length === 1 && a[0] > 0 && a[0] < 5
}

Account.prototype.getCode = function(state, address, cb) {

  if (arguments.length === 2) {
    cb = address
    address = false
  }

  if (address && Account.isPrecompiled(address)) {
    state.db.get(address, function(err, val) {
      cb(err, val, true)
    })
    return
  }

  if (this.codeHash.toString('hex') === ethUtil.SHA3_NULL) {
    cb(null, new Buffer([]))
    return
  }

  state.getRaw(this.codeHash, function(err, val) {
    var compiled = val[0] === 1
    val = val.slice(1)
    cb(err, val, compiled)
  })
}

//TODO: rename to  setCode
Account.prototype.storeCode = function(trie, code, compiled, cb) {

  var self = this

  if (arguments.length === 3) {
    cb = compiled
    compiled = false
  }

  //store code for a new contract
  if (!compiled) {
    this.codeHash = ethUtil.sha3(code)
  }

  //set the compile flag
  code = Buffer.concat([new Buffer([compiled]), code])

  if (this.codeHash.toString('hex') === ethUtil.SHA3_NULL) {
    cb(null, new Buffer([]))
    return
  }
  trie.putRaw(this.codeHash, code, cb)
}

Account.prototype.getStorage = function(trie, key, cb) {
  var t = trie.copy()
  t.root = this.stateroot
  t.get(key, cb)
}

Account.prototype.setStorage = function(trie, key, val, cb) {
  var t = trie.copy()
  t.root = this.stateroot
  t.set(key, val, cb)
}

Account.prototype.isEmpty = function() {
  return this.balance.toString('hex') === '' &&
    this.nonce.toString('hex') === '' &&
    this.stateRoot.toString('hex') === ethUtil.SHA3_RLP &&
    this.codeHash.toString('hex') === ethUtil.SHA3_NULL
}
