// ~ WEBSOCKET THINGS ~

let id = null
// const ws_address = `wss://capogreco-omni.deno.dev`

const ws_address = `ws://localhost/`

const socket = new WebSocket (ws_address)

let init    = false

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
            new_state ()
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

socket.addEventListener ('open', msg => {
   console.log (`websocket is ${ msg.type } at ${ msg.target.url } `)
})

// ~ UI THINGS ~

document.body.style.margin   = 0
document.body.style.overflow = `hidden`

document.body.style.backgroundColor = `black`
const text_div                = document.createElement (`div`)
text_div.innerText            = `tap to join`
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

const osc = audio_context.createOscillator ()
osc.frequency.value = 220

const amp = audio_context.createGain ()
amp.gain.value = 0

osc.connect (amp).connect (audio_context.destination)

function next_note () {
   const now = audio_context.currentTime
   const f = 220 * (2 ** state.x)

   osc.frequency.cancelScheduledValues (now)
   osc.frequency.setValueAtTime (osc.frequency.value, now)
   osc.frequency.exponentialRampToValueAtTime (f, now + 0.02)

   const a = state.is_playing ? 1 - state.y : 0
   amp.gain.linearRampToValueAtTime (a, now + 0.02)

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

   next_note ()
   requestAnimationFrame (draw_frame)
}
