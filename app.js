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
            let entity = this.entities.get(msg.content.target_id);
            entity.name_clicked(socket.user_id);
            break;
          }

          case "Command Clicked":{

            let user = this.entities.get(socket.user_id);
            if (user===undefined){
              return;
            }
            
            switch(msg.content.cmd){

              case "Look":{
                user.look_cmd(msg.content.target_id);
                break;
              }

              case "User Info":{
                let content = {
                  html:         user.get_look_string(),
                  is_flashing:  false
                }
                user.send_msg_to_client("Chat", content);            
                break;
              }

              case "Edit User":{
                let content = {
                  user_obj: {
                    description: user.description
                  }
                }
                user.send_msg_to_client("Open Edit User Modal", content);
                break;
              }

              //Open an Edit Game modal in the use's client.
              case "Create A New Game":{
                let content = {      
                  name:         "Text Tag",
                  maps:         ["Pacman"],
                  max_score_options: [5,10,15],
                  is_private:   false
                }    
                user.send_msg_to_client('Open Edit Game Modal', content);                 
                break;
              }

              case "Join A Game":{
                break;
              }

              case "Switch Sides":{
                break;
              }

              case "Quit To Lobby":{
                break;
              }

              case "Shot":{
                break;
              }

              case "Tell":{
                break;
              }

              case "Say":{
                break;
              }

              case "Use":{
                break;
              }

              case "Consume":{
                break;
              }

              case "Drop":{
                break;
              }

              case "Remove":{
                break;
              }

              case "Hold":{
                break;
              }

              case "Wear":{
                break;
              }

              case "Get":{
                break;
              }

            }            
            break;
          }

          case "Edit User":{
            let user = this.entities.get(socket.user_id);
            if (user!==undefined){
              user.set_props(msg.content);

              let content = {
                html:         "Changes saved.",
                is_flashing:  false
              }
              user.send_msg_to_client("Chat", content);
            }
            break;
          }

          case "Create Game":{
            let user = this.entities.get(socket.user_id);
            if (user!==undefined){

              let props = {
                owner_id: user.id
              }
              let game = new Classes.Game(this.entities, props);    
              user.current_game_id= game.id;

              game.add_player(user.id); //Do spawn

              let content = {
                html: `<p><b>You have been teleported to the game arena.</b></p></p><p><span class="link" data-id="${game.id}">Copy</span> the game's ID and tell it to the other players.</p><p><span class="link" data-id="${game.id}">Start</span> the game when you're ready.</p>`,
                is_flashing: false
              };
              user.send_msg_to_client("Chat", content);
              user.send_exits_msg_to_client();
            }            
            break;
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
