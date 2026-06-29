const mongoose = require('mongoose');
const {Schema} = mongoose

const MESSAGE_TAGS = ['General', 'Appointment', 'Billing', 'Feedback', 'Complaint', 'Emergency', 'Support'];

const MessegeSchema = Schema({
    user:{
        type:mongoose.Schema.ObjectId,
        ref:'user'
    },
    title:{
        type:String,
        require:true
    },
    message:{
        type:String,
        require:true
    },
    tag:{
        type:String,
        enum: MESSAGE_TAGS,
        default: 'General'
    },
    rating:{
        type:Number,
        min:1,
        max:5
    },
    replay:{
        type:String,
    }
}, { timestamps: true });

MessegeSchema.statics.TAGS = MESSAGE_TAGS;

const Message = mongoose.model('message',MessegeSchema)
Message.createIndexes()
module.exports = Message