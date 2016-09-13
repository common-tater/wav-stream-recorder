# wav-stream-recorder
Records incoming streams to WAV files.

Useful when needing to concatenate WAV data streams into growing WAV files in the situation where
each incoming message already has its own WAV/RIFF headers written. This wav-stream-recorder writes
any given number of streams to respective WAV files (set by an id) by stripping the unncessary headers
in each message, concatenating the audio data, and after a given timeout will rewrite the WAV/RIFF
headers with the new total size.


## example

```
// ... setup websocket first
var recorder = new WavStreamRecorder()

websocket.on('message', function (streamId, message) {
  recorder.appendRecording(streamId, message, __dirname + '/audio/' + streamId + '.wav')
})
```