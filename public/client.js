let chat=                       document.getElementById('Chat');
let disconnect_btn=             document.getElementById('disconnect_btn');
let freeze_btn=                 document.getElementById('freeze_btn');
let parent=                     document.getElementById('Parent');
let login_modal=                document.getElementById("login_modal");
let submit_btn=                 document.getElementById("submit_btn");
let username_input =            document.getElementById("username_input");
let warning_text=               document.getElementById("warning_text");
let input_field=                document.getElementById("input_field");
let user_edit_modal=            document.getElementById("user_edit_modal");
let user_edit_submit_btn=       document.getElementById("user_edit_submit_btn");
let user_edit_cancel_btn=       document.getElementById("user_edit_cancel_btn");
let user_description_input=     document.getElementById("user_description_input");
let input_form=                 document.getElementById("input_form");
let game_edit_modal=            document.getElementById("game_edit_modal");
let game_edit_modal_form=       document.getElementById("game_edit_modal_form");
let game_edit_modal_close_btn=  document.getElementById("game_edit_modal_close_btn");
let game_edit_submit_btn=       document.getElementById("game_edit_submit_btn");
let game_current_max_score=     document.getElementById("game_current_max_score");
let perm_link_north=            document.getElementById("perm_link_north");
let perm_link_south=            document.getElementById("perm_link_south");
let perm_link_east=             document.getElementById("perm_link_east");
let perm_link_west=             document.getElementById("perm_link_west");
let perm_link_up=               document.getElementById("perm_link_up");
let perm_link_down=             document.getElementById("perm_link_down");
let perm_links_container=       document.getElementById("perm_links_container");


const isMobile = window.matchMedia("only screen and (max-width: 760px)").matches;

const CLIENT_VERSION=     0.1;

let stop_chat_scroll=         false;
let currently_edited_item_id= null;

let status_obj = {  
  room_lighting:  "CadetBlue",
};

//When index.html loads, the Login Modal appears. 
//Focus on the username field of the Login Modal.
username_input.focus();

let socket;

//Create a socket_io instance, and handle incoming messages
function create_socket(){
  let socket_io = io(); 
  
  //Display the Chat Message as a server_box.
  //msg: {content: html string}
  socket_io.on('Chat Message', (msg)=>{  
    insert_chat_box("box_server", msg.content);
  });

  socket_io.on('Exits Message', (msg)=>{
    //{perm_link_north: bol...}
    for (const [key, value] of Object.entries(msg)){
      switch(key){
        case "north":
          if (value===true){
            perm_link_north.classList.remove("perm_links_off");
            perm_link_north.classList.add("perm_links_on")
          } else {
            perm_link_north.classList.remove("perm_links_on");
            perm_link_north.classList.add("perm_links_off")
          }
        break;

        case "south":
          if (value===true){
            perm_link_south.classList.remove("perm_links_off");
            perm_link_south.classList.add("perm_links_on")
          } else {
            perm_link_south.classList.remove("perm_links_on");
            perm_link_south.classList.add("perm_links_off")
          }
        break;

        case "east":
          if (value===true){
            perm_link_east.classList.remove("perm_links_off");
            perm_link_east.classList.add("perm_links_on")
          } else {
            perm_link_east.classList.remove("perm_links_on");
            perm_link_east.classList.add("perm_links_off")
          }
        break;

        case "west":
          if (value===true){
            perm_link_west.classList.remove("perm_links_off");
            perm_link_west.classList.add("perm_links_on")
          } else {
            perm_link_west.classList.remove("perm_links_on");
            perm_link_west.classList.add("perm_links_off")
          }
        break;

        case "up":
          if (value===true){
            perm_link_up.classList.remove("perm_links_off");
            perm_link_up.classList.add("perm_links_on")
          } else {
            perm_link_up.classList.remove("perm_links_on");
            perm_link_up.classList.add("perm_links_off")
          }
        break;

        case "down":
          if (value===true){
            perm_link_down.classList.remove("perm_links_off");
            perm_link_down.classList.add("perm_links_on")
          } else {
            perm_link_down.classList.remove("perm_links_on");
            perm_link_down.classList.add("perm_links_off")
          }
        break;
      }
    }

    
  })

  //Update the status object.
  socket_io.on('Status Message', (msg)=>{
    status_obj = msg;
    chat.style.backgroundColor = status_obj.room_lighting;  
  });

  //Check if Login was successful. If true - remove modal. Else - display error.
  //msg: {is_login_successful: bool}
  socket_io.on('Login Message', (msg)=>{
    
    if (msg.is_login_successful){        
      login_modal.classList.remove('is-active');
    } else {
      warning_text.innerHTML = 'A User with this name already exists in the game.';
    }
  });

  //Display the relevant Edit Modal
  socket_io.on('Edit Message', (msg)=>{
    //msg = {props: props}
    
    if (msg.props.type==="User"){
      //Display the Edit User fields.
      
      user_description_input.innerHTML = msg.props.description;
      user_edit_modal.classList.add('is-active');

    } else if (msg.props.type==="Game"){
      game_current_max_score.innerHTML = msg.props.max_score;
      game_edit_modal.classList.add('is-active');

    } else {
      console.error(`Socket: Edit Message: unknown type - ${msg.props.type}`);
    }

  });

  //Display a Cmd Box with the recived cmds.
  socket_io.on('Cmds Box Message', (msg)=>{
    let list = "";
    for (const item of msg.content){
      list += `<li>${item}</li>`;
    }
    insert_chat_box('cmd_box', `<ul>${list}</ul>`);      
  });

  //Display a Disconnect message to the user.
  socket_io.on('disconnect', ()=>{
    console.log(`Connection Closed By Server.`);
    socket = null;
    input_form.setAttribute("disabled", true);
  });

  return socket_io;
}

