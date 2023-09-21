import { serve }    from "https://deno.land/std@0.185.0/http/server.ts"
import { serveDir } from "https://deno.land/std@0.185.0/http/file_server.ts"
import { generate } from "https://deno.land/std@0.185.0/uuid/v1.ts"

// map to manage sockets
const sockets = new Map ()

let control    = false
let is_playing = false

// object to hold state
const state = {
   x: 1,
   y: 0.5,
   // is_playing: false,
   is_playing: true,
   // note_i: 0,
   // sock_i: 0,
}

const major = [ 0, 4, 7 ]
const minor = [ 0, 3, 7 ]
const minor_inv_1 = [ 3, 7, 12 ]
const major_inv_2 = [ 7, 12, 16 ]
const minor_inv_3 = [ 10, 12, 15 ]

// function transpose (a, t) {
//    return a.map (e => e + t)
// }

const notes = [
   major.map (e => e + 62),
   minor_inv_1.map (e => e + 57),
]

let chord_i = 0
let current_notes = notes[0]

function change_chord () {
   current_notes = notes[chord_i % 2]
   chord_i++
   setTimeout (change_chord, 6000)
}

change_chord ()

function midi_to_cps (n) {
   return 440 * (2 ** ((n - 69) / 12))
}   

const bpm = 120

function play_note () {
   const socks = [ ...sockets.values () ]
   // if (socks.length > 0) state.sock_i %= socks.length
   // else state.sock_i = 0
   const note_i = Math.floor (Math.random () * current_notes.length)

   // [ frq, lth, crv, bri, stk, gen, acx ]
   // const frq = midi_to_cps (notes[state.note_i])
   const frq = midi_to_cps (current_notes[note_i])
   const lth = ((60 / bpm) / 32) * (4 ** (1 - state.y))
   const crv = 1
   const bri = state.x
   const stk = 6
   const gen = 1

   const rand_i = Math.floor (Math.random () * socks.length)
   if (socks[rand_i]) {
      socks[rand_i].send (JSON.stringify ({ 
         'method'  : `note`,
         'content' :  [ frq, lth, crv, bri, stk, gen ],
         'state'   : state,
      }))         
   }   

   // state.sock_i++
   // state.note_i++

   if (state.is_playing) {
      setTimeout (play_note, lth * 1000)
   }
}

// function to manage requests
const req_handler = async incoming_req => {

   let req = incoming_req

   // get path from request
   const path = new URL (req.url).pathname

   // get upgrade header
   // or empty string
   const upgrade = req.headers.get ("upgrade") || ""

   // if upgrade for websockets exists
   if (upgrade.toLowerCase () == "websocket") {

      // unwrap socket & response
      // using upgradeWebSocket method
      const { socket, response } = Deno.upgradeWebSocket (req)

      // generate a unique ID
      const id = generate ()

      // defining an onopen method
      socket.onopen = () => {

         // assign false to 
         // audio_enabled property
         socket.audio_enabled = false

         // add socket to map
         sockets.set (id, socket)

         // bundle, stringify, & send ID
         // to the client via the socket 
         socket.send (JSON.stringify ({ 
            'method' : `id`,
            'content' :  id,
         }))

         // call update_control function
         update_control ()
      }

      // defining an onmessage method
      socket.onmessage = m => {

         // unwrap the message
         const msg = JSON.parse (m.data)

         // object housing methods for
         // managing incoming msgs
         const manage_incoming = {

            // method for updating state
            upstate: () => {
               const start = msg.content.is_playing && !state.is_playing

               Object.assign (state, msg.content)

               // sockets.forEach (s => {
               //    if (s.readyState == 1) {
               //       s.send (JSON.stringify (msg))
               //    }
               // })

               if (start) {
                  play_note ()
               }
            },

            // method for requests for control
            request_control: () => {

               // if control is empty
               if (!control) {

                  // assign this socket
                  // to control
                  control = socket

                  // assign the ID
                  // to the socket
                  control.id = id

                  // delete the socket
                  // from the sockets map
                  sockets.delete (id)

                  // call update_control
                  update_control ()

                  // print success to console
                  console.log (`${ control.id } has control.`)
               }

               // or print fail to console
               else console.log (`${ id } wants control!`)
            },


            // method for joining
            join: () => {

               // update .joined property on socket
               socket.joined = msg.content

               // print to console:
               console.log (`${ id } has joined!`)

               // call update_control
               update_control ()



               // if already playing
               // if (is_playing) {

               //    // construct play msg
               //    // with current state
               //    const play_msg = {
               //       method: 'play',
               //       content: state,
               //    }

               //    // send play_msg to socket
               //    socket.send (JSON.stringify (play_msg))
               // }
            },

            greeting: () => {
               console.log (msg.content)
            }
         }

         // use the .method property of msg
         // to choose which method to call
         // console.log (msg)
         manage_incoming[msg.method] ()
      }

      // if there is an error
      // print it to the console
      socket.onerror = e => console.log(`socket error: ${ e.message }`)

      // on closing
      socket.onclose = () => {

         // if there is a control socket
         if (control) {

            // .. and it matches the closing socket
            if (control.id == id) {

               // empty the control variable
               control = false
            }
         }

         // otherwise
         else {

            // delete it from the sockets map
            sockets.delete (id)

            // .. and update control
            update_control ()
         }
      }

      // respond to websocket request
      return response
   }

   // if there is no filename in the url
   if (req.url.endsWith (`/`)) {

      // add 'index.html' to the url
      req = new Request (`${ req.url }index.html`, req)
   }

   const options = {

      // route requests to this
      // directory in the file system
      fsRoot: path.includes (`ctrl`) ? `` : `client`
   }

   // return the requested asset
   // from `public` folder
   return serveDir (req, options)

}

// start a server that handles requests at port 80
serve (req_handler, { port: 80 })

// function to keep ctrl up to date
function update_control () {

   // if there is a control socket
   if (control) {

      // construct a msg object
      const msg = {

         // method is 'sockets'
         method: 'sockets',

         // contents is the list of
         // sockets in array form
         content: Array.from (sockets.entries ())
      }

      // send msg to control
      control.send (JSON.stringify (msg))
   }
}

// function to check for closed sockets
function check_sockets () {

   // empty array for putting 
   // sockets to be removed
   const removals = []

   // for each socket in sockets
   sockets.forEach ((s, id) => {

      // if the .readystate
      // property is 2 or 3
      if (s.readyState > 1) {

         // add its ID to the removals array
         removals.push (id)
      }
   })

   // if there is anything in the removals array
   if (removals.length) {

      // for each id in the removals array
      removals.forEach (id => {

         // delete the corresponding socket
         sockets.delete (id)
      })

      // update ctrl
      update_control ()
   }
}

// check sockets 3 times a second
setInterval (check_sockets, 333)
