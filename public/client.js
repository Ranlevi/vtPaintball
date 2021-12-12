let chat=                 document.getElementById('Chat');
let disconnect_btn=       document.getElementById('disconnect_btn');
let freeze_btn=           document.getElementById('freeze_btn');
let parent=               document.getElementById('Parent');
let login_modal=          document.getElementById("login_modal");
let submit_btn=           document.getElementById("submit_btn");
let username_input =      document.getElementById("username_input");
let password_input =      document.getElementById("password_input");
let warning_text=         document.getElementById("warning_text");
let input_field=          document.getElementById("input_field");
let inv_btn=              document.getElementById("inv_btn");
let settings_btn=         document.getElementById("settings_btn");
let settings_modal=       document.getElementById("settings_modal");
let settings_submit_btn=  document.getElementById("settings_submit_btn");
let settings_cancel_btn=  document.getElementById("settings_cancel_btn");
let description_input=    document.getElementById("description_input");
let input_form=           document.getElementById("input_form");
let edit_modal=           document.getElementById("edit_modal");
let edit_modal_form=   document.getElementById("edit_modal_form");
let edit_modal_close_btn= document.getElementById("edit_modal_close_btn");
let edit_submit_btn=      document.getElementById("edit_submit_btn");

const CLIENT_VERSION=     0.1;

let stop_chat_scroll=       false;
let current_chat_bg_color=  null;
let status_obj = {
  holding:  "",
  head:     "",
  torso:    "",
  legs:     "",
  feet:     "",
  slots:    ""
};
let currently_edited_item_id = null;

username_input.focus();

//Open a SOCKETIO connection.
let socket = io();

//Handle Messages From Server
//------------------------------

//Display the Chat Message as a server_box.
//msg: {content: html string}
socket.on('Chat Message', (msg)=>{  

  let div = document.createElement("div");
  div.classList.add("box");
  div.classList.add("box_server");
  div.innerHTML = msg.content;
  chat.append(div);

  //If the chat is not frezzed, scroll it to view the latest msg.
  if (!stop_chat_scroll){
    div.scrollIntoView();  
  }
});

//Update the status object, health display & background.
//msg: {content: {inventory obj}}
socket.on('Status Message', (msg)=>{
  
  status_obj = {
    holding:  msg.content.holding,
    head:     msg.content.head,
    torso:    msg.content.torso,
    legs:     msg.content.legs,
    feet:     msg.content.feet,
    slots:    msg.content.slots
  }

  if (current_chat_bg_color===null){
    current_chat_bg_color = msg.content.room_lighting;
  }

  //Change the chat backgroud color.
  if (msg.content.room_lighting!==current_chat_bg_color){
    chat.style.backgroundColor= msg.content.room_lighting;
    current_chat_bg_color=      msg.content.room_lighting;
  }
});

//Check if Login was successful. If true - remove modal. Else - display error.
//msg: {content: {is_login_successful: bool}}
socket.on('Login Message', (msg)=>{
  
  if (msg.content.is_login_successful){        
    login_modal.classList.remove('is-active');
  } else {
    warning_text.innerHTML = 'Wrong username/password.';
  }
});

