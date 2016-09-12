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
    if (this.files[recordingId]) {
      this.files[recordingId].end()

      var fsWriteStream = fs.createWriteStream(filepath, {start: 4, flags: 'r+'})
      fsWriteStream.on('open', function () {
        var buf = new Buffer(4)
        var fileSize = fs.stat(filepath, function (err, stat) {
          buf.writeUInt32LE(stat.size - 8, 0)
          fsWriteStream.write(buf)
          fsWriteStream.end()
        })
      })

      delete this.files[recordingId]
    }
  }

  function onready(openFile, audioData) {
    // if this isn't the first time we've written to this file,
    // strip the WAV/RIFF header from this chunk
    if (openFile._header) {
      openFile._length += audioData[2]
      audioData = audioData.slice(44)
    } else {
      openFile._header = true
      openFile._length = audioData[2]
    }

    openFile.write(audioData)
  }
}
