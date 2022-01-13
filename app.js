/*
Apps.js
-------
Entry point for the server.
Handles serving the Client to users, user login
and user input.

Note: must be https for clipboard to work!

TODO:
spawn by rooms, not by items.
keyboard movement on desktop?
sounds.
boxes width on mobile
every time an ite spawns - announce
give the game 'charecter'. funny? scary? 
write help page.
logs
add report abuse to user's cmds
*/

const SERVER_VERSION=  0.1;
const TEST_MODE=       false;

const fs=         require('fs');
const Classes=    require('./classes');
const World=      require('./world');

const express=    require('express');
const app=        express();
const http =      require('http');
const server =    http.createServer(app);
const { Server }= require("socket.io");

 
//Serving the client to the browser
//--------------------------------
//Serving static ciles (js, css)
if (TEST_MODE){
  app.use(express.static('Testing'));
} else {
  app.use(express.static('public'));
}

app.get('/', (req, res) => {    
  res.sendFile(__dirname + '/public/index.html');
});

app.get('/help', (req, res) => {
  res.sendFile(__dirname + '/public/help.html');    
});

server.listen(5000, () => {
  console.log('listening on *:5000');
});

//Init the game world, handle users login, process inputs.
class Game_Controller {
  constructor(){

    this.world=                   new World.World();
    this.io=                      new Server(server);
    this.FIRST_ROOM_ID=           "r0000000";

    this.init_game();
    
    //Handle Socket.IO Connections and messages.
    //-----------------------------------------

    this.io.on('connection', (socket) => {
      console.log('a client connected');      

      //Each socket is attached to a single user.
      socket.user_id = null;       

      socket.on('Message From Client', (msg)=>{   
        
        let user = this.world.get_instance(socket.user_id);
        
        switch(msg.type){

          case "Say":{
            user.say_cmd(msg.content);
            break;
          }

          case "Tell":{
            user.tell_cmd(msg.content.target_id, msg.content.message);
            break;
          }

          case "Login":{
            //Try to find an active user with the same username.        
            
            let reply_msg = {
              type: "Login Reply",
              content: {
                is_login_successful: null
              }
            }
            
            let user_id = this.world.get_user_id_by_username(msg.content.username);
    
            if (user_id!==null){
              //A user with the same name exists in the game.
              reply_msg.content.is_login_successful = false;                            
              socket.emit('Message From Server', reply_msg);         

            } else {
              //Username is not taken, player can enter.
              //Attach the user_id to the socket, and return a Login Message.
              socket.user_id = this.create_new_user(socket, msg.content.username);
              reply_msg.content.is_login_successful = true;                    
              socket.emit('Message From Server', reply_msg);  
            }
            break;
          }

          case "Disconnect":{
            //Remove the user from the world.            
            user.disconnect_from_game();
            socket.user_id = null;
            break;
          }

          case "North":
          case "South":
          case "East":
          case "West":
          case "Up":
          case "Down":{
            user.move_cmd(msg.type);
            break;
          }

          case "Look":{
            user.look_cmd(msg.content.id);                
            break;
          }

          case "Inventory":{
            user.inventory_cmd();
            break;
          }

          case "Create A New Game":{
            user.create_cmd();
            break;
          }  
          
          case "Start":{
            user.start_cmd();
            break;
          }

          case "Get":{
            user.get_cmd(msg.content.id);
            break;
          }

          case "Hold":{
            user.hold_cmd(msg.content.id);
            break;
          }

          case "Remove":{
            user.remove_cmd(msg.content.id);
            break;
          }

          case "Wear":{
            user.wear_cmd(msg.content.id);
            break;
          }

          case "Consume":{
            user.consume_cmd(msg.content.id);
            break;
          }

          case "Drop":{
            user.drop_cmd(msg.content.id);
            break;
          }

          case "Get User Details For Modal":{ 
            user.send_user_details_to_client();
            break;
          }

          case "Get Game Info For Modal":{
            user.send_game_info_to_client();
            break;
          }

          case "Switch Sides":{
            user.switch_cmd();
            break;
          }

          case "Quit To Lobby":{
            user.quit_cmd();
            break;
          }

          case "Game Info":{            
            user.game_cmd(msg.content.id);
            break;
          }

          case "Use":{
            user.use_cmd(msg.content.id);
            break;
          }

          case "Join This Game":{
            user.join_cmd(msg.content.id);
            break;
          }

          case "Shot":{
            user.shot_cmd(msg.content.id);
            break;
          }

          case "Name Clicked":{                
            let entity = this.world.get_instance(msg.content.id);
            if (entity!==undefined){
              //Prevent user clicking on an already destroyed item.
              entity.name_clicked(socket.user_id);
            }            
            break;
          }

          case "Edit User":{
            user.set_description(msg.content.description);            
            break;
          }

          case "Join Game":{
            user.join_cmd(msg.content.game_id);
            break;
          }

          case "Edit Game":{
            //Note: we assume the user is in a game and owns it, else he
            //would be able to edit it.               
            let game = this.world.get_instance(user.props.current_game_id);             
            game.do_edit(msg);            
            break;
          }

          case "Emote":{
            user.emote_cmd(msg.content);
            break;
          }

          case "User Info":{
            user.send_chat_msg_to_client(user.get_look_string());
            break;
          }
        }
      });  
      
      //Handle players who navigate away from the app.
      socket.on('disconnect', (reason)=>{                
        if (socket.user_id!==null){
          let user = this.world.get_instance(socket.user_id);
          user.disconnect_from_game();
          socket.user_id = null;
          console.log(reason);
        }        
      })
    });
  }