socket.on('Edit Message', (msg)=>{

  currently_edited_item_id = msg.id;

  let html = '';

  if (msg.type==="Item"){
    html += `<div class="field">`+

            `<label class="label has-text-white is-size-3">You are editing: ${msg.props.name}</lable>`+
    
            ` <label for="name" class="label has-text-white">Name</label>`+
            ` <div class="control">`+
            `   <input name="name" class="input" type="text" value="${msg.props.name}">`+
            ` </div>`+

            ` <label for="description" class="label has-text-white">Description</label>`+
            ` <div class="control">`+
            `   <textarea name="description" class="textarea" rows="3">${msg.props.description}</textarea>`+
            ` </div>`+

            ` <label for="is_consumable" class="label has-text-white">is_consumable</label>`+
            ` <div class="control">`+
            `   <label class="radio">`+
            `     <input type="radio" name="is_consumable" value="true" `+
            `       ${msg.props.is_consumable? "checked": ""}><span class="has-text-white">True</span>`+
            `   </label>`+
            `   <label class="radio">`+
            `     <input type="radio" name="is_consumable" value="false" `+
            `       ${!msg.props.is_consumable? "checked": ""}><span class="has-text-white">False</span>`+
            `   </label>`+
            ` </div>`+

            ` <label for="is_holdable" class="label has-text-white">is_holdable</label>`+
            ` <div class="control">`+
            `   <label class="radio">`+
            `     <input type="radio" name="is_holdable" value="true" `+
            `       ${msg.props.is_holdable? "checked": ""}><span class="has-text-white">True</span>`+
            `   </label>`+
            `   <label class="radio">`+
            `     <input type="radio" name="is_holdable" value="false" `+
            `       ${!msg.props.is_holdable? "checked": ""}><span class="has-text-white">False</span>`+
            `   </label>`+
            ` </div>`+

            ` <label for="is_gettable" class="label has-text-white">is_gettable</label>`+
            ` <div class="control">`+
            `   <label class="radio">`+
            `     <input type="radio" name="is_gettable" value="true" `+
            `       ${msg.props.is_gettable? "checked": ""}><span class="has-text-white">True</span>`+
            `   </label>`+
            `   <label class="radio">`+
            `     <input type="radio" name="is_gettable" value="false" `+
            `       ${!msg.props.is_gettable? "checked": ""}><span class="has-text-white">False</span>`+
            `   </label>`+
            ` </div>`+

            `  <label for="wear_slot" class="label has-text-white">Wear Slot</label>`+
            `   <div class="control">`+
            `    <div class="select">`+
            `     <select name="wear_slot">`+
            `       <option value="${msg.props.wear_slot}">${msg.props.wear_slot}</option>`+
            `       <option value="head">head</option>`+
            `       <option value="torso">torso</option>`+
            `       <option value="legs">legs</option>`+
            `       <option value="feet">feet</option>`+
            `       <option value="null">null</option>`+
            `     </select>`+
            `   </div>`+
            ` </div>`+

            // ` <label for="key_code" class="label has-text-white">Key Code</label>`+
            // ` <div class="control">`+
            // `   <input name="key_code" class="input" type="text" value="${msg.props.key_code}">`+
            // ` </div>`+

            `  <label for="action" class="label has-text-white">Action</label>`+
            `   <div class="control">`+
            `    <div class="select">`+
            `     <select name="action">`+
            `       <option value="${msg.props.action}">${msg.props.action}</option>`+           
            `     </select>`+
            `   </div>`+
            ` </div>`;            

    html += `</div>`;
                      
  } else if (msg.type==="Room"){

    html += `<div class="field">`+

            `<label class="label has-text-white is-size-3">You are editing: ${msg.props.name}</lable>`+
    
            ` <label for="name" class="label has-text-white">Name</label>`+
            ` <div class="control">`+
            `   <input name="name" class="input" type="text" value="${msg.props.name}">`+
            ` </div>`+

            ` <label for="description" class="label has-text-white">Description</label>`+
            ` <div class="control">`+
            `   <textarea name="description" class="textarea" rows="3">${msg.props.description}</textarea>`+
            ` </div>`+

            ` <label for="lighting" class="label has-text-white">Lighting</label>`+
            ` <div class="control">`+
            `   <input name="lighting" class="input" type="text" value="${msg.props.lighting}">`+
            ` </div>`;

    if (!msg.props.is_corridor_room){
      html += ` <label for="lighting" class="label has-text-white">Enable/Disable Exits</label>`+
              ` <div class="control">`+
              ` <label class="checkbox">`+
              `   <input type="checkbox" name="north" value="true" ${(msg.props.exits.north===null)? "": "checked"}>`+
              `     North`+
              ` </label>`+
              ` <label class="checkbox">`+
              `   <input type="checkbox" name="south" value="true" ${(msg.props.exits.south===null)? "": "checked"}>`+
              `     South`+
              ` </label>`+
              ` <label class="checkbox">`+
              `   <input type="checkbox" name="east" value="true" ${(msg.props.exits.east===null)? "": "checked"}>`+
              `     East`+
              ` </label>`+
              ` <label class="checkbox">`+
              `   <input type="checkbox" name="west" value="true" ${(msg.props.exits.west===null)? "": "checked"}>`+
              `     West`+
              ` </label>`+
              ` <label class="checkbox">`+
              `   <input type="checkbox" name="up" value="true" ${(msg.props.exits.up===null)? "": "checked"}>`+
              `     Up`+
              ` </label>`+
              ` <label class="checkbox">`+
              `   <input type="checkbox" name="down" value="true" ${(msg.props.exits.down===null)? "": "checked"}>`+
              `     Down`+
              ` </label>`+
              ` </div>`;
    }
            
    html += `</div>`;
  } else if (msg.type==="NPC"){

    html += `<div class="field">`+

            `<label class="label has-text-white is-size-3">You are editing: ${msg.props.name}</lable>`+
    
            ` <label for="name" class="label has-text-white">Name</label>`+
            ` <div class="control">`+
            `   <input name="name" class="input" type="text" value="${msg.props.name}">`+
            ` </div>`+

            ` <label for="description" class="label has-text-white">Description</label>`+
            ` <div class="control">`+
            `   <textarea name="description" class="textarea" rows="3">${msg.props.description}</textarea>`+
            ` </div>`;

    html += `</div>`;
  }
  
  edit_modal_form.innerHTML= html;
  edit_modal.classList.add('is-active');
});

