//A database of all the entities in the game.
class World {
  //Holds all entities and user instances, accesible by ID (String)
  //Only a single instance of it exists.
  constructor(){
    this.world = new Map(); //id: item instance.
    this.users = new Map(); 
    
    //Holds the registered users, and their saved items.
    this.users_db = {
      users: {}, //username:  props
      items: {}  //id:        props
    };

    //Default Admin account.
    // this.users_db.users['HaichiPapa'] =  {
      this.users_db.users['aa'] =  {
        id:                 'u0000000', 
        name:               "aa",      
        subtype:            "User",
        description:        "Admin Account.",
        password:           "aa", //String
        owned_holodeck_id:  "h0000000"
      };

    this.entities_db = null;
  }

  get_instance(instance_id){
    //returns undefined if no entity exists
    let instance;
    instance = this.world.get(instance_id);    

    if (instance===undefined){
      instance = this.users.get(instance_id);
    }

    return instance;
  }

  add_to_world(instance){

    let Classes = require('./classes');    

    if (instance instanceof Classes.User){
      this.users.set(instance.props.id, instance);
    } else {      
      this.world.set(instance.props.id, instance);    
    }    
  }  

  remove_from_world(item_id){  
    if (this.world.has(item_id)){
      this.world.delete(item_id);  
    } else if (this.users.has(item_id)){
      this.users.delete(item_id);
    }    
  }

  get_user_id_by_username(username){    
    
    for (let inst of this.users.values()){      
      if (inst.props.name===username){
        return inst.id;        
      }
    }

    //No user with given username was found.
    return null;
  }

  save_user_to_users_db(user_id){

    let user = this.users.get(user_id);
    //Update the users_db object with new values
    this.users_db[user.props.name] = {
      id:                 user.props.id, 
      name:               user.props.name,      
      subtype:            user.props.subtype,
      description:        user.props.description,
      password:           user.props.password,
      owned_holodeck_id:  user.props.owned_holodeck_id,
      is_admin:           user.props.is_admin,      
      container_id:       user.props.container_id,
      head:               user.props.head,
      torso:              user.props.torso,
      legs:               user.props.legs,
      feet:               user.props.feet,
      holding:            user.props.holding,
      slots:              user.props.slots,
      slots_size_limit:   user.props.slots_size_limit, 
    }

    let inv_arr = user.get_all_items();        
    for (const obj of inv_arr){
      //obj: {id: string, location: string}
      let entity = this.get_instance(obj.id);
      this.users_db.items[entity.props.id] = {
        type: "Item",
        props: Utils.deepCopyFunction(entity.props)
      };               
    }
  }

}

exports.World=          World;