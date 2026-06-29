const mongoose = require('mongoose');
const {Schema} = mongoose;

const userSchema = new Schema({
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        required:true
    },
    role:{
        type:String,
        default:'user'
    },
    userImage:{
        type:String,
        default:''
    },
    userImagePublicId:{
        type:String,
        default:''
    },
    address:{
        type:String,

    },
    DOB:{
        type:Date,
    },
    gender:{
        type:String,
    },
    donation:{
        blood: { type: Boolean, default: false },
        heart: { type: Boolean, default: false }
    },
    bloodGroup:{
        type:String,
    },
    date:{
        type: Date,
        default: Date.now
    }
})
const user = mongoose.model('user',userSchema);
module.exports = user