socket.on('disconnect', ()=>{
  console.log(`Connection Closed By Server.`);
});

disconnect_btn.addEventListener('click', ()=>{
  socket.emit('Disconnect Message', {});

  input_form.setAttribute("disabled", true);
});
 
//Login Modal
//----------------------

//Handle Login request
submit_btn.addEventListener('click', ()=>{  

  let login_msg = {    
    content: {
      username: null,
      password: null
    }    
  }

  //Extract data from the form, and send it to the server via WS.
  let username = username_input.value;
  let password = password_input.value;

  if (username===""){
    warning_text.innerHTML = "Please enter a Name.";
  } else if (password===""){
    warning_text.innerHTML = "Please enter a Password";
  } else {
    login_msg.content.username=username;
    login_msg.content.password=password;

    socket.emit('Login Message', login_msg);    
  }  
});

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

//Handle clicks on hyperlinks
chat.addEventListener('click', (evt)=>{
  evt.stopPropagation();

  //Display a cmds box with available commands.
  if (evt.target.dataset.element==="pn_link"){    
    
    let actions = evt.target.dataset.actions.split('_');     
    let list = '';

    //Populate the actions list.
    for (const action of actions){
      list += `<li><span class="pn_action" data-element="pn_action" ` + 
              `data-action="${action}" data-id="${evt.target.dataset.id}" ` + 
              `data-name="${evt.target.dataset.name}"> `+ 
              `${action} ${evt.target.dataset.name}</span></li>`
    }
    
    let html = `<ul>${list}</ul>`;
      
    let div = document.createElement("div");
    div.classList.add("box");
    div.classList.add("box_cmds");    
    div.innerHTML = html;    
    chat.append(div);

    if (!stop_chat_scroll){
      div.scrollIntoView();  
    }    
      
  } else if (evt.target.dataset.element==="pn_action"){
    //Send a message to the server, in response to a click in the cmds box.
    //Note: a hyperlink click is translated to an input text message (i.e., the links
    //      are just an alias to entering textual commands.)
    
    //Handle Copy ID
    if (evt.target.dataset.action==="Copy ID"){
      navigator.clipboard.writeText(evt.target.dataset.id).then(function() {
        /* clipboard successfully set */
        //Create a Chat box and add it to the Chat, as feedback.
        let div = document.createElement("div");    
        div.classList.add("box");
        div.classList.add("box_user");    
        div.append(`Copied ID ${evt.target.dataset.id} to Clipboard.`);  
        chat.append(div);

        if (!stop_chat_scroll){
          div.scrollIntoView();  
        }
        
      }, function() {
        console.error('Copy ID failed.');
      });

    } else {

      //Handle other cmds
      let msg = {      
        content: `${evt.target.dataset.action} ${evt.target.dataset.id}`
      }

      socket.emit('User Input Message', msg);    

      //Create a Chat box and add it to the Chat, as feedback.
      let div = document.createElement("div");    
      div.classList.add("box");
      div.classList.add("box_user");    
      div.append(`${evt.target.dataset.action} ${evt.target.dataset.name}`);  
      chat.append(div);

      if (!stop_chat_scroll){
        div.scrollIntoView();  
      }
    }
    
    
    
    //Send a 1-word command, such as North.
  } else if (evt.target.dataset.element==="pn_cmd"){

    let msg = {      
      content: `${evt.target.dataset.actions}`
    }
    socket.emit('User Input Message', msg);        

    //Create a Chat box and add it to the Chat, as feedback.
    let div = document.createElement("div");
    div.classList.add("box");
    div.classList.add("box_user");
    div.append(`${evt.target.dataset.actions}`);  
    chat.append(div);

    if (!stop_chat_scroll){
      div.scrollIntoView();  
    }
    
  } else {
    input_field.focus();
  }
})

