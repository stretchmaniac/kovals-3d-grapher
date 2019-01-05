require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('isarray')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var rootParent = {}

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

function typedArraySupport () {
  try {
    var arr = new Uint8Array(1)
    arr.foo = function () { return 42 }
    return arr.foo() === 42 && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */
function Buffer (arg) {
  if (!(this instanceof Buffer)) {
    // Avoid going through an ArgumentsAdaptorTrampoline in the common case.
    if (arguments.length > 1) return new Buffer(arg, arguments[1])
    return new Buffer(arg)
  }

  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    this.length = 0
    this.parent = undefined
  }

  // Common case.
  if (typeof arg === 'number') {
    return fromNumber(this, arg)
  }

  // Slightly less common case.
  if (typeof arg === 'string') {
    return fromString(this, arg, arguments.length > 1 ? arguments[1] : 'utf8')
  }

  // Unusual.
  return fromObject(this, arg)
}

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype
  return arr
}

function fromNumber (that, length) {
  that = allocate(that, length < 0 ? 0 : checked(length) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < length; i++) {
      that[i] = 0
    }
  }
  return that
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') encoding = 'utf8'

  // Assumption: byteLength() return value is always < kMaxLength.
  var length = byteLength(string, encoding) | 0
  that = allocate(that, length)

  that.write(string, encoding)
  return that
}

function fromObject (that, object) {
  if (Buffer.isBuffer(object)) return fromBuffer(that, object)

  if (isArray(object)) return fromArray(that, object)

  if (object == null) {
    throw new TypeError('must start with number, buffer, array or string')
  }

  if (typeof ArrayBuffer !== 'undefined') {
    if (object.buffer instanceof ArrayBuffer) {
      return fromTypedArray(that, object)
    }
    if (object instanceof ArrayBuffer) {
      return fromArrayBuffer(that, object)
    }
  }

  if (object.length) return fromArrayLike(that, object)

  return fromJsonObject(that, object)
}

function fromBuffer (that, buffer) {
  var length = checked(buffer.length) | 0
  that = allocate(that, length)
  buffer.copy(that, 0, 0, length)
  return that
}

function fromArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Duplicate of fromArray() to keep fromArray() monomorphic.
function fromTypedArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  // Truncating the elements is probably not what people expect from typed
  // arrays with BYTES_PER_ELEMENT > 1 but it's compatible with the behavior
  // of the old Buffer constructor.
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array) {
  array.byteLength // this throws if `array` is not a valid ArrayBuffer

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(array)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromTypedArray(that, new Uint8Array(array))
  }
  return that
}

function fromArrayLike (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Deserialize { type: 'Buffer', data: [1,2,3,...] } into a Buffer object.
// Returns a zero-length buffer for inputs that don't conform to the spec.
function fromJsonObject (that, object) {
  var array
  var length = 0

  if (object.type === 'Buffer' && isArray(object.data)) {
    array = object.data
    length = checked(array.length) | 0
  }
  that = allocate(that, length)

  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
  if (typeof Symbol !== 'undefined' && Symbol.species &&
      Buffer[Symbol.species] === Buffer) {
    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
    Object.defineProperty(Buffer, Symbol.species, {
      value: null,
      configurable: true
    })
  }
} else {
  // pre-set for values that may exist in the future
  Buffer.prototype.length = undefined
  Buffer.prototype.parent = undefined
}

function allocate (that, length) {
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that.length = length
  }

  var fromPool = length !== 0 && length <= Buffer.poolSize >>> 1
  if (fromPool) that.parent = rootParent

  return that
}

function checked (length) {
  // Note: cannot use `length < kMaxLength` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (subject, encoding) {
  if (!(this instanceof SlowBuffer)) return new SlowBuffer(subject, encoding)

  var buf = new Buffer(subject, encoding)
  delete buf.parent
  return buf
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) throw new TypeError('list argument must be an Array of Buffers.')

  if (list.length === 0) {
    return new Buffer(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; i++) {
      length += list[i].length
    }
  }

  var buf = new Buffer(length)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

