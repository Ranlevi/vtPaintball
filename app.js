/*
Text Tag
========
A text based, multiplayer, virtual Laser Tag game.
Author: Ran Levi. 

Apps.js
-------
Entry point for the server.
Handles serving the Client to users, user login and user input.

Note: must be https for clipboard to work!

TODO:
continue with look room, then logs and tests.
keyboard movement on desktop?
every time an ite spawns - announce
give the game 'charecter'. funny? scary? 
logs
*/

const SERVER_VERSION=   0.1;
const PORT=             5000;
const TEST_MODE=        false;

const fs=         require('fs');
const Classes=    require('./game/classes');

const express=    require('express');
const app=        express();
const http =      require('http');
const server =    http.createServer(app);
const { Server }= require("socket.io");
 
//Serving Files
//-------------------------------------------------
//-------------------------------------------------

//Serving static files (js, css)
if (TEST_MODE){
  app.use(express.static('testing'));
} else {
  app.use(express.static('public'));
}

//Serving HTML files
app.get('/', (req, res) => {    
  res.sendFile(__dirname + '/public/index.html');
});

app.get('/help', (req, res) => {
  res.sendFile(__dirname + '/public/help/help.html');    
});

//Init WebSockets Server
server.listen(PORT, () => {
  console.log(`Websockets server listening on Port: ${PORT}`);
});

//Init the game world, handle users login, process inputs.
class Game_Controller {
  constructor(){

    this.LOBBY_ID=      "r0000000";

    this.io=            new Server(server);
    this.entities=      new Map(); //id : instance
    this.entities_db;
    this.log_msgs=      [];

    //Handle Socket.IO Connections and messages.
    //-----------------------------------------

    this.io.on('connection', (socket) => {
      socket.user_id = null;       

      socket.on('Message From Client', (msg)=>{
        
        switch(msg.type){

          case "Login":{
            //Try to find an active user with the same username.        
            
            let reply_msg = {
              type:                 "Login Reply",
              content: {
                is_login_successful: null
              }
            }
            
            let user_id = this.get_user_id_by_username(msg.content.username);
            
            if (user_id!==undefined){
              //A user with the same name exists in the game.
              reply_msg.content.is_login_successful = false;                            
              socket.emit('Message From Server', reply_msg);         

            } else {     
              
              //Username is not taken, player can enter.
              //Attach the user_id to the socket, and return a Login Message.              
              reply_msg.content.is_login_successful = true;                    
              socket.emit('Message From Server', reply_msg);

              socket.user_id = this.create_new_user(socket, msg.content.username);
            }
            break;
          }

          case "Entity Clicked":{
            //continue from here.
          }

        }
      });

      socket.on('disconnect', (reason)=>{         
        if (socket.user_id!==null){
          //Find the user, remove him from the game and reset the socket's user_id.
          let user = this.entities.get(socket.user_id);
          user.destroy_user();          
          socket.user_id = null;          
        }
      })
    });

    this.init();
  }

  init(){
    this.load_entities_db();
    this.init_lobby();
  }

  load_entities_db(){
    this.entities_db = JSON.parse(fs.readFileSync("./game/entities_db.json"));
  }

  init_lobby(){

    let props = {
      type:         "Room",
      id:           this.LOBBY_ID,
      name:         "Game Lobby",
      description:  "This is where players can rest and talk between games."
    }

    let lobby= new Classes.Room(this.entities, props);    

    //Spawn Lobby Items

    props = this.entities_db["Welcome Sign"];
    let welcome_sign = new Classes.Item(this.entities, props);
    welcome_sign.add_to_container(lobby.id);    
  }

  get_user_id_by_username(username){
    for (let inst of this.entities.values()){      
      if (inst.name===username){
        return inst.id;        
      }
    }
    //No user with given username was found.
    return undefined;
  }

  create_new_user(socket, username){
    let props = {
      socket:       socket,
      name:         username,      
      container_id: this.LOBBY_ID
    }    
    
    let user= new Classes.User(this.entities, props);    
    user.add_to_container(this.LOBBY_ID);

    let content = {
      html:         `Welcome ${user.get_name()}!`,
      is_flashing:  false
    }
    user.send_msg_to_client("Chat", content);
    user.look_cmd();
    
    return user.id;    
  }

  game_loop(){   
    
    let timer_id = setTimeout(
      function update(){
      
        this.tick();

        timer_id = setTimeout(update.bind(this), 1000);
      }.bind(this),
      1000
    );
  }

  tick(){
    //Runs once each second.    
  }
}

//Start the game
new Game_Controller();
