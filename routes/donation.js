const express = require('express');
const router = express.Router();
const User = require('../models/users');

//Route 1:- Fetch donators with optional blood/heart filters :GET "api/donation/donators".
router.get('/donators', async (req, res) => {
    try {
        const blood = req.query.blood === 'true';
        const heart = req.query.heart === 'true';

        let filter;
        if (blood && heart) {
            filter = { $or: [{ 'donation.blood': true }, { 'donation.heart': true }] };
        } else if (blood) {
            filter = { 'donation.blood': true };
        } else if (heart) {
            filter = { 'donation.heart': true };
        } else {
            filter = { $or: [{ 'donation.blood': true }, { 'donation.heart': true }] };
        }

        const donators = await User.find(filter).select('name DOB gender bloodGroup email -_id');

        res.status(200).json({ total: donators.length, donators });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Some Error occured');
    }
});

module.exports = router;