function byteLength (string, encoding) {
  if (typeof string !== 'string') string = '' + string

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'binary':
      // Deprecated
      case 'raw':
      case 'raws':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  start = start | 0
  end = end === undefined || end === Infinity ? this.length : end | 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b)
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset) {
  if (byteOffset > 0x7fffffff) byteOffset = 0x7fffffff
  else if (byteOffset < -0x80000000) byteOffset = -0x80000000
  byteOffset >>= 0

  if (this.length === 0) return -1
  if (byteOffset >= this.length) return -1

  // Negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0)

  if (typeof val === 'string') {
    if (val.length === 0) return -1 // special case: looking for empty string always fails
    return String.prototype.indexOf.call(this, val, byteOffset)
  }
  if (Buffer.isBuffer(val)) {
    return arrayIndexOf(this, val, byteOffset)
  }
  if (typeof val === 'number') {
    if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === 'function') {
      return Uint8Array.prototype.indexOf.call(this, val, byteOffset)
    }
    return arrayIndexOf(this, [ val ], byteOffset)
  }

  function arrayIndexOf (arr, val, byteOffset) {
    var foundIndex = -1
    for (var i = 0; byteOffset + i < arr.length; i++) {
      if (arr[byteOffset + i] === val[foundIndex === -1 ? 0 : i - foundIndex]) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === val.length) return byteOffset + foundIndex
      } else {
        foundIndex = -1
      }
    }
    return -1
  }

  throw new TypeError('val must be string, number or Buffer')
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) throw new Error('Invalid hex string')
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    var swap = encoding
    encoding = offset
    offset = length | 0
    length = swap
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'binary':
        return binaryWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function binarySlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end)
    newBuf.__proto__ = Buffer.prototype
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
  }

  if (newBuf.length) newBuf.parent = this.parent || this

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('index out of range')
  if (offset < 0) throw new RangeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; i--) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; i++) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function fill (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new RangeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new RangeError('start out of bounds')
  if (end < 0 || end > this.length) throw new RangeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; i++) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"base64-js":2,"ieee754":3,"isarray":4}],2:[function(require,module,exports){
'use strict'

exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

function init () {
  var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  for (var i = 0, len = code.length; i < len; ++i) {
    lookup[i] = code[i]
    revLookup[code.charCodeAt(i)] = i
  }

  revLookup['-'.charCodeAt(0)] = 62
  revLookup['_'.charCodeAt(0)] = 63
}

init()

function toByteArray (b64) {
  var i, j, l, tmp, placeHolders, arr
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  placeHolders = b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0

  // base64 is 4/3 + up to two characters of the original data
  arr = new Arr(len * 3 / 4 - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],3:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],4:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],5:[function(require,module,exports){
'use strict'
module.exports = function (ns) {
  // mod
  ns.mod = ns.fmod

  // relational
  ns.lessThan = ns.lt
  ns.lessEqualThan = ns.leq
  ns.greaterThan = ns.gt
  ns.greaterEqualThan = ns.geq

  ns.strictlyEqual = ns.equal
  ns.strictlyNotEqual = ns.notEqual

  ns.logicalAND = function (a, b) {
    return a && b
  }
  ns.logicalXOR = function (a, b) {
    return a ^ b
  }
  ns.logicalOR = function (a, b) {
    return a || b
  }
}

},{}],6:[function(require,module,exports){
/**
 * Created by mauricio on 5/12/15.
 */
'use strict'

var CodeGenerator = require('math-codegen')
var Interval = require('interval-arithmetic')
require('./adapter')(Interval)

function processScope (scope) {
  Object.keys(scope).forEach(function (k) {
    var value = scope[k]
    if (typeof value === 'number' || Array.isArray(value)) {
      scope[k] = Interval.factory(value)
    } else if (typeof value === 'object' && 'lo' in value && 'hi' in value) {
      scope[k] = Interval.factory(value.lo, value.hi)
    }
  })
}

module.exports = function (expression) {
  return new CodeGenerator()
    .setDefs({
      $$processScope: processScope
    })
    .parse(expression)
    .compile(Interval)
}

module.exports.policies = require('./policies')(Interval)
module.exports.Interval = Interval

},{"./adapter":5,"./policies":7,"interval-arithmetic":"interval-arithmetic","math-codegen":8}],7:[function(require,module,exports){
/**
 * Created by mauricio on 5/12/15.
 */
'use strict'
module.exports = function (Interval) {
  return {
    disableRounding: function () {
      Interval.rmath.disable()
    },

    enableRounding: function () {
      Interval.rmath.enable()
    }
  }
}

},{}],8:[function(require,module,exports){
/*
 * math-codegen
 *
 * Copyright (c) 2015 Mauricio Poppe
 * Licensed under the MIT license.
 */
'use strict'
module.exports = require('./lib/CodeGenerator')

},{"./lib/CodeGenerator":9}],9:[function(require,module,exports){
'use strict'

var Parser = require('mr-parser').Parser
var Interpreter = require('./Interpreter')
var extend = require('extend')

function CodeGenerator (options, defs) {
  this.statements = []
  this.defs = defs || {}
  this.interpreter = new Interpreter(this, options)
}

CodeGenerator.prototype.setDefs = function (defs) {
  this.defs = extend(this.defs, defs)
  return this
}

CodeGenerator.prototype.compile = function (namespace) {
  if (!namespace || !(typeof namespace === 'object' || typeof namespace === 'function')) {
    throw TypeError('namespace must be an object')
  }
  if (typeof namespace.factory !== 'function') {
    throw TypeError('namespace.factory must be a function')
  }

  // definitions available in the function
  // each property under this.defs is mapped to local variables
  // e.g
  //
  //  function (defs) {
  //    var ns = defs['ns']
  //    // code generated for the expression
  //  }
  this.defs.ns = namespace
  this.defs.$$mathCodegen = {
    getProperty: function (symbol, scope, ns) {
      if (symbol in scope) {
        return scope[symbol]
      }
      if (symbol in ns) {
        return ns[symbol]
      }
      throw SyntaxError('symbol "' + symbol + '" is undefined')
    },
    functionProxy: function (fn, name) {
      if (typeof fn !== 'function') {
        throw SyntaxError('symbol "' + name + '" must be a function')
      }
      return fn
    }
  }
  this.defs.$$processScope = this.defs.$$processScope || function () {}

  var defsCode = Object.keys(this.defs).map(function (name) {
    return 'var ' + name + ' = defs["' + name + '"]'
  })

  // statement join
  if (!this.statements.length) {
    throw Error('there are no statements saved in this generator, make sure you parse an expression before compiling it')
  }

  // last statement is always a return statement
  this.statements[this.statements.length - 1] = 'return ' + this.statements[this.statements.length - 1]

  var code = this.statements.join(';')
  var factoryCode = defsCode.join('\n') + '\n' + [
    'return {',
    '  eval: function (scope) {',
    '    scope = scope || {}',
    '    $$processScope(scope)',
    '    ' + code,
    '  },',
    "  code: '" + code + "'",
    '}'
  ].join('\n')

  /* eslint-disable */
  var factory = new Function('defs', factoryCode)
  return factory(this.defs)
  /* eslint-enable */
}

CodeGenerator.prototype.parse = function (code) {
  var self = this
  var program = new Parser().parse(code)
  this.statements = program.blocks.map(function (statement) {
    return self.interpreter.next(statement)
  })
  return this
}

module.exports = CodeGenerator

},{"./Interpreter":10,"extend":21,"mr-parser":22}],10:[function(require,module,exports){
'use strict'
var extend = require('extend')

var types = {
  ArrayNode: require('./node/ArrayNode'),
  AssignmentNode: require('./node/AssignmentNode'),
  ConditionalNode: require('./node/ConditionalNode'),
  ConstantNode: require('./node/ConstantNode'),
  FunctionNode: require('./node/FunctionNode'),
  OperatorNode: require('./node/OperatorNode'),
  SymbolNode: require('./node/SymbolNode'),
  UnaryNode: require('./node/UnaryNode')
}

var Interpreter = function (owner, options) {
  this.owner = owner
  this.options = extend({
    factory: 'ns.factory',
    raw: false,
    rawArrayExpressionElements: true,
    rawCallExpressionElements: false
  }, options)
}

extend(Interpreter.prototype, types)

// main method which decides which expression to call
Interpreter.prototype.next = function (node) {
  if (!(node.type in this)) {
    throw new TypeError('the node type ' + node.type + ' is not implemented')
  }
  return this[node.type](node)
}

Interpreter.prototype.rawify = function (test, fn) {
  var oldRaw = this.options.raw
  if (test) {
    this.options.raw = true
  }
  fn()
  if (test) {
    this.options.raw = oldRaw
  }
}

module.exports = Interpreter

},{"./node/ArrayNode":13,"./node/AssignmentNode":14,"./node/ConditionalNode":15,"./node/ConstantNode":16,"./node/FunctionNode":17,"./node/OperatorNode":18,"./node/SymbolNode":19,"./node/UnaryNode":20,"extend":21}],11:[function(require,module,exports){
'use strict'

module.exports = {
  // arithmetic
  '+': 'add',
  '-': 'sub',
  '*': 'mul',
  '/': 'div',
  '^': 'pow',
  '%': 'mod',
  '!': 'factorial',

  // misc operators
  '|': 'bitwiseOR',       // bitwise or
  '^|': 'bitwiseXOR',     // bitwise xor
  '&': 'bitwiseAND',      // bitwise and

  '||': 'logicalOR',      // logical or
  'xor': 'logicalXOR',    // logical xor
  '&&': 'logicalAND',     // logical and

  // comparison
  '<': 'lessThan',
  '>': 'greaterThan',
  '<=': 'lessEqualThan',
  '>=': 'greaterEqualThan',
  '===': 'strictlyEqual',
  '==': 'equal',
  '!==': 'strictlyNotEqual',
  '!=': 'notEqual',

  // shift
  '>>': 'shiftRight',
  '<<': 'shiftLeft',
  '>>>': 'unsignedRightShift'
}

},{}],12:[function(require,module,exports){
'use strict'

module.exports = {
  '+': 'positive',
  '-': 'negative',
  '~': 'oneComplement'
}

},{}],13:[function(require,module,exports){
'use strict'
module.exports = function (node) {
  var self = this
  var arr = []
  this.rawify(this.options.rawArrayExpressionElements, function () {
    arr = node.nodes.map(function (el) {
      return self.next(el)
    })
  })
  var arrString = '[' + arr.join(',') + ']'

  if (this.options.raw) {
    return arrString
  }
  return this.options.factory + '(' + arrString + ')'
}

},{}],14:[function(require,module,exports){
'use strict'

module.exports = function (node) {
  return 'scope["' + node.name + '"] = ' + this.next(node.expr)
}

},{}],15:[function(require,module,exports){
'use strict'

module.exports = function (node) {
  var condition = '!!(' + this.next(node.condition) + ')'
  var trueExpr = this.next(node.trueExpr)
  var falseExpr = this.next(node.falseExpr)
  return '(' + condition + ' ? (' + trueExpr + ') : (' + falseExpr + ') )'
}

},{}],16:[function(require,module,exports){
'use strict'
module.exports = function (node) {
  if (this.options.raw) {
    return node.value
  }
  return this.options.factory + '(' + node.value + ')'
}

},{}],17:[function(require,module,exports){
'use strict'
var SymbolNode = require('mr-parser').nodeTypes.SymbolNode

var functionProxy = function (node) {
  return '$$mathCodegen.functionProxy(' + this.next(new SymbolNode(node.name)) + ', "' + node.name + '")'
}

module.exports = function (node) {
  var self = this
  // wrap in a helper function to detect the type of symbol it must be a function
  // NOTE: if successful the wrapper returns the function itself
  // NOTE: node.name should be a symbol so that it's correctly represented as a string in SymbolNode
  var method = functionProxy.call(this, node)
  var args = []
  this.rawify(this.options.rawCallExpressionElements, function () {
    args = node.args.map(function (arg) {
      return self.next(arg)
    })
  })
  return method + '(' + args.join(', ') + ')'
}

module.exports.functionProxy = functionProxy

},{"mr-parser":22}],18:[function(require,module,exports){
'use strict'

var Operators = require('../misc/Operators')

module.exports = function (node) {
  if (this.options.raw) {
    return ['(' + this.next(node.args[0]), node.op, this.next(node.args[1]) + ')'].join(' ')
  }

  var namedOperator = Operators[node.op]

  if (!namedOperator) {
    throw TypeError('unidentified operator')
  }

  /* eslint-disable new-cap */
  return this.FunctionNode({
    name: namedOperator,
    args: node.args
  })
  /* eslint-enable new-cap */
}

},{"../misc/Operators":11}],19:[function(require,module,exports){
'use strict'

module.exports = function (node) {
  var id = node.name
  return '$$mathCodegen.getProperty("' + id + '", scope, ns)'
}

},{}],20:[function(require,module,exports){
'use strict'

var UnaryOperators = require('../misc/UnaryOperators')

module.exports = function (node) {
  if (this.options.raw) {
    return node.op + this.next(node.argument)
  }

  if (!(node.op in UnaryOperators)) {
    throw new SyntaxError(node.op + ' not implemented')
  }

  var namedOperator = UnaryOperators[node.op]
  /* eslint-disable new-cap */
  return this.FunctionNode({
    name: namedOperator,
    args: [node.argument]
  })
  /* eslint-enable new-cap */
}

},{"../misc/UnaryOperators":12}],21:[function(require,module,exports){
'use strict';

var hasOwn = Object.prototype.hasOwnProperty;
var toStr = Object.prototype.toString;

var isArray = function isArray(arr) {
	if (typeof Array.isArray === 'function') {
		return Array.isArray(arr);
	}

	return toStr.call(arr) === '[object Array]';
};

var isPlainObject = function isPlainObject(obj) {
	if (!obj || toStr.call(obj) !== '[object Object]') {
		return false;
	}

	var hasOwnConstructor = hasOwn.call(obj, 'constructor');
	var hasIsPrototypeOf = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
	// Not own constructor property must be Object
	if (obj.constructor && !hasOwnConstructor && !hasIsPrototypeOf) {
		return false;
	}

	// Own properties are enumerated firstly, so to speed up,
	// if last one is own, then all properties are own.
	var key;
	for (key in obj) {/**/}

	return typeof key === 'undefined' || hasOwn.call(obj, key);
};

module.exports = function extend() {
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[0],
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if (typeof target === 'boolean') {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	} else if ((typeof target !== 'object' && typeof target !== 'function') || target == null) {
		target = {};
	}

	for (; i < length; ++i) {
		options = arguments[i];
		// Only deal with non-null/undefined values
		if (options != null) {
			// Extend the base object
			for (name in options) {
				src = target[name];
				copy = options[name];

				// Prevent never-ending loop
				if (target !== copy) {
					// Recurse if we're merging plain objects or arrays
					if (deep && copy && (isPlainObject(copy) || (copyIsArray = isArray(copy)))) {
						if (copyIsArray) {
							copyIsArray = false;
							clone = src && isArray(src) ? src : [];
						} else {
							clone = src && isPlainObject(src) ? src : {};
						}

						// Never move original objects, clone them
						target[name] = extend(deep, clone, copy);

					// Don't bring in undefined values
					} else if (typeof copy !== 'undefined') {
						target[name] = copy;
					}
				}
			}
		}
	}

	// Return the modified object
	return target;
};


},{}],22:[function(require,module,exports){
/*
 * mr-parser
 *
 * Copyright (c) 2015 Mauricio Poppe
 * Licensed under the MIT license.
 */

'use strict'

module.exports.Lexer = require('./lib/Lexer')
module.exports.Parser = require('./lib/Parser')
module.exports.nodeTypes = require('./lib/node/')

},{"./lib/Lexer":23,"./lib/Parser":24,"./lib/node/":35}],23:[function(require,module,exports){
// token types
var tokenType = require('./token-type')

var ESCAPES = {
  'n': '\n',
  'f': '\f',
  'r': '\r',
  't': '\t',
  'v': '\v',
  '\'': '\'',
  '"': '"'
}

var DELIMITERS = {
  ',': true,
  '(': true,
  ')': true,
  '[': true,
  ']': true,
  ';': true,

  // unary
  '~': true,

  // factorial
  '!': true,

  // arithmetic operators
  '+': true,
  '-': true,
  '*': true,
  '/': true,
  '%': true,
  '^': true,
  '**': true,     // python power like

  // misc operators
  '|': true,      // bitwise or
  '&': true,      // bitwise and
  '^|': true,     // bitwise xor
  '=': true,
  ':': true,
  '?': true,

  '||': true,      // logical or
  '&&': true,      // logical and
  'xor': true,     // logical xor

  // relational
  '==': true,
  '!=': true,
  '===': true,
  '!==': true,
  '<': true,
  '>': true,
  '>=': true,
  '<=': true,

  // shifts
  '>>>': true,
  '<<': true,
  '>>': true
}

// helpers

function isDigit (c) {
  return c >= '0' && c <= '9'
}

function isIdentifier (c) {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
    c === '$' || c === '_'
}

function isWhitespace (c) {
  return c === ' ' || c === '\r' || c === '\t' ||
    c === '\n' || c === '\v' || c === '\u00A0'
}

function isDelimiter (str) {
  return DELIMITERS[str]
}

function isQuote (c) {
  return c === '\'' || c === '"'
}

// lexer

function Lexer () {}

Lexer.prototype.throwError = function (message, index) {
  index = typeof index === 'undefined' ? this.index : index

  var error = new Error(message + ' at index ' + index)
  error.index = index
  error.description = message
  throw error
}

Lexer.prototype.lex = function (text) {
  this.text = text
  this.index = 0
  this.tokens = []

  while (this.index < this.text.length) {
    // skip whitespaces
    while (isWhitespace(this.peek())) {
      this.consume()
    }
    var c = this.peek()
    var c2 = c + this.peek(1)
    var c3 = c2 + this.peek(2)

    // order
    // - delimiter of 3 characters
    // - delimiter of 2 characters
    // - delimiter of 1 character
    // - number
    // - variables, functions and named operators
    if (isDelimiter(c3)) {
      this.tokens.push({
        type: tokenType.DELIMITER,
        value: c3
      })
      this.consume()
      this.consume()
      this.consume()
    } else if (isDelimiter(c2)) {
      this.tokens.push({
        type: tokenType.DELIMITER,
        value: c2
      })
      this.consume()
      this.consume()
    } else if (isDelimiter(c)) {
      this.tokens.push({
        type: tokenType.DELIMITER,
        value: c
      })
      this.consume()
    } else if (isDigit(c) ||
        (c === '.' && isDigit(this.peek(1)))) {
      this.tokens.push({
        type: tokenType.NUMBER,
        value: this.readNumber()
      })
    } else if (isQuote(c)) {
      this.tokens.push({
        type: tokenType.STRING,
        value: this.readString()
      })
    } else if (isIdentifier(c)) {
      this.tokens.push({
        type: tokenType.SYMBOL,
        value: this.readIdentifier()
      })
    } else {
      this.throwError('unexpected character ' + c)
    }
  }

  // end token
  this.tokens.push({ type: tokenType.EOF })

  return this.tokens
}

Lexer.prototype.peek = function (nth) {
  nth = nth || 0
  if (this.index + nth >= this.text.length) {
    return
  }
  return this.text.charAt(this.index + nth)
}

Lexer.prototype.consume = function () {
  var current = this.peek()
  this.index += 1
  return current
}

Lexer.prototype.readNumber = function () {
  var number = ''

  if (this.peek() === '.') {
    number += this.consume()
    if (!isDigit(this.peek())) {
      this.throwError('number expected')
    }
  } else {
    while (isDigit(this.peek())) {
      number += this.consume()
    }
    if (this.peek() === '.') {
      number += this.consume()
    }
  }

  // numbers after the decimal dot
  while (isDigit(this.peek())) {
    number += this.consume()
  }

  // exponent if available
  if ((this.peek() === 'e' || this.peek() === 'E')) {
    number += this.consume()

    if (!(isDigit(this.peek()) ||
        this.peek() === '+' ||
        this.peek() === '-')) {
      this.throwError()
    }

    if (this.peek() === '+' || this.peek() === '-') {
      number += this.consume()
    }

    if (!isDigit(this.peek())) {
      this.throwError('number expected')
    }

    while (isDigit(this.peek())) {
      number += this.consume()
    }
  }
  return number
}

Lexer.prototype.readIdentifier = function () {
  var text = ''
  while (isIdentifier(this.peek()) || isDigit(this.peek())) {
    text += this.consume()
  }
  return text
}

Lexer.prototype.readString = function () {
  var quote = this.consume()
  var string = ''
  var escape
  while (true) {
    var c = this.consume()
    if (!c) {
      this.throwError('string is not closed')
    }
    if (escape) {
      if (c === 'u') {
        var hex = this.text.substring(this.index + 1, this.index + 5)
        if (!hex.match(/[\da-f]{4}/i)) {
          this.throwError('invalid unicode escape')
        }
        this.index += 4
        string += String.fromCharCode(parseInt(hex, 16))
      } else {
        var replacement = ESCAPES[c]
        if (replacement) {
          string += replacement
        } else {
          string += c
        }
      }
      escape = false
    } else if (c === quote) {
      break
    } else if (c === '\\') {
      escape = true
    } else {
      string += c
    }
  }
  return string
}

module.exports = Lexer

},{"./token-type":36}],24:[function(require,module,exports){
var tokenType = require('./token-type')

var Lexer = require('./Lexer')
var ConstantNode = require('./node/ConstantNode')
var OperatorNode = require('./node/OperatorNode')
var UnaryNode = require('./node/UnaryNode')
var SymbolNode = require('./node/SymbolNode')
var FunctionNode = require('./node/FunctionNode')
var ArrayNode = require('./node/ArrayNode')
var ConditionalNode = require('./node/ConditionalNode')
var AssignmentNode = require('./node/AssignmentNode')
var BlockNode = require('./node/BlockNode')

/**
 * Grammar DSL:
 *
 * program          : block (; block)*
 *
 * block            : assignment
 *
 * assignment       : ternary
 *                  | symbol `=` assignment
 *
 * ternary          : logicalOR
 *                  | logicalOR `?` ternary `:` ternary
 *
 * logicalOR        : logicalXOR
 *                  | logicalXOR (`||`,`or`) logicalOR
 *
 * logicalXOR       : logicalAND
 *                  : logicalAND `xor` logicalXOR
 *
 * logicalAND       : bitwiseOR
 *                  | bitwiseOR (`&&`,`and`) logicalAND
 *
 * bitwiseOR        : bitwiseXOR
 *                  | bitwiseXOR `|` bitwiseOR
 *
 * bitwiseXOR       : bitwiseAND
 *                  | bitwiseAND `^|` bitwiseXOR
 *
 * bitwiseAND       : relational
 *                  | relational `&` bitwiseAND
 *
 * relational       : shift
 *                  | shift (`!=` | `==` | `>` | '<' | '<=' |'>=') shift)
 *
 * shift            : additive
 *                  | additive (`>>` | `<<` | `>>>`) shift
 *
 * additive         : multiplicative
 *                  | multiplicative (`+` | `-`) additive
 *
 * multiplicative   : unary
 *                  | unary (`*` | `/` | `%`) unary
 *                  | unary symbol
 *
 * unary            : pow
 *                  | (`-` | `+` | `~`) unary
 *
 * pow              : factorial
 *                  | factorial (`^`, '**') unary
 *
 * factorial        : symbol
 *                  | symbol (`!`)
 *
 * symbol           : symbolToken
 *                  | symbolToken functionCall
 *                  | string
 *
 * functionCall     : `(` `)`
 *                  | `(` ternary (, ternary)* `)`
 *
 * string           : `'` (character)* `'`
 *                  : `"` (character)* `"`
 *                  | array
 *
 * array            : `[` `]`
 *                  | `[` assignment (, assignment)* `]`
 *                  | number
 *
 * number           : number-token
 *                  | parentheses
 *
 * parentheses      : `(` assignment `)`
 *                  : end
 *
 * end              : NULL
 *
 * @param {[type]} lexer [description]
 */
function Parser () {
  this.lexer = new Lexer()
  this.tokens = null
}

Parser.prototype.current = function () {
  return this.tokens[0]
}

Parser.prototype.next = function () {
  return this.tokens[1]
}

Parser.prototype.peek = function () {
  if (this.tokens.length) {
    var first = this.tokens[0]
    for (var i = 0; i < arguments.length; i += 1) {
      if (first.value === arguments[i]) {
        return true
      }
    }
  }
}

Parser.prototype.consume = function (e) {
  return this.tokens.shift()
}

Parser.prototype.expect = function (e) {
  if (!this.peek(e)) {
    throw Error('expected ' + e)
  }
  return this.consume()
}

Parser.prototype.isEOF = function () {
  return this.current().type === tokenType.EOF
}

Parser.prototype.parse = function (text) {
  this.tokens = this.lexer.lex(text)
  return this.program()
}

Parser.prototype.program = function () {
  var blocks = []
  while (!this.isEOF()) {
    blocks.push(this.assignment())
    if (this.peek(';')) {
      this.consume()
    }
  }
  this.end()
  return new BlockNode(blocks)
}

Parser.prototype.assignment = function () {
  var left = this.ternary()
  if (left instanceof SymbolNode && this.peek('=')) {
    this.consume()
    return new AssignmentNode(left.name, this.assignment())
  }
  return left
}

Parser.prototype.ternary = function () {
  var predicate = this.logicalOR()
  if (this.peek('?')) {
    this.consume()
    var truthy = this.ternary()
    this.expect(':')
    var falsy = this.ternary()
    return new ConditionalNode(predicate, truthy, falsy)
  }
  return predicate
}

Parser.prototype.logicalOR = function () {
  var left = this.logicalXOR()
  if (this.peek('||')) {
    var op = this.consume()
    var right = this.logicalOR()
    return new OperatorNode(op.value, [left, right])
  }
  return left
}

Parser.prototype.logicalXOR = function () {
  var left = this.logicalAND()
  if (this.current().value === 'xor') {
    var op = this.consume()
    var right = this.logicalXOR()
    return new OperatorNode(op.value, [left, right])
  }
  return left
}

Parser.prototype.logicalAND = function () {
  var left = this.bitwiseOR()
  if (this.peek('&&')) {
    var op = this.consume()
    var right = this.logicalAND()
    return new OperatorNode(op.value, [left, right])
  }
  return left
}

Parser.prototype.bitwiseOR = function () {
  var left = this.bitwiseXOR()
  if (this.peek('|')) {
    var op = this.consume()
    var right = this.bitwiseOR()
    return new OperatorNode(op.value, [left, right])
  }
  return left
}

Parser.prototype.bitwiseXOR = function () {
  var left = this.bitwiseAND()
  if (this.peek('^|')) {
    var op = this.consume()
    var right = this.bitwiseXOR()
    return new OperatorNode(op.value, [left, right])
  }
  return left
}

Parser.prototype.bitwiseAND = function () {
  var left = this.relational()
  if (this.peek('&')) {
    var op = this.consume()
    var right = this.bitwiseAND()
    return new OperatorNode(op.value, [left, right])
  }
  return left
}

Parser.prototype.relational = function () {
  var left = this.shift()
  if (this.peek('==', '===', '!=', '!==', '>=', '<=', '>', '<')) {
    var op = this.consume()
    var right = this.shift()
    return new OperatorNode(op.value, [left, right])
  }
  return left
}

Parser.prototype.shift = function () {
  var left = this.additive()
  if (this.peek('>>', '<<', '>>>')) {
    var op = this.consume()
    var right = this.shift()
    return new OperatorNode(op.value, [left, right])
  }
  return left
}

Parser.prototype.additive = function () {
  var left = this.multiplicative()
  while (this.peek('+', '-')) {
    var op = this.consume()
    left = new OperatorNode(op.value, [left, this.multiplicative()])
  }
  return left
}

Parser.prototype.multiplicative = function () {
  var op, right
  var left = this.unary()
  while (this.peek('*', '/', '%')) {
    op = this.consume()
    left = new OperatorNode(op.value, [left, this.unary()])
  }

  // implicit multiplication
  // - 2 x
  // - 2(x)
  // - (2)2
  if (this.current().type === tokenType.SYMBOL ||
      this.peek('(') ||
      (!(left.type instanceof ConstantNode) && this.current().type === tokenType.NUMBER)
      ) {
    right = this.multiplicative()
    return new OperatorNode('*', [left, right])
  }

  return left
}

Parser.prototype.unary = function () {
  if (this.peek('-', '+', '~')) {
    var op = this.consume()
    var right = this.unary()
    return new UnaryNode(op.value, right)
  }
  return this.pow()
}

Parser.prototype.pow = function () {
  var left = this.factorial()
  if (this.peek('^', '**')) {
    var op = this.consume()
    var right = this.unary()
    return new OperatorNode(op.value, [left, right])
  }
  return left
}

Parser.prototype.factorial = function () {
  var left = this.symbol()
  if (this.peek('!')) {
    var op = this.consume()
    return new OperatorNode(op.value, [left])
  }
  return left
}

Parser.prototype.symbol = function () {
  var current = this.current()
  if (current.type === tokenType.SYMBOL) {
    var symbol = this.consume()
    var node = this.functionCall(symbol)
    return node
  }
  return this.string()
}

Parser.prototype.functionCall = function (symbolToken) {
  var name = symbolToken.value
  if (this.peek('(')) {
    this.consume()
    var params = []
    while (!this.peek(')') && !this.isEOF()) {
      params.push(this.assignment())
      if (this.peek(',')) {
        this.consume()
      }
    }
    this.expect(')')
    return new FunctionNode(name, params)
  }
  return new SymbolNode(name)
}

Parser.prototype.string = function () {
  if (this.current().type === tokenType.STRING) {
    return new ConstantNode(this.consume().value, 'string')
  }
  return this.array()
}

Parser.prototype.array = function () {
  if (this.peek('[')) {
    this.consume()
    var params = []
    while (!this.peek(']') && !this.isEOF()) {
      params.push(this.assignment())
      if (this.peek(',')) {
        this.consume()
      }
    }
    this.expect(']')
    return new ArrayNode(params)
  }
  return this.number()
}

Parser.prototype.number = function () {
  var token = this.current()
  if (token.type === tokenType.NUMBER) {
    return new ConstantNode(this.consume().value, 'number')
  }
  return this.parentheses()
}

Parser.prototype.parentheses = function () {
  var token = this.current()
  if (token.value === '(') {
    this.consume()
    var left = this.assignment()
    this.expect(')')
    return left
  }
  return this.end()
}

Parser.prototype.end = function () {
  var token = this.current()
  if (token.type !== tokenType.EOF) {
    throw Error('unexpected end of expression')
  }
}

module.exports = Parser

},{"./Lexer":23,"./node/ArrayNode":25,"./node/AssignmentNode":26,"./node/BlockNode":27,"./node/ConditionalNode":28,"./node/ConstantNode":29,"./node/FunctionNode":30,"./node/OperatorNode":32,"./node/SymbolNode":33,"./node/UnaryNode":34,"./token-type":36}],25:[function(require,module,exports){
var Node = require('./Node')

function ArrayNode (nodes) {
  this.nodes = nodes
}

ArrayNode.prototype = Object.create(Node.prototype)

ArrayNode.prototype.type = 'ArrayNode'

module.exports = ArrayNode

},{"./Node":31}],26:[function(require,module,exports){
var Node = require('./Node')

function AssignmentNode (name, expr) {
  this.name = name
  this.expr = expr
}

AssignmentNode.prototype = Object.create(Node.prototype)

AssignmentNode.prototype.type = 'AssignmentNode'

module.exports = AssignmentNode

},{"./Node":31}],27:[function(require,module,exports){
var Node = require('./Node')

function BlockNode (blocks) {
  this.blocks = blocks
}

BlockNode.prototype = Object.create(Node.prototype)

BlockNode.prototype.type = 'BlockNode'

module.exports = BlockNode

},{"./Node":31}],28:[function(require,module,exports){
var Node = require('./Node')

function ConditionalNode (predicate, truthy, falsy) {
  this.condition = predicate
  this.trueExpr = truthy
  this.falseExpr = falsy
}

ConditionalNode.prototype = Object.create(Node.prototype)

ConditionalNode.prototype.type = 'ConditionalNode'

module.exports = ConditionalNode

},{"./Node":31}],29:[function(require,module,exports){
var Node = require('./Node')

var SUPPORTED_TYPES = {
  number: true,
  string: true,
  'boolean': true,
  'undefined': true,
  'null': true
}

function ConstantNode (value, type) {
  if (!SUPPORTED_TYPES[type]) {
    throw Error('unsupported type \'' + type + '\'')
  }
  this.value = value
  this.valueType = type
}

ConstantNode.prototype = Object.create(Node.prototype)

ConstantNode.prototype.type = 'ConstantNode'

module.exports = ConstantNode

},{"./Node":31}],30:[function(require,module,exports){
var Node = require('./Node')

function FunctionNode (name, args) {
  this.name = name
  this.args = args
}

FunctionNode.prototype = Object.create(Node.prototype)

FunctionNode.prototype.type = 'FunctionNode'

module.exports = FunctionNode

},{"./Node":31}],31:[function(require,module,exports){
function Node () {

}

Node.prototype.type = 'Node'

module.exports = Node

},{}],32:[function(require,module,exports){
var Node = require('./Node')

function OperatorNode (op, args) {
  this.op = op
  this.args = args || []
}

OperatorNode.prototype = Object.create(Node.prototype)

OperatorNode.prototype.type = 'OperatorNode'

module.exports = OperatorNode

},{"./Node":31}],33:[function(require,module,exports){
var Node = require('./Node')

function SymbolNode (name) {
  this.name = name
}

SymbolNode.prototype = Object.create(Node.prototype)

SymbolNode.prototype.type = 'SymbolNode'

module.exports = SymbolNode

},{"./Node":31}],34:[function(require,module,exports){
var Node = require('./Node')

function UnaryNode (op, argument) {
  this.op = op
  this.argument = argument
}

UnaryNode.prototype = Object.create(Node.prototype)

UnaryNode.prototype.type = 'UnaryNode'

module.exports = UnaryNode

},{"./Node":31}],35:[function(require,module,exports){
module.exports = {
  ArrayNode: require('./ArrayNode'),
  AssignmentNode: require('./AssignmentNode'),
  BlockNode: require('./BlockNode'),
  ConditionalNode: require('./ConditionalNode'),
  ConstantNode: require('./ConstantNode'),
  FunctionNode: require('./FunctionNode'),
  Node: require('./Node'),
  OperatorNode: require('./OperatorNode'),
  SymbolNode: require('./SymbolNode'),
  UnaryNode: require('./UnaryNode')
}

},{"./ArrayNode":25,"./AssignmentNode":26,"./BlockNode":27,"./ConditionalNode":28,"./ConstantNode":29,"./FunctionNode":30,"./Node":31,"./OperatorNode":32,"./SymbolNode":33,"./UnaryNode":34}],36:[function(require,module,exports){
module.exports = {
  EOF: 0,
  DELIMITER: 1,
  NUMBER: 2,
  STRING: 3,
  SYMBOL: 4
}

},{}],37:[function(require,module,exports){
/**
 * Created by mauricio on 5/11/15.
 */
'use strict'
var Interval = require('./interval')

var piLow = (3373259426.0 + 273688.0 / (1 << 21)) / (1 << 30)
var piHigh = (3373259426.0 + 273689.0 / (1 << 21)) / (1 << 30)

var constants = {}

constants.PI_LOW = piLow
constants.PI_HIGH = piHigh
constants.PI_HALF_LOW = piLow / 2
constants.PI_HALF_HIGH = piHigh / 2
constants.PI_TWICE_LOW = piLow * 2
constants.PI_TWICE_HIGH = piHigh * 2

function getter (property, fn) {
  Object.defineProperty(constants, property, {
    get: function () {
      return fn()
    },
    enumerable: true
  })
}

// intervals
getter('PI', function () {
  return Interval(piLow, piHigh)
})
getter('PI_HALF', function () {
  return Interval(constants.PI_HALF_LOW, constants.PI_HALF_HIGH)
})
getter('PI_TWICE', function () {
  return Interval(constants.PI_TWICE_LOW, constants.PI_TWICE_HIGH)
})
getter('ZERO', function () {
  return Interval(0)
})
getter('ONE', function () {
  return Interval(1)
})
getter('WHOLE', function () {
  return Interval().setWhole()
})
getter('EMPTY', function () {
  return Interval().setEmpty()
})

module.exports = constants

},{"./interval":38}],38:[function(require,module,exports){
/**
 * Created by mauricio on 4/27/15.
 */
'use strict'
var utils = require('./operations/utils')
var rmath = require('./round-math')

module.exports = Interval

function Interval (lo, hi) {
  if (!(this instanceof Interval)) {
    return new Interval(lo, hi)
  }

  if (typeof lo !== 'undefined' && typeof hi !== 'undefined') {
    // possible cases:
    // - Interval(1, 2)
    // - Interval(Interval(1, 1), Interval(2, 2))     // singletons are required
    if (utils.isInterval(lo)) {
      if (!utils.isSingleton(lo)) {
        throw new TypeError('Interval: interval `lo` must be a singleton')
      }
      lo = lo.lo
    }
    if (utils.isInterval(hi)) {
      if (!utils.isSingleton(hi)) {
        throw TypeError('Interval: interval `hi` must be a singleton')
      }
      hi = hi.hi
    }
  } else if (typeof lo !== 'undefined') {
    // possible cases:
    // - Interval(1)
    // - Interval([1, 2])
    // - Interval([Interval(1, 1), Interval(2, 2)])
    if (Array.isArray(lo)) {
      return Interval(lo[0], lo[1])
    }
    return Interval(lo, lo)
  } else {
    // possible cases:
    // - Interval()
    lo = hi = 0
  }

  this.assign(lo, hi)
}

Interval.factory = Interval

Interval.prototype.singleton = function (v) {
  return this.set(v, v)
}

Interval.prototype.bounded = function (lo, hi) {
  return this.set(rmath.prev(lo), rmath.next(hi))
}

Interval.prototype.boundedSingleton = function (v) {
  return this.bounded(v, v)
}

Interval.prototype.set = function (lo, hi) {
  this.lo = lo
  this.hi = hi
  return this
}

Interval.prototype.assign = function (lo, hi) {
  if (typeof lo !== 'number' || typeof hi !== 'number') {
    throw TypeError('Interval#assign: arguments must be numbers')
  }
  if (isNaN(lo) || isNaN(hi) || lo > hi) {
    return this.setEmpty()
  }
  return this.set(lo, hi)
}

Interval.prototype.setEmpty = function () {
  return this.set(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY)
}

Interval.prototype.setWhole = function () {
  return this.set(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY)
}

Interval.prototype.toArray = function () {
  return [this.lo, this.hi]
}

Interval.prototype.clone = function () {
  return Interval(this.lo, this.hi)
}

},{"./operations/utils":45,"./round-math":47}],39:[function(require,module,exports){
/**
 * Created by mauricio on 5/11/15.
 */
'use strict'

var isSafeInteger = require('is-safe-integer')

var Interval = require('../interval')
var rmath = require('../round-math')
var utils = require('./utils')
var arithmetic = require('./arithmetic')
var constants = require('../constants')

var algebra = {}

/**
 * Computes x mod y
 * @param x
 * @param y
 */
algebra.fmod = function (x, y) {
  if (utils.isEmpty(x) || utils.isEmpty(y)) {
    return constants.EMPTY
  }
  var yb = x.lo < 0 ? y.lo : y.hi
  var n = rmath.intLo(rmath.divLo(x.lo, yb))
  // x mod y = x - n * y
  return arithmetic.sub(x, arithmetic.mul(y, Interval(n, n)))
}

/**
 * Computes 1 / x
 * @param {Interval} x
 * @returns {Interval}
 */
algebra.multiplicativeInverse = function (x) {
  if (utils.isEmpty(x)) { return constants.EMPTY }
  if (utils.zeroIn(x)) {
    if (x.lo !== 0) {
      if (x.hi !== 0) {
        return constants.WHOLE
      } else {
        return Interval(
          Number.NEGATIVE_INFINITY,
          rmath.divHi(1, x.lo)
        )
      }
    } else {
      if (x.hi !== 0) {
        return Interval(
          rmath.divLo(1, x.hi),
          Number.POSITIVE_INFINITY
        )
      } else {
        return constants.EMPTY
      }
    }
  } else {
    return Interval(
      rmath.divLo(1, x.hi),
      rmath.divHi(1, x.lo)
    )
  }
}

/**
 * Computes x^power given that power is an integer
 *
 * If `power` is an Interval it must be a singletonInterval i.e. x^x is not
 * supported yet
 *
 * @param {Interval} x
 * @param {number|Interval} power
 * @returns {Interval}
 */
algebra.pow = function (x, power) {
  if (utils.isEmpty(x)) {
    return constants.EMPTY
  }
  if (typeof power === 'object') {
    if (!utils.isSingleton(power)) {
      return constants.EMPTY
    }
    power = power.lo
  }

  if (power === 0) {
    if (x.lo === 0 && x.hi === 0) {
      // 0^0
      return constants.EMPTY
    } else {
      // x^0
      return constants.ONE
    }
  } else if (power < 0) {
    // compute 1 / x^-power if power is negative
    return algebra.multiplicativeInverse(algebra.pow(x, -power))
  }

  // power > 0
  if (isSafeInteger(power)) {
    // power is integer
    if (x.hi < 0) {
      // [negative, negative]
      // assume that power is even so the operation will yield a positive interval
      // if not then just switch the sign and order of the interval bounds
      var yl = rmath.powLo(-x.hi, power)
      var yh = rmath.powHi(-x.lo, power)
      if (power & 1) {
        // odd power
        return Interval(-yh, -yl)
      } else {
        // even power
        return Interval(yl, yh)
      }
    } else if (x.lo < 0) {
      // [negative, positive]
      if (power & 1) {
        return Interval(
          -rmath.powLo(-x.lo, power),
          rmath.powHi(x.hi, power)
        )
      } else {
        // even power means that any negative number will be zero (min value = 0)
        // and the max value will be the max of x.lo^power, x.hi^power
        return Interval(
          0,
          rmath.powHi(Math.max(-x.lo, x.hi), power)
        )
      }
    } else {
      // [positive, positive]
      return Interval(
        rmath.powLo(x.lo, power),
        rmath.powHi(x.hi, power)
      )
    }
  } else {
    console.warn('power is not an integer, you should use nth-root instead, returning an empty interval')
    return constants.EMPTY
  }
}

/**
 * Computes sqrt(x)
 * @param {Interval} x
 * @returns {Interval}
 */
algebra.sqrt = function (x) {
  return algebra.nthRoot(x, 2)
}

/**
 * Computes x^(1/n)
 *
 * @param {Interval} x
 * @param {number} n - An integer which is the nth root of x
 * @return {Interval}
 */
algebra.nthRoot = function (x, n) {
  if (utils.isEmpty(x) || n < 0) {
    // compute 1 / x^-power if power is negative
    return constants.EMPTY
  }

  // singleton interval check
  if (typeof n === 'object') {
    if (!utils.isSingleton(n)) {
      return constants.EMPTY
    }
    n = n.lo
  }

  var power = 1 / n
  if (x.hi < 0) {
    // [negative, negative]
    if (isSafeInteger(n) & (n & 1)) {
      // when n is odd we can always take the nth root
      var yl = rmath.powHi(-x.lo, power)
      var yh = rmath.powLo(-x.hi, power)
      return Interval(-yl, -yh)
    }
    // n is not odd therefore there's no nth root
    return Interval.EMPTY
  } else if (x.lo < 0) {
    // [negative, positive]
    var yp = rmath.powHi(x.hi, power)
    if (isSafeInteger(n) & (n & 1)) {
      // nth root of x.lo is possible (n is odd)
      var yn = rmath.powHi(-x.lo, power)
      return Interval(0, Math.max(yn, yp))
    }
    return Interval(0, yp)
  } else {
    // [positive, positive]
    return Interval(
      rmath.powLo(x.lo, power),
      rmath.powHi(x.hi, power)
    )
  }
}

module.exports = algebra

},{"../constants":37,"../interval":38,"../round-math":47,"./arithmetic":40,"./utils":45,"is-safe-integer":48}],40:[function(require,module,exports){
/**
 * Created by mauricio on 5/10/15.
 */
'use strict'
var Interval = require('../interval')
var rmath = require('../round-math')
var utils = require('./utils')
var constants = require('../constants')
var division = require('./division')

var arithmetic = {}

// BINARY
arithmetic.add = function (a, b) {
  return Interval(
    rmath.addLo(a.lo, b.lo),
    rmath.addHi(a.hi, b.hi)
  )
}

arithmetic.sub = function (a, b) {
  return Interval(
    rmath.subLo(a.lo, b.hi),
    rmath.subHi(a.hi, b.lo)
  )
}

arithmetic.mul = function (a, b) {
  if (utils.isEmpty(a) || utils.isEmpty(b)) {
    return constants.EMPTY
  }
  var al = a.lo
  var ah = a.hi
  var bl = b.lo
  var bh = b.hi
  var out = Interval()
  if (al < 0) {
    if (ah > 0) {
      if (bl < 0) {
        if (bh > 0) {
          // mixed * mixed
          out.lo = Math.min(rmath.mulLo(al, bh), rmath.mulLo(ah, bl))
          out.hi = Math.max(rmath.mulHi(al, bl), rmath.mulHi(ah, bh))
        } else {
          // mixed * negative
          out.lo = rmath.mulLo(ah, bl)
          out.hi = rmath.mulHi(al, bl)
        }
      } else {
        if (bh > 0) {
          // mixed * positive
          out.lo = rmath.mulLo(al, bh)
          out.hi = rmath.mulHi(ah, bh)
        } else {
          // mixed * zero
          out.lo = 0
          out.hi = 0
        }
      }
    } else {
      if (bl < 0) {
        if (bh > 0) {
          // negative * mixed
          out.lo = rmath.mulLo(al, bh)
          out.hi = rmath.mulHi(al, bl)
        } else {
          // negative * negative
          out.lo = rmath.mulLo(ah, bh)
          out.hi = rmath.mulHi(al, bl)
        }
      } else {
        if (bh > 0) {
          // negative * positive
          out.lo = rmath.mulLo(al, bh)
          out.hi = rmath.mulHi(ah, bl)
        } else {
          // negative * zero
          out.lo = 0
          out.hi = 0
        }
      }
    }
  } else {
    if (ah > 0) {
      if (bl < 0) {
        if (bh > 0) {
          // positive * mixed
          out.lo = rmath.mulLo(ah, bl)
          out.hi = rmath.mulHi(ah, bh)
        } else {
          // positive * negative
          out.lo = rmath.mulLo(ah, bl)
          out.hi = rmath.mulHi(al, bh)
        }
      } else {
        if (bh > 0) {
          // positive * positive
          out.lo = rmath.mulLo(al, bl)
          out.hi = rmath.mulHi(ah, bh)
        } else {
          // positive * zero
          out.lo = 0
          out.hi = 0
        }
      }
    } else {
      // zero * any other value
      out.lo = 0
      out.hi = 0
    }
  }
  return out
}

arithmetic.div = function (a, b) {
  if (utils.isEmpty(a) || utils.isEmpty(b)) {
    return constants.EMPTY
  }
  if (utils.zeroIn(b)) {
    if (b.lo !== 0) {
      if (b.hi !== 0) {
        return division.zero(a)
      } else {
        return division.negative(a, b.lo)
      }
    } else {
      if (b.hi !== 0) {
        return division.positive(a, b.hi)
      } else {
        return constants.EMPTY
      }
    }
  } else {
    return division.nonZero(a, b)
  }
}

// UNARY
arithmetic.positive = function (a) {
  return Interval(a.lo, a.hi)
}

arithmetic.negative = function (a) {
  return Interval(-a.hi, -a.lo)
}

module.exports = arithmetic

},{"../constants":37,"../interval":38,"../round-math":47,"./division":41,"./utils":45}],41:[function(require,module,exports){
/**
 * Created by mauricio on 5/10/15.
 */
'use strict'
var Interval = require('../interval')
var rmath = require('../round-math')
var utils = require('./utils')
var constants = require('../constants')

var division = {
  /**
   * Division between intervals when `y` doesn't contain zero
   * @param {Interval} x
   * @param {Interval} y
   * @returns {Interval}
   */
  nonZero: function (x, y) {
    var xl = x.lo
    var xh = x.hi
    var yl = y.lo
    var yh = y.hi
    var out = Interval()
    if (xh < 0) {
      if (yh < 0) {
        out.lo = rmath.divLo(xh, yl)
        out.hi = rmath.divHi(xl, yh)
      } else {
        out.lo = rmath.divLo(xl, yl)
        out.hi = rmath.divHi(xh, yh)
      }
    } else if (xl < 0) {
      if (yh < 0) {
        out.lo = rmath.divLo(xh, yh)
        out.hi = rmath.divHi(xl, yh)
      } else {
        out.lo = rmath.divLo(xl, yl)
        out.hi = rmath.divHi(xh, yl)
      }
    } else {
      if (yh < 0) {
        out.lo = rmath.divLo(xh, yh)
        out.hi = rmath.divHi(xl, yl)
      } else {
        out.lo = rmath.divLo(xl, yh)
        out.hi = rmath.divHi(xh, yl)
      }
    }
    return out
  },

  /**
   * Division between an interval and a positive constant
   * @param {Interval} x
   * @param {number} v
   * @returns {Interval}
   */
  positive: function (x, v) {
    if (x.lo === 0 && x.hi === 0) {
      return x
    }

    if (utils.zeroIn(x)) {
      // mixed considering zero in both ends
      return constants.WHOLE
    }

    if (x.hi < 0) {
      // negative / v
      return Interval(
        Number.NEGATIVE_INFINITY,
        rmath.divHi(x.hi, v)
      )
    } else {
      // positive / v
      return Interval(
        rmath.divLo(x.lo, v),
        Number.POSITIVE_INFINITY
      )
    }
  },

  /**
   * Division between an interval and a negative constant
   * @param {Interval} x
   * @param {number} v
   * @returns {Interval}
   */
  negative: function (x, v) {
    if (x.lo === 0 && x.hi === 0) {
      return x
    }

    if (utils.zeroIn(x)) {
      // mixed considering zero in both ends
      return constants.WHOLE
    }

    if (x.hi < 0) {
      // negative / v
      return Interval(
        rmath.divLo(x.hi, v),
        Number.POSITIVE_INFINITY
      )
    } else {
      // positive / v
      return Interval(
        Number.NEGATIVE_INFINITY,
        rmath.divHi(x.lo, v)
      )
    }
  },

  /**
   * Division between an interval and zero
   * @param {Interval} x
   * @returns {Interval}
   */
  zero: function (x) {
    if (x.lo === 0 && x.hi === 0) {
      return x
    }
    return constants.WHOLE
  }
}

module.exports = division

},{"../constants":37,"../interval":38,"../round-math":47,"./utils":45}],42:[function(require,module,exports){
/**
 * Created by mauricio on 5/11/15.
 */
'use strict'
var constants = require('../constants')
var Interval = require('../interval')
var rmath = require('../round-math')
var utils = require('./utils')
var arithmetic = require('./arithmetic')

var misc = {}

misc.exp = function (x) {
  if (utils.isEmpty(x)) { return constants.EMPTY }
  return Interval(
    rmath.expLo(x.lo),
    rmath.expHi(x.hi)
  )
}

misc.log = function (x) {
  if (utils.isEmpty(x)) { return constants.EMPTY }
  var l = x.lo <= 0 ? Number.NEGATIVE_INFINITY : rmath.logLo(x.lo)
  return Interval(l, rmath.logHi(x.hi))
}

misc.ln = misc.log

misc.LOG_EXP_10 = misc.log(Interval(10, 10))

misc.log10 = function (x) {
  if (utils.isEmpty(x)) { return constants.EMPTY }
  return arithmetic.div(misc.log(x), misc.LOG_EXP_10)
}

misc.LOG_EXP_2 = misc.log(Interval(2, 2))

misc.log2 = function (x) {
  if (utils.isEmpty(x)) { return constants.EMPTY }
  return arithmetic.div(misc.log(x), misc.LOG_EXP_2)
}

misc.hull = function (x, y) {
  var badX = utils.isEmpty(x)
  var badY = utils.isEmpty(y)
  if (badX) {
    if (badY) {
      return constants.EMPTY
    } else {
      return y.clone()
    }
  } else {
    if (badY) {
      return x.clone()
    } else {
      return Interval(
        Math.min(x.lo, y.lo),
        Math.max(x.hi, y.hi)
      )
    }
  }
}

misc.intersection = function (x, y) {
  if (utils.isEmpty(x) || utils.isEmpty(y)) { return constants.EMPTY }
  var lo = Math.max(x.lo, y.lo)
  var hi = Math.min(x.hi, y.hi)
  if (lo <= hi) {
    return Interval(lo, hi)
  }
  return constants.EMPTY
}

misc.union = function (x, y) {
  if (!utils.intervalsOverlap(x, y)) {
    throw TypeError('Interval.union: intervals do not overlap')
  }
  return Interval(
    Math.min(x.lo, y.lo),
    Math.max(x.hi, y.hi)
  )
}

misc.difference = function (x, y) {
  if (utils.isEmpty(x) || utils.isEmpty(y)) {
    return constants.EMPTY
  }
  if (utils.intervalsOverlap(x, y)) {
    if (x.lo < y.lo && y.hi < x.hi) {
      // difference creates multiple subsets
      throw TypeError('Interval.difference: difference creates multiple intervals')
    }
    if (y.lo < x.lo) {
      return Interval(rmath.next(y.hi), x.hi)
    }
    if (y.hi > x.hi) {
      return Interval(x.lo, rmath.prev(y.lo))
    }
  }
  return Interval.clone(x)
}

/**
 * Computes the distance of the bounds of an interval
 * @param {Interval} x
 * @returns {number}
 */
misc.width = function (x) {
  if (utils.isEmpty(x)) { return 0 }
  return rmath.subHi(x.hi, x.lo)
}

misc.abs = function (x) {
  if (utils.isEmpty(x)) { return constants.EMPTY }
  if (x.lo >= 0) { return Interval.clone(x) }
  if (x.hi <= 0) { return arithmetic.negative(x) }
  return Interval(0, Math.max(-x.lo, x.hi))
}

misc.max = function (x, y) {
  if (utils.isEmpty(x)) { return constants.EMPTY }
  return Interval(
    Math.max(x.lo, y.lo),
    Math.max(x.hi, y.hi)
  )
}

misc.min = function (x, y) {
  if (utils.isEmpty(x)) { return constants.EMPTY }
  return Interval(
    Math.min(x.lo, y.lo),
    Math.min(x.hi, y.hi)
  )
}

misc.clone = function (x) {
  // no bound checking
  return Interval().set(x.lo, x.hi)
}

module.exports = misc

},{"../constants":37,"../interval":38,"../round-math":47,"./arithmetic":40,"./utils":45}],43:[function(require,module,exports){
/**
 * Created by mauricio on 5/14/15.
 */
'use strict'
var utils = require('./utils')

// boost/numeric/interval_lib/compare/certain
// certain package in boost
var relational = {}

/**
 * Checks if the intervals `x`, `y` are equal
 * @param {Interval} x
 * @param {Interval} y
 * @returns {boolean}
 */
relational.equal = function (x, y) {
  if (utils.isEmpty(x)) {
    return utils.isEmpty(y)
  }
  return !utils.isEmpty(y) && x.lo === y.lo && x.hi === y.hi
}

// <debug>
relational.almostEqual = function (x, y) {
  var EPS = 1e-7
  function assert (a, message) {
    /* istanbul ignore next */
    if (!a) {
      throw new Error(message || 'assertion failed')
    }
  }

  function assertEps (a, b) {
    assert(Math.abs(a - b) < EPS, 'expected ' + a + ' to be close to ' + b)
  }

  x = Array.isArray(x) ? x : x.toArray()
  y = Array.isArray(y) ? y : y.toArray()
  assertEps(x[0], y[0])
  assertEps(x[1], y[1])
  assert(x[0] <= x[1], 'interval must not be empty')
}
// </debug>

/**
 * Checks if the intervals `x`, `y` are not equal
 * @param {Interval} x
 * @param {Interval} y
 * @returns {boolean}
 */
relational.notEqual = function (x, y) {
  if (utils.isEmpty(x)) {
    return !utils.isEmpty(y)
  }
  return utils.isEmpty(y) || x.hi < y.lo || x.lo > y.hi
}

/**
 * Checks if the interval x is less than y
 * @param {Interval} x
 * @param {Interval} y
 * @return {boolean}
 */
relational.lt = function (x, y) {
  if (utils.isEmpty(x) || utils.isEmpty(y)) {
    return false
  }
  return x.hi < y.lo
}

/**
 * Checks if the interval x is greater than y
 * @param {Interval} x
 * @param {Interval} y
 * @return {boolean}
 */
relational.gt = function (x, y) {
  if (utils.isEmpty(x) || utils.isEmpty(y)) {
    return false
  }
  return x.lo > y.hi
}

/**
 * Checks if the interval x is less or equal than y
 * @param {Interval} x
 * @param {Interval} y
 * @return {boolean}
 */
relational.leq = function (x, y) {
  if (utils.isEmpty(x) || utils.isEmpty(y)) {
    return false
  }
  return x.hi <= y.lo
}

/**
 * Checks if the interval x is greater or equal than y
 * @param {Interval} x
 * @param {Interval} y
 * @return {boolean}
 */
relational.geq = function (x, y) {
  if (utils.isEmpty(x) || utils.isEmpty(y)) {
    return false
  }
  return x.lo >= y.hi
}

module.exports = relational

},{"./utils":45}],44:[function(require,module,exports){
/**
 * Created by mauricio on 5/10/15.
 */
'use strict'
var constants = require('../constants')
var Interval = require('../interval')
var rmath = require('../round-math')
var utils = require('./utils')
var misc = require('./misc')
var algebra = require('./algebra')
var arithmetic = require('./arithmetic')

var trigonometric = {}

trigonometric.cos = function (x) {
  var rlo, rhi
  if (utils.isEmpty(x)) { return constants.EMPTY }

  // cos works with positive intervals only
  if (x.lo < 0) {
    var mult = 1e7
    x.lo += 2 * Math.PI * mult
    x.hi += 2 * Math.PI * mult
  }

  var pi2 = constants.PI_TWICE
  var t = algebra.fmod(x, pi2)
  if (misc.width(t) >= pi2.lo) {
    return Interval(-1, 1)
  }

  // when t.lo > pi it's the same as
  // -cos(t - pi)
  if (t.lo >= constants.PI_HIGH) {
    var cos = trigonometric.cos(
      arithmetic.sub(t, constants.PI)
    )
    return arithmetic.negative(cos)
  }

  var lo = t.lo
  var hi = t.hi
  rlo = rmath.cosLo(hi)
  rhi = rmath.cosHi(lo)
  // it's ensured that t.lo < pi and that t.lo >= 0
  if (hi <= constants.PI_LOW) {
    // when t.hi < pi
    // [cos(t.lo), cos(t.hi)]
    return Interval(rlo, rhi)
  } else if (hi <= pi2.lo) {
    // when t.hi < 2pi
    // [-1, max(cos(t.lo), cos(t.hi))]
    return Interval(-1, Math.max(rlo, rhi))
  } else {
    // t.lo < pi and t.hi > 2pi
    return Interval(-1, 1)
  }
}

trigonometric.sin = function (x) {
  if (utils.isEmpty(x)) { return constants.EMPTY }
  return trigonometric.cos(
    arithmetic.sub(x, constants.PI_HALF)
  )
}

trigonometric.tan = function (x) {
  if (utils.isEmpty(x)) { return constants.EMPTY }

  // // tan works with positive intervals only
  if (x.lo < 0) {
    var mult = 1e7
    x.lo += 2 * Math.PI * mult
    x.hi += 2 * Math.PI * mult
  }

  var pi = constants.PI
  var t = algebra.fmod(x, pi)
  if (t.lo >= constants.PI_HALF_LOW) {
    t = arithmetic.sub(t, pi)
  }
  if (t.lo <= -constants.PI_HALF_LOW || t.hi >= constants.PI_HALF_LOW) {
    return constants.WHOLE
  }
  return Interval(
    rmath.tanLo(t.lo),
    rmath.tanHi(t.hi)
  )
}

trigonometric.asin = function (x) {
  if (utils.isEmpty(x) || x.hi < -1 || x.lo > 1) {
    return constants.EMPTY
  }
  var lo = x.lo <= -1 ? -constants.PI_HALF_HIGH : rmath.asinLo(x.lo)
  var hi = x.hi >= 1 ? constants.PI_HALF_HIGH : rmath.asinHi(x.hi)
  return Interval(lo, hi)
}

trigonometric.acos = function (x) {
  if (utils.isEmpty(x) || x.hi < -1 || x.lo > 1) {
    return constants.EMPTY
  }
  var lo = x.hi >= 1 ? 0 : rmath.acosLo(x.hi)
  var hi = x.lo <= -1 ? constants.PI_HIGH : rmath.acosHi(x.lo)
  return Interval(lo, hi)
}

trigonometric.atan = function (x) {
  if (utils.isEmpty(x)) { return constants.EMPTY }
  return Interval(rmath.atanLo(x.lo), rmath.atanHi(x.hi))
}

trigonometric.sinh = function (x) {
  if (utils.isEmpty(x)) { return constants.EMPTY }
  return Interval(rmath.sinhLo(x.lo), rmath.sinhHi(x.hi))
}

trigonometric.cosh = function (x) {
  if (utils.isEmpty(x)) { return constants.EMPTY }
  if (x.hi < 0) {
    return Interval(
      rmath.coshLo(x.hi),
      rmath.coshHi(x.lo)
    )
  } else if (x.lo >= 0) {
    return Interval(
      rmath.coshLo(x.lo),
      rmath.coshHi(x.hi)
    )
  } else {
    return Interval(
      1,
      rmath.coshHi(-x.lo > x.hi ? x.lo : x.hi)
    )
  }
}

trigonometric.tanh = function (x) {
  if (utils.isEmpty(x)) { return constants.EMPTY }
  return Interval(rmath.tanhLo(x.lo), rmath.tanhHi(x.hi))
}

// TODO: inverse hyperbolic functions (asinh, acosh, atanh)

module.exports = trigonometric

},{"../constants":37,"../interval":38,"../round-math":47,"./algebra":39,"./arithmetic":40,"./misc":42,"./utils":45}],45:[function(require,module,exports){
/**
 * Created by mauricio on 5/10/15.
 */
'use strict'
var utils = {}

/**
 * Checks if the given parameter is an interval
 * @param  {*}  x An object that must have the properties `lo` and `hi` properties
 * to be an interval
 * @return {Boolean} true if `x` is an interval
 */
utils.isInterval = function (x) {
  return typeof x === 'object' && typeof x.lo === 'number' && typeof x.hi === 'number'
}

/**
 * Checks if an interval is empty, it's empty whenever
 * the `lo` property has a higher value than the `hi` property
 * @param {Interval} a
 * @returns {boolean}
 */
utils.isEmpty = function (a) {
  return a.lo > a.hi
}

/**
 * Checks if an interval is a whole interval, that is it covers all
 * the real numbers
 * @param {Interval} a
 * @returns {boolean}
 */
utils.isWhole = function (a) {
  return a.lo === -Infinity && a.hi === Infinity
}

/**
/**
 * Checks if the intervals `x` is a singleton (an interval representing a single value)
 * @param {Interval} x
 * @returns {boolean}
 */
utils.isSingleton = function (x) {
  return !utils.isEmpty(x) && x.lo === x.hi
}

/*
 * True if zero is included in the interval `a`
 * @param {Interval} a
 * @returns {boolean}
 */
utils.zeroIn = function (a) {
  return utils.hasValue(a, 0)
}

/**
 * True if `v` is included in the interval `a`
 * @param {Interval} a
 * @param {number} v
 * @returns {boolean}
 */
utils.hasValue = function (a, v) {
  if (utils.isEmpty(a)) { return false }
  return a.lo <= v && v <= a.hi
}

/**
 * Checks if `a` is a subset of `b`
 * @param {Interval} a
 * @param {Interval} b
 * @returns {boolean}
 */
utils.hasInterval = function (a, b) {
  if (utils.isEmpty(a)) { return true }
  return !utils.isEmpty(b) && b.lo <= a.lo && a.hi <= b.hi
}

/**
 * Checks if the intervals `a`, `b` overlap
 * @param {Interval} a
 * @param {Interval} b
 * @returns {boolean}
 */
utils.intervalsOverlap = function (a, b) {
  if (utils.isEmpty(a) || utils.isEmpty(b)) { return false }
  return (a.lo <= b.lo && b.lo <= a.hi) ||
  (b.lo <= a.lo && a.lo <= b.hi)
}

module.exports = utils

},{}],46:[function(require,module,exports){
/**
 * Created by mauricio on 5/11/15.
 */
'use strict'

// hyperbolic functions only present on es6
Math.sinh = Math.sinh || function (x) {
  var y = Math.exp(x)
  return (y - 1 / y) / 2
}

Math.cosh = Math.cosh || function (x) {
  var y = Math.exp(x)
  return (y + 1 / y) / 2
}

Math.tanh = Math.tanh || function (x) {
  if (x === Number.POSITIVE_INFINITY) {
    return 1
  } else if (x === Number.NEGATIVE_INFINITY) {
    return -1
  } else {
    var y = Math.exp(2 * x)
    return (y - 1) / (y + 1)
  }
}

},{}],47:[function(require,module,exports){
/**
 * Created by mauricio on 4/27/15.
 */
'use strict'
var nextafter = require('nextafter')

function identity (v) { return v }
function prev (v) {
  if (v === Infinity) {
    return v
  }
  return nextafter(v, -Infinity)
}
function next (v) {
  if (v === -Infinity) {
    return v
  }
  return nextafter(v, Infinity)
}

var round = {
  prev: prev,
  next: next
}

round.addLo = function (x, y) { return this.prev(x + y) }
round.addHi = function (x, y) { return this.next(x + y) }

round.subLo = function (x, y) { return this.prev(x - y) }
round.subHi = function (x, y) { return this.next(x - y) }

round.mulLo = function (x, y) { return this.prev(x * y) }
round.mulHi = function (x, y) { return this.next(x * y) }

round.divLo = function (x, y) { return this.prev(x / y) }
round.divHi = function (x, y) { return this.next(x / y) }

function toInteger (x) {
  return x < 0 ? Math.ceil(x) : Math.floor(x)
}

round.intLo = function (x) { return toInteger(this.prev(x)) }
round.intHi = function (x) { return toInteger(this.next(x)) }

round.logLo = function (x) { return this.prev(Math.log(x)) }
round.logHi = function (x) { return this.next(Math.log(x)) }

round.expLo = function (x) { return this.prev(Math.exp(x)) }
round.expHi = function (x) { return this.next(Math.exp(x)) }

round.sinLo = function (x) { return this.prev(Math.sin(x)) }
round.sinHi = function (x) { return this.next(Math.sin(x)) }

round.cosLo = function (x) { return this.prev(Math.cos(x)) }
round.cosHi = function (x) { return this.next(Math.cos(x)) }

round.tanLo = function (x) { return this.prev(Math.tan(x)) }
round.tanHi = function (x) { return this.next(Math.tan(x)) }

round.asinLo = function (x) { return this.prev(Math.asin(x)) }
round.asinHi = function (x) { return this.next(Math.asin(x)) }

round.acosLo = function (x) { return this.prev(Math.acos(x)) }
round.acosHi = function (x) { return this.next(Math.acos(x)) }

round.atanLo = function (x) { return this.prev(Math.atan(x)) }
round.atanHi = function (x) { return this.next(Math.atan(x)) }

// polyfill required for hyperbolic functions
round.sinhLo = function (x) { return this.prev(Math.sinh(x)) }
round.sinhHi = function (x) { return this.next(Math.sinh(x)) }

round.coshLo = function (x) { return this.prev(Math.cosh(x)) }
round.coshHi = function (x) { return this.next(Math.cosh(x)) }

round.tanhLo = function (x) { return this.prev(Math.tanh(x)) }
round.tanhHi = function (x) { return this.next(Math.tanh(x)) }

/**
 * ln(power) exponentiation of x
 * @param {number} x
 * @param {number} power
 * @returns {number}
 */
round.powLo = function (x, power) {
  if (power % 1 !== 0) {
    // power has decimals
    return this.prev(Math.pow(x, power))
  }

  var y = (power & 1) ? x : 1
  power >>= 1
  while (power > 0) {
    x = round.mulLo(x, x)
    if (power & 1) {
      y = round.mulLo(x, y)
    }
    power >>= 1
  }
  return y
}

/**
 * ln(power) exponentiation of x
 * @param {number} x
 * @param {number} power
 * @returns {number}
 */
round.powHi = function (x, power) {
  if (power % 1 !== 0) {
    // power has decimals
    return this.next(Math.pow(x, power))
  }

  var y = (power & 1) ? x : 1
  power >>= 1
  while (power > 0) {
    x = round.mulHi(x, x)
    if (power & 1) {
      y = round.mulHi(x, y)
    }
    power >>= 1
  }
  return y
}

round.sqrtLo = function (x) { return this.prev(Math.sqrt(x)) }
round.sqrtHi = function (x) { return this.next(Math.sqrt(x)) }

round.disable = function () {
  this.next = this.prev = identity
}

round.enable = function () {
  this.next = next
  this.prev = prev
}

module.exports = round

},{"nextafter":50}],48:[function(require,module,exports){
'use strict';
var MAX_SAFE_INTEGER = require('max-safe-integer');

module.exports = Number.isSafeInteger || function (val) {
	return typeof val === 'number' && val === val && val !== Infinity && val !== -Infinity && parseInt(val, 10) === val && Math.abs(val) <= MAX_SAFE_INTEGER;
};

},{"max-safe-integer":49}],49:[function(require,module,exports){
'use strict';
module.exports = 9007199254740991;

},{}],50:[function(require,module,exports){
"use strict"

var doubleBits = require("double-bits")

var SMALLEST_DENORM = Math.pow(2, -1074)
var UINT_MAX = (-1)>>>0

module.exports = nextafter

function nextafter(x, y) {
  if(isNaN(x) || isNaN(y)) {
    return NaN
  }
  if(x === y) {
    return x
  }
  if(x === 0) {
    if(y < 0) {
      return -SMALLEST_DENORM
    } else {
      return SMALLEST_DENORM
    }
  }
  var hi = doubleBits.hi(x)
  var lo = doubleBits.lo(x)
  if((y > x) === (x > 0)) {
    if(lo === UINT_MAX) {
      hi += 1
      lo = 0
    } else {
      lo += 1
    }
  } else {
    if(lo === 0) {
      lo = UINT_MAX
      hi -= 1
    } else {
      lo -= 1
    }
  }
  return doubleBits.pack(lo, hi)
}
},{"double-bits":51}],51:[function(require,module,exports){
(function (Buffer){
var hasTypedArrays = false
if(typeof Float64Array !== "undefined") {
  var DOUBLE_VIEW = new Float64Array(1)
    , UINT_VIEW   = new Uint32Array(DOUBLE_VIEW.buffer)
  DOUBLE_VIEW[0] = 1.0
  hasTypedArrays = true
  if(UINT_VIEW[1] === 0x3ff00000) {
    //Use little endian
    module.exports = function doubleBitsLE(n) {
      DOUBLE_VIEW[0] = n
      return [ UINT_VIEW[0], UINT_VIEW[1] ]
    }
    function toDoubleLE(lo, hi) {
      UINT_VIEW[0] = lo
      UINT_VIEW[1] = hi
      return DOUBLE_VIEW[0]
    }
    module.exports.pack = toDoubleLE
    function lowUintLE(n) {
      DOUBLE_VIEW[0] = n
      return UINT_VIEW[0]
    }
    module.exports.lo = lowUintLE
    function highUintLE(n) {
      DOUBLE_VIEW[0] = n
      return UINT_VIEW[1]
    }
    module.exports.hi = highUintLE
  } else if(UINT_VIEW[0] === 0x3ff00000) {
    //Use big endian
    module.exports = function doubleBitsBE(n) {
      DOUBLE_VIEW[0] = n
      return [ UINT_VIEW[1], UINT_VIEW[0] ]
    }
    function toDoubleBE(lo, hi) {
      UINT_VIEW[1] = lo
      UINT_VIEW[0] = hi
      return DOUBLE_VIEW[0]
    }
    module.exports.pack = toDoubleBE
    function lowUintBE(n) {
      DOUBLE_VIEW[0] = n
      return UINT_VIEW[1]
    }
    module.exports.lo = lowUintBE
    function highUintBE(n) {
      DOUBLE_VIEW[0] = n
      return UINT_VIEW[0]
    }
    module.exports.hi = highUintBE
  } else {
    hasTypedArrays = false
  }
}
if(!hasTypedArrays) {
  var buffer = new Buffer(8)
  module.exports = function doubleBits(n) {
    buffer.writeDoubleLE(n, 0, true)
    return [ buffer.readUInt32LE(0, true), buffer.readUInt32LE(4, true) ]
  }
  function toDouble(lo, hi) {
    buffer.writeUInt32LE(lo, 0, true)
    buffer.writeUInt32LE(hi, 4, true)
    return buffer.readDoubleLE(0, true)
  }
  module.exports.pack = toDouble  
  function lowUint(n) {
    buffer.writeDoubleLE(n, 0, true)
    return buffer.readUInt32LE(0, true)
  }
  module.exports.lo = lowUint
  function highUint(n) {
    buffer.writeDoubleLE(n, 0, true)
    return buffer.readUInt32LE(4, true)
  }
  module.exports.hi = highUint
}

module.exports.sign = function(n) {
  return module.exports.hi(n) >>> 31
}

module.exports.exponent = function(n) {
  var b = module.exports.hi(n)
  return ((b<<1) >>> 21) - 1023
}

module.exports.fraction = function(n) {
  var lo = module.exports.lo(n)
  var hi = module.exports.hi(n)
  var b = hi & ((1<<20) - 1)
  if(hi & 0x7ff00000) {
    b += (1<<20)
  }
  return [lo, b]
}

module.exports.denormalized = function(n) {
  var hi = module.exports.hi(n)
  return !(hi & 0x7ff00000)
}
}).call(this,require("buffer").Buffer)
},{"buffer":1}],52:[function(require,module,exports){
module.exports = extend

var hasOwnProperty = Object.prototype.hasOwnProperty;

function extend(target) {
    for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (hasOwnProperty.call(source, key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}

},{}],"interval-arithmetic-eval":[function(require,module,exports){
/*
 * interval-arithmetic-eval
 *
 * Copyright (c) 2015 Mauricio Poppe
 * Licensed under the MIT license.
 */
'use strict'
module.exports = require('./lib/eval')

},{"./lib/eval":6}],"interval-arithmetic":[function(require,module,exports){
/*
 * interval-arithmetic
 *
 * Copyright (c) 2015 Mauricio Poppe
 * Licensed under the MIT license.
 */

'use strict'
var extend = require('xtend/mutable')

require('./lib/polyfill')
module.exports = require('./lib/interval')
module.exports.rmath = require('./lib/round-math')

extend(
  module.exports,
  require('./lib/constants'),
  require('./lib/operations/relational'),
  require('./lib/operations/arithmetic'),
  require('./lib/operations/algebra'),
  require('./lib/operations/trigonometric'),
  require('./lib/operations/misc'),
  require('./lib/operations/utils')
)

},{"./lib/constants":37,"./lib/interval":38,"./lib/operations/algebra":39,"./lib/operations/arithmetic":40,"./lib/operations/misc":42,"./lib/operations/relational":43,"./lib/operations/trigonometric":44,"./lib/operations/utils":45,"./lib/polyfill":46,"./lib/round-math":47,"xtend/mutable":52}]},{},[]);
