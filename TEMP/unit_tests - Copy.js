let tests_results_div = document.getElementById("tests_results");

let state_obj = {
  test_user_1: {
    name:                   "Test User 1",
    id:                     null,
    game_id:                null,
    gun_id:                 null,
    recieved_msgs:          []
  },
  test_user_2: {
    name:                   "Test User 2",
    id:                     null,    
    game_id:                null,
    game_list_button_id:    null,
    gun_id:                 null,
    recieved_msgs:          []
  },
}

const WAIT_TIME = 500; //in ms

function create_socket(user){
  let socket_io = io(); 

  socket_io.on('Message From Server', (msg)=>{   
    state_obj[user].recieved_msgs.push(msg);
  });
  
  return socket_io;
}

function sleep(){
  return new Promise(resolve => setTimeout(resolve, WAIT_TIME));
}

function htmlToTemplate(html){
  let template = document.createElement('template');
  template.innerHTML = html;
  return template.content;
}

function print_test_result(html){
  let div = document.createElement("div");
  div.innerHTML = html;
  tests_results_div.append(div);
}

function send_name_clicked_msg(clicked_entity_id, user_socket){

  let msg = {
    type:         "Name Clicked",
    content: {
      id:   clicked_entity_id
    }
  }
  user_socket.emit('Message From Client', msg);
}

