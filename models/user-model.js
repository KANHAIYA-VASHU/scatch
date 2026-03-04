const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true,
        trim: true,
    },
    phone: {
        type: String,
        required: true,
        trim: true,
    },
    line1: {
        type: String,
        required: true,
        trim: true,
    },
    line2: {
        type: String,
        default: "",
        trim: true,
    },
    city: {
        type: String,
        required: true,
        trim: true,
    },
    state: {
        type: String,
        required: true,
        trim: true,
    },
    postalCode: {
        type: String,
        required: true,
        trim: true,
    },
    country: {
        type: String,
        default: "India",
        trim: true,
    },
    isDefault: {
        type: Boolean,
        default: false,
    },
}, { _id: true });

const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        default: "",
        trim: true,
    },
    itemsCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    totalAmount: {
        type: Number,
        default: 0,
        min: 0,
    },
    status: {
        type: String,
        enum: ["pending", "current", "past"],
        default: "pending",
    },
    trackingId: {
        type: String,
        default: "",
        trim: true,
    },
    trackingStatus: {
        type: String,
        default: "Not shipped yet",
        trim: true,
    },
    placedAt: {
        type: Date,
        default: Date.now,
    },
    eta: {
        type: String,
        default: "",
        trim: true,
    },
}, { _id: true });

const userSchema = mongoose.Schema({
    fullname : {
        type: String,
        required: true,
        trim: true,
    },
    email : {
        type: String,
        required: true,
        trim: true,
    },
    password: String,
    cart: [{
        
            type: mongoose.Schema.Types.ObjectId,
            ref: "product"
        ,
    }],
    orders: [orderSchema],
    addresses: [addressSchema],
    contact: {
        type: String,
        default: "",
        trim: true,
    },
    picture: String,
});

module.exports = mongoose.model("user", userSchema);
