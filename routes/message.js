const express = require('express');
const router = express.Router(); 
const Message = require('../models/messages');
const fetchuser = require('../middleware/fetchuser')

//Route 1:- Create a Message :POST "api/message/send".
router.post('/send',fetchuser,async(req,res)=>{
    try {
        const {title,message,tag,rating} = req.body;
        const messages = new Message({
            title,message,tag,rating,user:req.user.id
        })
        await messages.save()
        res.status(201).json({ message: "message created successfully", messages });
    } catch (error) {
        console.error(Error.message);
    res.status(500).send("Some Error occured")
    }
})

//Route 2:-Get All Message :GET "api/message/fetch".
router.get('/fetch',async(req,res)=>{
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
        const skip = (page - 1) * limit;

        const filter = {};

        // Filter 1: tag wise
        if (req.query.tag && Message.TAGS.includes(req.query.tag)) {
            filter.tag = req.query.tag;
        }

        // Filter 2: reply status (pending = no reply, replied = has reply)
        if (req.query.replyStatus === 'pending') {
            filter.replay = { $in: [null, ''] };
        } else if (req.query.replyStatus === 'replied') {
            filter.replay = { $nin: [null, ''] };
        }

        // Search across title and message
        if (req.query.search && req.query.search.trim()) {
            const search = req.query.search.trim();
            const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [
                { title: regex },
                { message: regex },
            ];
        }

        const [total, messages, repliedCount, pendingCount] = await Promise.all([
            Message.countDocuments(filter),
            Message.find(filter)
                .sort({ _id: -1 })
                .skip(skip)
                .limit(limit)
                .populate('user', 'name email')
                .lean(),
            Message.countDocuments({ replay: { $nin: [null, ''] } }),
            Message.countDocuments({ replay: { $in: [null, ''] } })
        ]);

        const data = messages.map((m) => ({
            id: m._id,
            message: m.message,
            replay: m.replay,
            tag: m.tag,
            title: m.title,
            user: m.user?._id || null,
            username: m.user?.name || '',
            useremail: m.user?.email || '',
            rating: m.rating,
            date: m.createdAt || m._id.getTimestamp(),
        }));

        res.json({
            total,
            currentPage: page,
            limit,
            totalPages: Math.ceil(total / limit),
            stats: {
                replied: repliedCount,
                pending: pendingCount
            },
            message: data
        });
    } catch (error) {
        console.error(Error.message);
        res.status(500).send("some Error occured")
    }
})

//Route 3:-Fetch specific user message:Get "api/message/specific-user".
router.get('/specific-user',fetchuser,async(req,res)=>{
    try {
        const page = Math.max(1, parseInt(req.query.page, 5) || 1);
        const limit = Math.max(1, parseInt(req.query.limit, 5) || 5);
        const skip = (page - 1) * limit;

        const filter = { user: req.user.id };

        if (req.query.tag && Message.TAGS.includes(req.query.tag)) {
            filter.tag = req.query.tag;
        }

        const [total, messages] = await Promise.all([
            Message.countDocuments(filter),
            Message.find(filter).sort({ _id: -1 }).skip(skip).limit(limit)
        ]);

        res.json({
            total,
            currentPage: page,
            limit,
            totalPages: Math.ceil(total / limit),
            message: messages
        });
    } catch (error) {
        console.error(Error.message);
        res.status(500).send("some Error occured")
    }
})

//Route 4:-Update a message for adding a replay for a message
router.patch('/message-update/:id',async(req,res)=>{
    const {id} = req.params;
    const {replay} = req.body;
    try {
        const response = await Message.findByIdAndUpdate(
            id,
            {replay},
            {new:true}
        );
        if (!response) {
            return res.status(404).json({ error: "User Not Found" });
        }

        res.status(200).json({ message: "User updated successfully", response });
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ error: "Failed to update user" });
    }
})

module.exports = router;