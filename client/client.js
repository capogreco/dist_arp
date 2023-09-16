// ~ WEBSOCKET THINGS ~

let id = null

const ws_address = `wss://arp.deno.dev`
// const ws_address = `ws://localhost/`

const socket = new WebSocket (ws_address)

let init = false
let arp  = false

const state = {
   x: 0.5,
   y: 0.5,
   is_playing: false
}

socket.onmessage = m => {
   const msg = JSON.parse (m.data)
   const t = audio_context.currentTime

   const handle_incoming = {

      id: () => {
         id = msg.content
         console.log (`identity is ${ id }`)
         socket.send (JSON.stringify ({
            method: `greeting`,
            content: `${ id } ~> hello!`
         }))
      },

      upstate: () => {
         if (JSON.stringify (msg.content) != JSON.stringify (state)) {
            Object.assign (state, msg.content)
            if (!arp && state.is_playing) next_note ()
         }
      }
   }

   handle_incoming[msg.method] ()
}


function midi_to_cps (n) {
   return 440 * (2 ** ((n - 69) / 12))
}

function rand_element (arr) {
   return arr[rand_integer (arr.length)]
}

function rand_integer (max) {
   return Math.floor (Math.random () * max)
}

function shuffle_array (a) {
   for (let i = a.length - 1; i > 0; i--) {
      let j = Math.floor (Math.random () * (i + 1));
      [ a[i], a[j] ] = [ a[j], a[i] ]
   }
}

socket.addEventListener ('open', msg => {
   console.log (`websocket is ${ msg.type } at ${ msg.target.url } `)
})

// ~ UI THINGS ~

document.body.style.margin   = 0
document.body.style.overflow = `hidden`

document.body.style.backgroundColor = `black`
const text_div                = document.createElement (`div`)
text_div.innerText            = `welcome to the merri creek tavern performance!  tap to join`
text_div.style.font           = `italic bolder 80px sans-serif`
text_div.style.color          = `white`
text_div.style.display        = `flex`
text_div.style.justifyContent = `center`
text_div.style.alignItems     = `center`
text_div.style.position       = `fixed`
text_div.style.width          = `${ window.innerWidth }px`
text_div.style.height         = `${ window.innerHeight }px`
text_div.style.left           = 0
text_div.style.top            = 0
document.body.appendChild (text_div)

document.body.onclick = async () => {
   if (document.body.style.backgroundColor == `black`) {

      await audio_context.resume ()
      osc.start ()
      vib.start ()

      document.body.style.backgroundColor = `deeppink`
      text_div.remove ()
      requestAnimationFrame (draw_frame)

      const msg = {
         method: 'join',
         content: true,
      }
      socket.send (JSON.stringify (msg))   
   }
}

// ~ WEB AUDIO THINGS ~
const audio_context = new AudioContext ()
audio_context.suspend ()
reverbjs.extend(audio_context)

const reverb_url = "R1NuclearReactorHall.m4a"
var rev = audio_context.createReverbFromUrl (reverb_url, () => {
  rev.connect (audio_context.destination)
})

const rev_gate = audio_context.createGain ()
rev_gate.gain.value = 0
rev_gate.connect (rev)

const vib = audio_context.createOscillator ()
vib.frequency.value = Math.random () * 16000


const vib_wid = audio_context.createGain ()
vib_wid.gain.value = 0

const osc = audio_context.createOscillator ()
osc.type = `sawtooth`
osc.frequency.value = 220

const filter = audio_context.createBiquadFilter ()
filter.type = `lowpass`

const amp = audio_context.createGain ()
amp.gain.value = 0

vib.connect (vib_wid).connect (osc.frequency)

osc.connect (filter)
   .connect (amp)
   .connect (audio_context.destination)

amp.connect (rev_gate)

const notes = {
   root: 77,
   chord: [ 0, 5, 7],
   i: Math.floor (Math.random () * 3),
   next: () => {
      notes.i += 1
      notes.i %= notes.chord.length
      return notes.chord[notes.i] + notes.root
   }
}

shuffle_array (notes.chord)

function next_note () {
   const now = audio_context.currentTime

   const f = midi_to_cps (notes.next ())
   osc.frequency.cancelScheduledValues (now)
   osc.frequency.setValueAtTime (osc.frequency.value, now)
   osc.frequency.exponentialRampToValueAtTime (f, now)

   const fil_freq = Math.min (f * (6 ** state.x), 16000)
   filter.frequency.cancelScheduledValues (now)
   filter.frequency.setValueAtTime (filter.frequency.value, now)
   filter.frequency.exponentialRampToValueAtTime (fil_freq, now)

   const vib_rate = 0.16 * (100 ** state.x)
   vib.frequency.cancelScheduledValues (now)
   vib.frequency.setValueAtTime (vib.frequency.value, now)
   vib.frequency.exponentialRampToValueAtTime (vib_rate, now)

   const wid = osc.frequency.value * (1 - state.y) * 0.01
   vib_wid.gain.linearRampToValueAtTime (wid, now)

   rev_gate.gain.cancelScheduledValues (now)
   rev_gate.gain.setValueAtTime (rev_gate.gain.value, now)
   rev_gate.gain.linearRampToValueAtTime ((1 - state.y) ** 6, now)      


   const a = state.is_playing ? 1 - state.y : 0
   amp.gain.linearRampToValueAtTime (a * 0.2, now + (state.y * 0.333))

   if (state.is_playing) {
      arp = setTimeout (next_note, 20 * (64 ** (1 - state.x)))
   }
   else {
      arp = false
   }
}

cnv.width = innerWidth
cnv.height = innerHeight
const ctx = cnv.getContext (`2d`)

function draw_frame () {
   if (state.is_playing) {
      ctx.fillStyle = `turquoise`
      ctx.fillRect (0, 0, cnv.width, cnv.height)

      const x = state.x * cnv.width - 50
      const y = state.y * cnv.height - 50
      ctx.fillStyle = `deeppink`
      ctx.fillRect (x, y, 100, 100)

   }
   else {
      ctx.fillStyle = `deeppink`
      ctx.fillRect (0, 0, cnv.width, cnv.height)   
   }

   requestAnimationFrame (draw_frame)
}

function check_websocket () {
   if (socket.readyState > 1) location.reload ()
   setTimeout (check_websocket, 333)
}

check_websocket ()
