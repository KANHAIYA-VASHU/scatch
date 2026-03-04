const mongoose = require("mongoose");

const productSchema = mongoose.Schema({
    image: {
        type: Buffer,
        required: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    price: {
        type: Number,
        required: true,
        min: 0,
    },
    discount: {
        type: Number,
        default: 0,
        min: 0,
    },
    bgcolor: {
        type: String,
        required: true,
        trim: true,
    },
    panelcolor: {
        type: String,
        required: true,
        trim: true,
    },
    textcolor: {
        type: String,
        default: "000000",
        trim: true,
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model("product", productSchema);