async function run_test(){

  let socket_test_user1 = create_socket("test_user_1"); 
  let socket_test_user2 = create_socket("test_user_2"); 
  
  //Setup 1:
  //Action: Send a nominal login message. 
  //Expect: successful login.
  const setup_test_user_1 = async function(socket_test_user1){    

    let msg = {
      type:         "Login",
      content: {
        username :  "Test User 1"
      }
    }
    socket_test_user1.emit('Message From Client', msg);
  
    await sleep();

    let html = "Setup 1: Login Test User 1. --> ";  

    //Check if login was successful  
    let rcvd_msg = state_obj["test_user_1"].recieved_msgs.shift();

    let template = htmlToTemplate(rcvd_msg.content);

    let text = template.childNodes[0].textContent;
    if (text==="Welcome "){
      html += "Pass.";
    } else {
      html += `Fail.`;
    }
    print_test_result(html);   

    //Get the user id
    state_obj.test_user_1.id = template.childNodes[1].dataset.id;
  }
  await setup_test_user_1(socket_test_user1);

  //------------------------------------------------------------
  //------------------------------------------------------------

  //Clear message store
  state_obj.test_user_1.recieved_msgs = []; 

  //Test 1:
  //Action: Try to create another user with the same name.
  //Expect: login error message.
  const test_1 = async function(socket_test_user2){   

    let msg = {
      type:         "Login",
      content: {
        username :  "Test User 1"
      }
    }
    socket_test_user2.emit('Message From Client', msg);

    await sleep();

    let rcvd_msg = state_obj["test_user_2"].recieved_msgs.shift();
    
    let html = "Test 1: User with the same name. --> ";  
    if (rcvd_msg.content.is_login_successful){
      html += "Fail.";
    } else {
      html += "Pass.";
    }
    print_test_result(html);
  }
  await test_1(socket_test_user2);

  //------------------------------------------------------------
  //------------------------------------------------------------
  
  //Setup 2:
  //Setup 2nd User
  //Do a noraml login for test user 2
  const setup_test_user_2 = async function(socket_test_user2){
    let html = "Setup 2: Login Test User 2. --> ";  

    let msg = {
      type:         "Login",
      content: {
        username :  "Test User 2"
      }
    }
    socket_test_user2.emit('Message From Client', msg); 
  
    await sleep();

    //Check if login was successful  
    let rcvd_msg = state_obj["test_user_2"].recieved_msgs.shift();

    let template = htmlToTemplate(rcvd_msg.content);

    let text = template.childNodes[0].textContent;
    if (text==="Welcome "){
      html += "Pass.";
    } else {
      html += `Fail.`;
    }
    print_test_result(html);   

    //Get the user id
    state_obj.test_user_2.id = template.childNodes[1].dataset.id;  
  }
  await setup_test_user_2(socket_test_user2);   

  //Get ID of Game List Button
  let template= htmlToTemplate(state_obj.test_user_2.recieved_msgs[0].content);
  template=     htmlToTemplate(template.children[2].innerHTML);
  state_obj.test_user_2.game_list_button_id = template.children[1].dataset.id;  
  
  //Clear message store
  state_obj.test_user_2.recieved_msgs = []; 

  //------------------------------------------------------------
  //------------------------------------------------------------

  //Test 2
  //Action: Test User 1 Clicking his own name
  //Expect: Cmd Box with User Info, Edit User, Create a New Game, Join a Game.
  const test_2 = async function(socket_test_user1){

    send_name_clicked_msg(state_obj.test_user_1.id, socket_test_user1);
    await sleep();
    
    //Get the CMD Box message. 
    let rcvd_msg=  state_obj.test_user_1.recieved_msgs.shift();
    let rcvd_cmds = "";
    for (const line of rcvd_msg.content){
      let template = htmlToTemplate(line);
      rcvd_cmds += template.firstChild.innerHTML;       
    }

    let html = "Test 2: Test User 1 Clicking his name. --> ";  
    if (rcvd_cmds==="User InfoEdit UserCreate A New GameJoin A Game"){
      html += "Pass.";
    } else {
      html += "Failed.";
    }

    print_test_result(html);
  }
  await test_2(socket_test_user1);

  //------------------------------------------------------------
  //------------------------------------------------------------

  //Test 3
  //Action: Test User 1 Clicking User Info.
  //Expect: Chat message with default user info.
  const test_3 = async function (socket_test_user1){
    
    let msg = {
      type:    "User Info",
    }
    socket_test_user1.emit('Message From Client', msg); 

    await sleep(1000);

    let rcvd_msg=   state_obj.test_user_1.recieved_msgs.shift();
    let template=   htmlToTemplate(rcvd_msg.content)    
    let html = "Test 3: Test User 1 Clicked 'User Info'. --> ";
    if (template.children[1].childNodes[0].data==="A (non-NPC) human."){    
      html += "Passed.";
    } else {
      html += `Failed.`;
    }

    print_test_result(html);
  }
  await test_3(socket_test_user1);

  //------------------------------------------------------------
  //------------------------------------------------------------

  //Test 4
  //Action: Test User 1 Clicking Edit User.
  //Expect: Edit Modal User opens, with default user description.
  const test_4 = async function (socket_test_user1){
    
    let msg = {
      type: "Get User Details For Modal"
    }
    socket_test_user1.emit('Message From Client', msg); 

    await sleep();

    //Get the latest message. 
    let rcvd_msg=  state_obj.test_user_1.recieved_msgs.shift();
    let html = "Test 4: Test User 1 Clicking Edit User. --> ";

    if (rcvd_msg.content.description==="A (non-NPC) human."){    
      html += "Passed.";
    } else {
      html += `Failed.`;
    }

    print_test_result(html);
  }
  await test_4(socket_test_user1); 

  //------------------------------------------------------------
  //------------------------------------------------------------

  //Test 5
  //Action: Test User 1 Changes description and presses Submit.
  //Expect: Recive 'Description Updated' msg.
  const test_5 = async function (socket_test_user1){   

    let msg = {
      type:    "Edit User",
      content: {
        description: "A Test Description."
      }      
    }
    socket_test_user1.emit('Message From Client', msg); 

    await sleep();

    //Get the latest message. 
    let html = "Test 5: Test User 1 Changing description. --> ";
    let rcvd_msg=  state_obj.test_user_1.recieved_msgs.shift();    
    
    if (rcvd_msg.content==="Description updated."){    
      html += "Passed.";
    } else {
      html += `Failed.`;
    }

    print_test_result(html);
  }
  await test_5(socket_test_user1); 

  //------------------------------------------------------------
  //------------------------------------------------------------

  //Test 6
  //Action: Test User 1 Clicking User Info.
  //Expect: Chat message with the new info.
  const test_6 = async function (socket_test_user1){

    let msg = {
      type:    "User Info",
    }
    socket_test_user1.emit('Message From Client', msg); 

    await sleep();

    let rcvd_msg=   state_obj.test_user_1.recieved_msgs.shift();
    let template=   htmlToTemplate(rcvd_msg.content)    
    let html = "Test 6: Test User 1 Clicked 'User Info'. --> ";
    if (template.children[1].childNodes[0].data==="A Test Description."){    
      html += "Passed.";
    } else {
      html += `Failed.`;
    }

    print_test_result(html);
    
  }
  await test_6(socket_test_user1); 

  //------------------------------------------------------------
  //------------------------------------------------------------

  //Test 7
  //Action: Test User 1 Clicking Create A New Game.
  //Expect: Server sends a message to open Edit Game Modal
  
  const test_7 = async function (socket_test_user1){    

    let msg = {
      type:    "Create A New Game",      
    }
    socket_test_user1.emit('Message From Client', msg); 

    await sleep();
    
    let html=      "Test 7: Test User 1 clicks Create New Game. --> ";
    let rcvd_msg=  state_obj.test_user_1.recieved_msgs.pop();
    
    if (rcvd_msg.type==="Game Info"){ 
      html += "Passed.";
    } else {
      html += "Failed.";
    }

    print_test_result(html);
  }
  await test_7(socket_test_user1); 

  //Get the Game's ID.
  template = htmlToTemplate(state_obj.test_user_1.recieved_msgs[3].content);
  state_obj.test_user_1.game_id = template.children[1].dataset.id;  
  state_obj.test_user_2.game_id = template.children[1].dataset.id;  

  //Clear message store
  state_obj.test_user_1.recieved_msgs = []; 

  //------------------------------------------------------------
  //------------------------------------------------------------

  //Test 8
  //Action: Test User 1 Clicking the room's name.
  //Expect: Server Message with room description.
  const test_8 = async function (socket_test_user1){    

    send_name_clicked_msg("r0000002", socket_test_user1);
    await sleep();
    
    let html=      "Test 8: Test User 1 clicks room name. --> ";
    let rcvd_msg=  state_obj.test_user_1.recieved_msgs.shift();
    let template=  htmlToTemplate(rcvd_msg.content);    

    if (template.children[0].innerHTML==="Red Spawn Room"){ 
      html += "Passed.";
    } else {
      html += "Failed.";
    }

    print_test_result(html);

  }
  await test_8(socket_test_user1); 

  //------------------------------------------------------------
  //------------------------------------------------------------

  //Test 9: 
  //Action: Test User 1 Clicking Game Name.
  //Expect: Server msg with Game Info, Copy ID, Edit Game, Start.
  const test_9 = async function (socket_test_user1){

    send_name_clicked_msg(state_obj.test_user_1.game_id, socket_test_user1);
    await sleep();
    
    //Get the CMD Box message. 
    let rcvd_msg=  state_obj.test_user_1.recieved_msgs.shift();
    let rcvd_cmds = "";
    for (const line of rcvd_msg.content){
      let template = htmlToTemplate(line);
      rcvd_cmds += template.firstChild.innerHTML;
    }    
  
    let html = "Test 9: Test User 1 Clicking game name. --> ";      
    if (rcvd_cmds==="Game InfoCopy IDEdit GameStartQuit To Lobby"){
      html += "Pass.";
    } else {
      html += "Failed.";
    }
  
    print_test_result(html);
  }
  await test_9(socket_test_user1); 

  //------------------------------------------------------------
  //------------------------------------------------------------

  //Test 10: 
  //Action: Test User 1 Clicking Game Info.
  //Expect: Server sends a game info msg.
  const test_10 = async function (socket_test_user1){

    let msg = {
      type:    "Game Info",
      content: {
        id: state_obj.test_user_1.game_id
      }
    }
    socket_test_user1.emit('Message From Client', msg); 

    await sleep();

    let rcvd_msg=   state_obj.test_user_1.recieved_msgs.shift();
    let template=   htmlToTemplate(rcvd_msg.content);
    template=       template.children[0].children[0];        

    let html = "Test 10: Test User 1 Clicked 'Game Info'. --> ";
    if (template.innerHTML==="Text Tag"){    
      html += "Passed.";
    } else {
      html += `Failed.`;
    }

    print_test_result(html);
    
  }
  await test_10(socket_test_user1); 

  //------------------------------------------------------------
  //------------------------------------------------------------
  
  //Test 11: 
  //Action: Test User 1 Clicking Edit Game.
  //Expect: Server sends a message to open Edit Game Modal.
  const test_11 = async function (socket_test_user1){    

    let msg = {
      type:    "Get Game Info For Modal",      
    }
    socket_test_user1.emit('Message From Client', msg); 

    await sleep();
    
    let html=      "Test 11: Test User 1 clicks Edit. --> ";
    let rcvd_msg=  state_obj.test_user_1.recieved_msgs.pop();    
    
    if (rcvd_msg.content.name==="Text Tag"){ 
      html += "Passed.";
    } else {
      html += "Failed.";
    }

    print_test_result(html);
  }
  await test_11(socket_test_user1); 

  //------------------------------------------------------------
  //------------------------------------------------------------

  //Test 12: 
  //Action: Test User 1 Setting various parameters of the game.
  //Expect: Server sends a game info msg with the new parameters..
  const test_12 = async function (socket_test_user1){    
    
    let msg = {
      type:    "Edit Game",
      content: {
        props: {
          name:       "My Test Game",
          max_score:  "15"
        }
      }
    }
    socket_test_user1.emit('Message From Client', msg); 

    await sleep();    

    let html=      "Test 12: Test User 1 submit Game Edit parameters. --> ";
    let rcvd_msg=  state_obj.test_user_1.recieved_msgs.shift();    
    let template=  htmlToTemplate(rcvd_msg.content);
    template=      template.childNodes[0];
    
    let template2=  htmlToTemplate(rcvd_msg.content);
    template2=      template2.childNodes[2];            
    
    if (template.childNodes[0].innerHTML==="My Test Game" &&
        template2.childNodes[1].data===" is: 15"){ 
      html += "Passed.";
    } else {
      html += "Failed.";
    }

    print_test_result(html);
  }
  await test_12(socket_test_user1); 

  //------------------------------------------------------------
  //------------------------------------------------------------

  //Clear message store
  state_obj.test_user_2.recieved_msgs = []; 

  //Test 13: 
  //Action: Test User 2 clicking on the Game List Button.
  //Expect: Server msg with Look and Use
  const test_13 = async function (socket_test_user2){

    send_name_clicked_msg(state_obj.test_user_2.game_list_button_id, socket_test_user2);
    await sleep();
    
    //Get the CMD Box message. 
    let rcvd_msg=  state_obj.test_user_2.recieved_msgs.shift();
    
    let rcvd_cmds = "";
    for (const line of rcvd_msg.content){
      let template = htmlToTemplate(line);
      rcvd_cmds += template.firstChild.innerHTML;
    }    

    let html = "Test 13: Test User 2 Clicking Game List Button. --> ";  
    if (rcvd_cmds==="LookUse"){
      html += "Pass.";
    } else {
      html += "Failed.";
    }
  
    print_test_result(html);
  }
  await test_13(socket_test_user2); 

  //------------------------------------------------------------
  //------------------------------------------------------------

  //Test 14: 
  //Action: Test User 2 clicking on the Game List Button Look cmd.
  //Expect: Server msg with Look results on the button.
  const test_14 = async function (socket_test_user2){    

    let msg = {
      type:   "Look",
      content: {
        id:   state_obj.test_user_2.game_list_button_id
      }
    }
    socket_test_user2.emit('Message From Client', msg); 

    await sleep();
    
    let html=      "Test 14: Test User 2 clicks Look on Game List Button. --> ";
    let rcvd_msg=  state_obj.test_user_2.recieved_msgs.shift();    
    let template=  htmlToTemplate(rcvd_msg.content);
    
    if (template.children[1].innerHTML==="Pressing this button will display the list of publicly available games."){ 
      html += "Passed.";
    } else {
      html += "Failed.";
    }

    print_test_result(html);
  }
  await test_14(socket_test_user2); 

  //------------------------------------------------------------
  //------------------------------------------------------------

  //Test 15: 
  //Action: Test User 2 clicking on the Game List Button Use cmd.
  //Expect: Server msg with the game listed.
  const test_15 = async function (socket_test_user2){    

    let msg = {
      type:   "Use",
      content: {
        id:   state_obj.test_user_2.game_list_button_id
      }
    }
    socket_test_user2.emit('Message From Client', msg); 

    await sleep();
    
    let html=      "Test 15: Test User 2 clicks Use on Game List Button. --> ";
    let rcvd_msg=  state_obj.test_user_2.recieved_msgs.shift();
    let template=  htmlToTemplate(rcvd_msg.content);
       
    if (template.children[1].innerText==="My Test Game"){ 
      html += "Passed.";
    } else {
      html += "Failed.";
    }

    print_test_result(html);
  }
  await test_15(socket_test_user2); 

  //------------------------------------------------------------
  //------------------------------------------------------------

  //Test 16: 
  //Action: Test User 2 clicking on the My Test Game
  //Expect: Server msg with cmds
  const test_16 = async function (socket_test_user2){    

    let msg = {
      type:   "Name Clicked",
      content: {
        id:   state_obj.test_user_2.game_id
      }
    }
    socket_test_user2.emit('Message From Client', msg); 

    await sleep();
    
    let html=      "Test 16: Test User 2 clicks the game's name. --> ";
    let rcvd_msg=  state_obj.test_user_2.recieved_msgs.shift();    
    let rcvd_cmds = "";
    for (const line of rcvd_msg.content){
      let template = htmlToTemplate(line);
      rcvd_cmds += template.firstChild.innerHTML;
    }    
    
    if (rcvd_cmds==="Game InfoCopy IDJoin This Game"){
      html += "Pass.";
    } else {
      html += "Failed.";
    }    
    print_test_result(html);
  }
  await test_16(socket_test_user2); 

  //------------------------------------------------------------
  //------------------------------------------------------------

  //Test 17: 
  //Action: Test User 2 clicking Join Game
  //Expect: Server msg of joining game.
  const test_17 = async function (socket_test_user2){    

    let msg = {
      type:    "Join This Game",
      content: {
        id:   state_obj.test_user_2.game_id
      }
    }
    socket_test_user2.emit('Message From Client', msg); 

    await sleep();
    
    let html=      "Test 17: Test User 2 clicks Join This Game. --> ";    

    let rcvd_msg=  state_obj.test_user_2.recieved_msgs.shift();
    let template=  htmlToTemplate(rcvd_msg.content)    
    
    if (template.childNodes[1].data===" has joined team Blue"){ 
      html += "Passed.";
    } else {
      html += "Failed.";
    }

    print_test_result(html);
  }
  await test_17(socket_test_user2);

  //------------------------------------------------------------
  //------------------------------------------------------------
  template = htmlToTemplate(state_obj.test_user_2.recieved_msgs[2].content);
  template = htmlToTemplate(template.children[3].innerHTML);
  state_obj.test_user_2.gun_id = template.children[0].dataset.id;  

  state_obj.test_user_2.recieved_msgs = [];

  //------------------------------------------------------------
  //------------------------------------------------------------

  //Test 18: 
  //Action: Test User 2 clicking Desert Eagle
  //Expect: Test User 2 recive cmds: Look, Get, Hold
  const test_18 = async function (socket_test_user2){

    send_name_clicked_msg(state_obj.test_user_2.gun_id, socket_test_user2);
    await sleep();
    
    //Get the CMD Box message. 
    let rcvd_msg=  state_obj.test_user_2.recieved_msgs.shift();
    
    let rcvd_cmds = "";
    for (const line of rcvd_msg.content){
      let template = htmlToTemplate(line);
      rcvd_cmds += template.firstChild.innerHTML;
    }    
    
    let html = "Test 18: Test User 2 Clicking Desert Eagle. --> ";  
    if (rcvd_cmds==="LookHoldGet"){
      html += "Pass.";
    } else {
      html += "Failed.";
    }
  
    print_test_result(html);
  }
  await test_18(socket_test_user2); 

  //------------------------------------------------------------
  //------------------------------------------------------------

  //Test 19: 
  //Action: Test User 2 clicking Hold
  //Expect: Test User 2 recive msg: You Hold It
  const test_19 = async function (socket_test_user2){    

    let msg = {
      type:    "Hold",
      content: {
        id:   state_obj.test_user_2.gun_id
      }
    }
    socket_test_user2.emit('Message From Client', msg); 

    await sleep();
    
    let html=      "Test 19: Test User 2 clicks Hold on Gun. --> ";        
    let rcvd_msg=  state_obj.test_user_2.recieved_msgs.shift();
    if (rcvd_msg.content==="You hold it."){ 
      html += "Passed.";
    } else {
      html += "Failed.";
    }

    print_test_result(html);
  }
  await test_19(socket_test_user2);

  //------------------------------------------------------------
  //------------------------------------------------------------
  
  //Test 20: 
  //Action: Test User 2 clicking South
  //Expect: Test User 2 recive new room messages.
  const test_20 = async function (socket_test_user2){    

    let msg = {
      type:    "South",
    }
    socket_test_user2.emit('Message From Client', msg); 

    await sleep();
    
    let html=      "Test 20: Test User 2 clicks South. --> ";
    let test_passed= true;
    
    let rcvd_msg=  state_obj.test_user_2.recieved_msgs[0];
    
    if (rcvd_msg.content!=="You travel south."){ 
      test_passed = false;
    }
    
    rcvd_msg=  state_obj.test_user_2.recieved_msgs[1];
    if (rcvd_msg.content.background!=="#0000ff"){ 
      test_passed = false;
    }
    
    rcvd_msg=  state_obj.test_user_2.recieved_msgs[2];       
    if (!(rcvd_msg.content.north && rcvd_msg.content.south)){ 
      test_passed = false;
    }        
    
    rcvd_msg=  state_obj.test_user_2.recieved_msgs[3];
    
    let template = htmlToTemplate(rcvd_msg.content);    
    
    if (template.children[0].innerHTML!=="Corridor"){ //continue here: why fail?
      test_passed = false;
    }    
    
    if (test_passed){
      html += "Passed.";
    } else {
      html += "Failed."
    }

    print_test_result(html);
  }
  await test_20(socket_test_user2);

  state_obj.test_user_2.recieved_msgs = []
  
  //------------------------------------------------------------
  //------------------------------------------------------------
  
  //Test 21: 
  //Action: Test User 1 clicking start
  //Expect: Test User 2 recive start message.
  const test_21 = async function (socket_test_user1){    

    let msg = {
      type:     "Start",
      content: {
        id:     state_obj.test_user_1.game_id
      }
    }
    socket_test_user1.emit('Message From Client', msg); 

    await sleep();
    
    let html=      "Test 21: Test User 1 clicks Start. --> ";
    let rcvd_msg=  state_obj.test_user_2.recieved_msgs.pop();    
    
    if (rcvd_msg.content==="THE GAME HAS STARTED!!"){ 
      html += "Passed.";
    } else {
      html += "Failed.";
    }

    print_test_result(html);
  }
  await test_21(socket_test_user1); 

  state_obj.test_user_2.recieved_msgs = []
  //------------------------------------------------------------
  //------------------------------------------------------------

  //Test 22: 
  //Action: Test User 2 clicking Look
  //Expect: Test User 2 recive msg of spawn room with Desert Eagle
  const test_22 = async function (socket_test_user2){    

    let msg = {
      type:    "Look",
      content: {
        id:   null
      }
    }
    socket_test_user2.emit('Message From Client', msg); 

    await sleep();
    
    let html=      "Test 22: Test User 2 clicks Look. --> ";    

    let rcvd_msg=  state_obj.test_user_2.recieved_msgs.shift();
    let template=  htmlToTemplate(rcvd_msg.content)

    let test_passed = true;

    if (template.children[0].innerHTML!=="Blue Spawn Room"){
      test_passed = false;
    }    
    
    if (template.children[3].children[0].innerHTML!="Desert Eagle"){
      test_passed = false;
    }
    
    if (test_passed){
      html += "Passed.";
    } else {
      html += "Failed.";
    }    
    
    print_test_result(html);
  }
  await test_22(socket_test_user2);

  
}

run_test();