//Pressing the inv btn displays an inventory message in the Chat.
inv_btn.addEventListener('click', ()=>{

  let html = 
    `Your Inventory:`+
    `<p>&#9995; ${status_obj.holding}</p>`+
    `<p>&#x1F3A9 ${status_obj.head}</p>`+ 
    `<p>&#x1F455 ${status_obj.torso}</p>`+ 
    `<p>&#x1F456 ${status_obj.legs}</p>`+ 
    `<p>&#x1F45E ${status_obj.feet}</p>`+
    `<p>&#x1F9F3 ${status_obj.slots}</p>`;

  let div = document.createElement("div");
  div.classList.add("box");
  div.classList.add("box_server");
  div.innerHTML = html;
  chat.append(div);

  //If the chat is not frezzed, scroll it to view the latest msg.
  if (!stop_chat_scroll){
    div.scrollIntoView();  
  }
})

//Pressing the Settings btn displays the settings modal.
settings_btn.addEventListener('click', ()=>{
  settings_modal.classList.add('is-active');
  description_input.focus();
})

//Close the settings modal without submitting to the server.
settings_cancel_btn.addEventListener('click', ()=>{
  settings_modal.classList.remove('is-active');
})

edit_modal_close_btn.addEventListener('click', ()=>{
  edit_modal.classList.remove('is-active');
})

edit_submit_btn.addEventListener('click', ()=>{

  let formData = new FormData(edit_modal_form);

  let msg = {
    id: currently_edited_item_id,
    props: {}
  }

  for (const [key, value] of formData.entries()){
    msg.props[key] = value;
  }

  socket.emit('Edit Message', msg);        
  edit_modal.classList.remove('is-active');
});

//Submit settings to the server.
settings_submit_btn.addEventListener('click', ()=>{

  if (description_input.value!==''){
    let msg = {      
      content: {description: description_input.value}
    }
    socket.emit('Settings Message', msg);        
    settings_modal.classList.remove('is-active');
  }  
})

//Handle user text input in the game i/f.
input_field.addEventListener('submit', (evt)=> {     
  evt.preventDefault();    
  
  let msg = {    
    content: input_form.value
  }
  socket.emit('User Input Message', msg);          

  //Create a Chat box and add it to the Chat, as feedback.
  let div = document.createElement("div");
  div.classList.add("box");
  div.classList.add("box_user");
  div.innerHTML = input_form.value;
  chat.append(div);

  if (!stop_chat_scroll){
    div.scrollIntoView();  
  }

  input_form.value = '';
  input_form.blur(); //close soft keyboard.   
})


