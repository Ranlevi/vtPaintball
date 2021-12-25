/*
Apps.js
-------
Entry point for the server.
Handles serving the Client to users, user login
and user input.

Note: must be https for clipboard to work!

TODO:
invite mechanism?
join cmd to insert the join to the input field.
When only Look is availabe, do it without cmd box.
add id to game info
remove non-active players after a while
input cmds history/autocomplete
write help page.
tests
logs
add report abuse to user's cmds
*/

const SERVER_VERSION=  0.1;

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

app.use(express.static('public'));

app.get('/', (req, res) => {  
  res.sendFile(__dirname + '/index.html');
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
    
    //Handle Socket.IO Connections and messages.
    //-----------------------------------------

    this.io.on('connection', (socket) => {
      console.log('a client connected');

      //Each socket is attached to a single user.
      socket.user_id = null;       

      socket.on('Message From Client', (msg)=>{        

        switch(msg.type){
          case "Say":{
            user.say_cmd(msg.content);
            break;
          }

          case "Login":{
            //Try to find an active user with the same username.        
            let user_id = this.world.get_user_id_by_username(msg.content.username);
            let reply_msg = {
              type: "Login Reply",
              content: {
                is_login_successful: null
              }
            }          
    
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

              let user = this.world.get_instance(socket.user_id);
              user.send_chat_msg_to_client(`Welcome ${user.get_name()}!`);
              user.look_cmd();
            }
            break;
          }

          case "Disconnect":{
            //Remove the user from the world.
            let user = this.world.get_instance(socket.user_id);
            user.disconnect_from_game();
            break;
          }

          case "Command":{
            //The user clicked a command link.
            let user = this.world.get_instance(socket.user_id);

            switch(msg.content.cmd){
              case "North":
              case "South":
              case "East":
              case "West":
              case "Up":
              case "Down":{
                user.move_cmd(msg.content.content);
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
            }

            break;
          }

          case "Name Clicked":{
            let entity = this.world.get_instance(msg.content.id);
            entity.name_clicked(socket.user_id);
            break;
          }

          case "Edit User":{
            let user = this.world.get_instance(socket.user_id);
            user.set_description(msg.content.description);            
            break;
          }

          case "Join Game":{
            let user = this.world.get_instance(socket.user_id);
            user.join_cmd(msg.content.game_id);
            break;
          }

          case "Edit Game":{
            //Note: we assume the user is in a game and owns it, else he
            //would be able to edit it.
            let user = this.world.get_instance(socket.user_id);
            let game = this.world.get_instance(user.props.current_game_id);        
            game.do_edit(msg);
            user.send_chat_msg_to_client('Done.');
            break;
          }
        }
      })
    
      //Send text inputs for processing.
      socket.on('User Input Message', (msg)=>{            
        if (socket.user_id!==null){
          this.process_user_input(msg.content, socket.user_id);        
        }        
      });
    
      

      socket.on('Game Edit Message', (msg)=>{        
        //Note: we assume the user is in a game and owns it, else he
        //would be able to edit it.
        let user = this.world.get_instance(socket.user_id);
        let game = this.world.get_instance(user.props.current_game_id);
        
        game.do_edit(msg);
        user.send_chat_msg_to_client('Done.');
      })     
      
      socket.on('Link Clicked', (msg)=>{

        // let user=   this.world.get_instance(socket.user_id);

        switch(msg.target){
          case "Look":
          case "Get":  
          case "Hold":
          case "wear":
          case "Remove":
          case "Drop":
          case "Consume":
          case "Use":          
          case "Edit":
          case "Inventory":
            this.process_user_input(`${msg.target} ${msg.id}`, socket.user_id);
            break;
          
          case "NORTH":
          case "SOUTH":
          case "EAST":
          case "WEST":
          case "UP":
          case "DOWN":          
          case "Create":
          case "Start":
          case "Switch Teams":
          case "Quit To Lobby":          
            this.process_user_input(msg.target, socket.user_id);
            break;

          default:
            //This is a name, not a command.
            let entity= this.world.get_instance(msg.id);
            entity.name_clicked(socket.user_id);
            // let cmds_list= entity.get_cmds_arr(socket.user_id);
            // user.send_cmds_arr_to_client(cmds_list);         

        }
      });    
     
    });

    this.init_game();
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
        let room = new Classes.Room(this.world, props);        
        this.world.add_to_world(room);    
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
          this.world.add_to_world(item);
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
    
  //Takes the text recived via the webSockets interface,
  //and the user_id who sent it. Parses the text, and calls the required 
  //command method from Use.
  process_user_input(text, user_id){    
    
    if (text==='') return;//Ignore empty messages.
  
    //All input text is changed to lower case, and split by
    //white spaces.
    let normalized_text=  text.trim().toLowerCase();  
    let re=               /\s+/g; //search for all white spaces.
    let input_arr =       normalized_text.split(re);
    
    //Assume the first word is always a Command, and everything that
    //comes after that is a target.
    let cmd = input_arr[0];
    let target;
    if (input_arr.length===1){
      target= null;
    } else {
      target = input_arr.slice(1).join(' ');
    } 
    
    let user = this.world.get_instance(user_id);    
    
    switch(cmd){
      case 'look':
      case 'l':
        user.look_cmd(target);
        break;

      case 'north':
      case 'n':
        user.move_cmd('north');
        break;

      case 'south':
      case 's':
        user.move_cmd('south');
        break;

      case 'east':
      case 'e':
        user.move_cmd('east');
        break;
      
      case 'west':
      case 'w':
        user.move_cmd('west');
        break;

      case 'up':
      case 'u':
        user.move_cmd('up');
        break;

      case 'down':
      case 'd':
        user.move_cmd('down');
        break;

      case 'get':
      case 'g':
        user.get_cmd(target);
        break;

      case 'drop':
      case 'dr':
        user.drop_cmd(target);
        break;

      case 'hold':
      case 'h':
        user.hold_cmd(target);
        break;

      case 'wear':
      case 'we':
        user.wear_cmd(target);
        break;

      case "remove":
      case "r":
        user.remove_cmd(target);
        break;      

      case "consume":
      case "c":      
        user.consume_cmd(target);      
        break;

      case "say":
      case "sa":
        user.say_cmd(target);
        break;

      case "emote":
      case "em":
        user.emote_cmd(target);
        break;

      case "tell":
      case "'":
      case "t":
        //Assumes the 2nd word is the username to send a message to.
        let username = input_arr[1];
        let content = input_arr.slice(2).join(' ');
        user.tell_cmd(username, content);
        break;

      case "create":
      case "cr":
        user.create_cmd();
        break;      

      case "edit":
      case "ed":
        user.edit_cmd(target);
        break;

      case "use":
        user.use_cmd(target);
        break;

      case "join":
      case "j":
        user.join_cmd(target);
        break;

      case "shot":
      case "sh":
        user.shot_cmd(target);
        break;

      case "start":
      case "st":
        user.start_cmd();
        break;

      case "switch":
        user.switch_cmd();
        break;

      case "quit":
        user.quit_cmd();
        break;

      case "adminsay":
        user.admin_msg_cmd(target);
        break;

      case "game":
      case "g":
        user.game_cmd();
        break;

      case "inventory":
      case "inv":
      case "i":
        user.inventory_cmd();
        break;

      default:
        user.send_chat_msg_to_client(`Unknown command: ${text}`);        
    }  
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
    this.world.add_to_world(user);

    let lobby = this.world.get_instance(this.FIRST_ROOM_ID);
    lobby.add_entity(user.get_id());

    return user.get_id();
  }  
}

//Start Game Server
new Game_Controller();