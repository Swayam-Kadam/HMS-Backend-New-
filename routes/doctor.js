const express = require('express')
const router = express.Router();
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('../config/cloudinary');
const Doctor = require('../models/doctors');
const {body,validationResult} = require('express-validator');

//configure Cloudinary storage for doctor images
const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'Hospital-doctors',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'svg'],
        transformation: [{ width: 500, height: 500, crop: 'limit' }],
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter:(req,file,cb) =>{

        const allowedTypes =['image/jpeg','image/png','image/svg+xml','image/webp','image/avif'];
        if(!allowedTypes.includes(file.mimetype)){
            return cb(new Error('only JPEG,PNG,WEBP and SVG files are allowed'),false);
        }
        cb(null,true)
    }
});

//Route 1:- Fetch All Doctor Details Using: GET "/api/doctor".

router.get('/',async(req,res)=>{
    try{
        const filter = {};

        if (req.query.search && req.query.search.trim()) {
            const search = req.query.search.trim();
            const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [
                { f_name: regex },
                { l_name: regex },
                { email: regex },
                { department: regex },
            ];
        }

        const doctor = await Doctor.find(filter);
        res.json(doctor);
    }catch(error){
        console.error(error.message);
        res.status(500).send("some error occured")
    }
})

//Router 2 :- create a doctor using : POST "/api/doctor".Doesn't require Auth

router.post('/',
    upload.single('img'), // Multer middleware for handling single file upload with key "img"
    [
    body('email').isEmail().withMessage('plz enter valid email'),
    body('number').isLength({min:10,max:10}).withMessage('Phone-number must be 10 Digits'),
    body('NIC').isLength({min:8,max:8}).withMessage('NIC must be 8 Digits')
],async(req,res)=>{
        const result  = validationResult(req);
        if(!result.isEmpty()){
            return res.status(400).json({error: result.array() });
        }

        try {
            let doctorEmail = await Doctor.findOne({email:req.body.email})
            if(doctorEmail){
                return res.status(400).json({error:"sorry a doctor with email already exist"})
            }

            //Create and save the doctor
            const doctorData={
                ...req.body,
                img: req.file ? req.file.path : req.body.img, // Save file path with key "img"
                imgPublicId: req.file ? req.file.filename : ''
            };
            const doctor = new Doctor(doctorData)
            await doctor.save()
            res.status(201).json({ message: "Doctor created successfully", doctor });
        } catch (error) {
            console.error(Error.message);
    res.status(500).send("Some Error occured")
        }
})

//Route 3:- Update a doctor using : PATCH "/api/doctor/:id".
const EDITABLE_DOCTOR_FIELDS = ['f_name', 'l_name', 'email', 'number', 'NIC', 'DOB', 'gander', 'password', 'department'];

router.patch('/:id', upload.single('img'), async (req, res) => {
    try {
        const doctor = await Doctor.findById(req.params.id);
        if (!doctor) {
            return res.status(404).json({ error: "Doctor not found" });
        }

        const update = {};
        for (const field of EDITABLE_DOCTOR_FIELDS) {
            if (req.body[field] !== undefined) {
                update[field] = req.body[field];
            }
        }

        const oldPublicId = doctor.imgPublicId || '';
        if (req.file) {
            update.img = req.file.path;
            update.imgPublicId = req.file.filename;
        }

        const updatedDoctor = await Doctor.findByIdAndUpdate(
            req.params.id,
            update,
            { new: true }
        );

        if (req.file && oldPublicId && oldPublicId !== req.file.filename) {
            try {
                await cloudinary.uploader.destroy(oldPublicId);
            } catch (e) {
                console.error('Old doctor image cleanup failed:', e.message);
            }
        }

        res.status(200).json({ message: "Doctor updated successfully", doctor: updatedDoctor });
    } catch (error) {
        console.error(error.message);
        res.status(500).send("Some Error occured");
    }
})

//Route 4:- Delete a doctor using : DELETE "/api/doctor/:id".
router.delete('/:id', async (req, res) => {
    try {
        const doctor = await Doctor.findByIdAndDelete(req.params.id);
        if (!doctor) {
            return res.status(404).json({ error: "Doctor not found" });
        }

        if (doctor.imgPublicId) {
            try {
                await cloudinary.uploader.destroy(doctor.imgPublicId);
            } catch (e) {
                console.error('Doctor image cleanup failed:', e.message);
            }
        }

        res.status(200).json({ message: "Doctor deleted successfully", doctor });
    } catch (error) {
        console.error(error.message);
        res.status(500).send("Some Error occured");
    }
})

module.exports = router