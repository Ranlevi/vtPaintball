let tests_results_div = document.getElementById("tests_results");

function create_socket(){
  let socket_io = io(); 

  socket_io.on('Message From Server', (msg)=>{

    switch(msg.type){

      case "Login Reply":{ 
        
        if (current_test==="TEST 1"){
          if (msg.content.is_login_successful){
            console.log(`${current_test} PASS`);
          } else {
            console.log(`${current_test} FAIL`);
          }          
        }; 

        if (current_test==="TEST 2"){
          if (msg.content.is_login_successful){
            console.log(`${current_test} FAIL`);
          } else {
            console.log(`${current_test} PASS`);
          }          
        };
        
        break;
      }
    }  
   
  }); 
  
  return socket_io;
}

let socket = create_socket();

//TEST 1 - Login
let current_test = "TEST 1";

let msg = {
  type: "Login",
  content: {
    username : "AA"
  }
}
socket.emit('Message From Client', msg);

// https://pretagteam.com/question/wait-until-condition-is-met-or-timeout-is-passed-in-javascript

//TEST 2 - Login of User with same name.
// current_test = "TEST 2";

// msg = {
//   type: "Login",
//   content: {
//     username : "AA"
//   }
// }
// socket.emit('Message From Client', msg);