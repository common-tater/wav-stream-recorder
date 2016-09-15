module.exports = WavStreamRecorder

var fs = require('fs')
var events = require('events')
var inherits = require('inherits')

var FILE_CLOSE_TIMEOUT = 5000 // 5 secs of no data before we close the file and rewrite headers
var HEADER_OFFSET_RIFF_SIZE = 4 // bytes 4-7 are the riff container's location for the size of the data
var HEADER_OFFSET_WAV_SIZE = 48 // bytes 48-51 are the wav header's location for the size of the data
var WAV_HEADER_SIZE = 52 // 52 bytes
var RIFF_HEADER_SIZE = 8 // 8 bytes

inherits(WavStreamRecorder, events)

function WavStreamRecorder () {
  this.files = {}
  this.timers = {}

  events.EventEmitter.call(this)
}


WavStreamRecorder.prototype.appendRecording = function (id, data, filepath) {
  var self = this

  // clear any timer that was waiting to close this file
  if (this.timers[id]) {
    clearTimeout(this.timers[id])
  }

  // set the timer to close the file if we get no more data within the timeout period
  this.timers[id] = setTimeout(closeRecording.bind(this, id), FILE_CLOSE_TIMEOUT)

  // if the file's write stream has already been created, write to it
  if (this.files[id]) {
    // only write the data to a file if the file has been openend
    // and is ready. if not, the audio won't be saved, but oh well
    if (this.files[id]._loaded) {
      onready(this.files[id], data)
    }
  } else {
    // if this is the first time, create an appending write stream,
    // wait for it to be opened, and then write to it
    this.files[id] = fs.createWriteStream(filepath, {'flags': 'a'})
    this.files[id].on('open', function () {
      self.files[id]._loaded = true
      onready(self.files[id], data)
    })
  }

  function closeRecording (recordingId) {
    var file = this.files[recordingId]

    if (file) {
      file.end()

      // the riff and wav sizes will need to be converted to
      // 4 byte buffers to be written to the file streams
      var riffSizeBuffer = new Buffer(4)
      riffSizeBuffer.writeUInt32LE(file._length + WAV_HEADER_SIZE, 0)
      var wavSizeBuffer = new Buffer(4)
      wavSizeBuffer.writeUInt32LE(file._length, 0)

      // write the riff size header first
      var riffSizeWriteStream = fs.createWriteStream(filepath, {start: HEADER_OFFSET_RIFF_SIZE, flags: 'r+'})
      riffSizeWriteStream.on('open', function () {
        riffSizeWriteStream.write(riffSizeBuffer)
        riffSizeWriteStream.end()

        // then write the wav size header
        var wavSizeWriteStream = fs.createWriteStream(filepath, {start: HEADER_OFFSET_WAV_SIZE + RIFF_HEADER_SIZE, flags: 'r+'})
        wavSizeWriteStream.on('open', function () {
          wavSizeWriteStream.write(wavSizeBuffer)
          wavSizeWriteStream.end()

          // rename the file by appending a unique timestamp so that any future
          // stream with the same id doesn't overwrite this file
          var archivedFilepath = filepath.replace('.wav', '-' + Date.now() + '.wav')

          fs.rename(filepath, archivedFilepath, function(err) {
            if (err) {
              console.log('ERROR: ' + err)
            } else {
              self.emit('end', archivedFilepath, recordingId)
            }
          })
        })
      })

      delete this.files[recordingId]
    }
  }

  function onready(openFile, audioData) {
    // if this isn't the first time we've written to this file,
    // strip the WAV/RIFF header from this chunk
    if (openFile._header) {
      audioData = audioData.slice(WAV_HEADER_SIZE + RIFF_HEADER_SIZE)
      openFile._length += audioData.length
    } else {
      openFile._header = true
      openFile._length = audioData.length - (WAV_HEADER_SIZE + RIFF_HEADER_SIZE)
    }

    openFile.write(audioData)
  }
}