//Handle Login Modal
//----------------------

//Init a socket_io connection.
//Extract data from the Login form, and send it to the server.
submit_btn.addEventListener('click', ()=>{  

  socket = create_socket();

  let login_msg = {
    username : null    
  }
  
  let username = username_input.value;  
  
  if (username===""){
    warning_text.innerHTML = "Please enter a Name.";
  } else {
    login_msg.username=username;    
    socket.emit('Login Message', login_msg);    
  }
  
  
});

//If the user presses Enter on the username input - submit it.
username_input.addEventListener("keydown", (evt)=> {

  if (evt.key==="Enter"){
    evt.preventDefault(); 

    //Emulate a 'submit btn' press.
    let event = new Event('click');
    submit_btn.dispatchEvent(event);
  }    
})

//Game Controls
//------------------

//A button that freezes the Chat display, for players to read easier.
freeze_btn.addEventListener('click', ()=>{
  stop_chat_scroll = !stop_chat_scroll;

  if (stop_chat_scroll===true){
    freeze_btn.classList.remove(`has-text-success`);
    freeze_btn.classList.add('has-text-danger');    
  } else {
    freeze_btn.classList.add(`has-text-success`);
    freeze_btn.classList.remove('has-text-danger');    
    
    chat.lastElementChild.scrollIntoView();
  }
})

//Emit a disconnect message, and disable the interface.
disconnect_btn.addEventListener('click', ()=>{  
  socket.emit('Disconnect Message', {});
  socket = null;
  input_form.setAttribute("disabled", true);
});

perm_links_container.addEventListener('click', (evt)=>{
  
  let clicked_exit = null;
  switch(evt.target.id){
    case "perm_link_north":
      if (evt.target.classList[0]==="perm_links_on"){
        clicked_exit = 'North';
      }
      break;

    case "perm_link_south":
      if (evt.target.classList[0]==="perm_links_on"){
        clicked_exit = 'South';
      }
      break;

    case "perm_link_east":
      if (evt.target.classList[0]==="perm_links_on"){
        clicked_exit = 'East';
      }
      break;

    case "perm_link_west":
      if (evt.target.classList[0]==="perm_links_on"){
        clicked_exit = 'West';
      }
      break;

    case "perm_link_up":
      if (evt.target.classList[0]==="perm_links_on"){
        clicked_exit = 'Up';
      }
      break;

    case "perm_link_down":
      if (evt.target.classList[0]==="perm_links_on"){
        clicked_exit = 'Down';
      }
      break;    
  }

  if (clicked_exit!==null){
    let msg = {    
      content: clicked_exit
    }
    socket.emit('User Input Message', msg); 
  }  
  
})

//Chat Interface
//--------------------

//Handle clicks on hyperlinks, according to the link_type
chat.addEventListener('click', (evt)=>{
  evt.preventDefault(); //to prevent Chrome Mobile from selecting the text.

  if (evt.target.classList[0]!=="link"){
    //User clicked on a non-link text
    return;
  }

  if (evt.target.innerHTML==="Copy ID" || evt.target.innerHTML==="Copy"){
    navigator.clipboard.writeText(evt.target.dataset.id).then(function() {
      let messsage = `Copied ID ${evt.target.dataset.id} to Clipboard.`;
      insert_chat_box('box_user', messsage);            
    }, function() {
      console.error('Copy ID failed.');
    });
    return;
  }
  
  //Send a message to server.
  let msg = {
    id:     evt.target.dataset.id,
    target: evt.target.innerHTML
  };
  
  socket.emit('Link Clicked', msg);
});

//Handle user text input in the game i/f.
input_field.addEventListener('submit', (evt)=> {     
  evt.preventDefault();    
  
  let msg = {    
    content: input_form.value
  }
  socket.emit('User Input Message', msg);   
  
  insert_chat_box("box_user", input_form.value);

  input_form.value = '';
  input_form.blur(); //close soft keyboard.   
})

//User Edit Modal
//------------------

//Close the modal without submitting to the server.
user_edit_cancel_btn.addEventListener('click', ()=>{
  user_edit_modal.classList.remove('is-active');
})

//Submit changes to the server.
user_edit_submit_btn.addEventListener('click', ()=>{

  if (user_description_input.value!==''){
    let msg = {      
      description: user_description_input.value
    }
    socket.emit('User Edit Message', msg);        
    user_edit_modal.classList.remove('is-active');
  }  
})

//Game Edit Modal
//----------------

//Close the modal without submitting to the server.
game_edit_modal_close_btn.addEventListener('click', ()=>{
  game_edit_modal.classList.remove('is-active');
})

//Send a Game Edit Message, and close the game edit modal.
game_edit_submit_btn.addEventListener('click', ()=>{

  let formData = new FormData(game_edit_modal_form);

  let msg = {    
    props: {}
  }

  for (const [key, value] of formData.entries()){
    msg.props[key] = value;
  }

  socket.emit('Game Edit Message', msg);        
  game_edit_modal.classList.remove('is-active');
});

// Aux. Functions
//-------------------

//Insert a Chat Box to the Chat interface.
function insert_chat_box(type, content){

  let div = document.createElement("div");
  div.classList.add("box");

  switch(type){
    case "cmd_box":
      div.classList.add("box_cmds");      
      break;

    case "box_server":
      div.classList.add("box_server");
      break;

    case "box_user":
      div.classList.add("box_user");    
      break;
  }

  div.innerHTML = content;
  chat.append(div);

  if (!stop_chat_scroll){
    div.scrollIntoView();  
  }

  //On desktop, focus on the input 
  if (!isMobile){
    input_form.focus();    
  }

}