  //Runs when the server is created. 
  //Loads databases, starts the game loop.
  init_game(){     
    this.load_entities_db();
    this.load_world();        
    this.game_loop();      
  }
  
  //Load all rooms and entities (except users) from the database.
  load_world(){    

    let path = `./generic_world.json`;
    
    if (fs.existsSync(path)){      
      let parsed_info = JSON.parse(fs.readFileSync(path));  
      
      for (const props of parsed_info.rooms){
        new Classes.Room(this.world, props);        
      }

      //Spawn items    
      for (const [item_name, spawn_room_arr] of Object.entries(parsed_info.item_spawn_rooms)){
        //Spawn all the items in all their rooms.
        for (const room_id of spawn_room_arr){        
          let props = this.world.entities_db[item_name].props;
          let item = new Classes.Item(this.world, props);
          item.props.container_id=  room_id;       

          let room = this.world.get_instance(room_id);
          room.add_entity(item.props.id);                  
        }      
      }
      
    }  else {
      console.error(`app.load_world -> generic_world.json does not exist.`);
    }
    
  }
  
  //Loads the entities.json file into world.entities_db
  load_entities_db(){
    if (fs.existsSync(`./entities.json`)){      
      this.world.entities_db = JSON.parse(fs.readFileSync("./entities.json"));      
    } else {
      console.error(`app.load_entities -> entities.js does not exist.`);
    }
  }
  
  //Timer for game loop.
  //Note: the loop technique allows for a minimum fixed length between
  //loop iterations, regardless of content of the loop.
  game_loop(){   
    
    let timer_id = setTimeout(
      function update(){
      
        this.run_simulation_tick();

        timer_id = setTimeout(update.bind(this), 1000);
      }.bind(this),
      1000
    );
  }

  //Iterate on all entities, and process their tick actions
  run_simulation_tick(){    

    this.world.world.forEach((entity) => {
      entity.do_tick();
    });

    this.world.users.forEach((user)=> {
      user.do_tick();      
    });
  }

  //Create a new user, spawned at spawn room, and associate the socket with it.
  //Returns the ID of the created user (String)
  create_new_user(socket, username){
    
    let user_props = {
      socket:       socket,
      name:         username,      
      container_id: this.FIRST_ROOM_ID
    }    
    
    let user= new Classes.User(this.world, user_props);    

    let lobby = this.world.get_instance(this.FIRST_ROOM_ID);    
    lobby.add_entity(user.props.id);

    user.send_chat_msg_to_client(`Welcome ${user.get_name()}!`);
    user.look_cmd();
    
    return user.props.id;
  }  
}

//Start Game Server
new Game_Controller();