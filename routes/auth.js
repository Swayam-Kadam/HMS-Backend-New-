const express = require('express');
const User = require('../models/users');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const fetchuser = require('../middleware/fetchuser');
const { upload, cloudinary } = require('../config/cloudinary');
const { signAccessToken } = require('../utils/tokens');
const {
  createRefreshTokenForUser,
  refreshTokens,
  revokeRefreshToken,
} = require('../utils/refreshTokenService');

//ROUT 1:- Create user using: POST "/api/auth/createuser". No login required

router.post('/createuser',[
    body('name').isLength({min:3}).withMessage('name length should be minimum 3'),
    body('email').isEmail(),
    body('password').isLength({min:5}).withMessage('password length should be minimum 5')
],async(req,res)=>{
    let success = false;
     //if there are errors,return bad request and the errors
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        return res.status(400).json({success,error:errors.array()});
    }

    try{
        //check whater the user with this email exist already
        let user = await User.findOne({email:req.body.email});
        if(user){
            return res.status(400).json({success,error:"sorry a user with this email already exist"})
        }

        const salt = await bcrypt.genSalt(10);
        const secPass = await bcrypt.hash(req.body.password,salt);
        //Create a new user
        user = await User.create({
            name:req.body.name,
            email:req.body.email,
            password:secPass,
            address:req.body.address,
            DOB:req.body.dob,
            gender:req.body.gender,
        });

         const authtoken = signAccessToken(user.id);
         const refreshToken = await createRefreshTokenForUser(user.id);

         success=true;
         res.json({success,authtoken,refreshToken,role:user.role})

    }
    catch(error){
        console.log(error.message);
        res.status(500).send("Internal Server Error");
    }
});

//ROUTE 2:-Authenticate a user using : POST  "/api/auth/login". No login required
router.post('/login',[
    body('email').isEmail().withMessage('Enter a valid email'),
    body('password').exists().withMessage('password can not be blanck')
],async(req,res)=>{
    let success = false;
    
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        return res.status(400).json({error:errors.array()});
    }

    const {email,password} =req.body;
    try {
        let user = await User.findOne({email});
        if(!user){
            success=false;
            return res.status(400).json({error:"plz try to login with correct creadentials"})
        }
        const passwordCompare = await bcrypt.compare(password,user.password)
        if(!passwordCompare){
            success = false;
            return res.status(400).json({success,error:"plz try to login with correct credentials"})
        }

         const authtoken = signAccessToken(user.id);
         const refreshToken = await createRefreshTokenForUser(user.id);
         success = true;
         res.json({success,authtoken,refreshToken,role:user.role})
    } catch (error) {
        console.log(error.message);
         res.status(500).send("Internal Server Error");
    }
})

// ROUTE 3: Refresh access token using : POST "/api/auth/refresh". No login required
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ success: false, error: 'Refresh token is required' });
  }

  try {
    const result = await refreshTokens(refreshToken);

    if (!result.success) {
      return res.status(result.status).json({ success: false, error: result.error });
    }

    return res.json({
      success: true,
      authtoken: result.authtoken,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).send('Internal Server Error');
  }
});

// ROUTE 4: Logout using : POST "/api/auth/logout". No login required
router.post('/logout', async (req, res) => {
  try {
    await revokeRefreshToken(req.body.refreshToken);
    return res.json({ success: true });
  } catch (error) {
    console.log(error.message);
    return res.status(500).send('Internal Server Error');
  }
});

// ROUTE 5: find a specific user data  using : GET  "/api/auth/fetch".login required
router.get('/fetch',fetchuser,async(req,res)=>{
    try {
        const response = await User.findById(req.user.id).select("-password");
    res.json(response);
    } catch (error) {
        console.log(error.message);
        res.status(500).send("Internal Server Error");
    }
})


// ROUTE 6: find all users (bloodGroup filter + search + pagination) using : GET "/api/auth/all".
    router.get('/all',async(req,res)=>{
        try {
            const page = Math.max(1, parseInt(req.query.page, 10) || 1);
            const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
            const skip = (page - 1) * limit;

            const filter = {};

            if (req.query.bloodGroup && req.query.bloodGroup.trim()) {
                filter.bloodGroup = req.query.bloodGroup.trim();
            }

            if (req.query.search && req.query.search.trim()) {
                const search = req.query.search.trim();
                const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                filter.$or = [
                    { name: regex },
                    { email: regex },
                    { address: regex },
                ];
            }

            const [total, users, maleCount, femaleCount, bloodDonarCount, heartDonarCount] = await Promise.all([
                User.countDocuments(filter),
                User.find(filter).select("-password").sort({ _id: -1 }).skip(skip).limit(limit),
                User.countDocuments({ gender: { $regex: /^male$/i } }),
                User.countDocuments({ gender: { $regex: /^female$/i } }),
                User.countDocuments({ "donation.blood": true }),
                User.countDocuments({ "donation.heart": true })
            ]);

            res.json({
                total,
                currentPage: page,
                limit,
                totalPages: Math.ceil(total / limit),
                stats: {
                    male: maleCount,
                    female: femaleCount,
                    bloodDonar: bloodDonarCount,
                    heartDonar: heartDonarCount
                },
                users
            });
        } catch (error) {
            console.log(error.message);
        res.status(500).send("Internal Server Error");
        }
    })

// ROUTE 7: update user data (and optional profile image) using : PATCH "/api/auth/update/:id".
router.patch('/update/:id', upload.single('userImage'), async (req, res) => {
    const { id } = req.params;
    const { name, address, DOB, gender, donation, bloodGroup } = req.body;

    try {
        const update = {
            name, address, DOB, gender, bloodGroup,
            "donation.blood": donation?.blood,
            "donation.heart": donation?.heart,
        };

        let oldPublicId = '';
        if (req.file) {
            const existing = await User.findById(id).select('userImagePublicId');
            oldPublicId = existing?.userImagePublicId || '';
            update.userImage = req.file.path;
            update.userImagePublicId = req.file.filename;
        }

        const response = await User.findByIdAndUpdate(
            id,
            update,
            { new: true }
        ).select("-password");

        if (!response) {
            return res.status(404).json({ error: "User Not Found" });
        }

        if (req.file && oldPublicId && oldPublicId !== req.file.filename) {
            try {
                await cloudinary.uploader.destroy(oldPublicId);
            } catch (e) {
                console.error('Old image cleanup failed:', e.message);
            }
        }

        res.status(200).json({ message: "User updated successfully", response });
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ error: "Failed to update user" });
    }
});

// ROUTE 8: delete a user using : DELETE "/api/auth/delete/:id".
router.delete('/delete/:id', async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);

        if (!user) {
            return res.status(404).json({ error: "User Not Found" });
        }

        if (user.userImagePublicId) {
            try {
                await cloudinary.uploader.destroy(user.userImagePublicId);
            } catch (e) {
                console.error('User image cleanup failed:', e.message);
            }
        }

        res.status(200).json({ message: "User deleted successfully", user: { id: user._id, name: user.name, email: user.email } });
    } catch (error) {
        console.error("Error deleting user:", error.message);
        res.status(500).json({ error: "Failed to delete user" });
    }
});


module.exports = router
