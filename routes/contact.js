const express = require('express');
const router = express.Router();
const Contact = require('../models/contacts');


//this route is use to send a message 
router.post('/send',async(req,res)=>{
    try {
        const {name,email,number,subject,message} = req.body;
        const contact =new  Contact({
          name,email,number,subject,message
        })
        await contact.save();
        res.status(201).json({ message: "Appointment created successfully", contact });
    } catch (error) {
        console.error(Error.message);
        res.status(500).send("Some Error occured")
    }
})

//this route is use to get all the message
router.get('/get',async(req,res)=>{
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
        const skip = (page - 1) * limit;

        const filter = {};

        // Filter 1: subject wise
        if (req.query.subject && req.query.subject.trim()) {
            filter.subject = req.query.subject.trim();
        }

        // Filter 2: read status (read / unread)
        if (req.query.readStatus === 'true') {
            filter.readStatus = true;
        } else if (req.query.readStatus === 'false') {
            filter.readStatus = false;
        }

        // Search across name, email, subject and message
        if (req.query.search && req.query.search.trim()) {
            const search = req.query.search.trim();
            const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [
                { name: regex },
                { email: regex },
                { subject: regex },
                { message: regex },
            ];
        }

        const [total, contacts, readCount, unreadCount] = await Promise.all([
            Contact.countDocuments(filter),
            Contact.find(filter).sort({ _id: -1 }).skip(skip).limit(limit).lean(),
            Contact.countDocuments({ readStatus: true }),
            Contact.countDocuments({ readStatus: false })
        ]);

        const data = contacts.map((c) => ({
            id: c._id,
            message: c.message,
            email: c.email,
            name: c.name,
            phone: c.number,
            readStatus: c.readStatus,
            date: c.createdAt || c._id.getTimestamp(),
        }));

        res.json({
            total,
            currentPage: page,
            limit,
            totalPages: Math.ceil(total / limit),
            stats: {
                read: readCount,
                unread: unreadCount
            },
            contact: data
        });
    } catch (error) {
        console.error(Error.message);
        res.status(500).send("Some Error occured")
    }
})

//this route is use to update the read status of a contact message
router.patch('/read-status/:id',async(req,res)=>{
    const { id } = req.params;
    const { readStatus } = req.body;

    if (typeof readStatus !== 'boolean') {
        return res.status(400).json({ error: "readStatus must be a boolean (true or false)" });
    }

    try {
        const contact = await Contact.findByIdAndUpdate(
            id,
            { readStatus },
            { new: true }
        );

        if (!contact) {
            return res.status(404).json({ error: "Contact message not found" });
        }

        res.status(200).json({ message: "Read status updated successfully", contact });
    } catch (error) {
        console.error("Error updating read status:", error.message);
        res.status(500).json({ error: "Failed to update read status" });
    }
})


module.exports = router