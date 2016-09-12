module.exports = WavStreamRecorder

var fs = require('fs')

function WavStreamRecorder () {
  this.files = {}
  this.timers = {}
}

WavStreamRecorder.prototype.appendRecording = function (id, data, filepath) {
  var self = this

  // clear any timer that was waiting to close this file
  if (this.timers[id]) {
    clearTimeout(this.timers[id])
  }

  // set the timer to close the file if we get no more data with 5 seconds
  this.timers[id] = setTimeout(closeRecording.bind(this, id), 5000)

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

      var riffSizeBuffer = new Buffer(4)
      riffSizeBuffer.writeUInt32LE(file._length + 52, 0)
      var wavSizeBuffer = new Buffer(4)
      wavSizeBuffer.writeUInt32LE(file._length, 0)

      var fsWriteStream = fs.createWriteStream(filepath, {start: 4, flags: 'r+'})
      fsWriteStream.on('open', function () {
        fsWriteStream.write(riffSizeBuffer)
        fsWriteStream.end()

        var fsWriteStream2 = fs.createWriteStream(filepath, {start: 48, flags: 'r+'})
        fsWriteStream2.on('open', function () {
          fsWriteStream2.write(wavSizeBuffer)
          fsWriteStream2.end()
        })
      })

      delete this.files[recordingId]
    }
  }

  function onready(openFile, audioData) {
    // if this isn't the first time we've written to this file,
    // strip the WAV/RIFF header from this chunk
    if (openFile._header) {
      audioData = audioData.slice(60)
      openFile._length += audioData.length
    } else {
      openFile._header = true
      openFile._length = audioData.length - 60
    }

    openFile.write(audioData)
  }
}
