const express = require('express');
const router = express.Router();
const Appointment = require('../models/appointments');
const Doctor = require('../models/doctors');
const User = require('../models/users');

// Per-appointment consultation fee in INR (matches Stripe unit_amount 50000 paise = ₹500)
const APPOINTMENT_FEE = 500;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const getLocalDayRange = (date = new Date()) => {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    return { start, end };
};

const getLocalMonthRange = (date = new Date()) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return { start, end };
};

// Match appointments for "today": booked today OR scheduled for today
const todayAppointmentFilter = (start, end) => ({
    $or: [
        { createdAt: { $gte: start, $lt: end } },
        { preferredDate: { $gte: start, $lt: end } },
    ],
});

// Convert a [{ _id: <monthNumber>, count }] aggregation into a fixed 12-month array
const buildMonthlyCounts = (agg) => {
    const map = {};
    agg.forEach((a) => { map[a._id] = a.count; });
    return MONTHS.map((m, i) => ({ month: m, count: map[i + 1] || 0 }));
};

//Route 1:- Dashboard stats for charts :GET "api/dashboard/stats".
router.get('/stats', async (req, res) => {
    try {
        const now = new Date();
        const { start: startOfToday, end: endOfToday } = getLocalDayRange(now);
        const { start: startOfMonth, end: startOfNextMonth } = getLocalMonthRange(now);
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const startOfNextYear = new Date(now.getFullYear() + 1, 0, 1);

        const todayFilter = todayAppointmentFilter(startOfToday, endOfToday);

        const [
            totalPatients,
            activeDoctors,
            todayAppointments,
            todayPending,
            monthlyAppointmentsCount,
            statusAgg,
            departmentAgg,
            todayCompleted,
            todayInProgress,
            todayCancelled,
            todayPendingSummary,
            todayRejected,
            monthlyAppointmentsAgg,
            monthlyNewPatientsAgg,
            monthlyRevenueAgg,
        ] = await Promise.all([
            User.countDocuments({ role: 'user' }),
            Doctor.countDocuments(),
            Appointment.countDocuments(todayFilter),
            Appointment.countDocuments({ ...todayFilter, status: 'pending' }),
            Appointment.countDocuments({ createdAt: { $gte: startOfMonth, $lt: startOfNextMonth } }),

            // Overall appointment status distribution
            Appointment.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]),

            // Overall appointments grouped by department
            Appointment.aggregate([
                { $group: { _id: '$department', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),

            // Today's summary (scheduled or booked today)
            Appointment.countDocuments({ ...todayFilter, status: 'completed' }),
            Appointment.countDocuments({ ...todayFilter, status: 'accepted' }),
            Appointment.countDocuments({ ...todayFilter, status: 'cancelled' }),
            Appointment.countDocuments({ ...todayFilter, status: 'pending' }),
            Appointment.countDocuments({ ...todayFilter, status: 'rejected' }),

            // Monthly: appointments created per month (current year)
            Appointment.aggregate([
                { $match: { createdAt: { $gte: startOfYear, $lt: startOfNextYear } } },
                { $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 } } },
            ]),

            // Monthly: new patients registered per month (current year)
            User.aggregate([
                { $match: { role: 'user', date: { $gte: startOfYear, $lt: startOfNextYear } } },
                { $group: { _id: { $month: '$date' }, count: { $sum: 1 } } },
            ]),

            // Monthly: all appointments per month (current year) for revenue trend
            Appointment.aggregate([
                { $match: { createdAt: { $gte: startOfYear, $lt: startOfNextYear } } },
                { $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 } } },
            ]),
        ]);

        // Status distribution -> full object with all statuses defaulting to 0
        const appointmentStatus = { pending: 0, accepted: 0, rejected: 0, cancelled: 0, completed: 0 };
        statusAgg.forEach((s) => { if (s._id) appointmentStatus[s._id] = s.count; });

        // Patients by department + department load (percentage of all appointments)
        const totalDeptAppointments = departmentAgg.reduce((sum, d) => sum + d.count, 0);
        const patientsByDepartment = departmentAgg.map((d) => ({ department: d._id, count: d.count }));
        const departmentLoad = departmentAgg.map((d) => ({
            department: d._id,
            percentage: totalDeptAppointments ? Math.round((d.count / totalDeptAppointments) * 100) : 0,
        }));

        // Monthly arrays
        const apptMonthly = buildMonthlyCounts(monthlyAppointmentsAgg);
        const newPatientsMonthly = buildMonthlyCounts(monthlyNewPatientsAgg);
        const appointmentsOverview = MONTHS.map((m, i) => ({
            month: m,
            appointments: apptMonthly[i].count,
            newPatients: newPatientsMonthly[i].count,
        }));

        const revenueTrend = buildMonthlyCounts(monthlyRevenueAgg).map((r) => ({
            month: r.month,
            revenue: r.count * APPOINTMENT_FEE,
        }));

        res.json({
            cards: {
                totalPatients,
                activeDoctors,
                todayAppointments,
                todayPending,
                monthlyAppointments: monthlyAppointmentsCount,
                monthlyRevenue: monthlyAppointmentsCount * APPOINTMENT_FEE,
            },
            appointmentStatus,
            patientsByDepartment,
            departmentLoad,
            todaySummary: {
                completed: todayCompleted,
                inProgress: todayInProgress,
                cancelled: todayCancelled,
                pending: todayPendingSummary,
                rejected: todayRejected,
            },
            appointmentsOverview,
            revenueTrend,
        });
    } catch (error) {
        console.error('Dashboard stats error:', error.message);
        res.status(500).send('Some Error occured');
    }
});

module.exports = router;
