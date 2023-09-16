// ~ WEBSOCKET THINGS ~
let id = null

// const ws_address = `wss://capogreco-omni.deno.dev`
const ws_address = `ws://localhost/`

const socket = new WebSocket (ws_address)

socket.onmessage = m => {
   const msg = JSON.parse (m.data)

   const handle_incoming = {
      id: () => {
         id = msg.content
         console.log (`identity is ${ id }`)
         socket.send (JSON.stringify ({
            method: `request_control`,
            content: id,
         }))
      },
      sockets: () => {
         socket_list.textContent = ``
         msg.content.forEach (e => {
            const div = document.createElement (`div`)
            div.innerText = e[0]
            div.style.width = `100%`
            div.style.color  = e[1].joined ? `white` : `grey`
            socket_list.appendChild (div)
         })
      }
   }

   handle_incoming[msg.method] ()
}


socket.onopen = m => {
   console.log (`websocket at ${ m.target.url } is ${ m.type }`)
}

// ~ UI THINGS ~

document.body.style.margin   = 0
document.body.style.overflow = `hidden`
// document.body.style.backgroundColor = `indigo`

const socket_list            = document.createElement (`div`)
socket_list.style.font       = `14 px`
socket_list.style.fontFamily = 'monospace'
socket_list.style.color      = `white`
socket_list.style.display    = `block`
socket_list.style.position   = `fixed`
socket_list.style.width      = `${ innerWidth }px`
socket_list.style.height     = `${ innerHeight }px`
socket_list.style.left       = 0
socket_list.style.top        = 0
document.body.appendChild (socket_list)

const cnv = document.getElementById (`cnv`)
cnv.width  = innerWidth
cnv.height = innerHeight

const ctx = cnv.getContext (`2d`)
ctx.fillStyle = `indigo`
ctx.fillRect (0, 0, cnv.width, cnv.height)

let pointer_down = false

function background () {
   ctx.fillStyle = `indigo`
   ctx.fillRect (0, 0, cnv.width, cnv.height)
}

function draw_square (e) {
   ctx.fillStyle = `lime`
   ctx.fillRect (e.x - 50, e.y - 50, 100, 100)
}

document.body.onpointerdown = e => {

   pointer_down = true

   socket.send (JSON.stringify ({
      method: `upstate`,
      content: {
         x: e.x / cnv.width,
         y: e.y / cnv.height,
         is_playing: true,
      }
   }))

   background ()
   draw_square (e)
   
}

document.body.onpointermove = e => {
   if (pointer_down) {
      background ()
      draw_square (e)

      socket.send (JSON.stringify ({
         method: `upstate`,
         content: {
            x: e.x / cnv.width,
            y: e.y / cnv.height,
            is_playing: true,
         }
      }))   
   }
}

document.body.onpointerup = e => {
   pointer_down = false

   background ()

   socket.send (JSON.stringify ({
      method: `upstate`,
      content: {
         is_playing: false,
      }
   }))
}


