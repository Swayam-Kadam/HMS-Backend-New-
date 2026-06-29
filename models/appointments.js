const mongoose = require('mongoose')
const { Schema } = mongoose

const AppointmentSchema = new Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    // ── Personal Info ────────────────────────────────────────────
    firstName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,       // String (not Number) to preserve formatting e.g. +1 234 567 890
      required: true,
    },
    nic: {
      type: String,       // String (not Number) — NIC can end with 'V' or 'X'
      required: true,
    },
    dob: {
      type: Date,
      required: true,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female'],
      required: true,
    },

    // ── Appointment Details ──────────────────────────────────────
    appointmentType: {
      type: String,
      enum: ['Clinic Visit', 'Video Consult', 'Emergency'],
      required: true,
    },
    department: {
      type: String,
      enum: [
        'Cardiology',
        'Dermatology',
        'ENT',
        'General',
        'Neurology',
        'Oncology',
        'Orthopedics',
        'Pediatrics',
        'Physical Therapy',
      ],
      required: true,
    },
    doctor: {
      type: String,
      required: true,
    },
    preferredDate: {
      type: Date,
      required: true,
    },
    preferredTime: {
      type: String,
      enum: ['09:00 AM', '10:00 AM', '11:00 AM', '02:00 PM', '03:00 PM', '04:00 PM'],
      required: true,
    },

    // ── Visit Info ───────────────────────────────────────────────
    reason: {
      type: String,
      required: true,
      minlength: 10,
    },
    notes: {
      type: String,
      default: '',
    },

    // ── Status ───────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'cancelled', 'completed'],
      default: 'pending',
    },
  },
  {
    timestamps: true,   // adds createdAt & updatedAt automatically
  }
)

AppointmentSchema.index({ user: 1 })
AppointmentSchema.index({ preferredDate: 1, doctor: 1 })

const Appointment = mongoose.model('Appointment', AppointmentSchema)
module.exports = Appointment