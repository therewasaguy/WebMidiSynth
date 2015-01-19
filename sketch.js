var ac = new AudioContext();


/* SYNTH */

var Synth = function() {
  var osc = ac.createOscillator();
  osc.type = 'sawtooth';
  osc.start();

  var output = ac.createGain();
  output.gain.value = 0;

  var filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(0, ac.currentTime);

  // connect everything internally
  osc.connect(filter);
  filter.connect(output);
  // output.connect(ac.destination);

  // add nodes to the synth so we can access them later
  this.osc = osc;
  this.output = output;
  this.filter = filter;

  // function to play a note
  this.play = function(note) {
    if (note) {
      var freq = midiToFreq(note);
      this.osc.frequency.setValueAtTime(freq, ac.currentTime);
    }

    // envelope for the filters
    this.filter.frequency.cancelScheduledValues(ac.currentTime);
    this.filter.frequency.linearRampToValueAtTime(3500, ac.currentTime);
    this.filter.frequency.linearRampToValueAtTime(0, ac.currentTime + 1);

    // envelope for the gain
    this.output.gain.cancelScheduledValues(ac.currentTime);
    this.output.gain.linearRampToValueAtTime(1, ac.currentTime + 0.01);
    this.output.gain.linearRampToValueAtTime(0.5, ac.currentTime + 0.2);
    this.output.gain.linearRampToValueAtTime(0, ac.currentTime + 1);
  }
}

/* CONVOLVER */

var convolver = ac.createConvolver();
convolver.connect(ac.destination);

// load the buffer
loadBuffer('audio/concrete-tunnel.mp3', function(audioBuffer) {
  convolver.buffer = audioBuffer;
});


synth = new Synth();
synth.output.connect(convolver);


/* HELPER FUNCTIONS */

function midiToFreq(midiValue) {
  return 440 * Math.pow(2, (midiValue-69)/12.0);
}

function loadBuffer(path, callback) {
  var request = new XMLHttpRequest();
  request.open('GET', path, true);
  request.responseType = 'arraybuffer';

  // decode asyncrohonously
  request.onload = function() {
    ac.decodeAudioData(request.response, function(audioBuffer) {
      callback(audioBuffer);
    });
  };
  request.send();
}

/* MIDI */
var midiAccess;

navigator.requestMIDIAccess().then(midiSuccess, midiError);

function midiSuccess(midiAccess) {
  var haveAtLeastOneDevice=false;
  var inputs=midiAccess.inputs.values();
  for ( var input = inputs.next(); input && !input.done; input = inputs.next()) {
    input.value.onmidimessage = MIDIMessageEventHandler;
    console.log(input.value);
    haveAtLeastOneDevice = true;
  }
  if (!haveAtLeastOneDevice)
    midiError();
}

function midiError() {
  console.log('no midi, sorry!');
}

function MIDIMessageEventHandler(event) {
  // Mask off the lower nibble (MIDI channel, which we don't care about)
  switch (event.data[0] & 0xf0) {
    case 0x90:
      if (event.data[2]!=0) {  // if velocity != 0, this is a note-on message
        synth.play(event.data[1]);
        return;
      }
      // if velocity == 0, fall thru: it's a note-off.  MIDI's weird, y'all.
    case 0x80:
      // noteOff(event.data[1]);
      return;
  }
}