const express = require('express')
const router = express.Router();
const Appointment = require('../models/appointments');
const fetchuser = require('../middleware/fetchuser');

const twilio = require('twilio');

require('dotenv').config();
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? require("stripe")(stripeSecretKey) : null;

const client = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

//SMSfuncation this function is use to send sms when petions book their appointment
const sendSMSNotification = async (phoneNumber, message) => {
  try {
    const response = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: `+91${phoneNumber}`,  // Patient's phone number
    });

    console.log("SMS sent successfully:", response.sid);
  } catch (error) {
    console.error("Error sending SMS:", error);
  }
};



//Route 1:- Fetch All Appointments using:- GET "api/appointment/appo".
router.get('/appo',async(req,res)=>{
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
        const skip = (page - 1) * limit;

        const allowedStatuses = ['pending', 'accepted', 'rejected', 'cancelled', 'completed'];

        const filter = {};

        if (req.query.status && allowedStatuses.includes(req.query.status)) {
            filter.status = req.query.status;
        }

        if (req.query.search && req.query.search.trim()) {
            const search = req.query.search.trim();
            const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [
                { firstName: regex },
                { lastName: regex },
                { email: regex },
                { phone: regex },
                { nic: regex },
                { doctor: regex },
                { department: regex },
            ];
        }

        const [total, appoinment, pending, accepted, rejected, cancelled, completed] = await Promise.all([
            Appointment.countDocuments(filter),
            Appointment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
            Appointment.countDocuments({ status: 'pending' }),
            Appointment.countDocuments({ status: 'accepted' }),
            Appointment.countDocuments({ status: 'rejected' }),
            Appointment.countDocuments({ status: 'cancelled' }),
            Appointment.countDocuments({ status: 'completed' })
        ]);

        res.json({
            total,
            currentPage: page,
            limit,
            totalPages: Math.ceil(total / limit),
            stats: {
                pending,
                accepted,
                rejected,
                cancelled,
                completed
            },
            appointment: appoinment
        });
    } catch (error) {
        console.error(Error.message);
        res.status(500).send("Some Error occured")
    }
})


//Route 1:- Fetch All Appointments Of Specific User using:- GET "api/appointment/appouser".
router.get('/appouser',fetchuser,async(req,res)=>{
  try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
      const skip = (page - 1) * limit;

      const allowedStatuses = ['pending', 'accepted', 'rejected', 'cancelled', 'completed'];

      const filter = { user: req.user.id };

      if (req.query.status && allowedStatuses.includes(req.query.status)) {
        filter.status = req.query.status;
      }

      const [total, appoinment, totalAppointment, totalAccepted, totalPending, totalRejected] = await Promise.all([
        Appointment.countDocuments(filter),
        Appointment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Appointment.countDocuments({ user: req.user.id }),
        Appointment.countDocuments({ user: req.user.id, status: 'accepted' }),
        Appointment.countDocuments({ user: req.user.id, status: 'pending' }),
        Appointment.countDocuments({ user: req.user.id, status: 'rejected' })
      ]);

      res.json({
        total,
        currentPage: page,
        limit,
        totalPages: Math.ceil(total / limit),
        stats: {
          totalAppointment,
          accepted: totalAccepted,
          pending: totalPending,
          rejected: totalRejected
        },
        appointment: appoinment
      });
  } catch (error) {
      console.error(Error.message);
      res.status(500).send("Some Error occured")
  }
})


//Route 3:- Create a Appointment :POST "api/appointment/appo".
router.post('/appo', fetchuser, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      nic,
      dob,
      gender,
      appointmentType,
      department,
      doctor,
      preferredDate,
      preferredTime,
      reason,
      notes,
      status,
    } = req.body;

    const appointment = new Appointment({
      firstName,
      lastName,
      email,
      phone,
      nic,
      dob,
      gender,
      appointmentType,
      department,
      doctor,
      preferredDate,
      preferredTime,
      reason,
      notes: notes || '',
      status: status || 'pending',
      user: req.user.id,
    });

    await appointment.save();

    sendSMSNotification(
      phone,
      `Hello ${firstName}, your appointment is booked on ${preferredDate}.`
    );

    res.status(201).json({ message: 'Appointment created successfully', appointment });
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Some Error occured');
  }
});


const EDITABLE_FIELDS = [
  'firstName', 'lastName', 'email', 'phone', 'nic', 'dob', 'gender',
  'appointmentType', 'department', 'doctor', 'preferredDate', 'preferredTime',
  'reason', 'notes',
];

//Route 4:- Cancel an Appointment (client) :PATCH "api/appointment/cancel/:id".
router.patch('/cancel/:id', fetchuser, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (appointment.user.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to cancel this appointment' });
    }

    if (appointment.status === 'cancelled' || appointment.status === 'completed') {
      return res.status(400).json({ error: `Cannot cancel a ${appointment.status} appointment` });
    }

    appointment.status = 'cancelled';
    await appointment.save();

    sendSMSNotification(
      appointment.phone,
      `Hello ${appointment.firstName}, your appointment on ${appointment.preferredDate} has been cancelled.`
    );

    res.status(200).json({ message: 'Appointment cancelled successfully', appointment });
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Some Error occured');
  }
});

//Route 5:- Edit an Appointment (client, pending only) :PUT "api/appointment/appo/:id".
router.put('/appo/:id', fetchuser, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (appointment.user.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to edit this appointment' });
    }

    if (appointment.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending appointments can be edited' });
    }

    const update = {};
    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) {
        update[field] = req.body[field];
      }
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided to update' });
    }

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    );

    res.status(200).json({ message: 'Appointment updated successfully', appointment: updatedAppointment });
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Some Error occured');
  }
});


//Route 6:- Update an Appointment Status :PETCH "api/appointment/update/:id".
router.patch("/update-status/:id", async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ['pending', 'accepted', 'rejected', 'cancelled', 'completed'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}` });
    }

    try {
      // Find the appointment and update its status
      const updatedAppointment = await Appointment.findByIdAndUpdate(
        id,
        { status },
        { new: true } // Return the updated document
      );
  
      if (!updatedAppointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }
  
      res.status(200).json({ message: "Status updated successfully", updatedAppointment });
    } catch (error) {
      console.error("Error updating status:", error);
      res.status(500).json({ error: "Failed to update status" });
    }
  });


router.post('/create-checkout-session', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in backend env.',
      });
    }

    const { appointment } = req.body;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const lineItems = appointment.map((appo) => {
      const firstName = appo.firstName || appo.f_name || '';
      const lastName = appo.lastName || appo.l_name || '';
      return {
        price_data: {
          currency: 'inr',
          product_data: {
            name: `${firstName} ${lastName}`.trim() || 'Hospital Appointment',
            description: `Appointment for ${appo.email}`,
          },
          unit_amount: 50000,
        },
        quantity: 1,
      };
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${frontendUrl}/success`,
      cancel_url: `${frontendUrl}/unsuccess`,
      metadata: {
        user_email: appointment[0]?.email || '',
      },
    });

    res.json({ id: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});


module.exports = router
